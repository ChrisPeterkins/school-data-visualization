import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { sqliteDb } from '../db';
import { cache } from '../cache';
import { INDICATORS } from '../services/indicators';

interface IndicatorRow { indicator: string; year: number; value: number | null; stateValue: number | null; n: number | null }
interface Series { indicator: string; label: string; series: Array<{ year: number; value: number | null; stateValue: number | null; n: number | null }> }

const LABELS: Record<string, string> = { ...INDICATORS, grad_rate_4yr_econ: '4-year graduation rate, economically disadvantaged' };

function groupSeries(rows: IndicatorRow[]): Series[] {
  const by = new Map<string, Series>();
  for (const r of rows) {
    if (!by.has(r.indicator)) by.set(r.indicator, { indicator: r.indicator, label: LABELS[r.indicator] ?? r.indicator, series: [] });
    by.get(r.indicator)!.series.push({ year: r.year, value: r.value, stateValue: r.stateValue, n: r.n });
  }
  const order = Object.keys(LABELS);
  return [...by.values()].sort((a, b) => order.indexOf(a.indicator) - order.indexOf(b.indicator));
}

const entityRows = (type: string, id: number) => sqliteDb.prepare(`
  SELECT indicator, year, value, state_value AS stateValue, n FROM entity_indicators
  WHERE entity_type = ? AND entity_id = ? ORDER BY indicator, year
`).all(type, id) as IndicatorRow[];
const enrollmentRows = (type: string, id: number) => sqliteDb.prepare(`
  SELECT year, total FROM enrollments WHERE entity_type = ? AND entity_id = ? ORDER BY year
`).all(type, id) as Array<{ year: number; total: number }>;

/**
 * Non-assessment measures: Future Ready PA Index indicators, cohort
 * graduation rates, October 1 enrollment, and AFR spending.
 */
const indicatorRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/school/:id', async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    if (!Number.isFinite(id)) return reply.status(400).send({ error: 'Bad id' });
    const key = cache.generateKey('indicators-school', String(id));
    const cached = await cache.get(key);
    if (cached) return cached;
    const response = { indicators: groupSeries(entityRows('school', id)), enrollment: enrollmentRows('school', id) };
    await cache.set(key, response, 3600);
    return response;
  });

  fastify.get('/district/:id', async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    if (!Number.isFinite(id)) return reply.status(400).send({ error: 'Bad id' });
    const key = cache.generateKey('indicators-district', String(id));
    const cached = await cache.get(key);
    if (cached) return cached;
    // Enrollment-weighted school indicators for the district, per year, next to the state figure.
    const schoolRows = sqliteDb.prepare(`
      SELECT i.indicator, i.year,
        ROUND(SUM(i.value * COALESCE(e.total, 1)) / SUM(COALESCE(e.total, 1)), 1) AS value,
        MAX(i.state_value) AS stateValue, COUNT(*) AS n
      FROM entity_indicators i
      JOIN schools s ON s.id = i.entity_id AND s.district_id = ?
      LEFT JOIN enrollments e ON e.entity_type = 'school' AND e.entity_id = i.entity_id AND e.year = i.year
      WHERE i.entity_type = 'school' AND i.value IS NOT NULL AND i.indicator NOT IN ('grad_rate_4yr', 'grad_rate_4yr_econ')
      GROUP BY i.indicator, i.year ORDER BY i.indicator, i.year
    `).all(id) as IndicatorRow[];
    const finance = sqliteDb.prepare(`
      SELECT year, total_expenditures AS total, instruction, support_services AS supportServices, adm, per_pupil AS perPupil, instruction_per_pupil AS instructionPerPupil
      FROM district_finance WHERE district_id = ? ORDER BY year
    `).all(id) as Array<{ year: number; total: number | null; instruction: number | null; supportServices: number | null; adm: number | null; perPupil: number | null; instructionPerPupil: number | null }>;
    const stateFinance = sqliteDb.prepare(`
      SELECT year, ROUND(SUM(total_expenditures) / SUM(adm)) AS perPupil, ROUND(SUM(instruction) / SUM(adm)) AS instructionPerPupil
      FROM district_finance WHERE adm > 0 AND total_expenditures IS NOT NULL GROUP BY year ORDER BY year
    `).all() as Array<{ year: number; perPupil: number; instructionPerPupil: number }>;
    const response = {
      indicators: groupSeries([...entityRows('district', id), ...schoolRows]),
      enrollment: enrollmentRows('district', id),
      finance: finance.map((f) => ({ ...f, statePerPupil: stateFinance.find((s) => s.year === f.year)?.perPupil ?? null, stateInstructionPerPupil: stateFinance.find((s) => s.year === f.year)?.instructionPerPupil ?? null })),
    };
    await cache.set(key, response, 3600);
    return response;
  });

  fastify.get('/state', async () => {
    const key = cache.generateKey('indicators-state');
    const cached = await cache.get(key);
    if (cached) return cached;
    const response = {
      indicators: groupSeries(entityRows('state', 0)),
      enrollment: enrollmentRows('state', 0),
      finance: sqliteDb.prepare(`
        SELECT year, ROUND(SUM(total_expenditures) / SUM(adm)) AS perPupil, ROUND(SUM(instruction) / SUM(adm)) AS instructionPerPupil, COUNT(*) AS districts
        FROM district_finance WHERE adm > 0 AND total_expenditures IS NOT NULL GROUP BY year ORDER BY year
      `).all(),
    };
    await cache.set(key, response, 3600);
    return response;
  });

  /** Districts' spending per pupil next to their all-grades Math + ELA proficiency, for a scatter. */
  fastify.get('/spending', async (request, reply) => {
    const q = z.object({ year: z.coerce.number().int().optional(), exam: z.enum(['pssa', 'keystone']).default('pssa') }).safeParse(request.query);
    if (!q.success) return reply.status(400).send({ error: 'Bad query', details: q.error.issues });
    const table = q.data.exam === 'pssa' ? 'pssa_results' : 'keystone_results';
    const years = (sqliteDb.prepare(`SELECT DISTINCT f.year FROM district_finance f WHERE f.per_pupil IS NOT NULL AND EXISTS (SELECT 1 FROM ${table} r WHERE r.level = 'district' AND r.year = f.year) ORDER BY f.year DESC`).all() as Array<{ year: number }>).map((r) => r.year);
    const year = q.data.year ?? years[0];
    if (!year) return { year: null, years, districts: [], state: null };
    const key = cache.generateKey('spending', String(year), q.data.exam);
    const cached = await cache.get(key);
    if (cached) return cached;
    const subjects = q.data.exam === 'pssa' ? ['Mathematics', 'English Language Arts'] : ['Algebra I', 'Literature'];
    const gradeClause = q.data.exam === 'pssa' ? 'AND r.grade = 0' : '';
    const districts = sqliteDb.prepare(`
      SELECT d.id, d.name, d.district_type AS type, c.name AS county, f.per_pupil AS perPupil, f.instruction_per_pupil AS instructionPerPupil, ROUND(f.adm) AS adm,
        ROUND(SUM(r.proficient_or_above_percent * r.total_tested) / SUM(r.total_tested), 1) AS proficiency, SUM(r.total_tested) AS tested
      FROM district_finance f
      JOIN districts d ON d.id = f.district_id
      JOIN counties c ON c.id = d.county_id
      JOIN ${table} r ON r.level = 'district' AND r.district_id = d.id AND r.year = f.year AND r.demographic_group = 'All Students' AND r.subject IN (?, ?) ${gradeClause}
      WHERE f.year = ? AND f.per_pupil IS NOT NULL AND r.total_tested > 0
      GROUP BY d.id HAVING tested >= 40
      ORDER BY d.name
    `).all(subjects[0], subjects[1], year) as Array<{ perPupil: number; proficiency: number; tested: number }>;
    const perPupils = districts.map((d) => d.perPupil).sort((a, b) => a - b);
    const median = perPupils.length ? perPupils[Math.floor(perPupils.length / 2)] : null;
    const state = sqliteDb.prepare(`
      SELECT ROUND(SUM(proficient_or_above_percent * total_tested) / SUM(total_tested), 1) AS proficiency
      FROM ${table} r WHERE r.level = 'state' AND r.year = ? AND r.demographic_group = 'All Students' AND r.subject IN (?, ?) ${gradeClause}
    `).get(year, subjects[0], subjects[1]) as { proficiency: number | null };
    const response = { year, years, exam: q.data.exam, subjects, districts, state: { proficiency: state?.proficiency ?? null, medianPerPupil: median } };
    await cache.set(key, response, 3600);
    return response;
  });
};

export default indicatorRoutes;
