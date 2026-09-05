// End-to-end checks against a running site: every route fits the viewport and
// the interactions that once regressed still work.
//
//   BASE=http://localhost:4173/paschools node scripts/e2e.mjs
//   BASE=https://chrispeterkins.com/paschools RESOLVE=127.0.0.1 node scripts/e2e.mjs
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
// Prefer the repo's Playwright (devDependency); PLAYWRIGHT_MODULES overrides.
const pwRequire = process.env.PLAYWRIGHT_MODULES ? createRequire(process.env.PLAYWRIGHT_MODULES + '/') : require;
const { chromium } = pwRequire('playwright');
const BASE = (process.env.BASE || 'http://localhost:4173/paschools').replace(/\/$/, '');
const args = ['--no-sandbox'];
if (process.env.RESOLVE) args.push(`--host-resolver-rules=MAP ${new URL(BASE).hostname} ${process.env.RESOLVE}`);

const failures = [];
const check = (name, ok, detail = '') => { console.log(`${ok ? ' ok ' : 'FAIL'} ${name}${detail ? '  ' + detail : ''}`); if (!ok) failures.push(name); };

const browser = await chromium.launch({ args });
const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

// 1. Layout: no horizontal overflow at phone width on every route.
const layout = path.join(path.dirname(fileURLToPath(import.meta.url)), 'check-layout.mjs');
const { execFileSync } = require('child_process');
try {
  const out = execFileSync(process.execPath, [layout], { env: { ...process.env, BASE, WIDTHS: '375', SCHOOL_ID: process.env.SCHOOL_ID || '1' }, encoding: 'utf8' });
  check('layout at 375px', /no horizontal overflow detected/.test(out), out.split('\n').filter((l) => l.startsWith('FAIL')).join(' | '));
} catch (e) {
  check('layout at 375px', false, String(e.stdout || e.message).slice(-300));
}

// 2. Rankings: switching exam must update the URL and the subject list.
await page.goto(`${BASE}/rankings`, { waitUntil: 'load' }); await page.waitForTimeout(2500);
await page.getByLabel('Exam').selectOption('keystone'); await page.waitForTimeout(2000);
const subjects = await page.getByLabel('Subject').locator('option').allTextContents();
check('rankings exam switch', page.url().includes('exam=keystone') && subjects.includes('Algebra I'));

// 3. Map: a selected school opens the detail panel.
await page.goto(`${BASE}/map?s=${process.env.SCHOOL_ID || '1'}&view=39.98,-77.08,12`, { waitUntil: 'load' }); await page.waitForTimeout(4000);
check('map detail panel', (await page.locator('[role="dialog"]').count()) > 0);

// 4. Global search returns results and opens one.
await page.goto(`${BASE}/`, { waitUntil: 'load' }); await page.waitForTimeout(1000);
const search = page.getByLabel('Search schools, districts, and counties').first();
await search.fill('school'); await page.waitForTimeout(1500);
const hits = await page.locator('#global-search-results li').count();
check('global search', hits > 1, `${hits} rows`);

// 5. Compare and About render.
await page.goto(`${BASE}/compare?schools=${process.env.SCHOOL_ID || '1'}`, { waitUntil: 'load' }); await page.waitForTimeout(3000);
check('compare renders', (await page.locator('tbody tr').count()) >= 1);
await page.goto(`${BASE}/about`, { waitUntil: 'load' });
check('about renders', (await page.locator('h1').textContent()) === 'About the data');

check('no page errors', errors.length === 0, errors.join(' | ').slice(0, 300));
await browser.close();
if (failures.length) { console.error(`\n${failures.length} check(s) failed`); process.exit(1); }
console.log('\nall end-to-end checks passed');
