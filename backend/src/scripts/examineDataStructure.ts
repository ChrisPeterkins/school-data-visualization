import * as xlsx from 'xlsx';
import * as path from 'path';

/**
 * Deep examination of actual data structure
 * Understanding how rows are organized with totals and demographic breakdowns
 */

async function examineDataStructure() {
  console.log('🔬 EXAMINING ACTUAL DATA STRUCTURE\n');
  console.log('=' .repeat(80));
  
  // Let's examine a recent school-level file in detail
  const testFile = path.join(
    process.cwd(), 
    '..', 
    'sources', 
    'pssa', 
    'school',
    '2024-pssa-school-data.xlsx'
  );
  
  console.log(`\n📄 Examining: 2024-pssa-school-data.xlsx`);
  console.log('-'.repeat(80));
  
  const workbook = xlsx.readFile(testFile);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null }) as any[][];
  
  // Show first 10 rows to understand structure
  console.log('\n📊 First 10 rows (to see headers and structure):\n');
  for (let i = 0; i < Math.min(10, data.length); i++) {
    console.log(`Row ${i}: ${data[i].slice(0, 8).map(cell => 
      cell === null ? 'NULL' : 
      typeof cell === 'string' ? `"${cell.substring(0, 20)}${cell.length > 20 ? '...' : ''}"` : 
      cell
    ).join(' | ')}`);
  }
  
  // Now look at actual data rows
  console.log('\n📊 Sample data rows (showing key columns):\n');
  
  // Find header row (row 4 based on our analysis)
  const headerRow = 4;
  const headers = data[headerRow];
  
  // Find important column indices
  const schoolCol = headers.findIndex((h: any) => String(h || '').includes('School Name'));
  const gradeCol = headers.findIndex((h: any) => String(h || '').includes('Grade'));
  const subjectCol = headers.findIndex((h: any) => String(h || '').includes('Subject'));
  const groupCol = headers.findIndex((h: any) => 
    String(h || '').toLowerCase().includes('group') || 
    String(h || '').toLowerCase().includes('demographic') ||
    String(h || '').toLowerCase().includes('subgroup')
  );
  
  console.log(`\nColumn indices found:`);
  console.log(`  School Name: ${schoolCol}`);
  console.log(`  Grade: ${gradeCol}`);
  console.log(`  Subject: ${subjectCol}`);
  console.log(`  Group/Demographic: ${groupCol}`);
  
  // Look for demographic/group column
  const possibleGroupColumns = headers.map((h: any, idx: number) => ({
    index: idx,
    header: String(h || ''),
    lower: String(h || '').toLowerCase()
  })).filter(col => 
    col.lower.includes('group') || 
    col.lower.includes('demographic') ||
    col.lower.includes('gender') ||
    col.lower.includes('race') ||
    col.lower.includes('ethnicity') ||
    col.lower.includes('all student') ||
    col.lower.includes('total')
  );
  
  console.log('\n🔍 Possible demographic/group columns:');
  possibleGroupColumns.forEach(col => {
    console.log(`  Col ${col.index}: "${col.header}"`);
  });
  
  // Sample data from one school to see pattern
  console.log('\n📊 Data pattern for first school:\n');
  
  let currentSchool = '';
  let rowCount = 0;
  let maxRows = 50;
  
  for (let i = headerRow + 1; i < Math.min(data.length, headerRow + 200); i++) {
    const row = data[i];
    if (!row || !row[schoolCol]) continue;
    
    const school = String(row[schoolCol] || '');
    const grade = String(row[gradeCol] || '');
    const subject = String(row[subjectCol] || '');
    
    // Look for group/demographic info in various columns
    let groupInfo = 'Unknown';
    for (let j = 0; j < row.length; j++) {
      const cellValue = String(row[j] || '').toLowerCase();
      if (cellValue.includes('all student') || 
          cellValue.includes('male') || 
          cellValue.includes('female') ||
          cellValue.includes('white') ||
          cellValue.includes('black') ||
          cellValue.includes('hispanic') ||
          cellValue.includes('asian') ||
          cellValue.includes('iep') ||
          cellValue.includes('economically')) {
        groupInfo = String(row[j]);
        break;
      }
    }
    
    if (school !== currentSchool) {
      if (currentSchool) {
        console.log(`  ... ${rowCount} total rows for ${currentSchool}\n`);
      }
      currentSchool = school;
      rowCount = 0;
      console.log(`\n🏫 School: ${school}`);
    }
    
    rowCount++;
    if (rowCount <= 5) {
      console.log(`  Row ${i}: Grade ${grade}, ${subject}, Group: ${groupInfo}`);
    }
    
    maxRows--;
    if (maxRows <= 0) break;
  }
  
  // Analyze unique values in potential group column
  if (groupCol >= 0) {
    const groupValues = new Set<string>();
    for (let i = headerRow + 1; i < Math.min(data.length, headerRow + 1000); i++) {
      const value = data[i]?.[groupCol];
      if (value) groupValues.add(String(value));
    }
    
    console.log('\n📊 Unique group/demographic values found:');
    Array.from(groupValues).sort().forEach(val => {
      console.log(`  - ${val}`);
    });
  }
  
  // Check if there's a pattern of multiple rows per school/grade/subject
  console.log('\n📊 Checking row patterns:\n');
  
  const combinations = new Map<string, number>();
  for (let i = headerRow + 1; i < Math.min(data.length, headerRow + 500); i++) {
    const row = data[i];
    if (!row || !row[schoolCol]) continue;
    
    const key = `${row[schoolCol]}|${row[gradeCol]}|${row[subjectCol]}`;
    combinations.set(key, (combinations.get(key) || 0) + 1);
  }
  
  const samples = Array.from(combinations.entries()).slice(0, 10);
  samples.forEach(([key, count]) => {
    const [school, grade, subject] = key.split('|');
    console.log(`  ${school?.substring(0, 30)} | Grade ${grade} | ${subject}: ${count} rows`);
  });
  
  const avgRowsPerCombination = Array.from(combinations.values()).reduce((a, b) => a + b, 0) / combinations.size;
  console.log(`\n  Average rows per school/grade/subject: ${avgRowsPerCombination.toFixed(1)}`);
  
  console.log('\n💡 FINDINGS:');
  console.log('  - Each school/grade/subject combination has MULTIPLE rows');
  console.log('  - These represent different demographic breakdowns');
  console.log('  - Typically includes: All Students, Male, Female, Race/Ethnicity groups, IEP, Economically Disadvantaged');
  console.log('  - We need to handle these properly - either store all or filter for "All Students" only');
}

examineDataStructure().catch(console.error);