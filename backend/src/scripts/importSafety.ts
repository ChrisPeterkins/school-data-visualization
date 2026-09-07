/**
 * Import PDE Safe Schools incident reports and emergency teaching permits.
 *
 *   sources/safeschools/safeschools-YYYY-YY-schools.xlsx   school-level (school districts only)
 *   sources/safeschools/safeschools-YYYY-YY-lea.xlsx       LEA-level (districts, charters, CTCs)
 *   sources/permits/permits-YYYY-YY.xls(x)                 emergency permits by LEA × subject
 *
 * Tables: school_safety (year, entity_type, entity_id, enrollment, incidents, offenders, arrests,
 * law_enforcement, assaults, harassment, fighting, weapons, drugs_alcohol, tobacco_vaping, threats,
 * property, truant, truancy_rate, security_staff) and district_permits (year, district_id, total,
 * day_to_day, long_term, waiver, other). Year convention: SY 2024-25 = 2025. Idempotent.
 *
 * Usage: npx tsx src/scripts/importSafety.ts [safety|permits|all]
 */
import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import { sqliteDb } from '../db';
import { logger } from '../utils/logger';
import { ensureIndicatorTables } from '../services/indicators';

const sources = path.join(process.cwd(), '..', 'sources');
const what = process.argv[2] || 'all';
ensureIndicatorTables();

const num = (v: unknown) => { const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/,/g, '')); return Number.isFinite(n) ? n : 0; };
const sumCols = (row: Record<string, unknown>, names: string[]) => names.reduce((s, n) => s + num(row[n]), 0);

// Column groups from the Infraction sheet. Names are matched exactly; missing columns count as 0.
const ASSAULTS = ['Simple Assault on Student', 'Aggravated Assault on Student', 'Simple Assault on Staff', 'Aggravated Assault on Staff'];
const HARASSMENT = ['Racial/Ethnic Intimidation', 'All Other Forms of Harassment/Intimidation', 'Sexual Harassment', 'Bullying', 'Cyber Harassment'];
const WEAPONS = ['Possession of Weapon'];
const DRUGS = ['Possession/Use of a Controlled Substance', 'Sale/Distribution of a Controlled Substance', 'Sale, Possession, Use, or Under the Influence of Alcohol'];
const TOBACCO = ['Possession, Use or Sale of Tobacco', 'Possession, Use, or Sale of Vaping Materials'];
const THREATS = ['Threatening School Official/Student', 'Bomb Threats', 'Terroristic Threats (excl bomb threats)'];
const PROPERTY = ['Theft', 'Robbery', 'Burglary', 'Arson', 'Vandalism'];

function sheetRows(wb: XLSX.WorkBook, name: string): Record<string, unknown>[] {
  const ws = wb.Sheets[name];
  return ws ? (XLSX.utils.sheet_to_json(ws, { defval: null }) as Record<string, unknown>[]) : [];
}

