import * as XLSX from 'xlsx';
import * as path from 'path';
import { sqliteDb } from '../db';
import { logger } from '../utils/logger';

interface PVAASRecord {
  aun: string;
  schoolNumber?: string;
  year: string;
  subject: string;
  grade: string | number;
  growthIndex: number;
  growthMeasure: number;
  effectSize: number;
  standardError: number;
  sourceFile: string;
}

// Keystone subjects that map to the keystone_results table
const KEYSTONE_SUBJECTS = ['Algebra I', 'Biology', 'Literature'] as const;

export class PVAASImporter {
  private subjectMapping: { [key: string]: string } = {
    'English Language Arts': 'English Language Arts',
    'ELA': 'English Language Arts',
    'Math': 'Mathematics',
    'Mathematics': 'Mathematics',
    'Science': 'Science',
    'Algebra I': 'Algebra I',
    'Biology': 'Biology',
    'Literature': 'Literature'
  };

  async importPVAASFile(filePath: string, level: 'school' | 'district'): Promise<{ updated: number; skipped: number; inserted: number }> {
    logger.info(`Importing PVAAS file: ${filePath}`);

    logger.info('Reading Excel file...');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    logger.info(`Loaded ${data.length} rows`);

    const sourceFile = path.basename(filePath);

    // Clear any rows previously loaded from this exact file so a re-import
    // (e.g. a corrected PDE release) does not duplicate pvaas_results.
    const cleared = sqliteDb.prepare('DELETE FROM pvaas_results WHERE source_file = ?').run(sourceFile);
    if (cleared.changes > 0) {
      logger.info(`Cleared ${cleared.changes} existing pvaas_results rows for ${sourceFile}`);
    }

    // Parse all records first
    const records: PVAASRecord[] = [];
    let skipped = 0;

    for (const row of data as any[]) {
      try {
        const record = this.parseRow(row, level, sourceFile);
        if (record) {
          records.push(record);
        } else {
          skipped++;
        }
      } catch (error) {
        skipped++;
      }
    }

    logger.info(`Parsed ${records.length} valid records, ${skipped} skipped`);

    // Persist the raw PVAAS detail (growthMeasure/effectSize/standardError per
    // subject/grade) before propagating growth scores onto pssa/keystone tables.
    const inserted = this.batchInsertPVAASResults(records, level);

    // Batch update all records
    let updated = 0;
    if (level === 'school') {
      updated = await this.batchUpdateSchoolRecords(records);
    } else {
      updated = await this.batchUpdateDistrictRecords(records);
    }

    logger.info(`PVAAS import complete: ${inserted} inserted into pvaas_results, ${updated} propagated to pssa/keystone`);
    return { updated, skipped, inserted };
  }

