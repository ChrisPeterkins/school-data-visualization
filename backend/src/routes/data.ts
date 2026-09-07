import { FastifyPluginAsync } from 'fastify';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { sqliteDb } from '../db';
import { cache } from '../cache';

/**
 * Bulk downloads for researchers: one CSV per table (optionally per year),
 * generated on first request after each import and kept gzipped on disk, plus
 * an everything-about-this-entity CSV for a school or district.
 */
const TABLES: Record<string, { years: boolean; sql: string; note: string }> = {
  schools: { years: false, sql: `SELECT s.id, s.school_number, d.aun AS district_aun, d.name AS district, c.name AS county, s.name, s.pde_name, s.school_type, s.grade_range, s.is_charter, s.address, s.city, s.zip_code, s.latitude, s.longitude, s.enrollment, s.is_active FROM schools s JOIN districts d ON d.id = s.district_id JOIN counties c ON c.id = d.county_id ORDER BY s.id`, note: 'Every school entity with its district, county, type, location, and latest enrollment.' },
  districts: { years: false, sql: `SELECT d.id, d.aun, d.nces_id, c.name AS county, d.name, d.pde_name, d.district_type, d.city, d.zip_code, d.total_schools, d.total_enrollment, d.is_active FROM districts d JOIN counties c ON c.id = d.county_id ORDER BY d.id`, note: 'Every district and charter LEA.' },
  counties: { years: false, sql: `SELECT * FROM counties ORDER BY id`, note: 'The 67 counties.' },
  pssa_results: { years: true, sql: `SELECT id, year, level, school_id, district_id, county_id, subject, grade, demographic_group, total_tested, advanced_percent, proficient_percent, basic_percent, below_basic_percent, proficient_or_above_percent, growth_score FROM pssa_results WHERE year = ? ORDER BY level, district_id, school_id, subject, grade`, note: 'PSSA results by entity, subject, grade (0 = all grades), and student group.' },
  keystone_results: { years: true, sql: `SELECT id, year, level, school_id, district_id, county_id, subject, grade, demographic_group, total_tested, advanced_percent, proficient_percent, basic_percent, below_basic_percent, proficient_or_above_percent, growth_score FROM keystone_results WHERE year = ? ORDER BY level, district_id, school_id, subject`, note: 'Keystone results by entity, subject, and student group.' },
  pvaas_results: { years: true, sql: `SELECT * FROM pvaas_results WHERE year = ? ORDER BY district_id, school_id, subject`, note: 'PVAAS growth indexes by entity, subject, and student group.' },
  entity_indicators: { years: true, sql: `SELECT * FROM entity_indicators WHERE year = ? ORDER BY entity_type, entity_id, indicator`, note: 'Future Ready indicators, graduation rate, low-income share, and staffing measures per entity.' },
  indicator_groups: { years: true, sql: `SELECT * FROM indicator_groups WHERE year = ? ORDER BY entity_type, entity_id, indicator, student_group`, note: 'Attendance and graduation by student group.' },
  enrollments: { years: true, sql: `SELECT * FROM enrollments WHERE year = ? ORDER BY entity_type, entity_id`, note: 'October 1 enrollment per entity.' },
  district_finance: { years: true, sql: `SELECT * FROM district_finance WHERE year = ? ORDER BY district_id`, note: 'AFR spending and ADM per district.' },
  district_staff: { years: true, sql: `SELECT * FROM district_staff WHERE year = ? ORDER BY district_id`, note: 'Professional staff counts, salary, experience per district.' },
  school_demographics: { years: true, sql: `SELECT * FROM school_demographics WHERE year = ? ORDER BY school_id`, note: 'NCES CCD enrollment by race and ethnicity (percent) per school.' },
};

