import * as XLSX from 'xlsx';

const file = process.argv[2];
const workbook = XLSX.readFile(file);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet);

const subjects = new Set<string>();
const columns = new Set<string>();

for (const row of data as any[]) {
  // Collect all column names
  Object.keys(row).forEach(k => columns.add(k));

  const subject = row['Subject'] || row['subject'];
  if (subject) {
    subjects.add(subject);
  }
}

console.log(`\nFile: ${file.split('/').pop()}`);
console.log(`Total rows: ${data.length}`);
console.log(`\nColumns found (${columns.size}):`);
Array.from(columns).sort().forEach(c => console.log(`  - ${c}`));
console.log(`\nUnique subjects found (${subjects.size}):`);
if (subjects.size > 0) {
  Array.from(subjects).sort().forEach(s => console.log(`  - ${s}`));
} else {
  console.log('  (No subject column found)');
}
