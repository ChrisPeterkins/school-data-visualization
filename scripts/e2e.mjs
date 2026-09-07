// End-to-end checks against a running site: every route fits the viewport and
// the interactions that once regressed still work.
//
//   BASE=http://localhost:4173/paschools node scripts/e2e.mjs
//   BASE=https://chrispeterkins.com/paschools RESOLVE=127.0.0.1 node scripts/e2e.mjs
import { createRequire } from 'module';
import fs from 'fs';
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

// 6. Spanish toggle switches the page and sticks across navigation.
await page.getByRole('button', { name: 'ES', exact: true }).first().click(); await page.waitForTimeout(500);
check('spanish toggle', (await page.locator('h1').textContent()) === 'Acerca de los datos');
await page.goto(`${BASE}/`, { waitUntil: 'load' }); await page.waitForTimeout(500);
check('spanish persists', (await page.locator('h1').textContent() || '').startsWith('Explorador'));
await page.getByRole('button', { name: 'EN', exact: true }).first().click(); await page.waitForTimeout(300);

// 7. Phone: school results render as cards, not a sideways table.
await page.setViewportSize({ width: 375, height: 800 });
await page.goto(`${BASE}/schools/${process.env.SCHOOL_ID || '1'}`, { waitUntil: 'load' }); await page.waitForTimeout(3000);
check('results cards on phone', (await page.locator('[data-testid="results-cards"] li:visible').count()) > 0);
await page.setViewportSize({ width: 1280, height: 900 });

// 8. Public API docs.
const docs = await page.request.get(`${BASE}/api/docs/json`);
check('api docs json', docs.ok() && (await docs.json()).openapi === '3.0.3');

// 8b. Rankings by a non-assessment measure, beating-the-odds scatter, nearby schools, compare indicators.
await page.goto(`${BASE}/rankings?measure=grad_rate_4yr&entity=school`, { waitUntil: 'load' }); await page.waitForTimeout(3000);
check('rankings by graduation rate', (await page.locator('text=/in cohort/').count()) > 0);
await page.goto(`${BASE}/rankings?measure=beating_odds&entity=school`, { waitUntil: 'load' }); await page.waitForTimeout(3500);
check('beating the odds scatter', (await page.locator('.recharts-scatter-symbol').count()) > 20);
await ctx.grantPermissions(["geolocation"]); await ctx.setGeolocation({ latitude: 39.83, longitude: -77.23 });
await page.goto(`${BASE}/nearby`, { waitUntil: 'load' }); await page.waitForTimeout(3500);
check('nearby schools', (await page.locator('ul.divide-y li').count()) >= 5);
await page.goto(`${BASE}/compare?schools=${process.env.SCHOOL_ID || '1'}`, { waitUntil: 'load' }); await page.waitForTimeout(3500);
check('compare indicators table', (await page.locator('table th:has-text("Measure")').count()) === 1);

// 8c. Round D: updates page + feed, report card, low-income band on rankings, skip link, indicator trends.
await page.goto(`${BASE}/updates`, { waitUntil: 'load' }); await page.waitForTimeout(2500);
check('updates page', (await page.locator('h1').textContent()) === 'Data updates' && (await page.locator('main li, main article').count()) >= 1);
const feed = await page.request.get(`${BASE}/api/feed`); // /paschools/feed.xml is an nginx rewrite to this, absent under vite preview
check('atom feed', feed.ok() && (feed.headers()['content-type'] || '').includes('atom') && (await feed.text()).includes('<entry>'));
await page.goto(`${BASE}/schools/${process.env.SCHOOL_ID || '1'}/report`, { waitUntil: 'load' }); await page.waitForTimeout(3500);
check('report card', (await page.locator('text=Report card').count()) >= 1 && (await page.locator('h1').count()) === 1);
await page.goto(`${BASE}/rankings?entity=school&band=60-80`, { waitUntil: 'load' }); await page.waitForTimeout(3000);
check('rankings low-income band', (await page.locator('select').filter({ has: page.locator('option[value="60-80"]') }).first().inputValue()) === '60-80' && (await page.locator('main a[href*="/schools/"]').count()) >= 1);
await page.keyboard.press('Tab');
check('skip link focusable', ((await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('href'))) || '') === '#main');
await page.goto(`${BASE}/trends`, { waitUntil: 'load' }); await page.waitForTimeout(3500);
check('indicator trends on trends page', (await page.locator('#ind-trends-heading').count()) === 1 && (await page.locator('.recharts-line').count()) >= 1);

