import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from './index';
import { logger } from '../utils/logger';

async function runMigrations() {
  logger.info('Running database migrations...');

  try {
    migrate(db, { migrationsFolder: './drizzle' });
    logger.info('Migrations completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();