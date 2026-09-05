/**
 * Fill school and district directory fields (address, city, zip, coordinates,
 * enrollment, grade span, level-based type, charter flag) from the NCES Common
 * Core of Data via the Urban Institute Education Data API. PDE's assessment
 * files carry none of this.
 *
 *   npx tsx src/scripts/importSchoolMetadata.ts [--dry-run] [--year 2023]
 *
 * Schools match on district AUN + state school number (CCD `seasch`), falling
 * back to AUN + normalized name. Districts match on AUN (`state_leaid`).
 */
import { sqliteDb } from '../db';
import { logger } from '../utils/logger';

const API = 'https://educationdata.urban.org/api/v1';
const dryRun = process.argv.includes('--dry-run');
const yearArg = process.argv.indexOf('--year');
const ccdYear = yearArg > -1 ? process.argv[yearArg + 1] : '2023';

interface CcdSchool {
  seasch: string | null; school_name: string; state_leaid: string | null;
  street_location: string | null; city_location: string | null; zip_location: string | null;
  latitude: number | null; longitude: number | null; enrollment: number | null;
  school_level: number | null; charter: number | null; school_status: number | null;
  lowest_grade_offered: number | null; highest_grade_offered: number | null;
}
interface CcdDistrict {
  leaid: string | null; state_leaid: string | null; lea_name: string; enrollment: number | null;
  city_location: string | null; street_location?: string | null; zip_location?: string | null;
}

async function fetchAll<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  let url: string | null = `${API}/${path}?fips=42&per_page=5000`;
  while (url) {
    // The API returns 403 to Node's default User-Agent; identify ourselves like a browser client.
    const res = await fetch(url, { headers: { 'User-Agent': 'paschools-metadata-import/1.0 (+https://chrispeterkins.com/paschools)', Accept: 'application/json' } });
    if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
    const body = await res.json() as { results: T[]; next: string | null };
    out.push(...body.results);
    url = body.next;
  }
  return out;
}

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const aunOf = (stateLeaid: string | null) => (stateLeaid || '').replace(/^PA-/, '');
// CCD `seasch` is "AUN-number" (e.g. 112011103-7302); PDE stores the number zero-padded to 9.
const numKey = (s: string | null) => {
  if (!s) return '';
  const part = s.includes('-') ? s.split('-').pop()! : s;
  const n = parseInt(part, 10);
  return Number.isFinite(n) ? String(n) : '';
};
const gradeLabel = (g: number | null) => (g == null ? null : g === -1 ? 'PK' : g === 0 ? 'K' : String(g));
const levelType = (level: number | null) => ({ 1: 'Elementary', 2: 'Middle', 3: 'High' } as Record<number, string>)[level ?? 0] ?? null;

