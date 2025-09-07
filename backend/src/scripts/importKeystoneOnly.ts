import { NewDataImporter } from '../services/newDataImporter';
import * as path from 'path';

async function importKeystoneFiles() {
  console.log('🎯 Importing missing Keystone files only...\n');
  
  const importer = new NewDataImporter();
  
  // Load counties (should already be loaded)
  await (importer as any).loadCounties();
  
  // List of Keystone files that were skipped
  const keystoneFiles = [
    // School level
    { file: '2015 keystone exam school level data.xlsx', dir: 'keystone/school' },
    { file: '2016 keystone exams school level data.xlsx', dir: 'keystone/school' },
    { file: '2017 keystone exams school level data.xlsx', dir: 'keystone/school' },
    { file: '2018 keystone exams school level data.xlsx', dir: 'keystone/school' },
    { file: '2019 keystone exams school level data.xlsx', dir: 'keystone/school' },
    { file: '2024-keystone-exams-school-grade-11-data.xlsx', dir: 'keystone/school' },
    
    // District level  
    { file: '2015 keystone district data.xlsx', dir: 'keystone/district' },
    { file: '2016 keystone district data.xlsx', dir: 'keystone/district' },
    { file: '2017 keystone district data.xlsx', dir: 'keystone/district' },
    { file: '2018 keystone district data.xlsx', dir: 'keystone/district' },
    { file: '2019 keystone district data.xlsx', dir: 'keystone/district' },
    { file: '2021 keystone district data.xlsx', dir: 'keystone/district' },
    { file: '2022 keystone district data.xlsx', dir: 'keystone/district' },
    { file: '2024-keystone-exams-district-grade-11-data.xlsx', dir: 'keystone/district' },
    
    // State level
    { file: '2015 keystone exam state level data.xlsx', dir: 'keystone/state' },
    { file: '2016 keystone exams state level data.xlsx', dir: 'keystone/state' },
    { file: '2017 keystone exams state level data.xlsx', dir: 'keystone/state' },
    { file: '2018 keystone exams state level data.xlsx', dir: 'keystone/state' },
    { file: '2019 keystone exams state level data.xlsx', dir: 'keystone/state' },
    { file: '2021 keystone grade 11 state level data.xlsx', dir: 'keystone/state' },
    { file: '2022 keystone exams state level data.xlsx', dir: 'keystone/state' },
    { file: '2024-keystone-exams-state-data-grade-11.xlsx', dir: 'keystone/state' }
  ];
  
  let totalProcessed = 0;
  let totalSkipped = 0;
  
  for (const { file, dir } of keystoneFiles) {
    const filePath = path.join(process.cwd(), '..', 'sources', dir, file);
    
    console.log(`\n📄 Processing: ${file}`);
    try {
      const result = await (importer as any).importFile(filePath, dir);
      console.log(`   ✓ Imported ${result.processed} records (skipped ${result.skipped})`);
      totalProcessed += result.processed;
      totalSkipped += result.skipped;
    } catch (error) {
      console.log(`   ❌ Error: ${error}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 KEYSTONE IMPORT SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Total records imported: ${totalProcessed}`);
  console.log(`⚠️  Total records skipped: ${totalSkipped}`);
  console.log(`🏫 Districts created/updated: ${(importer as any).districtMap.size}`);
  console.log(`📚 Schools created/updated: ${(importer as any).schoolMap.size}`);
}

importKeystoneFiles().catch(console.error);