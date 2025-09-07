import { DataImporter } from '../services/dataImporter';
import { logger } from '../utils/logger';
import { db, pool } from '../db';

async function main() {
  logger.info('Starting data import process...');
  
  try {
    // Test database connection
    await pool.query('SELECT 1');
    logger.info('Database connected successfully');
    
    const importer = new DataImporter();
    await importer.importAllFiles();
    
    logger.info('Data import completed successfully');
  } catch (error) {
    logger.error('Data import failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();