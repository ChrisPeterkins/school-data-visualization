import { db } from '../db';
import { schools, districts } from '../db/newSchema';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger';

async function main() {
  // Find Albert Gallatin district
  const district = await db.select().from(districts).where(eq(districts.aun, '101260303')).limit(1);

  if (district.length > 0) {
    logger.info(`Found district: ${district[0].name} (ID: ${district[0].id})`);

    // Get all schools in this district
    const districtSchools = await db.select().from(schools).where(eq(schools.districtId, district[0].id));
    logger.info(`\nSchools in this district: ${districtSchools.length}`);

    districtSchools.forEach(school => {
      logger.info(`  - School Number: ${school.schoolNumber}, Name: ${school.name}`);
    });
  }

  // Check total schools in database
  const totalSchools = await db.select({ count: schools.id }).from(schools);
  logger.info(`\nTotal schools in database: ${totalSchools.length}`);

  // Sample a few schools to see school number format
  const sampleSchools = await db.select().from(schools).limit(10);
  logger.info('\nSample schools:');
  sampleSchools.forEach(school => {
    logger.info(`  - AUN: (district ${school.districtId}), School #: ${school.schoolNumber}, Name: ${school.name}`);
  });
}

main().catch(console.error);
