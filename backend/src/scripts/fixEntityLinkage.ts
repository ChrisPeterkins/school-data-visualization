/**
 * Fix Entity Linkage Script
 *
 * Re-reads source Excel files for broken years and updates existing DB records
 * with the correct school_id, district_id, and county_id.
 *
 * Root cause: Column name mismatches in import configs:
 * - PSSA school 2016-2023 (not 2021): aunColumn was 'District AUN' but Excel has 'AUN'
 * - PSSA school 2015: districtColumn was 'District Name' but Excel has 'District'; schoolColumn was 'School Name' but Excel has 'School'
 * - PSSA district 2016-2023: aunColumn was 'District AUN' but Excel has 'AUN'; 2015 headerRow was wrong
 * - Keystone school 2016: districtColumn was 'District Name' but Excel has 'District'; schoolColumn was 'School Name' but Excel has 'School'
 */

import * as XLSX from 'xlsx';
import Database from 'better-sqlite3';
import * as path from 'path';

const dbPath = path.join(process.cwd(), 'school-data.db');
const sourcePath = path.join(process.cwd(), '..', 'sources');
const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('synchronous = NORMAL');

// Caches
const countyCache = new Map<string, number>();
const districtCache = new Map<string, number>();
const schoolCache = new Map<string, number>();

// Pre-load caches from DB
function loadCaches() {
  const countiesRows = sqlite.prepare('SELECT id, name FROM counties').all() as any[];
  for (const c of countiesRows) {
    countyCache.set(c.name.toLowerCase().trim(), c.id);
  }
  console.log(`Loaded ${countyCache.size} counties`);

  const districtRows = sqlite.prepare('SELECT id, aun, county_id FROM districts').all() as any[];
  for (const d of districtRows) {
    districtCache.set(String(d.aun), d.id);
  }
  console.log(`Loaded ${districtCache.size} districts`);

  const schoolRows = sqlite.prepare('SELECT id, school_number, district_id FROM schools').all() as any[];
  for (const s of schoolRows) {
    schoolCache.set(`${s.district_id}-${s.school_number}`, s.id);
  }
  console.log(`Loaded ${schoolCache.size} schools`);
}

function lookupCounty(name: string): number | null {
  if (!name) return null;
  const clean = name.replace(/\s+County$/i, '').toLowerCase().trim();
  return countyCache.get(clean) ?? null;
}

function lookupDistrict(aun: string): number | null {
  if (!aun) return null;
  return districtCache.get(String(aun)) ?? null;
}

function lookupSchool(schoolNumber: string, districtId: number): number | null {
  if (!schoolNumber || !districtId) return null;
  const padded = String(schoolNumber).padStart(9, '0');
  return schoolCache.get(`${districtId}-${padded}`) ?? schoolCache.get(`${districtId}-${schoolNumber}`) ?? null;
}

function ensureCounty(name: string): number | null {
  const id = lookupCounty(name);
  if (id) return id;
  if (!name) return null;

  const clean = name.replace(/\s+County$/i, '').trim();
  const key = clean.toLowerCase();

  // Create it
  const result = sqlite.prepare(
    'INSERT INTO counties (county_code, name, full_name) VALUES (?, ?, ?) RETURNING id'
  ).get(`9${String(countyCache.size + 100).padStart(2, '0')}`, clean, `${clean} County`) as any;

  if (result) {
    countyCache.set(key, result.id);
    return result.id;
  }
  return null;
}

function ensureDistrict(districtName: string, aun: string, countyId: number | null): number | null {
  if (!aun) return null;
  const id = lookupDistrict(aun);
  if (id) return id;
  if (!districtName) return null;

  // Create it
  const result = sqlite.prepare(
    'INSERT INTO districts (aun, name, county_id) VALUES (?, ?, ?) RETURNING id'
  ).get(String(aun), districtName, countyId ?? 1) as any;

  if (result) {
    districtCache.set(String(aun), result.id);
    return result.id;
  }
  return null;
}

