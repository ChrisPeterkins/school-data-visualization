import * as xlsx from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

interface FileAnalysis {
  fileName: string;
  filePath: string;
  sheetName: string;
  totalRows: number;
  headerRow: number;
  headers: string[];
  sampleData: any[];
  uniqueValues: {
    counties?: Set<string>;
    districts?: Set<string>;
    schools?: Set<string>;
    subjects?: Set<string>;
    grades?: Set<string>;
    years?: Set<string>;
  };
}

async function analyzeAllSourceFiles() {
  console.log('🔍 COMPREHENSIVE SOURCE FILE ANALYSIS\n');
  console.log('=' .repeat(80));

  const sourcesPath = path.join(process.cwd(), '..', 'sources');
  const analyses: FileAnalysis[] = [];
  
  const directories = [
    'pssa/school', 'pssa/district', 'pssa/state',
    'keystone/school', 'keystone/district', 'keystone/state'
  ];

  for (const dir of directories) {
    const dirPath = path.join(sourcesPath, dir);
    if (!fs.existsSync(dirPath)) {
      console.log(`❌ Directory not found: ${dir}`);
      continue;
    }

    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.xlsx'));
    console.log(`\n📁 ${dir} (${files.length} files)`);
    console.log('-'.repeat(40));

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const analysis = analyzeFile(filePath, dir);
      analyses.push(analysis);
      
      // Print summary for each file
      console.log(`\n📄 ${file}`);
      console.log(`   Header Row: ${analysis.headerRow}`);
      console.log(`   Total Rows: ${analysis.totalRows}`);
      console.log(`   Data Rows: ${analysis.totalRows - analysis.headerRow}`);
      
      // Print key columns found
      const keyColumns = analysis.headers.filter(h => {
        const lower = h.toLowerCase();
        return lower.includes('county') || 
               lower.includes('district') || 
               lower.includes('school') ||
               lower.includes('aun') ||
               lower.includes('lea') ||
               lower.includes('subject') ||
               lower.includes('grade');
      });
      
      if (keyColumns.length > 0) {
        console.log(`   Key Columns: ${keyColumns.join(', ')}`);
      }
      
      // Show sample unique values
      if (analysis.uniqueValues.counties?.size > 0) {
        console.log(`   Counties found: ${analysis.uniqueValues.counties.size}`);
        const sample = Array.from(analysis.uniqueValues.counties).slice(0, 3);
        console.log(`     Sample: ${sample.join(', ')}`);
      }
    }
  }

  // Generate comprehensive report
  generateReport(analyses);
  
  // Save analysis to JSON for reference
  const output = analyses.map(a => ({
    ...a,
    uniqueValues: {
      counties: Array.from(a.uniqueValues.counties || []),
      districts: Array.from(a.uniqueValues.districts || []),
      schools: Array.from(a.uniqueValues.schools || []).slice(0, 10),
      subjects: Array.from(a.uniqueValues.subjects || []),
      grades: Array.from(a.uniqueValues.grades || []),
      years: Array.from(a.uniqueValues.years || [])
    }
  }));
  
  fs.writeFileSync(
    path.join(process.cwd(), 'source-analysis.json'),
    JSON.stringify(output, null, 2)
  );
  
  console.log('\n\n✅ Analysis complete! See source-analysis.json for full details');
}

