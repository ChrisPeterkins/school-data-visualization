/**
 * After an import: compare the newest year with the one before it and post a
 * short report to NOTIFY_URL (and stdout). Catches a PDE file that imported
 * cleanly but is missing a level, a subject, or half its schools.
 *
 * Usage: npx tsx src/scripts/importReport.ts [year]
 */
import { sqliteDb } from '../db';
import { logger } from '../utils/logger';
import { notify } from '../utils/notify';

interface Row { level: string; entities: number; rows: number; suppressed: number }

function summary(table: string, year: number) {
  return sqliteDb.prepare(`
    SELECT level, COUNT(DISTINCT COALESCE(school_id, district_id, county_id, 0)) AS entities, COUNT(*) AS rows,
      SUM(CASE WHEN proficient_or_above_percent IS NULL THEN 1 ELSE 0 END) AS suppressed
    FROM ${table} WHERE year = ? GROUP BY level ORDER BY level
  `).all(year) as Row[];
}
function stateFigures(table: string, year: number) {
  return sqliteDb.prepare(`
    SELECT subject, ROUND(SUM(proficient_or_above_percent * total_tested) / SUM(total_tested), 1) AS p, SUM(total_tested) AS tested
    FROM ${table} WHERE level = 'state' AND year = ? AND demographic_group = 'All Students' AND (grade = 0 OR grade IS NULL) AND total_tested > 0 GROUP BY subject ORDER BY subject
  `).all(year) as Array<{ subject: string; p: number; tested: number }>;
}
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);

