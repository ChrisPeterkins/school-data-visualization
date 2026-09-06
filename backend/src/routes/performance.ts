import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db, sqliteDb } from '../db';
import { buildDataStatus } from '../services/dataStatus';
import { pssaResults, keystoneResults, schools, districts } from '../db/newSchema';
import { cache } from '../cache';
import { eq, and, gte, lte, sql, desc, asc } from 'drizzle-orm';

const performanceQuerySchema = z.object({
  schoolId: z.coerce.number().optional(),
  districtId: z.coerce.number().optional(),
  countyId: z.coerce.number().optional(),
  year: z.coerce.number().optional(),
  yearFrom: z.coerce.number().optional(),
  yearTo: z.coerce.number().optional(),
  subject: z.string().optional(),
  grade: z.coerce.number().optional(),
  level: z.enum(['school', 'district', 'state']).optional(),
  demographicGroup: z.string().optional().default('All Students'),
});

const performanceRoutes: FastifyPluginAsync = async (fastify) => {
  // List the assessment years present in the database. The frontend uses
  // this to build year pickers so a new import shows up without a redeploy.
  fastify.get('/years', async (_request, _reply) => {
    const cacheKey = cache.generateKey('available-years');
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const rows = db.all<{ year: number }>(sql`
      SELECT DISTINCT year FROM ${pssaResults}
      UNION
      SELECT DISTINCT year FROM ${keystoneResults}
      ORDER BY year DESC
    `);
    const years = rows.map(r => r.year).filter(y => Number.isFinite(y));
    const yearsFor = (table: any) =>
      (db.all<{ year: number }>(sql`SELECT DISTINCT year FROM ${table} ORDER BY year DESC`)).map(r => r.year);
    const pssaYears = yearsFor(pssaResults);
    const keystoneYears = yearsFor(keystoneResults);

    // Headline counts for the home page; public, unlike the import status route.
    const countOf = (table: any) =>
      db.select({ count: sql<number>`count(*)` }).from(table).get()?.count ?? 0;

    // When the data last changed: the newest completed import.
    const lastImport = (db.all<{ t: number | null }>(sql`SELECT MAX(completed_at) AS t FROM data_imports WHERE status = 'completed'`))[0]?.t ?? null;
    const lastImportAt = lastImport ? new Date(lastImport * (lastImport < 1e12 ? 1000 : 1)).toISOString() : null;
    const response = {
      years,
      latest: years[0] ?? null,
      earliest: years[years.length - 1] ?? null,
      lastImportAt,
      // Per-exam lists: the archived 2013/2014 files are Keystone-only.
      pssaYears,
      keystoneYears,
      counts: {
        schools: countOf(schools),
        districts: countOf(districts),
        pssaRecords: countOf(pssaResults),
        keystoneRecords: countOf(keystoneResults),
      },
    };

    await cache.set(cacheKey, response, 3600);
    return response;
  });

  // Coverage report (row counts, growth coverage, flags) for the admin page.
  fastify.get('/data-status', async () => {
    const cacheKey = cache.generateKey('data-status');
    const cached = await cache.get(cacheKey);
    if (cached) return cached;
    const status = buildDataStatus();
    await cache.set(cacheKey, status, 600);
    return status;
  });

  /**
   * Student-weighted yearly summary. Proficiency and level shares are weighted
   * by students tested, so a large school counts more than a small one and the
   * result is the share of students, not the mean of rows. With no `grade`,
   * PSSA uses the all-grades total rows (grade 0); Keystone ignores grade.
   */
  const summaryQuerySchema = z.object({
    exam: z.enum(['pssa', 'keystone']).default('pssa'),
    level: z.enum(['school', 'district', 'state']).default('state'),
    subject: z.string().optional(),
    grade: z.coerce.number().optional(),
    schoolId: z.coerce.number().optional(),
    districtId: z.coerce.number().optional(),
    countyId: z.coerce.number().optional(),
    yearFrom: z.coerce.number().optional(),
    yearTo: z.coerce.number().optional(),
    demographicGroup: z.string().optional().default('All Students'),
  });

  fastify.get('/summary', async (request, _reply) => {
    const q = summaryQuerySchema.parse(request.query);
    const cacheKey = cache.generateKey('summary', JSON.stringify(q));
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const table = q.exam === 'pssa' ? 'pssa_results' : 'keystone_results';
    // Rows without a students-tested count (some older state files) still carry
    // a rate; they get weight 1 so a year is never dropped for a missing count.
    const where: string[] = ['level = ?', 'demographic_group = ?', 'proficient_or_above_percent IS NOT NULL'];
    const args: (string | number)[] = [q.level, q.demographicGroup];
    if (q.subject) { where.push('subject = ?'); args.push(q.subject); }
    if (q.exam === 'pssa') { where.push('grade = ?'); args.push(q.grade ?? 0); }
    if (q.schoolId) { where.push('school_id = ?'); args.push(q.schoolId); }
    if (q.districtId) { where.push('district_id = ?'); args.push(q.districtId); }
    if (q.countyId) { where.push('county_id = ?'); args.push(q.countyId); }
    if (q.yearFrom) { where.push('year >= ?'); args.push(q.yearFrom); }
    if (q.yearTo) { where.push('year <= ?'); args.push(q.yearTo); }

    const w = 'CASE WHEN total_tested > 0 THEN total_tested ELSE 1 END';
    const weighted = (col: string) =>
      `ROUND(SUM(CASE WHEN ${col} IS NOT NULL THEN ${col} * ${w} END) * 1.0 / NULLIF(SUM(CASE WHEN ${col} IS NOT NULL THEN ${w} END), 0), 1)`;

    const series = sqliteDb.prepare(`
      SELECT year,
        SUM(CASE WHEN total_tested > 0 THEN total_tested ELSE 0 END) AS tested,
        COUNT(*) AS rows,
        COUNT(DISTINCT COALESCE(school_id, district_id, 0)) AS entities,
        ${weighted('proficient_or_above_percent')} AS proficiency,
        ${weighted('advanced_percent')} AS advanced,
        ${weighted('proficient_percent')} AS proficient,
        ${weighted('basic_percent')} AS basic,
        ${weighted('below_basic_percent')} AS belowBasic,
        ROUND(AVG(growth_score), 2) AS growth,
        SUM(growth_score IS NOT NULL) AS growthRows
      FROM ${table}
      WHERE ${where.join(' AND ')}
      GROUP BY year
      ORDER BY year
    `).all(...args);

    const response = { filters: q, series };
    await cache.set(cacheKey, response, 3600);
    return response;
  });

  /**
   * Achievement gaps: proficiency for every reported student group at one
   * entity and year, plus each group's trend. PSSA uses the all-grades total
   * rows; growth comes from the PVAAS student-group reports where a group
   * name maps onto PDE's demographic labels.
   */
  const gapsQuerySchema = z.object({
    exam: z.enum(['pssa', 'keystone']).default('pssa'),
    level: z.enum(['school', 'district', 'state']).default('state'),
    subject: z.string().default('Mathematics'),
    year: z.coerce.number().optional(),
    schoolId: z.coerce.number().optional(),
    districtId: z.coerce.number().optional(),
    countyId: z.coerce.number().optional(),
  });

  const PVAAS_GROUP_TO_PDE: Record<string, string> = {
    'All Students': 'All Students',
    'Economically Disadvantaged': 'Economically Disadvantaged',
    'Economically disadvantaged': 'Economically Disadvantaged',
    'Students with IEPs': 'IEP',
    'English Learner': 'ELL',
    'English learners': 'ELL',
    'Black': 'Black or African American (not Hispanic)',
    'Black/African American (not Hispanic)': 'Black or African American (not Hispanic)',
    'White': 'White (not Hispanic)',
    'White (not Hispanic)': 'White (not Hispanic)',
    'Hispanic': 'Hispanic (any race)',
    'Hispanic (any race)': 'Hispanic (any race)',
    'Asian': 'Asian (not Hispanic)',
    'Asian (not Hispanic)': 'Asian (not Hispanic)',
    'American Indian/Alaskan Native': 'American Indian/Alaskan Native (not Hispanic)',
    'Hawaiian/Pacific Islander': 'Native Hawaiian or other Pacific Islander (not Hispanic)',
    'Multi-Racial (not Hispanic)': 'Multi-ethnic (not Hispanic)',
    'Two or More Races': 'Multi-ethnic (not Hispanic)',
  };

  fastify.get('/gaps', async (request, _reply) => {
    const q = gapsQuerySchema.parse(request.query);
    const cacheKey = cache.generateKey('gaps', JSON.stringify(q));
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const table = q.exam === 'pssa' ? 'pssa_results' : 'keystone_results';
    const where: string[] = ['level = ?', 'subject = ?', 'proficient_or_above_percent IS NOT NULL'];
    const args: (string | number)[] = [q.level, q.subject];
    if (q.schoolId) { where.push('school_id = ?'); args.push(q.schoolId); }
    if (q.districtId) { where.push('district_id = ?'); args.push(q.districtId); }
    if (q.countyId) { where.push('county_id = ?'); args.push(q.countyId); }

    const w = 'CASE WHEN total_tested > 0 THEN total_tested ELSE 1 END';
    const aggregate = (gradeClause: string) => sqliteDb.prepare(`
      SELECT year, demographic_group AS "group",
        ROUND(SUM(proficient_or_above_percent * ${w}) * 1.0 / SUM(${w}), 1) AS proficiency,
        SUM(CASE WHEN total_tested > 0 THEN total_tested ELSE 0 END) AS tested
      FROM ${table}
      WHERE ${where.join(' AND ')} ${gradeClause}
      GROUP BY year, demographic_group
      ORDER BY year, demographic_group
    `).all(...args) as Array<{ year: number; group: string; proficiency: number; tested: number }>;

    // PSSA: prefer the all-grades total row per group; older state files only
    // carry subgroup rows by grade, so fall back to weighting those.
    let trend: Array<{ year: number; group: string; proficiency: number; tested: number }>;
    if (q.exam === 'pssa') {
      const totals = aggregate('AND grade = 0');
      const graded = aggregate('AND grade BETWEEN 1 AND 12');
      const have = new Set(totals.map((t) => `${t.year}|${t.group}`));
      trend = [...totals, ...graded.filter((g) => !have.has(`${g.year}|${g.group}`))]
        .sort((a, b) => a.year - b.year || a.group.localeCompare(b.group));
    } else {
      trend = aggregate('');
    }

    const years = [...new Set(trend.map((t) => t.year))].sort((a, b) => a - b);
    const year = q.year && years.includes(q.year) ? q.year : years[years.length - 1];

    // Growth per group for the chosen year, from the PVAAS group reports.
    const growthByGroup: Record<string, number> = {};
    if (year && q.level !== 'state') {
      const gw: string[] = ['level = ?', 'year = ?', 'subject = ?', 'grade IS NULL'];
      const ga: (string | number)[] = [q.level, year, q.subject];
      if (q.schoolId) { gw.push('school_id = ?'); ga.push(q.schoolId); }
      if (q.districtId) { gw.push('district_id = ?'); ga.push(q.districtId); }
      if (q.countyId) { gw.push('district_id IN (SELECT id FROM districts WHERE county_id = ?)'); ga.push(q.countyId); }
      const rows = sqliteDb.prepare(`
        SELECT student_group AS g, ROUND(AVG(growth_index), 2) AS growth
        FROM pvaas_results WHERE ${gw.join(' AND ')} GROUP BY student_group
      `).all(...ga) as Array<{ g: string; growth: number }>;
      for (const r of rows) {
        const pde = PVAAS_GROUP_TO_PDE[r.g];
        if (pde && growthByGroup[pde] == null) growthByGroup[pde] = r.growth;
      }
    }

    const groups = trend
      .filter((t) => t.year === year)
      .map((t) => ({ group: t.group, proficiency: t.proficiency, tested: t.tested, growth: growthByGroup[t.group] ?? null }));
    const allStudents = groups.find((g) => g.group === 'All Students')?.proficiency ?? null;

    const response = {
      filters: q,
      year,
      years,
      allStudents,
      groups: groups.map((g) => ({ ...g, gap: allStudents != null && g.proficiency != null ? Math.round((g.proficiency - allStudents) * 10) / 10 : null })),
      trend,
    };
    await cache.set(cacheKey, response, 3600);
    return response;
  });

  /**
   * One point per school: student-weighted proficiency and mean PVAAS growth
   * index, for the growth-versus-achievement view.
   */
  const growthQuerySchema = z.object({
    year: z.coerce.number(),
    examType: z.enum(['pssa', 'keystone']).default('pssa'),
    subject: z.string().optional(),
    grade: z.coerce.number().optional(),
    countyId: z.coerce.number().optional(),
    schoolType: z.string().optional(),
    minTested: z.coerce.number().min(1).default(40),
  });

  fastify.get('/growth-achievement', async (request, _reply) => {
    const q = growthQuerySchema.parse(request.query);
    const cacheKey = cache.generateKey('growth-achievement', JSON.stringify(q));
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const table = q.examType === 'pssa' ? 'pssa_results' : 'keystone_results';
    const where: string[] = [
      'r.level = ?', 'r.year = ?', "r.demographic_group = 'All Students'",
      'r.proficient_or_above_percent IS NOT NULL', 'r.total_tested > 0', 'r.growth_score IS NOT NULL',
    ];
    const args: (string | number)[] = ['school', q.year];
    if (q.subject) { where.push('r.subject = ?'); args.push(q.subject); }
    if (q.examType === 'pssa') { where.push('r.grade = ?'); args.push(q.grade ?? 0); }
    if (q.countyId) { where.push('d.county_id = ?'); args.push(q.countyId); }
    if (q.schoolType) { where.push('s.school_type = ?'); args.push(q.schoolType); }

    const points = sqliteDb.prepare(`
      SELECT s.id AS schoolId, s.name AS schoolName, s.school_type AS schoolType, d.name AS districtName,
        ROUND(SUM(r.proficient_or_above_percent * r.total_tested) * 1.0 / SUM(r.total_tested), 1) AS proficiency,
        ROUND(AVG(r.growth_score), 2) AS growth,
        SUM(r.total_tested) AS tested
      FROM ${table} r
      JOIN schools s ON s.id = r.school_id
      JOIN districts d ON d.id = s.district_id
      WHERE ${where.join(' AND ')}
      GROUP BY s.id
      HAVING SUM(r.total_tested) >= ?
      ORDER BY tested DESC
      LIMIT 4000
    `).all(...args, q.minTested);

    const response = { filters: q, points };
    await cache.set(cacheKey, response, 3600);
    return response;
  });

  /**
   * Where an entity stands among its peers: percentile of its all-grades
   * proficiency for a subject and year, statewide and (for schools) within
   * its county and among schools of the same type.
   */
  const percentileSchema = z.object({
    entity: z.enum(['school', 'district']).default('school'),
    id: z.coerce.number(),
    year: z.coerce.number(),
    exam: z.enum(['pssa', 'keystone']).default('pssa'),
    subject: z.string().default('Mathematics'),
    minTested: z.coerce.number().default(20),
  });

  fastify.get('/percentile', async (request, reply) => {
    const q = percentileSchema.parse(request.query);
    const cacheKey = cache.generateKey('percentile', JSON.stringify(q));
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const table = q.exam === 'pssa' ? 'pssa_results' : 'keystone_results';
    const idCol = q.entity === 'school' ? 'r.school_id' : 'r.district_id';
    const gradeClause = q.exam === 'pssa' ? 'AND r.grade = 0' : '';
    const rows = sqliteDb.prepare(`
      SELECT ${idCol} AS id, r.proficient_or_above_percent AS value,
        ${q.entity === 'school' ? 's.school_type AS type, d.county_id AS countyId' : 'NULL AS type, d.county_id AS countyId'}
      FROM ${table} r
      ${q.entity === 'school' ? 'JOIN schools s ON s.id = r.school_id JOIN districts d ON d.id = s.district_id' : 'JOIN districts d ON d.id = r.district_id'}
      WHERE r.level = ? AND r.year = ? AND r.subject = ? AND r.demographic_group = 'All Students'
        AND r.proficient_or_above_percent IS NOT NULL AND r.total_tested >= ? ${gradeClause}
    `).all(q.entity, q.year, q.subject, q.minTested) as Array<{ id: number; value: number; type: string | null; countyId: number }>;

    const me = rows.find((r) => r.id === q.id);
    if (!me) return reply.status(404).send({ error: 'No result for that entity, year, and subject' });

    const pct = (peers: typeof rows) => {
      if (peers.length < 5) return null;
      const below = peers.filter((r) => r.value < me.value).length;
      const equal = peers.filter((r) => r.value === me.value).length;
      return { percentile: Math.round(((below + equal / 2) / peers.length) * 100), n: peers.length };
    };
    const response = {
      ...q,
      value: me.value,
      statewide: pct(rows),
      sameType: q.entity === 'school' && me.type ? { type: me.type, ...pct(rows.filter((r) => r.type === me.type)) } : null,
      county: pct(rows.filter((r) => r.countyId === me.countyId)),
      sameTypeInCounty: q.entity === 'school' && me.type ? pct(rows.filter((r) => r.countyId === me.countyId && r.type === me.type)) : null,
    };
    await cache.set(cacheKey, response, 3600);
    return response;
  });

  /**
   * Compare figures for several schools or districts in one year: per
   * subject proficiency for a chosen student group (weighted from the
   * all-grades rows) and growth for All Students.
   */
  const figuresSchema = z.object({
    entity: z.enum(['school', 'district']).default('school'),
    ids: z.string(),
    year: z.coerce.number(),
    exam: z.enum(['pssa', 'keystone']).default('pssa'),
    group: z.string().default('All Students'),
  });

  fastify.get('/figures', async (request, _reply) => {
    const q = figuresSchema.parse(request.query);
    const ids = q.ids.split(',').map(Number).filter((n) => Number.isFinite(n) && n > 0).slice(0, 8);
    if (ids.length === 0) return { ...q, entities: [] };
    const cacheKey = cache.generateKey('figures', JSON.stringify({ ...q, ids }));
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const table = q.exam === 'pssa' ? 'pssa_results' : 'keystone_results';
    const idCol = q.entity === 'school' ? 'r.school_id' : 'r.district_id';
    const gradeClause = q.exam === 'pssa' ? 'AND r.grade = 0' : '';
    const placeholders = ids.map(() => '?').join(',');
    const rows = sqliteDb.prepare(`
      SELECT ${idCol} AS id, r.subject, r.demographic_group AS grp,
        r.proficient_or_above_percent AS proficiency, r.total_tested AS tested, r.growth_score AS growth
      FROM ${table} r
      WHERE r.level = ? AND r.year = ? AND ${idCol} IN (${placeholders})
        AND r.demographic_group IN (?, 'All Students') AND r.proficient_or_above_percent IS NOT NULL ${gradeClause}
    `).all(q.entity, q.year, ...ids, q.group) as any[];

    const names = q.entity === 'school'
      ? sqliteDb.prepare(`SELECT s.id, s.name, d.name AS parent, s.school_type AS type, s.enrollment FROM schools s JOIN districts d ON d.id = s.district_id WHERE s.id IN (${placeholders})`).all(...ids) as any[]
      : sqliteDb.prepare(`SELECT d.id, d.name, c.name || ' County' AS parent, NULL AS type, d.total_enrollment AS enrollment FROM districts d JOIN counties c ON c.id = d.county_id WHERE d.id IN (${placeholders})`).all(...ids) as any[];

    const entities = ids.map((id) => {
      const meta = names.find((n) => n.id === id);
      const mine = rows.filter((r) => r.id === id);
      const subjects: Record<string, { proficiency: number | null; tested: number | null; growth: number | null }> = {};
      for (const r of mine) {
        subjects[r.subject] = subjects[r.subject] ?? { proficiency: null, tested: null, growth: null };
        if (r.grp === q.group) { subjects[r.subject].proficiency = r.proficiency; subjects[r.subject].tested = r.tested; }
        if (r.grp === 'All Students') subjects[r.subject].growth = r.growth;
      }
      return { id, name: meta?.name ?? `#${id}`, parent: meta?.parent ?? '', type: meta?.type ?? null, enrollment: meta?.enrollment ?? null, subjects };
    });

    const response = { ...q, ids, entities };
    await cache.set(cacheKey, response, 3600);
    return response;
  });

  // Get PSSA performance data
  fastify.get('/pssa', async (request, _reply) => {
    const query = performanceQuerySchema.parse(request.query);
    const cacheKey = cache.generateKey('pssa', JSON.stringify(query));
    
    const cached = await cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const conditions = [];
    if (query.schoolId) {
      conditions.push(eq(pssaResults.schoolId, query.schoolId));
    }
    if (query.districtId) {
      conditions.push(eq(pssaResults.districtId, query.districtId));
    }
    if (query.countyId) {
      conditions.push(eq(pssaResults.countyId, query.countyId));
    }
    if (query.year) {
      conditions.push(eq(pssaResults.year, query.year));
    }
    if (query.yearFrom && query.yearTo) {
      conditions.push(
        and(
          gte(pssaResults.year, query.yearFrom),
          lte(pssaResults.year, query.yearTo)
        )!
      );
    }
    if (query.subject) {
      conditions.push(eq(pssaResults.subject, query.subject));
    }
    if (query.grade) {
      conditions.push(eq(pssaResults.grade, query.grade));
    }
    if (query.level) {
      conditions.push(eq(pssaResults.level, query.level));
    }
    if (query.demographicGroup) {
      conditions.push(eq(pssaResults.demographicGroup, query.demographicGroup));
    }

    const results = await db.select()
      .from(pssaResults)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(pssaResults.year), asc(pssaResults.grade));

    await cache.set(cacheKey, results, 600); // Cache for 10 minutes
    return results;
  });

  // Get Keystone performance data
  fastify.get('/keystone', async (request, _reply) => {
    const query = performanceQuerySchema.parse(request.query);
    const cacheKey = cache.generateKey('keystone', JSON.stringify(query));
    
    const cached = await cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const conditions = [];
    if (query.schoolId) {
      conditions.push(eq(keystoneResults.schoolId, query.schoolId));
    }
    if (query.districtId) {
      conditions.push(eq(keystoneResults.districtId, query.districtId));
    }
    if (query.countyId) {
      conditions.push(eq(keystoneResults.countyId, query.countyId));
    }
    if (query.year) {
      conditions.push(eq(keystoneResults.year, query.year));
    }
    if (query.yearFrom && query.yearTo) {
      conditions.push(
        and(
          gte(keystoneResults.year, query.yearFrom),
          lte(keystoneResults.year, query.yearTo)
        )!
      );
    }
    if (query.subject) {
      conditions.push(eq(keystoneResults.subject, query.subject));
    }
    if (query.level) {
      conditions.push(eq(keystoneResults.level, query.level));
    }
    if (query.demographicGroup) {
      conditions.push(eq(keystoneResults.demographicGroup, query.demographicGroup));
    }

    const results = await db.select()
      .from(keystoneResults)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(keystoneResults.year));

    await cache.set(cacheKey, results, 600); // Cache for 10 minutes
    return results;
  });

  // Get performance trends for a school
  fastify.get('/trends/:schoolId', async (request, _reply) => {
    const { schoolId } = request.params as { schoolId: string };
    const schoolIdNum = parseInt(schoolId);
    const cacheKey = cache.generateKey('trends', schoolId);
    
    const cached = await cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const [pssa, keystone] = await Promise.all([
      db.select({
        year: pssaResults.year,
        subject: pssaResults.subject,
        grade: pssaResults.grade,
        proficientOrAbove: sql<number>`AVG(${pssaResults.proficientOrAbovePercent})`.as('proficientOrAbove'),
      })
      .from(pssaResults)
      .where(and(
        eq(pssaResults.schoolId, schoolIdNum),
        eq(pssaResults.demographicGroup, 'All Students'),
        sql`${pssaResults.proficientOrAbovePercent} IS NOT NULL`
      ))
      .groupBy(pssaResults.year, pssaResults.subject, pssaResults.grade)
      .orderBy(desc(pssaResults.year), asc(pssaResults.grade)),
      
      db.select({
        year: keystoneResults.year,
        subject: keystoneResults.subject,
        proficientOrAbove: sql<number>`AVG(${keystoneResults.proficientOrAbovePercent})`.as('proficientOrAbove'),
      })
      .from(keystoneResults)
      .where(and(
        eq(keystoneResults.schoolId, schoolIdNum),
        eq(keystoneResults.demographicGroup, 'All Students'),
        sql`${keystoneResults.proficientOrAbovePercent} IS NOT NULL`
      ))
      .groupBy(keystoneResults.year, keystoneResults.subject)
      .orderBy(desc(keystoneResults.year)),
    ]);

    const response = {
      schoolId: schoolIdNum,
      pssaTrends: pssa,
      keystoneTrends: keystone,
    };

    await cache.set(cacheKey, response, 1800); // Cache for 30 minutes
    return response;
  });

  // Get state-level aggregate performance
  fastify.get('/state', async (request, _reply) => {
    let { year } = request.query as { year?: number };

    // Default to latest year with state-level data
    if (!year) {
      const latestPssa = db.select({ maxYear: sql<number>`MAX(${pssaResults.year})` })
        .from(pssaResults)
        .where(eq(pssaResults.level, 'state'))
        .get();
      const latestKeystone = db.select({ maxYear: sql<number>`MAX(${keystoneResults.year})` })
        .from(keystoneResults)
        .where(eq(keystoneResults.level, 'state'))
        .get();
      year = Math.max(latestPssa?.maxYear ?? 0, latestKeystone?.maxYear ?? 0) || new Date().getFullYear() - 1;
    }

    const cacheKey = cache.generateKey('state-performance', year.toString());

    const cached = await cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Get state-level PSSA results
    const pssaState = await db
      .select({
        year: pssaResults.year,
        grade: pssaResults.grade,
        subject: pssaResults.subject,
        avgProficientOrAbove: sql<number>`AVG(${pssaResults.proficientOrAbovePercent})`,
        totalStudents: sql<number>`SUM(${pssaResults.totalTested})`,
      })
      .from(pssaResults)
      .where(and(
        eq(pssaResults.year, year),
        eq(pssaResults.level, 'state'),
        eq(pssaResults.demographicGroup, 'All Students')
      ))
      .groupBy(pssaResults.year, pssaResults.grade, pssaResults.subject)
      .orderBy(asc(pssaResults.grade), asc(pssaResults.subject));

    // Get state-level Keystone results
    const keystoneState = await db
      .select({
        year: keystoneResults.year,
        subject: keystoneResults.subject,
        avgProficientOrAbove: sql<number>`AVG(${keystoneResults.proficientOrAbovePercent})`,
        totalStudents: sql<number>`SUM(${keystoneResults.totalTested})`,
      })
      .from(keystoneResults)
      .where(and(
        eq(keystoneResults.year, year),
        eq(keystoneResults.level, 'state'),
        eq(keystoneResults.demographicGroup, 'All Students')
      ))
      .groupBy(keystoneResults.year, keystoneResults.subject)
      .orderBy(asc(keystoneResults.subject));

    const response = {
      year,
      pssa: pssaState,
      keystone: keystoneState,
    };

    await cache.set(cacheKey, response, 3600); // Cache for 1 hour
    return response;
  });

  // Compare multiple schools/districts
  fastify.post('/compare', async (request, _reply) => {
    const { entityIds, entityType = 'school', year, testType = 'both' } = request.body as {
      entityIds: number[];
      entityType: 'school' | 'district';
      year?: number;
      testType?: 'pssa' | 'keystone' | 'both';
    };

    const cacheKey = cache.generateKey('compare', JSON.stringify({ entityIds, entityType, year, testType }));
    
    const cached = await cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const yearFilter = year || new Date().getFullYear() - 1;
    const results: any = {};

    if (testType === 'pssa' || testType === 'both') {
      const pssaData = await db
        .select({
          entityId: entityType === 'school' ? pssaResults.schoolId : pssaResults.districtId,
          subject: pssaResults.subject,
          grade: pssaResults.grade,
          avgProficientOrAbove: sql<number>`AVG(${pssaResults.proficientOrAbovePercent})`,
          totalStudents: sql<number>`SUM(${pssaResults.totalTested})`,
        })
        .from(pssaResults)
        .where(and(
          entityType === 'school' 
            ? sql`${pssaResults.schoolId} IN (${sql.join(entityIds.map(id => sql`${id}`), sql`, `)})`
            : sql`${pssaResults.districtId} IN (${sql.join(entityIds.map(id => sql`${id}`), sql`, `)})`,
          eq(pssaResults.year, yearFilter),
          eq(pssaResults.level, entityType),
          eq(pssaResults.demographicGroup, 'All Students')
        ))
        .groupBy(
          entityType === 'school' ? pssaResults.schoolId : pssaResults.districtId,
          pssaResults.subject,
          pssaResults.grade
        );
      
      results.pssa = pssaData;
    }

    if (testType === 'keystone' || testType === 'both') {
      const keystoneData = await db
        .select({
          entityId: entityType === 'school' ? keystoneResults.schoolId : keystoneResults.districtId,
          subject: keystoneResults.subject,
          avgProficientOrAbove: sql<number>`AVG(${keystoneResults.proficientOrAbovePercent})`,
          totalStudents: sql<number>`SUM(${keystoneResults.totalTested})`,
        })
        .from(keystoneResults)
        .where(and(
          entityType === 'school' 
            ? sql`${keystoneResults.schoolId} IN (${sql.join(entityIds.map(id => sql`${id}`), sql`, `)})`
            : sql`${keystoneResults.districtId} IN (${sql.join(entityIds.map(id => sql`${id}`), sql`, `)})`,
          eq(keystoneResults.year, yearFilter),
          eq(keystoneResults.level, entityType),
          eq(keystoneResults.demographicGroup, 'All Students')
        ))
        .groupBy(
          entityType === 'school' ? keystoneResults.schoolId : keystoneResults.districtId,
          keystoneResults.subject
        );
      
      results.keystone = keystoneData;
    }

    const response = {
      entityType,
      entityIds,
      year: yearFilter,
      testType,
      data: results
    };

    await cache.set(cacheKey, response, 1800); // Cache for 30 minutes
    return response;
  });

  // Rankings: best and worst performing schools
  const rankingsQuerySchema = z.object({
    year: z.coerce.number(),
    examType: z.enum(['pssa', 'keystone']),
    /** Rank schools (default), districts, or counties. */
    entity: z.enum(['school', 'district', 'county']).optional().default('school'),
    /** Rank by the level, or by change since `compareYear` (default: the previous available year). */
    mode: z.enum(['level', 'change']).optional().default('level'),
    compareYear: z.coerce.number().optional(),
    subject: z.string().optional(),
    grade: z.coerce.number().optional(),
    countyId: z.coerce.number().optional(),
    schoolType: z.string().optional(),
    demographicGroup: z.string().optional().default('All Students'),
    limit: z.coerce.number().min(5).max(50).optional().default(10),
    /** An entity needs at least this many students tested across the matched rows to be ranked. */
    minTested: z.coerce.number().min(1).optional().default(40),
    /** What to rank by: assessment proficiency (default) or a non-assessment measure. */
    measure: z.enum(['proficiency', 'grad_rate_4yr', 'regular_attendance', 'low_income', 'per_pupil', 'students_per_teacher', 'beating_odds']).optional().default('proficiency'),
  });

  /**
   * Rank by a non-assessment measure. Indicators (graduation, attendance,
   * low income) come from entity_indicators for schools and districts;
   * spending and staffing are district-only. The response keeps the
   * proficiency-ranking shape so the client and CSV columns are unchanged:
   * avgProficiency carries the measure's value.
   */
  function rankByMeasure(query: z.infer<typeof rankingsQuerySchema>) {
    const entity = query.entity === 'county' ? 'district' : query.entity;
    const idCol = query.measure === 'per_pupil' || query.measure === 'students_per_teacher' ? 'x.district_id' : 'x.entity_id';
    const joins = entity === 'school'
      ? `JOIN schools s ON s.id = ${idCol} JOIN districts d ON d.id = s.district_id JOIN counties c ON c.id = d.county_id`
      : `JOIN districts d ON d.id = ${idCol} JOIN counties c ON c.id = d.county_id`;
    const nameSql = entity === 'school'
      ? 's.id AS id, s.name AS name, s.school_type AS schoolType, d.name AS districtName, c.name AS countyName, s.city AS city'
      : 'd.id AS id, d.name AS name, NULL AS schoolType, NULL AS districtName, c.name AS countyName, d.city AS city';
    const where: string[] = []; const args: (string | number)[] = [];
    if (query.countyId) { where.push('d.county_id = ?'); args.push(query.countyId); }
    if (entity === 'school' && query.schoolType) { where.push('s.school_type = ?'); args.push(query.schoolType); }
    if (entity === 'school') where.push('s.is_active = 1');
    const extra = where.length ? `AND ${where.join(' AND ')}` : '';
    const measureYear = (table: string, yearCol = 'year', filter = '') => (sqliteDb.prepare(`SELECT MAX(${yearCol}) AS y FROM ${table} WHERE ${yearCol} <= ? ${filter}`).get(query.year) as { y: number | null }).y;
    let rows: any[] = []; let year: number | null = null;
    if (query.measure === 'per_pupil' || query.measure === 'students_per_teacher') {
      if (entity !== 'district') return { rows, year };
      const table = query.measure === 'per_pupil' ? 'district_finance' : 'district_staff';
      year = measureYear(table, 'year', `AND ${query.measure} IS NOT NULL`);
      if (!year) return { rows, year };
      rows = sqliteDb.prepare(`
        SELECT ${nameSql}, x.${query.measure} AS avgProficiency, ${query.measure === 'per_pupil' ? 'ROUND(x.adm)' : 'x.teachers'} AS totalTested, 1 AS subjectCount, NULL AS avgGrowth
        FROM ${table} x ${joins} WHERE x.year = ? AND x.${query.measure} IS NOT NULL ${extra}
      `).all(year, ...args);
    } else {
      year = measureYear('entity_indicators', 'year', `AND indicator = '${query.measure}' AND entity_type = '${entity}'`);
      if (!year) return { rows, year };
      rows = sqliteDb.prepare(`
        SELECT ${nameSql}, x.value AS avgProficiency, COALESCE(x.n, 0) AS totalTested, 1 AS subjectCount, NULL AS avgGrowth
        FROM entity_indicators x ${joins} WHERE x.year = ? AND x.entity_type = ? AND x.indicator = ? AND x.value IS NOT NULL ${extra}
      `).all(year, entity, query.measure, ...args);
      if (query.measure === 'grad_rate_4yr') rows = rows.filter((r) => r.totalTested >= Math.min(query.minTested, 40));
    }
    return { rows, year };
  }

  /**
   * "Beating the odds": each school's all-grades Math + ELA proficiency
   * against what its low-income share predicts (least-squares line across
   * all schools that year). The residual, in points, is the ranking value.
   */
  function rankBeatingOdds(query: z.infer<typeof rankingsQuerySchema>) {
    const entity = query.entity === 'county' ? 'district' : query.entity;
    const table = query.examType === 'pssa' ? 'pssa_results' : 'keystone_results';
    const subjects = query.examType === 'pssa' ? ['Mathematics', 'English Language Arts'] : ['Algebra I', 'Literature'];
    const idCol = entity === 'school' ? 'r.school_id' : 'r.district_id';
    const gradeClause = query.examType === 'pssa' ? 'AND r.grade = 0' : '';
    const liYear = (sqliteDb.prepare(`SELECT MAX(year) AS y FROM entity_indicators WHERE indicator = 'low_income' AND entity_type = ? AND year <= ?`).get(entity, query.year) as { y: number | null }).y;
    if (!liYear) return { rows: [], year: null, fit: null };
    const joins = entity === 'school'
      ? 'JOIN schools s ON s.id = r.school_id JOIN districts d ON d.id = s.district_id JOIN counties c ON c.id = d.county_id'
      : 'JOIN districts d ON d.id = r.district_id JOIN counties c ON c.id = d.county_id';
    const nameSql = entity === 'school'
      ? 's.id AS id, s.name AS name, s.school_type AS schoolType, d.name AS districtName, c.name AS countyName, s.city AS city'
      : 'd.id AS id, d.name AS name, NULL AS schoolType, NULL AS districtName, c.name AS countyName, d.city AS city';
    const where: string[] = []; const args: (string | number)[] = [];
    if (query.countyId) { where.push('d.county_id = ?'); args.push(query.countyId); }
    if (entity === 'school' && query.schoolType) { where.push('s.school_type = ?'); args.push(query.schoolType); }
    if (entity === 'school') where.push('s.is_active = 1');
    const all = sqliteDb.prepare(`
      SELECT ${nameSql}, li.value AS lowIncome,
        ROUND(SUM(r.proficient_or_above_percent * r.total_tested) * 1.0 / SUM(r.total_tested), 1) AS avgProficiency,
        SUM(r.total_tested) AS totalTested, COUNT(DISTINCT r.subject) AS subjectCount, ROUND(AVG(r.growth_score), 2) AS avgGrowth
      FROM ${table} r ${joins}
      JOIN entity_indicators li ON li.entity_type = ? AND li.entity_id = ${idCol} AND li.indicator = 'low_income' AND li.year = ?
      WHERE r.level = ? AND r.year = ? AND r.demographic_group = 'All Students' AND r.subject IN (?, ?) AND r.proficient_or_above_percent IS NOT NULL AND r.total_tested > 0 ${gradeClause}
        ${where.length ? `AND ${where.join(' AND ')}` : ''}
      GROUP BY ${idCol} HAVING SUM(r.total_tested) >= ?
    `).all(entity, liYear, entity, query.year, subjects[0], subjects[1], ...args, query.minTested) as Array<any>;
    // Fit proficiency = a + b * lowIncome across every ranked entity (not just the filtered county), so the line is the statewide expectation.
    const universe = query.countyId || query.schoolType ? sqliteDb.prepare(`
      SELECT li.value AS x, SUM(r.proficient_or_above_percent * r.total_tested) * 1.0 / SUM(r.total_tested) AS y
      FROM ${table} r JOIN entity_indicators li ON li.entity_type = ? AND li.entity_id = ${idCol} AND li.indicator = 'low_income' AND li.year = ?
      WHERE r.level = ? AND r.year = ? AND r.demographic_group = 'All Students' AND r.subject IN (?, ?) AND r.proficient_or_above_percent IS NOT NULL AND r.total_tested > 0 ${gradeClause}
      GROUP BY ${idCol} HAVING SUM(r.total_tested) >= ?
    `).all(entity, liYear, entity, query.year, subjects[0], subjects[1], query.minTested) as Array<{ x: number; y: number }> : all.map((r) => ({ x: r.lowIncome, y: r.avgProficiency }));
    const n = universe.length;
    if (n < 10) return { rows: [], year: liYear, fit: null };
    const mx = universe.reduce((s, p) => s + p.x, 0) / n, my = universe.reduce((s, p) => s + p.y, 0) / n;
    const sxy = universe.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0), sxx = universe.reduce((s, p) => s + (p.x - mx) ** 2, 0);
    const slope = sxx ? sxy / sxx : 0, intercept = my - slope * mx;
    const sst = universe.reduce((s, p) => s + (p.y - my) ** 2, 0), sse = universe.reduce((s, p) => s + (p.y - (intercept + slope * p.x)) ** 2, 0);
    const rows = all.map((r) => {
      const expected = Math.round((intercept + slope * r.lowIncome) * 10) / 10;
      return { ...r, expectedProficiency: expected, residual: Math.round((r.avgProficiency - expected) * 10) / 10 };
    });
    return { rows, year: liYear, fit: { slope: Math.round(slope * 1000) / 1000, intercept: Math.round(intercept * 10) / 10, r2: sst ? Math.round((1 - sse / sst) * 100) / 100 : null, n } };
  }

  fastify.get('/rankings', async (request, _reply) => {
    const query = rankingsQuerySchema.parse(request.query);
    const cacheKey = cache.generateKey('rankings', JSON.stringify(query));
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    if (query.measure === 'beating_odds') {
      const { rows, year: lowIncomeYear, fit } = rankBeatingOdds(query);
      const sorted = rows.slice().sort((a, b) => b.residual - a.residual);
      const top = sorted.slice(0, query.limit).map((r, i) => ({ rank: i + 1, ...r, schoolId: r.id, schoolName: r.name }));
      const bottom = sorted.slice().reverse().slice(0, query.limit).map((r, i) => ({ rank: i + 1, ...r, schoolId: r.id, schoolName: r.name }));
      const response = { filters: { ...query, compareYear: null, ranked: rows.length, measureYear: lowIncomeYear }, top, bottom, stateAverage: null, stateChange: null, fit, points: rows.map((r) => ({ id: r.id, name: r.name, lowIncome: r.lowIncome, proficiency: r.avgProficiency, tested: r.totalTested, residual: r.residual })) };
      await cache.set(cacheKey, response, 1800);
      return response;
    }
    if (query.measure !== 'proficiency') {
      const { rows, year: measureYear } = rankByMeasure(query);
      const lowerIsBetter = query.measure === 'low_income' || query.measure === 'students_per_teacher';
      const sorted = rows.slice().sort((a, b) => (lowerIsBetter ? a.avgProficiency - b.avgProficiency : b.avgProficiency - a.avgProficiency));
      const top = sorted.slice(0, query.limit).map((r, i) => ({ rank: i + 1, ...r, schoolId: r.id, schoolName: r.name }));
      const bottom = sorted.slice().reverse().slice(0, query.limit).map((r, i) => ({ rank: i + 1, ...r, schoolId: r.id, schoolName: r.name }));
      const stateRow = sqliteDb.prepare(`SELECT value FROM entity_indicators WHERE entity_type = 'state' AND indicator = ? AND year = ?`).get(query.measure, measureYear ?? 0) as { value: number } | undefined;
      const stateAverage = stateRow?.value ?? (query.measure === 'per_pupil' && measureYear ? (sqliteDb.prepare(`SELECT ROUND(SUM(total_expenditures) / SUM(adm)) AS v FROM district_finance WHERE year = ? AND adm > 0`).get(measureYear) as { v: number }).v : null);
      const response = { filters: { ...query, compareYear: null, ranked: rows.length, measureYear }, top, bottom, stateAverage, stateChange: null };
      await cache.set(cacheKey, response, 1800);
      return response;
    }

    const isPssa = query.examType === 'pssa';
    const table = isPssa ? 'pssa_results' : 'keystone_results';
    const level = query.entity === 'school' ? 'school' : 'district';

    // Student-weighted proficiency per entity for one year, with the same filters.
    const perEntity = (year: number) => {
      const where: string[] = ['r.level = ?', 'r.year = ?', 'r.demographic_group = ?', 'r.proficient_or_above_percent IS NOT NULL', 'r.total_tested > 0'];
      const args: (string | number)[] = [level, year, query.demographicGroup];
      if (isPssa) { where.push('r.grade = ?'); args.push(query.grade || 0); }
      if (query.subject) { where.push('r.subject = ?'); args.push(query.subject); }
      if (query.countyId) { where.push('d.county_id = ?'); args.push(query.countyId); }
      if (query.entity === 'school' && query.schoolType) { where.push('s.school_type = ?'); args.push(query.schoolType); }
      if (query.entity === 'school') where.push('s.is_active = 1');
      const idExpr = query.entity === 'school' ? 's.id' : query.entity === 'district' ? 'd.id' : 'd.county_id';
      const nameSql = query.entity === 'school'
        ? 's.name AS name, s.school_type AS schoolType, d.name AS districtName, c.name AS countyName, s.city AS city'
        : query.entity === 'district'
          ? 'd.name AS name, NULL AS schoolType, NULL AS districtName, c.name AS countyName, d.city AS city'
          : "c.name || ' County' AS name, NULL AS schoolType, NULL AS districtName, c.name AS countyName, NULL AS city";
      const joins = query.entity === 'school'
        ? 'JOIN schools s ON s.id = r.school_id JOIN districts d ON d.id = s.district_id JOIN counties c ON c.id = d.county_id'
        : 'JOIN districts d ON d.id = r.district_id JOIN counties c ON c.id = d.county_id';
      return sqliteDb.prepare(`
        SELECT ${idExpr} AS id, ${nameSql},
          ROUND(SUM(r.proficient_or_above_percent * r.total_tested) * 1.0 / SUM(r.total_tested), 1) AS avgProficiency,
          SUM(r.total_tested) AS totalTested,
          COUNT(DISTINCT r.subject) AS subjectCount,
          ROUND(AVG(r.growth_score), 2) AS avgGrowth
        FROM ${table} r ${joins}
        WHERE ${where.join(' AND ')}
        GROUP BY ${idExpr}
        HAVING SUM(r.total_tested) >= ?
      `).all(...args, query.minTested) as Array<any>;
    };

    let rows = perEntity(query.year);
    let compareYear: number | null = null;
    if (query.mode === 'change') {
      compareYear = query.compareYear ?? (sqliteDb.prepare(`SELECT MAX(year) AS y FROM ${table} WHERE year < ?`).get(query.year) as any)?.y ?? null;
      if (compareYear) {
        const prev = new Map(perEntity(compareYear).map((r) => [r.id, r.avgProficiency as number]));
        rows = rows
          .filter((r) => prev.has(r.id))
          .map((r) => ({ ...r, previousProficiency: prev.get(r.id), change: Math.round((r.avgProficiency - prev.get(r.id)!) * 10) / 10 }));
      } else {
        rows = [];
      }
    }
    const key = query.mode === 'change' ? 'change' : 'avgProficiency';
    const sorted = rows.slice().sort((a, b) => b[key] - a[key]);
    // schoolId/schoolName are kept as aliases so older clients and the CSV columns still work.
    const top = sorted.slice(0, query.limit).map((r, i) => ({ rank: i + 1, ...r, schoolId: r.id, schoolName: r.name }));
    const bottom = sorted.slice().reverse().slice(0, query.limit).map((r, i) => ({ rank: i + 1, ...r, schoolId: r.id, schoolName: r.name }));

    // Statewide figure for the same subject/grade/group (and the compare year's, for change mode).
    const stateFor = (year: number): number | null => {
      const where: string[] = ["level = 'state'", 'year = ?', 'demographic_group = ?', 'proficient_or_above_percent IS NOT NULL'];
      const args: (string | number)[] = [year, query.demographicGroup];
      if (query.subject) { where.push('subject = ?'); args.push(query.subject); }
      if (isPssa) { where.push('grade = ?'); args.push(query.grade || 0); }
      return (sqliteDb.prepare(`
        SELECT ROUND(SUM(proficient_or_above_percent * CASE WHEN total_tested > 0 THEN total_tested ELSE 1 END) * 1.0 / SUM(CASE WHEN total_tested > 0 THEN total_tested ELSE 1 END), 1) AS avg
        FROM ${table} WHERE ${where.join(' AND ')}
      `).get(...args) as any)?.avg ?? null;
    };
    const stateAverage = stateFor(query.year);
    const statePrev = compareYear ? stateFor(compareYear) : null;
    const stateChange = stateAverage != null && statePrev != null ? Math.round((stateAverage - statePrev) * 10) / 10 : null;

    const response = { filters: { ...query, compareYear, ranked: rows.length }, top, bottom, stateAverage, stateChange };
    await cache.set(cacheKey, response, 1800);
    return response;
  });
};

export default performanceRoutes;