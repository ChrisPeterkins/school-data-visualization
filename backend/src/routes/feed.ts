import { FastifyPluginAsync } from 'fastify';
import { sqliteDb } from '../db';

const SITE = 'https://chrispeterkins.com/paschools';
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** Atom feed of data loads: one entry per import batch (files completed within the same hour). */
const feedRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/', async (_request, reply) => {
    const rows = sqliteDb.prepare(`
      SELECT file_name AS fileName, file_type AS fileType, level, year, inserted_rows AS inserted, completed_at AS completedAt
      FROM data_imports WHERE status = 'completed' AND completed_at IS NOT NULL ORDER BY completed_at DESC, id DESC LIMIT 300
    `).all() as Array<{ fileName: string; fileType: string | null; level: string | null; year: number | null; inserted: number | null; completedAt: number }>;
    const entries: Array<{ at: Date; years: Set<number>; files: string[]; inserted: number }> = [];
    for (const r of rows) {
      const at = new Date(r.completedAt < 1e12 ? r.completedAt * 1000 : r.completedAt);
      const last = entries[entries.length - 1];
      if (last && Math.abs(last.at.getTime() - at.getTime()) < 3600 * 1000) { last.files.push(r.fileName); last.inserted += r.inserted ?? 0; if (r.year) last.years.add(r.year); }
      else entries.push({ at, years: new Set(r.year ? [r.year] : []), files: [r.fileName], inserted: r.inserted ?? 0 });
    }
    const updated = entries[0]?.at ?? new Date();
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>PA School Data updates</title>
  <subtitle>New Pennsylvania Department of Education data loaded into the explorer</subtitle>
  <link href="${SITE}/updates"/>
  <link rel="self" href="${SITE}/feed.xml"/>
  <id>${SITE}/feed.xml</id>
  <updated>${updated.toISOString()}</updated>
${entries.slice(0, 40).map((e) => {
    const years = [...e.years].sort().join(', ');
    const title = `Data loaded${years ? ` for ${years}` : ''}: ${e.files.length} file${e.files.length === 1 ? '' : 's'}`;
    const summary = `${e.inserted.toLocaleString()} rows from ${e.files.slice(0, 6).join(', ')}${e.files.length > 6 ? ` and ${e.files.length - 6} more` : ''}.`;
    return `  <entry>
    <title>${esc(title)}</title>
    <link href="${SITE}/updates"/>
    <id>${SITE}/updates#${e.at.getTime()}</id>
    <updated>${e.at.toISOString()}</updated>
    <summary>${esc(summary)}</summary>
  </entry>`;
  }).join('\n')}
</feed>`;
    reply.header('Cache-Control', 'public, max-age=3600');
    return reply.type('application/atom+xml; charset=utf-8').send(xml);
  });
};

export default feedRoutes;
