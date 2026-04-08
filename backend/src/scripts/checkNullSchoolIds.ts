import { db } from '../db';
import { keystoneResults, counties } from '../db/newSchema';
import { eq, and, isNull, sql } from 'drizzle-orm';

async function checkNullSchoolIds() {
  console.log('🔍 Checking NULL school_id in keystone_results...\n');

  // Count total NULL school_ids
  const nullCount = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(keystoneResults)
    .where(
      and(
        eq(keystoneResults.level, 'school'),
        isNull(keystoneResults.schoolId)
      )
    );

  console.log(`Total NULL school_ids at school level: ${nullCount[0].count}\n`);

  // Check what county 71 is
  const county = await db
    .select()
    .from(counties)
    .where(eq(counties.id, 71));

  if (county.length > 0) {
    console.log(`County 71: ${county[0].name}\n`);
  }

  // Get unique combinations of what these records have
  const summary = await db
    .select({
      countyId: keystoneResults.countyId,
      countyName: counties.name,
      count: sql<number>`COUNT(*)`,
      years: sql<string>`GROUP_CONCAT(DISTINCT ${keystoneResults.year})`,
      subjects: sql<string>`GROUP_CONCAT(DISTINCT ${keystoneResults.subject})`
    })
    .from(keystoneResults)
    .leftJoin(counties, eq(counties.id, keystoneResults.countyId))
    .where(
      and(
        eq(keystoneResults.level, 'school'),
        isNull(keystoneResults.schoolId),
        isNull(keystoneResults.districtId)
      )
    )
    .groupBy(keystoneResults.countyId);

  console.log('Summary of NULL records by county:\n');
  summary.forEach(s => {
    console.log(`  County ${s.countyId} (${s.countyName}): ${s.count} records`);
    console.log(`    Years: ${s.years}`);
    console.log(`    Subjects: ${s.subjects}\n`);
  });

  // Check if level should have been 'county' instead of 'school'
  console.log('\nThese records have:');
  console.log('  - level = "school"');
  console.log('  - school_id = NULL');
  console.log('  - district_id = NULL');
  console.log('  - county_id = NOT NULL');
  console.log('\nThis suggests they should probably be level="county" instead of level="school"\n');

  // Let's verify this by checking the actual data
  const samples = await db
    .select({
      id: keystoneResults.id,
      level: keystoneResults.level,
      year: keystoneResults.year,
      subject: keystoneResults.subject,
      demographicGroup: keystoneResults.demographicGroup,
      totalTested: keystoneResults.totalTested,
      advancedPercent: keystoneResults.advancedPercent,
      proficientPercent: keystoneResults.proficientPercent
    })
    .from(keystoneResults)
    .where(
      and(
        eq(keystoneResults.level, 'school'),
        isNull(keystoneResults.schoolId),
        isNull(keystoneResults.districtId)
      )
    )
    .limit(5);

  console.log('Sample records:\n');
  samples.forEach(r => {
    console.log(`  ID ${r.id}: ${r.year} ${r.subject} - ${r.demographicGroup}`);
    console.log(`    Tested: ${r.totalTested}, Advanced: ${r.advancedPercent}%, Proficient: ${r.proficientPercent}%\n`);
  });
}

checkNullSchoolIds().catch(console.error);