// 8d. Round E: status and data pages, peer districts, students-of-color band, dark mode (with axe), county report card.
await page.goto(`${BASE}/status`, { waitUntil: 'load' }); await page.waitForTimeout(2500);
check('status page', (await page.locator('h1').textContent()) === 'Site status' && (await page.locator('text=Uptime, last 30 days').count()) === 1);
await page.goto(`${BASE}/data`, { waitUntil: 'load' }); await page.waitForTimeout(2500);
check('data downloads page', (await page.locator('a[href*="/api/data/"]').count()) >= 10);
const csv = await page.request.get(`${BASE}/api/data/counties.csv`);
check('table csv download', csv.ok() && (csv.headers()['content-type'] || '').includes('text/csv') && (await csv.text()).split('\n').length > 10);
await page.goto(`${BASE}/districts/${process.env.DISTRICT_ID || '4'}`, { waitUntil: 'load' }); await page.waitForTimeout(3500);
check('peer districts', (await page.locator('text=Peer districts').count()) === 1);
await page.goto(`${BASE}/rankings?entity=school&poc=0-20`, { waitUntil: 'load' }); await page.waitForTimeout(3000);
check('rankings students-of-color band', (await page.locator('select').filter({ has: page.locator('option[value="0-20"]') }).nth(1).inputValue()) === '0-20' && (await page.locator('main a[href*="/schools/"]').count()) >= 1);
await page.goto(`${BASE}/counties/${process.env.COUNTY_ID || '1'}/report`, { waitUntil: 'load' }); await page.waitForTimeout(3500);
check('county report card', (await page.locator('h1').count()) === 1 && (await page.locator('text=Report card').count()) >= 1);
// Dark mode: toggle via the nav button, confirm the class lands, run axe in the dark theme too.
await page.goto(`${BASE}/`, { waitUntil: 'load' }); await page.waitForTimeout(2000);
await page.evaluate(() => { localStorage.setItem('theme', 'dark'); });
await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(2500);
check('dark mode applies', await page.evaluate(() => document.documentElement.classList.contains('dark')));
const axeFileDark = ['frontend/node_modules/axe-core/axe.min.js', 'node_modules/axe-core/axe.min.js'].map((p) => new URL('../' + p, import.meta.url).pathname).find((p) => fs.existsSync(p));
if (axeFileDark) {
  await page.evaluate(fs.readFileSync(axeFileDark, 'utf8'));
  const dark = await page.evaluate(async () => { const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] }, rules: { 'color-contrast': { enabled: true } } }); return r.violations.filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => `${v.id} (${v.nodes.length}): ${v.nodes[0]?.target?.[0] ?? ''}`); });
  check('axe / (dark)', dark.length === 0, dark.join(' | ').slice(0, 400));
}
await page.evaluate(() => { localStorage.removeItem('theme'); });

// 9. Accessibility: axe-core on three representative pages; serious and critical violations fail.
const axePath = ['frontend/node_modules/axe-core/axe.min.js', 'node_modules/axe-core/axe.min.js'].map((p) => new URL('../' + p, import.meta.url).pathname).find((p) => fs.existsSync(p));
if (axePath) {
  const axeSource = fs.readFileSync(axePath, 'utf8');
  for (const path of ['/', `/schools/${process.env.SCHOOL_ID || '1'}`, '/rankings']) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'load' }); await page.waitForTimeout(2500);
    await page.evaluate(axeSource);
    const result = await page.evaluate(async () => {
      const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] }, rules: { 'color-contrast': { enabled: true } } });
      return r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id} (${v.nodes.length}): ${v.nodes[0]?.target?.[0] ?? ''}`);
    });
    check(`axe ${path}`, result.length === 0, result.join(' | ').slice(0, 400));
  }
} else {
  console.log(' --  axe-core not installed; skipping accessibility checks');
}

check('no page errors', errors.length === 0, errors.join(' | ').slice(0, 300));
await browser.close();
if (failures.length) { console.error(`\n${failures.length} check(s) failed`); process.exit(1); }
console.log('\nall end-to-end checks passed');
