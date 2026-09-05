import { describe, expect, it } from 'vitest';
import { parseGrade } from '../parseGrade';

describe('parseGrade', () => {
  it('reads numeric grades in every spelling PDE has used', () => {
    expect(parseGrade(3)).toBe(3);
    expect(parseGrade('8')).toBe(8);
    expect(parseGrade('03')).toBe(3);
    expect(parseGrade(' 11 ')).toBe(11);
  });

  it('maps every all-grades label to grade 0', () => {
    for (const label of ['Total', 'School Total', 'District Total', 'All Grades', 'all']) {
      expect(parseGrade(label)).toBe(0);
    }
  });

  it('returns null for blank or unparseable cells', () => {
    expect(parseGrade(undefined)).toBeNull();
    expect(parseGrade(null)).toBeNull();
    expect(parseGrade('')).toBeNull();
    expect(parseGrade('N/A')).toBeNull();
  });
});
