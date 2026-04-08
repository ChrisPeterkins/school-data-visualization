import * as XLSX from 'xlsx';
import { db } from '../db';
import { pssaResults, keystoneResults } from '../db/newSchema';
import { logger } from '../utils/logger';
import { getFileConfig } from './fileConfigs';
import { eq, and } from 'drizzle-orm';
import path from 'path';
import fs from 'fs/promises';

interface VerificationResult {
  fileName: string;
  sourceRowCount: number;
  dbRowCount: number;
  match: boolean;
  discrepancy?: number;
  sampleComparison?: {
    passed: number;
    failed: number;
    examples: Array<{
      rowNumber: number;
      issue: string;
      sourceData?: any;
      dbData?: any;
    }>;
  };
  errors: string[];
}

export interface VerificationReport {
  timestamp: Date;
  totalFiles: number;
  filesVerified: number;
  filesPassed: number;
  filesFailed: number;
  results: VerificationResult[];
  summary: {
    totalSourceRecords: number;
    totalDbRecords: number;
    overallMatch: boolean;
    criticalIssues: string[];
  };
}

export class DataVerifier {
  private sourcePath = path.join(process.cwd(), '..', 'sources');

  async verifyAllData(): Promise<VerificationReport> {
    const report: VerificationReport = {
      timestamp: new Date(),
      totalFiles: 0,
      filesVerified: 0,
      filesPassed: 0,
      filesFailed: 0,
      results: [],
      summary: {
        totalSourceRecords: 0,
        totalDbRecords: 0,
        overallMatch: true,
        criticalIssues: []
      }
    };

    const directories = [
      'pssa/school',
      'pssa/district',
      'pssa/state',
      'keystone/school',
      'keystone/district',
      'keystone/state'
    ];

    for (const dir of directories) {
      const dirPath = path.join(this.sourcePath, dir);
      try {
        const files = await fs.readdir(dirPath);
        const xlsxFiles = files.filter(f => f.endsWith('.xlsx')).sort();

        for (const file of xlsxFiles) {
          report.totalFiles++;
          const filePath = path.join(dirPath, file);
          const result = await this.verifyFile(filePath);

          report.results.push(result);
          report.filesVerified++;

          if (result.match) {
            report.filesPassed++;
          } else {
            report.filesFailed++;
            report.summary.overallMatch = false;
            if (result.discrepancy && Math.abs(result.discrepancy) > 100) {
              report.summary.criticalIssues.push(
                `${file}: Major discrepancy of ${result.discrepancy} records`
              );
            }
          }

          report.summary.totalSourceRecords += result.sourceRowCount;
          report.summary.totalDbRecords += result.dbRowCount;
        }
      } catch (error) {
        logger.error(`Error verifying directory ${dir}:`, error);
      }
    }

    return report;
  }

