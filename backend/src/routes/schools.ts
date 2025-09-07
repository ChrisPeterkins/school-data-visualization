import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { schools } from '../db/schema';
import { cache } from '../cache';
import { eq, like, and, sql } from 'drizzle-orm';

const schoolQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  districtId: z.string().optional(),
  schoolType: z.string().optional(),
  isCharter: z.coerce.boolean().optional(),
});

const schoolRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (request, reply) => {
    const query = schoolQuerySchema.parse(request.query);
    const cacheKey = cache.generateKey('schools', JSON.stringify(query));
    
    const cached = await cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const conditions = [];
    if (query.search) {
      conditions.push(like(schools.name, `%${query.search}%`));
    }
    if (query.districtId) {
      conditions.push(eq(schools.districtId, query.districtId));
    }
    if (query.schoolType) {
      conditions.push(eq(schools.schoolType, query.schoolType));
    }
    if (query.isCharter !== undefined) {
      conditions.push(eq(schools.isCharter, query.isCharter));
    }

    const offset = (query.page - 1) * query.limit;
    
    const [results, totalCount] = await Promise.all([
      db.select()
        .from(schools)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .limit(query.limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` })
        .from(schools)
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

  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const cacheKey = cache.generateKey('school', id);
    
    const cached = await cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const school = await db.select()
      .from(schools)
      .where(eq(schools.schoolId, id))
      .limit(1);

    if (school.length === 0) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'School not found',
      });
    }

    await cache.set(cacheKey, school[0], 3600); // Cache for 1 hour
    return school[0];
  });
};

export default schoolRoutes;