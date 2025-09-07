import { DataImporter } from '../services/dataImporter';
import { logger } from '../utils/logger';
import { pool } from '../db';

async function main() {
  const startTime = Date.now();
  logger.info('🚀 Starting data import process...');
  
  try {
    // Test database connection
    await pool.query('SELECT 1');
    logger.info('✅ Database connected successfully');
    
    const importer = new DataImporter();
    
    // Test with a single file first
    if (process.argv[2] === '--test') {
      const path = require('path');
      const testFile = path.join(process.cwd(), '..', 'sources', 'pssa', 'school', '2023 pssa school level data.xlsx');
      logger.info(`📋 Test mode: Importing single file`);
      const result = await importer.importSingleFile(testFile);
      logger.info('Test import result:', result);
    } else {
      // Import all files
      await importer.importAllFiles();
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(`⏱️  Import completed in ${duration} seconds`);
    
  } catch (error) {
    logger.error('❌ Data import failed:', error);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();