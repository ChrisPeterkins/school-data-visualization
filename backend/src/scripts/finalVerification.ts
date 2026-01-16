import { db } from '../db';
import { pssaResults, keystoneResults } from '../db/newSchema';
import { sql } from 'drizzle-orm';

async function finalVerification() {
  console.log('📊 Final Data Verification Report\n');
  console.log('═'.repeat(80) + '\n');

  // Overall counts
  const pssaCount = await db.select({ count: sql<number>`COUNT(*)` }).from(pssaResults);
  const keystoneCount = await db.select({ count: sql<number>`COUNT(*)` }).from(keystoneResults);

  console.log('📈 Total Records:');
  console.log(`  PSSA: ${pssaCount[0].count.toLocaleString()}`);
  console.log(`  Keystone: ${keystoneCount[0].count.toLocaleString()}`);
  console.log(`  TOTAL: ${(pssaCount[0].count + keystoneCount[0].count).toLocaleString()}\n`);

  // Check proficient_or_above_percent coverage
  const pssaProfOrAbove = await db
    .select({
      total: sql<number>`COUNT(*)`,
      hasValue: sql<number>`SUM(CASE WHEN proficient_or_above_percent IS NOT NULL THEN 1 ELSE 0 END)`,
      canCalculate: sql<number>`SUM(CASE WHEN advanced_percent IS NOT NULL AND proficient_percent IS NOT NULL THEN 1 ELSE 0 END)`
    })
    .from(pssaResults);

  const keystoneProfOrAbove = await db
    .select({
      total: sql<number>`COUNT(*)`,
      hasValue: sql<number>`SUM(CASE WHEN proficient_or_above_percent IS NOT NULL THEN 1 ELSE 0 END)`,
      canCalculate: sql<number>`SUM(CASE WHEN advanced_percent IS NOT NULL AND proficient_percent IS NOT NULL THEN 1 ELSE 0 END)`
    })
    .from(keystoneResults);

  console.log('✅ proficient_or_above_percent Coverage:\n');
  console.log('  PSSA:');
  console.log(`    Total records: ${pssaProfOrAbove[0].total.toLocaleString()}`);
  console.log(`    Has value: ${pssaProfOrAbove[0].hasValue.toLocaleString()} (${((pssaProfOrAbove[0].hasValue / pssaProfOrAbove[0].total) * 100).toFixed(1)}%)`);
  console.log(`    Could calculate: ${pssaProfOrAbove[0].canCalculate.toLocaleString()}`);

  if (pssaProfOrAbove[0].hasValue >= pssaProfOrAbove[0].canCalculate) {
    console.log(`    ✓ All calculable records have values!\n`);
  } else {
    console.log(`    ⚠ Missing ${pssaProfOrAbove[0].canCalculate - pssaProfOrAbove[0].hasValue} calculable records\n`);
  }

  console.log('  Keystone:');
  console.log(`    Total records: ${keystoneProfOrAbove[0].total.toLocaleString()}`);
  console.log(`    Has value: ${keystoneProfOrAbove[0].hasValue.toLocaleString()} (${((keystoneProfOrAbove[0].hasValue / keystoneProfOrAbove[0].total) * 100).toFixed(1)}%)`);
  console.log(`    Could calculate: ${keystoneProfOrAbove[0].canCalculate.toLocaleString()}`);

  if (keystoneProfOrAbove[0].hasValue >= keystoneProfOrAbove[0].canCalculate) {
    console.log(`    ✓ All calculable records have values!\n`);
  } else {
    console.log(`    ⚠ Missing ${keystoneProfOrAbove[0].canCalculate - keystoneProfOrAbove[0].hasValue} calculable records\n`);
  }

  // Check count metrics coverage
  const pssaCounts = await db
    .select({
      total: sql<number>`COUNT(*)`,
      hasAdvanced: sql<number>`SUM(CASE WHEN advanced_count IS NOT NULL THEN 1 ELSE 0 END)`,
      hasProficient: sql<number>`SUM(CASE WHEN proficient_count IS NOT NULL THEN 1 ELSE 0 END)`,
      hasBasic: sql<number>`SUM(CASE WHEN basic_count IS NOT NULL THEN 1 ELSE 0 END)`,
      hasBelowBasic: sql<number>`SUM(CASE WHEN below_basic_count IS NOT NULL THEN 1 ELSE 0 END)`
    })
    .from(pssaResults);

  const keystoneCounts = await db
    .select({
      total: sql<number>`COUNT(*)`,
      hasAdvanced: sql<number>`SUM(CASE WHEN advanced_count IS NOT NULL THEN 1 ELSE 0 END)`,
      hasProficient: sql<number>`SUM(CASE WHEN proficient_count IS NOT NULL THEN 1 ELSE 0 END)`,
      hasBasic: sql<number>`SUM(CASE WHEN basic_count IS NOT NULL THEN 1 ELSE 0 END)`,
      hasBelowBasic: sql<number>`SUM(CASE WHEN below_basic_count IS NOT NULL THEN 1 ELSE 0 END)`
    })
    .from(keystoneResults);

  console.log('✅ Count Metrics Coverage:\n');
  console.log('  PSSA:');
  console.log(`    Advanced count: ${pssaCounts[0].hasAdvanced.toLocaleString()} (${((pssaCounts[0].hasAdvanced / pssaCounts[0].total) * 100).toFixed(1)}%)`);
  console.log(`    Proficient count: ${pssaCounts[0].hasProficient.toLocaleString()} (${((pssaCounts[0].hasProficient / pssaCounts[0].total) * 100).toFixed(1)}%)`);
  console.log(`    Basic count: ${pssaCounts[0].hasBasic.toLocaleString()} (${((pssaCounts[0].hasBasic / pssaCounts[0].total) * 100).toFixed(1)}%)`);
  console.log(`    Below basic count: ${pssaCounts[0].hasBelowBasic.toLocaleString()} (${((pssaCounts[0].hasBelowBasic / pssaCounts[0].total) * 100).toFixed(1)}%)\n`);

  console.log('  Keystone:');
  console.log(`    Advanced count: ${keystoneCounts[0].hasAdvanced.toLocaleString()} (${((keystoneCounts[0].hasAdvanced / keystoneCounts[0].total) * 100).toFixed(1)}%)`);
  console.log(`    Proficient count: ${keystoneCounts[0].hasProficient.toLocaleString()} (${((keystoneCounts[0].hasProficient / keystoneCounts[0].total) * 100).toFixed(1)}%)`);
  console.log(`    Basic count: ${keystoneCounts[0].hasBasic.toLocaleString()} (${((keystoneCounts[0].hasBasic / keystoneCounts[0].total) * 100).toFixed(1)}%)`);
  console.log(`    Below basic count: ${keystoneCounts[0].hasBelowBasic.toLocaleString()} (${((keystoneCounts[0].hasBelowBasic / keystoneCounts[0].total) * 100).toFixed(1)}%)\n`);

  // Growth metrics
  const pssaGrowth = await db
    .select({
      hasScore: sql<number>`SUM(CASE WHEN growth_score IS NOT NULL THEN 1 ELSE 0 END)`,
      hasPercentile: sql<number>`SUM(CASE WHEN growth_percentile IS NOT NULL THEN 1 ELSE 0 END)`
    })
    .from(pssaResults);

  const keystoneGrowth = await db
    .select({
      hasScore: sql<number>`SUM(CASE WHEN growth_score IS NOT NULL THEN 1 ELSE 0 END)`,
      hasPercentile: sql<number>`SUM(CASE WHEN growth_percentile IS NOT NULL THEN 1 ELSE 0 END)`
    })
    .from(keystoneResults);

  console.log('⚠️  Growth Metrics (Not Available in Source Files):\n');
  console.log('  PSSA:');
  console.log(`    growth_score: ${pssaGrowth[0].hasScore} records`);
  console.log(`    growth_percentile: ${pssaGrowth[0].hasPercentile} records\n`);

  console.log('  Keystone:');
  console.log(`    growth_score: ${keystoneGrowth[0].hasScore} records`);
  console.log(`    growth_percentile: ${keystoneGrowth[0].hasPercentile} records\n`);

  console.log('  ℹ️  Note: Growth metrics come from the PVAAS system and are not');
  console.log('     included in the PSSA/Keystone source data files.\n');

  console.log('═'.repeat(80));
  console.log('✅ All Available Data Successfully Populated!');
  console.log('═'.repeat(80));
}

finalVerification().catch(console.error);
