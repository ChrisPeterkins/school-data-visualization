import * as XLSX from 'xlsx';
import { db } from '../db';
import { pssaResults, keystoneResults, schools, districts, counties, dataImports } from '../db/newSchema';
import { logger } from '../utils/logger';
import { getFileConfig, FileConfig, normalizeDemographicLabel } from './fileConfigs';
import { eq, and, sql } from 'drizzle-orm';
import * as path from 'path';

interface ImportResult {
  success: boolean;
  recordsProcessed: number;
  errors: string[];
  skipped: number;
}

// Cache for entity lookups
const schoolCache = new Map<string, number>(); // school_number -> schools.id
const districtCache = new Map<string, number>(); // aun -> districts.id
const countyCache = new Map<string, number>(); // county_code -> counties.id

export class DataImporterFixed {
  async importFile(filePath: string): Promise<ImportResult> {
    const fileName = path.basename(filePath);
    const result: ImportResult = {
      success: false,
      recordsProcessed: 0,
      errors: [],
      skipped: 0
    };

    try {
      logger.info(`\n${'='.repeat(60)}`);
      logger.info(`Importing: ${fileName}`);
      logger.info('='.repeat(60));

      // Get file configuration
      const config = getFileConfig(fileName);
      logger.info(`Using config: Header row ${config.headerRow}`);

      // Log import start
      const importRecord = db.insert(dataImports).values({
        fileName,
        filePath,
        fileType: fileName.toLowerCase().includes('pssa') ? 'pssa' : 'keystone',
        level: this.extractLevel(fileName),
        year: this.extractYear(fileName),
        status: 'processing',
        startedAt: new Date(),
        importedAt: new Date()
      }).returning().get();

      // Read Excel file
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Parse data with configuration-specific header row
      const data = XLSX.utils.sheet_to_json(worksheet, { range: config.headerRow });

      logger.info(`Found ${data.length} rows to process`);

      // Delete any existing records from this source file to prevent duplicates on re-import
      const isPSSA = fileName.toLowerCase().includes('pssa');
      const targetTable = isPSSA ? pssaResults : keystoneResults;
      const existingCount = db.select({ count: sql<number>`COUNT(*)` })
        .from(targetTable)
        .where(eq(targetTable.sourceFile, fileName))
        .get();

      if (existingCount && existingCount.count > 0) {
        db.delete(targetTable)
          .where(eq(targetTable.sourceFile, fileName))
          .run();
        logger.info(`Cleared ${existingCount.count} existing records for re-import`);
      }

      // Process data based on file type
      if (fileName.toLowerCase().includes('pssa')) {
        const processed = await this.processPSSAData(data, fileName, config);
        result.recordsProcessed = processed.inserted;
        result.skipped = processed.skipped;
      } else if (fileName.toLowerCase().includes('keystone')) {
        const processed = await this.processKeystoneData(data, fileName, config);
        result.recordsProcessed = processed.inserted;
        result.skipped = processed.skipped;
      } else {
        throw new Error('Unknown file type');
      }

      // Update import record
      db.update(dataImports)
        .set({
          status: 'completed',
          processedRows: data.length,
          insertedRows: result.recordsProcessed,
          skippedRows: result.skipped,
          completedAt: new Date()
        })
        .where(eq(dataImports.id, importRecord.id))
        .run();

      result.success = true;
      logger.info(`✅ Successfully imported ${result.recordsProcessed} records (skipped ${result.skipped})`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(errorMessage);
      logger.error(`❌ Error importing ${fileName}:`, error);
    }

    return result;
  }

  private async processPSSAData(
    data: any[],
    fileName: string,
    config: FileConfig
  ): Promise<{ inserted: number; skipped: number }> {
    const year = config.extractYearFromFilename ? this.extractYear(fileName) : null;
    const level = this.extractLevel(fileName);
    let inserted = 0;
    let skipped = 0;
    const batchSize = 100;
    const batch = [];

    for (const row of data) {
      try {
        const numberScored = this.parseNumber(row[config.numberScoredColumn || 'Number Scored']);

        // Get foreign key IDs
        let schoolId: number | null = null;
        let districtId: number | null = null;
        let countyId: number | null = null;

        // Process county (if present)
        if (config.countyColumn && row[config.countyColumn]) {
          countyId = await this.getOrCreateCounty(row, config);
        }

        // Process district (if present)
        if (config.aunColumn && row[config.aunColumn]) {
          districtId = await this.getOrCreateDistrict(row, config, countyId);
        }

        // Process school (if at school level)
        if (level === 'school' && config.schoolNumberColumn && row[config.schoolNumberColumn]) {
          schoolId = await this.getOrCreateSchool(row, config, districtId);
        }

        // If we don't have county but we have district, get county from district
        if (!countyId && districtId) {
          const district = await db.select().from(districts).where(eq(districts.id, districtId)).limit(1);
          if (district.length > 0 && district[0].countyId) {
            countyId = district[0].countyId;
          }
        }

        // Parse percentages
        const advancedPercent = config.advancedColumn ? this.parsePercent(row[config.advancedColumn]) : null;
        const proficientPercent = config.proficientColumn ? this.parsePercent(row[config.proficientColumn]) : null;
        const basicPercent = config.basicColumn ? this.parsePercent(row[config.basicColumn]) : null;
        const belowBasicPercent = config.belowBasicColumn ? this.parsePercent(row[config.belowBasicColumn]) : null;

        // Calculate proficient or above percent
        let proficientOrAbovePercent = config.proficientOrAboveColumn ?
          this.parsePercent(row[config.proficientOrAboveColumn]) : null;

        // If not in source file, calculate from advanced + proficient
        if (!proficientOrAbovePercent && advancedPercent !== null && proficientPercent !== null) {
          proficientOrAbovePercent = Math.round((advancedPercent + proficientPercent) * 10) / 10;
        }

        const record = {
          level,
          schoolId,
          districtId,
          countyId,
          year: config.yearColumn ? row[config.yearColumn] : year,
          grade: config.gradeColumn ? this.parseGrade(row[config.gradeColumn]) : null,
          subject: this.normalizeSubject(row[config.subjectColumn]),
          demographicGroup: config.groupColumn ? normalizeDemographicLabel(row[config.groupColumn]) : 'All Students',
          totalTested: numberScored || 0,
          // Percentages
          advancedPercent,
          proficientPercent,
          basicPercent,
          belowBasicPercent,
          proficientOrAbovePercent,
          // Calculate counts from percentages
          advancedCount: advancedPercent && numberScored ? Math.round(numberScored * advancedPercent / 100) : null,
          proficientCount: proficientPercent && numberScored ? Math.round(numberScored * proficientPercent / 100) : null,
          basicCount: basicPercent && numberScored ? Math.round(numberScored * basicPercent / 100) : null,
          belowBasicCount: belowBasicPercent && numberScored ? Math.round(numberScored * belowBasicPercent / 100) : null,
          sourceFile: fileName
        };

        // Skip if missing critical data
        if (!record.year || !record.subject || (level !== 'state' && !record.grade)) {
          skipped++;
          continue;
        }

        // Skip non-standard subjects
        const validSubjects = ['Mathematics', 'English Language Arts', 'Science'];
        if (!validSubjects.includes(record.subject)) {
          skipped++;
          continue;
        }

        batch.push(record);

        // Insert in batches
        if (batch.length >= batchSize) {
          const res = db.insert(pssaResults).values(batch).onConflictDoNothing().run();
          inserted += res.changes;
          batch.length = 0;
        }
      } catch (error) {
        skipped++;
        logger.debug(`Skipped row:`, error);
      }
    }

    // Insert remaining batch
    if (batch.length > 0) {
      const res = db.insert(pssaResults).values(batch).onConflictDoNothing().run();
      inserted += res.changes;
    }

    return { inserted, skipped };
  }

  private async processKeystoneData(
    data: any[],
    fileName: string,
    config: FileConfig
  ): Promise<{ inserted: number; skipped: number }> {
    const year = config.extractYearFromFilename ? this.extractYear(fileName) : null;
    const level = this.extractLevel(fileName);
    let inserted = 0;
    let skipped = 0;
    const batchSize = 100;
    const batch = [];

    for (const row of data) {
      try {
        const numberScored = this.parseNumber(row[config.numberScoredColumn || 'Number Scored']);

        // Get foreign key IDs
        let schoolId: number | null = null;
        let districtId: number | null = null;
        let countyId: number | null = null;

        // Process county (if present)
        if (config.countyColumn && row[config.countyColumn]) {
          countyId = await this.getOrCreateCounty(row, config);
        }

        // Process district (if present)
        if (config.aunColumn && row[config.aunColumn]) {
          districtId = await this.getOrCreateDistrict(row, config, countyId);
        }

        // Process school (if at school level)
        if (level === 'school' && config.schoolNumberColumn && row[config.schoolNumberColumn]) {
          schoolId = await this.getOrCreateSchool(row, config, districtId);
        }

        // If we don't have county but we have district, get county from district
        if (!countyId && districtId) {
          const district = await db.select().from(districts).where(eq(districts.id, districtId)).limit(1);
          if (district.length > 0 && district[0].countyId) {
            countyId = district[0].countyId;
          }
        }

        // Parse percentages
        const advancedPercent = config.advancedColumn ? this.parsePercent(row[config.advancedColumn]) : null;
        const proficientPercent = config.proficientColumn ? this.parsePercent(row[config.proficientColumn]) : null;
        const basicPercent = config.basicColumn ? this.parsePercent(row[config.basicColumn]) : null;
        const belowBasicPercent = config.belowBasicColumn ? this.parsePercent(row[config.belowBasicColumn]) : null;

        // Calculate proficient or above percent
        let proficientOrAbovePercent = config.proficientOrAboveColumn ?
          this.parsePercent(row[config.proficientOrAboveColumn]) : null;

        // If not in source file, calculate from advanced + proficient
        if (!proficientOrAbovePercent && advancedPercent !== null && proficientPercent !== null) {
          proficientOrAbovePercent = Math.round((advancedPercent + proficientPercent) * 10) / 10;
        }

        const record = {
          level,
          schoolId,
          districtId,
          countyId,
          year: config.yearColumn ? row[config.yearColumn] : year,
          subject: this.normalizeKeystoneSubject(row[config.subjectColumn]),
          demographicGroup: config.groupColumn ? normalizeDemographicLabel(row[config.groupColumn]) : 'All Students',
          totalTested: numberScored || 0,
          // Percentages
          advancedPercent,
          proficientPercent,
          basicPercent,
          belowBasicPercent,
          proficientOrAbovePercent,
          // Calculate counts from percentages
          advancedCount: advancedPercent && numberScored ? Math.round(numberScored * advancedPercent / 100) : null,
          proficientCount: proficientPercent && numberScored ? Math.round(numberScored * proficientPercent / 100) : null,
          basicCount: basicPercent && numberScored ? Math.round(numberScored * basicPercent / 100) : null,
          belowBasicCount: belowBasicPercent && numberScored ? Math.round(numberScored * belowBasicPercent / 100) : null,
          sourceFile: fileName
        };

        // Skip if missing critical data
        if (!record.year || !record.subject) {
          skipped++;
          continue;
        }

        // Skip non-standard subjects
        const validSubjects = ['Algebra I', 'Biology', 'Literature'];
        if (!validSubjects.includes(record.subject)) {
          skipped++;
          continue;
        }

        batch.push(record);

        // Insert in batches
        if (batch.length >= batchSize) {
          const res = db.insert(keystoneResults).values(batch).onConflictDoNothing().run();
          inserted += res.changes;
          batch.length = 0;
        }
      } catch (error) {
        skipped++;
        logger.debug(`Skipped row:`, error);
      }
    }

    // Insert remaining batch
    if (batch.length > 0) {
      const res = db.insert(keystoneResults).values(batch).onConflictDoNothing().run();
      inserted += res.changes;
    }

    return { inserted, skipped };
  }

  // Get or create county and return its ID
  private async getOrCreateCounty(row: any, config: FileConfig): Promise<number | null> {
    const countyName = config.countyColumn ? row[config.countyColumn] : null;
    if (!countyName || countyName === '*' || countyName === 'N/A') return null;

    const countyCode = String(countyName).trim();

    // Check cache
    if (countyCache.has(countyCode)) {
      return countyCache.get(countyCode)!;
    }

    // Look up in database
    const existing = await db.select().from(counties).where(eq(counties.name, countyName)).limit(1);

    if (existing.length > 0) {
      countyCache.set(countyCode, existing[0].id);
      return existing[0].id;
    }

    // Create new county
    try {
      const result = db.insert(counties).values({
        countyCode: countyCode.padStart(3, '0'),
        name: countyName,
        fullName: `${countyName} County`
      }).returning({ id: counties.id }).get();

      countyCache.set(countyCode, result.id);
      logger.debug(`Created county: ${countyName} (ID: ${result.id})`);
      return result.id;
    } catch (error) {
      logger.error(`Error creating county ${countyName}:`, error);
      return null;
    }
  }

  // Get or create district and return its ID
  private async getOrCreateDistrict(row: any, config: FileConfig, countyId: number | null): Promise<number | null> {
    const aun = this.normalizeId(config.aunColumn ? row[config.aunColumn] : null);
    if (!aun) return null;

    // Check cache
    if (districtCache.has(aun)) {
      return districtCache.get(aun)!;
    }

    // Look up in database
    const existing = await db.select().from(districts).where(eq(districts.aun, aun)).limit(1);

    if (existing.length > 0) {
      districtCache.set(aun, existing[0].id);
      return existing[0].id;
    }

    // Create new district
    const districtName = config.districtNameColumn ? row[config.districtNameColumn] : `District ${aun}`;

    // If no countyId provided, try to infer from county column
    let finalCountyId = countyId;
    if (!finalCountyId && config.countyColumn) {
      finalCountyId = await this.getOrCreateCounty(row, config);
    }

    // Default to first county if still null (required by schema)
    if (!finalCountyId) {
      const defaultCounty = await db.select().from(counties).limit(1);
      if (defaultCounty.length > 0) {
        finalCountyId = defaultCounty[0].id;
      } else {
        // Create a default county
        const created = db.insert(counties).values({
          countyCode: '000',
          name: 'Unknown',
          fullName: 'Unknown County'
        }).returning({ id: counties.id }).get();
        finalCountyId = created.id;
      }
    }

    try {
      const result = db.insert(districts).values({
        aun,
        countyId: finalCountyId,
        name: districtName
      }).returning({ id: districts.id }).get();

      districtCache.set(aun, result.id);
      logger.debug(`Created district: ${districtName} (AUN: ${aun}, ID: ${result.id})`);
      return result.id;
    } catch (error) {
      logger.error(`Error creating district ${aun}:`, error);
      return null;
    }
  }

  // Get or create school and return its ID
  private async getOrCreateSchool(row: any, config: FileConfig, districtId: number | null): Promise<number | null> {
    const schoolNumber = this.normalizeId(config.schoolNumberColumn ? row[config.schoolNumberColumn] : null);
    if (!schoolNumber) return null;

    // Check cache
    const cacheKey = `${schoolNumber}-${districtId}`;
    if (schoolCache.has(cacheKey)) {
      return schoolCache.get(cacheKey)!;
    }

    // Look up in database
    const whereConditions = districtId
      ? and(eq(schools.schoolNumber, schoolNumber), eq(schools.districtId, districtId))
      : eq(schools.schoolNumber, schoolNumber);

    const existing = await db.select().from(schools).where(whereConditions).limit(1);

    if (existing.length > 0) {
      schoolCache.set(cacheKey, existing[0].id);
      return existing[0].id;
    }

    // Create new school
    const schoolName = config.schoolNameColumn ? row[config.schoolNameColumn] : `School ${schoolNumber}`;

    // If no districtId, try to get from AUN column
    let finalDistrictId = districtId;
    if (!finalDistrictId && config.aunColumn) {
      finalDistrictId = await this.getOrCreateDistrict(row, config, null);
    }

    // Still no district? Skip this school
    if (!finalDistrictId) {
      logger.warn(`Cannot create school ${schoolNumber} without district`);
      return null;
    }

    try {
      const result = db.insert(schools).values({
        schoolNumber,
        districtId: finalDistrictId,
        name: schoolName,
        schoolType: this.determineSchoolType(schoolName)
      }).returning({ id: schools.id }).get();

      schoolCache.set(cacheKey, result.id);
      logger.debug(`Created school: ${schoolName} (Number: ${schoolNumber}, ID: ${result.id})`);
      return result.id;
    } catch (error) {
      logger.error(`Error creating school ${schoolNumber}:`, error);
      return null;
    }
  }

  private determineSchoolType(name: string): string | null {
    if (!name) return null;
    const lower = name.toLowerCase();
    if (lower.includes('elem') || lower.includes(' el ') || lower.includes('primary')) return 'Elementary';
    if (lower.includes('middle') || lower.includes(' ms ')) return 'Middle';
    if (lower.includes('high') || lower.includes(' hs ') || lower.includes('senior')) return 'High';
    if (lower.includes('junior')) return 'Junior High';
    return null;
  }

  private extractYear(fileName: string): number {
    const match = fileName.match(/20\d{2}/);
    return match ? parseInt(match[0]) : new Date().getFullYear();
  }

  private extractLevel(fileName: string): 'school' | 'district' | 'state' {
    const lowerName = fileName.toLowerCase();
    if (lowerName.includes('school')) return 'school';
    if (lowerName.includes('district')) return 'district';
    if (lowerName.includes('state')) return 'state';
    return 'school';
  }

  private normalizeId(value: any): string | null {
    if (!value) return null;
    const str = String(value).trim();
    if (str === '' || str === 'N/A' || str === '*') return null;
    // Pad with zeros for standard IDs
    if (/^\d+$/.test(str)) {
      return str.padStart(9, '0');
    }
    return str;
  }

  private normalizeSubject(value: any): string {
    if (!value) return 'Unknown';
    const subject = String(value).toLowerCase().trim();
    if (subject.includes('math')) return 'Mathematics';
    if (subject.includes('ela') || subject.includes('english')) return 'English Language Arts';
    if (subject.includes('science')) return 'Science';
    return value;
  }

  private normalizeKeystoneSubject(value: any): string {
    if (!value) return 'Unknown';
    const subject = String(value).toLowerCase().trim();
    if (subject === 'e' || subject.includes('literature') || subject.includes('english')) return 'Literature';
    if (subject === 'm' || subject.includes('algebra')) return 'Algebra I';
    if (subject === 's' || subject.includes('biology')) return 'Biology';
    return value;
  }

  private parseGrade(value: any): number {
    if (!value) return 0;
    const grade = String(value).replace(/\D/g, '');
    return parseInt(grade) || 0;
  }

  private parseNumber(value: any): number | null {
    if (value === undefined || value === null || value === '' || value === 'N/A' || value === '*')
      return null;
    const num = Number(value);
    return isNaN(num) ? null : num;
  }

  private parsePercent(value: any): number | null {
    if (value === undefined || value === null || value === '' || value === 'N/A' || value === '*')
      return null;
    const str = String(value).replace(/[%,]/g, '');
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
  }
}
