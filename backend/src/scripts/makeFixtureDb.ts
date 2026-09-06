/**
 * Build a small fixture database from the production one: two counties'
 * schools, districts, and results, all state-level rows, and the derived
 * tables. Used by local development without production data and by the CI
 * end-to-end job.
 *
 *   npx tsx src/scripts/makeFixtureDb.ts [out=fixtures/fixture.db] [countyCodes=101,105]
 */
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { logger } from '../utils/logger';

const src = process.env.DATABASE_PATH || './school-data.db';
const out = process.argv[2] || 'fixtures/fixture.db';
const countyCodes = (process.argv[3] || '101,105').split(',');

fs.mkdirSync(path.dirname(out), { recursive: true });
if (fs.existsSync(out)) fs.unlinkSync(out);
const db = new Database(out);
db.pragma('foreign_keys = OFF');
db.pragma('journal_mode = OFF');
db.pragma('synchronous = OFF');
db.exec(`ATTACH DATABASE '${src.replace(/'/g, "''")}' AS prod`);

// Recreate every table and index with the production DDL.
const ddl = db.prepare(`SELECT sql FROM prod.sqlite_master WHERE sql IS NOT NULL AND type IN ('table','index') AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'search_index%' AND name NOT LIKE 'search_trigram%' ORDER BY type = 'index'`).all() as Array<{ sql: string }>;
for (const { sql } of ddl) db.exec(sql);

const codeList = countyCodes.map((c) => `'${c}'`).join(',');
db.exec(`INSERT INTO counties SELECT * FROM prod.counties`);
db.exec(`INSERT INTO districts SELECT * FROM prod.districts WHERE county_id IN (SELECT id FROM prod.counties WHERE county_code IN (${codeList}))`);
db.exec(`INSERT INTO schools SELECT * FROM prod.schools WHERE district_id IN (SELECT id FROM districts)`);
for (const t of ['pssa_results', 'keystone_results']) {
  db.exec(`INSERT INTO ${t} SELECT * FROM prod.${t} WHERE level = 'state' OR district_id IN (SELECT id FROM districts) OR school_id IN (SELECT id FROM schools)`);
}
db.exec(`INSERT INTO pvaas_results SELECT * FROM prod.pvaas_results WHERE district_id IN (SELECT id FROM districts) OR school_id IN (SELECT id FROM schools)`);
db.exec(`INSERT INTO school_map_points SELECT * FROM prod.school_map_points WHERE school_id IN (SELECT id FROM schools)`);
db.exec(`INSERT INTO data_imports SELECT * FROM prod.data_imports`);
// Non-assessment tables (indicators, enrollment, finance); created by ensureIndicatorTables in production.
for (const t of ['entity_indicators', 'enrollments']) {
  db.exec(`INSERT INTO ${t} SELECT * FROM prod.${t} WHERE entity_type = 'state' OR (entity_type = 'district' AND entity_id IN (SELECT id FROM districts)) OR (entity_type = 'school' AND entity_id IN (SELECT id FROM schools))`);
}
db.exec(`INSERT INTO district_finance SELECT * FROM prod.district_finance WHERE district_id IN (SELECT id FROM districts)`);
db.exec(`DETACH DATABASE prod`);
db.exec('VACUUM');

const counts = Object.fromEntries(['counties', 'districts', 'schools', 'pssa_results', 'keystone_results', 'pvaas_results', 'entity_indicators', 'enrollments', 'district_finance'].map((t) => [t, (db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as any).n]));
db.close();
logger.info(`fixture written to ${out} (${Math.round(fs.statSync(out).size / 1024 / 1024)} MB): ${JSON.stringify(counts)}`);
