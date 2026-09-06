/**
 * Import the non-assessment sources under ../sources:
 *   futureready/fr-YYYY.xlsx       Future Ready PA Index school indicators (2018+)
 *   graduation/grad4-YYYY-YYYY.xlsx PDE 4-year cohort graduation rates (school, LEA, state)
 *   enrollment/enrollment-*.xlsx    October 1 enrollment by school and LEA
 *   finance/afr-expdetail-*.xlsx + adm-wadm-*.xlsx  AFR expenditures and ADM by district
 *
 *   lowincome/lowincome-YYYY.xlsx   PDE percent low income by school and LEA
 *   staff/staff-YYYY-YY.xlsx        PDE professional staff summary (LEA averages)
 *
 * Usage: npx tsx src/scripts/importIndicators.ts [futureready|graduation|enrollment|finance|lowincome|staff|all]
 * Idempotent: rows are upserted by (year, entity, indicator).
 */
import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import { sqliteDb } from '../db';
import { logger } from '../utils/logger';
import { ensureIndicatorTables, type Indicator } from '../services/indicators';
import { refreshMapPoints } from '../services/mapPoints';

const sources = path.join(process.cwd(), '..', 'sources');
ensureIndicatorTables();
ensureIndicatorTables();
const padSchool = (n: unknown) => String(n ?? '').trim().replace(/\.0$/, '').padStart(9, '0');
const aunOf = (v: unknown) => String(v ?? '').trim().replace(/\.0$/, '');

const districtByAun = new Map<string, number>();
for (const r of sqliteDb.prepare('SELECT id, aun FROM districts').all() as Array<{ id: number; aun: string }>) districtByAun.set(r.aun, r.id);
const schoolByKey = new Map<string, number>();
for (const r of sqliteDb.prepare('SELECT id, district_id, school_number FROM schools').all() as Array<{ id: number; district_id: number; school_number: string }>) {
  schoolByKey.set(`${r.district_id}:${r.school_number}`, r.id);
}
const schoolId = (aun: unknown, schoolNumber: unknown) => {
  const d = districtByAun.get(aunOf(aun));
  return d == null ? null : schoolByKey.get(`${d}:${padSchool(schoolNumber)}`) ?? null;
};

/** "94.1%", "94.1", 0.941 (fraction when `fraction`), or a suppression marker → number | null. */
const num = (v: unknown, fraction = false): number | null => {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? (fraction ? v * 100 : v) : null;
  const s = String(v).trim().replace(/%$/, '').replace(/,/g, '');
  if (!s || /^(IS|NA|N\/A|Insufficient Sample|Suppress.*)$/i.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? (fraction ? n * 100 : n) : null;
};
const round1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10);