const csvCell = (v: unknown) => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function toCsv(rows: Record<string, unknown>[], columns?: string[]): string {
  if (!rows.length) return columns ? columns.join(',') + '\n' : '';
  const cols = columns ?? Object.keys(rows[0]);
  return [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n';
}

const dataRoutes: FastifyPluginAsync = async (fastify) => {
  const dumpDir = path.join(path.dirname(process.env.DATABASE_PATH || './school-data.db'), 'data', 'dumps');
  const stamp = () => String((sqliteDb.prepare(`SELECT COALESCE(MAX(completed_at), 0) AS t FROM data_imports WHERE status = 'completed'`).get() as { t: number }).t);
  const yearsFor = (table: string) => (sqliteDb.prepare(`SELECT DISTINCT year FROM ${table} ORDER BY year DESC`).all() as Array<{ year: number }>).map((r) => r.year);

  fastify.get('/', async () => {
    const key = cache.generateKey('data-index', stamp());
    const cached = await cache.get(key);
    if (cached) return cached;
    const items = Object.entries(TABLES).map(([table, t]) => {
      const years = t.years ? yearsFor(table) : [];
      const rows = (sqliteDb.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
      return { table, note: t.note, rows, years, url: `/api/data/${table}.csv${t.years ? '?year=YYYY' : ''}` };
    });
    const response = { generatedAfterImport: Number(stamp()) || null, tables: items, entityExports: ['/api/data/schools/{id}.csv', '/api/data/districts/{id}.csv'] };
    await cache.set(key, response, 24 * 3600);
    return response;
  });

  fastify.get('/:table.csv', async (request, reply) => {
    const { table } = request.params as { table: string };
    const t = TABLES[table];
    if (!t) return reply.status(404).send({ error: 'Unknown table' });
    const year = t.years ? Number((request.query as any).year) : 0;
    if (t.years && !Number.isInteger(year)) return reply.status(400).send({ error: 'year is required for this table' });
    fs.mkdirSync(dumpDir, { recursive: true });
    const file = path.join(dumpDir, `${table}${t.years ? `-${year}` : ''}.${stamp()}.csv.gz`);
    if (!fs.existsSync(file)) {
      // Drop stale versions of this dump (older import stamps) before writing the new one.
      for (const f of fs.readdirSync(dumpDir)) if (f.startsWith(`${table}${t.years ? `-${year}` : ''}.`) && f.endsWith('.csv.gz')) fs.rmSync(path.join(dumpDir, f), { force: true });
      const rows = (t.years ? sqliteDb.prepare(t.sql).all(year) : sqliteDb.prepare(t.sql).all()) as Record<string, unknown>[];
      fs.writeFileSync(file, zlib.gzipSync(Buffer.from(toCsv(rows), 'utf8'), { level: 6 }));
    }
    const name = `paschools-${table}${t.years ? `-${year}` : ''}.csv`;
    reply.header('Content-Type', 'text/csv; charset=utf-8').header('Content-Disposition', `attachment; filename="${name}"`).header('Cache-Control', 'public, max-age=86400');
    const accepts = String(request.headers['accept-encoding'] ?? '').includes('gzip');
    if (accepts) return reply.header('Content-Encoding', 'gzip').send(fs.createReadStream(file));
    return reply.send(fs.createReadStream(file).pipe(zlib.createGunzip()));
  });

  /** Everything published about one school or district, long format: one row per measure/year/group. */
  fastify.get('/:kind(schools|districts)/:id.csv', async (request, reply) => {
    const { kind, id: rawId } = request.params as { kind: 'schools' | 'districts'; id: string };
    const id = Number(rawId);
    if (!Number.isInteger(id)) return reply.status(400).send({ error: 'Bad id' });
    const isSchool = kind === 'schools';
    const ent = sqliteDb.prepare(isSchool ? `SELECT name FROM schools WHERE id = ?` : `SELECT name FROM districts WHERE id = ?`).get(id) as { name: string } | undefined;
    if (!ent) return reply.status(404).send({ error: 'Not found' });
    const idCol = isSchool ? 'school_id' : 'district_id', level = isSchool ? 'school' : 'district';
    const out: Record<string, unknown>[] = [];
    for (const [exam, table] of [['PSSA', 'pssa_results'], ['Keystone', 'keystone_results']] as const) {
      for (const r of sqliteDb.prepare(`SELECT year, subject, grade, demographic_group, total_tested, advanced_percent, proficient_percent, basic_percent, below_basic_percent, proficient_or_above_percent, growth_score FROM ${table} WHERE level = ? AND ${idCol} = ? ORDER BY year, subject, grade, demographic_group`).all(level, id) as any[]) {
        out.push({ source: exam, year: r.year, measure: 'proficient_or_above_percent', subject: r.subject, grade: r.grade, student_group: r.demographic_group, value: r.proficient_or_above_percent, n: r.total_tested, advanced: r.advanced_percent, proficient: r.proficient_percent, basic: r.basic_percent, below_basic: r.below_basic_percent, growth: r.growth_score });
      }
    }
    for (const r of sqliteDb.prepare(`SELECT year, indicator, value, n, state_value FROM entity_indicators WHERE entity_type = ? AND entity_id = ? ORDER BY year, indicator`).all(level, id) as any[]) out.push({ source: 'indicator', year: r.year, measure: r.indicator, subject: '', grade: '', student_group: 'All Students', value: r.value, n: r.n, state_value: r.state_value });
    for (const r of sqliteDb.prepare(`SELECT year, indicator, student_group, value, n FROM indicator_groups WHERE entity_type = ? AND entity_id = ? ORDER BY year, indicator, student_group`).all(level, id) as any[]) out.push({ source: 'indicator', year: r.year, measure: r.indicator, subject: '', grade: '', student_group: r.student_group, value: r.value, n: r.n });
    for (const r of sqliteDb.prepare(`SELECT year, total FROM enrollments WHERE entity_type = ? AND entity_id = ? ORDER BY year`).all(level, id) as any[]) out.push({ source: 'enrollment', year: r.year, measure: 'enrollment', subject: '', grade: '', student_group: 'All Students', value: r.total });
    if (isSchool) for (const r of sqliteDb.prepare(`SELECT * FROM school_demographics WHERE school_id = ? ORDER BY year`).all(id) as any[]) for (const k of ['white', 'black', 'hispanic', 'asian', 'aian', 'nhpi', 'multi', 'unknown']) out.push({ source: 'ccd', year: r.year, measure: `pct_${k}`, subject: '', grade: '', student_group: 'All Students', value: r[k], n: r.total });
    else {
      for (const r of sqliteDb.prepare(`SELECT * FROM district_finance WHERE district_id = ? ORDER BY year`).all(id) as any[]) for (const k of Object.keys(r)) if (!['year', 'district_id', 'source_file'].includes(k) && r[k] != null) out.push({ source: 'afr', year: r.year, measure: k, subject: '', grade: '', student_group: '', value: r[k] });
      for (const r of sqliteDb.prepare(`SELECT * FROM district_staff WHERE district_id = ? ORDER BY year`).all(id) as any[]) for (const k of Object.keys(r)) if (!['year', 'district_id', 'source_file'].includes(k) && r[k] != null) out.push({ source: 'staff', year: r.year, measure: k, subject: '', grade: '', student_group: '', value: r[k] });
    }
    const cols = ['source', 'year', 'measure', 'subject', 'grade', 'student_group', 'value', 'n', 'state_value', 'advanced', 'proficient', 'basic', 'below_basic', 'growth'];
    const safe = ent.name.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
    return reply.header('Content-Type', 'text/csv; charset=utf-8').header('Content-Disposition', `attachment; filename="${safe}-${id}.csv"`).header('Cache-Control', 'public, max-age=3600').send(toCsv(out, cols));
  });
};

export default dataRoutes;
