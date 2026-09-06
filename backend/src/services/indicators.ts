import { sqliteDb } from '../db';

/**
 * Non-assessment measures: Future Ready PA Index indicators, cohort
 * graduation rates, October 1 enrollment, and AFR district spending.
 * Years follow the assessment convention: SY 2024-25 is year 2025.
 */
export const INDICATORS = {
  regular_attendance: 'Regular attendance',
  chronic_absenteeism: 'Chronic absenteeism',
  grad_rate_4yr: '4-year graduation rate',
  grad_rate_5yr: '5-year graduation rate',
  career_benchmark: 'Career standards benchmark',
  rigorous_courses: 'Rigorous courses of study',
  industry_learning: 'Industry-based learning',
  postsecondary_transition: 'Post-secondary transition',
  english_proficiency: 'English learner proficiency',
  grade3_reading: 'Grade 3 reading',
  grade7_math: 'Grade 7 math',
} as const;
export type Indicator = keyof typeof INDICATORS;

export function ensureIndicatorTables() {
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS entity_indicators (
      year INTEGER NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      indicator TEXT NOT NULL,
      value REAL,
      n INTEGER,
      state_value REAL,
      source_file TEXT,
      PRIMARY KEY (year, entity_type, entity_id, indicator)
    );
    CREATE INDEX IF NOT EXISTS entity_indicators_lookup ON entity_indicators(entity_type, entity_id, indicator, year);
    CREATE TABLE IF NOT EXISTS enrollments (
      year INTEGER NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      total INTEGER NOT NULL,
      source_file TEXT,
      PRIMARY KEY (year, entity_type, entity_id)
    );
    CREATE TABLE IF NOT EXISTS district_finance (
      year INTEGER NOT NULL,
      district_id INTEGER NOT NULL,
      total_expenditures REAL,
      instruction REAL,
      support_services REAL,
      adm REAL,
      wadm REAL,
      per_pupil REAL,
      instruction_per_pupil REAL,
      source_file TEXT,
      PRIMARY KEY (year, district_id)
    );
  `);
}
