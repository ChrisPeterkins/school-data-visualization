import { describe, expect, it } from 'vitest';
import { fillYearGaps, growthBand, gradeLabel, formatPct } from '../chartUtils';

describe('fillYearGaps', () => {
  it('inserts placeholder rows so 2020 shows as a gap', () => {
    const out = fillYearGaps([{ year: 2019, v: 1 }, { year: 2021, v: 2 }]);
    expect(out.map((r) => r.year)).toEqual([2019, 2020, 2021]);
    expect(out[1]).toEqual({ year: 2020 });
  });
  it('leaves short series alone', () => {
    expect(fillYearGaps([{ year: 2025 }])).toEqual([{ year: 2025 }]);
  });
});

describe('growthBand', () => {
  it('follows the PVAAS bands', () => {
    expect(growthBand(2.5).label).toBe('Well above');
    expect(growthBand(1.2).label).toBe('Above');
    expect(growthBand(0).label).toBe('Meets');
    expect(growthBand(-1.5).label).toBe('Below');
    expect(growthBand(-2).label).toBe('Well below');
    expect(growthBand(null).label).toBe('—');
  });
});

describe('labels', () => {
  it('names grade 0 as the all-grades total', () => {
    expect(gradeLabel(0)).toBe('All grades');
    expect(gradeLabel(null)).toBe('All grades');
    expect(gradeLabel(7)).toBe('Grade 7');
  });
  it('formats percentages with N/A for missing values', () => {
    expect(formatPct(45.678)).toBe('45.7%');
    expect(formatPct(null)).toBe('N/A');
  });
});
