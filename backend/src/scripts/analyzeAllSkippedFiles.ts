import * as XLSX from 'xlsx';
import * as path from 'path';

const skippedFiles = [
  '../sources/pssa/school/2021 pssa school level data.xlsx',
  '../sources/pssa/state/2015 pssa state level data.xlsx',
  '../sources/pssa/state/2019 pssa state level data.xlsx',
  '../sources/pssa/state/2021 pssa state level data.xlsx',
  '../sources/pssa/state/2022 pssa state level data.xlsx',
  '../sources/pssa/state/2023 pssa state level data.xlsx',
  '../sources/pssa/state/2024-pssa-state-data.xlsx',
  '../sources/keystone/school/2021 keystone school level data.xlsx',
  '../sources/keystone/school/2023 keystone school level data.xlsx',
  '../sources/keystone/state/2015 keystone exam state level data.xlsx',
  '../sources/keystone/state/2016 keystone exams state level data.xlsx',
  '../sources/keystone/state/2017 keystone exams state level data.xlsx',
  '../sources/keystone/state/2021 keystone grade 11 state level data.xlsx',
];

console.log('Analyzing skipped files to find correct header rows...\n');
console.log('='.repeat(80));

for (const filePath of skippedFiles) {
  const fullPath = path.join(process.cwd(), filePath);

  try {
    const workbook = XLSX.readFile(fullPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const fileName = path.basename(filePath);
    console.log(`\n📄 ${fileName}`);

    // Try parsing with different header rows
    let foundHeader = false;
    for (let headerRow = 0; headerRow <= 10; headerRow++) {
      const data = XLSX.utils.sheet_to_json(worksheet, { range: headerRow });
      if (data.length > 0) {
        const firstRow = data[0] as any;
        const keys = Object.keys(firstRow);
        const hasSubject = keys.some(k => k.toLowerCase().includes('subject'));
        const hasAUN = keys.some(k => k.toLowerCase().includes('aun') || k.toLowerCase().includes('district'));

        if (hasSubject && hasAUN) {
          console.log(`   ✓ Header row: ${headerRow}`);
          console.log(`   ✓ Columns: ${keys.filter(k => !k.startsWith('__EMPTY')).slice(0, 8).join(', ')}`);
          console.log(`   ✓ Data rows: ${data.length - 1}`);
          foundHeader = true;
          break;
        }
      }
    }

    if (!foundHeader) {
      console.log(`   ❌ Could not find valid header row`);
    }

  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}`);
  }
}

console.log('\n' + '='.repeat(80));
console.log('Analysis complete!\n');
