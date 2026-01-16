import { db } from '../db';
import { pssaResults, schools, districts } from '../db/newSchema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../utils/logger';

async function main() {
  // Check if we have any 2024 PSSA records
  const records2024 = await db.select().from(pssaResults).where(eq(pssaResults.year, 2024)).limit(5);
  logger.info(`Sample 2024 PSSA records: ${records2024.length}`);
  if (records2024.length > 0) {
    logger.info('First record:', records2024[0]);
  }

  // Check for school 2129 in Albert Gallatin district (AUN 101260303)
  const district = await db.select().from(districts).where(eq(districts.aun, '101260303')).limit(1);
  logger.info(`\nDistrict AUN 101260303: ${district.length > 0 ? JSON.stringify(district[0]) : 'Not found'}`);

  if (district.length > 0) {
    const school = await db.select().from(schools).where(and(
      eq(schools.districtId, district[0].id),
      eq(schools.schoolNumber, '2129')
    )).limit(1);
    logger.info(`School 2129: ${school.length > 0 ? JSON.stringify(school[0]) : 'Not found'}`);

    if (school.length > 0) {
      const pssaForSchool = await db.select().from(pssaResults).where(and(
        eq(pssaResults.schoolId, school[0].id),
        eq(pssaResults.year, 2024),
        eq(pssaResults.subject, 'English Language Arts')
      )).limit(5);
      logger.info(`\nPSSA records for this school in 2024 ELA: ${pssaForSchool.length}`);
      if (pssaForSchool.length > 0) {
        logger.info('Sample:', pssaForSchool[0]);
      }
    }
  }

  // Check what years we actually have
  const years = await db.select({ year: pssaResults.year }).from(pssaResults).groupBy(pssaResults.year).orderBy(pssaResults.year);
  logger.info('\nYears in PSSA database:', years.map(y => y.year));
}

main().catch(console.error);
