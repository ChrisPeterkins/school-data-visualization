# Pennsylvania School Data Inventory

## Overview
This directory contains Pennsylvania school assessment data from 2015-2025, organized by test type (PSSA/Keystone) and administrative level (School/District/State).

## Directory Structure
```
sources/
├── pssa/
│   ├── school/     (10 files: 2015-2025 school-level PSSA results)
│   ├── district/   (10 files: 2015-2025 district-level PSSA results)
│   └── state/      (10 files: 2015-2025 state-level PSSA results)
└── keystone/
    ├── school/     (10 files: 2015-2025 school-level Keystone results)
    ├── district/   (10 files: 2015-2025 district-level Keystone results)
    └── state/      (10 files: 2015-2025 state-level Keystone results)
```

## Data Coverage

### PSSA (Pennsylvania System of School Assessment)
- **Years**: 2015-2025
- **Levels**: School, District, State
- **Grades**: 3-8
- **Subjects**: English Language Arts, Mathematics, Science

### Keystone Exams
- **Years**: 2015-2025
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
- **2025 Science**: The 2025 PSSA files from PDE contain no Science rows at any level (ELA and Math only). Science trends therefore end at 2024.

## 2025 Files (added September 2026)
Downloaded from the PDE Assessment Reporting page
(https://www.pa.gov/agencies/education/data-and-reporting/assessment-reporting):
- `2025-pssa-{school,district,state}-level-data.xlsx`
- `2025-keystone-exams-{school,district,state}-level-data.xlsx`
- PVAAS: `2025-{school,district}-level-state-va.xlsx` and `2025-pvaas-state-student-groups-report-for-{school,district}.xlsx`

Layout: header on row 4 (1-based), a `Year` column, `Percent ...` column names, sheet named `PSSA` / `Keystone`.
Demographic group spelling reverted to `American Indian / Alaskan Native (not Hispanic)` (spaced); the importer canonicalizes it.

All-grades "Total" rows (labelled `Total`, `School Total`, or `District Total` in the files) are stored with `grade = 0` at every level so a school or district has one school-wide figure per subject. Student-weighted aggregates come from `GET /api/performance/summary`; `backend/src/scripts/backfillTotals.ts` adds the total rows to years imported before this was the rule.

School addresses, coordinates, enrollment, grade span, and level-based type come from the NCES Common Core of Data (Urban Institute Education Data API), matched on AUN plus state school number: `npx tsx src/scripts/importSchoolMetadata.ts`. Schools that closed before the CCD year stay without location data.

To import a new year once the files are in place: `cd backend && npx tsx src/scripts/importYear.ts <year>`. The script prints a coverage report at the end; the same report is at `/api/performance/data-status` and on the admin Import page.
PDE announced the 2026 results release is on hold until later in fall 2026.

## Total Files
- **60 Excel files** (.xlsx format), plus PVAAS growth files
- 30 PSSA files (10 per level)
- 30 Keystone files (10 per level)

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