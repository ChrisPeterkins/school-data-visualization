import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { pssaResults, keystoneResults } from '../db/schema';
import { cache } from '../cache';
import { eq, and, gte, lte, sql } from 'drizzle-orm';

const performanceQuerySchema = z.object({
  schoolId: z.string().optional(),
  districtId: z.string().optional(),
  year: z.coerce.number().optional(),
  yearFrom: z.coerce.number().optional(),
  yearTo: z.coerce.number().optional(),
  subject: z.string().optional(),
  grade: z.coerce.number().optional(),
  level: z.enum(['school', 'district', 'state']).optional(),
});

const performanceRoutes: FastifyPluginAsync = async (fastify) => {
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
    if (query.year) {
      conditions.push(eq(pssaResults.year, query.year));
    }
    if (query.yearFrom && query.yearTo) {
      conditions.push(
        and(
          gte(pssaResults.year, query.yearFrom),
          lte(pssaResults.year, query.yearTo)
        )
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

    const results = await db.select()
      .from(pssaResults)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(pssaResults.year, pssaResults.grade);

    await cache.set(cacheKey, results, 600); // Cache for 10 minutes
    return results;
  });

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
    if (query.year) {
      conditions.push(eq(keystoneResults.year, query.year));
    }
    if (query.yearFrom && query.yearTo) {
      conditions.push(
        and(
          gte(keystoneResults.year, query.yearFrom),
          lte(keystoneResults.year, query.yearTo)
        )
      );
    }
    if (query.subject) {
      conditions.push(eq(keystoneResults.subject, query.subject));
    }
    if (query.level) {
      conditions.push(eq(keystoneResults.level, query.level));
    }

    const results = await db.select()
      .from(keystoneResults)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(keystoneResults.year);

    await cache.set(cacheKey, results, 600); // Cache for 10 minutes
    return results;
  });

  fastify.get('/trends/:schoolId', async (request, reply) => {
    const { schoolId } = request.params as { schoolId: string };
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
        proficientOrAbove: pssaResults.proficientOrAbovePercent,
      })
      .from(pssaResults)
      .where(eq(pssaResults.schoolId, schoolId))
      .orderBy(pssaResults.year, pssaResults.grade),
      
      db.select({
        year: keystoneResults.year,
        subject: keystoneResults.subject,
        proficientOrAbove: keystoneResults.proficientOrAbovePercent,
      })
      .from(keystoneResults)
      .where(eq(keystoneResults.schoolId, schoolId))
      .orderBy(keystoneResults.year),
    ]);

    const response = {
      schoolId,
      pssaTrends: pssa,
      keystoneTrends: keystone,
    };

    await cache.set(cacheKey, response, 1800); // Cache for 30 minutes
    return response;
  });
};

export default performanceRoutes;