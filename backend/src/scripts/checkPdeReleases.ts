/**
 * Watch PDE's Assessment Reporting page for new PSSA/Keystone files, download
 * anything for a year not yet in sources/, and (with --import) run the import
 * for that year. Also watches the graduation, enrollment / low-income, AFR,
 * staff, and Future Ready pages (SOURCES below) and imports those. Results land in backend/data/release-check.json, which the
 * admin Import page shows.
 *
 *   npx tsx src/scripts/checkPdeReleases.ts [--import] [--dry-run]
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { logger } from '../utils/logger';

const PAGE = 'https://www.pa.gov/agencies/education/data-and-reporting/assessment-reporting';

/**
 * Non-assessment sources, each watched the same way: list the page's Excel
 * links, keep the ones the pattern recognises, download the years we lack
 * under our file naming, and run importIndicators.ts for that source.
 */
interface Source { key: string; page: string; dir: string; match: (href: string, text: string) => string | null }
const SOURCES: Source[] = [
  { key: 'graduation', page: 'https://www.pa.gov/agencies/education/data-and-reporting/high-school-graduation', dir: 'graduation',
    match: (href) => { const m = decodeURIComponent(href).match(/(\d{4})-(\d{4}) pennsylvania 4-year cohort grad(?:uation)? rates\.xlsx$/i); return m ? `grad4-${m[1]}-${m[2]}.xlsx` : null; } },
  { key: 'enrollment', page: 'https://www.pa.gov/agencies/education/data-and-reporting/enrollment', dir: 'enrollment',
    match: (href) => { const d = decodeURIComponent(href); let m = d.match(/enrollment public schools (\d{4})-(\d{2,4})\.xlsx$/i); if (m) return `enrollment-${m[1]}-${m[2]}.xlsx`; m = d.match(/(\d{2})(\d{2}) public schools percent low income\.xlsx$/i); return m ? `../lowincome/lowincome-${m[1]}${m[2]}.xlsx` : null; } },
  { key: 'finance', page: 'https://www.pa.gov/agencies/education/programs-and-services/schools/grants-and-funding/school-finances/financial-data/financial-data-elements', dir: 'finance',
    match: (href) => { const m = decodeURIComponent(href).match(/finances adm-wadm (\d{4}-\d{2})\.xlsx$/i); return m ? `adm-wadm-${m[1]}.xlsx` : null; } },
  { key: 'finance-afr', page: 'https://www.pa.gov/agencies/education/programs-and-services/schools/grants-and-funding/school-finances/financial-data/summary-of-annual-financial-report-data/afr-data-detailed', dir: 'finance',
    match: (href) => { const m = decodeURIComponent(href).match(/finances afr expdetail (\d{4})-(\d{4})\.xlsx$/i); return m ? `afr-expdetail-${m[1]}-${m[2]}.xlsx` : null; } },
  { key: 'staff', page: 'https://www.pa.gov/agencies/education/data-and-reporting/school-staff/professional-and-support-personnel', dir: 'staff',
    match: (href) => { const m = decodeURIComponent(href).match(/(\d{4}-\d{2}) professional staff summary report(?:_revised)?\.xlsx$/i); return m ? `staff-${m[1]}.xlsx` : null; } },
  { key: 'futureready', page: 'https://futurereadypa.org/Home/DataFiles', dir: 'futureready',
    match: (href, text) => { const m = text.match(/Performance Data for SY (\d{4})-(\d{4})/i); return m && /getdatafile/i.test(href) ? `fr-${m[2]}.xlsx` : null; } },
];

