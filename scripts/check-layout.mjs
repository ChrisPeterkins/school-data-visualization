// Layout smoke test: loads every route at phone (and optionally desktop) width and fails on horizontal overflow.
//   BASE=https://chrispeterkins.com/paschools WIDTHS=375,1280 node scripts/check-layout.mjs

// Loads every route at phone width and reports horizontal overflow offenders.
import { createRequire } from 'module';
// Playwright is not a project dependency; point PLAYWRIGHT_MODULES at a node_modules folder that has it.
const require = createRequire((process.env.PLAYWRIGHT_MODULES || '/root/.npm/_npx/5c6d8c4f680fcd0a/node_modules') + '/');
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'https://chrispeterkins.com/paschools';
const SCHOOL_ID = process.env.SCHOOL_ID || '1';
const routes = process.env.ROUTES ? process.env.ROUTES.split(',') : ['/', '/schools', `/schools/${SCHOOL_ID}`, '/schools?search=lincoln', '/districts', '/districts/1', '/counties', '/counties/1', '/map', '/compare?schools=1,2', '/trends?level=school&subject=Science', '/rankings?exam=keystone', '/state', '/compare', '/trends', '/rankings', '/import', '/verify', '/database', '/upload'];
const widths = (process.env.WIDTHS || '375,390').split(',').map(Number);
const shotDir = process.env.SHOTS || '';

const browser = await chromium.launch({
  args: ['--host-resolver-rules=MAP chrispeterkins.com 127.0.0.1', '--no-sandbox'],
});
const ctx = await browser.newContext({ ignoreHTTPSErrors: true, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
let failures = 0;
for (const width of widths) {
  const page = await ctx.newPage();
  await page.setViewportSize({ width, height: 812 });
  for (const route of routes) {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    // 'load' rather than 'networkidle': the admin pages hold an SSE stream open forever.
    await page.goto(BASE + route, { waitUntil: 'load', timeout: 60000 }).catch(e => errors.push('nav: ' + e.message));
    await page.waitForTimeout(3000);
    const r = await page.evaluate((vw) => {
      const sw = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
      const offenders = [];
      for (const el of document.querySelectorAll('body *')) {
        if (el.closest('defs')) continue; // clipPath/gradient rects never paint
        const b = el.getBoundingClientRect();
        if (b.width > 0 && b.right > vw + 1) {
          // skip elements that are inside an intentional horizontal scroller
          let p = el.parentElement, scrollable = false;
          while (p) { const o = getComputedStyle(p).overflowX; if (((o === 'auto' || o === 'scroll') && p.scrollWidth > p.clientWidth) || (o === 'hidden' && p.getBoundingClientRect().right <= vw + 1)) { scrollable = true; break; } p = p.parentElement; }
          if (!scrollable) offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 3).join('.')} right=${Math.round(b.right)}`);
        }
      }
      return { vw, sw, inner: window.innerWidth, offenders: offenders.slice(0, 6), total: offenders.length };
    }, width);
    const bad = r.sw > r.vw + 1 || r.inner > r.vw + 1 || r.total > 0;
    if (bad) failures++;
    console.log(`${bad ? 'FAIL' : ' ok '} ${width}px ${route}  scrollWidth=${r.sw} innerWidth=${r.inner} (viewport ${r.vw}) offenders=${r.total}${errors.length ? '  errors=' + errors.join(' | ').slice(0, 200) : ''}`);
    for (const o of r.offenders) console.log('       ' + o);
    if (shotDir) await page.screenshot({ path: `${shotDir}/${width}-${route.replace(/[^a-z0-9]+/gi, '_') || 'home'}.png`, fullPage: true });
  }
  await page.close();
}
await browser.close();
console.log(failures ? `\n${failures} route/width combos overflow` : '\nno horizontal overflow detected');