  async verifyAllDataWithProgress(
    onProgress: (update: {
      currentFile?: string;
      currentStep?: string;
      totalFiles?: number;
      processedFiles?: number;
      filesPassed?: number;
      filesFailed?: number;
      fileResult?: {
        fileName: string;
        status: 'pass' | 'fail';
        sourceRowCount: number;
        dbRowCount: number;
        discrepancy: number;
      };
    }) => void,
    shouldCancel?: () => boolean
  ): Promise<VerificationReport> {
    const report: VerificationReport = {
      timestamp: new Date(),
      totalFiles: 0,
      filesVerified: 0,
      filesPassed: 0,
      filesFailed: 0,
      results: [],
      summary: {
        totalSourceRecords: 0,
        totalDbRecords: 0,
        overallMatch: true,
        criticalIssues: []
      }
    };

    const directories = [
      'pssa/school',
      'pssa/district',
      'pssa/state',
      'keystone/school',
      'keystone/district',
      'keystone/state'
    ];

    // First, count total files
    for (const dir of directories) {
      const dirPath = path.join(this.sourcePath, dir);
      try {
        const files = await fs.readdir(dirPath);
        report.totalFiles += files.filter(f => f.endsWith('.xlsx')).length;
      } catch (error) {
        // Directory might not exist
      }
    }

    onProgress({
      currentStep: 'Starting verification...',
      totalFiles: report.totalFiles,
      processedFiles: 0,
      filesPassed: 0,
      filesFailed: 0
    });

    for (const dir of directories) {
      const dirPath = path.join(this.sourcePath, dir);
      try {
        const files = await fs.readdir(dirPath);
        const xlsxFiles = files.filter(f => f.endsWith('.xlsx')).sort();

        for (const file of xlsxFiles) {
          // Check for cancellation
          if (shouldCancel && shouldCancel()) {
            logger.info('Verification cancelled by user');
            return report;
          }

          onProgress({
            currentFile: file,
            currentStep: `Verifying ${file}...`,
            processedFiles: report.filesVerified,
            filesPassed: report.filesPassed,
            filesFailed: report.filesFailed
          });

          const filePath = path.join(dirPath, file);
          const result = await this.verifyFile(filePath);

          report.results.push(result);
          report.filesVerified++;

          if (result.match) {
            report.filesPassed++;
          } else {
            report.filesFailed++;
            report.summary.overallMatch = false;
            if (result.discrepancy && Math.abs(result.discrepancy) > 100) {
              report.summary.criticalIssues.push(
                `${file}: Major discrepancy of ${result.discrepancy} records`
              );
            }
          }

          report.summary.totalSourceRecords += result.sourceRowCount;
          report.summary.totalDbRecords += result.dbRowCount;

          // Emit file completion with result
          onProgress({
            fileResult: {
              fileName: file,
              status: result.match ? 'pass' : 'fail',
              sourceRowCount: result.sourceRowCount,
              dbRowCount: result.dbRowCount,
              discrepancy: result.discrepancy || 0
            },
            processedFiles: report.filesVerified,
            filesPassed: report.filesPassed,
            filesFailed: report.filesFailed
          });
        }
      } catch (error) {
        logger.error(`Error verifying directory ${dir}:`, error);
      }
    }

    return report;
  }

