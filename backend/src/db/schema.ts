import {
  sqliteTable,
  integer,
  text,
  real,
  index,
} from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

export const districts = sqliteTable('districts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  districtId: text('district_id').notNull().unique(),
  name: text('name').notNull(),
  county: text('county'),
  intermediateUnit: text('intermediate_unit'),
  websiteUrl: text('website_url'),
  totalEnrollment: integer('total_enrollment'),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
}, (table) => ({
  districtIdIdx: index('district_id_idx').on(table.districtId),
  nameIdx: index('district_name_idx').on(table.name),
}));

export const schools = sqliteTable('schools', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  schoolId: text('school_id').notNull().unique(),
  districtId: text('district_id').notNull(),
  name: text('name').notNull(),
  schoolType: text('school_type'),
  gradeRange: text('grade_range'),
  address: text('address'),
  city: text('city'),
  state: text('state').default('PA'),
  zipCode: text('zip_code'),
  latitude: real('latitude'),
  longitude: real('longitude'),
  phoneNumber: text('phone_number'),
  websiteUrl: text('website_url'),
  enrollment: integer('enrollment'),
  isCharter: integer('is_charter', { mode: 'boolean' }).default(false),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
}, (table) => ({
  schoolIdIdx: index('school_id_idx').on(table.schoolId),
  districtIdIdx: index('school_district_id_idx').on(table.districtId),
  nameIdx: index('school_name_idx').on(table.name),
  locationIdx: index('school_location_idx').on(table.latitude, table.longitude),
}));

export const pssaResults = sqliteTable('pssa_results', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  schoolId: text('school_id'),
  districtId: text('district_id'),
  year: integer('year').notNull(),
  grade: integer('grade'), // Nullable for state-level data
  subject: text('subject').notNull(),
  level: text('level').notNull(), // school, district, state
  totalTested: integer('total_tested'),
  advancedCount: integer('advanced_count'),
  proficientCount: integer('proficient_count'),
  basicCount: integer('basic_count'),
  belowBasicCount: integer('below_basic_count'),
  advancedPercent: real('advanced_percent'),
  proficientPercent: real('proficient_percent'),
  basicPercent: real('basic_percent'),
  belowBasicPercent: real('below_basic_percent'),
  proficientOrAbovePercent: real('proficient_or_above_percent'),
  growthScore: real('growth_score'),
  createdAt: integer('created_at', { mode: 'timestamp' }),
}, (table) => ({
  schoolIdIdx: index('pssa_school_id_idx').on(table.schoolId),
  districtIdIdx: index('pssa_district_id_idx').on(table.districtId),
  yearIdx: index('pssa_year_idx').on(table.year),
  subjectGradeIdx: index('pssa_subject_grade_idx').on(table.subject, table.grade),
}));

export const keystoneResults = sqliteTable('keystone_results', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  schoolId: text('school_id'),
  districtId: text('district_id'),
  year: integer('year').notNull(),
  subject: text('subject').notNull(), // Algebra I, Biology, Literature
  level: text('level').notNull(), // school, district, state
  grade: integer('grade').default(11),
  totalTested: integer('total_tested'),
  advancedCount: integer('advanced_count'),
  proficientCount: integer('proficient_count'),
  basicCount: integer('basic_count'),
  belowBasicCount: integer('below_basic_count'),
  advancedPercent: real('advanced_percent'),
  proficientPercent: real('proficient_percent'),
  basicPercent: real('basic_percent'),
  belowBasicPercent: real('below_basic_percent'),
  proficientOrAbovePercent: real('proficient_or_above_percent'),
  growthScore: real('growth_score'),
  createdAt: integer('created_at', { mode: 'timestamp' }),
}, (table) => ({
  schoolIdIdx: index('keystone_school_id_idx').on(table.schoolId),
  districtIdIdx: index('keystone_district_id_idx').on(table.districtId),
  yearIdx: index('keystone_year_idx').on(table.year),
  subjectIdx: index('keystone_subject_idx').on(table.subject),
}));

export const dataImports = sqliteTable('data_imports', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  fileName: text('file_name').notNull(),
  fileType: text('file_type').notNull(),
  year: integer('year'),
  testType: text('test_type'),
  level: text('level'),
  status: text('status').default('pending'),
  recordsProcessed: integer('records_processed').default(0),
  errors: text('errors'),
  importedAt: integer('imported_at', { mode: 'timestamp' }),
}, (table) => ({
  statusIdx: index('import_status_idx').on(table.status),
}));

// Relations
export const districtsRelations = relations(districts, ({ many }) => ({
  schools: many(schools),
}));

export const schoolsRelations = relations(schools, ({ one, many }) => ({
  district: one(districts, {
    fields: [schools.districtId],
    references: [districts.districtId],
  }),
  pssaResults: many(pssaResults),
  keystoneResults: many(keystoneResults),
}));

export const pssaResultsRelations = relations(pssaResults, ({ one }) => ({
  school: one(schools, {
    fields: [pssaResults.schoolId],
    references: [schools.schoolId],
  }),
  district: one(districts, {
    fields: [pssaResults.districtId],
    references: [districts.districtId],
  }),
}));

export const keystoneResultsRelations = relations(keystoneResults, ({ one }) => ({
  school: one(schools, {
    fields: [keystoneResults.schoolId],
    references: [schools.schoolId],
  }),
  district: one(districts, {
    fields: [keystoneResults.districtId],
    references: [districts.districtId],
  }),
}));