function ensureSchool(schoolName: string, schoolNumber: string, districtId: number): number | null {
  if (!schoolNumber || !districtId) return null;
  const padded = String(schoolNumber).padStart(9, '0');
  const id = lookupSchool(padded, districtId);
  if (id) return id;
  if (!schoolName) return null;

  // Create it
  const result = sqlite.prepare(
    'INSERT INTO schools (school_number, district_id, name) VALUES (?, ?, ?) RETURNING id'
  ).get(padded, districtId, schoolName) as any;

  if (result) {
    schoolCache.set(`${districtId}-${padded}`, result.id);
    return result.id;
  }
  return null;
}

// Correct column mappings for each broken file
interface FixConfig {
  sourceFile: string;           // source_file value in DB
  excelPath: string;            // path to Excel file
  headerRow: number;
  table: 'pssa_results' | 'keystone_results';
  level: 'school' | 'district';
  aunCol: string;               // correct AUN column name
  countyCol: string;            // correct County column name
  districtCol: string;          // correct District column name
  schoolCol?: string;           // correct School column name (school-level only)
  schoolNumCol?: string;        // correct School Number column name (school-level only)
}

const fixes: FixConfig[] = [
  // PSSA School-Level
  {
    sourceFile: '2015 pssa school level data.xlsx',
    excelPath: 'pssa/school/2015 pssa school level data.xlsx',
    headerRow: 6, table: 'pssa_results', level: 'school',
    aunCol: 'AUN', countyCol: 'County', districtCol: 'District', schoolCol: 'School', schoolNumCol: 'School Number'
  },
  ...[2016, 2017, 2018, 2019, 2022, 2023].map(year => ({
    sourceFile: `${year} pssa school level data.xlsx`,
    excelPath: `pssa/school/${year} pssa school level data.xlsx`,
    headerRow: 4, table: 'pssa_results' as const, level: 'school' as const,
    aunCol: 'AUN', countyCol: 'County', districtCol: 'District Name', schoolCol: 'School Name', schoolNumCol: 'School Number'
  })),

  // PSSA District-Level
  {
    sourceFile: '2015 pssa district data.xlsx',
    excelPath: 'pssa/district/2015 pssa district data.xlsx',
    headerRow: 4, table: 'pssa_results', level: 'district',
    aunCol: 'AUN', countyCol: 'County', districtCol: 'District Name'
  },
  ...[2016, 2017, 2018, 2019, 2021, 2022].map(year => ({
    sourceFile: `${year} pssa district data.xlsx`,
    excelPath: `pssa/district/${year} pssa district data.xlsx`,
    headerRow: 4, table: 'pssa_results' as const, level: 'district' as const,
    aunCol: 'AUN', countyCol: 'County', districtCol: 'District Name'
  })),
  {
    sourceFile: '2023 pssa district level data.xlsx',
    excelPath: 'pssa/district/2023 pssa district level data.xlsx',
    headerRow: 4, table: 'pssa_results', level: 'district',
    aunCol: 'AUN', countyCol: 'County', districtCol: 'District Name'
  },

  // Keystone School-Level 2016
  {
    sourceFile: '2016 keystone exams school level data.xlsx',
    excelPath: 'keystone/school/2016 keystone exams school level data.xlsx',
    headerRow: 4, table: 'keystone_results', level: 'school',
    aunCol: 'AUN', countyCol: 'County', districtCol: 'District', schoolCol: 'School', schoolNumCol: 'School Number'
  }
];

// Prepared statements for batch updates
const updatePssaSchool = sqlite.prepare(
  'UPDATE pssa_results SET school_id = ?, district_id = ?, county_id = ? WHERE id = ?'
);
const updatePssaDistrict = sqlite.prepare(
  'UPDATE pssa_results SET district_id = ?, county_id = ? WHERE id = ?'
);
const updateKeystoneSchool = sqlite.prepare(
  'UPDATE keystone_results SET school_id = ?, district_id = ?, county_id = ? WHERE id = ?'
);

function normalizeSubject(raw: any): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  // Normalize common variants
  if (/english/i.test(s)) return 'English Language Arts';
  if (/math/i.test(s)) return 'Mathematics';
  if (/science/i.test(s)) return 'Science';
  if (/algebra/i.test(s)) return 'Algebra I';
  if (/biology/i.test(s)) return 'Biology';
  if (/literature/i.test(s)) return 'Literature';
  return s;
}

