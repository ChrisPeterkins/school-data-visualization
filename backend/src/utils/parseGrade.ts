/**
 * Grade value from a PDE spreadsheet cell.
 *  - a number or numeric string ("3", "03") -> that grade
 *  - any "Total" variant ("Total", "School Total", "District Total") or
 *    "All Grades" -> 0, the all-grades row kept at every level
 *  - blank or unparseable -> null (the importer drops the row below state level)
 */
export function parseGrade(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const str = String(value).trim();
  if (/total|^all/i.test(str)) return 0;
  const digits = str.replace(/\D/g, '');
  if (digits === '') return null;
  return parseInt(digits, 10);
}
