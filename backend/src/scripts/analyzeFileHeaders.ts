import * as XLSX from 'xlsx';

const file = process.argv[2];
const workbook = XLSX.readFile(file);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Get the range of the sheet
const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

console.log(`\nFile: ${file.split('/').pop()}`);
console.log(`Sheet: ${sheetName}`);
console.log(`Range: ${worksheet['!ref']}`);
console.log('\nFirst 10 rows:');

// Read first 10 rows without parsing headers
for (let row = range.s.r; row <= Math.min(range.s.r + 9, range.e.r); row++) {
  const rowData: any[] = [];
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
    const cell = worksheet[cellAddress];
    rowData.push(cell ? cell.v : '');
  }
  console.log(`Row ${row}: ${rowData.slice(0, 10).map(v => String(v).substring(0, 20)).join(' | ')}`);
}

// Try parsing with different header rows
console.log('\n\nTrying different header rows:');
for (let headerRow = 0; headerRow <= 10; headerRow++) {
  const data = XLSX.utils.sheet_to_json(worksheet, { range: headerRow });
  if (data.length > 0) {
    const firstRow = data[0] as any;
    const keys = Object.keys(firstRow);
    const hasSubject = keys.some(k => k.toLowerCase().includes('subject'));
    const hasAUN = keys.some(k => k.toLowerCase().includes('aun'));

    if (hasSubject && hasAUN) {
      console.log(`✓ Header row ${headerRow}: Found Subject and AUN columns`);
      console.log(`  Columns: ${keys.slice(0, 8).join(', ')}`);
      break;
    } else if (headerRow <= 5) {
      console.log(`  Row ${headerRow}: ${keys.filter(k => !k.startsWith('__EMPTY')).slice(0, 3).join(', ')}`);
    }
  }
}