function parseGrade(raw: any): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const s = String(raw).trim();
  if (s.toLowerCase() === 'total' || s.toLowerCase() === 'all') return null;
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

function normalizeDemographic(raw: any): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  // Match the normalization done by the original importer
  const mapping: Record<string, string> = {
    'all students': 'All Students',
    'male': 'Male',
    'female': 'Female',
    'white': 'White',
    'black or african american': 'Black/African American',
    'black': 'Black/African American',
    'african american': 'Black/African American',
    'hispanic or latino': 'Hispanic/Latino',
    'hispanic': 'Hispanic/Latino',
    'latino': 'Hispanic/Latino',
    'asian': 'Asian',
    'american indian/alaskan native': 'American Indian/Alaskan Native',
    'american indian or alaskan native': 'American Indian/Alaskan Native',
    'native hawaiian or other pacific islander': 'Pacific Islander',
    'pacific islander': 'Pacific Islander',
    'two or more races': 'Two or More Races',
    'multiracial': 'Two or More Races',
    'iep': 'IEP',
    'economically disadvantaged': 'Economically Disadvantaged',
    'english learner': 'English Learners',
    'english learners': 'English Learners',
    'el': 'English Learners',
    'historically underperforming': 'Historically Underperforming',
  };
  return mapping[s.toLowerCase()] ?? s;
}

async function processFile(fix: FixConfig) {
  const fullPath = path.join(sourcePath, fix.excelPath);
  console.log(`\nProcessing: ${fix.sourceFile}`);

  // Read Excel
  const workbook = XLSX.readFile(fullPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as any[][];

  // Build column map from headers
  const headers = data[fix.headerRow] || [];
  const colMap = new Map<string, number>();
  headers.forEach((h: any, i: number) => {
    if (h) colMap.set(String(h).trim(), i);
  });

  console.log(`  Headers at row ${fix.headerRow}: ${[...colMap.keys()].join(', ')}`);

  const aunIdx = colMap.get(fix.aunCol);
  const countyIdx = colMap.get(fix.countyCol);
  const districtIdx = colMap.get(fix.districtCol);
  const schoolIdx = fix.schoolCol ? colMap.get(fix.schoolCol) : undefined;
  const schoolNumIdx = fix.schoolNumCol ? colMap.get(fix.schoolNumCol) : undefined;

  if (aunIdx === undefined) {
    console.log(`  ERROR: AUN column '${fix.aunCol}' not found! Available: ${[...colMap.keys()].join(', ')}`);
    return;
  }

  // Get DB records for this source file, ordered by ID
  const dbRecords = sqlite.prepare(
    `SELECT id, subject, grade, demographic_group, total_tested FROM ${fix.table} WHERE source_file = ? AND level = ? ORDER BY id`
  ).all(fix.sourceFile, fix.level) as any[];

  console.log(`  DB records: ${dbRecords.length}`);

  // Process Excel rows and match to DB records
  // The import processed rows sequentially and skipped rows with no subject or demographic_group
  // So we need to replicate the same skip logic to stay in sync

  const subjectIdx = colMap.get('Subject');
  const groupIdx = colMap.get('Group') ?? colMap.get('Student_Group_Name');
  const numberScoredIdx = colMap.get('Number Scored') ?? colMap.get('N Scored');

  let dbIdx = 0;
  let updated = 0;
  let skipped = 0;
  let mismatches = 0;

  const batchUpdate = sqlite.transaction((updates: { id: number; schoolId: number | null; districtId: number | null; countyId: number | null }[]) => {
    for (const u of updates) {
      if (fix.level === 'school') {
        if (fix.table === 'pssa_results') {
          updatePssaSchool.run(u.schoolId, u.districtId, u.countyId, u.id);
        } else {
          updateKeystoneSchool.run(u.schoolId, u.districtId, u.countyId, u.id);
        }
      } else {
        updatePssaDistrict.run(u.districtId, u.countyId, u.id);
      }
    }
  });

  const pendingUpdates: { id: number; schoolId: number | null; districtId: number | null; countyId: number | null }[] = [];

  for (let i = fix.headerRow + 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.every((cell: any) => cell === null || cell === '')) continue;

    const rawSubject = subjectIdx !== undefined ? row[subjectIdx] : null;
    const rawGroup = groupIdx !== undefined ? row[groupIdx] : null;

    const subject = normalizeSubject(rawSubject);
    const demographic = normalizeDemographic(rawGroup);

    // Skip logic matching the original importer
    if (!subject || !demographic) {
      skipped++;
      continue;
    }

    if (dbIdx >= dbRecords.length) {
      break;
    }

    const dbRec = dbRecords[dbIdx];
    dbIdx++;

    // Extract entity identifiers from Excel
    const aun = aunIdx !== undefined ? String(row[aunIdx] ?? '') : '';
    const county = countyIdx !== undefined ? String(row[countyIdx] ?? '').trim() : '';
    const districtName = districtIdx !== undefined ? String(row[districtIdx] ?? '').trim() : '';
    const schoolName = schoolIdx !== undefined ? String(row[schoolIdx] ?? '').trim() : '';
    const schoolNumber = schoolNumIdx !== undefined ? String(row[schoolNumIdx] ?? '').padStart(9, '0') : '';

    // Resolve entity IDs
    const countyId = county ? ensureCounty(county) : null;
    const districtId = aun ? ensureDistrict(districtName, aun, countyId) : null;
    const schoolId = (fix.level === 'school' && schoolNumber && districtId)
      ? ensureSchool(schoolName, schoolNumber, districtId)
      : null;

    pendingUpdates.push({ id: dbRec.id, schoolId, districtId, countyId });

    // Batch every 5000 records
    if (pendingUpdates.length >= 5000) {
      batchUpdate(pendingUpdates);
      updated += pendingUpdates.length;
      pendingUpdates.length = 0;
    }
  }

  // Flush remaining
  if (pendingUpdates.length > 0) {
    batchUpdate(pendingUpdates);
    updated += pendingUpdates.length;
  }

  console.log(`  Updated: ${updated} | Skipped empty: ${skipped} | DB records remaining: ${dbRecords.length - dbIdx}`);
  if (dbRecords.length - dbIdx > 0) {
    console.log(`  WARNING: ${dbRecords.length - dbIdx} DB records had no matching Excel row`);
  }
}

