/**
 * Precomputed map points. The map draws one dot per located school with the
 * all-grades result for a given year/exam/subject; joining that on every
 * request is slow, so a table holds it per (year, exam, subject) and is
 * refreshed after each import or metadata update.
 */
import { sqliteDb } from '../db';
import { logger } from '../utils/logger';

export const MAP_SUBJECTS: Record<'pssa' | 'keystone', string[]> = {
  pssa: ['Mathematics', 'English Language Arts', 'Science'],
  keystone: ['Algebra I', 'Biology', 'Literature'],
};

export function ensureMapPointsTable(): void {
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS school_map_points (
      year INTEGER NOT NULL,
      exam TEXT NOT NULL,
      subject TEXT NOT NULL,
      school_id INTEGER NOT NULL,
      proficiency REAL,
      growth REAL,
      tested INTEGER,
      PRIMARY KEY (year, exam, subject, school_id)
    );
    CREATE INDEX IF NOT EXISTS school_map_points_key ON school_map_points(year, exam, subject);
  `);
}

/** Rebuild every (year, exam, subject) slice, or just the given year. */
export function refreshMapPoints(year?: number): number {
  ensureMapPointsTable();
  const del = year
    ? sqliteDb.prepare(`DELETE FROM school_map_points WHERE year = ?`)
    : sqliteDb.prepare(`DELETE FROM school_map_points`);
  const insert = (exam: 'pssa' | 'keystone') => sqliteDb.prepare(`
    INSERT OR REPLACE INTO school_map_points (year, exam, subject, school_id, proficiency, growth, tested)
    SELECT r.year, '${exam}', r.subject, r.school_id, r.proficient_or_above_percent, r.growth_score, r.total_tested
    FROM ${exam === 'pssa' ? 'pssa_results' : 'keystone_results'} r
    JOIN schools s ON s.id = r.school_id
    WHERE r.level = 'school' AND r.demographic_group = 'All Students'
      AND s.latitude IS NOT NULL AND s.longitude IS NOT NULL
      ${exam === 'pssa' ? 'AND r.grade = 0' : ''}
      ${year ? 'AND r.year = ?' : ''}
  `);
  const txn = sqliteDb.transaction(() => {
    year ? del.run(year) : del.run();
    let n = 0;
    for (const exam of ['pssa', 'keystone'] as const) {
      n += (year ? insert(exam).run(year) : insert(exam).run()).changes;
    }
    return n;
  });
  const n = txn();
  logger.info(`school_map_points: ${n} rows refreshed${year ? ` for ${year}` : ''}`);
  return n;
}
