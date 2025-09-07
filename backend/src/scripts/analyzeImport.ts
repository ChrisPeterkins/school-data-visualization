import * as xlsx from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import { db } from '../db';
import { sql } from 'drizzle-orm';

async function analyzeImport() {
  console.log('🔍 Analyzing Data Import...\n');

  // Count records in database
  const [pssaCount] = await db.select({ count: sql<number>`count(*)` }).from(sql`pssa_results`);
  const [keystoneCount] = await db.select({ count: sql<number>`count(*)` }).from(sql`keystone_results`);
  
  console.log('📊 Database Statistics:');
  console.log(`  PSSA Records: ${pssaCount.count.toLocaleString()}`);
  console.log(`  Keystone Records: ${keystoneCount.count.toLocaleString()}`);
  console.log(`  Total: ${(pssaCount.count + keystoneCount.count).toLocaleString()}\n`);

  // Analyze source files
  const sourcesPath = path.join(process.cwd(), '..', 'sources');
  let totalSourceRows = 0;
  let fileCount = 0;
  const subjectCounts: Record<string, number> = {};
  const skippedReasons: Record<string, number> = {};

  const directories = [
    'pssa/school', 'pssa/district', 'pssa/state',
    'keystone/school', 'keystone/district', 'keystone/state'
  ];

  console.log('📁 Analyzing Source Files:');
  
  for (const dir of directories) {
    const dirPath = path.join(sourcesPath, dir);
    if (!fs.existsSync(dirPath)) continue;

    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.xlsx'));
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const workbook = xlsx.readFile(filePath);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null }) as any[][];
      
      fileCount++;
      const dataRows = data.length - 7; // Assuming header rows
      totalSourceRows += Math.max(0, dataRows);
      
      // Sample first data row to check subjects
      if (data.length > 7) {
        const headerRow = data[6]; // Typical header row
        const subjectCol = headerRow?.findIndex((h: any) => 
          String(h).toLowerCase().includes('subject')
        );
        
        if (subjectCol >= 0) {
          for (let i = 7; i < Math.min(data.length, 100); i++) {
            const subject = data[i][subjectCol];
            if (subject) {
              const subjectStr = String(subject).trim();
              subjectCounts[subjectStr] = (subjectCounts[subjectStr] || 0) + 1;
            }
          }
        }
      }
    }
  }

  console.log(`  Files analyzed: ${fileCount}`);
  console.log(`  Estimated total rows: ${totalSourceRows.toLocaleString()}\n`);

  // Calculate potential skipped records
  const importedTotal = pssaCount.count + keystoneCount.count;
  const estimatedSkipped = Math.max(0, totalSourceRows - importedTotal);
  
  console.log('⚠️  Import Analysis:');
  console.log(`  Estimated rows in source files: ${totalSourceRows.toLocaleString()}`);
  console.log(`  Actually imported: ${importedTotal.toLocaleString()}`);
  console.log(`  Potentially skipped: ${estimatedSkipped.toLocaleString()} (${((estimatedSkipped/totalSourceRows)*100).toFixed(1)}%)\n`);

  // Show unique subjects found
  console.log('📚 Subjects Found in Sample:');
  const sortedSubjects = Object.entries(subjectCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
  
  for (const [subject, count] of sortedSubjects) {
    console.log(`  "${subject}": ${count} occurrences`);
  }

  // Check what's actually in the database
  console.log('\n📈 Database Subject Distribution:');
  const pssaSubjects = await db.select({
    subject: sql`subject`,
    count: sql<number>`count(*)`
  }).from(sql`pssa_results`).groupBy(sql`subject`);
  
  for (const row of pssaSubjects) {
    console.log(`  ${row.subject}: ${row.count.toLocaleString()} records`);
  }

  // Reasons for skipping
  console.log('\n❌ Common Reasons for Skipping:');
  console.log('  1. Non-standard subject names (not Math/ELA/Science for PSSA)');
  console.log('  2. Missing critical fields (year, subject, grade)');
  console.log('  3. Invalid or malformed data');
  console.log('  4. Duplicate records');
  console.log('  5. Header/summary rows mistaken as data');
  
  // Check for grade 4 Science specifically
  const grade4Science = await db.select({
    year: sql`year`,
    count: sql<number>`count(*)`
  }).from(sql`pssa_results`)
    .where(sql`grade = 4 AND subject = 'Science'`)
    .groupBy(sql`year`);
  
  console.log('\n🔬 Grade 4 Science Check:');
  if (grade4Science.length === 0) {
    console.log('  ⚠️ No Grade 4 Science records found (these exist in source files)');
  } else {
    for (const row of grade4Science) {
      console.log(`  Year ${row.year}: ${row.count} records`);
    }
  }

  // Close connection if needed
}

analyzeImport().catch(console.error);