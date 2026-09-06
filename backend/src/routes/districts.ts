import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db, sqliteDb } from '../db';
import { districts, counties, schools, pssaResults, keystoneResults } from '../db/newSchema';
import { cache } from '../cache';
import { eq, like, and, sql, desc, asc } from 'drizzle-orm';

const districtQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  countyId: z.coerce.number().optional(),
  countyName: z.string().optional(),
  /** District type as stored (Public, Charter, Cyber Charter, CTC, ...). */
  type: z.string().optional(),
  minEnrollment: z.coerce.number().optional(),
  maxEnrollment: z.coerce.number().optional(),
  sortBy: z.enum(['name', 'countyName', 'schoolCount', 'enrollment', 'proficiency']).optional().default('name'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

const districtRoutes: FastifyPluginAsync = async (fastify) => {
  // Get all districts with filtering and sorting
  fastify.get('/', async (request, _reply) => {
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
    if (query.type) conditions.push(eq(districts.districtType, query.type));
    if (query.minEnrollment != null) conditions.push(sql`${districts.totalEnrollment} >= ${query.minEnrollment}`);
    if (query.maxEnrollment != null) conditions.push(sql`${districts.totalEnrollment} <= ${query.maxEnrollment}`);

    // Latest all-grades Math + ELA proficiency, student-weighted, for the list and for sorting.
    const latestYear = (sqliteDb.prepare(`SELECT MAX(year) AS y FROM pssa_results WHERE level = 'district'`).get() as { y: number | null }).y ?? 0;
    const proficiencySql = sql<number | null>`(
      SELECT ROUND(SUM(r.proficient_or_above_percent * r.total_tested) / SUM(r.total_tested), 1) FROM pssa_results r
      WHERE r.level = 'district' AND r.district_id = districts.id AND r.year = ${latestYear} AND r.grade = 0
        AND r.demographic_group = 'All Students' AND r.subject IN ('Mathematics', 'English Language Arts') AND r.total_tested > 0
    )`;

    // Determine sort column
    let orderByColumn;
    switch (query.sortBy) {
      case 'countyName':
        orderByColumn = counties.name;
        break;
      case 'schoolCount':
        orderByColumn = sql<number>`school_count`;
        break;
      case 'enrollment':
        orderByColumn = sql<number>`COALESCE(${districts.totalEnrollment}, -1)`;
        break;
      case 'proficiency':
        orderByColumn = sql<number>`COALESCE(${proficiencySql}, -1)`;
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
        proficiency: proficiencySql,
        proficiencyYear: sql<number>`${latestYear}`,
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
  /**
   * One value per district for the map's boundary layer: student-weighted
   * all-grades proficiency and mean growth for a year/exam/subject, keyed by
   * district id and NCES id (which the Census boundary file uses).
   */
  fastify.get('/map-values', async (request, _reply) => {
    const q = request.query as { year?: string; exam?: string; subject?: string };
    const year = parseInt(q.year || '0', 10);
    const exam = q.exam === 'keystone' ? 'keystone' : 'pssa';
    const subject = q.subject || 'Mathematics';
    const cacheKey = cache.generateKey('district-map-values', String(year), exam, subject);
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const table = exam === 'pssa' ? 'pssa_results' : 'keystone_results';
    const rows = sqliteDb.prepare(`
      SELECT d.id, d.nces_id AS ncesId, d.name,
        ROUND(SUM(r.proficient_or_above_percent * r.total_tested) * 1.0 / NULLIF(SUM(r.total_tested), 0), 1) AS proficiency,
        ROUND(AVG(r.growth_score), 2) AS growth,
        SUM(r.total_tested) AS tested
      FROM ${table} r JOIN districts d ON d.id = r.district_id
      WHERE r.level = 'district' AND r.year = ? AND r.subject = ? AND r.demographic_group = 'All Students'
        AND r.proficient_or_above_percent IS NOT NULL ${exam === 'pssa' ? 'AND r.grade = 0' : ''}
      GROUP BY d.id
    `).all(year, subject);

    const response = { year, exam, subject, districts: rows };
    await cache.set(cacheKey, response, 3600);
    return response;
  });

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
        percentProficientOrAbove: sql<number>`ROUND(SUM(${pssaResults.proficientOrAbovePercent} * ${pssaResults.totalTested}) * 1.0 / NULLIF(SUM(${pssaResults.totalTested}), 0), 1)`,
        growthScore: sql<number | null>`ROUND(AVG(${pssaResults.growthScore}), 2)`,
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
        percentProficientOrAbove: sql<number>`ROUND(SUM(${keystoneResults.proficientOrAbovePercent} * ${keystoneResults.totalTested}) * 1.0 / NULLIF(SUM(${keystoneResults.totalTested}), 0), 1)`,
        growthScore: sql<number | null>`ROUND(AVG(${keystoneResults.growthScore}), 2)`,
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
  fastify.get('/stats', async (_request, _reply) => {
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