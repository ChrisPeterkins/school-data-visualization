/**
 * Rewrite school and district names from PDE's capitals-and-abbreviations
 * form to readable display names, keeping the original in pde_name.
 * Idempotent; refreshes the search index and map points afterwards.
 */
import { displayName } from '@pa-school-data/shared';
import { sqliteDb } from '../db';
import { logger } from '../utils/logger';
import { refreshSearchIndex } from '../services/searchIndex';
import { refreshMapPoints } from '../services/mapPoints';

for (const table of ['schools', 'districts']) {
  const cols = (sqliteDb.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((c) => c.name);
  if (!cols.includes('pde_name')) sqliteDb.exec(`ALTER TABLE ${table} ADD COLUMN pde_name TEXT`);
  const rows = sqliteDb.prepare(`SELECT id, name, pde_name FROM ${table}`).all() as Array<{ id: number; name: string; pde_name: string | null }>;
  const update = sqliteDb.prepare(`UPDATE ${table} SET name = ?, pde_name = ? WHERE id = ?`);
  let changed = 0;
  sqliteDb.transaction(() => {
    for (const r of rows) {
      const original = r.pde_name ?? r.name;
      const pretty = displayName(original);
      if (pretty !== r.name || r.pde_name == null) { update.run(pretty, original, r.id); changed++; }
    }
  })();
  logger.info({ table, rows: rows.length, changed }, 'names normalised');
}
refreshSearchIndex();
refreshMapPoints();
logger.info('done');
