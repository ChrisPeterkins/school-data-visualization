import Fastify from 'fastify';
import { createHash } from 'crypto';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler } from './utils/errorHandler';
import schoolRoutes from './routes/schools';
import districtRoutes from './routes/districts';
import countyRoutes from './routes/counties';
import sitemapRoutes from './routes/sitemap';
import searchRoutes from './routes/search';
import performanceRoutes from './routes/performance';
import healthRoutes from './routes/health';
import importRoutes from './routes/import';
import verifyRoutes from './routes/verify';
import filesRoutes from './routes/files';
import databaseRoutes from './routes/database';
import uploadRoutes from './routes/upload';

const buildApp = async () => {
  const fastify = Fastify({
    logger: logger as any, // Pino logger compatibility
    // Per-request access logs are noise in production; slow and failed
    // requests are logged by the onResponse hook below instead.
    disableRequestLogging: true,
    trustProxy: true,
  });

  await fastify.register(helmet, {
    contentSecurityPolicy: false,
  });

  await fastify.register(cors, {
    origin: config.CORS_ORIGIN,
    credentials: true,
  });

  await fastify.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW,
  });

  await fastify.register(multipart, {
    limits: {
      fileSize: 100 * 1024 * 1024 // 100MB
    }
  });

  fastify.setErrorHandler(errorHandler as any); // Type compatibility with Fastify error handler

  // Read endpoints change once a year, so let browsers and proxies cache
  // them for an hour and revalidate cheaply with a weak ETag.
  const CACHEABLE = /^\/api\/(performance|schools|districts|counties|search)(\/|\?|$)/;
  fastify.addHook('onSend', async (request, reply, payload) => {
    if (request.method === 'GET' && reply.statusCode === 200 && CACHEABLE.test(request.url) && typeof payload === 'string') {
      const etag = `W/"${createHash('sha1').update(payload).digest('base64url').slice(0, 20)}"`;
      reply.header('Cache-Control', 'public, max-age=3600');
      reply.header('ETag', etag);
      if (request.headers['if-none-match'] === etag) {
        reply.code(304);
        return '';
      }
    }
    return payload;
  });
  fastify.addHook('onResponse', async (request, reply) => {
    const ms = reply.elapsedTime;
    if (reply.statusCode >= 500 || ms > 1000) {
      logger.warn({ method: request.method, url: request.url, statusCode: reply.statusCode, ms: Math.round(ms) }, reply.statusCode >= 500 ? 'request failed' : 'slow request');
    }
  });

  await fastify.register(healthRoutes, { prefix: '/api/health' });
  await fastify.register(schoolRoutes, { prefix: '/api/schools' });
  await fastify.register(districtRoutes, { prefix: '/api/districts' });
  await fastify.register(countyRoutes, { prefix: '/api/counties' });
  await fastify.register(sitemapRoutes, { prefix: '/api' });
  await fastify.register(searchRoutes, { prefix: '/api/search' });
  await fastify.register(performanceRoutes, { prefix: '/api/performance' });
  await fastify.register(importRoutes, { prefix: '/api/import' });
  await fastify.register(verifyRoutes, { prefix: '/api/verify' });
  await fastify.register(filesRoutes, { prefix: '/api/files' });
  await fastify.register(databaseRoutes, { prefix: '/api/database' });
  await fastify.register(uploadRoutes, { prefix: '/api/upload' });

  return fastify;
};

const start = async () => {
  try {
    const app = await buildApp();
    
    await app.listen({
      port: config.PORT,
      host: '127.0.0.1',
    });

    logger.info(`Server running on port ${config.PORT}`);
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
};

start();
