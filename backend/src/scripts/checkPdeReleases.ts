/**
 * Watch PDE's Assessment Reporting page for new PSSA/Keystone files, download
 * anything for a year not yet in sources/, and (with --import) run the import
 * for that year. Results land in backend/data/release-check.json, which the
 * admin Import page shows.
 *
 *   npx tsx src/scripts/checkPdeReleases.ts [--import] [--dry-run]
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { logger } from '../utils/logger';

const PAGE = 'https://www.pa.gov/agencies/education/data-and-reporting/assessment-reporting';
const UA = 'paschools-release-check/1.0 (+https://chrispeterkins.com/paschools)';
const sources = path.join(process.cwd(), '..', 'sources');
const statusFile = path.join(process.cwd(), 'data', 'release-check.json');
const doImport = process.argv.includes('--import');
const dryRun = process.argv.includes('--dry-run');

interface Found { url: string; year: number; exam: 'pssa' | 'keystone'; level: 'school' | 'district' | 'state'; fileName: string }

function classify(url: string): Found | null {
  const fileName = decodeURIComponent(url.split('/').pop() || '');
  const lower = fileName.toLowerCase();
  if (!lower.endsWith('.xlsx')) return null;
  const year = parseInt((lower.match(/20\d{2}/) || ['0'])[0], 10);
  if (!year) return null;
  const exam = lower.includes('keystone') ? 'keystone' : lower.includes('pssa') ? 'pssa' : null;
  if (!exam) return null;
  const level = lower.includes('school') ? 'school' : lower.includes('district') ? 'district' : lower.includes('state') ? 'state' : null;
  if (!level) return null;
  return { url, year, exam, level, fileName };
}

function haveYear(exam: string, level: string, year: number): boolean {
  const dir = path.join(sources, exam, level);
  if (!fs.existsSync(dir)) return false;
  return fs.readdirSync(dir).some((f) => f.endsWith('.xlsx') && f.includes(String(year)));
}

async function main() {
  const res = await fetch(PAGE, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`PDE page returned HTTP ${res.status}`);
  const html = await res.text();
  const links = [...html.matchAll(/href="([^"]+\.xlsx)"/gi)].map((m) => m[1]);
  const found = links
    .map((href) => (href.startsWith('http') ? href : `https://www.pa.gov${href}`))
    .map(classify)
    .filter((f): f is Found => !!f);

  const missing = found.filter((f) => !haveYear(f.exam, f.level, f.year));
  const newYears = [...new Set(missing.map((f) => f.year))].sort();
  logger.info(`PDE page lists ${found.length} assessment files; ${missing.length} not yet downloaded (years: ${newYears.join(', ') || 'none'})`);

  const downloaded: string[] = [];
  if (!dryRun) {
    for (const f of missing) {
      const dest = path.join(sources, f.exam, f.level, f.fileName);
      const r = await fetch(f.url, { headers: { 'User-Agent': UA } });
      if (!r.ok) { logger.warn(`download failed ${f.url}: HTTP ${r.status}`); continue; }
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
      downloaded.push(`${f.exam}/${f.level}/${f.fileName}`);
      logger.info(`downloaded ${dest}`);
    }
  }

  const imported: number[] = [];
  if (doImport && !dryRun) {
    for (const year of newYears) {
      logger.info(`importing ${year}...`);
      execFileSync('npx', ['tsx', 'src/scripts/importYear.ts', String(year)], { stdio: 'inherit' });
      imported.push(year);
    }
  }

  fs.mkdirSync(path.dirname(statusFile), { recursive: true });
  const status = {
    checkedAt: new Date().toISOString(),
    page: PAGE,
    filesOnPage: found.length,
    latestYearOnPage: Math.max(0, ...found.map((f) => f.year)),
    newYears,
    downloaded,
    imported,
    note: newYears.length && !doImport ? 'New files were downloaded but not imported; run importYear.ts for each year.' : null,
  };
  fs.writeFileSync(statusFile, JSON.stringify(status, null, 2));
  logger.info(`status written to ${statusFile}`);
}

main().catch((err) => { console.error('release check failed:', err); process.exit(1); });