function importSafety() {
  const dir = path.join(sources, 'safeschools');
  if (!fs.existsSync(dir)) return logger.warn('no safeschools directory');
  const schoolByKey = new Map((sqliteDb.prepare(`SELECT s.id, d.aun || '-' || CAST(CAST(s.school_number AS INTEGER) AS TEXT) AS key FROM schools s JOIN districts d ON d.id = s.district_id`).all() as Array<{ id: number; key: string }>).map((r) => [r.key, r.id]));
  const districtByAun = new Map((sqliteDb.prepare(`SELECT id, aun FROM districts`).all() as Array<{ id: number; aun: string }>).map((r) => [String(r.aun).padStart(9, '0'), r.id]));
  const upsert = sqliteDb.prepare(`INSERT OR REPLACE INTO school_safety (year, entity_type, entity_id, enrollment, incidents, offenders, arrests, law_enforcement, assaults, harassment, fighting, weapons, drugs_alcohol, tobacco_vaping, threats, property, truant, truancy_rate, security_staff, source_file) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const file of fs.readdirSync(dir).filter((f) => /^safeschools-\d{4}-\d{2}-(schools|lea)\.xlsx$/.test(f)).sort()) {
    const m = file.match(/^safeschools-(\d{4})-\d{2}-(schools|lea)\.xlsx$/)!;
    const year = Number(m[1]) + 1; const level = m[2] === 'schools' ? 'school' : 'district';
    const wb = XLSX.readFile(path.join(dir, file));
    const inf = sheetRows(wb, 'Infraction'), tru = sheetRows(wb, 'Truancy'), sec = level === 'district' ? sheetRows(wb, 'Security Staff') : [];
    const keyOf = (r: Record<string, unknown>) => level === 'school' ? `${String(r['District Code']).padStart(9, '0')}-${num(r['School Number'])}` : String(r['District Code']).padStart(9, '0');
    // Truancy: the count and rate columns are mislabeled in 2019-20 … 2021-22, so read them by position (8 and 9).
    const truBy = new Map<string, { truant: number; rate: number | null }>();
    for (const r of tru) { const vals = Object.values(r); const truant = num(vals[level === 'school' ? 7 : 5]); const rate = vals[level === 'school' ? 8 : 6]; truBy.set(keyOf(r), { truant, rate: rate == null ? null : Math.round(num(rate) * 1000) / 10 }); }
    const secBy = new Map<string, number>();
    for (const r of sec) secBy.set(keyOf(r), sumCols(r, ['School Police Officer', 'School Resource Officer', 'School Security Officer']));
    let written = 0, unmatched = 0;
    sqliteDb.transaction(() => {
      for (const r of inf) {
        const key = keyOf(r);
        const id = level === 'school' ? schoolByKey.get(`${String(r['District Code']).padStart(9, '0')}-${num(r['School Number'])}`) : districtByAun.get(key);
        if (id == null) { unmatched++; continue; }
        const t = truBy.get(key);
        upsert.run(year, level, id, num(r['Enrollment']) || null, num(r['Incident']), num(r['Offender']), num(r['Arrest']), num(r['Local Law Enforcment Contacted']),
          sumCols(r, ASSAULTS), sumCols(r, HARASSMENT), num(r['Fighting']), sumCols(r, WEAPONS), sumCols(r, DRUGS), sumCols(r, TOBACCO), sumCols(r, THREATS), sumCols(r, PROPERTY),
          t?.truant ?? null, t?.rate ?? null, level === 'district' ? (secBy.get(key) ?? null) : null, file);
        written++;
      }
      // Statewide totals for the level: sum of every row in the file (matched or not).
      if (level === 'district') {
        const tot = (names: string[]) => inf.reduce((s, r) => s + sumCols(r, names), 0);
        const enrollment = inf.reduce((s, r) => s + num(r['Enrollment']), 0);
        const truant = tru.reduce((s, r) => s + num(Object.values(r)[5]), 0);
        upsert.run(year, 'state', 0, enrollment || null, tot(['Incident']), tot(['Offender']), tot(['Arrest']), tot(['Local Law Enforcment Contacted']), tot(ASSAULTS), tot(HARASSMENT), tot(['Fighting']), tot(WEAPONS), tot(DRUGS), tot(TOBACCO), tot(THREATS), tot(PROPERTY), truant, enrollment ? Math.round((truant / enrollment) * 1000) / 10 : null, sec.reduce((s, r) => s + sumCols(r, ['School Police Officer', 'School Resource Officer', 'School Security Officer']), 0), file);
      }
    })();
    logger.info({ file, year, level, rows: inf.length, written, unmatched }, 'safe schools imported');
  }
}

function importPermits() {
  const dir = path.join(sources, 'permits');
  if (!fs.existsSync(dir)) return logger.warn('no permits directory');
  const districtByAun = new Map((sqliteDb.prepare(`SELECT id, aun FROM districts`).all() as Array<{ id: number; aun: string }>).map((r) => [String(r.aun).padStart(9, '0'), r.id]));
  const upsert = sqliteDb.prepare(`INSERT OR REPLACE INTO district_permits (year, district_id, total, day_to_day, long_term, waiver, other, source_file) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const file of fs.readdirSync(dir).filter((f) => /^permits-\d{4}-\d{2}\.xlsx?$/.test(f)).sort()) {
    const year = Number(file.match(/^permits-(\d{4})/)![1]) + 1;
    const wb = XLSX.readFile(path.join(dir, file));
    const ws = wb.Sheets[wb.SheetNames.find((n) => /^\d{2}-\d{2}$/.test(n.trim())) ?? wb.SheetNames[wb.SheetNames.length - 1]];
    const grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as unknown[][];
    const h = grid.findIndex((r) => String(r[0] ?? '').trim() === 'COUNTY_CD');
    if (h < 0) { logger.warn({ file }, 'permits header not found'); continue; }
    const header = grid[h].map((c) => String(c ?? '').trim());
    const col = (name: string) => header.indexOf(name);
    const iAun = col('AUN'), iTotal = col('Total'), i1 = col('Type 1'), i2 = col('Type 2'), i4 = col('Type 4'), i6 = col('Type 6'), i8 = col('Type 8'), i9 = col('Type 9');
    const byLea = new Map<string, { total: number; d2d: number; lt: number; waiver: number; other: number }>();
    for (const r of grid.slice(h + 1)) {
      const aun = String(r[iAun] ?? '').trim();
      if (!/^\d{9}$/.test(aun)) continue; // skips the trailing "Total" row
      const g = byLea.get(aun) ?? { total: 0, d2d: 0, lt: 0, waiver: 0, other: 0 };
      g.total += num(r[iTotal]); g.d2d += i6 >= 0 ? num(r[i6]) : 0; g.lt += (i1 >= 0 ? num(r[i1]) : 0) + (i4 >= 0 ? num(r[i4]) : 0); g.waiver += i2 >= 0 ? num(r[i2]) : 0; g.other += (i8 >= 0 ? num(r[i8]) : 0) + (i9 >= 0 ? num(r[i9]) : 0);
      byLea.set(aun, g);
    }
    let written = 0, unmatched = 0; const state = { total: 0, d2d: 0, lt: 0, waiver: 0, other: 0 };
    sqliteDb.transaction(() => {
      for (const [aun, g] of byLea) {
        for (const k of Object.keys(state) as Array<keyof typeof state>) state[k] += g[k];
        const id = districtByAun.get(aun);
        if (id == null) { unmatched++; continue; }
        upsert.run(year, id, g.total, g.d2d, g.lt, g.waiver, g.other, file); written++;
      }
      upsert.run(year, 0, state.total, state.d2d, state.lt, state.waiver, state.other, file); // district_id 0 = statewide
    })();
    logger.info({ file, year, leas: byLea.size, written, unmatched, statewide: state.total }, 'emergency permits imported');
  }
}

if (what === 'safety' || what === 'all') importSafety();
if (what === 'permits' || what === 'all') importPermits();
logger.info('done');
