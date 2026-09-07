/* Service worker: app shell offline, hashed assets cache-first, API GETs network-first
   with a cached fallback (and a message so the page can show a "stale data" banner). */
const VERSION = 'v1';
const SHELL = `paschools-shell-${VERSION}`;
const ASSETS = `paschools-assets-${VERSION}`;
const API = `paschools-api-${VERSION}`;
const API_LIMIT = 300;
const BASE = '/paschools/';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll([BASE, `${BASE}manifest.webmanifest`]).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('paschools-') && ![SHELL, ASSETS, API].includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

async function trim(name, limit) {
  const cache = await caches.open(name); const keys = await cache.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - limit))) await cache.delete(k);
}
async function tellClient(event) {
  const client = await self.clients.get(event.clientId || event.resultingClientId);
  if (client) client.postMessage({ type: 'served-from-cache' });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  // Admin and export endpoints are never cached.
  if (/^\/paschools\/api\/(import|verify|database|upload|files|data)\b/.test(url.pathname)) return;

  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).then((res) => { caches.open(SHELL).then((c) => c.put(BASE, res.clone())); return res; })
      .catch(async () => { const hit = await caches.match(BASE); if (hit) tellClient(event); return hit || Response.error(); }));
    return;
  }
  if (url.pathname.startsWith(`${BASE}assets/`)) {
    event.respondWith(caches.open(ASSETS).then(async (c) => { const hit = await c.match(req); if (hit) return hit; const res = await fetch(req); if (res.ok) c.put(req, res.clone()); return res; }));
    return;
  }
  if (url.pathname.startsWith(`${BASE}api/`)) {
    event.respondWith(fetch(req).then((res) => { if (res.ok) caches.open(API).then((c) => c.put(req, res.clone()).then(() => trim(API, API_LIMIT))); return res; })
      .catch(async () => { const hit = await caches.match(req); if (hit) { tellClient(event); return hit; } return new Response(JSON.stringify({ error: 'offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } }); }));
  }
});
