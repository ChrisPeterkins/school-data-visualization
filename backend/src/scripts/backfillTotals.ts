/**
 * One-time backfill of the all-grades "Total" rows (grade 0) for every PSSA
 * school/district file. Earlier imports dropped them for most years and kept
 * them as grade NULL for 2018/2019/2021, so charts could not get a clean
 * school-wide figure. Afterwards run the PVAAS step for each year so the new
 * rows pick up across-grades growth:
 *
 *   npx tsx src/scripts/backfillTotals.ts [pssa/school pssa/district pssa/state]
 *   for y in 2018 2019 2021 2022 2023 2024 2025; do npx tsx src/scripts/importYear.ts $y --pvaas-only; done
 */
import path from 'path';
import fs from 'fs';
import { sqliteDb } from '../db';
import { DataImporterFixed } from '../services/dataImporterFixed';
import { logger } from '../utils/logger';

async function main() {
  // 1. The NULL-grade rows from older imports are the same "Total" rows; give
  //    them grade 0 first so the backfill's ON CONFLICT DO NOTHING sees them.
  for (const table of ['pssa_results', 'keystone_results']) {
    const r = sqliteDb.prepare(`UPDATE ${table} SET grade = 0 WHERE grade IS NULL AND level IN ('school', 'district')`).run();
    logger.info(`${table}: ${r.changes} NULL-grade rows relabelled as grade 0`);
  }

  // 2. Insert the Total rows from every PSSA school/district file.
  const sources = path.join(process.cwd(), '..', 'sources');
  const importer = new DataImporterFixed();
  // Optional args restrict which source folders to scan, e.g. `pssa/state`.
  const dirs = process.argv.slice(2).filter((a) => a.startsWith('pssa/'));
  for (const dir of dirs.length ? dirs : ['pssa/school', 'pssa/district', 'pssa/state']) {
    const full = path.join(sources, dir);
    const files = fs.readdirSync(full).filter(f => f.endsWith('.xlsx')).sort();
    for (const f of files) {
      const res = await importer.importFile(path.join(full, f), { totalsOnly: true });
      logger.info(`${f}: +${res.recordsProcessed} total rows (${res.skipped} skipped)${res.errors.length ? ' ERRORS ' + res.errors.join('; ') : ''}`);
    }
  }

  const rows = sqliteDb.prepare(`SELECT year, level, COUNT(*) n FROM pssa_results WHERE grade = 0 AND demographic_group = 'All Students' GROUP BY year, level ORDER BY year, level`).all();
  logger.info('grade-0 rows (All Students): ' + JSON.stringify(rows));
}

main().catch(err => { logger.error('backfill failed', err); process.exit(1); });
