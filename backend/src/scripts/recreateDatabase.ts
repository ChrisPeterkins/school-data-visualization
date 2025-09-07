import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { 
  counties, 
  districts, 
  schools, 
  pssaResults, 
  keystoneResults, 
  dataImports,
  searchViewSQL 
} from '../db/newSchema';
import { sql } from 'drizzle-orm';

async function recreateDatabase() {
  console.log('🔄 RECREATING DATABASE WITH NEW SCHEMA\n');
  console.log('=' .repeat(80));
  
  const dbPath = path.join(process.cwd(), 'school-data.db');
  
  // Step 1: Backup existing database if it exists
  if (fs.existsSync(dbPath)) {
    const backupPath = path.join(process.cwd(), `school-data.backup.${Date.now()}.db`);
    console.log(`📦 Backing up existing database to: ${path.basename(backupPath)}`);
    fs.copyFileSync(dbPath, backupPath);
    
    // Step 2: Delete existing database
    console.log('🗑️  Removing existing database...');
    fs.unlinkSync(dbPath);
  }
  
  // Step 3: Create new database with new schema
  console.log('✨ Creating new database with updated schema...\n');
  
  const sqlite = new Database(dbPath);
  const db = drizzle(sqlite);
  
  // Create tables
  console.log('📊 Creating tables:');
  
  // Counties table
  console.log('  ✓ Creating counties table...');
  db.run(sql`
    CREATE TABLE IF NOT EXISTS counties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      county_code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      full_name TEXT,
      latitude REAL,
      longitude REAL,
      population INTEGER,
      created_at INTEGER DEFAULT CURRENT_TIMESTAMP,
      updated_at INTEGER DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(sql`CREATE INDEX IF NOT EXISTS county_name_idx ON counties(name)`);
  db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS county_code_idx ON counties(county_code)`);
  
  // Districts table
  console.log('  ✓ Creating districts table...');
  db.run(sql`
    CREATE TABLE IF NOT EXISTS districts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      aun TEXT NOT NULL UNIQUE,
      county_id INTEGER NOT NULL REFERENCES counties(id),
      name TEXT NOT NULL,
      short_name TEXT,
      district_type TEXT,
      address TEXT,
      city TEXT,
      state TEXT DEFAULT 'PA',
      zip_code TEXT,
      phone_number TEXT,
      website_url TEXT,
      total_schools INTEGER DEFAULT 0,
      total_enrollment INTEGER,
      is_active INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT CURRENT_TIMESTAMP,
      updated_at INTEGER DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS district_aun_idx ON districts(aun)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS district_name_idx ON districts(name)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS district_county_idx ON districts(county_id)`);
  
  // Schools table
  console.log('  ✓ Creating schools table...');
  db.run(sql`
    CREATE TABLE IF NOT EXISTS schools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_number TEXT NOT NULL,
      district_id INTEGER NOT NULL REFERENCES districts(id),
      name TEXT NOT NULL,
      school_type TEXT,
      grade_range TEXT,
      is_charter INTEGER DEFAULT 0,
      address TEXT,
      city TEXT,
      state TEXT DEFAULT 'PA',
      zip_code TEXT,
      latitude REAL,
      longitude REAL,
      phone_number TEXT,
      website_url TEXT,
      enrollment INTEGER,
      is_active INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT CURRENT_TIMESTAMP,
      updated_at INTEGER DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS school_unique_idx ON schools(school_number, district_id)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS school_name_idx ON schools(name)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS school_district_idx ON schools(district_id)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS school_location_idx ON schools(latitude, longitude)`);
  
  // PSSA Results table
  console.log('  ✓ Creating pssa_results table...');
  db.run(sql`
    CREATE TABLE IF NOT EXISTS pssa_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT NOT NULL,
      school_id INTEGER REFERENCES schools(id),
      district_id INTEGER REFERENCES districts(id),
      county_id INTEGER REFERENCES counties(id),
      year INTEGER NOT NULL,
      grade INTEGER,
      subject TEXT NOT NULL,
      demographic_group TEXT NOT NULL DEFAULT 'All Students',
      total_tested INTEGER,
      advanced_count INTEGER,
      proficient_count INTEGER,
      basic_count INTEGER,
      below_basic_count INTEGER,
      advanced_percent REAL,
      proficient_percent REAL,
      basic_percent REAL,
      below_basic_percent REAL,
      proficient_or_above_percent REAL,
      growth_score REAL,
      growth_percentile REAL,
      source_file TEXT,
      imported_at INTEGER DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(sql`CREATE INDEX IF NOT EXISTS pssa_level_idx ON pssa_results(level)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS pssa_year_idx ON pssa_results(year)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS pssa_subject_idx ON pssa_results(subject)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS pssa_grade_idx ON pssa_results(grade)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS pssa_demographic_idx ON pssa_results(demographic_group)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS pssa_school_idx ON pssa_results(school_id)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS pssa_district_idx ON pssa_results(district_id)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS pssa_county_idx ON pssa_results(county_id)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS pssa_composite_idx ON pssa_results(year, subject, grade, level, demographic_group)`);
  
  // Keystone Results table
  console.log('  ✓ Creating keystone_results table...');
  db.run(sql`
    CREATE TABLE IF NOT EXISTS keystone_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT NOT NULL,
      school_id INTEGER REFERENCES schools(id),
      district_id INTEGER REFERENCES districts(id),
      county_id INTEGER REFERENCES counties(id),
      year INTEGER NOT NULL,
      subject TEXT NOT NULL,
      grade INTEGER DEFAULT 11,
      demographic_group TEXT NOT NULL DEFAULT 'All Students',
      total_tested INTEGER,
      advanced_count INTEGER,
      proficient_count INTEGER,
      basic_count INTEGER,
      below_basic_count INTEGER,
      advanced_percent REAL,
      proficient_percent REAL,
      basic_percent REAL,
      below_basic_percent REAL,
      proficient_or_above_percent REAL,
      growth_score REAL,
      growth_percentile REAL,
      source_file TEXT,
      imported_at INTEGER DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(sql`CREATE INDEX IF NOT EXISTS keystone_level_idx ON keystone_results(level)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS keystone_year_idx ON keystone_results(year)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS keystone_subject_idx ON keystone_results(subject)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS keystone_demographic_idx ON keystone_results(demographic_group)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS keystone_school_idx ON keystone_results(school_id)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS keystone_district_idx ON keystone_results(district_id)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS keystone_county_idx ON keystone_results(county_id)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS keystone_composite_idx ON keystone_results(year, subject, level, demographic_group)`);
  
  // Data imports log table
  console.log('  ✓ Creating data_imports table...');
  db.run(sql`
    CREATE TABLE IF NOT EXISTS data_imports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_type TEXT,
      level TEXT,
      year INTEGER,
      total_rows INTEGER,
      processed_rows INTEGER,
      inserted_rows INTEGER,
      skipped_rows INTEGER,
      error_rows INTEGER,
      status TEXT NOT NULL,
      error_message TEXT,
      started_at INTEGER,
      completed_at INTEGER,
      imported_at INTEGER DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(sql`CREATE INDEX IF NOT EXISTS import_file_name_idx ON data_imports(file_name)`);
  db.run(sql`CREATE INDEX IF NOT EXISTS import_status_idx ON data_imports(status)`);
  
  // Create search view
  console.log('  ✓ Creating search view...');
  db.run(searchViewSQL);
  
  console.log('\n✅ Database recreated successfully!');
  console.log(`📍 Location: ${dbPath}`);
  
  // Close the database
  sqlite.close();
  
  console.log('\n📝 Next steps:');
  console.log('  1. Run the new importer to populate the database');
  console.log('  2. Verify all counties, districts, and schools are imported');
  console.log('  3. Verify demographic data is properly captured');
  console.log('  4. Update API endpoints to filter for "All Students" by default');
}

recreateDatabase().catch(console.error);