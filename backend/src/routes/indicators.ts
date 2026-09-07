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

/** Percentile of the entity's latest value among all entities of its type that year (higher = more of the measure). */
function percentiles(type: string, series: Series[]) {
  for (const s of series) {
    const last = [...s.series].reverse().find((p) => p.value != null);
    if (!last) continue;
    const peers = sqliteDb.prepare(`SELECT value FROM entity_indicators WHERE entity_type = ? AND indicator = ? AND year = ? AND value IS NOT NULL`).all(type, s.indicator, last.year) as Array<{ value: number }>;
    if (peers.length < 20) continue;
    const below = peers.filter((p) => p.value < last.value!).length, equal = peers.filter((p) => p.value === last.value).length;
    (s as any).percentile = { value: Math.round(((below + equal / 2) / peers.length) * 100), n: peers.length, year: last.year };
  }
  return series;
}
/** Latest-year values by student group for the indicators that have them (attendance, graduation). */
const groupRows = (type: string, id: number) => {
  const rows = sqliteDb.prepare(`
    SELECT g.indicator, g.year, g.student_group AS studentGroup, g.value FROM indicator_groups g
    WHERE g.entity_type = ? AND g.entity_id = ? AND g.year = (SELECT MAX(year) FROM indicator_groups WHERE entity_type = g.entity_type AND entity_id = g.entity_id AND indicator = g.indicator)
    ORDER BY g.indicator, g.student_group
  `).all(type, id) as Array<{ indicator: string; year: number; studentGroup: string; value: number }>;
  const out: Array<{ indicator: string; label: string; year: number; allStudents: number | null; groups: Array<{ group: string; value: number; gap: number | null }> }> = [];
  for (const r of rows) {
    let g = out.find((o) => o.indicator === r.indicator);
    if (!g) {
      const all = sqliteDb.prepare(`SELECT value FROM entity_indicators WHERE entity_type = ? AND entity_id = ? AND indicator = ? AND year = ?`).get(type, id, r.indicator, r.year) as { value: number } | undefined;
      g = { indicator: r.indicator, label: LABELS[r.indicator] ?? r.indicator, year: r.year, allStudents: all?.value ?? null, groups: [] };
      out.push(g);
    }
    g.groups.push({ group: r.studentGroup, value: r.value, gap: g.allStudents == null ? null : Math.round((r.value - g.allStudents) * 10) / 10 });
  }
  return out;
};
const staffRows = (id: number) => sqliteDb.prepare(`
  SELECT year, professional, teachers, administrators, avg_teacher_salary AS avgTeacherSalary, avg_teacher_experience AS avgTeacherExperience,
    avg_years_in_lea AS avgYearsInLea, students_per_teacher AS studentsPerTeacher FROM district_staff WHERE district_id = ? ORDER BY year
`).all(id) as Array<{ year: number; teachers: number | null; studentsPerTeacher: number | null; avgTeacherSalary: number | null; avgTeacherExperience: number | null }>;
const stateStaff = () => sqliteDb.prepare(`
  SELECT year, ROUND(SUM(teachers * avg_teacher_salary) / SUM(teachers)) AS avgTeacherSalary, ROUND(SUM(teachers * avg_teacher_experience) / SUM(teachers), 1) AS avgTeacherExperience,
    ROUND((SELECT total FROM enrollments e WHERE e.entity_type = 'state' AND e.year = district_staff.year) * 1.0 / SUM(teachers), 1) AS studentsPerTeacher, SUM(teachers) AS teachers
  FROM district_staff WHERE teachers > 0 AND avg_teacher_salary IS NOT NULL GROUP BY year ORDER BY year
`).all() as Array<{ year: number; avgTeacherSalary: number; avgTeacherExperience: number; studentsPerTeacher: number | null; teachers: number }>;

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

/** Safe Schools incidents per 100 students by year, with the statewide rate for the same year. */
function safetyRows(entity: 'school' | 'district' | 'state', id: number) {
  const state = new Map((sqliteDb.prepare(`SELECT year, enrollment, incidents, arrests, truancy_rate AS truancyRate FROM school_safety WHERE entity_type = 'state'`).all() as any[]).map((r) => [r.year, r]));
  const rows = sqliteDb.prepare(`SELECT year, enrollment, incidents, offenders, arrests, law_enforcement AS lawEnforcement, assaults, harassment, fighting, weapons, drugs_alcohol AS drugsAlcohol, tobacco_vaping AS tobaccoVaping, threats, property, truant, truancy_rate AS truancyRate, security_staff AS securityStaff FROM school_safety WHERE entity_type = ? AND entity_id = ? ORDER BY year`).all(entity, id) as any[];
  const per100 = (n: number | null, enrollment: number | null) => (n == null || !enrollment ? null : Math.round((n / enrollment) * 1000) / 10);
  return rows.map((r) => {
    const st = state.get(r.year);
    return { ...r, incidentsPer100: per100(r.incidents, r.enrollment), arrestsPer100: per100(r.arrests, r.enrollment), stateIncidentsPer100: st ? per100(st.incidents, st.enrollment) : null, stateArrestsPer100: st ? per100(st.arrests, st.enrollment) : null, stateTruancyRate: st?.truancyRate ?? null };
  });
}

