import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { districts } from '../db/schema';
import { cache } from '../cache';
import { eq, like, sql } from 'drizzle-orm';

const districtQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  county: z.string().optional(),
});

const districtRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (request, reply) => {
    const query = districtQuerySchema.parse(request.query);
    const cacheKey = cache.generateKey('districts', JSON.stringify(query));
    
    const cached = await cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const conditions = [];
    if (query.search) {
      conditions.push(like(districts.name, `%${query.search}%`));
    }
    if (query.county) {
      conditions.push(eq(districts.county, query.county));
    }

    const offset = (query.page - 1) * query.limit;
    
    const [results, totalCount] = await Promise.all([
      db.select()
        .from(districts)
        .where(conditions.length > 0 ? sql`${conditions.join(' AND ')}` : undefined)
        .limit(query.limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` })
        .from(districts)
        .where(conditions.length > 0 ? sql`${conditions.join(' AND ')}` : undefined)
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

    await cache.set(cacheKey, response, 300);
    return response;
  });

  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const cacheKey = cache.generateKey('district', id);
    
    const cached = await cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const district = await db.select()
      .from(districts)
      .where(eq(districts.districtId, id))
      .limit(1);

    if (district.length === 0) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'District not found',
      });
    }

    await cache.set(cacheKey, district[0], 3600);
    return district[0];
  });
};

export default districtRoutes;