  async verifyFile(filePath: string): Promise<VerificationResult> {
    const fileName = path.basename(filePath);
    const result: VerificationResult = {
      fileName,
      sourceRowCount: 0,
      dbRowCount: 0,
      match: false,
      errors: []
    };

    try {
      logger.info(`Verifying: ${fileName}`);

      // Get file configuration
      const config = getFileConfig(fileName);
      const year = this.extractYear(fileName);
      const level = this.extractLevel(fileName);
      const fileType = fileName.toLowerCase().includes('pssa') ? 'pssa' : 'keystone';

      // Read Excel file
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Parse data with configuration-specific header row
      const data = XLSX.utils.sheet_to_json(worksheet, { range: config.headerRow });

      // Filter valid records (same logic as importer)
      const validRecords = data.filter((row: any) => {
        if (fileType === 'pssa') {
          const subject = this.normalizeSubject(row[config.subjectColumn]);
          const validSubjects = ['Mathematics', 'English Language Arts', 'Science'];
          const grade = config.gradeColumn ? this.parseGrade(row[config.gradeColumn]) : null;
          return validSubjects.includes(subject) && (level === 'state' || grade);
        } else {
          const subject = this.normalizeKeystoneSubject(row[config.subjectColumn]);
          const validSubjects = ['Algebra I', 'Biology', 'Literature'];
          return validSubjects.includes(subject);
        }
      });

      result.sourceRowCount = validRecords.length;

      // Query database for matching records
      if (fileType === 'pssa') {
        const dbRecords = await this.getPSSARecordsForFile(year, level);
        result.dbRowCount = dbRecords.length;

        // Sample comparison - check first 10 records in detail
        result.sampleComparison = await this.comparePSSARecords(
          validRecords.slice(0, 10),
          year,
          level,
          config
        );
      } else {
        const dbRecords = await this.getKeystoneRecordsForFile(year, level);
        result.dbRowCount = dbRecords.length;

        // Sample comparison
        result.sampleComparison = await this.compareKeystoneRecords(
          validRecords.slice(0, 10),
          year,
          level,
          config
        );
      }

      // Check if counts match (allow small variance for edge cases)
      const variance = Math.abs(result.sourceRowCount - result.dbRowCount);
      result.discrepancy = result.sourceRowCount - result.dbRowCount;

      // Consider it a match if within 5% variance or exact match
      const percentVariance = (variance / result.sourceRowCount) * 100;
      result.match = percentVariance < 5;

      if (!result.match) {
        result.errors.push(
          `Record count mismatch: Source has ${result.sourceRowCount}, DB has ${result.dbRowCount} (${percentVariance.toFixed(2)}% variance)`
        );
      }

      logger.info(
        `✓ ${fileName}: Source=${result.sourceRowCount}, DB=${result.dbRowCount}, Match=${result.match}`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(errorMessage);
      logger.error(`Error verifying ${fileName}:`, error);
    }

    return result;
  }

  private async getPSSARecordsForFile(year: number, level: string) {
    return await db
      .select()
      .from(pssaResults)
      .where(and(eq(pssaResults.year, year), eq(pssaResults.level, level)));
  }

  private async getKeystoneRecordsForFile(year: number, level: string) {
    return await db
      .select()
      .from(keystoneResults)
      .where(and(eq(keystoneResults.year, year), eq(keystoneResults.level, level)));
  }

  private async comparePSSARecords(
    sourceRecords: any[],
    year: number,
    level: string,
    config: any
  ) {
    const comparison = {
      passed: 0,
      failed: 0,
      examples: [] as Array<{ rowNumber: number; issue: string; sourceData?: any; dbData?: any }>
    };

    for (let i = 0; i < sourceRecords.length; i++) {
      const row = sourceRecords[i];
      const schoolId = level === 'school' && config.schoolNumberColumn
        ? this.normalizeId(row[config.schoolNumberColumn])
        : null;
      const grade = config.gradeColumn ? this.parseGrade(row[config.gradeColumn]) : null;
      const subject = this.normalizeSubject(row[config.subjectColumn]);

      // Try to find matching record in DB
      const whereConditions = [
        eq(pssaResults.year, year),
        eq(pssaResults.level, level),
        eq(pssaResults.subject, subject)
      ];

      if (grade) {
        whereConditions.push(eq(pssaResults.grade, grade));
      }

      if (schoolId) {
        whereConditions.push(eq(pssaResults.schoolId, schoolId as any));
      }

      const dbRecords = await db
        .select()
        .from(pssaResults)
        .where(and(...whereConditions) as any);

      if (dbRecords.length === 0) {
        comparison.failed++;
        if (comparison.examples.length < 5) {
          comparison.examples.push({
            rowNumber: i + 1,
            issue: 'Record not found in database',
            sourceData: { schoolId, grade, subject }
          });
        }
      } else {
        // Check if proficiency percentages match (allowing small floating point variance)
        const dbRecord = dbRecords[0];
        const sourceProficient = this.parsePercent(row[config.proficientOrAboveColumn || '% Advanced/Proficient']);
        const dbProficient = dbRecord.proficientOrAbovePercent;

        if (sourceProficient !== null && dbProficient !== null) {
          const diff = Math.abs(sourceProficient - dbProficient);
          if (diff > 0.1) {
            // More than 0.1% difference
            comparison.failed++;
            if (comparison.examples.length < 5) {
              comparison.examples.push({
                rowNumber: i + 1,
                issue: `Proficiency mismatch: Source=${sourceProficient}%, DB=${dbProficient}%`,
                sourceData: row,
                dbData: dbRecord
              });
            }
          } else {
            comparison.passed++;
          }
        } else {
          comparison.passed++;
        }
      }
    }

    return comparison;
  }

  private async compareKeystoneRecords(
    sourceRecords: any[],
    year: number,
    level: string,
    config: any
  ) {
    const comparison = {
      passed: 0,
      failed: 0,
      examples: [] as Array<{ rowNumber: number; issue: string; sourceData?: any; dbData?: any }>
    };

    for (let i = 0; i < sourceRecords.length; i++) {
      const row = sourceRecords[i];
      const schoolId = level === 'school' && config.schoolNumberColumn
        ? this.normalizeId(row[config.schoolNumberColumn])
        : null;
      const subject = this.normalizeKeystoneSubject(row[config.subjectColumn]);

      // Try to find matching record in DB
      const whereConditions = [
        eq(keystoneResults.year, year),
        eq(keystoneResults.level, level),
        eq(keystoneResults.subject, subject)
      ];

      if (schoolId) {
        whereConditions.push(eq(keystoneResults.schoolId, schoolId as any));
      }

      const dbRecords = await db
        .select()
        .from(keystoneResults)
        .where(and(...whereConditions) as any);

      if (dbRecords.length === 0) {
        comparison.failed++;
        if (comparison.examples.length < 5) {
          comparison.examples.push({
            rowNumber: i + 1,
            issue: 'Record not found in database',
            sourceData: { schoolId, subject }
          });
        }
      } else {
        const dbRecord = dbRecords[0];
        const sourceProficient = this.parsePercent(row[config.proficientOrAboveColumn || '% Advanced/Proficient']);
        const dbProficient = dbRecord.proficientOrAbovePercent;

        if (sourceProficient !== null && dbProficient !== null) {
          const diff = Math.abs(sourceProficient - dbProficient);
          if (diff > 0.1) {
            comparison.failed++;
            if (comparison.examples.length < 5) {
              comparison.examples.push({
                rowNumber: i + 1,
                issue: `Proficiency mismatch: Source=${sourceProficient}%, DB=${dbProficient}%`,
                sourceData: row,
                dbData: dbRecord
              });
            }
          } else {
            comparison.passed++;
          }
        } else {
          comparison.passed++;
        }
      }
    }

    return comparison;
  }

  // Utility methods (same as DataImporter)
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

  private parsePercent(value: any): number | null {
    if (value === undefined || value === null || value === '' || value === 'N/A' || value === '*')
      return null;
    const str = String(value).replace(/[%,]/g, '');
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
  }

  // Generate a human-readable report
  generateTextReport(report: VerificationReport): string {
    const lines: string[] = [];

    lines.push('='.repeat(80));
    lines.push('DATA VERIFICATION REPORT');
    lines.push('='.repeat(80));
    lines.push(`Generated: ${report.timestamp.toISOString()}`);
    lines.push('');

    lines.push('SUMMARY');
    lines.push('-'.repeat(80));
    lines.push(`Total Files: ${report.totalFiles}`);
    lines.push(`Files Verified: ${report.filesVerified}`);
    lines.push(`Files Passed: ${report.filesPassed} ✓`);
    lines.push(`Files Failed: ${report.filesFailed} ✗`);
    lines.push(`Overall Match: ${report.summary.overallMatch ? 'YES ✓' : 'NO ✗'}`);
    lines.push('');

    lines.push(`Total Source Records: ${report.summary.totalSourceRecords.toLocaleString()}`);
    lines.push(`Total DB Records: ${report.summary.totalDbRecords.toLocaleString()}`);
    lines.push(
      `Difference: ${(report.summary.totalSourceRecords - report.summary.totalDbRecords).toLocaleString()}`
    );
    lines.push('');

    if (report.summary.criticalIssues.length > 0) {
      lines.push('CRITICAL ISSUES');
      lines.push('-'.repeat(80));
      report.summary.criticalIssues.forEach(issue => lines.push(`⚠️  ${issue}`));
      lines.push('');
    }

    lines.push('DETAILED RESULTS');
    lines.push('-'.repeat(80));

    // Group by status
    const failed = report.results.filter(r => !r.match);
    const passed = report.results.filter(r => r.match);

    if (failed.length > 0) {
      lines.push('\nFAILED FILES:');
      failed.forEach(result => {
        lines.push(`\n  ✗ ${result.fileName}`);
        lines.push(`    Source: ${result.sourceRowCount}, DB: ${result.dbRowCount}`);
        lines.push(`    Discrepancy: ${result.discrepancy}`);
        if (result.sampleComparison) {
          lines.push(
            `    Sample Check: ${result.sampleComparison.passed} passed, ${result.sampleComparison.failed} failed`
          );
          if (result.sampleComparison.examples.length > 0) {
            lines.push(`    Issues:`);
            result.sampleComparison.examples.forEach(ex => {
              lines.push(`      - Row ${ex.rowNumber}: ${ex.issue}`);
            });
          }
        }
        result.errors.forEach(err => lines.push(`    Error: ${err}`));
      });
    }

    if (passed.length > 0) {
      lines.push(`\n\nPASSED FILES (${passed.length}):`);
      passed.forEach(result => {
        const sampleInfo = result.sampleComparison
          ? ` (Sample: ${result.sampleComparison.passed}/${result.sampleComparison.passed + result.sampleComparison.failed} matched)`
          : '';
        lines.push(
          `  ✓ ${result.fileName}: ${result.sourceRowCount} records${sampleInfo}`
        );
      });
    }

    lines.push('');
    lines.push('='.repeat(80));

    return lines.join('\n');
  }
}