/** Emergency teaching permits per district by year, per 100 teachers where the staff file gives a count, with the statewide rate. */
function permitRows(districtId: number) {
  const teachers = new Map((sqliteDb.prepare(`SELECT year, teachers FROM district_staff WHERE district_id = ?`).all(districtId) as any[]).map((r) => [r.year, r.teachers]));
  const stateTeachers = new Map((sqliteDb.prepare(`SELECT year, SUM(teachers) AS t FROM district_staff GROUP BY year`).all() as any[]).map((r) => [r.year, r.t]));
  const state = new Map((sqliteDb.prepare(`SELECT year, total FROM district_permits WHERE district_id = 0`).all() as any[]).map((r) => [r.year, r.total]));
  const rows = sqliteDb.prepare(`SELECT year, total, day_to_day AS dayToDay, long_term AS longTerm, waiver, other FROM district_permits WHERE district_id = ? ORDER BY year`).all(districtId) as any[];
  const rate = (n: number | null | undefined, t: number | null | undefined) => (n == null || !t ? null : Math.round((n / t) * 1000) / 10);
  return rows.map((r) => ({ ...r, teachers: teachers.get(r.year) ?? null, per100Teachers: rate(r.total, teachers.get(r.year)), statePer100Teachers: rate(state.get(r.year), stateTeachers.get(r.year)), stateTotal: state.get(r.year) ?? null }));
}

const indicatorRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/school/:id', async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    if (!Number.isFinite(id)) return reply.status(400).send({ error: 'Bad id' });
    const key = cache.generateKey('indicators-school', String(id));
    const cached = await cache.get(key);
    if (cached) return cached;
    const demographicsHistory = sqliteDb.prepare(`SELECT year, total, white, black, hispanic, asian, aian, nhpi, multi, unknown FROM school_demographics WHERE school_id = ? ORDER BY year`).all(id) as any[];
    const demographics = demographicsHistory.length ? { ...demographicsHistory[demographicsHistory.length - 1], history: demographicsHistory } : null;
    const response = { indicators: percentiles('school', groupSeries(entityRows('school', id))), enrollment: enrollmentRows('school', id), groups: groupRows('school', id), demographics, safety: safetyRows('school', id) };
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
    const st = stateStaff();
    // District composition: enrollment-weighted across its schools' latest CCD year.
    const demographics = sqliteDb.prepare(`
      SELECT MAX(year) AS year, SUM(total) AS total,
        ROUND(SUM(white * total) / SUM(total), 1) AS white, ROUND(SUM(black * total) / SUM(total), 1) AS black, ROUND(SUM(hispanic * total) / SUM(total), 1) AS hispanic,
        ROUND(SUM(asian * total) / SUM(total), 1) AS asian, ROUND(SUM(aian * total) / SUM(total), 1) AS aian, ROUND(SUM(nhpi * total) / SUM(total), 1) AS nhpi, ROUND(SUM(multi * total) / SUM(total), 1) AS multi, ROUND(SUM(unknown * total) / SUM(total), 1) AS unknown
      FROM school_demographics d JOIN schools s ON s.id = d.school_id WHERE s.district_id = ? AND d.year = (SELECT MAX(year) FROM school_demographics)
    `).get(id) as { total: number | null } | undefined;
    const demographicsHistory = sqliteDb.prepare(`
      SELECT d.year, SUM(total) AS total, ROUND(SUM(white * total) / SUM(total), 1) AS white, ROUND(SUM(black * total) / SUM(total), 1) AS black, ROUND(SUM(hispanic * total) / SUM(total), 1) AS hispanic,
        ROUND(SUM(asian * total) / SUM(total), 1) AS asian, ROUND(SUM(aian * total) / SUM(total), 1) AS aian, ROUND(SUM(nhpi * total) / SUM(total), 1) AS nhpi, ROUND(SUM(multi * total) / SUM(total), 1) AS multi, ROUND(SUM(unknown * total) / SUM(total), 1) AS unknown
      FROM school_demographics d JOIN schools s ON s.id = d.school_id WHERE s.district_id = ? GROUP BY d.year ORDER BY d.year
    `).all(id) as any[];
    const response = {
      indicators: percentiles('district', groupSeries([...entityRows('district', id), ...schoolRows])),
      enrollment: enrollmentRows('district', id),
      finance: finance.map((f) => ({ ...f, statePerPupil: stateFinance.find((s) => s.year === f.year)?.perPupil ?? null, stateInstructionPerPupil: stateFinance.find((s) => s.year === f.year)?.instructionPerPupil ?? null })),
      demographics: demographics?.total ? { ...demographics, history: demographicsHistory } : null,
      safety: safetyRows('district', id),
      permits: permitRows(id),
      staff: staffRows(id).map((r) => { const s = st.find((x) => x.year === r.year); return { ...r, stateAvgTeacherSalary: s?.avgTeacherSalary ?? null, stateAvgTeacherExperience: s?.avgTeacherExperience ?? null, stateStudentsPerTeacher: s?.studentsPerTeacher ?? null }; }),
      groups: groupRows('district', id),
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
      staff: stateStaff(),
      groups: [],
      safety: safetyRows('state', 0),
      permits: permitRows(0),
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
