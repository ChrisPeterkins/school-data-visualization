/**
 * Add public schools that appear in PDE's enrollment reports but never in an
 * assessment file (K-2 buildings, some CTCs and special schools), so search,
 * the map, and nearby lists cover every building. Type comes from the grade
 * span in the enrollment sheet; coordinates arrive from importSchoolMetadata.
 *
 *   npx tsx src/scripts/addMissingSchools.ts [--dry-run]
 */
import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import { displayName } from '@pa-school-data/shared';
import { sqliteDb } from '../db';
import { logger } from '../utils/logger';

const dryRun = process.argv.includes('--dry-run');
const dir = path.join(process.cwd(), '..', 'sources', 'enrollment');
const files = fs.readdirSync(dir).filter((f) => /^enrollment-20\d{2}-\d{2,4}\.xlsx$/.test(f)).sort();
const latestFile = files[files.length - 1];
if (!latestFile) throw new Error('no enrollment files');

const districtByAun = new Map((sqliteDb.prepare('SELECT id, aun FROM districts').all() as Array<{ id: number; aun: string }>).map((r) => [r.aun, r.id]));
const existing = new Set((sqliteDb.prepare('SELECT district_id, school_number FROM schools').all() as Array<{ district_id: number; school_number: string }>).map((r) => `${r.district_id}:${r.school_number}`));
const pad = (n: unknown) => String(n ?? '').trim().replace(/\.0$/, '').padStart(9, '0');

const GRADE_COLS: Array<[RegExp, number]> = [[/^PK/, -1], [/^K/, 0], [/^0*(\d{1,2})$/, NaN]];
function gradeOf(col: string): number | null {
  for (const [re, g] of GRADE_COLS) { const m = col.match(re); if (m) return Number.isNaN(g) ? Number(m[1]) : g; }
  return null;
}
function typeFromSpan(lo: number | null, hi: number | null): string | null {
  if (lo == null || hi == null) return null;
  if (hi <= 6) return 'Elementary';
  if (lo >= 9) return 'High';
  if (lo >= 5 && hi <= 9) return 'Middle';
  if (lo <= 2 && hi >= 11) return 'Other';
  return hi <= 8 ? 'Middle' : 'High';
}

const wb = XLSX.readFile(path.join(dir, latestFile));
const rows = XLSX.utils.sheet_to_json(wb.Sheets['LEA and School'], { header: 1, defval: null }) as any[][];
const hi = rows.findIndex((r) => r.some((c) => String(c).trim() === 'AUN'));
const header = rows[hi].map((h: any) => String(h ?? '').trim());
const iAun = header.indexOf('AUN'), iNum = header.indexOf('School Number'), iName = header.indexOf('School Name'), iTotal = header.findIndex((h) => /^Total$/i.test(h));
const gradeIdx = header.map((h, i) => [gradeOf(h), i] as const).filter(([g]) => g != null) as Array<readonly [number, number]>;

const insert = sqliteDb.prepare(`INSERT INTO schools (school_number, district_id, name, pde_name, school_type, grade_range, enrollment, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`);
let added = 0, skipped = 0;
const tx = sqliteDb.transaction(() => {
  for (const r of rows.slice(hi + 1)) {
    if (r[iAun] == null || r[iNum] == null) continue;
    const did = districtByAun.get(String(r[iAun]).trim());
    if (did == null) { skipped++; continue; }
    const num = pad(r[iNum]);
    if (existing.has(`${did}:${num}`)) continue;
    const present = gradeIdx.filter(([, i]) => Number(r[i]) > 0).map(([g]) => g);
    const lo = present.length ? Math.min(...present) : null, hiG = present.length ? Math.max(...present) : null;
    const label = (g: number) => (g === -1 ? 'PK' : g === 0 ? 'K' : String(g));
    const raw = String(r[iName] ?? '').trim();
    if (!raw) continue;
    if (!dryRun) insert.run(num, did, displayName(raw), raw, typeFromSpan(lo, hiG), lo != null && hiG != null ? `${label(lo)}-${label(hiG)}` : null, Number(r[iTotal]) || null);
    added++;
  }
});
tx();
logger.info({ file: latestFile, added, skipped, dryRun }, 'missing schools added');
