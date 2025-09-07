import { sqliteTable, text, integer, real, index, uniqueIndex, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * NEW DATABASE SCHEMA DESIGN
 * 
 * Hierarchy: State > County > District > School
 * 
 * Key Principles:
 * 1. Counties are first-class entities (people search by county)
 * 2. Districts belong to counties
 * 3. Schools belong to districts
 * 4. Test results can be at any level (school/district/county/state)
 * 5. All names are searchable
 */

// COUNTIES TABLE - Pennsylvania has 67 counties
export const counties = sqliteTable('counties', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  countyCode: text('county_code').notNull().unique(), // e.g., "109" for Bucks
  name: text('name').notNull(), // e.g., "Bucks"
  fullName: text('full_name'), // e.g., "Bucks County"
  // Geographic data
  latitude: real('latitude'),
  longitude: real('longitude'),
  population: integer('population'),
  // Metadata
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`)
}, (table) => {
  return {
    nameIdx: index('county_name_idx').on(table.name),
    codeIdx: uniqueIndex('county_code_idx').on(table.countyCode)
  };
});

// DISTRICTS TABLE
export const districts = sqliteTable('districts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  aun: text('aun').notNull().unique(), // Administrative Unit Number (e.g., "109420803")
  countyId: integer('county_id').notNull().references(() => counties.id),
  name: text('name').notNull(), // e.g., "Central Bucks School District"
  shortName: text('short_name'), // e.g., "Central Bucks SD"
  districtType: text('district_type'), // "Public", "Charter", "IU", etc.
  // Contact info
  address: text('address'),
  city: text('city'),
  state: text('state').default('PA'),
  zipCode: text('zip_code'),
  phoneNumber: text('phone_number'),
  websiteUrl: text('website_url'),
  // Statistics
  totalSchools: integer('total_schools').default(0),
  totalEnrollment: integer('total_enrollment'),
  // Metadata
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`)
}, (table) => {
  return {
    aunIdx: uniqueIndex('district_aun_idx').on(table.aun),
    nameIdx: index('district_name_idx').on(table.name),
    countyIdx: index('district_county_idx').on(table.countyId)
  };
});

// SCHOOLS TABLE
export const schools = sqliteTable('schools', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  schoolNumber: text('school_number').notNull(), // e.g., "000001234"
  districtId: integer('district_id').notNull().references(() => districts.id),
  name: text('name').notNull(), // e.g., "Doyle Elementary School"
  // School details
  schoolType: text('school_type'), // Elementary, Middle, High, etc.
  gradeRange: text('grade_range'), // e.g., "K-5"
  isCharter: integer('is_charter', { mode: 'boolean' }).default(false),
  // Contact info
  address: text('address'),
  city: text('city'),
  state: text('state').default('PA'),
  zipCode: text('zip_code'),
  latitude: real('latitude'),
  longitude: real('longitude'),
  phoneNumber: text('phone_number'),
  websiteUrl: text('website_url'),
  // Statistics
  enrollment: integer('enrollment'),
  // Metadata
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`)
}, (table) => {
  return {
    uniqueSchool: uniqueIndex('school_unique_idx').on(table.schoolNumber, table.districtId),
    nameIdx: index('school_name_idx').on(table.name),
    districtIdx: index('school_district_idx').on(table.districtId),
    locationIdx: index('school_location_idx').on(table.latitude, table.longitude)
  };
});

// PSSA RESULTS TABLE
export const pssaResults = sqliteTable('pssa_results', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  
  // Level and entity reference
  level: text('level').notNull(), // 'school', 'district', 'county', 'state'
  schoolId: integer('school_id').references(() => schools.id),
  districtId: integer('district_id').references(() => districts.id),
  countyId: integer('county_id').references(() => counties.id),
  
  // Test details
  year: integer('year').notNull(),
  grade: integer('grade'), // Can be null for aggregated data
  subject: text('subject').notNull(), // Mathematics, English Language Arts, Science
  
  // Demographic breakdown
  demographicGroup: text('demographic_group').notNull().default('All Students'), // All Students, Male, Female, White, Black, Hispanic, Asian, IEP, Economically Disadvantaged, etc.
  
  // Results
  totalTested: integer('total_tested'),
  advancedCount: integer('advanced_count'),
  proficientCount: integer('proficient_count'),
  basicCount: integer('basic_count'),
  belowBasicCount: integer('below_basic_count'),
  
  // Percentages
  advancedPercent: real('advanced_percent'),
  proficientPercent: real('proficient_percent'),
  basicPercent: real('basic_percent'),
  belowBasicPercent: real('below_basic_percent'),
  proficientOrAbovePercent: real('proficient_or_above_percent'),
  
  // Growth metrics
  growthScore: real('growth_score'),
  growthPercentile: real('growth_percentile'),
  
  // Metadata
  sourceFile: text('source_file'),
  importedAt: integer('imported_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`)
}, (table) => {
  return {
    levelIdx: index('pssa_level_idx').on(table.level),
    yearIdx: index('pssa_year_idx').on(table.year),
    subjectIdx: index('pssa_subject_idx').on(table.subject),
    gradeIdx: index('pssa_grade_idx').on(table.grade),
    demographicIdx: index('pssa_demographic_idx').on(table.demographicGroup),
    schoolIdx: index('pssa_school_idx').on(table.schoolId),
    districtIdx: index('pssa_district_idx').on(table.districtId),
    countyIdx: index('pssa_county_idx').on(table.countyId),
    compositeIdx: index('pssa_composite_idx').on(
      table.year, table.subject, table.grade, table.level, table.demographicGroup
    )
  };
});

