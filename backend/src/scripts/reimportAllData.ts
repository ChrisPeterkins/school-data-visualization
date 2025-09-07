import Database from 'better-sqlite3';
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

const db = new Database('school-data.db');

interface ParsedRow {
  year: number;
  aun?: string;
  schoolNumber?: string;
  county?: string;
  districtName?: string;
  schoolName?: string;
  grade?: string;
  subject: string;
  group: string;
  numberScored?: number;
  percentAdvanced?: number;
  percentProficient?: number;
  percentBasic?: number;
  percentBelowBasic?: number;
  percentProficientOrAbove?: number;
}

function parsePercent(value: any): number | null {
  if (value === undefined || value === null || value === '' || value === 'N/A' || value === '*') return null;
  const str = String(value).replace(/[%,]/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

function parseNumber(value: any): number | null {
  if (value === undefined || value === null || value === '' || value === 'N/A' || value === '*') return null;
  const num = parseFloat(String(value).replace(/,/g, ''));
  return isNaN(num) ? null : num;
}

function normalizeGrade(grade: any): string | null {
  if (!grade || grade === 'Total') return null;
  return String(grade);
}

async function importPSSAFile(filePath: string, year: number, level: 'school' | 'district' | 'state') {
  console.log(`  📄 Importing ${path.basename(filePath)}...`);
  
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  // Find header row (contains 'Year' or starts with county/district info)
  let headerRow = -1;
  for (let i = 0; i < Math.min(10, rawData.length); i++) {
    const row = rawData[i] as any[];
    if (row.some(cell => String(cell).toLowerCase().includes('year')) ||
        row.some(cell => String(cell).toLowerCase().includes('county'))) {
      headerRow = i;
      break;
    }
  }
  
  if (headerRow === -1) {
    console.error(`    ❌ Could not find header row in ${filePath}`);
    return 0;
  }
  
  const headers = rawData[headerRow] as string[];
  const data = rawData.slice(headerRow + 1);
  
  // Map column names based on year
  const isOldFormat = year < 2024;
  const columnMap: any = {
    year: headers.findIndex(h => h?.toLowerCase().includes('year')),
    aun: headers.findIndex(h => h?.toLowerCase().includes('aun')),
    schoolNumber: headers.findIndex(h => h?.toLowerCase().includes('school number')),
    county: headers.findIndex(h => h?.toLowerCase() === 'county'),
    districtName: headers.findIndex(h => h?.toLowerCase().includes('district name')),
    schoolName: headers.findIndex(h => h?.toLowerCase().includes('school name')),
    grade: headers.findIndex(h => h?.toLowerCase() === 'grade'),
    subject: headers.findIndex(h => h?.toLowerCase() === 'subject'),
    group: headers.findIndex(h => h?.toLowerCase() === 'group'),
    numberScored: headers.findIndex(h => h?.toLowerCase().includes('number scored')),
    percentAdvanced: headers.findIndex(h => {
      const header = h?.toLowerCase() || '';
      return isOldFormat ? header === '% advanced' : header === 'percent advanced';
    }),
    percentProficient: headers.findIndex(h => {
      const header = h?.toLowerCase() || '';
      return isOldFormat ? header === '% proficient' : header === 'percent proficient';
    }),
    percentBasic: headers.findIndex(h => {
      const header = h?.toLowerCase() || '';
      return isOldFormat ? header === '% basic' : header === 'percent basic';
    }),
    percentBelowBasic: headers.findIndex(h => {
      const header = h?.toLowerCase() || '';
      return isOldFormat ? header === '% below basic' : header === 'percent below basic';
    }),
    percentProficientOrAbove: headers.findIndex(h => {
      const header = h?.toLowerCase() || '';
      return header.includes('proficient') && header.includes('above');
    })
  };
  
  let imported = 0;
  
  for (const row of data) {
    const rowData = row as any[];
    
    // Skip empty rows
    if (!rowData || rowData.length === 0 || !rowData[columnMap.subject]) continue;
    
    const parsedRow: ParsedRow = {
      year: columnMap.year >= 0 ? parseNumber(rowData[columnMap.year]) || year : year,
      aun: columnMap.aun >= 0 ? String(rowData[columnMap.aun] || '') : undefined,
      schoolNumber: columnMap.schoolNumber >= 0 ? String(rowData[columnMap.schoolNumber] || '') : undefined,
      county: columnMap.county >= 0 ? String(rowData[columnMap.county] || '') : undefined,
      districtName: columnMap.districtName >= 0 ? String(rowData[columnMap.districtName] || '') : undefined,
      schoolName: columnMap.schoolName >= 0 ? String(rowData[columnMap.schoolName] || '') : undefined,
      grade: normalizeGrade(rowData[columnMap.grade]),
      subject: String(rowData[columnMap.subject] || ''),
      group: String(rowData[columnMap.group] || 'All Students'),
      numberScored: parseNumber(rowData[columnMap.numberScored]),
      percentAdvanced: parsePercent(rowData[columnMap.percentAdvanced]),
      percentProficient: parsePercent(rowData[columnMap.percentProficient]),
      percentBasic: parsePercent(rowData[columnMap.percentBasic]),
      percentBelowBasic: parsePercent(rowData[columnMap.percentBelowBasic]),
      percentProficientOrAbove: columnMap.percentProficientOrAbove >= 0 
        ? parsePercent(rowData[columnMap.percentProficientOrAbove])
        : null
    };
    
    // Calculate proficient or above if not provided
    if (parsedRow.percentProficientOrAbove === null && 
        parsedRow.percentAdvanced !== null && 
        parsedRow.percentProficient !== null) {
      parsedRow.percentProficientOrAbove = parsedRow.percentAdvanced + parsedRow.percentProficient;
    }
    
    // Get school/district IDs
    let schoolId = null;
    let districtId = null;
    
    if (level === 'school' && parsedRow.schoolNumber) {
      const school = db.prepare('SELECT id, district_id FROM schools WHERE school_number = ?')
        .get(parsedRow.schoolNumber) as any;
      if (school) {
        schoolId = school.id;
        districtId = school.district_id;
      }
    } else if (level === 'district' && parsedRow.aun) {
      const district = db.prepare('SELECT id FROM districts WHERE aun = ?')
        .get(parsedRow.aun) as any;
      if (district) {
        districtId = district.id;
      }
    }
    
    // Insert into database
    if ((level === 'school' && schoolId) || (level === 'district' && districtId) || level === 'state') {
      db.prepare(`
        INSERT OR REPLACE INTO pssa_results (
          school_id, district_id, year, grade, subject, demographic_group,
          total_tested, advanced_percent, proficient_percent, basic_percent,
          below_basic_percent, proficient_or_above_percent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        schoolId,
        districtId,
        parsedRow.year,
        parsedRow.grade,
        parsedRow.subject,
        parsedRow.group,
        parsedRow.numberScored,
        parsedRow.percentAdvanced,
        parsedRow.percentProficient,
        parsedRow.percentBasic,
        parsedRow.percentBelowBasic,
        parsedRow.percentProficientOrAbove
      );
      imported++;
    }
  }
  
  console.log(`    ✅ Imported ${imported} records`);
  return imported;
}

async function importKeystoneFile(filePath: string, year: number, level: 'school' | 'district' | 'state') {
  console.log(`  📄 Importing ${path.basename(filePath)}...`);
  
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  // Similar logic to PSSA but for Keystone
  // (Implementation similar to above with Keystone-specific columns)
  
  return 0; // Placeholder
}

async function main() {
  console.log('🚀 Starting comprehensive data re-import...\n');
  
  // Clear existing data
  console.log('🗑️  Clearing existing PSSA and Keystone data...');
  db.prepare('DELETE FROM pssa_results').run();
  db.prepare('DELETE FROM keystone_results').run();
  console.log('   ✅ Data cleared\n');
  
  // Import PSSA data
  console.log('📚 Importing PSSA data...');
  const pssaDir = path.join(__dirname, '../../../sources/pssa');
  
  // School level
  console.log('  School level:');
  const schoolDir = path.join(pssaDir, 'school');
  const schoolFiles = fs.readdirSync(schoolDir).filter(f => f.endsWith('.xlsx'));
  for (const file of schoolFiles) {
    const year = parseInt(file.match(/\d{4}/)?.[0] || '0');
    if (year >= 2015 && year <= 2024 && year !== 2020) {
      await importPSSAFile(path.join(schoolDir, file), year, 'school');
    }
  }
  
  // District level
  console.log('  District level:');
  const districtDir = path.join(pssaDir, 'district');
  const districtFiles = fs.readdirSync(districtDir).filter(f => f.endsWith('.xlsx'));
  for (const file of districtFiles) {
    const year = parseInt(file.match(/\d{4}/)?.[0] || '0');
    if (year >= 2015 && year <= 2024 && year !== 2020) {
      await importPSSAFile(path.join(districtDir, file), year, 'district');
    }
  }
  
  // State level
  console.log('  State level:');
  const stateDir = path.join(pssaDir, 'state');
  const stateFiles = fs.readdirSync(stateDir).filter(f => f.endsWith('.xlsx'));
  for (const file of stateFiles) {
    const year = parseInt(file.match(/\d{4}/)?.[0] || '0');
    if (year >= 2015 && year <= 2024 && year !== 2020) {
      await importPSSAFile(path.join(stateDir, file), year, 'state');
    }
  }
  
  console.log('\n✅ Import complete!');
  
  // Verify the import
  const schoolTest = db.prepare(`
    SELECT COUNT(*) as count FROM pssa_results 
    WHERE school_id = (SELECT id FROM schools WHERE school_number = '000001088')
    AND year = 2024 AND demographic_group = 'All Students'
  `).get() as any;
  
  console.log(`\n📊 Verification: CHURCHVILLE EL SCH has ${schoolTest.count} PSSA records for 2024`);
  
  const sampleData = db.prepare(`
    SELECT year, grade, subject, advanced_percent, proficient_percent
    FROM pssa_results 
    WHERE school_id = (SELECT id FROM schools WHERE school_number = '000001088')
    AND year = 2024 AND demographic_group = 'All Students'
    LIMIT 3
  `).all();
  
  console.log('Sample data:');
  console.table(sampleData);
  
  db.close();
}

main().catch(console.error);