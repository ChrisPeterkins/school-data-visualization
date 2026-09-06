/**
 * PDE ships entity names in capitals with abbreviations ("GETTYSBURG AREA HS",
 * "FRIENDSHIP HILL EL SCH"). This turns them into readable display names
 * ("Gettysburg Area High School"). Idempotent: an already-readable name is
 * left alone apart from abbreviation expansion.
 */
const EXPAND: Record<string, string> = {
  'EL SCH': 'Elementary School', 'ELEM SCH': 'Elementary School', 'EL': 'Elementary', 'ELEM': 'Elementary', 'ES': 'Elementary School',
  'MS': 'Middle School', 'JHS': 'Junior High School', 'JSHS': 'Junior/Senior High School', 'SHS': 'Senior High School', 'HS': 'High School',
  'SCH': 'School', 'SCHS': 'Schools', 'CS': 'Charter School', 'CTC': 'Career and Technology Center', 'AVTS': 'Area Vocational Technical School',
  'CTR': 'Center', 'INST': 'Institute', 'INTRMD': 'Intermediate', 'INTERMED': 'Intermediate', 'INT': 'Intermediate', 'PRI': 'Primary', 'PRIM': 'Primary', 'KDG': 'Kindergarten',
  'ACAD': 'Academy', 'TWP': 'Township', 'JR': 'Jr.', 'SR': 'Sr.', 'MT': 'Mt.', 'ST': 'St.', 'FT': 'Ft.', 'CO': 'County', 'CTY': 'City', 'VOC': 'Vocational', 'TECH': 'Technical',
  'SD': 'SD', 'IU': 'IU', 'AREA': 'Area', 'JT': 'Joint', 'REG': 'Regional', 'ED': 'Education', 'EDUC': 'Education', 'LRNG': 'Learning', 'ALT': 'Alternative',
};
/** Names whose capitalisation the simple rules get wrong. */
const PROPER: Record<string, string> = { DUBOIS: 'DuBois', MCKEESPORT: 'McKeesport', DELAND: 'DeLand', LASALLE: 'LaSalle', DEVRY: 'DeVry', MACARTHUR: 'MacArthur', PHILA: 'Phila.' };
const SMALL = new Set(['of', 'the', 'and', 'at', 'for', 'in', 'on', 'de', 'la', 'del', 'a', 'an']);
const KEEP_UPPER = new Set(['SD', 'IU', 'PA', 'CCA', 'STEM', 'STEAM', 'YMCA', 'MAST', 'KIPP', 'AVTS', 'CTC', 'IB', 'AP', 'II', 'III', 'IV', 'ESL', 'ESOL', 'CCP', 'TECH']);

function caseWord(w: string, first: boolean): string {
  const bare = w.replace(/[^A-Za-z0-9']/g, '');
  if (KEEP_UPPER.has(bare.toUpperCase()) && bare.length <= 5) return w.toUpperCase();
  const lower = w.toLowerCase();
  if (!first && SMALL.has(lower)) return lower;
  // Mc/Mac and O' prefixes, hyphenated and slashed parts.
  return lower
    .split(/([-/])/)
    .map((part) => (part === '-' || part === '/' ? part : part.replace(/^(mc|o')?(.)/, (_m, p, c) => (p ? p[0].toUpperCase() + p.slice(1) : '') + c.toUpperCase())))
    .join('');
}

export function displayName(raw: string | null | undefined): string {
  if (!raw) return '';
  let s = raw.trim().replace(/\s+/g, ' ');
  // Only re-case names that are (almost) all capitals; mixed-case names are already readable.
  const letters = s.replace(/[^A-Za-z]/g, '');
  const allCaps = letters.length > 0 && letters === letters.toUpperCase();
  // Expand multi-word abbreviations first, then single tokens.
  for (const key of Object.keys(EXPAND).filter((k) => k.includes(' ')).sort((a, b) => b.length - a.length)) {
    s = s.replace(new RegExp(`\\b${key}\\b`, allCaps ? 'g' : 'gi'), EXPAND[key]);
  }
  const words = s.split(' ').map((w, i) => {
    // Expand a token only when it is the abbreviation on its own ("HS", "HS,"), never inside "21ST" or "MS."
    const m = w.match(/^([A-Za-z]+)([,)]?)$/);
    if (m && EXPAND[m[1].toUpperCase()] && (allCaps || m[1] === m[1].toUpperCase())) return EXPAND[m[1].toUpperCase()] + m[2];
    if (!allCaps) return w;
    if (PROPER[w.toUpperCase()]) return PROPER[w.toUpperCase()];
    return caseWord(w, i === 0);
  });
  return words.join(' ');
}
