import { PVAASImporter } from '../services/pvaasImporter';
import { logger } from '../utils/logger';

async function main() {
  logger.info('🚀 Starting PVAAS import...\n');

  const importer = new PVAASImporter();

  try {
    await importer.importAllPVAASFiles();
    logger.info('\n✅ PVAAS import completed successfully!');
  } catch (error) {
    logger.error('❌ PVAAS import failed:', error);
    throw error;
  }
}

main().catch(console.error);
