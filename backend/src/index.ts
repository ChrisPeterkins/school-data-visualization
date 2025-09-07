import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler } from './utils/errorHandler';
import schoolRoutes from './routes/schools';
import districtRoutes from './routes/districts';
import performanceRoutes from './routes/performance';
import healthRoutes from './routes/health';
import importRoutes from './routes/import';

const buildApp = async () => {
  const fastify = Fastify({
    logger: logger,
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

  fastify.setErrorHandler(errorHandler);

  await fastify.register(healthRoutes, { prefix: '/api/health' });
  await fastify.register(schoolRoutes, { prefix: '/api/schools' });
  await fastify.register(districtRoutes, { prefix: '/api/districts' });
  await fastify.register(performanceRoutes, { prefix: '/api/performance' });
  await fastify.register(importRoutes, { prefix: '/api/import' });

  return fastify;
};

const start = async () => {
  try {
    const app = await buildApp();
    
    await app.listen({
      port: config.PORT,
      host: '0.0.0.0',
    });

    logger.info(`Server running on port ${config.PORT}`);
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
};

start();