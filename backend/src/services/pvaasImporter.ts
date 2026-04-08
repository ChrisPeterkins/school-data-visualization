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
}

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

  async importPVAASFile(filePath: string, level: 'school' | 'district'): Promise<{ updated: number; skipped: number }> {
    logger.info(`Importing PVAAS file: ${filePath}`);

    logger.info('Reading Excel file...');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    logger.info(`Loaded ${data.length} rows`);

    // Parse all records first
    const records: PVAASRecord[] = [];
    let skipped = 0;

    for (const row of data as any[]) {
      try {
        const record = this.parseRow(row, level);
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

    // Batch update all records
    let updated = 0;
    if (level === 'school') {
      updated = await this.batchUpdateSchoolRecords(records);
    } else {
      updated = await this.batchUpdateDistrictRecords(records);
    }

    logger.info(`PVAAS import complete: ${updated} updated`);
    return { updated, skipped };
  }

  private parseRow(row: any, level: 'school' | 'district'): PVAASRecord | null {
    // Extract year from "School Year" field (e.g., "2023-2024" -> 2024)
    const schoolYear = row['School Year'] || row['school_year'];
    const yearMatch = schoolYear?.toString().match(/(\d{4})-(\d{4})/);
    const year = yearMatch ? parseInt(yearMatch[2]) : null;

    if (!year) return null;

    const aun = (row['District AUN'] || row['district_aun'])?.toString();
    const rawSchoolNumber = level === 'school' ? (row['School Number'] || row['school_number'])?.toString() : undefined;
    // Normalize school number to match database format (9 digits with leading zeros)
    const schoolNumber = rawSchoolNumber ? rawSchoolNumber.padStart(9, '0') : undefined;
    const subject = this.normalizeSubject(row['Subject'] || row['subject']);
    const grade = this.parseGrade(row['Grade'] || row['grade']);
    const growthIndex = parseFloat(row['Growth Index'] || row['growth_index']);
    const growthMeasure = parseFloat(row['Growth Measure'] || row['growth_measure']);
    const effectSize = parseFloat(row['Effect Size'] || row['effect_size']);

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
      effectSize: isNaN(effectSize) ? 0 : effectSize
    };
  }

  private normalizeSubject(subject: string): string {
    return this.subjectMapping[subject] || subject;
  }

  private parseGrade(grade: any): string | number | null {
    if (grade === 'Across Grades' || grade === 'All Grades') {
      return 'Across Grades';
    }
    const num = parseInt(grade?.toString());
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
    // Use prepared statements in a transaction for fast batch updates
    // Build lookups first to avoid expensive JOINs in the UPDATE
    const sqlite = sqliteDb;

    logger.info(`Building ${level} ID lookup map...`);

    // Build a lookup map: AUN+SchoolNumber -> ID (for schools) or AUN -> ID (for districts)
    const idLookup = new Map<string, number>();

    if (level === 'school') {
      const schoolsData = sqlite.prepare(`
        SELECT s.id, d.aun, s.school_number
        FROM schools s
        INNER JOIN districts d ON d.id = s.district_id
      `).all() as Array<{ id: number; aun: string; school_number: string }>;

      for (const row of schoolsData) {
        const key = `${row.aun}|${row.school_number}`;
        idLookup.set(key, row.id);
      }
      logger.info(`Loaded ${idLookup.size} school IDs`);
    } else {
      const districtsData = sqlite.prepare(`
        SELECT id, aun FROM districts
      `).all() as Array<{ id: number; aun: string }>;

      for (const row of districtsData) {
        idLookup.set(row.aun, row.id);
      }
      logger.info(`Loaded ${idLookup.size} district IDs`);
    }

    // Prepare UPDATE statement
    const updateStmt = sqlite.prepare(`
      UPDATE ${tableName}
      SET growth_score = ?
      WHERE ${level === 'school' ? 'school_id' : 'district_id'} = ?
        AND year = ?
        AND subject = ?
        AND level = ?
        AND (? = 'Across Grades' OR grade = ?)
    `);

    // Batch all updates in a single transaction
    logger.info(`Executing batch update of ${records.length} records...`);

    const transaction = sqlite.transaction((records: PVAASRecord[]) => {
      let updated = 0;
      for (const record of records) {
        // Look up the ID
        const lookupKey = level === 'school'
          ? `${record.aun}|${record.schoolNumber}`
          : record.aun;

        const entityId = idLookup.get(lookupKey);
        if (!entityId) {
          continue; // Skip if school/district not found
        }

        // Execute update
        const gradeValue = typeof record.grade === 'number' ? record.grade : null;
        const result = updateStmt.run(
          record.growthIndex,
          entityId,
          parseInt(record.year),
          record.subject,
          level,
          typeof record.grade === 'string' ? record.grade : '',
          gradeValue
        );
        updated += result.changes;
      }
      return updated;
    });

    const totalUpdated = transaction(records);

    logger.info(`Updated ${totalUpdated} records in ${tableName}`);
    return totalUpdated;
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
