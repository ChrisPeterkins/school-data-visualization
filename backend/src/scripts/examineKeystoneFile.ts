import * as XLSX from 'xlsx';
import * as path from 'path';

// Check different year patterns
const files = [
  '2015 keystone exam school level data.xlsx',
  '2019 keystone exams school level data.xlsx', 
  '2024-keystone-exams-school-grade-11-data.xlsx'
];

for (const fileName of files) {
  const filePath = path.join(process.cwd(), '..', 'sources', 'keystone', 'school', fileName);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📄 Examining: ${fileName}`);
  console.log('='.repeat(60));

  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as any[][];

  // Check multiple possible header rows
  for (let row = 0; row < Math.min(10, data.length); row++) {
    const nonNullCount = data[row].filter((cell: any) => cell !== null && cell !== '').length;
    if (nonNullCount > 10) {
      console.log(`\nRow ${row} (${nonNullCount} non-null columns):`);
      const headers = data[row];
      const sampleHeaders = headers.slice(0, 15).map((h: any, i: number) => 
        h ? `[${i}] "${String(h).substring(0, 30)}"` : null
      ).filter(Boolean);
      console.log(sampleHeaders.join('\n'));
      
      // Look for key columns
      const countyCol = headers.findIndex((h: any) => String(h || '').includes('County'));
      const aunCol = headers.findIndex((h: any) => String(h || '').includes('AUN'));
      const districtCol = headers.findIndex((h: any) => String(h || '').includes('District'));
      const schoolCol = headers.findIndex((h: any) => String(h || '').includes('School'));
      const subjectCol = headers.findIndex((h: any) => String(h || '').includes('Subject'));
      
      if (countyCol >= 0 || aunCol >= 0 || districtCol >= 0) {
        console.log('\n🔑 Key columns found:');
        if (countyCol >= 0) console.log(`  County: Col ${countyCol}`);
        if (aunCol >= 0) console.log(`  AUN: Col ${aunCol}`);
        if (districtCol >= 0) console.log(`  District: Col ${districtCol}`);
        if (schoolCol >= 0) console.log(`  School: Col ${schoolCol}`);
        if (subjectCol >= 0) console.log(`  Subject: Col ${subjectCol}`);
      }
    }
  }
  
  // Show a sample data row
  const headerRow = fileName.includes('2015') ? 6 : 4;
  if (data.length > headerRow + 1) {
    console.log(`\n📊 Sample data (row ${headerRow + 1}):`);
    const headers = data[headerRow];
    const sampleRow = data[headerRow + 1];
    const keyFields = ['County', 'AUN', 'District', 'School', 'Subject', 'Group', 'Number'];
    
    headers.forEach((h: any, i: number) => {
      if (h && keyFields.some(k => String(h).includes(k)) && sampleRow[i]) {
        console.log(`  ${h}: "${sampleRow[i]}"`);
      }
    });
  }
}