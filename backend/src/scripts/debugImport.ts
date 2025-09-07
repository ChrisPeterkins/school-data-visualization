import * as XLSX from 'xlsx';
import * as path from 'path';

const filePath = path.join(process.cwd(), '..', 'sources', 'pssa', 'school', '2024-pssa-school-data.xlsx');
console.log(`\n📄 Debugging: ${path.basename(filePath)}\n`);

const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as any[][];

// Check header row 4 (0-indexed)
console.log('Headers at row 4:');
const headers = data[4];
headers.forEach((h: any, i: number) => {
  if (h) console.log(`  Col ${i}: "${h}"`);
});

console.log('\n\nFirst data row (row 5):');
const firstRow = data[5];
headers.forEach((h: any, i: number) => {
  if (h && firstRow[i]) {
    console.log(`  ${h}: "${firstRow[i]}"`);
  }
});

// Look for County, AUN, School Number columns
console.log('\n\n🔍 Looking for key columns:');
const countyCol = headers.findIndex((h: any) => String(h || '').includes('County'));
const aunCol = headers.findIndex((h: any) => String(h || '').includes('AUN'));
const schoolNumCol = headers.findIndex((h: any) => String(h || '').includes('School Number'));
const districtCol = headers.findIndex((h: any) => String(h || '').includes('District'));
const schoolCol = headers.findIndex((h: any) => String(h || '').includes('School Name'));

console.log(`  County column: ${countyCol} ${countyCol >= 0 ? `("${headers[countyCol]}")` : 'NOT FOUND'}`);
console.log(`  AUN column: ${aunCol} ${aunCol >= 0 ? `("${headers[aunCol]}")` : 'NOT FOUND'}`);
console.log(`  School Number column: ${schoolNumCol} ${schoolNumCol >= 0 ? `("${headers[schoolNumCol]}")` : 'NOT FOUND'}`);
console.log(`  District column: ${districtCol} ${districtCol >= 0 ? `("${headers[districtCol]}")` : 'NOT FOUND'}`);
console.log(`  School Name column: ${schoolCol} ${schoolCol >= 0 ? `("${headers[schoolCol]}")` : 'NOT FOUND'}`);

// Sample 5 rows to see actual data
console.log('\n\n📊 Sample data (5 rows):');
for (let i = 5; i < Math.min(10, data.length); i++) {
  const row = data[i];
  if (!row || !row[schoolCol]) continue;
  
  console.log(`\nRow ${i}:`);
  console.log(`  County: "${row[countyCol] || 'NULL'}"`);
  console.log(`  District: "${row[districtCol] || 'NULL'}"`);
  console.log(`  School: "${row[schoolCol] || 'NULL'}"`);
  console.log(`  AUN: "${row[aunCol] || 'NULL'}"`);
  console.log(`  School #: "${row[schoolNumCol] || 'NULL'}"`);
}