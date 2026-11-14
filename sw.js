/**
 * sw.js — service worker: makes the game load instantly and work with no connection.
 *
 * How it works (read this before changing it):
 *  - On install it downloads EVERY game file listed in asset-manifest.json into one cache named after BUILD.
 *    If any file fails, the install fails and the previous version keeps running: you never get half an update.
 *  - After that, files come from the cache first. Navigations always get the cached index.html.
 *  - A new version installs in the background and WAITS. The page offers "Update ready: restart"; only then does it
 *    take over (we never swap code under a running game).
 *  - BUILD below is rewritten by `node tools/gen-assets.mjs` whenever a game file changes, which makes THIS file
 *    change, which is what makes browsers notice there is a new version at all.
 */
const BUILD = 'c70ab01c33';
const PREFIX = 'emberwing-';
const CACHE = PREFIX + BUILD;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const res = await fetch('./asset-manifest.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('asset-manifest.json ' + res.status);
    const { files } = await res.json();
    files.push('asset-manifest.json');                                    // the page reads the running build id from this copy
    const cache = await caches.open(CACHE);
    await Promise.all(files.map(async (f) => {
      const r = await fetch(new Request(f, { cache: 'reload' }));      // 'reload' skips the browser HTTP cache: never store a stale copy
      if (!r.ok) throw new Error(f + ' ' + r.status);
      await cache.put(f, r);
    }));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith(PREFIX) && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const nav = req.mode === 'navigate';
    const hit = await cache.match(nav ? './index.html' : req, { ignoreSearch: true });   // ?debug and ?startM still hit the cache
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok && !nav && url.pathname.startsWith(new URL('./', self.registration.scope).pathname)) cache.put(req, res.clone());
      return res;
    } catch (err) {
      return new Response('You are offline and this file was not saved yet.', { status: 503, statusText: 'Offline', headers: { 'Content-Type': 'text/plain' } });
    }
  })());
});
