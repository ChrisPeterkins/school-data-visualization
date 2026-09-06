// Size budget for the built frontend: fails when a gzipped chunk or the total
// grows past the limits below. Run after `npm run build -w frontend`.
//   node scripts/perf-budget.mjs [frontend/dist]
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const dist = process.argv[2] || 'frontend/dist';
const assets = path.join(dist, 'assets');
const BUDGET_KB = { total: 700, 'index-': 80, 'react-': 90, 'recharts-': 120, 'leaflet-': 60, 'grid-': 80, 'MapPage-': 30, page: 25 };

let total = 0; const fails = []; const rows = [];
for (const f of fs.readdirSync(assets).filter((f) => f.endsWith('.js') || f.endsWith('.css'))) {
  const gz = zlib.gzipSync(fs.readFileSync(path.join(assets, f)), { level: 9 }).length / 1024;
  total += gz;
  const key = Object.keys(BUDGET_KB).find((k) => k !== 'total' && k !== 'page' && f.startsWith(k));
  const limit = key ? BUDGET_KB[key] : /Page-/.test(f) ? BUDGET_KB.page : null;
  rows.push([f, gz.toFixed(1), limit ?? '']);
  if (limit != null && gz > limit) fails.push(`${f}: ${gz.toFixed(1)} KB gz > ${limit} KB`);
}
if (total > BUDGET_KB.total) fails.push(`total: ${total.toFixed(0)} KB gz > ${BUDGET_KB.total} KB`);
for (const [f, kb, limit] of rows.sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`${kb.padStart(7)} KB  ${f}${limit ? `  (budget ${limit})` : ''}`);
console.log(`${total.toFixed(0).padStart(7)} KB  total gzipped JS+CSS (budget ${BUDGET_KB.total})`);
if (fails.length) { console.error('\nBudget exceeded:\n  ' + fails.join('\n  ')); process.exit(1); }
console.log('\nwithin budget');
