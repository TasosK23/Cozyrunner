/**
 * save.js — the versioned, crash-proof save file.
 *
 * Rules:
 *  - The save is one JSON blob under one localStorage key, with a `v` (version) number.
 *  - Loading NEVER throws: bad JSON, wrong types, missing fields -> we repair with defaults.
 *  - To change the format later: bump VERSION and add a function to MIGRATIONS that
 *    upgrades a (version N) object to (version N+1). Old saves then upgrade automatically.
 */
import { storage } from './storage.js';

export const SAVE_KEY = 'lanternfold.save';
export const VERSION = 1;

export function defaultSave() {
  return {
    v: VERSION,
    createdAt: Date.now(),
    best: { distance: 0, score: 0, combo: 0, seeds: 0, seconds: 0 },
    seedsBank: 0,                 // spendable currency (upgrades arrive in Stage 2)
    xp: 0,                        // profile XP -> level
    stats: {
      runs: 0, totalDistance: 0, totalSeeds: 0, totalSeconds: 0,
      lanterns: 0, fireflies: 0, words: 0, nearMisses: 0, glideGaps: 0, gaps: 0, hits: 0,
      bestCombo: 0, longestRun: 0,
    },
    tutorial: { jump: false, slide: false, glide: false, done: false },
    settings: { haptics: true },
  };
}

/**
 * Copy values from `raw` onto a fresh `template`, keeping only keys the template knows
 * and only values whose type matches. Anything weird is silently ignored.
 */
function repair(template, raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return template;
  for (const key of Object.keys(template)) {
    const want = template[key];
    const got = raw[key];
    if (got === undefined) continue;
    if (want !== null && typeof want === 'object' && !Array.isArray(want)) {
      template[key] = repair(want, got);
    } else if (typeof want === 'number') {
      if (typeof got === 'number' && Number.isFinite(got)) template[key] = Math.max(-1e12, Math.min(1e12, got));
    } else if (typeof want === typeof got) {
      template[key] = got;
    }
  }
  return template;
}

/** MIGRATIONS[n] upgrades a version-n save object to version n+1. (None needed yet.) */
const MIGRATIONS = {
  // 1: (s) => { s.newThing = 0; s.v = 2; return s; },
};

function migrate(raw) {
  let s = raw;
  let guard = 0;
  while (s && typeof s.v === 'number' && s.v < VERSION && MIGRATIONS[s.v] && guard++ < 50) {
    try { s = MIGRATIONS[s.v](s); } catch (_) { break; }
  }
  return s;
}

/** Parse + migrate + repair. Always returns a valid save object. */
export function parseSave(text) {
  try {
    const raw = JSON.parse(text);
    if (!raw || typeof raw !== 'object') return defaultSave();
    return repair(defaultSave(), migrate(raw));
  } catch (_) {
    return defaultSave();
  }
}

export class SaveStore {
  constructor() {
    this.data = defaultSave();
    this.persistent = storage.persistent;
    this._timer = 0;
  }

  load() {
    const text = storage.get(SAVE_KEY);
    this.data = text ? parseSave(text) : defaultSave();
    return this.data;
  }

  /** Write now. */
  commit() {
    clearTimeout(this._timer);
    this._timer = 0;
    try {
      this.persistent = storage.set(SAVE_KEY, JSON.stringify(this.data));
    } catch (_) { this.persistent = false; }
    return this.persistent;
  }

  /** Write soon (coalesces rapid changes). */
  commitSoon(ms = 400) {
    if (this._timer) return;
    this._timer = setTimeout(() => this.commit(), ms);
  }

  reset() {
    this.data = defaultSave();
    this.commit();
  }

  /** Copy/paste text code for backups: "LF1." + base64(json) + "." + checksum. */
  exportCode() {
    const json = JSON.stringify(this.data);
    return `LF${VERSION}.${toBase64(json)}.${checksum(json)}`;
  }

  /** @returns {boolean} true if the code was valid and applied. */
  importCode(code) {
    try {
      const parts = String(code).trim().split('.');
      if (parts.length !== 3 || !parts[0].startsWith('LF')) return false;
      const json = fromBase64(parts[1]);
      if (checksum(json) !== parts[2]) return false;
      this.data = parseSave(json);
      this.commit();
      return true;
    } catch (_) {
      return false;
    }
  }
}

function toBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
function fromBase64(b64) {
  return decodeURIComponent(escape(atob(b64)));
}
function checksum(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
