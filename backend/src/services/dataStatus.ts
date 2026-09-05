/**
 * Coverage report over the loaded assessment data. Used by the import script
 * (printed at the end of a run) and by GET /api/performance/data-status so a
 * bad or partial year is visible without opening a chart.
 */
import { sqliteDb } from '../db';
import { logger } from '../utils/logger';

export interface YearStatus {
  year: number;
  pssa: LevelCounts;
  keystone: LevelCounts;
  flags: string[];
}

export interface LevelCounts {
  school: number;
  district: number;
  state: number;
  /** Share of school-level rows carrying a PVAAS growth score, 0-100. */
  growthCoverage: number | null;
  /** Share of school-level rows with suppressed (null) proficiency, 0-100. */
  suppressedShare: number | null;
  subjects: string[];
}

export interface DataStatus {
  generatedAt: string;
  years: YearStatus[];
  duplicates: { pssa: number; keystone: number };
  nonCanonicalGroups: string[];
  flags: string[];
}

const CANONICAL_GROUPS = new Set([
  'All Students', 'Male', 'Female', 'Economically Disadvantaged', 'IEP', 'ELL',
  'White (not Hispanic)', 'Black or African American (not Hispanic)', 'Hispanic (any race)',
  'Asian (not Hispanic)', 'Multi-ethnic (not Hispanic)',
  'American Indian/Alaskan Native (not Hispanic)',
  'Native Hawaiian or other Pacific Islander (not Hispanic)',
  'Historically Underperforming', 'Not Economically Disadvantaged',
  'Non-IEP', 'Non-ELL', 'Migrant', 'Foster Care', 'Homeless', 'Military Connected',
]);

function levelCounts(table: string, year: number): LevelCounts {
  const row = sqliteDb.prepare(`
    SELECT
      SUM(level = 'school') AS school,
      SUM(level = 'district') AS district,
      SUM(level = 'state') AS state,
      SUM(level = 'school' AND growth_score IS NOT NULL) AS school_with_growth,
      SUM(level = 'school' AND proficient_or_above_percent IS NULL) AS school_suppressed
    FROM ${table}
    WHERE year = ? AND demographic_group = 'All Students'
  `).get(year) as any;
  const subjects = (sqliteDb.prepare(`SELECT DISTINCT subject FROM ${table} WHERE year = ? ORDER BY subject`).all(year) as any[]).map(r => r.subject);
  const school = row?.school ?? 0;
  return {
    school,
    district: row?.district ?? 0,
    state: row?.state ?? 0,
    growthCoverage: school ? Math.round((row.school_with_growth / school) * 1000) / 10 : null,
    suppressedShare: school ? Math.round((row.school_suppressed / school) * 1000) / 10 : null,
    subjects,
  };
}

function duplicateCount(table: string): number {
  const r = sqliteDb.prepare(`
    SELECT COUNT(*) AS n FROM (
      SELECT 1 FROM ${table}
      GROUP BY level, COALESCE(school_id, 0), COALESCE(district_id, 0), year, subject, COALESCE(grade, -1), demographic_group
      HAVING COUNT(*) > 1
    )
  `).get() as any;
  return r?.n ?? 0;
}

export function buildDataStatus(): DataStatus {
  const years = (sqliteDb.prepare(`
    SELECT DISTINCT year FROM pssa_results UNION SELECT DISTINCT year FROM keystone_results ORDER BY year
  `).all() as any[]).map(r => r.year as number);

  const statuses: YearStatus[] = [];
  let prev: YearStatus | null = null;
  for (const year of years) {
    const pssa = levelCounts('pssa_results', year);
    const keystone = levelCounts('keystone_results', year);
    const flags: string[] = [];

    // PDE's public PSSA files start in 2015; earlier years are Keystone-only archive copies.
    const keystoneOnlyYear = year < 2015;
    for (const [name, c] of [['PSSA', pssa], ['Keystone', keystone]] as const) {
      if (name === 'PSSA' && keystoneOnlyYear) continue;
      if (!c.school) flags.push(`${name}: no school-level rows`);
      if (!c.district && !(keystoneOnlyYear)) flags.push(`${name}: no district-level rows`);
      if (!c.state) flags.push(`${name}: no state-level rows`);
    }
    if (keystoneOnlyYear) flags.push('Keystone only (archived PDE files; PSSA and district files were not preserved)');
    if (pssa.school && !pssa.subjects.includes('Science')) flags.push('PSSA: no Science results published');
    if (year >= 2018) {
      if (pssa.school && (pssa.growthCoverage ?? 0) < 50) flags.push(`PSSA: growth coverage only ${pssa.growthCoverage}%`);
      if (keystone.school && (keystone.growthCoverage ?? 0) < 50) flags.push(`Keystone: growth coverage only ${keystone.growthCoverage}%`);
    }
    if (prev && prev.pssa.school && pssa.school) {
      const change = (pssa.school - prev.pssa.school) / prev.pssa.school;
      if (Math.abs(change) > 0.25) flags.push(`PSSA: school rows changed ${Math.round(change * 100)}% vs ${prev.year}`);
    }
    if ((pssa.suppressedShare ?? 0) > 15) flags.push(`PSSA: ${pssa.suppressedShare}% of school rows suppressed`);

    const status = { year, pssa, keystone, flags };
    statuses.push(status);
    prev = status;
  }

  const nonCanonicalGroups = (sqliteDb.prepare(`
    SELECT DISTINCT demographic_group AS g FROM pssa_results
    UNION SELECT DISTINCT demographic_group FROM keystone_results
  `).all() as any[]).map(r => r.g as string).filter(g => !CANONICAL_GROUPS.has(g)).sort();

  const duplicates = { pssa: duplicateCount('pssa_results'), keystone: duplicateCount('keystone_results') };

  const flags: string[] = [];
  if (duplicates.pssa) flags.push(`${duplicates.pssa} duplicate PSSA result keys`);
  if (duplicates.keystone) flags.push(`${duplicates.keystone} duplicate Keystone result keys`);
  if (nonCanonicalGroups.length) flags.push(`Unrecognized demographic labels: ${nonCanonicalGroups.join(', ')}`);

  return { generatedAt: new Date().toISOString(), years: statuses, duplicates, nonCanonicalGroups, flags };
}

export function printDataStatus(status: DataStatus): void {
  logger.info('\n===== Data coverage =====');
  logger.info('year  pssa school/district/state  growth%  keystone school/district/state  growth%  flags');
  for (const y of status.years) {
    const p = y.pssa, k = y.keystone;
    logger.info(
      `${y.year}  ${String(p.school).padStart(6)} / ${String(p.district).padStart(5)} / ${String(p.state).padStart(3)}   ${String(p.growthCoverage ?? '-').padStart(5)}   ` +
      `${String(k.school).padStart(6)} / ${String(k.district).padStart(5)} / ${String(k.state).padStart(3)}   ${String(k.growthCoverage ?? '-').padStart(5)}   ${y.flags.join('; ')}`
    );
  }
  for (const f of status.flags) logger.warn(`FLAG: ${f}`);
  if (!status.flags.length && !status.years.some(y => y.flags.length)) logger.info('No coverage flags.');
}
