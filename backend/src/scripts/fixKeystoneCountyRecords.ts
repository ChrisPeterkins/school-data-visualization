import { db } from '../db';
import { keystoneResults } from '../db/newSchema';
import { eq, and, isNull, sql } from 'drizzle-orm';

async function fixKeystoneCountyRecords() {
  console.log('🔧 Fixing Keystone records that should be county-level...\n');

  // First, count the records that need fixing
  const countResult = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(keystoneResults)
    .where(
      and(
        eq(keystoneResults.level, 'school'),
        isNull(keystoneResults.schoolId),
        isNull(keystoneResults.districtId)
      )
    );

  console.log(`Found ${countResult[0].count} records with level='school' but no school_id or district_id\n`);

  if (countResult[0].count === 0) {
    console.log('No records to fix!');
    return;
  }

  // Update these records to be county-level
  console.log('Updating level from "school" to "county"...\n');

  const updated = db
    .update(keystoneResults)
    .set({ level: 'county' })
    .where(
      and(
        eq(keystoneResults.level, 'school'),
        isNull(keystoneResults.schoolId),
        isNull(keystoneResults.districtId)
      )
    )
    .run();

  console.log(`✅ Updated ${updated.changes} records from level='school' to level='county'\n`);

  // Verify the fix
  const verifySchool = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(keystoneResults)
    .where(
      and(
        eq(keystoneResults.level, 'school'),
        isNull(keystoneResults.schoolId)
      )
    );

  const verifyCounty = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(keystoneResults)
    .where(eq(keystoneResults.level, 'county'));

  console.log('Verification:');
  console.log(`  School-level records with NULL school_id: ${verifySchool[0].count}`);
  console.log(`  Total county-level records: ${verifyCounty[0].count}\n`);

  console.log('✅ Fix complete!');
}

fixKeystoneCountyRecords().catch(console.error);
