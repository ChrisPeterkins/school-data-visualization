import { DataImporterFixed } from './src/services/dataImporterFixed';
import { db } from './src/db';
import { sql } from 'drizzle-orm';
import { schools, districts, counties, pssaResults } from './src/db/newSchema';

async function testImport() {
  const importer = new DataImporterFixed();
  const testFile = '../sources/pssa/school/2015 pssa school level data.xlsx';

  console.log('Starting test import...');
  console.log('File:', testFile);

  try {
    const result = await importer.importFile(testFile);
    console.log('\n=== IMPORT RESULT ===');
    console.log('Success:', result.success);
    console.log('Records Processed:', result.recordsProcessed);
    console.log('Skipped:', result.skipped);
    console.log('Errors:', result.errors.length);
    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach(err => console.log(' -', err));
    }

    // Check database stats
    console.log('\n=== DATABASE STATS ===');

    const [countyCount] = await db.select({ count: sql<number>`count(*)` }).from(counties);
    console.log('Counties:', countyCount.count);

    const [districtCount] = await db.select({ count: sql<number>`count(*)` }).from(districts);
    console.log('Districts:', districtCount.count);

    const [schoolCount] = await db.select({ count: sql<number>`count(*)` }).from(schools);
    console.log('Schools:', schoolCount.count);

    const [pssaCount] = await db.select({ count: sql<number>`count(*)` }).from(pssaResults);
    console.log('PSSA Results:', pssaCount.count);

    // Check foreign key integrity
    console.log('\n=== FOREIGN KEY INTEGRITY ===');

    const [nullSchoolIds] = await db.select({
      count: sql<number>`count(*)`
    }).from(pssaResults).where(sql`school_id IS NULL`);
    console.log('PSSA results with NULL school_id:', nullSchoolIds.count);

    const [nullDistrictIds] = await db.select({
      count: sql<number>`count(*)`
    }).from(pssaResults).where(sql`district_id IS NULL`);
    console.log('PSSA results with NULL district_id:', nullDistrictIds.count);

    // Sample some records
    console.log('\n=== SAMPLE RECORDS ===');
    const sampleSchools = await db.select().from(schools).limit(3);
    console.log('Sample Schools:');
    sampleSchools.forEach(s => console.log(` - ${s.name} (${s.schoolNumber}) -> District ID: ${s.districtId}`));

    const sampleResults = await db.select().from(pssaResults).limit(3);
    console.log('\nSample PSSA Results:');
    sampleResults.forEach(r => console.log(` - School ID: ${r.schoolId}, District ID: ${r.districtId}, Subject: ${r.subject}, Year: ${r.year}`));

  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

testImport();
