import { db } from '../db';
import { pssaResults, keystoneResults } from '../db/newSchema';
import { sql, isNotNull } from 'drizzle-orm';

async function calculateProficientOrAbove() {
  console.log('🔧 Calculating proficient_or_above_percent from advanced + proficient...\n');

  // Update PSSA records
  console.log('📝 Updating PSSA records...');

  const pssaUpdated = db.run(sql`
    UPDATE pssa_results
    SET proficient_or_above_percent = ROUND(
      CAST(advanced_percent AS REAL) + CAST(proficient_percent AS REAL),
      1
    )
    WHERE advanced_percent IS NOT NULL
      AND proficient_percent IS NOT NULL
      AND (proficient_or_above_percent IS NULL
           OR proficient_or_above_percent != (advanced_percent + proficient_percent))
  `);

  console.log(`  ✅ Updated ${pssaUpdated.changes} PSSA records\n`);

  // Update Keystone records
  console.log('🔑 Updating Keystone records...');

  const keystoneUpdated = db.run(sql`
    UPDATE keystone_results
    SET proficient_or_above_percent = ROUND(
      CAST(advanced_percent AS REAL) + CAST(proficient_percent AS REAL),
      1
    )
    WHERE advanced_percent IS NOT NULL
      AND proficient_percent IS NOT NULL
      AND (proficient_or_above_percent IS NULL
           OR proficient_or_above_percent != (advanced_percent + proficient_percent))
  `);

  console.log(`  ✅ Updated ${keystoneUpdated.changes} Keystone records\n`);

  // Verify the updates
  const pssaVerify = await db
    .select({
      total: sql<number>`COUNT(*)`,
      hasValue: sql<number>`SUM(CASE WHEN proficient_or_above_percent IS NOT NULL THEN 1 ELSE 0 END)`,
      canCalculate: sql<number>`SUM(CASE WHEN advanced_percent IS NOT NULL AND proficient_percent IS NOT NULL THEN 1 ELSE 0 END)`
    })
    .from(pssaResults);

  const keystoneVerify = await db
    .select({
      total: sql<number>`COUNT(*)`,
      hasValue: sql<number>`SUM(CASE WHEN proficient_or_above_percent IS NOT NULL THEN 1 ELSE 0 END)`,
      canCalculate: sql<number>`SUM(CASE WHEN advanced_percent IS NOT NULL AND proficient_percent IS NOT NULL THEN 1 ELSE 0 END)`
    })
    .from(keystoneResults);

  console.log('📊 Verification:\n');
  console.log('  PSSA:');
  console.log(`    Total records: ${pssaVerify[0].total.toLocaleString()}`);
  console.log(`    Has proficient_or_above_percent: ${pssaVerify[0].hasValue.toLocaleString()} (${((pssaVerify[0].hasValue / pssaVerify[0].total) * 100).toFixed(1)}%)`);
  console.log(`    Can calculate from percentages: ${pssaVerify[0].canCalculate.toLocaleString()}\n`);

  console.log('  Keystone:');
  console.log(`    Total records: ${keystoneVerify[0].total.toLocaleString()}`);
  console.log(`    Has proficient_or_above_percent: ${keystoneVerify[0].hasValue.toLocaleString()} (${((keystoneVerify[0].hasValue / keystoneVerify[0].total) * 100).toFixed(1)}%)`);
  console.log(`    Can calculate from percentages: ${keystoneVerify[0].canCalculate.toLocaleString()}\n`);

  // Show some samples
  console.log('Sample calculated values:\n');
  const samples = await db
    .select({
      id: pssaResults.id,
      advancedPercent: pssaResults.advancedPercent,
      proficientPercent: pssaResults.proficientPercent,
      proficientOrAbovePercent: pssaResults.proficientOrAbovePercent
    })
    .from(pssaResults)
    .where(isNotNull(pssaResults.proficientOrAbovePercent))
    .limit(5);

  samples.forEach(s => {
    console.log(`  ID ${s.id}: ${s.advancedPercent}% + ${s.proficientPercent}% = ${s.proficientOrAbovePercent}%`);
  });

  console.log('\n✅ Calculation complete!');
  console.log('\n⚠️  Note: growth_score and growth_percentile cannot be filled');
  console.log('   These metrics come from the separate PVAAS system and are not in the source files.');
}

calculateProficientOrAbove().catch(console.error);
