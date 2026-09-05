import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db, sqliteDb } from '../db';
import { schools, districts, counties, pssaResults, keystoneResults } from '../db/newSchema';
import { cache } from '../cache';
import { eq, like, and, sql, desc, asc } from 'drizzle-orm';

const schoolQuerySchema = z.object({
  includeInactive: z.coerce.boolean().optional().default(false),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  countyId: z.coerce.number().optional(),
  districtId: z.coerce.number().optional(),
  countyName: z.string().optional(),
  districtName: z.string().optional(),
  schoolType: z.string().optional(),
  sortBy: z.enum(['name', 'districtName', 'countyName', 'type']).optional().default('name'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

const schoolRoutes: FastifyPluginAsync = async (fastify) => {
  // Get all schools with filtering and sorting
  fastify.get('/', async (request, _reply) => {
    const query = schoolQuerySchema.parse(request.query);
    const cacheKey = cache.generateKey('schools', JSON.stringify(query));
    
    const cached = await cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const conditions = [];
    
    // Search across school name, district name, and county name
    if (query.search) {
      conditions.push(
        sql`(
          ${schools.name} LIKE ${`%${query.search}%`} OR
          ${districts.name} LIKE ${`%${query.search}%`} OR
          ${counties.name} LIKE ${`%${query.search}%`}
        )`
      );
    }
    
    if (query.countyId) {
      conditions.push(eq(districts.countyId, query.countyId));
    }
    
    if (query.countyName) {
      conditions.push(like(counties.name, `%${query.countyName}%`));
    }
    
    if (query.districtId) {
      conditions.push(eq(schools.districtId, query.districtId));
    }
    
    // Closed schools (no directory match and no results in the latest year) are
    // hidden unless asked for, so search results are not padded with history.
    if (!query.includeInactive) {
      conditions.push(eq(schools.isActive, true));
    }

    if (query.districtName) {
      conditions.push(like(districts.name, `%${query.districtName}%`));
    }
    
    if (query.schoolType) {
      conditions.push(eq(schools.schoolType, query.schoolType));
    }

    // Determine sort column
    let orderByColumn;
    switch (query.sortBy) {
      case 'districtName':
        orderByColumn = districts.name;
        break;
      case 'countyName':
        orderByColumn = counties.name;
        break;
      case 'type':
        orderByColumn = schools.schoolType;
        break;
      default:
        orderByColumn = schools.name;
    }
    
    const orderByDirection = query.sortOrder === 'desc' ? desc : asc;

    const offset = (query.page - 1) * query.limit;
    
    // Join schools with districts and counties to get full hierarchy
    const baseQuery = db
      .select({
        id: schools.id,
        schoolNumber: schools.schoolNumber,
        name: schools.name,
        type: schools.schoolType,
        districtId: schools.districtId,
        districtName: districts.name,
        districtAun: districts.aun,
        countyId: districts.countyId,
        countyName: counties.name,
        countyCode: counties.countyCode,
        address: schools.address,
        city: schools.city,
        zipCode: schools.zipCode,
      })
      .from(schools)
      .innerJoin(districts, eq(schools.districtId, districts.id))
      .innerJoin(counties, eq(districts.countyId, counties.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const [results, totalCount] = await Promise.all([
      baseQuery
        .orderBy(orderByDirection(orderByColumn))
        .limit(query.limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schools)
        .innerJoin(districts, eq(schools.districtId, districts.id))
        .innerJoin(counties, eq(districts.countyId, counties.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
    ]);

    const response = {
      data: results,
      meta: {
        page: query.page,
        limit: query.limit,
        total: totalCount[0]?.count || 0,
        totalPages: Math.ceil((totalCount[0]?.count || 0) / query.limit),
      },
    };

    await cache.set(cacheKey, response, 300); // Cache for 5 minutes
    return response;
  });

  // Get school by ID with performance data
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const cacheKey = cache.generateKey('school', id);
    
    const cached = await cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Try to find by school ID (numeric)
    const schoolId = parseInt(id);
    const school = await db
      .select({
        id: schools.id,
        schoolNumber: schools.schoolNumber,
        name: schools.name,
        type: schools.schoolType,
        districtId: schools.districtId,
        districtName: districts.name,
        districtAun: districts.aun,
        countyId: districts.countyId,
        countyName: counties.name,
        countyCode: counties.countyCode,
        address: schools.address,
        city: schools.city,
        zipCode: schools.zipCode,
        latitude: schools.latitude,
        longitude: schools.longitude,
        enrollment: schools.enrollment,
        gradeRange: schools.gradeRange,
        isCharter: schools.isCharter,
      })
      .from(schools)
      .innerJoin(districts, eq(schools.districtId, districts.id))
      .innerJoin(counties, eq(districts.countyId, counties.id))
      .where(eq(schools.id, schoolId))
      .limit(1);

    if (school.length === 0) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'School not found',
      });
    }

    // Get recent PSSA results (All Students only by default)
    const pssaData = await db
      .select({
        year: pssaResults.year,
        grade: pssaResults.grade,
        subject: pssaResults.subject,
        demographicGroup: pssaResults.demographicGroup,
        numberScored: pssaResults.totalTested,
        percentAdvanced: pssaResults.advancedPercent,
        percentProficient: pssaResults.proficientPercent,
        percentBasic: pssaResults.basicPercent,
        percentBelowBasic: pssaResults.belowBasicPercent,
        percentProficientOrAbove: pssaResults.proficientOrAbovePercent,
        growthScore: pssaResults.growthScore,
      })
      .from(pssaResults)
      .where(and(
        eq(pssaResults.schoolId, schoolId),
        eq(pssaResults.demographicGroup, 'All Students')
      ))
      .orderBy(desc(pssaResults.year), asc(pssaResults.grade));

    // Get recent Keystone results (All Students only by default)
    const keystoneData = await db
      .select({
        year: keystoneResults.year,
        subject: keystoneResults.subject,
        demographicGroup: keystoneResults.demographicGroup,
        numberScored: keystoneResults.totalTested,
        percentAdvanced: keystoneResults.advancedPercent,
        percentProficient: keystoneResults.proficientPercent,
        percentBasic: keystoneResults.basicPercent,
        percentBelowBasic: keystoneResults.belowBasicPercent,
        percentProficientOrAbove: keystoneResults.proficientOrAbovePercent,
        growthScore: keystoneResults.growthScore,
      })
      .from(keystoneResults)
      .where(and(
        eq(keystoneResults.schoolId, schoolId),
        eq(keystoneResults.demographicGroup, 'All Students')
      ))
      .orderBy(desc(keystoneResults.year));

    const result = {
      ...school[0],
      pssaResults: pssaData,
      keystoneResults: keystoneData,
    };

    await cache.set(cacheKey, result, 3600); // Cache for 1 hour
    return result;
  });

  /**
   * Schools of the same level, nearest by distance and closest in size.
   * Used for the "similar schools" card and its one-click comparison.
   */
  fastify.get('/:id/similar', async (request, reply) => {
    const { id } = request.params as { id: string };
    const limit = Math.min(8, Math.max(1, parseInt((request.query as any).limit ?? '4', 10) || 4));
    const cacheKey = cache.generateKey('similar', id, String(limit));
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const me = sqliteDb.prepare(`
      SELECT s.id, s.school_type AS type, s.latitude AS lat, s.longitude AS lng, s.enrollment, d.county_id AS countyId
      FROM schools s JOIN districts d ON d.id = s.district_id WHERE s.id = ?
    `).get(parseInt(id, 10)) as any;
    if (!me) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'School not found' });

    const candidates = sqliteDb.prepare(`
      SELECT s.id, s.name, s.school_type AS type, s.latitude AS lat, s.longitude AS lng, s.enrollment, s.city,
             d.name AS districtName, d.county_id AS countyId, c.name AS countyName
      FROM schools s JOIN districts d ON d.id = s.district_id JOIN counties c ON c.id = d.county_id
      WHERE s.id != ? AND s.is_active = 1 AND COALESCE(s.school_type, '') = COALESCE(?, '')
    `).all(me.id, me.type) as any[];

    const km = (a: any, b: any) => {
      if (a.lat == null || b.lat == null) return null;
      const r = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLng = (b.lng - a.lng) * Math.PI / 180;
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
      return 2 * r * Math.asin(Math.sqrt(h));
    };
    const scored = candidates.map((c) => {
      const distance = km(me, c);
      const sizeRatio = me.enrollment && c.enrollment ? Math.abs(Math.log(c.enrollment / me.enrollment)) : 1;
      // Distance in km plus a size penalty; a school twice the size costs about 35 km.
      const score = (distance ?? (c.countyId === me.countyId ? 40 : 200)) + sizeRatio * 50;
      return { ...c, distanceKm: distance == null ? null : Math.round(distance * 10) / 10, score };
    }).sort((a, b) => a.score - b.score).slice(0, limit);

    const response = { schoolId: me.id, similar: scored.map(({ score: _s, ...rest }) => rest) };
    await cache.set(cacheKey, response, 3600);
    return response;
  });

  /**
   * One point per active school with coordinates, carrying the all-grades
   * proficiency for the chosen exam/subject/year and its growth index.
   */
  fastify.get('/map', async (request, _reply) => {
    const q = z.object({
      year: z.coerce.number(),
      exam: z.enum(['pssa', 'keystone']).default('pssa'),
      subject: z.string().default('Mathematics'),
    }).parse(request.query);
    const cacheKey = cache.generateKey('map', JSON.stringify(q));
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const table = q.exam === 'pssa' ? 'pssa_results' : 'keystone_results';
    const gradeClause = q.exam === 'pssa' ? 'AND r.grade = 0' : '';
    const points = sqliteDb.prepare(`
      SELECT s.id, s.name, s.latitude AS lat, s.longitude AS lng, s.school_type AS type, s.enrollment,
             d.name AS districtName, d.county_id AS countyId,
             r.proficient_or_above_percent AS proficiency, r.growth_score AS growth, r.total_tested AS tested
      FROM schools s
      JOIN districts d ON d.id = s.district_id
      LEFT JOIN ${table} r ON r.school_id = s.id AND r.level = 'school' AND r.year = ? AND r.subject = ?
        AND r.demographic_group = 'All Students' ${gradeClause}
      WHERE s.is_active = 1 AND s.latitude IS NOT NULL AND s.longitude IS NOT NULL
    `).all(q.year, q.subject);

    const response = { filters: q, points };
    await cache.set(cacheKey, response, 3600);
    return response;
  });

  // Get distinct values for filters
  fastify.get('/filters', async (_request, _reply) => {
    const cacheKey = cache.generateKey('school-filters', 'all');
    
    const cached = await cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const [countiesData, schoolTypes] = await Promise.all([
      db
        .select({
          id: counties.id,
          name: counties.name,
          code: counties.countyCode,
        })
        .from(counties)
        .orderBy(asc(counties.name)),
      db
        .selectDistinct({
          type: schools.schoolType,
        })
        .from(schools)
        .where(sql`${schools.schoolType} IS NOT NULL`)
        .orderBy(asc(schools.schoolType))
    ]);

    const filters = {
      counties: countiesData,
      schoolTypes: schoolTypes.map(s => s.type).filter(Boolean),
    };

    await cache.set(cacheKey, filters, 3600); // Cache for 1 hour
    return filters;
  });
};

export default schoolRoutes;