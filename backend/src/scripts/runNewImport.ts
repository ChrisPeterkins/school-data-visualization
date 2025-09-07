import { NewDataImporter } from '../services/newDataImporter';

async function runImport() {
  console.log('🚀 Starting comprehensive data import with new importer...\n');
  
  const startTime = Date.now();
  const importer = new NewDataImporter();
  
  try {
    await importer.importAllFiles();
    
    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
    console.log(`\n✅ Import completed in ${duration} minutes`);
    
  } catch (error) {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  }
}

runImport().catch(console.error);