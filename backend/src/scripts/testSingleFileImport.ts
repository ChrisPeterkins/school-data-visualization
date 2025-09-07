import { NewDataImporter } from '../services/newDataImporter';
import * as path from 'path';

async function testImport() {
  console.log('🧪 Testing single file import...\n');
  
  const importer = new NewDataImporter();
  
  // Load counties first
  await (importer as any).loadCounties();
  
  // Import just one file
  const testFile = path.join(
    process.cwd(), 
    '..', 
    'sources', 
    'pssa', 
    'school',
    '2024-pssa-school-data.xlsx'
  );
  
  console.log(`📄 Importing: ${path.basename(testFile)}`);
  const result = await (importer as any).importFile(testFile, 'pssa/school');
  
  console.log(`\n✅ Results:`);
  console.log(`  Records processed: ${result.processed}`);
  console.log(`  Records skipped: ${result.skipped}`);
  console.log(`  Districts created: ${(importer as any).districtMap.size}`);
  console.log(`  Schools created: ${(importer as any).schoolMap.size}`);
  
  // Sample some districts
  if ((importer as any).districtMap.size > 0) {
    console.log('\n📚 Sample districts:');
    const districts = Array.from((importer as any).districtMap.keys()).slice(0, 5);
    districts.forEach((d: string) => console.log(`  - ${d}`));
  }
  
  // Sample some schools
  if ((importer as any).schoolMap.size > 0) {
    console.log('\n🏫 Sample schools:');
    const schools = Array.from((importer as any).schoolMap.keys()).slice(0, 5);
    schools.forEach((s: string) => console.log(`  - ${s}`));
  }
}

testImport().catch(console.error);