async function main() {
  console.log('=== Entity Linkage Fix ===\n');
  loadCaches();

  // Verify before
  const beforePssa = sqlite.prepare(
    "SELECT SUM(CASE WHEN level='school' AND school_id IS NULL THEN 1 ELSE 0 END) as null_school, " +
    "SUM(CASE WHEN level='district' AND district_id IS NULL THEN 1 ELSE 0 END) as null_district " +
    "FROM pssa_results"
  ).get() as any;
  const beforeKeystone = sqlite.prepare(
    "SELECT SUM(CASE WHEN level='school' AND school_id IS NULL THEN 1 ELSE 0 END) as null_school FROM keystone_results"
  ).get() as any;

  console.log(`\nBEFORE:`);
  console.log(`  PSSA null school_id (school level): ${beforePssa.null_school}`);
  console.log(`  PSSA null district_id (district level): ${beforePssa.null_district}`);
  console.log(`  Keystone null school_id (school level): ${beforeKeystone.null_school}`);

  for (const fix of fixes) {
    await processFile(fix);
  }

  // Verify after
  const afterPssa = sqlite.prepare(
    "SELECT SUM(CASE WHEN level='school' AND school_id IS NULL THEN 1 ELSE 0 END) as null_school, " +
    "SUM(CASE WHEN level='district' AND district_id IS NULL THEN 1 ELSE 0 END) as null_district " +
    "FROM pssa_results"
  ).get() as any;
  const afterKeystone = sqlite.prepare(
    "SELECT SUM(CASE WHEN level='school' AND school_id IS NULL THEN 1 ELSE 0 END) as null_school FROM keystone_results"
  ).get() as any;

  console.log(`\n=== RESULTS ===`);
  console.log(`PSSA null school_id (school level): ${beforePssa.null_school} → ${afterPssa.null_school}`);
  console.log(`PSSA null district_id (district level): ${beforePssa.null_district} → ${afterPssa.null_district}`);
  console.log(`Keystone null school_id (school level): ${beforeKeystone.null_school} → ${afterKeystone.null_school}`);
}

main().catch(console.error);
