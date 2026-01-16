import { db } from '../db';
import { pssaResults, keystoneResults } from '../db/newSchema';
import { sql, isNotNull, isNull, and } from 'drizzle-orm';

async function checkMissingColumns() {
  console.log('🔍 Checking proficientOrAbove and growth columns...\n');

  // Check PSSA proficientOrAbove
  const pssaProfOrAbove = await db
    .select({
      total: sql<number>`COUNT(*)`,
      hasValue: sql<number>`SUM(CASE WHEN proficient_or_above_percent IS NOT NULL THEN 1 ELSE 0 END)`,
      hasPercentages: sql<number>`SUM(CASE WHEN advanced_percent IS NOT NULL AND proficient_percent IS NOT NULL THEN 1 ELSE 0 END)`
    })
    .from(pssaResults);

  console.log('📝 PSSA proficient_or_above_percent:');
  console.log(`  Total records: ${pssaProfOrAbove[0].total.toLocaleString()}`);
  console.log(`  Has value: ${pssaProfOrAbove[0].hasValue.toLocaleString()} (${((pssaProfOrAbove[0].hasValue / pssaProfOrAbove[0].total) * 100).toFixed(1)}%)`);
  console.log(`  Missing: ${(pssaProfOrAbove[0].total - pssaProfOrAbove[0].hasValue).toLocaleString()}`);
  console.log(`  Has advanced + proficient percentages: ${pssaProfOrAbove[0].hasPercentages.toLocaleString()}\n`);

  // Check Keystone proficientOrAbove
  const keystoneProfOrAbove = await db
    .select({
      total: sql<number>`COUNT(*)`,
      hasValue: sql<number>`SUM(CASE WHEN proficient_or_above_percent IS NOT NULL THEN 1 ELSE 0 END)`,
      hasPercentages: sql<number>`SUM(CASE WHEN advanced_percent IS NOT NULL AND proficient_percent IS NOT NULL THEN 1 ELSE 0 END)`
    })
    .from(keystoneResults);

  console.log('🔑 Keystone proficient_or_above_percent:');
  console.log(`  Total records: ${keystoneProfOrAbove[0].total.toLocaleString()}`);
  console.log(`  Has value: ${keystoneProfOrAbove[0].hasValue.toLocaleString()} (${((keystoneProfOrAbove[0].hasValue / keystoneProfOrAbove[0].total) * 100).toFixed(1)}%)`);
  console.log(`  Missing: ${(keystoneProfOrAbove[0].total - keystoneProfOrAbove[0].hasValue).toLocaleString()}`);
  console.log(`  Has advanced + proficient percentages: ${keystoneProfOrAbove[0].hasPercentages.toLocaleString()}\n`);

  // Check PSSA growth metrics
  const pssaGrowth = await db
    .select({
      total: sql<number>`COUNT(*)`,
      hasScore: sql<number>`SUM(CASE WHEN growth_score IS NOT NULL THEN 1 ELSE 0 END)`,
      hasPercentile: sql<number>`SUM(CASE WHEN growth_percentile IS NOT NULL THEN 1 ELSE 0 END)`
    })
    .from(pssaResults);

  console.log('📝 PSSA growth metrics:');
  console.log(`  Total records: ${pssaGrowth[0].total.toLocaleString()}`);
  console.log(`  Has growth_score: ${pssaGrowth[0].hasScore.toLocaleString()}`);
  console.log(`  Has growth_percentile: ${pssaGrowth[0].hasPercentile.toLocaleString()}\n`);

  // Check Keystone growth metrics
  const keystoneGrowth = await db
    .select({
      total: sql<number>`COUNT(*)`,
      hasScore: sql<number>`SUM(CASE WHEN growth_score IS NOT NULL THEN 1 ELSE 0 END)`,
      hasPercentile: sql<number>`SUM(CASE WHEN growth_percentile IS NOT NULL THEN 1 ELSE 0 END)`
    })
    .from(keystoneResults);

  console.log('🔑 Keystone growth metrics:');
  console.log(`  Total records: ${keystoneGrowth[0].total.toLocaleString()}`);
  console.log(`  Has growth_score: ${keystoneGrowth[0].hasScore.toLocaleString()}`);
  console.log(`  Has growth_percentile: ${keystoneGrowth[0].hasPercentile.toLocaleString()}\n`);

  // Sample records to see what we have
  console.log('Sample PSSA records:\n');
  const pssaSamples = await db
    .select({
      id: pssaResults.id,
      year: pssaResults.year,
      advancedPercent: pssaResults.advancedPercent,
      proficientPercent: pssaResults.proficientPercent,
      proficientOrAbovePercent: pssaResults.proficientOrAbovePercent,
      sourceFile: pssaResults.sourceFile
    })
    .from(pssaResults)
    .where(isNotNull(pssaResults.advancedPercent))
    .limit(5);

  pssaSamples.forEach(r => {
    const calculated = r.advancedPercent && r.proficientPercent
      ? (r.advancedPercent + r.proficientPercent).toFixed(1)
      : 'N/A';
    console.log(`  ID ${r.id} (${r.year}): Advanced=${r.advancedPercent}%, Proficient=${r.proficientPercent}%`);
    console.log(`    ProfOrAbove in DB=${r.proficientOrAbovePercent}%, Calculated=${calculated}%`);
    console.log(`    File: ${r.sourceFile}\n`);
  });

  console.log('\n📊 Summary:');
  console.log('  ✓ proficient_or_above_percent can be calculated as: advanced_percent + proficient_percent');
  console.log('  ✗ growth_score and growth_percentile are NOT in source files (from separate PVAAS system)');
}

checkMissingColumns().catch(console.error);
