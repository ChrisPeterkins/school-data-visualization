import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { pssaResults, keystoneResults, schools, districts, counties } from '../db/newSchema';
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
  // Get PSSA performance data
  fastify.get('/pssa', async (request, reply) => {
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
  fastify.get('/keystone', async (request, reply) => {
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
  fastify.get('/trends/:schoolId', async (request, reply) => {
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
  fastify.get('/state', async (request, reply) => {
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
  fastify.post('/compare', async (request, reply) => {
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
    subject: z.string().optional(),
    grade: z.coerce.number().optional(),
    countyId: z.coerce.number().optional(),
    schoolType: z.string().optional(),
    demographicGroup: z.string().optional().default('All Students'),
    limit: z.coerce.number().min(5).max(50).optional().default(10),
  });

  fastify.get('/rankings', async (request, reply) => {
    const query = rankingsQuerySchema.parse(request.query);
    const cacheKey = cache.generateKey('rankings', JSON.stringify(query));

    const cached = await cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const isPssa = query.examType === 'pssa';
    const resultsTable = isPssa ? pssaResults : keystoneResults;

    // Build conditions
    const conditions = [
      eq(resultsTable.level, 'school'),
      eq(resultsTable.year, query.year),
      eq(resultsTable.demographicGroup, query.demographicGroup),
      sql`${resultsTable.proficientOrAbovePercent} IS NOT NULL`,
      sql`${resultsTable.schoolId} IS NOT NULL`,
      sql`${resultsTable.totalTested} >= 10`,
    ];

    if (query.subject) conditions.push(eq(resultsTable.subject, query.subject));
    if (isPssa && query.grade) conditions.push(eq(pssaResults.grade, query.grade));
    if (query.countyId) conditions.push(eq(districts.countyId, query.countyId));
    if (query.schoolType) conditions.push(eq(schools.schoolType, query.schoolType));

    // Build the base select
    const buildRankingQuery = (order: 'asc' | 'desc') => {
      return db
        .select({
          schoolId: schools.id,
          schoolName: schools.name,
          schoolType: schools.schoolType,
          districtName: districts.name,
          countyName: counties.name,
          city: schools.city,
          avgProficiency: sql<number>`ROUND(AVG(${resultsTable.proficientOrAbovePercent}), 1)`.as('avg_proficiency'),
          totalTested: sql<number>`SUM(${resultsTable.totalTested})`.as('total_tested'),
          subjectCount: sql<number>`COUNT(DISTINCT ${resultsTable.subject})`.as('subject_count'),
        })
        .from(resultsTable)
        .innerJoin(schools, eq(resultsTable.schoolId, schools.id))
        .innerJoin(districts, eq(schools.districtId, districts.id))
        .innerJoin(counties, eq(districts.countyId, counties.id))
        .where(and(...conditions))
        .groupBy(resultsTable.schoolId)
        .orderBy(order === 'desc' ? desc(sql`avg_proficiency`) : asc(sql`avg_proficiency`))
        .limit(query.limit);
    };

    // State average query
    const stateConditions = [
      eq(resultsTable.level, 'state'),
      eq(resultsTable.year, query.year),
      eq(resultsTable.demographicGroup, query.demographicGroup),
      sql`${resultsTable.proficientOrAbovePercent} IS NOT NULL`,
    ];
    if (query.subject) stateConditions.push(eq(resultsTable.subject, query.subject));

    const [topSchools, bottomSchools, stateAvgResult] = await Promise.all([
      buildRankingQuery('desc'),
      buildRankingQuery('asc'),
      db.select({
        avg: sql<number>`ROUND(AVG(${resultsTable.proficientOrAbovePercent}), 1)`,
      })
      .from(resultsTable)
      .where(and(...stateConditions)),
    ]);

    const response = {
      filters: {
        year: query.year,
        examType: query.examType,
        subject: query.subject || null,
        grade: query.grade || null,
        countyId: query.countyId || null,
        schoolType: query.schoolType || null,
        demographicGroup: query.demographicGroup,
        limit: query.limit,
      },
      top: topSchools.map((s, i) => ({ rank: i + 1, ...s })),
      bottom: bottomSchools.map((s, i) => ({ rank: i + 1, ...s })),
      stateAverage: stateAvgResult[0]?.avg ?? null,
    };

    await cache.set(cacheKey, response, 1800);
    return response;
  });
};

export default performanceRoutes;