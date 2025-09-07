import { SchoolProcessor } from '../services/schoolProcessor';
import { logger } from '../utils/logger';
import { pool } from '../db';

async function main() {
  logger.info('Starting school data processing...');
  
  try {
    // Test database connection
    await pool.query('SELECT 1');
    logger.info('Database connected successfully');
    
    const processor = new SchoolProcessor();
    await processor.processSchoolsFromData();
    
    logger.info('School processing completed successfully');
  } catch (error) {
    logger.error('School processing failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();