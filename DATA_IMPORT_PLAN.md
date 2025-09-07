# Data Import Plan for PA School Data

## Overview
After examining all 54 Excel files, here's the structure analysis and import strategy:

## File Structure Patterns

### PSSA Files

#### School Level (9 files)
- **Header Rows**: Vary between row 4 and row 6
- **Years 2015-2024**: Different column naming conventions
- **Key Variations**:
  - 2015, 2021: Headers at row 6
  - 2016-2020, 2022-2024: Headers at row 4
  - 2017-2019: Missing "Year" column (need to extract from filename)
  - Column name variations:
    - "District" vs "District Name"
    - "School" vs "School Name"
    - "Percent Proficient and above" vs "% Advanced/Proficient"

#### District Level (9 files)
- **Consistent Structure**: All files have same headers at row 4
- **Columns**: Year, AUN, County, District Name, Subject, Group, Grade, Number Scored, percentages
- **No School Number** column (district-level aggregation)

#### State Level (9 files)
- **Most Variable**: 8 different header structures
- **Header Rows**: Mix of row 3 and row 4
- **Missing Fields**: No AUN, County, District, or School information
- **Key Data**: Subject, Grade, Group, statewide aggregates

### Keystone Files

#### School Level (9 files)
- **Most Variable**: Headers at rows 3, 4, 5, or 7 depending on year
- **2015**: Completely different structure with abbreviated column names
- **Column Variations**:
  - "Schl" vs "School Number"
  - "N Scored" vs "Number Scored"
  - "Pct. Advanced" vs "Percent Advanced"

#### District Level (9 files)
- **Header Rows**: Mostly row 4, except 2023-2024 at row 3
- **Consistent columns** but proficiency column name varies
- **All include Grade column** (mostly grade 11)

#### State Level (9 files)
- **Header Rows**: Mix of row 3 and row 4
- **2021 Special**: Contains comparison columns with 2019 data
- **No location identifiers**: Just subject, grade, group

## Import Strategy

### 1. File Configuration Map
Create a configuration for each file pattern to handle variations:

```typescript
interface FileConfig {
  headerRow: number;
  yearColumn?: string;      // Some files don't have Year column
  schoolIdColumn?: string;  // Varies: "School Number" vs "Schl"
  districtIdColumn?: string; // "AUN"
  proficiencyColumn: string; // Varies across files
  extractYearFromFilename: boolean;
}
```

### 2. Column Mapping Rules

#### Standard Mappings
- AUN → districtId
- School Number/Schl → schoolId
- County → county
- District Name/District → districtName
- School Name/School → schoolName
- Subject → subject (normalize: ELA, Math, Science)
- Grade → grade (parse to number)
- Group → group (for demographics, default "All Students")

#### Percentage Columns
- Map all variations to standard names:
  - "% Advanced", "Pct. Advanced", "Percent Advanced" → advancedPercent
  - "% Proficient", "Pct. Proficient", "Percent Proficient" → proficientPercent
  - "% Basic", "Pct. Basic", "Percent Basic" → basicPercent
  - "% Below Basic", "Pct. Below Basic", "Percent Below Basic" → belowBasicPercent
  - "% Advanced/Proficient", "Percent Proficient and above" → proficientOrAbovePercent

### 3. Processing Order

1. **First Pass - Extract Schools/Districts**
   - Process all school-level files first
   - Build unique schools and districts tables
   - Store mapping of IDs to names

2. **Second Pass - Import Test Results**
   - Process in chronological order (2015-2024)
   - School level → District level → State level
   - PSSA first, then Keystone

### 4. Data Validation Rules

- **Skip rows where**:
  - Number Scored < 11 (privacy threshold)
  - All percentage values are null/asterisk
  - Subject is not standard (Math, ELA, Science, Algebra I, Biology, Literature)
  
- **Handle missing data**:
  - Year: Extract from filename if not in data
  - Grade: Default to 11 for Keystone, required for PSSA
  - Group: Default to "All Students" if missing

### 5. Special Cases

#### 2015 Files
- Different column naming convention
- Headers at different rows
- Need special mapping configuration

#### 2017-2019 PSSA School Files
- Missing Year column
- Extract year from filename

#### 2021 Keystone State
- Contains COVID comparison data
- Extra columns to ignore

#### 2024 Files
- Hyphenated filenames
- May have additional columns

## Implementation Steps

1. Create FileConfig for each file based on examination
2. Build dynamic column mapper based on config
3. Process files in batches by type
4. Validate data before insertion
5. Log statistics for each file processed
6. Handle errors gracefully, continue with next file

## Expected Results

- **Schools**: ~3,000 unique schools
- **Districts**: ~500 unique districts  
- **PSSA Records**: ~1.2 million rows
- **Keystone Records**: ~200,000 rows
- **Years Covered**: 2015-2024 (excluding 2020)

## Error Handling

- Log files that fail to process
- Track skipped rows with reasons
- Continue processing even if individual files fail
- Generate summary report at end