async function checkOtherSources(): Promise<Array<{ key: string; file: string }>> {
  const got: Array<{ key: string; file: string }> = [];
  const importKeys = new Set<string>();
  for (const src of SOURCES) {
    let html: string;
    try {
      const res = await fetch(src.page, { headers: { 'User-Agent': UA } });
      if (!res.ok) { logger.warn(`${src.key}: page returned HTTP ${res.status}`); continue; }
      html = await res.text();
    } catch (err) { logger.warn(`${src.key}: ${(err as Error).message}`); continue; }
    const anchors = [...html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => ({ href: m[1], text: m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() }));
    for (const a of anchors) {
      const target = src.match(a.href, a.text);
      if (!target) continue;
      // Only years the site covers (2015 onward); the pages also list older archives.
      const y4 = target.match(/(20\d{2})/), y2 = target.match(/lowincome-(\d{2})/);
      const targetYear = y4 ? Number(y4[1]) : y2 ? 2000 + Number(y2[1]) : 0;
      if (targetYear && targetYear < 2015) continue;
      const dest = path.join(sources, src.dir, target);
      if (fs.existsSync(dest)) continue;
      const url = a.href.startsWith('http') ? a.href : new URL(a.href, src.page).toString();
      if (dryRun) { logger.info(`${src.key}: would download ${url} -> ${dest}`); continue; }
      try {
        const r = await fetch(url, { headers: { 'User-Agent': UA } });
        if (!r.ok) { logger.warn(`${src.key}: download failed ${url}: HTTP ${r.status}`); continue; }
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length < 10000 || buf[0] !== 0x50 || buf[1] !== 0x4b) { logger.warn(`${src.key}: ${url} is not an xlsx`); continue; }
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, buf);
        got.push({ key: src.key, file: path.relative(sources, dest) });
        importKeys.add(target.startsWith('../lowincome') ? 'lowincome' : src.key === 'finance-afr' ? 'finance' : src.key);
        logger.info(`${src.key}: downloaded ${dest}`);
      } catch (err) { logger.warn(`${src.key}: ${(err as Error).message}`); }
    }
  }
  if (doImport && !dryRun) {
    for (const key of importKeys) {
      logger.info(`importing ${key}...`);
      execFileSync('npx', ['tsx', 'src/scripts/importIndicators.ts', key], { stdio: 'inherit' });
    }
  }
  return got;
}
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

  const otherFiles = await checkOtherSources();

  const imported: number[] = [];
  if (doImport && !dryRun) {
    for (const year of newYears) {
      logger.info(`importing ${year}...`);
      execFileSync('npx', ['tsx', 'src/scripts/importYear.ts', String(year)], { stdio: 'inherit' });
      imported.push(year);
    }
  }

  // Optional push: NOTIFY_URL can be an ntfy.sh topic (https://ntfy.sh/<topic>)
  // or any webhook that accepts a plain-text POST body.
  if ((newYears.length || otherFiles.length) && process.env.NOTIFY_URL) {
    const body = (newYears.length ? `PA School Data: PDE published ${newYears.join(', ')} (${downloaded.length} files)` + (imported.length ? ` — imported ${imported.join(', ')}` : ' — not imported yet') + `. ${PAGE}` : 'PA School Data:') +
      (otherFiles.length ? ` New non-assessment files: ${otherFiles.map((f) => f.file).join(', ')}${doImport ? ' (imported)' : ''}.` : '');
    try {
      await fetch(process.env.NOTIFY_URL, { method: 'POST', body, headers: { 'Title': 'New PDE assessment release', 'Tags': 'school', 'User-Agent': UA } });
      logger.info('notification sent');
    } catch (err) {
      logger.warn(`notification failed: ${(err as Error).message}`);
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
    otherFiles,
    note: newYears.length && !doImport ? 'New files were downloaded but not imported; run importYear.ts for each year.' : null,
  };
  fs.writeFileSync(statusFile, JSON.stringify(status, null, 2));
  logger.info(`status written to ${statusFile}`);
}

main().catch(async (err) => {
  console.error('release check failed:', err);
  if (process.env.NOTIFY_URL) {
    try { await fetch(process.env.NOTIFY_URL, { method: 'POST', body: `PA School Data: release check failed: ${err?.message ?? err}`, headers: { 'Title': 'PDE release check failed', 'Priority': 'high', 'User-Agent': UA } }); } catch { /* ignore */ }
  }
  process.exit(1);
});
