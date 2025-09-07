import * as XLSX from 'xlsx';
import { db } from '../db';
import { schools, districts } from '../db/schema';
import { logger } from '../utils/logger';
import path from 'path';

export class SchoolProcessor {
  async processSchoolsFromData(): Promise<void> {
    try {
      // Get unique schools from PSSA data
      const schoolFiles = await this.getSchoolFiles();
      
      for (const filePath of schoolFiles) {
        await this.extractSchoolsFromFile(filePath);
      }
      
      logger.info('School processing completed');
    } catch (error) {
      logger.error('Error processing schools:', error);
    }
  }

  private async getSchoolFiles(): Promise<string[]> {
    const sourcePath = path.join(process.cwd(), '..', 'sources');
    const files: string[] = [];
    
    // Add most recent school-level files
    files.push(path.join(sourcePath, 'pssa/school/2024-pssa-school-data.xlsx'));
    files.push(path.join(sourcePath, 'keystone/school/2024-keystone-exams-school-grade-11-data.xlsx'));
    
    return files.filter(f => {
      try {
        require('fs').accessSync(f);
        return true;
      } catch {
        return false;
      }
    });
  }

  private async extractSchoolsFromFile(filePath: string): Promise<void> {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      const uniqueDistricts = new Map();
      const uniqueSchools = new Map();

      for (const row of data) {
        // Extract district info
        const districtId = this.normalizeId(row['District AUN'] || row['AUN']);
        const districtName = row['District Name'] || row['District'];
        
        if (districtId && districtName && !uniqueDistricts.has(districtId)) {
          uniqueDistricts.set(districtId, {
            districtId,
            name: districtName,
            county: row['County'] || null,
            intermediateUnit: row['IU'] || row['Intermediate Unit'] || null,
          });
        }

        // Extract school info
        const schoolId = this.normalizeId(row['School Number'] || row['School Code']);
        const schoolName = row['School Name'] || row['School'];
        
        if (schoolId && schoolName && !uniqueSchools.has(schoolId)) {
          uniqueSchools.set(schoolId, {
            schoolId,
            districtId,
            name: schoolName,
            schoolType: this.determineSchoolType(row),
            gradeRange: row['Grade Range'] || row['Grades'] || null,
            city: row['City'] || null,
            zipCode: row['Zip'] || row['Zip Code'] || null,
            enrollment: this.parseNumber(row['Enrollment'] || row['Total Enrollment']),
            isCharter: this.isCharterSchool(schoolName, row),
          });
        }
      }

      // Insert districts
      for (const district of uniqueDistricts.values()) {
        await db.insert(districts)
          .values(district)
          .onConflictDoUpdate({
            target: districts.districtId,
            set: {
              name: district.name,
              county: district.county,
              intermediateUnit: district.intermediateUnit,
              updatedAt: new Date(),
            },
          });
      }

      // Insert schools
      for (const school of uniqueSchools.values()) {
        await db.insert(schools)
          .values(school)
          .onConflictDoUpdate({
            target: schools.schoolId,
            set: {
              name: school.name,
              schoolType: school.schoolType,
              gradeRange: school.gradeRange,
              enrollment: school.enrollment,
              updatedAt: new Date(),
            },
          });
      }

      logger.info(`Processed ${uniqueDistricts.size} districts and ${uniqueSchools.size} schools from ${path.basename(filePath)}`);
    } catch (error) {
      logger.error(`Error extracting schools from ${filePath}:`, error);
    }
  }

  private normalizeId(value: any): string | null {
    if (!value) return null;
    return String(value).trim().padStart(6, '0');
  }

  private determineSchoolType(row: any): string | null {
    const schoolName = (row['School Name'] || '').toLowerCase();
    const type = row['School Type'] || row['Type'] || '';
    
    if (type) return type;
    
    if (schoolName.includes('elementary')) return 'Elementary';
    if (schoolName.includes('middle')) return 'Middle';
    if (schoolName.includes('high school')) return 'High';
    if (schoolName.includes('career') || schoolName.includes('technical')) return 'Career/Technical';
    if (schoolName.includes('charter')) return 'Charter';
    if (schoolName.includes('cyber')) return 'Cyber Charter';
    
    return null;
  }

  private isCharterSchool(name: string, row: any): boolean {
    const lowerName = name.toLowerCase();
    const type = (row['School Type'] || '').toLowerCase();
    
    return lowerName.includes('charter') || 
           lowerName.includes('cyber') || 
           type.includes('charter');
  }

  private parseNumber(value: any): number | null {
    if (!value) return null;
    const num = parseFloat(String(value).replace(/,/g, ''));
    return isNaN(num) ? null : num;
  }
}