import * as XLSX from 'xlsx';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { eq, and, sql } from 'drizzle-orm';
import * as path from 'path';
import * as fs from 'fs/promises';
import { 
  counties, 
  districts, 
  schools, 
  pssaResults, 
  keystoneResults, 
  dataImports 
} from '../db/newSchema';

interface FileConfig {
  headerRow: number;
  countyColumn?: string;
  districtColumn?: string;
  schoolColumn?: string;
  aunColumn?: string;
  schoolNumberColumn?: string;
  yearColumn?: string;
  gradeColumn?: string;
  subjectColumn?: string;
  groupColumn?: string;
  numberScoredColumn?: string;
  advancedColumn?: string;
  proficientColumn?: string;
  basicColumn?: string;
  belowBasicColumn?: string;
  proficientOrAboveColumn?: string;
}

interface ParsedRow {
  county?: string;
  districtName?: string;
  schoolName?: string;
  aun?: string;
  schoolNumber?: string;
  year?: number;
  grade?: number;
  subject?: string;
  demographicGroup?: string;
  totalTested?: number;
  advancedPercent?: number;
  proficientPercent?: number;
  basicPercent?: number;
  belowBasicPercent?: number;
  proficientOrAbovePercent?: number;
}

export class NewDataImporter {
  private db: ReturnType<typeof drizzle>;
  private sourcePath = path.join(process.cwd(), '..', 'sources');
  private countyMap = new Map<string, number>();
  private districtMap = new Map<string, number>();
  private schoolMap = new Map<string, number>();
  private fileConfigs = new Map<string, FileConfig>();

  constructor() {
    const sqlite = new Database(path.join(process.cwd(), 'school-data.db'));
    this.db = drizzle(sqlite);
    this.initializeFileConfigs();
  }

