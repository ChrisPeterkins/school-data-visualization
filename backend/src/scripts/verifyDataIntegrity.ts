import { db } from '../db';
import { pssaResults, keystoneResults, schools, districts, counties } from '../db/newSchema';
import { eq, and, isNull, isNotNull, sql } from 'drizzle-orm';

async function verifyDataIntegrity() {
  console.log('🔍 PA School Data Verification Report\n');
  console.log('═'.repeat(80) + '\n');

  // Overall counts
  const pssaCount = await db.select({ count: sql<number>`COUNT(*)` }).from(pssaResults);
  const keystoneCount = await db.select({ count: sql<number>`COUNT(*)` }).from(keystoneResults);
  const schoolCount = await db.select({ count: sql<number>`COUNT(*)` }).from(schools);
  const districtCount = await db.select({ count: sql<number>`COUNT(*)` }).from(districts);
  const countyCount = await db.select({ count: sql<number>`COUNT(*)` }).from(counties);

  console.log('📊 Overall Statistics:');
  console.log(`  PSSA Results: ${pssaCount[0].count.toLocaleString()}`);
  console.log(`  Keystone Results: ${keystoneCount[0].count.toLocaleString()}`);
  console.log(`  Schools: ${schoolCount[0].count.toLocaleString()}`);
  console.log(`  Districts: ${districtCount[0].count.toLocaleString()}`);
  console.log(`  Counties: ${countyCount[0].count.toLocaleString()}\n`);

  // PSSA Results Integrity
  console.log('📝 PSSA Results Data Integrity:\n');

  const pssaByLevel = await db
    .select({
      level: pssaResults.level,
      count: sql<number>`COUNT(*)`,
      nullSchools: sql<number>`SUM(CASE WHEN school_id IS NULL THEN 1 ELSE 0 END)`,
      nullDistricts: sql<number>`SUM(CASE WHEN district_id IS NULL THEN 1 ELSE 0 END)`,
      nullCounties: sql<number>`SUM(CASE WHEN county_id IS NULL THEN 1 ELSE 0 END)`
    })
    .from(pssaResults)
    .groupBy(pssaResults.level);

  pssaByLevel.forEach(row => {
    console.log(`  Level: ${row.level}`);
    console.log(`    Total records: ${row.count.toLocaleString()}`);
    console.log(`    NULL school_id: ${row.nullSchools} (${((row.nullSchools / row.count) * 100).toFixed(2)}%)`);
    console.log(`    NULL district_id: ${row.nullDistricts} (${((row.nullDistricts / row.count) * 100).toFixed(2)}%)`);
    console.log(`    NULL county_id: ${row.nullCounties} (${((row.nullCounties / row.count) * 100).toFixed(2)}%)\n`);
  });

  // Keystone Results Integrity
  console.log('🔑 Keystone Results Data Integrity:\n');

  const keystoneByLevel = await db
    .select({
      level: keystoneResults.level,
      count: sql<number>`COUNT(*)`,
      nullSchools: sql<number>`SUM(CASE WHEN school_id IS NULL THEN 1 ELSE 0 END)`,
      nullDistricts: sql<number>`SUM(CASE WHEN district_id IS NULL THEN 1 ELSE 0 END)`,
      nullCounties: sql<number>`SUM(CASE WHEN county_id IS NULL THEN 1 ELSE 0 END)`
    })
    .from(keystoneResults)
    .groupBy(keystoneResults.level);

  keystoneByLevel.forEach(row => {
    console.log(`  Level: ${row.level}`);
    console.log(`    Total records: ${row.count.toLocaleString()}`);
    console.log(`    NULL school_id: ${row.nullSchools} (${((row.nullSchools / row.count) * 100).toFixed(2)}%)`);
    console.log(`    NULL district_id: ${row.nullDistricts} (${((row.nullDistricts / row.count) * 100).toFixed(2)}%)`);
    console.log(`    NULL county_id: ${row.nullCounties} (${((row.nullCounties / row.count) * 100).toFixed(2)}%)\n`);
  });

  // Count metrics verification
  console.log('📈 Count Metrics Verification:\n');

  const pssaWithCounts = await db
    .select({
      withCounts: sql<number>`SUM(CASE WHEN advanced_count IS NOT NULL OR proficient_count IS NOT NULL THEN 1 ELSE 0 END)`,
      total: sql<number>`COUNT(*)`
    })
    .from(pssaResults);

  const keystoneWithCounts = await db
    .select({
      withCounts: sql<number>`SUM(CASE WHEN advanced_count IS NOT NULL OR proficient_count IS NOT NULL THEN 1 ELSE 0 END)`,
      total: sql<number>`COUNT(*)`
    })
    .from(keystoneResults);

  console.log(`  PSSA: ${pssaWithCounts[0].withCounts.toLocaleString()} / ${pssaWithCounts[0].total.toLocaleString()} have count metrics (${((pssaWithCounts[0].withCounts / pssaWithCounts[0].total) * 100).toFixed(1)}%)`);
  console.log(`  Keystone: ${keystoneWithCounts[0].withCounts.toLocaleString()} / ${keystoneWithCounts[0].total.toLocaleString()} have count metrics (${((keystoneWithCounts[0].withCounts / keystoneWithCounts[0].total) * 100).toFixed(1)}%)\n`);

  // Year distribution
  console.log('📅 Year Distribution:\n');

  const pssaYears = await db
    .select({
      year: pssaResults.year,
      count: sql<number>`COUNT(*)`
    })
    .from(pssaResults)
    .groupBy(pssaResults.year)
    .orderBy(pssaResults.year);

  console.log('  PSSA:');
  pssaYears.forEach(row => {
    console.log(`    ${row.year}: ${row.count.toLocaleString()} records`);
  });

  const keystoneYears = await db
    .select({
      year: keystoneResults.year,
      count: sql<number>`COUNT(*)`
    })
    .from(keystoneResults)
    .groupBy(keystoneResults.year)
    .orderBy(keystoneResults.year);

  console.log('\n  Keystone:');
  keystoneYears.forEach(row => {
    console.log(`    ${row.year}: ${row.count.toLocaleString()} records`);
  });

  console.log('\n' + '═'.repeat(80));
  console.log('✅ Verification Complete!');
}

verifyDataIntegrity().catch(console.error);