const upsertIndicator = sqliteDb.prepare(`
  INSERT INTO entity_indicators (year, entity_type, entity_id, indicator, value, n, state_value, source_file)
  VALUES (@year, @entityType, @entityId, @indicator, @value, @n, @stateValue, @sourceFile)
  ON CONFLICT(year, entity_type, entity_id, indicator) DO UPDATE SET
    value = excluded.value, n = excluded.n, state_value = COALESCE(excluded.state_value, entity_indicators.state_value), source_file = excluded.source_file
`);
const upsertGroup = sqliteDb.prepare(`
  INSERT INTO indicator_groups (year, entity_type, entity_id, indicator, student_group, value, n)
  VALUES (@year, @entityType, @entityId, @indicator, @group, @value, @n)
  ON CONFLICT(year, entity_type, entity_id, indicator, student_group) DO UPDATE SET value = excluded.value, n = excluded.n
`);
const upsertStaff = sqliteDb.prepare(`
  INSERT INTO district_staff (year, district_id, professional, teachers, administrators, avg_teacher_salary, avg_teacher_experience, avg_years_in_lea, students_per_teacher, source_file)
  VALUES (@year, @districtId, @professional, @teachers, @administrators, @salary, @experience, @inLea, @ratio, @sourceFile)
  ON CONFLICT(year, district_id) DO UPDATE SET professional = excluded.professional, teachers = excluded.teachers, administrators = excluded.administrators,
    avg_teacher_salary = excluded.avg_teacher_salary, avg_teacher_experience = excluded.avg_teacher_experience, avg_years_in_lea = excluded.avg_years_in_lea,
    students_per_teacher = excluded.students_per_teacher, source_file = excluded.source_file
`);
/** PDE group spellings across the Future Ready and graduation files → the demographic labels the assessment tables use. */
const GROUP_MAP: Record<string, string> = {
  economicallydisadvantaged: 'Economically Disadvantaged', econdisadv: 'Economically Disadvantaged',
  englishlearner: 'ELL', el: 'ELL', studentswithdisabilities: 'IEP', specialed: 'IEP',
  white: 'White (not Hispanic)', black: 'Black or African American (not Hispanic)', hispanic: 'Hispanic (any race)', asian: 'Asian (not Hispanic)',
  '2ormoraces': 'Multi-ethnic (not Hispanic)', '2ormoreraces': 'Multi-ethnic (not Hispanic)', multiracial: 'Multi-ethnic (not Hispanic)',
  americanindianalaskanative: 'American Indian/Alaskan Native (not Hispanic)', americanindianalaskannative: 'American Indian/Alaskan Native (not Hispanic)', specialeducation: 'IEP', aian: 'American Indian/Alaskan Native (not Hispanic)',
  hawaiianpacificislander: 'Native Hawaiian or other Pacific Islander (not Hispanic)', nativehawaiianorpacificislander: 'Native Hawaiian or other Pacific Islander (not Hispanic)',
  male: 'Male', female: 'Female',
};
const groupKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const upsertEnrollment = sqliteDb.prepare(`
  INSERT INTO enrollments (year, entity_type, entity_id, total, source_file) VALUES (@year, @entityType, @entityId, @total, @sourceFile)
  ON CONFLICT(year, entity_type, entity_id) DO UPDATE SET total = excluded.total, source_file = excluded.source_file
`);
const upsertFinance = sqliteDb.prepare(`
  INSERT INTO district_finance (year, district_id, total_expenditures, instruction, support_services, adm, wadm, per_pupil, instruction_per_pupil, source_file)
  VALUES (@year, @districtId, @total, @instruction, @support, @adm, @wadm, @perPupil, @instructionPerPupil, @sourceFile)
  ON CONFLICT(year, district_id) DO UPDATE SET total_expenditures = excluded.total_expenditures, instruction = excluded.instruction,
    support_services = excluded.support_services, adm = excluded.adm, wadm = excluded.wadm, per_pupil = excluded.per_pupil,
    instruction_per_pupil = excluded.instruction_per_pupil, source_file = excluded.source_file
`);

const sheetRows = (wb: XLSX.WorkBook, name: string): any[][] => XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null }) as any[][];
const headerIndex = (rows: any[][], test: (cell: string) => boolean) => rows.findIndex((r) => r.some((c) => c != null && test(String(c))));
const col = (header: any[], test: (h: string) => boolean) => header.findIndex((h) => h != null && test(String(h).replace(/\s+/g, ' ').trim()));

// ---------- Future Ready PA Index ----------