function analyzeFile(filePath: string, category: string): FileAnalysis {
  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null }) as any[][];
  
  // Find header row (look for row with most non-null values)
  let headerRow = 0;
  let maxNonNull = 0;
  for (let i = 0; i < Math.min(10, data.length); i++) {
    const nonNullCount = data[i].filter(cell => cell !== null && cell !== '').length;
    if (nonNullCount > maxNonNull) {
      maxNonNull = nonNullCount;
      headerRow = i;
    }
  }
  
  const headers = data[headerRow] || [];
  const analysis: FileAnalysis = {
    fileName: path.basename(filePath),
    filePath,
    sheetName: workbook.SheetNames[0],
    totalRows: data.length,
    headerRow,
    headers: headers.map(h => String(h || '').trim()).filter(h => h),
    sampleData: data.slice(headerRow + 1, headerRow + 6),
    uniqueValues: {
      counties: new Set(),
      districts: new Set(),
      schools: new Set(),
      subjects: new Set(),
      grades: new Set(),
      years: new Set()
    }
  };
  
  // Identify column indices
  const countyCol = headers.findIndex((h: any) => 
    String(h || '').toLowerCase().includes('county'));
  const districtCol = headers.findIndex((h: any) => 
    String(h || '').toLowerCase().includes('district') || 
    String(h || '').toLowerCase().includes('lea'));
  const schoolCol = headers.findIndex((h: any) => 
    String(h || '').toLowerCase().includes('school') && 
    !String(h || '').toLowerCase().includes('number'));
  const subjectCol = headers.findIndex((h: any) => 
    String(h || '').toLowerCase().includes('subject'));
  const gradeCol = headers.findIndex((h: any) => 
    String(h || '').toLowerCase().includes('grade'));
  
  // Sample unique values (limit to prevent memory issues)
  const sampleSize = Math.min(1000, data.length);
  for (let i = headerRow + 1; i < sampleSize; i++) {
    const row = data[i];
    if (!row) continue;
    
    if (countyCol >= 0 && row[countyCol]) {
      analysis.uniqueValues.counties!.add(String(row[countyCol]).trim());
    }
    if (districtCol >= 0 && row[districtCol]) {
      analysis.uniqueValues.districts!.add(String(row[districtCol]).trim());
    }
    if (schoolCol >= 0 && row[schoolCol]) {
      analysis.uniqueValues.schools!.add(String(row[schoolCol]).trim());
    }
    if (subjectCol >= 0 && row[subjectCol]) {
      analysis.uniqueValues.subjects!.add(String(row[subjectCol]).trim());
    }
    if (gradeCol >= 0 && row[gradeCol]) {
      analysis.uniqueValues.grades!.add(String(row[gradeCol]).trim());
    }
  }
  
  return analysis;
}

function generateReport(analyses: FileAnalysis[]) {
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 COMPREHENSIVE ANALYSIS REPORT');
  console.log('='.repeat(80));
  
  // Aggregate findings
  const allCounties = new Set<string>();
  const allDistricts = new Set<string>();
  const allSubjects = new Set<string>();
  const headerVariations = new Map<string, number>();
  
  analyses.forEach(a => {
    a.uniqueValues.counties?.forEach(c => allCounties.add(c));
    a.uniqueValues.districts?.forEach(d => allDistricts.add(d));
    a.uniqueValues.subjects?.forEach(s => allSubjects.add(s));
    
    // Track header variations
    a.headers.forEach(h => {
      const normalized = h.toLowerCase().replace(/[^a-z]/g, '');
      headerVariations.set(normalized, (headerVariations.get(normalized) || 0) + 1);
    });
  });
  
  console.log('\n📍 GEOGRAPHIC COVERAGE:');
  console.log(`   Total Counties Found: ${allCounties.size}`);
  console.log(`   Total Districts Found: ${allDistricts.size}`);
  
  console.log('\n📚 SUBJECTS FOUND:');
  Array.from(allSubjects).sort().forEach(s => {
    console.log(`   - ${s}`);
  });
  
  console.log('\n🔤 COLUMN NAME VARIATIONS:');
  const importantColumns = [
    'county', 'district', 'school', 'grade', 'subject', 
    'aun', 'lea', 'schoolnumber', 'proficient', 'advanced'
  ];
  
  importantColumns.forEach(col => {
    const variations = analyses
      .flatMap(a => a.headers)
      .filter(h => h.toLowerCase().includes(col))
      .reduce((acc, h) => {
        acc.add(h);
        return acc;
      }, new Set<string>());
    
    if (variations.size > 0) {
      console.log(`\n   ${col.toUpperCase()} variations (${variations.size}):`);
      Array.from(variations).slice(0, 5).forEach(v => {
        console.log(`     - "${v}"`);
      });
    }
  });
  
  console.log('\n⚠️  CRITICAL FINDINGS:');
  
  // Check for files missing county data
  const missingCounty = analyses.filter(a => 
    !a.headers.some(h => h.toLowerCase().includes('county'))
  );
  if (missingCounty.length > 0) {
    console.log(`   ${missingCounty.length} files have NO county column!`);
    missingCounty.forEach(f => console.log(`     - ${f.fileName}`));
  }
  
  // Check for header row variations
  const headerPositions = new Map<number, number>();
  analyses.forEach(a => {
    headerPositions.set(a.headerRow, (headerPositions.get(a.headerRow) || 0) + 1);
  });
  
  console.log('\n   Header row positions:');
  Array.from(headerPositions.entries())
    .sort((a, b) => a[0] - b[0])
    .forEach(([row, count]) => {
      console.log(`     Row ${row}: ${count} files`);
    });
}

analyzeAllSourceFiles().catch(console.error);