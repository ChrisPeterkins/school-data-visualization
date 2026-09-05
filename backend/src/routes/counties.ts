import { FastifyPluginAsync } from 'fastify';
import { sqliteDb } from '../db';
import { cache } from '../cache';

/** Counties as a browsable level between districts and the state. */
const countyRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async () => {
    const cacheKey = cache.generateKey('counties');
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const counties = sqliteDb.prepare(`
      SELECT c.id, c.name, c.county_code AS code,
        (SELECT COUNT(*) FROM districts d WHERE d.county_id = c.id) AS districtCount,
        (SELECT COUNT(*) FROM schools s JOIN districts d ON d.id = s.district_id WHERE d.county_id = c.id AND s.is_active = 1) AS schoolCount,
        (SELECT SUM(d.total_enrollment) FROM districts d WHERE d.county_id = c.id) AS enrollment
      FROM counties c
      ORDER BY c.name
    `).all();

    const response = { data: counties };
    await cache.set(cacheKey, response, 3600);
    return response;
  });

  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const cacheKey = cache.generateKey('county', id);
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const county = sqliteDb.prepare(`SELECT id, name, county_code AS code FROM counties WHERE id = ?`).get(parseInt(id, 10)) as any;
    if (!county) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'County not found' });

    const districts = sqliteDb.prepare(`
      SELECT d.id, d.name, d.total_enrollment AS enrollment, d.city,
        (SELECT COUNT(*) FROM schools s WHERE s.district_id = d.id AND s.is_active = 1) AS schoolCount
      FROM districts d WHERE d.county_id = ? ORDER BY d.name
    `).all(county.id);

    const response = { ...county, districts };
    await cache.set(cacheKey, response, 3600);
    return response;
  });
};

export default countyRoutes;