  private initializeFileConfigs() {
    // PSSA School-level configs (these have county info)
    this.fileConfigs.set('2015 pssa school level data.xlsx', {
      headerRow: 6,
      countyColumn: 'County',
      districtColumn: 'District Name',
      schoolColumn: 'School Name',
      aunColumn: 'AUN',
      schoolNumberColumn: 'School Number',
      gradeColumn: 'Grade',
      subjectColumn: 'Subject',
      groupColumn: 'Group',
      numberScoredColumn: 'Number Scored',
      advancedColumn: '% Advanced',
      proficientColumn: '% Proficient',
      basicColumn: '% Basic',
      belowBasicColumn: '% Below Basic'
    });

    // 2016-2023 PSSA School configs
    for (let year = 2016; year <= 2023; year++) {
      if (year === 2020) continue; // No 2020 data
      const fileName = `${year} pssa school level data.xlsx`;
      this.fileConfigs.set(fileName, {
        headerRow: 4,
        countyColumn: 'County',
        districtColumn: 'District Name',
        schoolColumn: 'School Name',
        aunColumn: 'District AUN',
        schoolNumberColumn: 'School Number',
        gradeColumn: 'Grade',
        subjectColumn: 'Subject',
        groupColumn: 'Group',
        numberScoredColumn: 'Number Scored',
        advancedColumn: '% Advanced',
        proficientColumn: '% Proficient',
        basicColumn: '% Basic',
        belowBasicColumn: '% Below Basic'
      });
    }
    
    // 2024 PSSA School config (different column names)
    this.fileConfigs.set('2024-pssa-school-data.xlsx', {
      headerRow: 4,
      countyColumn: 'County',
      districtColumn: 'District Name',
      schoolColumn: 'School Name',
      aunColumn: 'AUN',
      schoolNumberColumn: 'School Number',
      gradeColumn: 'Grade',
      subjectColumn: 'Subject',
      groupColumn: 'Group',
      numberScoredColumn: 'Number Scored',
      advancedColumn: 'Percent Advanced',
      proficientColumn: 'Percent Proficient',
      basicColumn: 'Percent Basic',
      belowBasicColumn: 'Percent Below Basic',
      proficientOrAboveColumn: 'Percent Proficient and above'
    });

    // PSSA District-level configs (these also have county)
    for (let year = 2015; year <= 2023; year++) {
      if (year === 2020) continue; // No 2020 data
      const fileName = `${year} pssa district level data.xlsx`;
      this.fileConfigs.set(fileName, {
        headerRow: year === 2015 ? 6 : 4,
        countyColumn: 'County',
        districtColumn: 'District Name',
        aunColumn: year === 2015 ? 'AUN' : 'District AUN',
        gradeColumn: 'Grade',
        subjectColumn: 'Subject',
        groupColumn: 'Group',
        numberScoredColumn: 'Number Scored',
        advancedColumn: '% Advanced',
        proficientColumn: '% Proficient',
        basicColumn: '% Basic',
        belowBasicColumn: '% Below Basic'
      });
    }
    
    // 2024 PSSA District config (different column names)
    this.fileConfigs.set('2024-pssa-district-data.xlsx', {
      headerRow: 4,
      countyColumn: 'County',
      districtColumn: 'District Name',
      aunColumn: 'AUN',
      gradeColumn: 'Grade',
      subjectColumn: 'Subject',
      groupColumn: 'Group',
      numberScoredColumn: 'Number Scored',
      advancedColumn: 'Percent Advanced',
      proficientColumn: 'Percent Proficient',
      basicColumn: 'Percent Basic',
      belowBasicColumn: 'Percent Below Basic',
      proficientOrAboveColumn: 'Percent Proficient and above'
    });

    // PSSA State-level configs (no county)
    for (let year = 2015; year <= 2023; year++) {
      if (year === 2020) continue; // No 2020 data
      const fileName = `${year} pssa state level data.xlsx`;
      this.fileConfigs.set(fileName, {
        headerRow: year === 2015 ? 6 : 4,
        gradeColumn: 'Grade',
        subjectColumn: 'Subject',
        groupColumn: 'Group',
        numberScoredColumn: 'Number Scored',
        advancedColumn: '% Advanced',
        proficientColumn: '% Proficient',
        basicColumn: '% Basic',
        belowBasicColumn: '% Below Basic'
      });
    }
    
    // 2024 PSSA State config (different column names)
    this.fileConfigs.set('2024-pssa-state-data.xlsx', {
      headerRow: 4,
      gradeColumn: 'Grade',
      subjectColumn: 'Subject',
      groupColumn: 'Group',
      numberScoredColumn: 'Number Scored',
      advancedColumn: 'Percent Advanced',
      proficientColumn: 'Percent Proficient',
      basicColumn: 'Percent Basic',
      belowBasicColumn: 'Percent Below Basic',
      proficientOrAboveColumn: 'Percent Proficient and above'
    });

    // Keystone School-level configs
    // 2015 has unique structure
    this.fileConfigs.set('2015 keystone exam school level data.xlsx', {
      headerRow: 7,
      districtColumn: 'District Name',
      schoolColumn: 'School Name',
      subjectColumn: 'Subject',
      groupColumn: 'Student_Group_Name',
      numberScoredColumn: 'N Scored',
      advancedColumn: 'Pct. Advanced',
      proficientColumn: 'Pct. Proficient',
      basicColumn: 'Pct. Basic',
      belowBasicColumn: 'Pct. Below Basic'
    });

    // 2016-2019 have "exams" in the name
    for (let year = 2016; year <= 2019; year++) {
      this.fileConfigs.set(`${year} keystone exams school level data.xlsx`, {
        headerRow: 4,
        countyColumn: 'County',
        districtColumn: 'District Name',
        schoolColumn: 'School Name',
        aunColumn: 'AUN',
        schoolNumberColumn: 'School Number',
        subjectColumn: 'Subject',
        groupColumn: 'Group',
        numberScoredColumn: 'Number Scored',
        advancedColumn: 'Percent Advanced',
        proficientColumn: 'Percent Proficient',
        basicColumn: 'Percent Basic',
        belowBasicColumn: 'Percent Below Basic'
      });
    }

    // 2021-2023 standard format
    for (let year = 2021; year <= 2023; year++) {
      this.fileConfigs.set(`${year} keystone school level data.xlsx`, {
        headerRow: 4,
        countyColumn: 'County',
        districtColumn: 'District Name',
        schoolColumn: 'School Name',
        aunColumn: 'AUN',
        schoolNumberColumn: 'School Number',
        subjectColumn: 'Subject',
        groupColumn: 'Group',
        numberScoredColumn: 'Number Scored',
        advancedColumn: 'Percent Advanced',
        proficientColumn: 'Percent Proficient',
        basicColumn: 'Percent Basic',
        belowBasicColumn: 'Percent Below Basic'
      });
    }

    // 2024 has different name format
    this.fileConfigs.set('2024-keystone-exams-school-grade-11-data.xlsx', {
      headerRow: 3,
      countyColumn: 'County',
      districtColumn: 'District Name',
      schoolColumn: 'School Name',
      aunColumn: 'AUN',
      schoolNumberColumn: 'School Number',
      subjectColumn: 'Subject',
      groupColumn: 'Group',
      gradeColumn: 'Grade',
      numberScoredColumn: 'Number Scored',
      advancedColumn: 'Percent Advanced',
      proficientColumn: 'Percent Proficient',
      basicColumn: 'Percent Basic',
      belowBasicColumn: 'Percent Below Basic',
      proficientOrAboveColumn: 'Percent Proficient and above'
    });

    // ===== KEYSTONE DISTRICT LEVEL CONFIGS =====
    // 2015-2019 district files
    this.fileConfigs.set('2015 keystone district data.xlsx', {
      headerRow: 4,
      countyColumn: 'County',
      districtColumn: 'District Name',
      aunColumn: 'AUN',
      subjectColumn: 'Subject',
      groupColumn: 'Group',
      gradeColumn: 'Grade',
      numberScoredColumn: 'Number Scored',
      advancedColumn: 'Percent Advanced',
      proficientColumn: 'Percent Proficient',
      basicColumn: 'Percent Basic',
      belowBasicColumn: 'Percent Below Basic',
      proficientOrAboveColumn: 'Percent Proficient and above'
    });

    this.fileConfigs.set('2016 keystone district data.xlsx', {
      headerRow: 4,
      countyColumn: 'County',
      districtColumn: 'District Name',
      aunColumn: 'AUN',
      subjectColumn: 'Subject',
      groupColumn: 'Group',
      gradeColumn: 'Grade',
      numberScoredColumn: 'Number Scored',
      advancedColumn: 'Percent Advanced',
      proficientColumn: 'Percent Proficient',
      basicColumn: 'Percent Basic',
      belowBasicColumn: 'Percent Below Basic',
      proficientOrAboveColumn: 'Percent Proficient and above'
    });

    this.fileConfigs.set('2017 keystone district data.xlsx', {
      headerRow: 4,
      countyColumn: 'County',
      districtColumn: 'District Name',
      aunColumn: 'AUN',
      subjectColumn: 'Subject',
      groupColumn: 'Group',
      gradeColumn: 'Grade',
      numberScoredColumn: 'Number Scored',
      advancedColumn: 'Percent Advanced',
      proficientColumn: 'Percent Proficient',
      basicColumn: 'Percent Basic',
      belowBasicColumn: 'Percent Below Basic',
      proficientOrAboveColumn: 'Percent Proficient and above'
    });

    this.fileConfigs.set('2018 keystone district data.xlsx', {
      headerRow: 4,
      countyColumn: 'County',
      districtColumn: 'District Name',
      aunColumn: 'AUN',
      subjectColumn: 'Subject',
      groupColumn: 'Group',
      gradeColumn: 'Grade',
      numberScoredColumn: 'Number Scored',
      advancedColumn: 'Percent Advanced',
      proficientColumn: 'Percent Proficient',
      basicColumn: 'Percent Basic',
      belowBasicColumn: 'Percent Below Basic',
      proficientOrAboveColumn: 'Percent Proficient and above'
    });

    this.fileConfigs.set('2019 keystone district data.xlsx', {
      headerRow: 4,
      countyColumn: 'County',
      districtColumn: 'District Name',
      aunColumn: 'AUN',
      subjectColumn: 'Subject',
      groupColumn: 'Group',
      gradeColumn: 'Grade',
      numberScoredColumn: 'Number Scored',
      advancedColumn: 'Percent Advanced',
      proficientColumn: 'Percent Proficient',
      basicColumn: 'Percent Basic',
      belowBasicColumn: 'Percent Below Basic',
      proficientOrAboveColumn: 'Percent Proficient and above'
    });

    // 2021-2022 district files
    this.fileConfigs.set('2021 keystone district data.xlsx', {
      headerRow: 4,
      countyColumn: 'County',
      districtColumn: 'District Name',
      aunColumn: 'AUN',
      subjectColumn: 'Subject',
      groupColumn: 'Group',
      gradeColumn: 'Grade',
      numberScoredColumn: 'Number Scored',
      advancedColumn: 'Percent Advanced',
      proficientColumn: 'Percent Proficient',
      basicColumn: 'Percent Basic',
      belowBasicColumn: 'Percent Below Basic',
      proficientOrAboveColumn: 'Percent Proficient and above'
    });

    this.fileConfigs.set('2022 keystone district data.xlsx', {
      headerRow: 4,
      countyColumn: 'County',
      districtColumn: 'District Name',
      aunColumn: 'AUN',
      subjectColumn: 'Subject',
      groupColumn: 'Group',
      gradeColumn: 'Grade',
      numberScoredColumn: 'Number Scored',
      advancedColumn: 'Percent Advanced',
      proficientColumn: 'Percent Proficient',
      basicColumn: 'Percent Basic',
      belowBasicColumn: 'Percent Below Basic',
      proficientOrAboveColumn: 'Percent Proficient and above'
    });

    // 2024 district file
    this.fileConfigs.set('2024-keystone-exams-district-grade-11-data.xlsx', {
      headerRow: 3,
      countyColumn: 'County',
      districtColumn: 'District Name',
      aunColumn: 'AUN',
      subjectColumn: 'Subject',
      groupColumn: 'Group',
      gradeColumn: 'Grade',
      numberScoredColumn: 'Number Scored',
      advancedColumn: 'Percent Advanced',
      proficientColumn: 'Percent Proficient',
      basicColumn: 'Percent Basic',
      belowBasicColumn: 'Percent Below Basic',
      proficientOrAboveColumn: 'Percent Proficient and above'
    });

    // ===== KEYSTONE STATE LEVEL CONFIGS =====
    // State files don't have county/district/school columns
    this.fileConfigs.set('2015 keystone exam state level data.xlsx', {
      headerRow: 3,
      subjectColumn: 'Subject',
      groupColumn: 'Group',
      gradeColumn: 'Grade',
      numberScoredColumn: 'Number Scored',
      advancedColumn: '% Advanced',
      proficientColumn: '% Proficient',
      basicColumn: '% Basic',
      belowBasicColumn: '% Below Basic',
      proficientOrAboveColumn: '% Advanced/Proficient'
    });

    this.fileConfigs.set('2016 keystone exams state level data.xlsx', {
      headerRow: 3,
      subjectColumn: 'Subject',
      groupColumn: 'Group',
      gradeColumn: 'Grade',
      numberScoredColumn: 'Number Scored',
      advancedColumn: '% Advanced',
      proficientColumn: '% Proficient',
      basicColumn: '% Basic',
      belowBasicColumn: '% Below Basic',
      proficientOrAboveColumn: '% Advanced/Proficient'
    });

    this.fileConfigs.set('2017 keystone exams state level data.xlsx', {
      headerRow: 3,
      subjectColumn: 'Subject',
      groupColumn: 'Group',
      gradeColumn: 'Grade',
      numberScoredColumn: 'Number Scored',
      advancedColumn: '% Advanced',
      proficientColumn: '% Proficient',
      basicColumn: '% Basic',
      belowBasicColumn: '% Below Basic',
      proficientOrAboveColumn: '% Advanced/Proficient'
    });

    this.fileConfigs.set('2018 keystone exams state level data.xlsx', {
      headerRow: 3,
      subjectColumn: 'Subject',
      groupColumn: 'Group',
      gradeColumn: 'Grade',
      numberScoredColumn: 'Number Scored',
      advancedColumn: '% Advanced',
      proficientColumn: '% Proficient',
      basicColumn: '% Basic',
      belowBasicColumn: '% Below Basic',
      proficientOrAboveColumn: '% Advanced/Proficient'
    });

    this.fileConfigs.set('2019 keystone exams state level data.xlsx', {
      headerRow: 3,
      subjectColumn: 'Subject',
      groupColumn: 'Group',
      gradeColumn: 'Grade',
      numberScoredColumn: 'Number Scored',
      advancedColumn: '% Advanced',
      proficientColumn: '% Proficient',
      basicColumn: '% Basic',
      belowBasicColumn: '% Below Basic',
      proficientOrAboveColumn: '% Advanced/Proficient'
    });

    this.fileConfigs.set('2021 keystone grade 11 state level data.xlsx', {
      headerRow: 3,
      subjectColumn: 'Subject',
      groupColumn: 'Group',
      gradeColumn: 'Grade',
      numberScoredColumn: 'Number Scored',
      advancedColumn: '% Advanced',
      proficientColumn: '% Proficient',
      basicColumn: '% Basic',
      belowBasicColumn: '% Below Basic',
      proficientOrAboveColumn: '% Advanced/Proficient'
    });

    this.fileConfigs.set('2022 keystone exams state level data.xlsx', {
      headerRow: 3,
      subjectColumn: 'Subject',
      groupColumn: 'Group',
      gradeColumn: 'Grade',
      numberScoredColumn: 'Number Scored',
      advancedColumn: '% Advanced',
      proficientColumn: '% Proficient',
      basicColumn: '% Basic',
      belowBasicColumn: '% Below Basic',
      proficientOrAboveColumn: '% Advanced/Proficient'
    });

    this.fileConfigs.set('2024-keystone-exams-state-data-grade-11.xlsx', {
      headerRow: 3,
      subjectColumn: 'Subject',
      groupColumn: 'Group',
      gradeColumn: 'Grade',
      numberScoredColumn: 'Number Scored',
      advancedColumn: '% Advanced',
      proficientColumn: '% Proficient',
      basicColumn: '% Basic',
      belowBasicColumn: '% Below Basic',
      proficientOrAboveColumn: '% Advanced/Proficient'
    });
  }

