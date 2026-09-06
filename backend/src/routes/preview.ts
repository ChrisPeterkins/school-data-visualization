import { FastifyPluginAsync } from 'fastify';
import { sqliteDb } from '../db';

const SITE = 'https://chrispeterkins.com/paschools';
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function latestFigures(level: 'school' | 'district' | 'county', column: string, id: number) {
  const year = (sqliteDb.prepare(`SELECT MAX(year) AS y FROM pssa_results WHERE level = ? AND ${column} = ? AND grade = 0`).get(level, id) as { y: number | null })?.y;
  if (!year) return null;
  const rows = sqliteDb.prepare(`
    SELECT subject, ROUND(SUM(proficient_or_above_percent * total_tested) / SUM(total_tested), 1) AS p FROM pssa_results
    WHERE level = ? AND ${column} = ? AND year = ? AND grade = 0 AND demographic_group = 'All Students' AND total_tested > 0 AND subject IN ('Mathematics', 'English Language Arts')
    GROUP BY subject
  `).all(level, id, year) as Array<{ subject: string; p: number }>;
  const math = rows.find((r) => r.subject === 'Mathematics')?.p, ela = rows.find((r) => r.subject === 'English Language Arts')?.p;
  if (math == null && ela == null) return null;
  return `${year} PSSA: ${math != null ? `Math ${math}%` : ''}${math != null && ela != null ? ', ' : ''}${ela != null ? `ELA ${ela}%` : ''} proficient or above.`;
}

/**
 * Link-preview pages for crawlers. nginx routes bot user agents for
 * /schools/:id, /districts/:id, and /counties/:id here; humans get the SPA.
 * The page carries Open Graph tags and a plain summary, then links onward.
 */
const previewRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/:kind/:id', async (request, reply) => {
    const { kind, id: rawId } = request.params as { kind: string; id: string };
    const id = Number(rawId);
    let title = 'PA School Data', description = 'PSSA and Keystone exam results, growth, and trends for every public school in Pennsylvania.', path = '/';
    if (kind === 'schools' && Number.isFinite(id)) {
      const s = sqliteDb.prepare(`SELECT s.name, s.city, d.name AS district, c.name AS county FROM schools s JOIN districts d ON d.id = s.district_id JOIN counties c ON c.id = d.county_id WHERE s.id = ?`).get(id) as { name: string; city: string | null; district: string; county: string } | undefined;
      if (!s) return reply.status(404).send('Not found');
      title = `${s.name} · ${s.district}`;
      description = [`${s.city ? `${s.city}, ` : ''}${s.county} County.`, latestFigures('school', 'school_id', id), 'Results, growth, gaps, and trends on PA School Data.'].filter(Boolean).join(' ');
      path = `/schools/${id}`;
    } else if (kind === 'districts' && Number.isFinite(id)) {
      const d = sqliteDb.prepare(`SELECT d.name, c.name AS county FROM districts d JOIN counties c ON c.id = d.county_id WHERE d.id = ?`).get(id) as { name: string; county: string } | undefined;
      if (!d) return reply.status(404).send('Not found');
      title = d.name;
      description = [`${d.county} County, Pennsylvania.`, latestFigures('district', 'district_id', id), 'District results, schools, spending, and trends on PA School Data.'].filter(Boolean).join(' ');
      path = `/districts/${id}`;
    } else if (kind === 'counties' && Number.isFinite(id)) {
      const c = sqliteDb.prepare(`SELECT name FROM counties WHERE id = ?`).get(id) as { name: string } | undefined;
      if (!c) return reply.status(404).send('Not found');
      title = `${c.name} County`;
      description = `Results and achievement gaps for every district in ${c.name} County, Pennsylvania, on PA School Data.`;
      path = `/counties/${id}`;
    } else {
      return reply.status(404).send('Not found');
    }
    const url = `${SITE}${path}`;
    reply.header('Cache-Control', 'public, max-age=3600');
    return reply.type('text/html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${esc(title)} · PA School Data</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article"><meta property="og:site_name" content="PA School Data">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}"><meta property="og:image" content="${SITE}/assets/og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${SITE}/assets/og.png">
</head><body><h1>${esc(title)}</h1><p>${esc(description)}</p><p><a href="${url}">Open on PA School Data</a></p></body></html>`);
  });
};

export default previewRoutes;
