import { FastifyPluginAsync } from 'fastify';
import { sqliteDb } from '../db';
import { cache } from '../cache';

const SITE = 'https://chrispeterkins.com/paschools';

/** XML sitemap of every browsable page so school pages get indexed. */
const sitemapRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/sitemap.xml', async (_request, reply) => {
    const cacheKey = cache.generateKey('sitemap');
    let xml = await cache.get<string>(cacheKey);
    if (!xml) {
      const schools = sqliteDb.prepare(`SELECT id FROM schools WHERE is_active = 1 ORDER BY id`).all() as Array<{ id: number }>;
      const districts = sqliteDb.prepare(`SELECT id FROM districts ORDER BY id`).all() as Array<{ id: number }>;
      const counties = sqliteDb.prepare(`SELECT id FROM counties ORDER BY id`).all() as Array<{ id: number }>;
      const urls = [
        '', '/schools', '/districts', '/counties', '/state', '/compare', '/trends', '/rankings', '/map',
        ...schools.map((s) => `/schools/${s.id}`),
        ...districts.map((d) => `/districts/${d.id}`),
        ...counties.map((c) => `/counties/${c.id}`),
      ];
      const today = new Date().toISOString().slice(0, 10);
      xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        urls.map((u) => `  <url><loc>${SITE}${u}</loc><lastmod>${today}</lastmod></url>`).join('\n') +
        `\n</urlset>\n`;
      await cache.set(cacheKey, xml, 6 * 3600);
    }
    reply.header('Content-Type', 'application/xml; charset=utf-8');
    return xml;
  });
};

export default sitemapRoutes;
