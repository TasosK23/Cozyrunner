/**
 * pwa.js — installability + offline: registers the service worker (sw.js), tracks "offline ready" and
 * "update waiting", and wraps the browser's install prompt. The game never depends on any of it: if service
 * workers are missing (old browser, private mode, file://) everything simply stays online-only.
 *
 * Update flow: a new version downloads in the background and WAITS (we never swap code in the middle of a run).
 * Settings shows "Update ready"; tapping it tells the waiting worker to take over and the page reloads once.
 */
const listeners = new Set();
let reg = null;
let installEvt = null;
let hadController = false;
let reloading = false;

export const pwa = {
  state: {
    supported: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
    registered: false,       // service worker registered
    offlineReady: false,     // every game file is in the cache
    files: 0,                // how many files are cached
    cache: '',               // cache name (carries the build id)
    version: '',             // build id from asset-manifest.json
    waiting: false,          // a newer version is downloaded and waiting
    checking: false,
    error: '',
  },

  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  _emit() { for (const f of listeners) { try { f(); } catch (_) { /* a listener must never break the game */ } } },

  get standalone() {
    try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (_) { return false; }
  },
  get ios() {
    const ua = navigator.userAgent || '';
    return /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  },
  get canInstall() { return !!installEvt && !pwa.standalone; },

  async install() {
    if (!installEvt) return 'unavailable';
    const e = installEvt;
    installEvt = null;
    try { e.prompt(); const r = await e.userChoice; pwa._emit(); return r && r.outcome; } catch (_) { pwa._emit(); return 'error'; }
  },

  async init() {
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; pwa._emit(); });
    window.addEventListener('appinstalled', () => { installEvt = null; pwa._emit(); });
    const s = pwa.state;
    if (!s.supported) return;
    hadController = !!navigator.serviceWorker.controller;
    try {
      reg = await navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' });
    } catch (e) {
      s.error = String((e && e.message) || e);
      pwa._emit();
      return;
    }
    s.registered = true;
    const watch = (sw) => {
      if (!sw) return;
      sw.addEventListener('statechange', () => {
        if (sw.state === 'installed' && navigator.serviceWorker.controller) { s.waiting = true; pwa._emit(); }
        if (sw.state === 'activated') pwa.refresh();
      });
    };
    if (reg.waiting && navigator.serviceWorker.controller) s.waiting = true;
    watch(reg.installing);
    reg.addEventListener('updatefound', () => watch(reg.installing));
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController) { hadController = true; pwa.refresh(); return; }   // first install claiming the page: nothing to reload
      if (reloading) return;
      reloading = true;
      location.reload();
    });
    navigator.serviceWorker.ready.then(() => pwa.refresh()).catch(() => {});
    document.addEventListener('visibilitychange', () => { if (!document.hidden) pwa.checkUpdate(true); });
    pwa._emit();
  },

  /** Re-read the cache + build id (cheap). */
  async refresh() {
    const s = pwa.state;
    try {
      if (typeof caches !== 'undefined') {
        const names = (await caches.keys()).filter((k) => k.startsWith('emberwing-'));
        s.cache = names.sort().pop() || '';
        if (s.cache) { const c = await caches.open(s.cache); s.files = (await c.keys()).length; }
        s.offlineReady = !!s.cache && s.files > 5 && !!navigator.serviceWorker.controller;
      }
      const r = await fetch('./asset-manifest.json', { cache: 'no-store' });
      if (r.ok) { const m = await r.json(); s.version = m.version || ''; }
    } catch (_) { /* offline or no manifest: fine */ }
    pwa._emit();
  },

  /** @returns 'ready' | 'current' | 'offline' | 'unsupported' */
  async checkUpdate(quiet = false) {
    if (!reg) return 'unsupported';
    const s = pwa.state;
    if (!quiet) { s.checking = true; pwa._emit(); }
    let res = 'current';
    try { await reg.update(); } catch (_) { res = 'offline'; }
    if (reg.waiting && navigator.serviceWorker.controller) { s.waiting = true; res = 'ready'; }
    s.checking = false;
    pwa._emit();
    return res;
  },

  /** Tell the waiting worker to take over; the page reloads itself when it has. */
  applyUpdate() {
    if (reg && reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
  },
};