  async importAllFiles(): Promise<void> {
    console.log('\n🚀 STARTING COMPREHENSIVE DATA IMPORT');
    console.log('=' .repeat(80));

    // Step 1: Load counties first (from county reference file if available, or extract from data)
    await this.loadCounties();

    // Step 2: Process all files
    const directories = [
      'pssa/school', 'pssa/district', 'pssa/state',
      'keystone/school', 'keystone/district', 'keystone/state'
    ];

    let totalProcessed = 0;
    let totalSkipped = 0;
    let totalFiles = 0;

    for (const dir of directories) {
      const dirPath = path.join(this.sourcePath, dir);
      try {
        const files = await fs.readdir(dirPath);
        const xlsxFiles = files.filter(f => f.endsWith('.xlsx')).sort();
        
        console.log(`\n📁 Processing ${xlsxFiles.length} files from ${dir}`);
        
        for (const file of xlsxFiles) {
          const filePath = path.join(dirPath, file);
          const result = await this.importFile(filePath, dir);
          totalProcessed += result.processed;
          totalSkipped += result.skipped;
          totalFiles++;
        }
      } catch (error) {
        console.error(`Error processing directory ${dir}:`, error);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 IMPORT COMPLETE');
    console.log('='.repeat(80));
    console.log(`✅ Files processed: ${totalFiles}`);
    console.log(`✅ Records imported: ${totalProcessed}`);
    console.log(`⚠️  Records skipped: ${totalSkipped}`);
    console.log(`🏛️  Counties: ${this.countyMap.size}`);
    console.log(`🏫 Districts: ${this.districtMap.size}`);
    console.log(`📚 Schools: ${this.schoolMap.size}`);

    // Verify Bucks County specifically
    await this.verifyBucksCounty();
  }

  private async loadCounties() {
    console.log('\n📍 Loading Pennsylvania counties...');
    
    // Pennsylvania county codes and names
    const paCounties = [
      { code: '101', name: 'Adams' },
      { code: '102', name: 'Allegheny' },
      { code: '103', name: 'Armstrong' },
      { code: '104', name: 'Beaver' },
      { code: '105', name: 'Bedford' },
      { code: '106', name: 'Berks' },
      { code: '107', name: 'Blair' },
      { code: '108', name: 'Bradford' },
      { code: '109', name: 'Bucks' },
      { code: '110', name: 'Butler' },
      { code: '111', name: 'Cambria' },
      { code: '112', name: 'Cameron' },
      { code: '113', name: 'Carbon' },
      { code: '114', name: 'Centre' },
      { code: '115', name: 'Chester' },
      { code: '116', name: 'Clarion' },
      { code: '117', name: 'Clearfield' },
      { code: '118', name: 'Clinton' },
      { code: '119', name: 'Columbia' },
      { code: '120', name: 'Crawford' },
      { code: '121', name: 'Cumberland' },
      { code: '122', name: 'Dauphin' },
      { code: '123', name: 'Delaware' },
      { code: '124', name: 'Elk' },
      { code: '125', name: 'Erie' },
      { code: '126', name: 'Fayette' },
      { code: '127', name: 'Forest' },
      { code: '128', name: 'Franklin' },
      { code: '129', name: 'Fulton' },
      { code: '130', name: 'Greene' },
      { code: '131', name: 'Huntingdon' },
      { code: '132', name: 'Indiana' },
      { code: '133', name: 'Jefferson' },
      { code: '134', name: 'Juniata' },
      { code: '135', name: 'Lackawanna' },
      { code: '136', name: 'Lancaster' },
      { code: '137', name: 'Lawrence' },
      { code: '138', name: 'Lebanon' },
      { code: '139', name: 'Lehigh' },
      { code: '140', name: 'Luzerne' },
      { code: '141', name: 'Lycoming' },
      { code: '142', name: 'McKean' },
      { code: '143', name: 'Mercer' },
      { code: '144', name: 'Mifflin' },
      { code: '145', name: 'Monroe' },
      { code: '146', name: 'Montgomery' },
      { code: '147', name: 'Montour' },
      { code: '148', name: 'Northampton' },
      { code: '149', name: 'Northumberland' },
      { code: '150', name: 'Perry' },
      { code: '151', name: 'Philadelphia' },
      { code: '152', name: 'Pike' },
      { code: '153', name: 'Potter' },
      { code: '154', name: 'Schuylkill' },
      { code: '155', name: 'Snyder' },
      { code: '156', name: 'Somerset' },
      { code: '157', name: 'Sullivan' },
      { code: '158', name: 'Susquehanna' },
      { code: '159', name: 'Tioga' },
      { code: '160', name: 'Union' },
      { code: '161', name: 'Venango' },
      { code: '162', name: 'Warren' },
      { code: '163', name: 'Washington' },
      { code: '164', name: 'Wayne' },
      { code: '165', name: 'Westmoreland' },
      { code: '166', name: 'Wyoming' },
      { code: '167', name: 'York' }
    ];

    for (const county of paCounties) {
      const result = this.db.insert(counties)
        .values({
          countyCode: county.code,
          name: county.name,
          fullName: `${county.name} County`
        })
        .onConflictDoNothing()
        .returning()
        .get();
      
      if (result) {
        this.countyMap.set(county.name.toLowerCase(), result.id);
      }
    }

    // Also load existing counties from database
    const existingCounties = this.db.select().from(counties).all();
    for (const county of existingCounties) {
      this.countyMap.set(county.name.toLowerCase(), county.id);
    }

    console.log(`  ✓ Loaded ${this.countyMap.size} counties`);
  }

  private async importFile(filePath: string, category: string): Promise<{ processed: number; skipped: number }> {
    const fileName = path.basename(filePath);
    const config = this.fileConfigs.get(fileName);
    
    if (!config) {
      console.log(`  ⚠️  No config for ${fileName}, skipping`);
      return { processed: 0, skipped: 0 };
    }

    console.log(`  📄 ${fileName}`);

    // Log import start
    const importRecord = this.db.insert(dataImports)
      .values({
        fileName,
        filePath,
        fileType: fileName.includes('pssa') ? 'pssa' : 'keystone',
        level: this.extractLevel(category),
        year: this.extractYear(fileName),
        status: 'processing',
        startedAt: new Date()
      })
      .returning()
      .get();

    try {
      // Read Excel file
      const workbook = XLSX.readFile(filePath);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as any[][];
      
      // Get headers
      const headers = data[config.headerRow] || [];
      const columnMap = new Map<string, number>();
      headers.forEach((header: any, index: number) => {
        if (header) {
          columnMap.set(String(header).trim(), index);
        }
      });

      let processed = 0;
      let skipped = 0;
      const year = this.extractYear(fileName);
      const level = this.extractLevel(category);
      const isPSSA = fileName.includes('pssa');

      // Process data rows
      for (let i = config.headerRow + 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.every((cell: any) => cell === null || cell === '')) continue;

        const parsedRow = this.parseRow(row, config, columnMap, year);
        
        // Skip if missing critical data
        if (!parsedRow.subject || !parsedRow.demographicGroup) {
          skipped++;
          continue;
        }

        // Process entities (county, district, school)
        let countyId: number | null = null;
        let districtId: number | null = null;
        let schoolId: number | null = null;

        if (parsedRow.county) {
          countyId = await this.ensureCounty(parsedRow.county);
        }

        if (parsedRow.districtName && parsedRow.aun) {
          districtId = await this.ensureDistrict(parsedRow.districtName, parsedRow.aun, countyId);
        }

        if (parsedRow.schoolName && parsedRow.schoolNumber && districtId) {
          schoolId = await this.ensureSchool(parsedRow.schoolName, parsedRow.schoolNumber, districtId);
        }

        // Insert test result
        if (isPSSA) {
          await this.insertPSSAResult(parsedRow, level, schoolId, districtId, countyId, fileName);
        } else {
          await this.insertKeystoneResult(parsedRow, level, schoolId, districtId, countyId, fileName);
        }

        processed++;
      }

      // Update import record
      this.db.update(dataImports)
        .set({
          status: 'completed',
          totalRows: data.length - config.headerRow - 1,
          processedRows: processed + skipped,
          insertedRows: processed,
          skippedRows: skipped,
          completedAt: new Date()
        })
        .where(eq(dataImports.id, importRecord.id))
        .run();

      console.log(`     ✓ Imported ${processed} records (skipped ${skipped})`);
      return { processed, skipped };

    } catch (error) {
      // Update import record with error
      this.db.update(dataImports)
        .set({
          status: 'failed',
          errorMessage: String(error),
          completedAt: new Date()
        })
        .where(eq(dataImports.id, importRecord.id))
        .run();

      console.error(`     ❌ Error: ${error}`);
      return { processed: 0, skipped: 0 };
    }
  }

  private parseRow(row: any[], config: FileConfig, columnMap: Map<string, number>, fileYear: number): ParsedRow {
    const getColumn = (name?: string) => {
      if (!name) return null;
      const index = columnMap.get(name);
      return index !== undefined ? row[index] : null;
    };

    return {
      county: this.cleanString(getColumn(config.countyColumn)),
      districtName: this.cleanString(getColumn(config.districtColumn)),
      schoolName: this.cleanString(getColumn(config.schoolColumn)),
      aun: this.normalizeId(getColumn(config.aunColumn)),
      schoolNumber: this.normalizeId(getColumn(config.schoolNumberColumn)),
      year: config.yearColumn ? this.parseNumber(getColumn(config.yearColumn)) : fileYear,
      grade: config.gradeColumn ? this.parseGrade(getColumn(config.gradeColumn)) : undefined,
      subject: this.normalizeSubject(getColumn(config.subjectColumn)),
      demographicGroup: this.normalizeDemographicGroup(getColumn(config.groupColumn)),
      totalTested: this.parseNumber(getColumn(config.numberScoredColumn)),
      advancedPercent: this.parsePercent(getColumn(config.advancedColumn)),
      proficientPercent: this.parsePercent(getColumn(config.proficientColumn)),
      basicPercent: this.parsePercent(getColumn(config.basicColumn)),
      belowBasicPercent: this.parsePercent(getColumn(config.belowBasicColumn)),
      proficientOrAbovePercent: config.proficientOrAboveColumn ? 
        this.parsePercent(getColumn(config.proficientOrAboveColumn)) :
        this.calculateProficientOrAbove(
          this.parsePercent(getColumn(config.advancedColumn)) || undefined,
          this.parsePercent(getColumn(config.proficientColumn)) || undefined
        )
    };
  }

  private async ensureCounty(countyName: string): Promise<number | null> {
    if (!countyName) return null;

    const cleanName = countyName.replace(/\s+County$/i, '').trim();
    const key = cleanName.toLowerCase();

    if (this.countyMap.has(key)) {
      return this.countyMap.get(key)!;
    }

    // Try to find or create
    let county = this.db.select()
      .from(counties)
      .where(sql`LOWER(${counties.name}) = ${key}`)
      .get();

    if (!county) {
      // Create new county
      county = this.db.insert(counties)
        .values({
          countyCode: `9${String(this.countyMap.size + 100).padStart(2, '0')}`, // Generate code
          name: cleanName,
          fullName: `${cleanName} County`
        })
        .returning()
        .get();
    }

    if (county) {
      this.countyMap.set(key, county.id);
      return county.id;
    }

    return null;
  }

  private async ensureDistrict(districtName: string, aun: string, countyId: number | null): Promise<number | null> {
    if (!districtName || !aun) return null;

    const key = aun;
    if (this.districtMap.has(key)) {
      return this.districtMap.get(key)!;
    }

    // Try to find or create
    let district = this.db.select()
      .from(districts)
      .where(eq(districts.aun, aun))
      .get();

    if (!district) {
      // Create new district
      district = this.db.insert(districts)
        .values({
          aun,
          name: districtName,
          countyId: countyId || 1, // Default to first county if not provided
          districtType: this.determineDistrictType(districtName)
        })
        .returning()
        .get();
    } else if (countyId && !district.countyId) {
      // Update district with county if missing
      this.db.update(districts)
        .set({ countyId })
        .where(eq(districts.id, district.id))
        .run();
    }

    if (district) {
      this.districtMap.set(key, district.id);
      return district.id;
    }

    return null;
  }

  private async ensureSchool(schoolName: string, schoolNumber: string, districtId: number): Promise<number | null> {
    if (!schoolName || !schoolNumber || !districtId) return null;

    const key = `${districtId}-${schoolNumber}`;
    if (this.schoolMap.has(key)) {
      return this.schoolMap.get(key)!;
    }

    // Try to find or create
    let school = this.db.select()
      .from(schools)
      .where(and(
        eq(schools.schoolNumber, schoolNumber),
        eq(schools.districtId, districtId)
      ))
      .get();

    if (!school) {
      // Create new school
      school = this.db.insert(schools)
        .values({
          schoolNumber,
          districtId,
          name: schoolName,
          schoolType: this.determineSchoolType(schoolName),
          isCharter: schoolName.toLowerCase().includes('charter')
        })
        .returning()
        .get();
    }

    if (school) {
      this.schoolMap.set(key, school.id);
      return school.id;
    }

    return null;
  }

  private async insertPSSAResult(
    row: ParsedRow,
    level: string,
    schoolId: number | null,
    districtId: number | null,
    countyId: number | null,
    sourceFile: string
  ) {
    const validSubjects = ['Mathematics', 'English Language Arts', 'Science'];
    if (!validSubjects.includes(row.subject || '')) return;

    this.db.insert(pssaResults)
      .values({
        level,
        schoolId,
        districtId,
        countyId,
        year: row.year || new Date().getFullYear(),
        grade: row.grade,
        subject: row.subject!,
        demographicGroup: row.demographicGroup || 'All Students',
        totalTested: row.totalTested,
        advancedPercent: row.advancedPercent,
        proficientPercent: row.proficientPercent,
        basicPercent: row.basicPercent,
        belowBasicPercent: row.belowBasicPercent,
        proficientOrAbovePercent: row.proficientOrAbovePercent,
        sourceFile
      })
      .onConflictDoNothing()
      .run();
  }

  private async insertKeystoneResult(
    row: ParsedRow,
    level: string,
    schoolId: number | null,
    districtId: number | null,
    countyId: number | null,
    sourceFile: string
  ) {
    const validSubjects = ['Algebra I', 'Biology', 'Literature'];
    if (!validSubjects.includes(row.subject || '')) return;

    this.db.insert(keystoneResults)
      .values({
        level,
        schoolId,
        districtId,
        countyId,
        year: row.year || new Date().getFullYear(),
        subject: row.subject!,
        grade: row.grade || 11,
        demographicGroup: row.demographicGroup || 'All Students',
        totalTested: row.totalTested,
        advancedPercent: row.advancedPercent,
        proficientPercent: row.proficientPercent,
        basicPercent: row.basicPercent,
        belowBasicPercent: row.belowBasicPercent,
        proficientOrAbovePercent: row.proficientOrAbovePercent,
        sourceFile
      })
      .onConflictDoNothing()
      .run();
  }

  private async verifyBucksCounty() {
    console.log('\n🔍 Verifying Bucks County data...');
    
    // Check if Bucks County exists
    const bucksCounty = this.db.select()
      .from(counties)
      .where(sql`LOWER(${counties.name}) = 'bucks'`)
      .get();
    
    if (!bucksCounty) {
      console.log('  ❌ Bucks County not found in database!');
      return;
    }
    
    console.log(`  ✓ Bucks County found (ID: ${bucksCounty.id})`);
    
    // Count districts in Bucks County
    const bucksDistricts = this.db.select({ count: sql<number>`count(*)` })
      .from(districts)
      .where(eq(districts.countyId, bucksCounty.id))
      .get();
    
    console.log(`  ✓ Districts in Bucks County: ${bucksDistricts?.count || 0}`);
    
    // Count schools in Bucks County
    const bucksSchools = this.db.select({ count: sql<number>`count(*)` })
      .from(schools)
      .innerJoin(districts, eq(schools.districtId, districts.id))
      .where(eq(districts.countyId, bucksCounty.id))
      .get();
    
    console.log(`  ✓ Schools in Bucks County: ${bucksSchools?.count || 0}`);
    
    // Sample some Bucks County schools
    const sampleSchools = this.db.select({
      schoolName: schools.name,
      districtName: districts.name
    })
      .from(schools)
      .innerJoin(districts, eq(schools.districtId, districts.id))
      .where(eq(districts.countyId, bucksCounty.id))
      .limit(5)
      .all();
    
    if (sampleSchools.length > 0) {
      console.log('  📚 Sample Bucks County schools:');
      sampleSchools.forEach(s => {
        console.log(`     - ${s.schoolName} (${s.districtName})`);
      });
    }
  }

  // Helper methods
  private extractYear(fileName: string): number {
    const match = fileName.match(/20\d{2}/);
    return match ? parseInt(match[0]) : new Date().getFullYear();
  }

  private extractLevel(category: string): string {
    if (category.includes('school')) return 'school';
    if (category.includes('district')) return 'district';
    if (category.includes('state')) return 'state';
    return 'school';
  }

  private cleanString(value: any): string | undefined {
    if (!value) return undefined;
    const str = String(value).trim();
    return str === '' || str === 'N/A' || str === '*' ? undefined : str;
  }

  private normalizeId(value: any): string | undefined {
    if (!value) return undefined;
    const str = String(value).trim();
    if (str === '' || str === 'N/A' || str === '*') return undefined;
    return str;
  }

  private normalizeSubject(value: any): string | undefined {
    if (!value) return undefined;
    const subject = String(value).toLowerCase().trim();
    
    // PSSA subjects
    if (subject.includes('math')) return 'Mathematics';
    if (subject.includes('ela') || subject.includes('english')) return 'English Language Arts';
    if (subject.includes('science')) return 'Science';
    
    // Keystone subjects
    if (subject.includes('algebra')) return 'Algebra I';
    if (subject.includes('biology')) return 'Biology';
    if (subject.includes('literature')) return 'Literature';
    
    return String(value).trim();
  }

  private normalizeDemographicGroup(value: any): string {
    if (!value) return 'All Students';
    const group = String(value).trim();
    
    // Common mappings
    if (group.toLowerCase().includes('all student')) return 'All Students';
    if (group.toLowerCase() === 'male') return 'Male';
    if (group.toLowerCase() === 'female') return 'Female';
    if (group.toLowerCase().includes('white')) return 'White';
    if (group.toLowerCase().includes('black') || group.toLowerCase().includes('african')) return 'Black/African American';
    if (group.toLowerCase().includes('hispanic') || group.toLowerCase().includes('latino')) return 'Hispanic/Latino';
    if (group.toLowerCase().includes('asian')) return 'Asian';
    if (group.toLowerCase().includes('native american') || group.toLowerCase().includes('american indian')) return 'Native American';
    if (group.toLowerCase().includes('pacific')) return 'Pacific Islander';
    if (group.toLowerCase().includes('multi') || group.toLowerCase().includes('two or more')) return 'Multi-Racial';
    if (group.toLowerCase().includes('iep')) return 'IEP';
    if (group.toLowerCase().includes('economically')) return 'Economically Disadvantaged';
    if (group.toLowerCase().includes('english learner') || group.toLowerCase().includes('ell')) return 'English Learners';
    
    return group;
  }

  private parseGrade(value: any): number | undefined {
    if (!value) return undefined;
    const grade = String(value).replace(/\D/g, '');
    const parsed = parseInt(grade);
    return isNaN(parsed) ? undefined : parsed;
  }

  private parseNumber(value: any): number | undefined {
    if (value === undefined || value === null || value === '' || value === 'N/A' || value === '*') return undefined;
    const num = parseFloat(String(value).replace(/,/g, ''));
    return isNaN(num) ? undefined : num;
  }

  private parsePercent(value: any): number | undefined {
    if (value === undefined || value === null || value === '' || value === 'N/A' || value === '*') return undefined;
    const str = String(value).replace(/[%,]/g, '');
    const num = parseFloat(str);
    return isNaN(num) ? undefined : num;
  }

  private calculateProficientOrAbove(advanced?: number, proficient?: number): number | undefined {
    if (advanced === undefined || proficient === undefined) return undefined;
    return advanced + proficient;
  }

  private determineDistrictType(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes('charter')) return 'Charter';
    if (lower.includes('cyber')) return 'Cyber Charter';
    if (lower.includes('intermediate unit') || lower.includes(' iu ')) return 'IU';
    if (lower.includes('career') || lower.includes('technical') || lower.includes('vo-tech')) return 'Career/Technical';
    return 'Public';
  }

  private determineSchoolType(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes('elementary') || lower.includes(' el ') || lower.includes(' es ')) return 'Elementary';
    if (lower.includes('middle') || lower.includes(' ms ')) return 'Middle';
    if (lower.includes('high school') || lower.includes(' hs ')) return 'High';
    if (lower.includes('career') || lower.includes('technical') || lower.includes('vo-tech')) return 'Career/Technical';
    if (lower.includes('charter')) return 'Charter';
    if (lower.includes('cyber')) return 'Cyber Charter';
    if (lower.includes('intermediate')) return 'Intermediate';
    return 'Other';
  }
}