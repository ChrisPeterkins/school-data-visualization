import { logger } from '../utils/logger';

async function main() {
  logger.info('Step 1: Starting...');

  logger.info('Step 2: About to import PVAASImporter');
  const { PVAASImporter } = await import('../services/pvaasImporter');

  logger.info('Step 3: Creating importer instance');
  const importer = new PVAASImporter();

  logger.info('Step 4: Done!');
}

main().catch(console.error);
