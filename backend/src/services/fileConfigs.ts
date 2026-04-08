// File configuration mappings based on analysis of all Excel files

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
    
    if (lowerName.includes('2017') || lowerName.includes('2018') || lowerName.includes('2019')) {
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
        proficientOrAboveColumn: '% Advanced/Proficient',
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
        advancedColumn: '% Advanced',
        proficientColumn: '% Proficient',
        basicColumn: '% Basic',
        belowBasicColumn: '% Below Basic',
        proficientOrAboveColumn: '% Advanced/Proficient',
        extractYearFromFilename: true
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
    const headerRow = 4;

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
  
  // PSSA State Level
  if (lowerName.includes('pssa') && lowerName.includes('state')) {
    // 2024 file: headers at row 3, uses 'Percent' names, no Year column
    if (lowerName.includes('2024')) {
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

    const headerRow = (lowerName.includes('2019') || lowerName.includes('2021') ||
                       lowerName.includes('2022') || lowerName.includes('2023')) ? 3 : 4;

    return {
      headerRow,
      yearColumn: lowerName.includes('2015') || lowerName.includes('2021') ||
                  lowerName.includes('2022') || lowerName.includes('2023') ? 'Year' : undefined,
      subjectColumn: 'Subject',
      gradeColumn: 'Grade',
      groupColumn: 'Group',
      numberScoredColumn: lowerName.includes('2016') ? 'Number scored' : 'Number Scored',
      advancedColumn: lowerName.includes('percent') ? 'Percent Advanced' : '% Advanced',
      proficientColumn: lowerName.includes('percent') ? 'Percent Proficient' : '% Proficient',
      basicColumn: lowerName.includes('percent') ? 'Percent Basic' : '% Basic',
      belowBasicColumn: lowerName.includes('percent') ? 'Percent Below Basic' : '% Below Basic',
      proficientOrAboveColumn: lowerName.includes('2018') || lowerName.includes('2019') ?
                              '% Advanced/Proficient' : 'Percent Proficient and above',
      extractYearFromFilename: !lowerName.includes('2015') && !lowerName.includes('2021') &&
                                !lowerName.includes('2022') && !lowerName.includes('2023')
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
    
    if (lowerName.includes('2017') || lowerName.includes('2018') || lowerName.includes('2019')) {
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
        proficientOrAboveColumn: '% Advanced/Proficient',
        extractYearFromFilename: true
      };
    }
    
    if (lowerName.includes('2023') || lowerName.includes('2024')) {
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
    const headerRow = (lowerName.includes('2023') || lowerName.includes('2024')) ? 3 : 4;
    
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