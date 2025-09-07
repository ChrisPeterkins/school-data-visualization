# Pennsylvania School Data Inventory

## Overview
This directory contains Pennsylvania school assessment data from 2015-2024, organized by test type (PSSA/Keystone) and administrative level (School/District/State).

## Directory Structure
```
sources/
├── pssa/
│   ├── school/     (9 files: 2015-2024 school-level PSSA results)
│   ├── district/   (9 files: 2015-2024 district-level PSSA results)
│   └── state/      (9 files: 2015-2024 state-level PSSA results)
└── keystone/
    ├── school/     (9 files: 2015-2024 school-level Keystone results)
    ├── district/   (9 files: 2015-2024 district-level Keystone results)
    └── state/      (9 files: 2015-2024 state-level Keystone results)
```

## Data Coverage

### PSSA (Pennsylvania System of School Assessment)
- **Years**: 2015-2024
- **Levels**: School, District, State
- **Grades**: 3-8
- **Subjects**: English Language Arts, Mathematics, Science

### Keystone Exams
- **Years**: 2015-2024
- **Levels**: School, District, State
- **Subjects**: Algebra I, Biology, Literature
- **Note**: 2021 and 2024 data specifically for Grade 11

## File Naming Conventions

### Standard Format (2015-2023)
`YYYY [test type] [level] data.xlsx`
- Example: `2023 pssa school level data.xlsx`

### 2024 Format
`2024-[test type]-[level]-data.xlsx`
- Example: `2024-pssa-school-data.xlsx`
- Keystone includes grade specification: `2024-keystone-exams-school-grade-11-data.xlsx`

## Data Gaps
- **2020**: No assessment data available (COVID-19 pandemic - testing cancelled)

## Total Files
- **54 Excel files** (.xlsx format)
- 27 PSSA files (9 per level)
- 27 Keystone files (9 per level)

## Usage Notes
1. Files are in Excel format and require parsing with libraries like SheetJS
2. Data structure may vary slightly between years
3. 2024 files use a different naming convention (hyphenated)
4. Grade 11 Keystone data is specifically noted for 2021 and 2024

## Processing Recommendations
1. Parse files by year and level for consistency
2. Account for missing 2020 data in trend analysis
3. Normalize column names across different years
4. Handle variations in school/district identifiers