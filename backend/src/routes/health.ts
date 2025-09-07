import { FastifyPluginAsync } from 'fastify';
import { pool } from '../db';
import { redis } from '../cache';

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (request, reply) => {
    const checks = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'unknown',
      cache: 'unknown',
    };

    try {
      await pool.query('SELECT 1');
      checks.database = 'connected';
    } catch (error) {
      checks.database = 'disconnected';
      checks.status = 'degraded';
    }

    try {
      await redis.ping();
      checks.cache = 'connected';
    } catch (error) {
      checks.cache = 'disconnected';
      checks.status = 'degraded';
    }

    const statusCode = checks.status === 'ok' ? 200 : 503;
    return reply.status(statusCode).send(checks);
  });

  fastify.get('/ready', async (request, reply) => {
    try {
      await pool.query('SELECT 1');
      await redis.ping();
      return reply.status(200).send({ ready: true });
    } catch (error) {
      return reply.status(503).send({ ready: false });
    }
  });
};

export default healthRoutes;