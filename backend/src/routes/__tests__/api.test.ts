/**
 * Route tests against the committed fixture database (Adams County). Each
 * test recomputes the expected value with its own SQL so the weighting,
 * percentile, gap, and change logic is checked, not just that a route answers.
 */
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import Database from 'better-sqlite3';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'paschools-test-'));
const dbPath = path.join(tmp, 'fixture.db');
fs.writeFileSync(dbPath, zlib.gunzipSync(fs.readFileSync(path.join(__dirname, '../../../fixtures/fixture.db.gz'))));
process.env.DATABASE_PATH = dbPath;
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';

let app: any;
const raw = new Database(dbPath, { readonly: true });
const get = async (url: string) => {
  const res = await app.inject({ method: 'GET', url });
  expect(res.statusCode, url).toBe(200);
  return res.json();
};

beforeAll(async () => {
  const { buildApp } = await import('../../index');
  app = await buildApp();
  await app.ready();
}, 30000);
afterAll(async () => { await app?.close(); raw.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

describe('summary', () => {
  it('statewide series equals the state total rows', async () => {
    const { series } = await get('/api/performance/summary?exam=pssa&level=state&subject=Mathematics');
    const expected = raw.prepare(`SELECT year, proficient_or_above_percent AS p FROM pssa_results WHERE level='state' AND subject='Mathematics' AND grade=0 AND demographic_group='All Students' ORDER BY year`).all() as any[];
    expect(series.map((s: any) => s.year)).toEqual(expected.map((e) => e.year));
    for (const e of expected) expect(series.find((s: any) => s.year === e.year).proficiency).toBeCloseTo(e.p, 1);
  });

  it('school-level series is weighted by students tested', async () => {
    const { series } = await get('/api/performance/summary?exam=pssa&level=school&subject=Mathematics&yearFrom=2025&yearTo=2025');
    const e = raw.prepare(`SELECT SUM(proficient_or_above_percent*total_tested)*1.0/SUM(total_tested) AS w, AVG(proficient_or_above_percent) AS plain FROM pssa_results WHERE level='school' AND year=2025 AND subject='Mathematics' AND grade=0 AND demographic_group='All Students' AND proficient_or_above_percent IS NOT NULL AND total_tested>0`).get() as any;
    expect(series).toHaveLength(1);
    expect(series[0].proficiency).toBeCloseTo(e.w, 1);
    // The unweighted mean differs, which is the whole point of weighting.
    expect(Math.abs(e.w - e.plain)).toBeGreaterThan(0.05);
  });
});

describe('gaps', () => {
  it('All Students gap is zero and group figures match the totals rows', async () => {
    const d = await get('/api/performance/gaps?exam=pssa&level=district&subject=Mathematics&districtId=1&year=2025');
    const all = d.groups.find((g: any) => g.group === 'All Students');
    expect(all.gap).toBe(0);
    const econ = raw.prepare(`SELECT proficient_or_above_percent AS p FROM pssa_results WHERE level='district' AND district_id=1 AND year=2025 AND subject='Mathematics' AND grade=0 AND demographic_group='Economically Disadvantaged'`).get() as any;
    const row = d.groups.find((g: any) => g.group === 'Economically Disadvantaged');
    expect(row.proficiency).toBeCloseTo(econ.p, 1);
    expect(row.gap).toBeCloseTo(econ.p - all.proficiency, 1);
  });
});

describe('percentile', () => {
  it('matches a hand computation among schools with 20+ tested', async () => {
    const r = await get('/api/performance/percentile?entity=school&id=1&year=2025&exam=pssa&subject=Mathematics');
    const rows = raw.prepare(`SELECT school_id AS id, proficient_or_above_percent AS v FROM pssa_results WHERE level='school' AND year=2025 AND subject='Mathematics' AND grade=0 AND demographic_group='All Students' AND proficient_or_above_percent IS NOT NULL AND total_tested>=20`).all() as any[];
    const me = rows.find((x) => x.id === 1).v;
    const below = rows.filter((x) => x.v < me).length, equal = rows.filter((x) => x.v === me).length;
    expect(r.statewide.n).toBe(rows.length);
    expect(r.statewide.percentile).toBe(Math.round(((below + equal / 2) / rows.length) * 100));
  });
});

describe('rankings', () => {
  it('level mode orders by weighted proficiency and honours minTested', async () => {
    const r = await get('/api/performance/rankings?year=2025&examType=pssa&subject=Mathematics&limit=5&minTested=40');
    const vals = r.top.map((t: any) => t.avgProficiency);
    expect(vals).toEqual([...vals].sort((a, b) => b - a));
    for (const t of r.top) expect(t.totalTested).toBeGreaterThanOrEqual(40);
  });

  it('change mode equals this year minus the compare year', async () => {
    const r = await get('/api/performance/rankings?year=2025&examType=pssa&subject=Mathematics&entity=district&mode=change&limit=5');
    expect(r.filters.compareYear).toBe(2024);
    for (const t of r.top) {
      const cur = raw.prepare(`SELECT proficient_or_above_percent AS p FROM pssa_results WHERE level='district' AND district_id=? AND year=2025 AND subject='Mathematics' AND grade=0 AND demographic_group='All Students'`).get(t.id) as any;
      const prev = raw.prepare(`SELECT proficient_or_above_percent AS p FROM pssa_results WHERE level='district' AND district_id=? AND year=2024 AND subject='Mathematics' AND grade=0 AND demographic_group='All Students'`).get(t.id) as any;
      expect(t.change).toBeCloseTo(cur.p - prev.p, 1);
    }
  });
});

describe('caching and docs', () => {
  it('read endpoints carry Cache-Control and answer 304 on a matching ETag', async () => {
    const first = await app.inject({ method: 'GET', url: '/api/performance/years' });
    expect(first.headers['cache-control']).toBe('public, max-age=3600');
    const again = await app.inject({ method: 'GET', url: '/api/performance/years', headers: { 'if-none-match': first.headers.etag as string } });
    expect(again.statusCode).toBe(304);
  });

  it('serves the OpenAPI document', async () => {
    const doc = await get('/api/docs/json');
    expect(doc.paths['/performance/summary']).toBeDefined();
  });
});

describe('indicators, spending, districts, and search', () => {
  it('returns indicator series with a statewide comparison for a school', async () => {
    const school = raw.prepare(`SELECT entity_id AS id FROM entity_indicators WHERE entity_type = 'school' AND indicator = 'regular_attendance' LIMIT 1`).get() as { id: number };
    const body = await get(`/api/indicators/school/${school.id}`);
    const att = body.indicators.find((s: any) => s.indicator === 'regular_attendance');
    expect(att.series.length).toBeGreaterThan(0);
    const last = att.series[att.series.length - 1];
    const state = raw.prepare(`SELECT value FROM entity_indicators WHERE entity_type = 'state' AND indicator = 'regular_attendance' AND year = ?`).get(last.year) as { value: number } | undefined;
    if (state) expect(last.stateValue).toBe(state.value);
    expect(Array.isArray(body.enrollment)).toBe(true);
  });

  it('computes district spending per pupil as total expenditures over ADM', async () => {
    const row = raw.prepare(`SELECT district_id, year, total_expenditures, adm, per_pupil FROM district_finance WHERE per_pupil IS NOT NULL ORDER BY year DESC LIMIT 1`).get() as any;
    const body = await get(`/api/indicators/district/${row.district_id}`);
    const f = body.finance.find((x: any) => x.year === row.year);
    expect(f.perPupil).toBe(Math.round(row.total_expenditures / row.adm));
    expect(f.statePerPupil).not.toBeNull();
  });

  it('spending scatter pairs finance with student-weighted Math + ELA proficiency', async () => {
    const body = await get('/api/indicators/spending');
    expect(body.year).not.toBeNull();
    expect(body.districts.length).toBeGreaterThan(0);
    const d = body.districts[0];
    const check = raw.prepare(`
      SELECT ROUND(SUM(proficient_or_above_percent * total_tested) / SUM(total_tested), 1) AS p FROM pssa_results
      WHERE level = 'district' AND district_id = ? AND year = ? AND grade = 0 AND demographic_group = 'All Students' AND subject IN ('Mathematics', 'English Language Arts') AND total_tested > 0
    `).get(d.id, body.year) as { p: number };
    expect(d.proficiency).toBe(check.p);
    expect(body.state.medianPerPupil).toBeGreaterThan(0);
  });

  it('sorts districts by proficiency and filters by enrollment', async () => {
    const body = await get('/api/districts?sortBy=proficiency&sortOrder=desc&limit=5&minEnrollment=500');
    const values = body.data.map((d: any) => d.proficiency ?? -1);
    expect([...values].sort((a, b) => b - a)).toEqual(values);
    for (const d of body.data) expect(d.totalEnrollment).toBeGreaterThanOrEqual(500);
  });

  it('search tolerates a misspelling through the trigram index', async () => {
    const name = (raw.prepare(`SELECT name FROM districts WHERE name LIKE '% SD' ORDER BY LENGTH(name) DESC LIMIT 1`).get() as { name: string }).name;
    const word = name.split(' ')[0].toLowerCase();
    const typo = word.slice(0, -1) + 'x' + word.slice(-1);
    const body = await get(`/api/search?q=${encodeURIComponent(typo)}&limit=5`);
    expect(body.results.some((r: any) => r.name.toLowerCase().startsWith(word))).toBe(true);
  });
});
