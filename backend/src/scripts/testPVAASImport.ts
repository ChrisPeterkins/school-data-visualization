import { PVAASImporter } from '../services/pvaasImporter';
import { logger } from '../utils/logger';
import * as path from 'path';
import { db } from '../db';
import { pssaResults } from '../db/newSchema';
import { isNotNull } from 'drizzle-orm';

async function main() {
  logger.info('🧪 Testing PVAAS import with single file...\n');

  const importer = new PVAASImporter();
  const testFile = path.join(
    process.cwd(),
    '..',
    'sources',
    'pvaas',
    'school',
    '2024-school-level-state-va.xlsx'
  );

  // Run import
  try {
    logger.info(`Importing: ${testFile}\n`);
    const result = await importer.importPVAASFile(testFile, 'school');
    logger.info(`\n✅ Import result: ${result.updated} updated, ${result.skipped} skipped`);
  } catch (error) {
    logger.error('❌ Import failed:', error);
    throw error;
  }

  // Show sample records with growth data
  const samples = await db
    .select({
      id: pssaResults.id,
      year: pssaResults.year,
      subject: pssaResults.subject,
      grade: pssaResults.grade,
      growthScore: pssaResults.growthScore
    })
    .from(pssaResults)
    .where(isNotNull(pssaResults.growthScore))
    .limit(10);

  logger.info('\nSample records with growth scores:');
  samples.forEach(s => {
    logger.info(`  ID ${s.id}: ${s.year} Grade ${s.grade} ${s.subject} - Growth: ${s.growthScore}`);
  });
}

main().catch(console.error);
