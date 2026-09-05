/**
 * Import one assessment year (PSSA + Keystone at school/district/state level,
 * then PVAAS growth) from the files already downloaded under ../sources.
 *
 *   npx tsx src/scripts/importYear.ts 2025
 *
 * Safe to re-run: each importer clears rows from the same source file before
 * inserting. Run from the backend/ directory so the relative DATABASE_URL
 * in .env resolves.
 */
import path from 'path';
import fs from 'fs';
import { DataImporterFixed } from '../services/dataImporterFixed';
import { PVAASImporter } from '../services/pvaasImporter';
import { logger } from '../utils/logger';
import { buildDataStatus, printDataStatus } from '../services/dataStatus';
import { refreshMapPoints } from '../services/mapPoints';

const year = process.argv[2];
const pvaasOnly = process.argv.includes('--pvaas-only');
if (!/^20\d{2}$/.test(year ?? '')) {
  console.error('Usage: tsx src/scripts/importYear.ts <year> [--pvaas-only]');
  process.exit(1);
}

const sources = path.join(process.cwd(), '..', 'sources');
const assessmentDirs = [
  'pssa/school', 'pssa/district', 'pssa/state',
  'keystone/school', 'keystone/district', 'keystone/state',
];

function filesForYear(dir: string): string[] {
  const full = path.join(sources, dir);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full)
    .filter(f => f.endsWith('.xlsx') && f.includes(year) && f !== 'test.xlsx')
    .sort()
    .map(f => path.join(full, f));
}

async function main() {
  const started = Date.now();
  const importer = new DataImporterFixed();
  const summary: string[] = [];

  for (const dir of pvaasOnly ? [] : assessmentDirs) {
    const files = filesForYear(dir);
    if (files.length === 0) {
      summary.push(`${dir}: no ${year} file found`);
      continue;
    }
    for (const file of files) {
      const res = await importer.importFile(file);
      summary.push(`${dir}: ${path.basename(file)} -> ${res.recordsProcessed} inserted, ${res.skipped} skipped${res.errors.length ? ', ERRORS: ' + res.errors.join('; ') : ''}`);
    }
  }

  const pvaas = new PVAASImporter();
  for (const level of ['school', 'district'] as const) {
    for (const file of filesForYear(`pvaas/${level}`)) {
      const res = await pvaas.importPVAASFile(file, level);
      summary.push(`pvaas/${level}: ${path.basename(file)} -> ${res.inserted} inserted, ${res.updated} growth scores propagated, ${res.skipped} skipped`);
    }
  }

  const mins = ((Date.now() - started) / 60000).toFixed(1);
  logger.info(`\n===== ${year} import summary (${mins} min) =====`);
  for (const line of summary) logger.info(line);

  refreshMapPoints(parseInt(year, 10));

  // Coverage report so a bad year is obvious before anyone looks at a chart.
  printDataStatus(buildDataStatus());
}

main().catch(err => {
  logger.error('Import failed:', err);
  process.exit(1);
});
