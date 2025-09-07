import * as XLSX from 'xlsx';
import { db } from '../db';
import { pssaResults, keystoneResults, schools, districts, dataImports } from '../db/schema';
import { logger } from '../utils/logger';
import { getFileConfig, FileConfig } from './fileConfigs';
import { eq } from 'drizzle-orm';
import path from 'path';
import fs from 'fs/promises';

interface ImportResult {
  success: boolean;
  recordsProcessed: number;
  errors: string[];
  skipped: number;
}

export class DataImporter {
  private sourcePath = path.join(process.cwd(), '..', 'sources');
  private processedSchools = new Set<string>();
  private processedDistricts = new Set<string>();

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
      logger.info(`Using config: Header row ${config.headerRow}, Extract year: ${config.extractYearFromFilename}`);
      
      // Log import start
      const importRecord = db.insert(dataImports).values({
        fileName,
        fileType: path.extname(fileName),
        status: 'processing',
        year: this.extractYear(fileName),
        importedAt: new Date()
      }).returning().get();

      // Read Excel file
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Parse data with configuration-specific header row
      const data = XLSX.utils.sheet_to_json(worksheet, { range: config.headerRow });
      
      logger.info(`Found ${data.length} rows to process`);

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
          recordsProcessed: result.recordsProcessed
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

        // Extract and store school/district info if at school level
        if (level === 'school' && config.schoolNumberColumn && row[config.schoolNumberColumn]) {
          await this.processSchoolInfo(row, config);
        }

