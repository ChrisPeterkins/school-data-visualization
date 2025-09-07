import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs/promises';

interface FileStructure {
  fileName: string;
  sheetName: string;
  totalRows: number;
  headerRow: number;
  headers: string[];
  sampleData: any;
  notes: string[];
}

async function examineAllFiles() {
  const sourcePath = path.join(process.cwd(), '..', 'sources');
  const categories = [
    'pssa/school',
    'pssa/district', 
    'pssa/state',
    'keystone/school',
    'keystone/district',
    'keystone/state',
  ];

  const structures: Record<string, FileStructure[]> = {};

  for (const category of categories) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📁 EXAMINING: ${category.toUpperCase()}`);
    console.log('='.repeat(80));
    
    structures[category] = [];
    const dirPath = path.join(sourcePath, category);
    
    try {
      const files = await fs.readdir(dirPath);
      const xlsxFiles = files.filter(f => f.endsWith('.xlsx')).sort();
      
      for (const file of xlsxFiles) {
        console.log(`\n📊 File: ${file}`);
        console.log('-'.repeat(60));
        
        const filePath = path.join(dirPath, file);
        const structure = await examineFile(filePath);
        structures[category].push(structure);
        
        // Print summary
        console.log(`  Header Row: ${structure.headerRow}`);
        console.log(`  Total Rows: ${structure.totalRows}`);
        console.log(`  Headers (${structure.headers.length}): ${structure.headers.slice(0, 8).join(', ')}...`);
        
        if (structure.notes.length > 0) {
          console.log(`  ⚠️  Notes: ${structure.notes.join('; ')}`);
        }
      }
    } catch (error) {
      console.error(`  ❌ Error reading directory: ${error}`);
    }
  }

  // Print summary analysis
  console.log(`\n${'='.repeat(80)}`);
  console.log('📈 STRUCTURE ANALYSIS SUMMARY');
  console.log('='.repeat(80));

  for (const [category, files] of Object.entries(structures)) {
    if (files.length === 0) continue;
    
    console.log(`\n${category}:`);
    
    // Check if headers are consistent
    const headerSets = files.map(f => JSON.stringify(f.headers));
    const uniqueHeaders = [...new Set(headerSets)];
    
    if (uniqueHeaders.length === 1) {
      console.log(`  ✅ Consistent headers across all ${files.length} files`);
      console.log(`  Headers: ${files[0].headers.join(', ')}`);
    } else {
      console.log(`  ⚠️  ${uniqueHeaders.length} different header structures found`);
      files.forEach(f => {
        if (f.notes.length > 0) {
          console.log(`    - ${f.fileName}: ${f.notes.join('; ')}`);
        }
      });
    }
    
    // Check header row positions
    const headerRows = [...new Set(files.map(f => f.headerRow))];
    console.log(`  Header rows at: ${headerRows.join(', ')}`);
  }
}

async function examineFile(filePath: string): Promise<FileStructure> {
  const fileName = path.basename(filePath);
  const result: FileStructure = {
    fileName,
    sheetName: '',
    totalRows: 0,
    headerRow: -1,
    headers: [],
    sampleData: null,
    notes: []
  };

  try {
    const workbook = XLSX.readFile(filePath);
    result.sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[result.sheetName];
    
    // Get dimensions
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    result.totalRows = range.e.r + 1;
    
    // Find header row by looking for expected columns
    const expectedHeaders = {
      pssa: ['Year', 'AUN', 'School Number', 'County', 'District Name'],
      keystone: ['Year', 'AUN', 'School Number', 'County', 'District Name'],
      district: ['Year', 'AUN', 'County', 'District Name'],
      state: ['Year', 'Subject', 'Grade']
    };
    
    // Determine which headers to look for
    let headersToFind = expectedHeaders.pssa;
    if (fileName.toLowerCase().includes('district') && !fileName.toLowerCase().includes('school')) {
      headersToFind = expectedHeaders.district;
    } else if (fileName.toLowerCase().includes('state')) {
      headersToFind = expectedHeaders.state;
    }
    
    // Try to find header row
    for (let row = 0; row < Math.min(10, result.totalRows); row++) {
      const data = XLSX.utils.sheet_to_json(worksheet, { range: row, header: 1 });
      if (data.length > 0 && Array.isArray(data[0])) {
        const headers = data[0] as string[];
        
        // Check if this row has expected headers
        const hasExpectedHeaders = headersToFind.some(h => 
          headers.some(header => String(header).includes(h))
        );
        
        if (hasExpectedHeaders && headers.length > 5) {
          result.headerRow = row;
          result.headers = headers.map(h => String(h));
          
          // Get sample data
          if (data.length > 1) {
            result.sampleData = data[1];
          }
          break;
        }
      }
    }
    
    // Special cases and notes
    if (fileName.includes('2024')) {
      result.notes.push('2024 format');
    }
    
    if (result.headerRow === -1) {
      result.notes.push('Could not detect header row');
      // Try default positions
      if (fileName.toLowerCase().includes('keystone')) {
        result.headerRow = 3;
      } else {
        result.headerRow = 4;
      }
      
      // Get headers at default position
      const data = XLSX.utils.sheet_to_json(worksheet, { range: result.headerRow, header: 1 });
      if (data.length > 0 && Array.isArray(data[0])) {
        result.headers = (data[0] as string[]).map(h => String(h));
      }
    }
    
    // Check for percentage column variations
    if (result.headers.includes('% Advanced/Proficient')) {
      result.notes.push('Uses "% Advanced/Proficient"');
    } else if (result.headers.includes('Percent Proficient and above')) {
      result.notes.push('Uses "Percent Proficient and above"');
    }
    
  } catch (error) {
    result.notes.push(`Error: ${error}`);
  }
  
  return result;
}

examineAllFiles().catch(console.error);