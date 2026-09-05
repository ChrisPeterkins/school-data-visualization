/**
 * Full-text index over schools, districts, and counties for the global
 * search box. Names are indexed both as typed and with spaces removed so
 * "pennhills" finds Penn Hills; prefix matching handles partial words.
 */
import { sqliteDb } from '../db';
import { logger } from '../utils/logger';

export interface SearchHit {
  kind: 'school' | 'district' | 'county';
  id: number;
  name: string;
  detail: string;
  score: number;
}

export function ensureSearchIndex(): void {
  sqliteDb.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
      kind UNINDEXED, id UNINDEXED, name, detail, squashed, tokenize = 'unicode61 remove_diacritics 2'
    );
  `);
}

export function refreshSearchIndex(): number {
  ensureSearchIndex();
  const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const rows: Array<{ kind: string; id: number; name: string; detail: string }> = [
    ...(sqliteDb.prepare(`
      SELECT 'school' AS kind, s.id, s.name, TRIM(COALESCE(s.city, '') || ' · ' || d.name || ' · ' || c.name || ' County' || COALESCE(' · ' || s.school_type, '')) AS detail
      FROM schools s JOIN districts d ON d.id = s.district_id JOIN counties c ON c.id = d.county_id WHERE s.is_active = 1
    `).all() as any[]),
    ...(sqliteDb.prepare(`
      SELECT 'district' AS kind, d.id, d.name, c.name || ' County' || COALESCE(' · ' || d.city, '') AS detail
      FROM districts d JOIN counties c ON c.id = d.county_id
    `).all() as any[]),
    ...(sqliteDb.prepare(`SELECT 'county' AS kind, id, name || ' County' AS name, 'County' AS detail FROM counties`).all() as any[]),
  ];
  const insert = sqliteDb.prepare(`INSERT INTO search_index (kind, id, name, detail, squashed) VALUES (?, ?, ?, ?, ?)`);
  const txn = sqliteDb.transaction(() => {
    sqliteDb.exec(`DELETE FROM search_index`);
    for (const r of rows) insert.run(r.kind, r.id, r.name, r.detail, squash(r.name));
    return rows.length;
  });
  const n = txn();
  logger.info(`search_index: ${n} entries`);
  return n;
}

export function search(q: string, limit = 10): SearchHit[] {
  ensureSearchIndex();
  const terms = q.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  const squashed = terms.join('');
  // Every typed word must prefix-match somewhere; OR the whole thing squashed.
  const match = `(${terms.map((t) => `"${t}"*`).join(' AND ')}) OR squashed:"${squashed}"*`;
  try {
    const rows = sqliteDb.prepare(`
      SELECT kind, id, name, detail, bm25(search_index, 0, 0, 1.0, 0.4, 1.2) AS score
      FROM search_index WHERE search_index MATCH ?
      ORDER BY CASE kind WHEN 'county' THEN 0 WHEN 'district' THEN 1 ELSE 2 END * 0.1 + score
      LIMIT ?
    `).all(match, limit) as SearchHit[];
    return rows;
  } catch {
    return [];
  }
}