// KEYSTONE RESULTS TABLE
export const keystoneResults = sqliteTable('keystone_results', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  
  // Level and entity reference
  level: text('level').notNull(), // 'school', 'district', 'county', 'state'
  schoolId: integer('school_id').references(() => schools.id),
  districtId: integer('district_id').references(() => districts.id),
  countyId: integer('county_id').references(() => counties.id),
  
  // Test details
  year: integer('year').notNull(),
  subject: text('subject').notNull(), // Algebra I, Biology, Literature
  grade: integer('grade').default(11), // Keystone is typically grade 11
  
  // Demographic breakdown
  demographicGroup: text('demographic_group').notNull().default('All Students'), // All Students, Male, Female, White, Black, Hispanic, Asian, IEP, Economically Disadvantaged, etc.
  
  // Results
  totalTested: integer('total_tested'),
  advancedCount: integer('advanced_count'),
  proficientCount: integer('proficient_count'),
  basicCount: integer('basic_count'),
  belowBasicCount: integer('below_basic_count'),
  
  // Percentages
  advancedPercent: real('advanced_percent'),
  proficientPercent: real('proficient_percent'),
  basicPercent: real('basic_percent'),
  belowBasicPercent: real('below_basic_percent'),
  proficientOrAbovePercent: real('proficient_or_above_percent'),
  
  // Growth metrics
  growthScore: real('growth_score'),
  growthPercentile: real('growth_percentile'),
  
  // Metadata
  sourceFile: text('source_file'),
  importedAt: integer('imported_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`)
}, (table) => {
  return {
    levelIdx: index('keystone_level_idx').on(table.level),
    yearIdx: index('keystone_year_idx').on(table.year),
    subjectIdx: index('keystone_subject_idx').on(table.subject),
    demographicIdx: index('keystone_demographic_idx').on(table.demographicGroup),
    schoolIdx: index('keystone_school_idx').on(table.schoolId),
    districtIdx: index('keystone_district_idx').on(table.districtId),
    countyIdx: index('keystone_county_idx').on(table.countyId),
    compositeIdx: index('keystone_composite_idx').on(
      table.year, table.subject, table.level, table.demographicGroup
    )
  };
});

// DATA IMPORT LOG TABLE
export const dataImports = sqliteTable('data_imports', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  fileName: text('file_name').notNull(),
  filePath: text('file_path').notNull(),
  fileType: text('file_type'), // 'pssa' or 'keystone'
  level: text('level'), // 'school', 'district', 'county', 'state'
  year: integer('year'),
  
  // Import stats
  totalRows: integer('total_rows'),
  processedRows: integer('processed_rows'),
  insertedRows: integer('inserted_rows'),
  skippedRows: integer('skipped_rows'),
  errorRows: integer('error_rows'),
  
  // Status
  status: text('status').notNull(), // 'pending', 'processing', 'completed', 'failed'
  errorMessage: text('error_message'),
  
  // Timing
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  importedAt: integer('imported_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`)
}, (table) => {
  return {
    fileNameIdx: index('import_file_name_idx').on(table.fileName),
    statusIdx: index('import_status_idx').on(table.status)
  };
});

// SEARCH VIEW for fast lookups
export const searchViewSQL = sql`
CREATE VIEW IF NOT EXISTS search_view AS
SELECT 
  'school' as entity_type,
  s.id as entity_id,
  s.name as name,
  d.name as district_name,
  c.name as county_name,
  s.name || ' ' || d.name || ' ' || c.name as search_text
FROM schools s
JOIN districts d ON s.district_id = d.id
JOIN counties c ON d.county_id = c.id
WHERE s.is_active = 1

UNION ALL

SELECT 
  'district' as entity_type,
  d.id as entity_id,
  d.name as name,
  d.name as district_name,
  c.name as county_name,
  d.name || ' ' || c.name as search_text
FROM districts d
JOIN counties c ON d.county_id = c.id
WHERE d.is_active = 1

UNION ALL

SELECT 
  'county' as entity_type,
  c.id as entity_id,
  c.name as name,
  NULL as district_name,
  c.name as county_name,
  c.name || ' ' || c.full_name as search_text
FROM counties c;
`;