        const record = {
          schoolId: level === 'school' && config.schoolNumberColumn ? 
                   this.normalizeId(row[config.schoolNumberColumn]) : null,
          districtId: config.aunColumn ? this.normalizeId(row[config.aunColumn]) : null,
          year: config.yearColumn ? row[config.yearColumn] : year,
          grade: config.gradeColumn ? this.parseGrade(row[config.gradeColumn]) : null,
          subject: this.normalizeSubject(row[config.subjectColumn]),
          level,
          totalTested: numberScored || 0,
          advancedPercent: config.advancedColumn ? 
                          this.parsePercent(row[config.advancedColumn]) : null,
          proficientPercent: config.proficientColumn ? 
                            this.parsePercent(row[config.proficientColumn]) : null,
          basicPercent: config.basicColumn ? 
                       this.parsePercent(row[config.basicColumn]) : null,
          belowBasicPercent: config.belowBasicColumn ? 
                           this.parsePercent(row[config.belowBasicColumn]) : null,
          proficientOrAbovePercent: config.proficientOrAboveColumn ? 
                                   this.parsePercent(row[config.proficientOrAboveColumn]) : null
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
          db.insert(pssaResults).values(batch.map(r => ({...r, createdAt: new Date()}))).onConflictDoNothing().run();
          inserted += batch.length;
          batch.length = 0;
        }
      } catch (error) {
        skipped++;
        // logger.debug(`Skipped row:`, error);
      }
    }

    // Insert remaining batch
    if (batch.length > 0) {
      db.insert(pssaResults).values(batch.map(r => ({...r, createdAt: new Date()}))).onConflictDoNothing().run();
      inserted += batch.length;
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

        // Extract and store school/district info if at school level
        if (level === 'school' && config.schoolNumberColumn && row[config.schoolNumberColumn]) {
          await this.processSchoolInfo(row, config);
        }

        const record = {
          schoolId: level === 'school' && config.schoolNumberColumn ? 
                   this.normalizeId(row[config.schoolNumberColumn]) : null,
          districtId: config.aunColumn ? this.normalizeId(row[config.aunColumn]) : null,
          year: config.yearColumn ? row[config.yearColumn] : year,
          subject: this.normalizeKeystoneSubject(row[config.subjectColumn]),
          level,
          grade: config.gradeColumn ? this.parseGrade(row[config.gradeColumn]) : 11,
          totalTested: numberScored || 0,
          advancedPercent: config.advancedColumn ? 
                          this.parsePercent(row[config.advancedColumn]) : null,
          proficientPercent: config.proficientColumn ? 
                            this.parsePercent(row[config.proficientColumn]) : null,
          basicPercent: config.basicColumn ? 
                       this.parsePercent(row[config.basicColumn]) : null,
          belowBasicPercent: config.belowBasicColumn ? 
                           this.parsePercent(row[config.belowBasicColumn]) : null,
          proficientOrAbovePercent: config.proficientOrAboveColumn ? 
                                   this.parsePercent(row[config.proficientOrAboveColumn]) : null
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
          db.insert(keystoneResults).values(batch.map(r => ({...r, createdAt: new Date()}))).onConflictDoNothing().run();
          inserted += batch.length;
          batch.length = 0;
        }
      } catch (error) {
        skipped++;
        // logger.debug(`Skipped row:`, error);
      }
    }

    // Insert remaining batch
    if (batch.length > 0) {
      db.insert(keystoneResults).values(batch.map(r => ({...r, createdAt: new Date()}))).onConflictDoNothing().run();
      inserted += batch.length;
    }

    return { inserted, skipped };
  }

  private async processSchoolInfo(row: any, config: FileConfig) {
    const districtId = config.aunColumn ? this.normalizeId(row[config.aunColumn]) : null;
    const schoolId = config.schoolNumberColumn ? this.normalizeId(row[config.schoolNumberColumn]) : null;
    
    // Process district if not already processed
    if (districtId && !this.processedDistricts.has(districtId) && config.districtNameColumn) {
      try {
        db.insert(districts)
          .values({
            districtId,
            name: row[config.districtNameColumn] || '',
            county: config.countyColumn ? row[config.countyColumn] : null,
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .onConflictDoUpdate({
            target: districts.districtId,
            set: {
              name: row[config.districtNameColumn] || '',
              county: config.countyColumn ? row[config.countyColumn] : null,
              updatedAt: new Date()
            }
          })
          .run();
        this.processedDistricts.add(districtId);
      } catch (error) {
        // logger.debug(`District already exists: ${districtId}`);
      }
    }
    
    // Process school if not already processed
    if (schoolId && districtId && !this.processedSchools.has(schoolId) && config.schoolNameColumn) {
      try {
        db.insert(schools)
          .values({
            schoolId,
            districtId, // Now guaranteed to be non-null
            name: row[config.schoolNameColumn] || '',
            schoolType: this.determineSchoolType(row[config.schoolNameColumn]),
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .onConflictDoUpdate({
            target: schools.schoolId,
            set: {
              name: row[config.schoolNameColumn] || '',
              districtId, // Now guaranteed to be non-null
              updatedAt: new Date()
            }
          })
          .run();
        this.processedSchools.add(schoolId);
      } catch (error) {
        // logger.debug(`School already exists: ${schoolId}`);
      }
    }
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
    if (subject.includes('algebra')) return 'Algebra I';
    if (subject.includes('biology')) return 'Biology';
    if (subject.includes('literature') || subject.includes('english')) return 'Literature';
    return value;
  }

  private parseGrade(value: any): number {
    if (!value) return 0;
    const grade = String(value).replace(/\D/g, '');
    return parseInt(grade) || 0;
  }

  private parseNumber(value: any): number | null {
    if (value === undefined || value === null || value === '' || value === 'N/A' || value === '*') return null;
    const num = parseFloat(String(value).replace(/,/g, ''));
    return isNaN(num) ? null : num;
  }

  private parsePercent(value: any): number | null {
    if (value === undefined || value === null || value === '' || value === 'N/A' || value === '*') return null;
    const str = String(value).replace(/[%,]/g, '');
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
  }

  private determineSchoolType(schoolName: string): string | null {
    if (!schoolName) return null;
    const name = schoolName.toLowerCase();
    
    if (name.includes('elementary') || name.includes(' el ') || name.includes(' es ')) return 'Elementary';
    if (name.includes('middle') || name.includes(' ms ')) return 'Middle';
    if (name.includes('high school') || name.includes(' hs ')) return 'High';
    if (name.includes('career') || name.includes('technical') || name.includes('vo-tech')) return 'Career/Technical';
    if (name.includes('charter')) return 'Charter';
    if (name.includes('cyber')) return 'Cyber Charter';
    if (name.includes('intermediate')) return 'Intermediate';
    
    return null;
  }

  async importAllFiles(): Promise<void> {
    const directories = [
      'pssa/school',
      'pssa/district', 
      'pssa/state',
      'keystone/school',
      'keystone/district',
      'keystone/state'
    ];

    let totalProcessed = 0;
    let totalSkipped = 0;
    let totalFiles = 0;

    for (const dir of directories) {
      const dirPath = path.join(this.sourcePath, dir);
      try {
        const files = await fs.readdir(dirPath);
        const xlsxFiles = files.filter(f => f.endsWith('.xlsx')).sort();
        
        logger.info(`\n📁 Processing ${xlsxFiles.length} files from ${dir}`);
        
        for (const file of xlsxFiles) {
          const filePath = path.join(dirPath, file);
          const result = await this.importFile(filePath);
          totalProcessed += result.recordsProcessed;
          totalSkipped += result.skipped;
          totalFiles++;
        }
      } catch (error) {
        logger.error(`Error processing directory ${dir}:`, error);
      }
    }
    
    logger.info(`\n${'='.repeat(60)}`);
    logger.info('📊 IMPORT SUMMARY');
    logger.info('='.repeat(60));
    logger.info(`✅ Files processed: ${totalFiles}`);
    logger.info(`✅ Records imported: ${totalProcessed}`);
    logger.info(`⚠️  Records skipped: ${totalSkipped}`);
    logger.info(`🏫 Unique schools: ${this.processedSchools.size}`);
    logger.info(`🏛️  Unique districts: ${this.processedDistricts.size}`);
  }

  async importSingleFile(filePath: string): Promise<ImportResult> {
    return this.importFile(filePath);
  }
}