import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler } from './utils/errorHandler';
import schoolRoutes from './routes/schools';
import districtRoutes from './routes/districts';
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

  await fastify.register(healthRoutes, { prefix: '/api/health' });
  await fastify.register(schoolRoutes, { prefix: '/api/schools' });
  await fastify.register(districtRoutes, { prefix: '/api/districts' });
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
