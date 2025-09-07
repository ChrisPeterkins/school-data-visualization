import * as XLSX from 'xlsx';
import path from 'path';

function examineFile() {
  // const testFile = path.join(process.cwd(), '..', 'sources', 'pssa', 'school', '2023 pssa school level data.xlsx');
  const testFile = path.join(process.cwd(), '..', 'sources', 'keystone', 'school', '2023 keystone school level data.xlsx');
  
  console.log(`\n📁 Examining file: ${testFile}\n`);
  
  try {
    const workbook = XLSX.readFile(testFile);
    console.log(`📊 Sheet names: ${workbook.SheetNames.join(', ')}\n`);
    
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Get the range of the worksheet
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    console.log(`📏 Sheet dimensions: ${range.e.r + 1} rows x ${range.e.c + 1} columns\n`);
    
    // Read first 10 rows as raw data to see the structure
    console.log('🔍 First 10 rows (raw data):\n');
    for (let row = 0; row < Math.min(10, range.e.r + 1); row++) {
      const rowData = [];
      for (let col = 0; col <= Math.min(5, range.e.c); col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = worksheet[cellAddress];
        rowData.push(cell ? cell.v : '');
      }
      console.log(`Row ${row}: [${rowData.map(v => String(v).substring(0, 20)).join(' | ')}]`);
    }
    
    // Try different starting points for headers
    console.log('\n🔄 Trying different header rows:\n');
    
    for (let startRow = 0; startRow < 5; startRow++) {
      const data = XLSX.utils.sheet_to_json(worksheet, { range: startRow, header: 1 });
      if (data.length > 0 && data[0].length > 5) {
        console.log(`\n✅ Starting from row ${startRow} - Found ${data.length} data rows`);
        console.log('Headers:', data[0]);
        if (data[1]) {
          console.log('First data row:', data[1]);
        }
        break;
      }
    }
    
    // Also try with default parsing
    console.log('\n📋 Default parsing (sheet_to_json):\n');
    const defaultData = XLSX.utils.sheet_to_json(worksheet);
    if (defaultData.length > 0) {
      console.log(`Found ${defaultData.length} rows`);
      console.log('First row keys:', Object.keys(defaultData[0]));
      console.log('First row sample:', defaultData[0]);
    }
    
  } catch (error) {
    console.error('❌ Error reading file:', error);
  }
}

examineFile();