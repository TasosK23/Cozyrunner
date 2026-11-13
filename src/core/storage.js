/**
 * storage.js — a localStorage wrapper that can never throw.
 * If storage is disabled (private mode, blocked cookies, quota full) we silently fall back
 * to in-memory storage so the game still works for the session.
 */
let backend = null;
try {
  const probe = '__lf_probe__';
  window.localStorage.setItem(probe, '1');
  window.localStorage.removeItem(probe);
  backend = window.localStorage;
} catch (_) {
  backend = null;
}

const memory = new Map();

export const storage = {
  /** true when data really persists between visits */
  get persistent() { return backend !== null; },

  get(key) {
    try {
      if (backend) return backend.getItem(key);
    } catch (_) { /* fall through to memory */ }
    return memory.has(key) ? memory.get(key) : null;
  },

  /** @returns {boolean} true if the value was stored durably */
  set(key, value) {
    memory.set(key, value);
    try {
      if (backend) { backend.setItem(key, value); return true; }
    } catch (_) { /* quota or blocked */ }
    return false;
  },

  remove(key) {
    memory.delete(key);
    try { if (backend) backend.removeItem(key); } catch (_) { /* ignore */ }
  },
};
