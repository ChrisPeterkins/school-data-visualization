import * as XLSX from 'xlsx';
import * as path from 'path';

async function examinePVAASFile() {
  const filePath = path.join(
    process.cwd(),
    '..',
    'sources',
    'pvaas',
    'school',
    '2024-school-level-state-va.xlsx'
  );

  console.log('📄 Examining:', filePath);
  console.log('\n');

  const workbook = XLSX.readFile(filePath);

  console.log('📊 Sheets in workbook:', workbook.SheetNames);
  console.log('\n');

  // Examine each sheet
  workbook.SheetNames.forEach((sheetName, idx) => {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Sheet ${idx + 1}: ${sheetName}`);
    console.log('='.repeat(80));

    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    // Show first 10 rows
    console.log('\nFirst 10 rows:');
    data.slice(0, 10).forEach((row: any, i: number) => {
      console.log(`Row ${i}:`, row);
    });

    // If there are headers, show them
    if (data.length > 0) {
      console.log('\n📋 Column Headers (Row 0):');
      const headers = data[0] as any[];
      headers.forEach((header, i) => {
        console.log(`  [${i}] ${header}`);
      });
    }

    // Show total rows
    console.log(`\n📏 Total rows: ${data.length}`);
  });
}

examinePVAASFile().catch(console.error);
