import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { schools, districts, counties, pssaResults, keystoneResults } from '../db/newSchema';
import { cache } from '../cache';
import { eq, like, and, sql, desc, asc, inArray } from 'drizzle-orm';

const schoolQuerySchema = z.object({
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
  fastify.get('/', async (request, reply) => {
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

  // Get distinct values for filters
  fastify.get('/filters', async (request, reply) => {
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