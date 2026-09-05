/**
 * One-shot cleanup: collapse demographic group label variants to the canonical
 * spelling for a given year (or all years). The live importer now normalizes on
 * insert, so this only matters for rows loaded before that fix.
 *
 *   npx tsx src/scripts/normalizeDemographics.ts 2025
 */
import { sqliteDb } from '../db';
import { DEMOGRAPHIC_LABEL_ALIASES } from '../services/fileConfigs';

const year = process.argv[2] ? parseInt(process.argv[2]) : null;

for (const table of ['pssa_results', 'keystone_results']) {
  const update = sqliteDb.prepare(
    `UPDATE ${table} SET demographic_group = ? WHERE demographic_group = ?${year ? ' AND year = ?' : ''}`
  );
  let changed = 0;
  const txn = sqliteDb.transaction(() => {
    for (const [alias, canonical] of Object.entries(DEMOGRAPHIC_LABEL_ALIASES)) {
      if (alias === canonical) continue;
      const args: (string | number)[] = [canonical, alias];
      if (year) args.push(year);
      changed += update.run(...args).changes;
    }
  });
  txn();
  console.log(`${table}: ${changed} rows relabelled${year ? ` (year ${year})` : ''}`);
}