  /**
   * Inserts all parsed PVAAS records into the new pvaas_results table. This
   * preserves the full per-subject/per-grade growth detail (growthMeasure,
   * effectSize, standardError, growthIndex/growthScore) that was previously
   * dropped when only the growth score was propagated onto pssa/keystone rows.
   */
  private batchInsertPVAASResults(records: PVAASRecord[], level: 'school' | 'district'): number {
    if (records.length === 0) return 0;

    const sqlite = sqliteDb;

    // Build lookup maps so we can attach schoolId/districtId when available
    const schoolLookup = new Map<string, number>();
    const districtLookup = new Map<string, number>();

    const schoolsData = sqlite.prepare(`
      SELECT s.id, d.aun, s.school_number
      FROM schools s
      INNER JOIN districts d ON d.id = s.district_id
    `).all() as Array<{ id: number; aun: string; school_number: string }>;
    for (const row of schoolsData) {
      schoolLookup.set(`${row.aun}|${row.school_number}`, row.id);
    }

    const districtsData = sqlite.prepare(`SELECT id, aun FROM districts`).all() as Array<{ id: number; aun: string }>;
    for (const row of districtsData) {
      districtLookup.set(row.aun, row.id);
    }

    const insertStmt = sqlite.prepare(`
      INSERT INTO pvaas_results (
        level, school_id, district_id, aun, school_number,
        year, subject, grade,
        growth_measure, growth_index, effect_size, standard_error, growth_score,
        source_file
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const txn = sqlite.transaction((recs: PVAASRecord[]) => {
      let count = 0;
      for (const r of recs) {
        const schoolId = level === 'school' && r.schoolNumber
          ? schoolLookup.get(`${r.aun}|${r.schoolNumber}`) ?? null
          : null;
        const districtId = districtLookup.get(r.aun) ?? null;
        // Encode "Across Grades" / N/A as NULL so the column is queryable.
        const gradeValue = typeof r.grade === 'number' ? r.grade : null;

        insertStmt.run(
          level,
          schoolId,
          districtId,
          r.aun,
          r.schoolNumber ?? null,
          parseInt(r.year),
          r.subject,
          gradeValue,
          isNaN(r.growthMeasure) ? null : r.growthMeasure,
          isNaN(r.growthIndex) ? null : r.growthIndex,
          isNaN(r.effectSize) ? null : r.effectSize,
          isNaN(r.standardError) ? null : r.standardError,
          isNaN(r.growthIndex) ? null : r.growthIndex, // growth_score alias
          r.sourceFile
        );
        count++;
      }
      return count;
    });

    const inserted = txn(records);
    logger.info(`Inserted ${inserted} rows into pvaas_results (level=${level})`);
    return inserted;
  }

  private parseRow(row: any, level: 'school' | 'district', sourceFile: string): PVAASRecord | null {
    // Extract year. Support either "School Year" as "2023-2024" (old format),
    // or a numeric "School Year" field as in some newer files.
    const schoolYear = row['School Year'] || row['school_year'];
    let year: number | null = null;
    if (schoolYear != null) {
      const s = schoolYear.toString();
      const m = s.match(/(\d{4})-(\d{4})/);
      if (m) {
        year = parseInt(m[2]);
      } else {
        const n = parseInt(s);
        if (!isNaN(n) && n > 2000) year = n;
      }
    }

    if (!year) return null;

    const aun = (row['District AUN'] || row['district_aun'])?.toString();
    const rawSchoolNumber = level === 'school' ? (row['School Number'] || row['school_number'])?.toString() : undefined;
    // Normalize school number to match database format (9 digits with leading zeros)
    const schoolNumber = rawSchoolNumber ? rawSchoolNumber.padStart(9, '0') : undefined;
    const subject = this.normalizeSubject(row['Subject'] || row['subject']);
    // Grade parsing depends on subject: keystone subjects use "N/A" as the
    // across-grades marker (there's only one keystone grade per subject) while
    // PSSA subjects use explicit numeric grades + "Across Grades".
    const grade = this.parseGrade(row['Grade'] || row['grade'], subject);
    const growthIndex = parseFloat(
      row['Growth Index'] ?? row['growth_index'] ?? row['Average Growth Index (AGI)']
    );
    const growthMeasure = parseFloat(row['Growth Measure'] ?? row['growth_measure']);
    const effectSize = parseFloat(row['Effect Size'] ?? row['effect_size']);
    const standardError = parseFloat(row['Standard Error'] ?? row['standard_error']);

    if (!aun || !subject || grade === null || isNaN(growthIndex)) {
      return null;
    }

    return {
      aun,
      schoolNumber,
      year: year.toString(),
      subject,
      grade,
      growthIndex,
      growthMeasure: isNaN(growthMeasure) ? growthIndex : growthMeasure,
      effectSize: isNaN(effectSize) ? 0 : effectSize,
      standardError: isNaN(standardError) ? 0 : standardError,
      sourceFile
    };
  }

  private normalizeSubject(subject: string): string {
    if (!subject) return subject;
    return this.subjectMapping[subject] || subject;
  }

  private parseGrade(grade: any, subject?: string): string | number | null {
    if (grade == null) return null;
    const raw = grade.toString().trim();

    // Explicit across-grades markers
    if (raw === 'Across Grades' || raw === 'All Grades') {
      return 'Across Grades';
    }

    // Keystone files use "N/A" as the across-grades marker (keystone is
    // end-of-course, not grade-banded). Treat that as Across Grades so the
    // growth score gets applied to all keystone rows for the subject/year.
    if (subject && (KEYSTONE_SUBJECTS as readonly string[]).includes(subject) &&
        (raw === 'N/A' || raw === 'NA' || raw === '' || raw === '-')) {
      return 'Across Grades';
    }

    const num = parseInt(raw);
    return isNaN(num) ? null : num;
  }

  private async batchUpdateSchoolRecords(records: PVAASRecord[]): Promise<number> {
    if (records.length === 0) return 0;

    logger.info(`Batch updating ${records.length} school records...`);

    // Separate PSSA and Keystone records
    const pssaRecords = records.filter(r => !['Algebra I', 'Biology', 'Literature'].includes(r.subject));
    const keystoneRecords = records.filter(r => ['Algebra I', 'Biology', 'Literature'].includes(r.subject));

    let totalUpdated = 0;

    // Update PSSA records
    if (pssaRecords.length > 0) {
      logger.info(`Updating ${pssaRecords.length} PSSA records...`);
      totalUpdated += await this.batchUpdateRecords(pssaRecords, 'pssa_results', 'school');
    }

    // Update Keystone records
    if (keystoneRecords.length > 0) {
      logger.info(`Updating ${keystoneRecords.length} Keystone records...`);
      totalUpdated += await this.batchUpdateRecords(keystoneRecords, 'keystone_results', 'school');
    }

    return totalUpdated;
  }

  private async batchUpdateDistrictRecords(records: PVAASRecord[]): Promise<number> {
    if (records.length === 0) return 0;

    logger.info(`Batch updating ${records.length} district records...`);

    // Separate PSSA and Keystone records
    const pssaRecords = records.filter(r => !['Algebra I', 'Biology', 'Literature'].includes(r.subject));
    const keystoneRecords = records.filter(r => ['Algebra I', 'Biology', 'Literature'].includes(r.subject));

    let totalUpdated = 0;

    // Update PSSA records
    if (pssaRecords.length > 0) {
      logger.info(`Updating ${pssaRecords.length} PSSA records...`);
      totalUpdated += await this.batchUpdateRecords(pssaRecords, 'pssa_results', 'district');
    }

    // Update Keystone records
    if (keystoneRecords.length > 0) {
      logger.info(`Updating ${keystoneRecords.length} Keystone records...`);
      totalUpdated += await this.batchUpdateRecords(keystoneRecords, 'keystone_results', 'district');
    }

    return totalUpdated;
  }

  private async batchUpdateRecords(records: PVAASRecord[], tableName: string, level: 'school' | 'district'): Promise<number> {
    // Fast path: stage the resolved records in a temp table, then run 2–3
    // set-based UPDATEs instead of one UPDATE per record. Per-row UPDATEs on a
    // table with ~1M rows scale pathologically and can take an hour for a
    // single source file; the bulk path finishes in seconds.
    if (records.length === 0) return 0;

    const sqlite = sqliteDb;
    const entityCol = level === 'school' ? 'school_id' : 'district_id';
    const isKeystone = tableName === 'keystone_results';

    logger.info(`Building ${level} ID lookup map...`);
    const idLookup = new Map<string, number>();
    if (level === 'school') {
      const rows = sqlite.prepare(`
        SELECT s.id, d.aun, s.school_number
        FROM schools s INNER JOIN districts d ON d.id = s.district_id
      `).all() as Array<{ id: number; aun: string; school_number: string }>;
      for (const r of rows) idLookup.set(`${r.aun}|${r.school_number}`, r.id);
      logger.info(`Loaded ${idLookup.size} school IDs`);
    } else {
      const rows = sqlite.prepare(`SELECT id, aun FROM districts`).all() as Array<{ id: number; aun: string }>;
      for (const r of rows) idLookup.set(r.aun, r.id);
      logger.info(`Loaded ${idLookup.size} district IDs`);
    }

    // Resolve records to (entity_id, year, subject, grade|null, growth_index).
    type Staged = { entityId: number; year: number; subject: string; grade: number | null; growthIndex: number };
    const staged: Staged[] = [];
    for (const record of records) {
      const key = level === 'school' ? `${record.aun}|${record.schoolNumber}` : record.aun;
      const entityId = idLookup.get(key);
      if (!entityId) continue;
      if (record.growthIndex == null || isNaN(record.growthIndex)) continue;
      const year = parseInt(record.year);
      if (isNaN(year)) continue;
      const subject = isKeystone ? this.normalizeKeystoneSubject(record.subject) : record.subject;
      const grade = typeof record.grade === 'number' ? record.grade : null;
      staged.push({ entityId, year, subject, grade, growthIndex: record.growthIndex });
    }

    if (staged.length === 0) {
      logger.info(`No resolvable records to update in ${tableName}`);
      return 0;
    }

    logger.info(`Staging ${staged.length} resolved records for bulk update...`);

    // One temp table per invocation so concurrent calls don't clash.
    const stagingName = `pvaas_stage_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    sqlite.prepare(`
      CREATE TEMP TABLE ${stagingName} (
        entity_id INTEGER NOT NULL,
        year INTEGER NOT NULL,
        subject TEXT NOT NULL,
        grade INTEGER,
        growth_index REAL NOT NULL
      )
    `).run();

    try {
      // Bulk insert into temp table via a single transaction of prepared statements.
      const insertStmt = sqlite.prepare(
        `INSERT INTO ${stagingName} (entity_id, year, subject, grade, growth_index) VALUES (?, ?, ?, ?, ?)`
      );
      const insertTx = sqlite.transaction((rows: Staged[]) => {
        for (const r of rows) insertStmt.run(r.entityId, r.year, r.subject, r.grade, r.growthIndex);
      });
      insertTx(staged);

      // Index the staging table so the correlated subqueries below can seek.
      sqlite.prepare(
        `CREATE INDEX ${stagingName}_idx ON ${stagingName}(entity_id, year, subject, grade)`
      ).run();

      let totalUpdated = 0;

      if (isKeystone) {
        // Keystone: propagate on (entity, year, subject). Ignore grade — the
        // keystone_results table stores grade=11 uniformly while PVAAS keystone
        // rows use "Across Grades" (null).
        const res = sqlite.prepare(`
          UPDATE ${tableName}
          SET growth_score = (
            SELECT s.growth_index FROM ${stagingName} s
            WHERE s.entity_id = ${tableName}.${entityCol}
              AND s.year = ${tableName}.year
              AND s.subject = ${tableName}.subject
            LIMIT 1
          )
          WHERE growth_score IS NULL
            AND level = ?
            AND ${entityCol} IN (SELECT DISTINCT entity_id FROM ${stagingName})
            AND year IN (SELECT DISTINCT year FROM ${stagingName})
            AND subject IN (SELECT DISTINCT subject FROM ${stagingName})
        `).run(level);
        totalUpdated += res.changes;
        logger.info(`  keystone ${level}: ${res.changes}`);
      } else {
        // PSSA grade-specific: match rows where a staged record exists with the
        // exact same (entity, year, subject, grade).
        const gradeRes = sqlite.prepare(`
          UPDATE ${tableName}
          SET growth_score = (
            SELECT s.growth_index FROM ${stagingName} s
            WHERE s.entity_id = ${tableName}.${entityCol}
              AND s.year = ${tableName}.year
              AND s.subject = ${tableName}.subject
              AND s.grade = ${tableName}.grade
            LIMIT 1
          )
          WHERE growth_score IS NULL
            AND level = ?
            AND grade IS NOT NULL
            AND ${entityCol} IN (SELECT DISTINCT entity_id FROM ${stagingName} WHERE grade IS NOT NULL)
            AND EXISTS (
              SELECT 1 FROM ${stagingName} s
              WHERE s.entity_id = ${tableName}.${entityCol}
                AND s.year = ${tableName}.year
                AND s.subject = ${tableName}.subject
                AND s.grade = ${tableName}.grade
            )
        `).run(level);
        totalUpdated += gradeRes.changes;
        logger.info(`  pssa ${level} grade-exact: ${gradeRes.changes}`);

        // PSSA across-grades: staged rows with grade=NULL apply to every grade
        // of the matching (entity, year, subject). Only fill rows still NULL
        // after the grade-exact pass so a grade-specific value isn't clobbered.
        const acrossRes = sqlite.prepare(`
          UPDATE ${tableName}
          SET growth_score = (
            SELECT s.growth_index FROM ${stagingName} s
            WHERE s.entity_id = ${tableName}.${entityCol}
              AND s.year = ${tableName}.year
              AND s.subject = ${tableName}.subject
              AND s.grade IS NULL
            LIMIT 1
          )
          WHERE growth_score IS NULL
            AND level = ?
            AND EXISTS (
              SELECT 1 FROM ${stagingName} s
              WHERE s.entity_id = ${tableName}.${entityCol}
                AND s.year = ${tableName}.year
                AND s.subject = ${tableName}.subject
                AND s.grade IS NULL
            )
        `).run(level);
        totalUpdated += acrossRes.changes;
        logger.info(`  pssa ${level} across-grades: ${acrossRes.changes}`);
      }

      logger.info(`Updated ${totalUpdated} records in ${tableName}`);
      return totalUpdated;
    } finally {
      // Temp tables are session-scoped, but drop explicitly so a long-lived
      // connection doesn't accumulate staging tables across many imports.
      try { sqlite.prepare(`DROP TABLE IF EXISTS ${stagingName}`).run(); } catch { /* ignore */ }
    }
  }

  /**
   * Ensures the subject string matches the canonical form used in keystone_results
   * (Algebra I, Biology, Literature). PVAAS sources occasionally use slight
   * variants like "Algebra 1" or "Alg I"; normalize those here.
   */
  private normalizeKeystoneSubject(subject: string): string {
    const s = (subject || '').trim();
    const low = s.toLowerCase();
    if (low.startsWith('algebra')) return 'Algebra I';
    if (low.startsWith('biology') || low === 'bio') return 'Biology';
    if (low.startsWith('literature') || low === 'lit') return 'Literature';
    return s;
  }

  async importAllPVAASFiles(): Promise<void> {
    const sourcesPath = path.join(__dirname, '../../..', 'sources', 'pvaas');

    // Import school-level files
    const schoolPath = path.join(sourcesPath, 'school');
    const schoolFiles = require('fs').readdirSync(schoolPath)
      .filter((f: string) => f.endsWith('.xlsx') && f !== 'test.xlsx')
      .sort();

    logger.info(`Found ${schoolFiles.length} school-level PVAAS files`);

    for (const file of schoolFiles) {
      const filePath = path.join(schoolPath, file);
      logger.info(`Processing: ${file}`);
      const result = await this.importPVAASFile(filePath, 'school');
      logger.info(`  Result: ${result.updated} updated, ${result.skipped} skipped`);
    }

    // Import district-level files
    const districtPath = path.join(sourcesPath, 'district');
    const districtFiles = require('fs').readdirSync(districtPath)
      .filter((f: string) => f.endsWith('.xlsx'))
      .sort();

    logger.info(`Found ${districtFiles.length} district-level PVAAS files`);

    for (const file of districtFiles) {
      const filePath = path.join(districtPath, file);
      logger.info(`Processing: ${file}`);
      const result = await this.importPVAASFile(filePath, 'district');
      logger.info(`  Result: ${result.updated} updated, ${result.skipped} skipped`);
    }
  }
}
