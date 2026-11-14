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
import { COMPANIONS } from '../data/companions.js';
import { UPGRADES } from '../data/upgrades.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { COSMETICS, COSMETIC_BY_ID, DEFAULT_LOOK, SLOTS } from '../data/cosmetics.js';

export const SAVE_KEY = 'lanternfold.save';
export const VERSION = 3;

export function defaultSave() {
  return {
    v: VERSION,
    createdAt: Date.now(),
    best: { distance: 0, score: 0, combo: 0, seeds: 0, seconds: 0 },
    seedsBank: 0,                 // spendable currency (upgrades, Stage 2)
    xp: 0,                        // profile XP -> level
    stats: {
      runs: 0, totalDistance: 0, totalSeeds: 0, totalSeconds: 0,
      lanterns: 0, fireflies: 0, words: 0, nearMisses: 0, glideGaps: 0, gaps: 0, hits: 0,
      bestCombo: 0, longestRun: 0, cleanBest: 0,
      powerups: 0, vinesSlid: 0, bounces: 0, perfectBeats: 0, festivals: 0, biomesSeen: 0, surprises: 0, dailyRuns: 0,
      runsByCompanion: Object.fromEntries(COMPANIONS.map((c) => [c.id, 0])),
    },
    tutorial: { jump: false, slide: false, glide: false, done: false },
    settings: {
      haptics: true, music: true, sfx: true, musicVol: 0.7, sfxVol: 0.9,
      shake: true, reducedMotion: false, breakReminder: true,
      flashes: true,            // false = no white screen flashes
      highContrast: false,      // bright outlines on hazards + pickups, calmer backdrop
      largeText: false,         // bigger HUD and menu text
      leftHanded: false,        // pause button and menu chips on the left
      tapSlide: false,          // tap the lower part of the screen to slide (no swipe needed)
      gentle: false,            // forgiving mode: one extra heart (not used on the Daily Run)
      quality: 'auto',          // auto | high | medium | low
      showFps: false,
    },
    achievements: Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, 0])),   // id -> time unlocked (0 = locked)
    cosmetics: {
      owned: Object.fromEntries(COSMETICS.map((c) => [c.id, !!c.unlock.default])),
      seen: Object.fromEntries(COSMETICS.map((c) => [c.id, !!c.unlock.default])),   // "NEW" badge cleared once looked at
      equipped: { ...DEFAULT_LOOK },
    },
    upgrades: Object.fromEntries(UPGRADES.map((u) => [u.id, 0])),
    companions: {
      owned: Object.fromEntries(COMPANIONS.map((c) => [c.id, false])),
      seen: Object.fromEntries(COMPANIONS.map((c) => [c.id, false])),   // "NEW" badge cleared once looked at
      equipped: '',
    },
    quests: { day: '', list: [], rerolled: false },                       // 3 daily quests (see game/quests.js)
    weekly: { week: '', id: '', progress: 0, target: 0, claimed: false },
    daily: { date: '', best: 0, bestScore: 0, plays: 0, streak: 0, bestStreak: 0, lastDay: '', freezes: 1, freezeWeek: '', bonusDay: '' },
    chests: { pity: 0, opened: 0, pending: 0 },
    seenBiomes: [],                // biome ids the player has visited (for trophies)
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
      if (typeof got === 'number' && Number.isFinite(got)) template[key] = Math.max(-1e13, Math.min(1e13, got));
    } else if (Array.isArray(want)) {
      if (Array.isArray(got)) template[key] = got;
    } else if (typeof want === typeof got) {
      template[key] = got;
    }
  }
  return template;
}

/** MIGRATIONS[n] upgrades a version-n save object to version n+1. (None needed yet.) */
const MIGRATIONS = {
  // v2 -> v3 (Stage 3): trophies, wardrobe and the accessibility settings arrive with their defaults.
  2: (s) => { s.v = 3; return s; },
  // v1 -> v2 (Stage 2): everything new is added by the repair step's defaults; nothing to convert.
  1: (s) => { s.v = 2; return s; },
};

function migrate(raw) {
  let s = raw;
  let guard = 0;
  while (s && typeof s.v === 'number' && s.v < VERSION && MIGRATIONS[s.v] && guard++ < 50) {
    try { s = MIGRATIONS[s.v](s); } catch (_) { break; }
  }
  return s;
}

/** Final sanity pass: equipped looks must exist and be owned; the quality setting must be a known word. */
function sanitize(d) {
  for (const slot of SLOTS) {
    const id = d.cosmetics.equipped[slot.id];
    const c = COSMETIC_BY_ID[id];
    if (!c || c.slot !== slot.id || !d.cosmetics.owned[id]) d.cosmetics.equipped[slot.id] = DEFAULT_LOOK[slot.id];
  }
  if (!['auto', 'high', 'medium', 'low'].includes(d.settings.quality)) d.settings.quality = 'auto';
  d.v = VERSION;
  return d;
}

/** Parse + migrate + repair. Always returns a valid save object. */
export function parseSave(text) {
  try {
    const raw = JSON.parse(text);
    if (!raw || typeof raw !== 'object') return defaultSave();
    return sanitize(repair(defaultSave(), migrate(raw)));
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

  /** Copy/paste text code for backups: "EW3." + base64(json) + "." + checksum. */
  exportCode() {
    const json = JSON.stringify(this.data);
    return `EW${VERSION}.${toBase64(json)}.${checksum(json)}`;
  }

  /** @returns {boolean} true if the code was valid and applied. */
  importCode(code) {
    try {
      const parts = String(code).trim().split('.');
      if (parts.length !== 3 || !(parts[0].startsWith('EW') || parts[0].startsWith('LF'))) return false;
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
