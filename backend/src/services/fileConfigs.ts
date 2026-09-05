// File configuration mappings based on analysis of all Excel files

/**
 * Canonical demographic group label normalization.
 *
 * Source PSSA/Keystone files use slightly different spellings of the same
 * groups over the years (e.g. "American Indian / Alaskan Native" with or
 * without spaces around the slash, "Multi-Racial" vs "Multi-ethnic", "Native
 * Hawaiian..." with or without "(not Hispanic)"). This map collapses every
 * observed variant to a single canonical label so aggregations group cleanly.
 *
 * Canonical choices (pre-computed against the live DB row counts):
 *   - "American Indian/Alaskan Native (not Hispanic)" — no spaces around slash
 *     per the task spec. The spaced variant is currently more common in the
 *     DB (13k vs 3k rows) but the task explicitly prescribes the unspaced form
 *     as canonical, so the data agent will run a one-shot UPDATE after import.
 *   - "Native Hawaiian or other Pacific Islander (not Hispanic)" — always
 *     include the "(not Hispanic)" suffix; this variant has 8k rows vs 2k for
 *     the bare form.
 *   - "Multi-ethnic (not Hispanic)" — 80k+8k rows vs 4k for "Multi-Racial".
 *   - "HU" -> "Historically Underperforming" (2015 keystone state file uses
 *     the abbreviation).
 *
 * The map is exported so the data agent can reuse it for a one-shot cleanup
 * UPDATE on existing rows.
 */
export const DEMOGRAPHIC_LABEL_ALIASES: Record<string, string> = {
  // American Indian / Alaskan Native — canonicalize to NO spaces around slash
  'American Indian / Alaskan Native (not Hispanic)': 'American Indian/Alaskan Native (not Hispanic)',
  'American Indian / Alaskan Native': 'American Indian/Alaskan Native (not Hispanic)',
  'American Indian/Alaskan Native': 'American Indian/Alaskan Native (not Hispanic)',
  'American Indian or Alaska Native': 'American Indian/Alaskan Native (not Hispanic)',
  'Native American': 'American Indian/Alaskan Native (not Hispanic)',

  // Native Hawaiian / Pacific Islander — always include "(not Hispanic)"
  'Native Hawaiian or other Pacific Islander': 'Native Hawaiian or other Pacific Islander (not Hispanic)',
  'Native Hawaiian or Other Pacific Islander': 'Native Hawaiian or other Pacific Islander (not Hispanic)',
  'Pacific Islander': 'Native Hawaiian or other Pacific Islander (not Hispanic)',

  // Multi — canonical is Multi-ethnic (higher combined row count than Multi-Racial)
  'Multi-Racial (not Hispanic)': 'Multi-ethnic (not Hispanic)',
  'Multi-Racial': 'Multi-ethnic (not Hispanic)',
  'Multi-ethnic': 'Multi-ethnic (not Hispanic)',
  'Two or More Races': 'Multi-ethnic (not Hispanic)',

  // Historically Underperforming — 2015 keystone state file abbreviates to "HU"
  'HU': 'Historically Underperforming'
};

/**
 * Normalize a raw demographic group label to its canonical form. Unknown
 * labels are returned unchanged (after trimming). Safe to call on null/
 * undefined/empty — returns "All Students" as a sensible default for those.
 */
export function normalizeDemographicLabel(raw: any): string {
  if (raw == null) return 'All Students';
  const trimmed = String(raw).trim();
  if (trimmed === '') return 'All Students';
  return DEMOGRAPHIC_LABEL_ALIASES[trimmed] ?? trimmed;
}

export interface FileConfig {
  headerRow: number;
  yearColumn?: string;
  aunColumn?: string;
  schoolNumberColumn?: string;
  countyColumn?: string;
  districtNameColumn?: string;
  schoolNameColumn?: string;
  subjectColumn: string;
  gradeColumn?: string;
  groupColumn?: string;
  numberScoredColumn?: string;
  advancedColumn?: string;
  proficientColumn?: string;
  basicColumn?: string;
  belowBasicColumn?: string;
  proficientOrAboveColumn?: string;
  extractYearFromFilename: boolean;
  skipRows?: number[];
  notes?: string;
}