export function buildImportReport(year?: number): { text: string; warnings: string[] } {
  const latest = year ?? (sqliteDb.prepare(`SELECT MAX(year) AS y FROM pssa_results`).get() as { y: number }).y;
  const prev = (sqliteDb.prepare(`SELECT MAX(year) AS y FROM pssa_results WHERE year < ?`).get(latest) as { y: number | null }).y;
  const lines: string[] = [`Import report: ${latest}${prev ? ` vs ${prev}` : ''}`];
  const warnings: string[] = [];
  for (const table of ['pssa_results', 'keystone_results']) {
    const cur = summary(table, latest), old = prev ? summary(table, prev) : [];
    lines.push(`${table}:`);
    for (const level of ['state', 'district', 'school']) {
      const c = cur.find((r) => r.level === level), o = old.find((r) => r.level === level);
      if (!c) { lines.push(`  ${level}: MISSING`); if (o) warnings.push(`${table} has no ${level} rows for ${latest}`); continue; }
      const delta = o ? ` (${o.entities} in ${prev})` : '';
      lines.push(`  ${level}: ${c.entities} entities, ${c.rows} rows, ${pct(c.suppressed, c.rows)}% suppressed${delta}`);
      if (o && c.entities < o.entities * 0.9) warnings.push(`${table} ${level}: entity count fell ${o.entities} → ${c.entities}`);
      if (o && pct(c.suppressed, c.rows) > pct(o.suppressed, o.rows) + 10) warnings.push(`${table} ${level}: suppression rose to ${pct(c.suppressed, c.rows)}%`);
    }
    const sf = stateFigures(table, latest), so = prev ? stateFigures(table, prev) : [];
    for (const s of sf) {
      const o = so.find((x) => x.subject === s.subject);
      lines.push(`  state ${s.subject}: ${s.p}%${o ? ` (${o.p}% in ${prev}, ${s.p - o.p >= 0 ? '+' : ''}${Math.round((s.p - o.p) * 10) / 10})` : ''}, ${s.tested.toLocaleString()} tested`);
      if (o && Math.abs(s.p - o.p) > 8) warnings.push(`${table} state ${s.subject} moved ${o.p}% → ${s.p}%`);
    }
    for (const o of so) if (!sf.find((s) => s.subject === o.subject)) { lines.push(`  state ${o.subject}: not published for ${latest}`); warnings.push(`${table}: ${o.subject} missing for ${latest}`); }
  }
  const growth = sqliteDb.prepare(`SELECT COUNT(*) AS n FROM pvaas_results WHERE year = ?`).get(latest) as { n: number };
  lines.push(`pvaas rows: ${growth.n}`);
  // Entity-level anomalies: a school or district whose all-grades Math or ELA proficiency moved
  // 25+ points with 40+ tested in both years usually means a mis-keyed file, not a real change.
  if (prev) {
    const jumps = sqliteDb.prepare(`
      SELECT c.level, c.subject, COALESCE(s.name, d.name) AS name, p.proficient_or_above_percent AS old, c.proficient_or_above_percent AS new, c.total_tested AS tested
      FROM pssa_results c JOIN pssa_results p ON p.level = c.level AND p.year = ? AND p.subject = c.subject AND p.grade = 0 AND p.demographic_group = 'All Students'
        AND COALESCE(p.school_id, 0) = COALESCE(c.school_id, 0) AND COALESCE(p.district_id, 0) = COALESCE(c.district_id, 0)
      LEFT JOIN schools s ON s.id = c.school_id LEFT JOIN districts d ON d.id = c.district_id AND c.level = 'district'
      WHERE c.year = ? AND c.grade = 0 AND c.demographic_group = 'All Students' AND c.level IN ('school', 'district') AND c.subject IN ('Mathematics', 'English Language Arts')
        AND c.total_tested >= 40 AND p.total_tested >= 40 AND ABS(c.proficient_or_above_percent - p.proficient_or_above_percent) >= 25
      ORDER BY ABS(c.proficient_or_above_percent - p.proficient_or_above_percent) DESC LIMIT 15
    `).all(prev, latest) as Array<{ level: string; subject: string; name: string; old: number; new: number; tested: number }>;
    lines.push(`entities moving 25+ points (${prev} → ${latest}, 40+ tested): ${jumps.length}`);
    for (const j of jumps) lines.push(`  ${j.level} ${j.name} ${j.subject}: ${j.old}% → ${j.new}% (${j.tested} tested)`);
    if (jumps.length > 10) warnings.push(`${jumps.length}+ entities moved 25 or more points in one year; check the file mapping`);
  }
  // Year labels ahead of the current school year point at a parsing slip in a file name or header.
  const nowY = new Date().getFullYear() + (new Date().getMonth() >= 6 ? 1 : 0);
  for (const [table, col] of [['pssa_results', 'year'], ['keystone_results', 'year'], ['entity_indicators', 'year'], ['enrollments', 'year'], ['district_finance', 'year'], ['school_demographics', 'year']]) {
    try {
      const bad = sqliteDb.prepare(`SELECT ${col} AS y, COUNT(*) AS n FROM ${table} WHERE ${col} > ? GROUP BY ${col}`).all(nowY) as Array<{ y: number; n: number }>;
      for (const b of bad) warnings.push(`${table} has ${b.n} rows labelled ${b.y}, beyond the current school year ${nowY}`);
    } catch { /* table may not exist on a fresh database */ }
  }
  // Enrollment collapses or explosions in the latest enrollment year.
  const enrollYears = sqliteDb.prepare(`SELECT DISTINCT year FROM enrollments ORDER BY year DESC LIMIT 2`).all() as Array<{ year: number }>;
  if (enrollYears.length === 2) {
    const swings = sqliteDb.prepare(`
      SELECT s.name, a.total AS old, b.total AS new FROM enrollments a JOIN enrollments b ON b.entity_type = a.entity_type AND b.entity_id = a.entity_id AND b.year = ?
      JOIN schools s ON s.id = a.entity_id WHERE a.entity_type = 'school' AND a.year = ? AND a.total >= 100 AND (b.total < a.total * 0.5 OR b.total > a.total * 2) ORDER BY ABS(b.total - a.total) DESC LIMIT 10
    `).all(enrollYears[0].year, enrollYears[1].year) as Array<{ name: string; old: number; new: number }>;
    lines.push(`schools whose enrollment halved or doubled (${enrollYears[1].year} → ${enrollYears[0].year}): ${swings.length}`);
    for (const w of swings) lines.push(`  ${w.name}: ${w.old} → ${w.new}`);
  }
  if (warnings.length) lines.push('', 'WARNINGS:', ...warnings.map((w) => `  - ${w}`)); else lines.push('', 'No anomalies detected.');
  return { text: lines.join('\n'), warnings };
}

if (typeof require !== 'undefined' && require.main === module) {
  const { text, warnings } = buildImportReport(process.argv[2] ? Number(process.argv[2]) : undefined);
  console.log(text);
  notify(`PA School Data import ${warnings.length ? `— ${warnings.length} warning(s)` : 'looks clean'}`, text).then(() => logger.info('report sent')).catch((e) => logger.warn({ err: e }, 'notify failed'));
}
