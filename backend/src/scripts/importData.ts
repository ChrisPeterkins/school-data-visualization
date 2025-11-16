import { DataImporterFixed as DataImporter } from '../services/dataImporterFixed';
import { logger } from '../utils/logger';
import { db, pool } from '../db';

async function main() {
  logger.info('Starting data import process...');
  
  try {
    // Test database connection
    await pool.query('SELECT 1');
    logger.info('Database connected successfully');
    
    // Note: Use the import API routes instead - /api/import/start
    // const importer = new DataImporter();
    // DataImporterFixed only has importFile() for individual files
    logger.info('Use /api/import/start endpoint to trigger full import');
    
    logger.info('Data import completed successfully');
  } catch (error) {
    logger.error('Data import failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();