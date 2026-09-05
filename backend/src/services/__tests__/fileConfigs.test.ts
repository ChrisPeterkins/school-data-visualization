import { describe, expect, it } from 'vitest';
import { getFileConfig, normalizeDemographicLabel } from '../fileConfigs';

describe('normalizeDemographicLabel', () => {
  it('collapses spelling variants onto the canonical label', () => {
    expect(normalizeDemographicLabel('American Indian / Alaskan Native (not Hispanic)')).toBe('American Indian/Alaskan Native (not Hispanic)');
    expect(normalizeDemographicLabel('Multi-Racial (not Hispanic)')).toBe('Multi-ethnic (not Hispanic)');
    expect(normalizeDemographicLabel('HU')).toBe('Historically Underperforming');
  });

  it('defaults blanks to All Students and leaves canonical labels alone', () => {
    expect(normalizeDemographicLabel(null)).toBe('All Students');
    expect(normalizeDemographicLabel('  ')).toBe('All Students');
    expect(normalizeDemographicLabel('IEP')).toBe('IEP');
  });
});

describe('getFileConfig', () => {
  it('uses the 2025 layout for 2025 and any later year', () => {
    for (const name of ['2025-pssa-school-level-data.xlsx', '2026-pssa-school-level-data.xlsx', '2027-pssa-district-level-data.xlsx']) {
      const cfg = getFileConfig(name);
      expect(cfg.headerRow).toBe(3);
      expect(cfg.yearColumn).toBe('Year');
      expect(cfg.proficientOrAboveColumn).toBe('Percent Proficient and above');
    }
  });

  it('keeps the 2024 layout for 2024 files', () => {
    expect(getFileConfig('2024-pssa-school-data.xlsx').headerRow).toBe(4);
    expect(getFileConfig('2024-keystone-exams-school-grade-11-data.xlsx').headerRow).toBe(3);
  });

  it('handles the 2015 abbreviated Keystone state layout', () => {
    const cfg = getFileConfig('2015 keystone exam state level data.xlsx');
    expect(cfg.numberScoredColumn).toBe('N Scored');
    expect(cfg.extractYearFromFilename).toBe(true);
  });
});