async function main() {
  logger.info(`Fetching CCD ${ccdYear} directory for Pennsylvania...`);
  const [ccdSchools, ccdDistricts] = await Promise.all([
    fetchAll<CcdSchool>(`schools/ccd/directory/${ccdYear}`),
    fetchAll<CcdDistrict>(`school-districts/ccd/directory/${ccdYear}`),
  ]);
  logger.info(`CCD: ${ccdSchools.length} schools, ${ccdDistricts.length} districts`);

  const byAunAndNumber = new Map<string, CcdSchool>();
  const byAunAndName = new Map<string, CcdSchool>();
  for (const s of ccdSchools) {
    const aun = aunOf(s.state_leaid);
    if (!aun) continue;
    if (s.seasch) byAunAndNumber.set(`${aun}|${numKey(s.seasch)}`, s);
    byAunAndName.set(`${aun}|${norm(s.school_name)}`, s);
  }
  const districtByAun = new Map<string, CcdDistrict>();
  for (const d of ccdDistricts) {
    const aun = aunOf(d.state_leaid);
    if (aun) districtByAun.set(aun, d);
  }

  const schools = sqliteDb.prepare(`
    SELECT s.id, s.school_number, s.name, s.school_type, d.aun
    FROM schools s JOIN districts d ON d.id = s.district_id
  `).all() as Array<{ id: number; school_number: string; name: string; school_type: string | null; aun: string }>;

  const updateSchool = sqliteDb.prepare(`
    UPDATE schools SET
      address = COALESCE(?, address), city = COALESCE(?, city), zip_code = COALESCE(?, zip_code),
      latitude = COALESCE(?, latitude), longitude = COALESCE(?, longitude),
      enrollment = COALESCE(?, enrollment), grade_range = COALESCE(?, grade_range),
      is_charter = COALESCE(?, is_charter), school_type = COALESCE(?, school_type),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  let byNumber = 0, byName = 0, unmatched = 0, retyped = 0;
  const unmatchedSamples: string[] = [];
  const txn = sqliteDb.transaction(() => {
    for (const s of schools) {
      let ccd = byAunAndNumber.get(`${s.aun}|${numKey(s.school_number)}`);
      if (ccd) byNumber++;
      else {
        ccd = byAunAndName.get(`${s.aun}|${norm(s.name)}`);
        if (ccd) byName++;
      }
      if (!ccd) {
        unmatched++;
        if (unmatchedSamples.length < 8) unmatchedSamples.push(`${s.name} (${s.aun}/${s.school_number})`);
        continue;
      }
      // Only replace a type we guessed from the name; keep explicit ones like Charter or Career/Technical.
      const newType = (!s.school_type || s.school_type === 'Other') ? levelType(ccd.school_level) : null;
      if (newType) retyped++;
      const span = ccd.lowest_grade_offered != null && ccd.highest_grade_offered != null
        ? `${gradeLabel(ccd.lowest_grade_offered)}-${gradeLabel(ccd.highest_grade_offered)}` : null;
      if (!dryRun) {
        updateSchool.run(
          ccd.street_location, ccd.city_location, ccd.zip_location,
          ccd.latitude, ccd.longitude, ccd.enrollment != null && ccd.enrollment >= 0 ? ccd.enrollment : null,
          span, ccd.charter == null ? null : (ccd.charter ? 1 : 0), newType, s.id,
        );
      }
    }
  });
  txn();
  logger.info(`Schools: ${byNumber} matched by number, ${byName} by name, ${unmatched} unmatched, ${retyped} types set from CCD level${dryRun ? ' (dry run)' : ''}`);

  // A school missing from the directory with no results in the latest year is closed.
  if (!dryRun) {
    const latest = (sqliteDb.prepare(`SELECT MAX(year) AS y FROM pssa_results`).get() as any)?.y ?? 0;
    const closed = sqliteDb.prepare(`
      UPDATE schools SET is_active = 0 WHERE id IN (
        SELECT s.id FROM schools s
        WHERE s.latitude IS NULL
          AND NOT EXISTS (SELECT 1 FROM pssa_results p WHERE p.school_id = s.id AND p.year = ?)
          AND NOT EXISTS (SELECT 1 FROM keystone_results k WHERE k.school_id = s.id AND k.year = ?)
      )
    `).run(latest, latest);
    const reopened = sqliteDb.prepare(`
      UPDATE schools SET is_active = 1 WHERE is_active = 0 AND (latitude IS NOT NULL
        OR EXISTS (SELECT 1 FROM pssa_results p WHERE p.school_id = schools.id AND p.year = ?)
        OR EXISTS (SELECT 1 FROM keystone_results k WHERE k.school_id = schools.id AND k.year = ?))
    `).run(latest, latest);
    logger.info(`Closed schools: ${closed.changes} marked inactive, ${reopened.changes} reactivated`);
  }
  if (unmatchedSamples.length) logger.info(`  unmatched examples: ${unmatchedSamples.join('; ')}`);

  const districts = sqliteDb.prepare(`SELECT id, aun, name FROM districts`).all() as Array<{ id: number; aun: string; name: string }>;
  const updateDistrict = sqliteDb.prepare(`
    UPDATE districts SET total_enrollment = COALESCE(?, total_enrollment), city = COALESCE(?, city),
      address = COALESCE(?, address), zip_code = COALESCE(?, zip_code), nces_id = COALESCE(?, nces_id),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  let dMatched = 0;
  const dTxn = sqliteDb.transaction(() => {
    for (const d of districts) {
      const ccd = districtByAun.get(d.aun);
      if (!ccd) continue;
      dMatched++;
      if (!dryRun) {
        updateDistrict.run(
          ccd.enrollment != null && ccd.enrollment >= 0 ? ccd.enrollment : null,
          ccd.city_location, ccd.street_location ?? null, ccd.zip_location ?? null, ccd.leaid ?? null, d.id,
        );
      }
    }
  });
  dTxn();
  logger.info(`Districts: ${dMatched} of ${districts.length} matched by AUN${dryRun ? ' (dry run)' : ''}`);
}

main().catch(err => { console.error('metadata import failed:', err); process.exit(1); });
