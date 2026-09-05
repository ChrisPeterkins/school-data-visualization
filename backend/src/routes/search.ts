import { FastifyPluginAsync } from 'fastify';
import { search } from '../services/searchIndex';

/** GET /api/search?q=... — schools, districts, and counties for the nav autocomplete. */
const searchRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (request) => {
    const { q = '', limit = '10' } = request.query as { q?: string; limit?: string };
    if (q.trim().length < 2) return { query: q, results: [] };
    return { query: q, results: search(q, Math.min(25, Math.max(1, parseInt(limit, 10) || 10))) };
  });
};

export default searchRoutes;