// Get configuration for a specific file
export function getFileConfig(fileName: string): FileConfig {
  const lowerName = fileName.toLowerCase();
  
  // PSSA School Level
  if (lowerName.includes('pssa') && lowerName.includes('school')) {
    if (lowerName.includes('2015')) {
      return {
        headerRow: 6,
        yearColumn: 'Year',
        aunColumn: 'AUN',
        schoolNumberColumn: 'School Number',
        districtNameColumn: 'District',
        schoolNameColumn: 'School',
        subjectColumn: 'Subject',
        gradeColumn: 'Grade',
        groupColumn: 'Group',
        numberScoredColumn: 'Number Scored',
        advancedColumn: '% Advanced',
        proficientColumn: '% Proficient',
        basicColumn: '% Basic',
        belowBasicColumn: '% Below Basic',
        proficientOrAboveColumn: '% Advanced/Proficient',
        extractYearFromFilename: false
      };
    }
    
    if (lowerName.includes('2016')) {
      return {
        headerRow: 4,
        yearColumn: 'Year',
        aunColumn: 'AUN',
        schoolNumberColumn: 'School Number',
        countyColumn: 'County',
        districtNameColumn: 'District',
        schoolNameColumn: 'School',
        subjectColumn: 'Subject',
        gradeColumn: 'Grade',
        groupColumn: 'Group',
        numberScoredColumn: 'Number Scored',
        advancedColumn: '% Advanced',
        proficientColumn: '% Proficient',
        basicColumn: '% Basic',
        belowBasicColumn: '% Below Basic',
        proficientOrAboveColumn: '% Advanced/Proficient',
        extractYearFromFilename: false
      };
    }
    
    if (lowerName.includes('2017')) {
      return {
        headerRow: 4,
        aunColumn: 'AUN',
        schoolNumberColumn: 'School Number',
        countyColumn: 'County',
        districtNameColumn: 'District Name',
        schoolNameColumn: 'School Name',
        subjectColumn: 'Subject',
        gradeColumn: 'Grade',
        groupColumn: 'Group',
        numberScoredColumn: 'Number Scored',
        advancedColumn: '% Advanced',
        proficientColumn: '% Proficient',
        basicColumn: '% Basic',
        belowBasicColumn: '% Below Basic',
        extractYearFromFilename: true
      };
    }

    if (lowerName.includes('2018') || lowerName.includes('2019')) {
      return {
        headerRow: 4,
        aunColumn: 'AUN',
        schoolNumberColumn: 'School Number',
        countyColumn: 'County',
        districtNameColumn: 'District Name',
        schoolNameColumn: 'School Name',
        subjectColumn: 'Subject',
        gradeColumn: 'Grade',
        groupColumn: 'Group',
        numberScoredColumn: 'Number Scored',
        advancedColumn: 'Percent Advanced',
        proficientColumn: 'Percent Proficient',
        basicColumn: 'Percent Basic',
        belowBasicColumn: 'Percent Below Basic',
        extractYearFromFilename: true
      };
    }

    if (lowerName.includes('2021')) {
      return {
        headerRow: 6,
        aunColumn: 'AUN',
        schoolNumberColumn: 'School Number',
        countyColumn: 'County',
        districtNameColumn: 'District Name',
        schoolNameColumn: 'School Name',
        subjectColumn: 'Subject',
        gradeColumn: 'Grade',
        groupColumn: 'Group',
        numberScoredColumn: 'Number Scored',
        advancedColumn: 'Percent Advanced',
        proficientColumn: 'Percent Proficient',
        basicColumn: 'Percent Basic',
        belowBasicColumn: 'Percent Below Basic',
        extractYearFromFilename: true
      };
    }

    // 2025: sheet 'PSSA', hdr r3 (0-indexed), Year col, 'Percent' style names.
    if (lowerName.includes('2025')) {
      return {
        headerRow: 3,
        yearColumn: 'Year',
        aunColumn: 'AUN',
        schoolNumberColumn: 'School Number',
        countyColumn: 'County',
        districtNameColumn: 'District Name',
        schoolNameColumn: 'School Name',
        subjectColumn: 'Subject',
        gradeColumn: 'Grade',
        groupColumn: 'Group',
        numberScoredColumn: 'Number Scored',
        advancedColumn: 'Percent Advanced',
        proficientColumn: 'Percent Proficient',
        basicColumn: 'Percent Basic',
        belowBasicColumn: 'Percent Below Basic',
        proficientOrAboveColumn: 'Percent Proficient and above',
        extractYearFromFilename: false
      };
    }

    // 2022, 2023, 2024
    return {
      headerRow: 4,
      yearColumn: 'Year',
      aunColumn: 'AUN',
      schoolNumberColumn: 'School Number',
      countyColumn: 'County',
      districtNameColumn: 'District Name',
      schoolNameColumn: 'School Name',
      subjectColumn: 'Subject',
      gradeColumn: 'Grade',
      groupColumn: 'Group',
      numberScoredColumn: 'Number Scored',
      advancedColumn: 'Percent Advanced',
      proficientColumn: 'Percent Proficient',
      basicColumn: 'Percent Basic',
      belowBasicColumn: 'Percent Below Basic',
      proficientOrAboveColumn: 'Percent Proficient and above',
      extractYearFromFilename: false
    };
  }
  
  // PSSA District Level
  if (lowerName.includes('pssa') && lowerName.includes('district')) {
    // 2025 moved the header up one row (sheet 'PSSA', hdr r3 0-indexed).
    const headerRow = lowerName.includes('2025') ? 3 : 4;

    return {
      headerRow,
      yearColumn: 'Year',
      aunColumn: 'AUN',
      countyColumn: 'County',
      districtNameColumn: 'District Name',
      subjectColumn: 'Subject',
      gradeColumn: 'Grade',
      groupColumn: 'Group',
      numberScoredColumn: 'Number Scored',
      advancedColumn: 'Percent Advanced',
      proficientColumn: 'Percent Proficient',
      basicColumn: 'Percent Basic',
      belowBasicColumn: 'Percent Below Basic',
      proficientOrAboveColumn: 'Percent Proficient and above',
      extractYearFromFilename: false
    };
  }
  
  // PSSA State Level — column names and header rows vary per year.
  // Verified against every source file in sources/pssa/state/.
  if (lowerName.includes('pssa') && lowerName.includes('state')) {
    // 2015: Sheet1, hdr r4, Year col, '% Advanced' style, no PaA column.
    if (lowerName.includes('2015')) {
      return {
        headerRow: 4,
        yearColumn: 'Year',
        subjectColumn: 'Subject',
        gradeColumn: 'Grade',
        groupColumn: 'Group',
        numberScoredColumn: 'Number Scored',
        advancedColumn: '% Advanced',
        proficientColumn: '% Proficient',
        basicColumn: '% Basic',
        belowBasicColumn: '% Below Basic',
        extractYearFromFilename: false
      };
    }

    // 2016: 'website' sheet, hdr r4, Year col, 'Percent' style, 'Number scored' (lowercase s), PaA = 'Percent Proficient and above'.
    if (lowerName.includes('2016')) {
      return {
        headerRow: 4,
        yearColumn: 'Year',
        subjectColumn: 'Subject',
        gradeColumn: 'Grade',
        groupColumn: 'Group',
        numberScoredColumn: 'Number scored',
        advancedColumn: 'Percent Advanced',
        proficientColumn: 'Percent Proficient',
        basicColumn: 'Percent Basic',
        belowBasicColumn: 'Percent Below Basic',
        proficientOrAboveColumn: 'Percent Proficient and above',
        extractYearFromFilename: false
      };
    }

    // 2017: 'PSSA State data' sheet, hdr r4, no Year col, 'Percent' style, PaA = 'Percent Advanced/Proficient'.
    if (lowerName.includes('2017')) {
      return {
        headerRow: 4,
        subjectColumn: 'Subject',
        gradeColumn: 'Grade',
        groupColumn: 'Group',
        numberScoredColumn: 'Number Scored',
        advancedColumn: 'Percent Advanced',
        proficientColumn: 'Percent Proficient',
        basicColumn: 'Percent Basic',
        belowBasicColumn: 'Percent Below Basic',
        proficientOrAboveColumn: 'Percent Advanced/Proficient',
        extractYearFromFilename: true
      };
    }

    // 2018: 'State' sheet, hdr r4, no Year col, '% Advanced' style, PaA = '% Advanced/Proficient'.
    if (lowerName.includes('2018')) {
      return {
        headerRow: 4,
        subjectColumn: 'Subject',
        gradeColumn: 'Grade',
        groupColumn: 'Group',
        numberScoredColumn: 'Number Scored',
        advancedColumn: '% Advanced',
        proficientColumn: '% Proficient',
        basicColumn: '% Basic',
        belowBasicColumn: '% Below Basic',
        proficientOrAboveColumn: '% Advanced/Proficient',
        extractYearFromFilename: true
      };
    }

    // 2019: 'State' sheet, hdr r3, no Year col, '% Advanced' style, PaA = '% Advanced/Proficient'.
    if (lowerName.includes('2019')) {
      return {
        headerRow: 3,
        subjectColumn: 'Subject',
        gradeColumn: 'Grade',
        groupColumn: 'Group',
        numberScoredColumn: 'Number Scored',
        advancedColumn: '% Advanced',
        proficientColumn: '% Proficient',
        basicColumn: '% Basic',
        belowBasicColumn: '% Below Basic',
        proficientOrAboveColumn: '% Advanced/Proficient',
        extractYearFromFilename: true
      };
    }

    // 2021: 'State data' sheet, hdr r3, Year col, 'Percent' style, PaA = 'Percent Proficient and above'.
    if (lowerName.includes('2021')) {
      return {
        headerRow: 3,
        yearColumn: 'Year',
        subjectColumn: 'Subject',
        gradeColumn: 'Grade',
        groupColumn: 'Group',
        numberScoredColumn: 'Number Scored',
        advancedColumn: 'Percent Advanced',
        proficientColumn: 'Percent Proficient',
        basicColumn: 'Percent Basic',
        belowBasicColumn: 'Percent Below Basic',
        proficientOrAboveColumn: 'Percent Proficient and above',
        extractYearFromFilename: false
      };
    }

    // 2022: 'PSSA' sheet, hdr r3, Year col, 'Percent' style, PaA = 'Percent Advanced/Proficient'.
    if (lowerName.includes('2022')) {
      return {
        headerRow: 3,
        yearColumn: 'Year',
        subjectColumn: 'Subject',
        gradeColumn: 'Grade',
        groupColumn: 'Group',
        numberScoredColumn: 'Number Scored',
        advancedColumn: 'Percent Advanced',
        proficientColumn: 'Percent Proficient',
        basicColumn: 'Percent Basic',
        belowBasicColumn: 'Percent Below Basic',
        proficientOrAboveColumn: 'Percent Advanced/Proficient',
        extractYearFromFilename: false
      };
    }

    // 2023: Sheet1, hdr r3, Year col, 'Percent' style, PaA = 'Percent Proficient and Above' (note the capital A).
    if (lowerName.includes('2023')) {
      return {
        headerRow: 3,
        yearColumn: 'Year',
        subjectColumn: 'Subject',
        gradeColumn: 'Grade',
        groupColumn: 'Group',
        numberScoredColumn: 'Number Scored',
        advancedColumn: 'Percent Advanced',
        proficientColumn: 'Percent Proficient',
        basicColumn: 'Percent Basic',
        belowBasicColumn: 'Percent Below Basic',
        proficientOrAboveColumn: 'Percent Proficient and Above',
        extractYearFromFilename: false
      };
    }

    // 2025: sheet 'PSSA', hdr r3, has Year col, 'Percent' style, PaA = 'Percent Proficient and above'.
    if (lowerName.includes('2025')) {
      return {
        headerRow: 3,
        yearColumn: 'Year',
        subjectColumn: 'Subject',
        gradeColumn: 'Grade',
        groupColumn: 'Group',
        numberScoredColumn: 'Number Scored',
        advancedColumn: 'Percent Advanced',
        proficientColumn: 'Percent Proficient',
        basicColumn: 'Percent Basic',
        belowBasicColumn: 'Percent Below Basic',
        proficientOrAboveColumn: 'Percent Proficient and above',
        extractYearFromFilename: false
      };
    }

    // 2024: Sheet1, hdr r3, no Year col, 'Percent' style, PaA = 'Percent Proficient and above'.
    return {
      headerRow: 3,
      subjectColumn: 'Subject',
      gradeColumn: 'Grade',
      groupColumn: 'Group',
      numberScoredColumn: 'Number Scored',
      advancedColumn: 'Percent Advanced',
      proficientColumn: 'Percent Proficient',
      basicColumn: 'Percent Basic',
      belowBasicColumn: 'Percent Below Basic',
      proficientOrAboveColumn: 'Percent Proficient and above',
      extractYearFromFilename: true
    };
  }
  
  // Keystone School Level
  if (lowerName.includes('keystone') && lowerName.includes('school')) {
    if (lowerName.includes('2015')) {
      return {
        headerRow: 7,
        aunColumn: 'AUN',
        schoolNumberColumn: 'Schl',
        districtNameColumn: 'District Name',
        schoolNameColumn: 'School Name',
        subjectColumn: 'Subject',
        gradeColumn: 'Grade',
        groupColumn: 'Student_Group_Name',
        numberScoredColumn: 'N Scored',
        advancedColumn: 'Pct. Advanced',
        proficientColumn: 'Pct. Proficient',
        basicColumn: 'Pct. Basic',
        belowBasicColumn: 'Pct. Below Basic',
        extractYearFromFilename: true
      };
    }
    
    if (lowerName.includes('2016')) {
      return {
        headerRow: 4,
        yearColumn: 'Year',
        aunColumn: 'AUN',
        schoolNumberColumn: 'School Number',
        countyColumn: 'County',
        districtNameColumn: 'District Name',
        schoolNameColumn: 'School Name',
        subjectColumn: 'Subject',
        gradeColumn: 'Grade',
        groupColumn: 'Group',
        numberScoredColumn: 'Number Scored',
        advancedColumn: 'Percent Advanced',
        proficientColumn: 'Percent Proficient',
        basicColumn: 'Percent Basic',
        belowBasicColumn: 'Percent Below Basic',
        extractYearFromFilename: false
      };
    }
    
    if (lowerName.includes('2017')) {
      return {
        headerRow: 4,
        aunColumn: 'AUN',
        schoolNumberColumn: 'School Number',
        countyColumn: 'County',
        districtNameColumn: 'District Name',
        schoolNameColumn: 'School Name',
        subjectColumn: 'Subject',
        gradeColumn: 'Grade',
        groupColumn: 'Group',
        numberScoredColumn: 'Number Scored',
        advancedColumn: '% Advanced',
        proficientColumn: '% Proficient',
        basicColumn: '% Basic',
        belowBasicColumn: '% Below Basic',
        extractYearFromFilename: true
      };
    }

    if (lowerName.includes('2018') || lowerName.includes('2019')) {
      return {
        headerRow: 4,
        aunColumn: 'AUN',
        schoolNumberColumn: 'School Number',
        countyColumn: 'County',
        districtNameColumn: 'District Name',
        schoolNameColumn: 'School Name',
        subjectColumn: 'Subject',
        gradeColumn: 'Grade',
        groupColumn: 'Group',
        numberScoredColumn: 'Number Scored',
        advancedColumn: 'Percent Advanced',
        proficientColumn: 'Percent Proficient',
        basicColumn: 'Percent Basic',
        belowBasicColumn: 'Percent Below Basic',
        extractYearFromFilename: true
      };
    }
    
    if (lowerName.includes('2023') || lowerName.includes('2024') || lowerName.includes('2025')) {
      return {
        headerRow: 3,
        yearColumn: 'Year',
        aunColumn: 'AUN',
        schoolNumberColumn: 'School Number',
        countyColumn: 'County',
        districtNameColumn: 'District Name',
        schoolNameColumn: 'School Name',
        subjectColumn: 'Subject',
        gradeColumn: 'Grade',
        groupColumn: 'Group',
        numberScoredColumn: 'Number Scored',
        advancedColumn: 'Percent Advanced',
        proficientColumn: 'Percent Proficient',
        basicColumn: 'Percent Basic',
        belowBasicColumn: 'Percent Below Basic',
        proficientOrAboveColumn: lowerName.includes('2023') ? '% Advanced/Proficient' : 'Percent Proficient and above',
        extractYearFromFilename: false
      };
    }
    
    // Default for 2021, 2022 (no Year column — extract from filename)
    return {
      headerRow: lowerName.includes('2021') ? 5 : 4,
      aunColumn: 'AUN',
      schoolNumberColumn: 'School Number',
      countyColumn: 'County',
      districtNameColumn: 'District Name',
      schoolNameColumn: 'School Name',
      subjectColumn: 'Subject',
      gradeColumn: 'Grade',
      groupColumn: 'Group',
      numberScoredColumn: 'Number Scored',
      advancedColumn: 'Percent Advanced',
      proficientColumn: 'Percent Proficient',
      basicColumn: 'Percent Basic',
      belowBasicColumn: 'Percent Below Basic',
      proficientOrAboveColumn: 'Percent Proficient and above',
      extractYearFromFilename: true
    };
  }
  
  // Keystone District Level
  if (lowerName.includes('keystone') && lowerName.includes('district')) {
    const headerRow = (lowerName.includes('2023') || lowerName.includes('2024') || lowerName.includes('2025')) ? 3 : 4;
    
    return {
      headerRow,
      yearColumn: 'Year',
      aunColumn: 'AUN',
      countyColumn: 'County',
      districtNameColumn: 'District Name',
      subjectColumn: 'Subject',
      gradeColumn: 'Grade',
      groupColumn: 'Group',
      numberScoredColumn: 'Number Scored',
      advancedColumn: 'Percent Advanced',
      proficientColumn: 'Percent Proficient',
      basicColumn: 'Percent Basic',
      belowBasicColumn: 'Percent Below Basic',
      proficientOrAboveColumn: lowerName.includes('2023') ? '% Advanced/Proficient' : 'Percent Proficient and above',
      extractYearFromFilename: false
    };
  }
  
  // Keystone State Level
  if (lowerName.includes('keystone') && lowerName.includes('state')) {
    // 2015: headerRow 4, abbreviated columns, no Year column
    if (lowerName.includes('2015')) {
      return {
        headerRow: 4,
        subjectColumn: 'Subject',
        gradeColumn: 'Grade',
        groupColumn: 'Student Group',
        numberScoredColumn: 'N Scored',
        advancedColumn: 'Pct. Advanced',
        proficientColumn: 'Pct. Proficient',
        basicColumn: 'Pct. Basic',
        belowBasicColumn: 'Pct. Below Basic',
        extractYearFromFilename: true
      };
    }

    // 2016: headerRow 4, has Year column, 'Percent' names
    if (lowerName.includes('2016')) {
      return {
        headerRow: 4,
        yearColumn: 'Year',
        subjectColumn: 'Subject',
        gradeColumn: 'Grade',
        groupColumn: 'Group',
        numberScoredColumn: 'Number Scored',
        advancedColumn: 'Percent Advanced',
        proficientColumn: 'Percent Proficient',
        basicColumn: 'Percent Basic',
        belowBasicColumn: 'Percent Below Basic',
        proficientOrAboveColumn: 'Percent Advanced/Proficient',
        extractYearFromFilename: false
      };
    }

    // 2017: headerRow 4, no Year column, 'Percent' names
    if (lowerName.includes('2017')) {
      return {
        headerRow: 4,
        subjectColumn: 'Subject',
        gradeColumn: 'Grade',
        groupColumn: 'Group',
        numberScoredColumn: 'Number Scored',
        advancedColumn: 'Percent Advanced',
        proficientColumn: 'Percent Proficient',
        basicColumn: 'Percent Basic',
        belowBasicColumn: 'Percent Below Basic',
        proficientOrAboveColumn: 'Percent Advanced/Proficient',
        extractYearFromFilename: true
      };
    }

    // 2018-2019: headerRow 3, '% Advanced' names (working)
    if (lowerName.includes('2018') || lowerName.includes('2019')) {
      return {
        headerRow: 3,
        subjectColumn: 'Subject',
        gradeColumn: 'Grade',
        groupColumn: 'Group',
        numberScoredColumn: 'Number Scored',
        advancedColumn: '% Advanced',
        proficientColumn: '% Proficient',
        basicColumn: '% Basic',
        belowBasicColumn: '% Below Basic',
        proficientOrAboveColumn: '% Advanced/Proficient',
        extractYearFromFilename: true
      };
    }

    // 2021: headerRow 4, has Year column, '% Advanced' names, custom Number Scored
    if (lowerName.includes('2021')) {
      return {
        headerRow: 4,
        yearColumn: 'Year',
        subjectColumn: 'Subject',
        gradeColumn: 'Grade',
        groupColumn: 'Group',
        numberScoredColumn: 'Number scored 2021',
        advancedColumn: '% Advanced',
        proficientColumn: '% Proficient',
        basicColumn: '% Basic',
        belowBasicColumn: '% Below Basic',
        proficientOrAboveColumn: '% Proficient and above',
        extractYearFromFilename: false
      };
    }

    // 2022: headerRow 3, has Year column, 'Percent' names (working)
    if (lowerName.includes('2022')) {
      return {
        headerRow: 3,
        yearColumn: 'Year',
        subjectColumn: 'Subject',
        gradeColumn: 'Grade',
        groupColumn: 'Group',
        numberScoredColumn: 'Number Scored',
        advancedColumn: 'Percent Advanced',
        proficientColumn: 'Percent Proficient',
        basicColumn: 'Percent Basic',
        belowBasicColumn: 'Percent Below Basic',
        proficientOrAboveColumn: 'Percent Proficient and above',
        extractYearFromFilename: false
      };
    }

    // 2023: headerRow 3, has Year column, 'Percent' names
    if (lowerName.includes('2023')) {
      return {
        headerRow: 3,
        yearColumn: 'Year',
        subjectColumn: 'Subject',
        gradeColumn: 'Grade',
        groupColumn: 'Group',
        numberScoredColumn: 'Number Scored',
        advancedColumn: 'Percent Advanced',
        proficientColumn: 'Percent Proficient',
        basicColumn: 'Percent Basic',
        belowBasicColumn: 'Percent Below Basic',
        proficientOrAboveColumn: 'Percent Advanced/Proficient',
        extractYearFromFilename: false
      };
    }

    // 2025: sheet 'Keystone', hdr r3, has Year col, 'Percent' style names.
    if (lowerName.includes('2025')) {
      return {
        headerRow: 3,
        yearColumn: 'Year',
        subjectColumn: 'Subject',
        gradeColumn: 'Grade',
        groupColumn: 'Group',
        numberScoredColumn: 'Number Scored',
        advancedColumn: 'Percent Advanced',
        proficientColumn: 'Percent Proficient',
        basicColumn: 'Percent Basic',
        belowBasicColumn: 'Percent Below Basic',
        proficientOrAboveColumn: 'Percent Proficient and above',
        extractYearFromFilename: false
      };
    }

    // 2024: headerRow 3 (working)
    return {
      headerRow: 3,
      subjectColumn: 'Subject',
      gradeColumn: 'Grade',
      groupColumn: 'Group',
      numberScoredColumn: 'Number Scored',
      advancedColumn: 'Percent Advanced',
      proficientColumn: 'Percent Proficient',
      basicColumn: 'Percent Basic',
      belowBasicColumn: 'Percent Below Basic',
      proficientOrAboveColumn: 'Percent Proficient and above',
      extractYearFromFilename: true
    };
  }
  
  // Default fallback
  return {
    headerRow: 4,
    subjectColumn: 'Subject',
    extractYearFromFilename: true,
    notes: 'Using default configuration'
  };
}