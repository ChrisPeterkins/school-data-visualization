/**
 * PDE's 2016 Keystone district file only lists about 300 of 500 districts.
 * Rebuild the missing district rows by weighting that year's school rows by
 * students tested. Derived rows carry source_file = 'derived-from-schools'.
 *
 *   npx tsx src/scripts/deriveDistrictKeystone.ts [year=2016]
 */
import { sqliteDb } from '../db';
import { logger } from '../utils/logger';

const year = parseInt(process.argv[2] || '2016', 10);

const insert = sqliteDb.prepare(`
  INSERT OR IGNORE INTO keystone_results (
    level, school_id, district_id, county_id, year, subject, grade, demographic_group,
    total_tested, advanced_percent, proficient_percent, basic_percent, below_basic_percent,
    proficient_or_above_percent, source_file
  ) VALUES ('district', NULL, ?, ?, ?, ?, 11, ?, ?, ?, ?, ?, ?, ?, 'derived-from-schools')
`);

const rows = sqliteDb.prepare(`
  SELECT s.district_id AS districtId, d.county_id AS countyId, k.subject, k.demographic_group AS grp,
    SUM(k.total_tested) AS tested,
    ROUND(SUM(k.advanced_percent * k.total_tested) / SUM(CASE WHEN k.advanced_percent IS NOT NULL THEN k.total_tested END), 1) AS adv,
    ROUND(SUM(k.proficient_percent * k.total_tested) / SUM(CASE WHEN k.proficient_percent IS NOT NULL THEN k.total_tested END), 1) AS prof,
    ROUND(SUM(k.basic_percent * k.total_tested) / SUM(CASE WHEN k.basic_percent IS NOT NULL THEN k.total_tested END), 1) AS basic,
    ROUND(SUM(k.below_basic_percent * k.total_tested) / SUM(CASE WHEN k.below_basic_percent IS NOT NULL THEN k.total_tested END), 1) AS below,
    ROUND(SUM(k.proficient_or_above_percent * k.total_tested) / SUM(k.total_tested), 1) AS paa
  FROM keystone_results k
  JOIN schools s ON s.id = k.school_id
  JOIN districts d ON d.id = s.district_id
  WHERE k.level = 'school' AND k.year = ? AND k.proficient_or_above_percent IS NOT NULL AND k.total_tested > 0
    AND NOT EXISTS (
      SELECT 1 FROM keystone_results x
      WHERE x.level = 'district' AND x.year = k.year AND x.subject = k.subject
        AND x.demographic_group = k.demographic_group AND x.district_id = s.district_id
    )
  GROUP BY s.district_id, k.subject, k.demographic_group
`).all(year) as any[];

const txn = sqliteDb.transaction(() => {
  let n = 0;
  for (const r of rows) {
    n += insert.run(r.districtId, r.countyId, year, r.subject, r.grp, r.tested, r.adv, r.prof, r.basic, r.below, r.paa).changes;
  }
  return n;
});
const inserted = txn();
logger.info(`${year}: derived ${inserted} district Keystone rows from ${rows.length} school aggregates`);
