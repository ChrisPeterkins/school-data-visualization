import { FastifyPluginAsync } from 'fastify';
import fs from 'fs';
import path from 'path';
import { sqliteDb } from '../db';

/**
 * Public operational status: last data load, backup, restore drill, release
 * check, and the health-check history, so anyone can see the site is looked
 * after without needing the admin pages.
 */
const statusRoutes: FastifyPluginAsync = async (fastify) => {
  const root = path.resolve(path.dirname(process.env.DATABASE_PATH || './school-data.db'));
  const logs = path.join(root, 'logs');
  const readLines = (file: string) => { try { return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean); } catch { return [] as string[]; } };

  fastify.get('/', async () => {
    const lastImport = (sqliteDb.prepare(`SELECT MAX(completed_at) AS t, COUNT(*) AS n FROM data_imports WHERE status = 'completed'`).get() as { t: number | null; n: number });
    const iso = (t: number | null | undefined) => (t ? new Date(t < 1e12 ? t * 1000 : t).toISOString() : null);

    // Backups: newest file in the backup directory.
    const backupDir = process.env.BACKUP_DIR || '/var/backups/paschools';
    let backup: { at: string; file: string; bytes: number } | null = null;
    try {
      const files = fs.readdirSync(backupDir).filter((f) => f.endsWith('.db.gz')).map((f) => ({ f, st: fs.statSync(path.join(backupDir, f)) })).sort((a, b) => b.st.mtimeMs - a.st.mtimeMs);
      if (files[0]) backup = { at: files[0].st.mtime.toISOString(), file: files[0].f, bytes: files[0].st.size };
    } catch { /* not readable here */ }

    // Restore drill: last line of its log, "<iso> <message>".
    const drill = readLines(path.join(logs, 'restore-drill.log')).pop() ?? null;
    const drillAt = drill?.match(/^(\S+)/)?.[1] ?? null;

    // Health checks every 15 minutes: DOWN/recovered lines only; uptime over the last 30 days.
    const now = Date.now();
    const events = readLines(path.join(logs, 'healthcheck.log')).map((l) => { const m = l.match(/^(\S+) (DOWN:.*|recovered)$/); return m ? { at: m[1], down: m[2].startsWith('DOWN'), detail: m[2] } : null; }).filter((e): e is { at: string; down: boolean; detail: string } => !!e);
    const windowStart = now - 30 * 86400 * 1000;
    let downMs = 0; let downSince: number | null = null;
    for (const e of events) {
      const t = Date.parse(e.at);
      if (e.down) { if (downSince == null) downSince = t; }
      else if (downSince != null) { downMs += Math.max(0, Math.min(t, now) - Math.max(downSince, windowStart)); downSince = null; }
    }
    if (downSince != null) downMs += Math.max(0, now - Math.max(downSince, windowStart));
    const uptime30d = Math.round((1 - downMs / (30 * 86400 * 1000)) * 10000) / 100;
    const incidents = events.filter((e) => e.down && Date.parse(e.at) >= windowStart).slice(-10).reverse();

    let release: any = null;
    try { release = JSON.parse(fs.readFileSync(path.join(root, 'data', 'release-check.json'), 'utf8')); } catch { /* none yet */ }
    let build: { sha?: string; at?: string } = {};
    try { build = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'build.json'), 'utf8')); } catch { /* dev */ }

    const counts = Object.fromEntries(['schools', 'districts', 'pssa_results', 'keystone_results'].map((t) => [t, (sqliteDb.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n]));
    return {
      now: new Date(now).toISOString(),
      build: { sha: build.sha ?? null, at: build.at ?? null, processUptimeSec: Math.round(process.uptime()), node: process.version },
      data: { lastImportAt: iso(lastImport.t), importedFiles: lastImport.n, counts },
      backup,
      restoreDrill: drill ? { at: drillAt, result: drill.replace(/^\S+ /, ''), ok: !/FAIL|failed|no backup/i.test(drill) } : null,
      releaseCheck: release ? { checkedAt: release.checkedAt ?? null, latestYearOnPage: release.latestYearOnPage ?? null, newYears: release.newYears ?? [] } : null,
      health: { uptime30d, incidents, checkedEvery: '15 min', lastEvent: events[events.length - 1] ?? null },
    };
  });
};

export default statusRoutes;