/** Stem of the All Students column for each indicator in the wide (2022+) layout. */
const WIDE_STEMS: Array<[Indicator, RegExp]> = [
  ['regular_attendance', /(Regular|Persistent)Attendance_AllStudents?$/],
  ['chronic_absenteeism', /ChronicAbsenteeism_AllStudents?$/],
  ['english_proficiency', /EnglishLanguageProficiency_AllStudents?$/],
  ['grade3_reading', /Grade3Reading_AllStudents?$/],
  ['grade7_math', /Grade7Mathematics_AllStudents?$/],
  ['career_benchmark', /CareerStandardsBenchmark_AllStudents?$/],
  ['rigorous_courses', /RigorousCoursesofStudy_AllStudents?$/],
  ['industry_learning', /^PercentIndustryBasedLearning_AllStudents?$/],
  ['postsecondary_transition', /PostSecondaryTransitiontoSchoolMilitaryorWork_AllStudents?$/],
];
/** Element names in the long (2018-2021) layout, matched on a whitespace-normalised lower-case string. */
const LONG_ELEMENTS: Array<[Indicator, RegExp]> = [
  ['regular_attendance', /^percent regular attendance \(all student/],
  ['english_proficiency', /^(percent )?english language (growth and attainment|proficiency) \(all student/],
  ['grade3_reading', /^percent grade 3 reading \(all student/],
  ['grade7_math', /^percent grade 7 mathematics \(all student/],
  ['career_benchmark', /^percent career standards benchmark \(all student/],
  ['rigorous_courses', /^percent rigorous courses of study \(all student/],
  ['industry_learning', /^percent industry-based learning \(all student/],
  ['postsecondary_transition', /^percent graduates: post secondary transition to school, military, or work \(all student/],
];

function importFutureReady() {
  const dir = path.join(sources, 'futureready');
  if (!fs.existsSync(dir)) return logger.warn('no futureready directory');
  for (const file of fs.readdirSync(dir).filter((f) => /^fr-\d{4}\.xlsx$/.test(f)).sort()) {
    const year = Number(file.match(/\d{4}/)![0]);
    const wb = XLSX.readFile(path.join(dir, file));
    let written = 0, unmatched = 0;
    const rowsOut: any[] = [];
    const groupRows: any[] = [];
    const first = sheetRows(wb, wb.SheetNames[0]);
    const isLong = first[0]?.some((c: any) => /^dataelement$/i.test(String(c)));
    if (isLong) {
      for (const name of wb.SheetNames) {
        const rows = sheetRows(wb, name);
        const h = rows[0].map((c: any) => String(c).toLowerCase());
        const [ia, is, ie, iv] = ['aun', 'schl', 'dataelement', 'displayvalue'].map((k) => h.indexOf(k));
        if (ia < 0 || ie < 0) continue;
        for (const r of rows.slice(1)) {
          const el = String(r[ie] ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
          if (/^(essa goal|annual progress|statewide average)/.test(el)) continue;
          const gm = el.match(/^percent regular attendance \(([^)]+)\)$/);
          if (gm && !/^all student/.test(gm[1])) {
            const group = GROUP_MAP[groupKey(gm[1])];
            const sid = schoolId(r[ia], r[is]);
            const value = round1(num(r[iv]));
            if (group && sid != null && value != null) groupRows.push({ year, entityType: 'school', entityId: sid, indicator: 'regular_attendance', group, value, n: null });
            continue;
          }
          const hit = LONG_ELEMENTS.find(([, re]) => re.test(el));
          if (!hit) continue;
          const sid = schoolId(r[ia], r[is]);
          if (sid == null) { unmatched++; continue; }
          const value = round1(num(r[iv]));
          if (value == null) continue;
          rowsOut.push({ year, entityType: 'school', entityId: sid, indicator: hit[0], value, n: null, stateValue: null, sourceFile: file });
        }
      }
    } else {
      const resolved: string[] = [];
      for (const name of wb.SheetNames) {
        const rows = sheetRows(wb, name);
        const header = rows[0].map((c: any) => (c == null ? '' : String(c).trim()));
        const ia = header.indexOf('AUN'), is = header.indexOf('Schl');
        if (ia < 0 || is < 0) continue;
        const cols: Array<{ indicator: Indicator; value: number; state: number }> = [];
        // Student-group columns for attendance: PercentPersistentAttendance_<Group>.
        const groupCols: Array<{ group: string; col: number }> = [];
        header.forEach((h, i) => {
          const m = h.match(/^Percent(?:Regular|Persistent)Attendance_(.+)$/);
          if (m && GROUP_MAP[groupKey(m[1])]) groupCols.push({ group: GROUP_MAP[groupKey(m[1])], col: i });
        });
        for (const [indicator, stem] of WIDE_STEMS) {
          const vi = header.findIndex((h) => /^Percent/.test(h) && !/^Percentof.*Concentrator/.test(h) && stem.test(h));
          if (vi < 0) continue;
          const si = header.findIndex((h) => /^StatewideAverage(NonCTC)?/.test(h) && !/^StatewideAverageCTC/.test(h) && stem.test(h));
          cols.push({ indicator, value: vi, state: si });
          resolved.push(`${indicator}<-${header[vi]}`);
        }
        for (const r of rows.slice(1)) {
          if (r[ia] == null) continue;
          const sid = schoolId(r[ia], r[is]);
          if (sid == null) { unmatched++; continue; }
          for (const c of cols) {
            const value = round1(num(r[c.value]));
            if (value == null) continue;
            rowsOut.push({ year, entityType: 'school', entityId: sid, indicator: c.indicator, value, n: null, stateValue: c.state >= 0 ? round1(num(r[c.state])) : null, sourceFile: file });
          }
          for (const g of groupCols) {
            const value = round1(num(r[g.col]));
            if (value != null) groupRows.push({ year, entityType: 'school', entityId: sid, indicator: 'regular_attendance', group: g.group, value, n: null });
          }
        }
      }
      logger.info({ year, resolved }, 'future ready columns');
    }
    sqliteDb.transaction(() => { for (const r of rowsOut) { upsertIndicator.run(r); written++; } for (const g of groupRows) upsertGroup.run(g); })();
    // Statewide rows: the file repeats the statewide average on every school row.
    const stateRows = sqliteDb.prepare(`SELECT indicator, MAX(state_value) AS v FROM entity_indicators WHERE year = ? AND entity_type = 'school' AND state_value IS NOT NULL GROUP BY indicator`).all(year) as Array<{ indicator: string; v: number }>;
    for (const s of stateRows) upsertIndicator.run({ year, entityType: 'state', entityId: 0, indicator: s.indicator, value: s.v, n: null, stateValue: null, sourceFile: file });
    logger.info({ file, year, written, groups: groupRows.length, unmatched, layout: isLong ? 'long' : 'wide', stateRows: stateRows.length }, 'future ready imported');
  }
}

// ---------- Cohort graduation rates ----------

function importGraduation() {
  const dir = path.join(sources, 'graduation');
  if (!fs.existsSync(dir)) return logger.warn('no graduation directory');
  for (const file of fs.readdirSync(dir).filter((f) => /^grad4-\d{4}-\d{4}\.xlsx$/.test(f)).sort()) {
    const year = Number(file.match(/-(\d{4})\.xlsx$/)![1]);
    const wb = XLSX.readFile(path.join(dir, file));
    let schools = 0, leas = 0, unmatched = 0;
    const tx = sqliteDb.transaction(() => {
      for (const name of wb.SheetNames) {
        const rows = sheetRows(wb, name);
        // 2016-17+: "Cohort", "Cohort Grad Rate"; 2015-16: "Total Cohort", "Total Grad Rate".
        const hi = headerIndex(rows, (c) => /^(Cohort|Total) Grad Rate$/i.test(c.trim()));
        if (hi < 0) continue;
        const header = rows[hi];
        const iAun = col(header, (h) => h === 'AUN'), iSchool = col(header, (h) => h === 'School Number');
        const iCohort = col(header, (h) => /^(Total )?Cohort$/i.test(h)), iRate = col(header, (h) => /^(Cohort|Total) Grad Rate$/i.test(h));
        const iEcon = col(header, (h) => /^Econ(omically)? Disadv(antaged)? Grad Rate$/i.test(h));
        const groupCols: Array<{ group: string; col: number }> = [];
        header.forEach((h: any, i: number) => {
          const m = String(h ?? '').replace(/\s+/g, ' ').trim().match(/^(.+?) Grad Rate$/);
          if (m && !/^(Cohort|Total)$/.test(m[1]) && GROUP_MAP[groupKey(m[1])]) groupCols.push({ group: GROUP_MAP[groupKey(m[1])], col: i });
        });
        for (const r of rows.slice(hi + 1)) {
          if (/^Statewide Total$/i.test(String(r[0] ?? ''))) {
            upsertIndicator.run({ year, entityType: 'state', entityId: 0, indicator: 'grad_rate_4yr', value: round1(num(r[iRate], true)), n: num(r[iCohort]), stateValue: null, sourceFile: file });
            continue;
          }
          if (iAun < 0 || r[iAun] == null) continue;
          const rate = round1(num(r[iRate], true));
          if (rate == null) continue;
          const base = { year, indicator: 'grad_rate_4yr', value: rate, n: num(r[iCohort]), stateValue: null, sourceFile: file };
          if (iSchool >= 0) {
            const sid = schoolId(r[iAun], r[iSchool]);
            if (sid == null) { unmatched++; continue; }
            upsertIndicator.run({ ...base, entityType: 'school', entityId: sid });
            for (const g of groupCols) { const v = round1(num(r[g.col], true)); if (v != null) upsertGroup.run({ year, entityType: 'school', entityId: sid, indicator: 'grad_rate_4yr', group: g.group, value: v, n: null }); }
            if (iEcon >= 0 && num(r[iEcon], true) != null) upsertIndicator.run({ ...base, indicator: 'grad_rate_4yr_econ', value: round1(num(r[iEcon], true)), n: null, entityType: 'school', entityId: sid });
            schools++;
          } else {
            const did = districtByAun.get(aunOf(r[iAun]));
            if (did == null) { unmatched++; continue; }
            upsertIndicator.run({ ...base, entityType: 'district', entityId: did });
            for (const g of groupCols) { const v = round1(num(r[g.col], true)); if (v != null) upsertGroup.run({ year, entityType: 'district', entityId: did, indicator: 'grad_rate_4yr', group: g.group, value: v, n: null }); }
            leas++;
          }
        }
      }
      // Stamp the statewide rate onto school and district rows so the API can show "vs. state".
      const state = sqliteDb.prepare(`SELECT value FROM entity_indicators WHERE year = ? AND entity_type = 'state' AND indicator = 'grad_rate_4yr'`).get(year) as { value: number } | undefined;
      if (state) sqliteDb.prepare(`UPDATE entity_indicators SET state_value = ? WHERE year = ? AND indicator = 'grad_rate_4yr' AND entity_type IN ('school', 'district')`).run(state.value, year);
    });
    tx();
    logger.info({ file, year, schools, leas, unmatched }, 'graduation rates imported');
  }
}

// ---------- Enrollment ----------

function importEnrollment() {
  const dir = path.join(sources, 'enrollment');
  if (!fs.existsSync(dir)) return logger.warn('no enrollment directory');
  for (const file of fs.readdirSync(dir).filter((f) => /^enrollment-20\d{2}-\d{2,4}\.xlsx$/.test(f)).sort()) {
    const m = file.match(/^enrollment-(\d{4})-(\d{2,4})\.xlsx$/)!;
    const year = m[2].length === 4 ? Number(m[2]) : Number(m[1].slice(0, 2) + m[2]);
    const wb = XLSX.readFile(path.join(dir, file));
    let schools = 0, leas = 0, unmatched = 0, stateTotal = 0;
    const tx = sqliteDb.transaction(() => {
      for (const name of wb.SheetNames) {
        if (name !== 'LEA' && name !== 'LEA and School') continue;
        const rows = sheetRows(wb, name);
        const hi = headerIndex(rows, (c) => c.trim() === 'AUN');
        if (hi < 0) continue;
        const header = rows[hi];
        const iAun = col(header, (h) => h === 'AUN'), iSchool = col(header, (h) => h === 'School Number'), iTotal = col(header, (h) => /^Total$/i.test(h));
        for (const r of rows.slice(hi + 1)) {
          if (r[iAun] == null || num(r[iTotal]) == null) continue;
          const total = Math.round(num(r[iTotal])!);
          if (name === 'LEA and School') {
            const sid = schoolId(r[iAun], r[iSchool]);
            if (sid == null) { unmatched++; continue; }
            upsertEnrollment.run({ year, entityType: 'school', entityId: sid, total, sourceFile: file }); schools++;
          } else {
            const did = districtByAun.get(aunOf(r[iAun]));
            stateTotal += total;
            if (did == null) { unmatched++; continue; }
            upsertEnrollment.run({ year, entityType: 'district', entityId: did, total, sourceFile: file }); leas++;
          }
        }
      }
      if (stateTotal > 0) upsertEnrollment.run({ year, entityType: 'state', entityId: 0, total: stateTotal, sourceFile: file });
    });
    tx();
    logger.info({ file, year, schools, leas, unmatched, stateTotal }, 'enrollment imported');
  }
  // Keep the schools/districts columns on the newest count so dot sizes and filters stay current.
  sqliteDb.exec(`
    UPDATE schools SET enrollment = (SELECT total FROM enrollments e WHERE e.entity_type = 'school' AND e.entity_id = schools.id ORDER BY year DESC LIMIT 1)
      WHERE id IN (SELECT entity_id FROM enrollments WHERE entity_type = 'school');
    UPDATE districts SET total_enrollment = (SELECT total FROM enrollments e WHERE e.entity_type = 'district' AND e.entity_id = districts.id ORDER BY year DESC LIMIT 1)
      WHERE id IN (SELECT entity_id FROM enrollments WHERE entity_type = 'district');
  `);
}

// ---------- District finance ----------

function importFinance() {
  const dir = path.join(sources, 'finance');
  if (!fs.existsSync(dir)) return logger.warn('no finance directory');
  const expFile = fs.readdirSync(dir).find((f) => /^afr-expdetail-.*\.xlsx$/.test(f));
  if (!expFile) return logger.warn('no AFR expenditure detail file');
  const wb = XLSX.readFile(path.join(dir, expFile));
  for (const sheet of wb.SheetNames) {
    const sm = sheet.match(/^(\d{4})-(\d{2})$/);
    if (!sm) continue;
    const year = Number(sm[1].slice(0, 2) + sm[2]);
    const short = `${sm[1]}-${sm[2]}`;
    // ADM by district for the same year.
    const adm = new Map<string, { adm: number | null; wadm: number | null }>();
    const admFile = path.join(dir, `adm-wadm-${short}.xlsx`);
    if (fs.existsSync(admFile)) {
      const awb = XLSX.readFile(admFile);
      for (const name of awb.SheetNames) {
        const rows = sheetRows(awb, name);
        const header = rows[0] ?? [];
        const iAun = col(header, (h) => /^(CS )?AUN$/.test(h));
        if (iAun < 0) continue;
        // Charter sheets: "CS ADM by CS" (2020-21+) or "<year> CS ADM" (2016-17 to 2019-20); "CS ADM by SD" is residency, skip it.
        const charterSheet = /CS ADM/.test(name) && !/by SD/.test(name);
        const iAdm = charterSheet
          ? col(header, (h) => /Average Daily Membership/.test(h))
          : col(header, (h) => /Average Daily Membership( \(ADM\))?$/.test(h) && !/Weighted|Charter/.test(h));
        const iWadm = col(header, (h) => /Weighted Average Daily Membership/.test(h));
        if (/by SD/.test(name) || iAdm < 0) continue;
        for (const r of rows.slice(1)) {
          if (r[iAun] == null) continue;
          adm.set(aunOf(r[iAun]), { adm: num(r[iAdm]), wadm: !charterSheet && iWadm >= 0 ? num(r[iWadm]) : null });
        }
      }
    }
    const rows = sheetRows(wb, sheet);
    const header = rows[0];
    const iAun = col(header, (h) => h === 'AUN'), iTotal = col(header, (h) => /^Total Expenditures/.test(h));
    const iInstr = col(header, (h) => /^Instruction 1000$/.test(h)), iSupport = col(header, (h) => /^Support Services 2000$/.test(h));
    let written = 0, unmatched = 0, withAdm = 0;
    sqliteDb.transaction(() => {
      for (const r of rows.slice(1)) {
        if (r[iAun] == null) continue;
        const did = districtByAun.get(aunOf(r[iAun]));
        if (did == null) { unmatched++; continue; }
        const total = num(r[iTotal]), instruction = num(r[iInstr]), support = num(r[iSupport]);
        const a = adm.get(aunOf(r[iAun]));
        const perPupil = total != null && a?.adm ? Math.round(total / a.adm) : null;
        if (perPupil != null) withAdm++;
        upsertFinance.run({ year, districtId: did, total, instruction, support, adm: a?.adm ?? null, wadm: a?.wadm ?? null, perPupil, instructionPerPupil: instruction != null && a?.adm ? Math.round(instruction / a.adm) : null, sourceFile: `${expFile}#${sheet}` });
        written++;
      }
    })();
    logger.info({ year, written, withAdm, unmatched, admFile: fs.existsSync(admFile) }, 'district finance imported');
  }
}

// ---------- Percent low income ----------

function importLowIncome() {
  const dir = path.join(sources, 'lowincome');
  if (!fs.existsSync(dir)) return logger.warn('no lowincome directory');
  for (const file of fs.readdirSync(dir).filter((f) => /^lowincome-\d{4}\.xlsx$/.test(f)).sort()) {
    const yy = file.match(/(\d{2})(\d{2})\.xlsx$/)!;
    const year = 2000 + Number(yy[2]);
    const wb = XLSX.readFile(path.join(dir, file));
    let schools = 0, leas = 0, unmatched = 0, stateTotal = 0, stateLow = 0;
    sqliteDb.transaction(() => {
      for (const name of wb.SheetNames) {
        const bySchool = /by School/i.test(name), byLea = /by LEA/i.test(name);
        if (!bySchool && !byLea) continue;
        const rows = sheetRows(wb, name);
        const hi = headerIndex(rows, (c) => /AUN$/i.test(c.trim()));
        if (hi < 0) continue;
        const header = rows[hi].map((h: any) => String(h ?? '').replace(/\s+/g, ' ').trim().toUpperCase());
        const iAun = header.findIndex((h: string) => /AUN$/.test(h)), iSchool = header.findIndex((h: string) => h === 'SCHOOL NUMBER');
        const iTotal = header.findIndex((h: string) => h === 'TOTAL ENROLLMENT'), iLow = header.findIndex((h: string) => /^LOW.?INCOME ENROLLMENT$/.test(h));
        const iPct = header.findIndex((h: string) => /^PERCENT/.test(h));
        for (const r of rows.slice(hi + 1)) {
          if (r[iAun] == null) continue;
          const total = num(r[iTotal]), low = num(r[iLow]);
          let pct = num(r[iPct]);
          if (pct != null && pct <= 1 && total && low != null && Math.abs(pct * 100 - (low / total) * 100) < 0.5) pct = pct * 100;
          else if (pct != null && pct <= 1) pct = pct * 100;
          if (pct == null && total && low != null) pct = (low / total) * 100;
          if (pct == null) continue;
          const base = { year, indicator: 'low_income', value: round1(pct), n: total == null ? null : Math.round(total), stateValue: null, sourceFile: file };
          if (bySchool) {
            const sid = schoolId(r[iAun], r[iSchool]);
            if (sid == null) { unmatched++; continue; }
            upsertIndicator.run({ ...base, entityType: 'school', entityId: sid }); schools++;
          } else {
            if (total) { stateTotal += total; stateLow += low ?? 0; }
            const did = districtByAun.get(aunOf(r[iAun]));
            if (did == null) { unmatched++; continue; }
            upsertIndicator.run({ ...base, entityType: 'district', entityId: did }); leas++;
          }
        }
      }
      if (stateTotal > 0) {
        const statePct = round1((stateLow / stateTotal) * 100);
        upsertIndicator.run({ year, entityType: 'state', entityId: 0, indicator: 'low_income', value: statePct, n: Math.round(stateTotal), stateValue: null, sourceFile: file });
        sqliteDb.prepare(`UPDATE entity_indicators SET state_value = ? WHERE year = ? AND indicator = 'low_income' AND entity_type IN ('school', 'district')`).run(statePct, year);
      }
    })();
    logger.info({ file, year, schools, leas, unmatched, statePct: stateTotal ? round1((stateLow / stateTotal) * 100) : null }, 'low income imported');
  }
}

// ---------- Professional staff ----------

function importStaff() {
  const dir = path.join(sources, 'staff');
  if (!fs.existsSync(dir)) return logger.warn('no staff directory');
  for (const file of fs.readdirSync(dir).filter((f) => /^staff-\d{4}-\d{2}\.xlsx$/.test(f)).sort()) {
    const m = file.match(/^staff-(\d{2})\d{2}-(\d{2})\.xlsx$/)!;
    const year = Number(m[1] + m[2]);
    const wb = XLSX.readFile(path.join(dir, file));
    const name = wb.SheetNames.find((n) => /^LEA_Averages$/i.test(n));
    if (!name) { logger.warn({ file }, 'no LEA_Averages sheet'); continue; }
    const rows = sheetRows(wb, name);
    const hi = headerIndex(rows, (c) => /^AUN$/i.test(c.trim()));
    const header = rows[hi].map((h: any) => String(h ?? '').trim());
    const idx = (re: RegExp) => header.findIndex((h: string) => re.test(h));
    const iAun = idx(/^AUN$/i), iPP = idx(/^PP$/), iAd = idx(/^Ad$/), iCT = idx(/^CT$/), iSal = idx(/^Sal-CT$/i), iSvc = idx(/^Svc-CT$/i), iLea = idx(/^LEA-CT$/i);
    const enrollment = new Map((sqliteDb.prepare(`SELECT entity_id AS id, total FROM enrollments WHERE entity_type = 'district' AND year = ?`).all(year) as Array<{ id: number; total: number }>).map((r) => [r.id, r.total]));
    let written = 0, unmatched = 0;
    sqliteDb.transaction(() => {
      for (const r of rows.slice(hi + 1)) {
        if (r[iAun] == null) continue;
        const did = districtByAun.get(aunOf(r[iAun]));
        if (did == null) { unmatched++; continue; }
        const teachers = num(r[iCT]);
        const enr = enrollment.get(did);
        upsertStaff.run({
          year, districtId: did, professional: num(r[iPP]), teachers, administrators: num(r[iAd]),
          salary: iSal >= 0 ? num(r[iSal]) : null, experience: iSvc >= 0 ? num(r[iSvc]) : null, inLea: iLea >= 0 ? num(r[iLea]) : null,
          ratio: teachers && enr ? Math.round((enr / teachers) * 10) / 10 : null, sourceFile: file,
        });
        written++;
      }
    })();
    logger.info({ file, year, written, unmatched }, 'staff imported');
  }
}

const what = process.argv[2] ?? 'all';
if (what === 'futureready' || what === 'all') importFutureReady();
if (what === 'graduation' || what === 'all') importGraduation();
if (what === 'enrollment' || what === 'all') importEnrollment();
if (what === 'finance' || what === 'all') importFinance();
if (what === 'lowincome' || what === 'all') importLowIncome();
if (what === 'staff' || what === 'all') importStaff();
if (what === 'enrollment' || what === 'all') { refreshMapPoints(); logger.info('map points refreshed'); }
logger.info('done');
