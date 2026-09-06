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
  if (warnings.length) lines.push('', 'WARNINGS:', ...warnings.map((w) => `  - ${w}`)); else lines.push('', 'No anomalies detected.');
  return { text: lines.join('\n'), warnings };
}

if (typeof require !== 'undefined' && require.main === module) {
  const { text, warnings } = buildImportReport(process.argv[2] ? Number(process.argv[2]) : undefined);
  console.log(text);
  notify(`PA School Data import ${warnings.length ? `— ${warnings.length} warning(s)` : 'looks clean'}`, text).then(() => logger.info('report sent')).catch((e) => logger.warn({ err: e }, 'notify failed'));
}
