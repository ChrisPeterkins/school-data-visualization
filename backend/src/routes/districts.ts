import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { districts, counties, schools, pssaResults, keystoneResults } from '../db/newSchema';
import { cache } from '../cache';
import { eq, like, and, sql, desc, asc } from 'drizzle-orm';

const districtQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  countyId: z.coerce.number().optional(),
  countyName: z.string().optional(),
  sortBy: z.enum(['name', 'countyName', 'schoolCount']).optional().default('name'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

const districtRoutes: FastifyPluginAsync = async (fastify) => {
  // Get all districts with filtering and sorting
  fastify.get('/', async (request, reply) => {
    const query = districtQuerySchema.parse(request.query);
    const cacheKey = cache.generateKey('districts', JSON.stringify(query));
    
    const cached = await cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const conditions = [];
    
    // Search across district name and county name
    if (query.search) {
      conditions.push(
        sql`(
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

    // Determine sort column
    let orderByColumn;
    switch (query.sortBy) {
      case 'countyName':
        orderByColumn = counties.name;
        break;
      case 'schoolCount':
        orderByColumn = sql<number>`school_count`;
        break;
      default:
        orderByColumn = districts.name;
    }
    
    const orderByDirection = query.sortOrder === 'desc' ? desc : asc;

    const offset = (query.page - 1) * query.limit;
    
    // Join districts with counties and get school count
    const baseQuery = db
      .select({
        id: districts.id,
        aun: districts.aun,
        name: districts.name,
        districtType: districts.districtType,
        countyId: districts.countyId,
        countyName: counties.name,
        countyCode: counties.countyCode,
        address: districts.address,
        city: districts.city,
        zipCode: districts.zipCode,
        phoneNumber: districts.phoneNumber,
        websiteUrl: districts.websiteUrl,
        totalEnrollment: districts.totalEnrollment,
        schoolCount: sql<number>`(
          SELECT COUNT(*) FROM schools 
          WHERE schools.district_id = districts.id
        )`,
      })
      .from(districts)
      .innerJoin(counties, eq(districts.countyId, counties.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const [results, totalCount] = await Promise.all([
      baseQuery
        .orderBy(orderByDirection(orderByColumn))
        .limit(query.limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(districts)
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

  // Get district by ID with schools and performance data
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const cacheKey = cache.generateKey('district', id);
    
    const cached = await cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Try to find by district ID (numeric)
    const districtId = parseInt(id);
    const district = await db
      .select({
        id: districts.id,
        aun: districts.aun,
        name: districts.name,
        districtType: districts.districtType,
        countyId: districts.countyId,
        countyName: counties.name,
        countyCode: counties.countyCode,
        address: districts.address,
        city: districts.city,
        zipCode: districts.zipCode,
        phoneNumber: districts.phoneNumber,
        websiteUrl: districts.websiteUrl,
        totalEnrollment: districts.totalEnrollment,
      })
      .from(districts)
      .innerJoin(counties, eq(districts.countyId, counties.id))
      .where(eq(districts.id, districtId))
      .limit(1);

    if (district.length === 0) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'District not found',
      });
    }

    // Get schools in this district
    const districtSchools = await db
      .select({
        id: schools.id,
        schoolNumber: schools.schoolNumber,
        name: schools.name,
        schoolType: schools.schoolType,
        city: schools.city,
      })
      .from(schools)
      .where(eq(schools.districtId, districtId))
      .orderBy(asc(schools.name));

    // Get recent PSSA aggregate results (All Students only)
    const pssaData = await db
      .select({
        year: pssaResults.year,
        grade: pssaResults.grade,
        subject: pssaResults.subject,
        numberScored: sql<number>`SUM(${pssaResults.totalTested})`,
        percentProficientOrAbove: sql<number>`AVG(${pssaResults.proficientOrAbovePercent})`,
      })
      .from(pssaResults)
      .where(and(
        eq(pssaResults.districtId, districtId),
        eq(pssaResults.level, 'district'),
        eq(pssaResults.demographicGroup, 'All Students')
      ))
      .groupBy(pssaResults.year, pssaResults.grade, pssaResults.subject)
      .orderBy(desc(pssaResults.year), asc(pssaResults.grade));

    // Get recent Keystone aggregate results (All Students only)
    const keystoneData = await db
      .select({
        year: keystoneResults.year,
        subject: keystoneResults.subject,
        numberScored: sql<number>`SUM(${keystoneResults.totalTested})`,
        percentProficientOrAbove: sql<number>`AVG(${keystoneResults.proficientOrAbovePercent})`,
      })
      .from(keystoneResults)
      .where(and(
        eq(keystoneResults.districtId, districtId),
        eq(keystoneResults.level, 'district'),
        eq(keystoneResults.demographicGroup, 'All Students')
      ))
      .groupBy(keystoneResults.year, keystoneResults.subject)
      .orderBy(desc(keystoneResults.year));

    const result = {
      ...district[0],
      schools: districtSchools,
      pssaResults: pssaData,
      keystoneResults: keystoneData,
    };

    await cache.set(cacheKey, result, 3600); // Cache for 1 hour
    return result;
  });

  // Get district statistics
  fastify.get('/stats', async (request, reply) => {
    const cacheKey = cache.generateKey('district-stats', 'all');
    
    const cached = await cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const stats = await db
      .select({
        totalDistricts: sql<number>`COUNT(DISTINCT districts.id)`,
        totalSchools: sql<number>`COUNT(DISTINCT schools.id)`,
        totalCounties: sql<number>`COUNT(DISTINCT counties.id)`,
      })
      .from(districts)
      .leftJoin(schools, eq(schools.districtId, districts.id))
      .innerJoin(counties, eq(districts.countyId, counties.id))
      .get();

    await cache.set(cacheKey, stats, 3600); // Cache for 1 hour
    return stats;
  });
};

export default districtRoutes;