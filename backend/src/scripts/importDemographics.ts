/**
 * School enrollment by race/ethnicity from the NCES Common Core of Data via
 * the Urban Institute Education Data API, into school_demographics. One row
 * per school and year with shares of enrollment; the latest CCD year is 2023.
 *
 *   npx tsx src/scripts/importDemographics.ts [ccdYear=2023 | 2019-2023 | 2019 2020 2021]
 */
import { sqliteDb } from '../db';
import { logger } from '../utils/logger';

const API = 'https://educationdata.urban.org/api/v1';
const UA = 'paschools-metadata-import/1.0 (+https://chrispeterkins.com/paschools)';
const yearArgs = process.argv.slice(2).length ? process.argv.slice(2) : ['2023'];
const ccdYears = yearArgs.flatMap((a) => { const m = a.match(/^(\d{4})-(\d{4})$/); return m ? Array.from({ length: Number(m[2]) - Number(m[1]) + 1 }, (_, i) => Number(m[1]) + i) : [Number(a)]; });
let ccdYear = ccdYears[0];
// CCD race codes: 1 White, 2 Black, 3 Hispanic, 4 Asian, 5 American Indian/Alaska Native, 6 Native Hawaiian/Pacific Islander, 7 Two or more, 9 Unknown, 99 Total.
const RACE: Record<number, string> = { 1: 'white', 2: 'black', 3: 'hispanic', 4: 'asian', 5: 'aian', 6: 'nhpi', 7: 'multi', 9: 'unknown', 99: 'total' };

sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS school_demographics (
    year INTEGER NOT NULL, school_id INTEGER NOT NULL, total INTEGER,
    white REAL, black REAL, hispanic REAL, asian REAL, aian REAL, nhpi REAL, multi REAL, unknown REAL,
    source TEXT, PRIMARY KEY (year, school_id)
  );
`);

async function fetchAll<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  let url: string | null = `${API}/${path}?fips=42&per_page=5000`;
  while (url) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
    const body = (await res.json()) as { results: T[]; next: string | null };
    out.push(...body.results);
    url = body.next;
  }
  return out;
}

async function main() {
  // Map NCES school id → our school id via the directory's seasch ("AUN-number").
  const dir = await fetchAll<{ ncessch: string; seasch: string | null }>(`schools/ccd/directory/${ccdYear}`);
  const byKey = new Map((sqliteDb.prepare(`SELECT s.id, d.aun || '-' || CAST(CAST(s.school_number AS INTEGER) AS TEXT) AS key FROM schools s JOIN districts d ON d.id = s.district_id`).all() as Array<{ id: number; key: string }>).map((r) => [r.key, r.id]));
  const ncesToId = new Map<string, number>();
  for (const d of dir) { const id = d.seasch ? byKey.get(d.seasch.trim()) : undefined; if (id != null) ncesToId.set(d.ncessch, id); }
  const rows = await fetchAll<{ ncessch: string; race: number; enrollment: number | null }>(`schools/ccd/enrollment/${ccdYear}/grade-99/race`);
  const bySchool = new Map<number, Record<string, number>>();
  for (const r of rows) {
    const id = ncesToId.get(r.ncessch); const key = RACE[r.race];
    if (id == null || !key || r.enrollment == null || r.enrollment < 0) continue;
    (bySchool.get(id) ?? bySchool.set(id, {}).get(id)!)[key] = r.enrollment;
  }
  const upsert = sqliteDb.prepare(`INSERT OR REPLACE INTO school_demographics (year, school_id, total, white, black, hispanic, asian, aian, nhpi, multi, unknown, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  let written = 0;
  sqliteDb.transaction(() => {
    for (const [id, v] of bySchool) {
      const total = v.total ?? Object.entries(v).filter(([k]) => k !== 'total').reduce((s, [, n]) => s + n, 0);
      if (!total) continue;
      const pct = (k: string) => (v[k] == null ? null : Math.round((v[k] / total) * 1000) / 10);
      upsert.run(ccdYear + 1, id, total, pct('white'), pct('black'), pct('hispanic'), pct('asian'), pct('aian'), pct('nhpi'), pct('multi'), pct('unknown'), `ccd-${ccdYear}`);
      written++;
    }
  })();
  logger.info({ ccdYear, directory: dir.length, matched: ncesToId.size, raceRows: rows.length, written }, 'demographics imported');
}
(async () => { for (const y of ccdYears) { ccdYear = y; await main(); } })().catch((e) => { logger.error(e); process.exit(1); });
