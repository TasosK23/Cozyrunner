/**
 * achievements.js — the trophy engine and cosmetic unlocks. Pure functions over the save object (no DOM).
 *
 *  - readMetric(d, name, live)      the current number a trophy is measured by
 *  - achievementProgress(d, a, live) {cur, target, pct, done}
 *  - evaluateAchievements(d, now, live)  unlock whatever is newly earned, pay the embers, return the list
 *      `live` (optional) is the run in progress: {distM, bestMult, seconds, seeds, hits, biomeCount}.
 *      With `live` only trophies flagged `live:true` are considered, so they can pop up mid-flight.
 *  - syncCosmetics(d)               own every look whose unlock condition is now met, return the new ones
 */
import { ACHIEVEMENTS, TIER } from '../data/achievements.js';
import { COSMETICS, COSMETIC_BY_ID } from '../data/cosmetics.js';
import { COMPANIONS } from '../data/companions.js';
import { UPGRADES } from '../data/upgrades.js';
import { levelInfo } from './progress.js';

export function readMetric(d, name, live = null) {
  const st = d.stats;
  switch (name) {
    case 'bestDistance': return Math.max(d.best.distance, live ? live.distM : 0);
    case 'bestCombo': return Math.max(st.bestCombo, live ? live.bestMult : 0);
    case 'bestSeconds': return Math.max(d.best.seconds, live ? live.seconds : 0);
    case 'bestSeeds': return Math.max(d.best.seeds, live ? live.seeds : 0);
    case 'cleanBest': return Math.max(st.cleanBest | 0, live && live.hits === 0 ? live.distM : 0);
    case 'biomesSeen': return Math.max(d.seenBiomes.length, live ? live.biomeCount : 0);
    case 'level': return levelInfo(d.xp).level;
    case 'eggs': return d.chests.opened | 0;
    case 'companions': return COMPANIONS.reduce((n, c) => n + (d.companions.owned[c.id] ? 1 : 0), 0);
    case 'upgradeLevels': return UPGRADES.reduce((n, u) => n + (d.upgrades[u.id] | 0), 0);
    case 'upgradesMaxed': return UPGRADES.reduce((n, u) => n + ((d.upgrades[u.id] | 0) >= u.max ? 1 : 0), 0);
    case 'bestStreak': return Math.max(d.daily.bestStreak | 0, d.daily.streak | 0);
    default: return st[name] | 0;
  }
}

export function achievementProgress(d, a, live = null) {
  const done = d.achievements[a.id] > 0;
  const cur = done ? a.target : Math.min(a.target, readMetric(d, a.metric, live));
  return { cur, target: a.target, pct: a.target > 0 ? cur / a.target : 1, done };
}

export function evaluateAchievements(d, now = Date.now(), live = null) {
  const out = [];
  for (const a of ACHIEVEMENTS) {
    if (d.achievements[a.id] > 0) continue;
    if (live && !a.live) continue;
    if (readMetric(d, a.metric, live) >= a.target) {
      d.achievements[a.id] = now > 0 ? now : 1;
      d.seedsBank += TIER[a.tier].embers;
      out.push(a);
    }
  }
  return out;
}

/** Is this look's unlock condition met right now? (Egg-only looks never are; the egg grants them.) */
export function lookUnlocked(d, c) {
  const u = c.unlock;
  if (u.default) return true;
  if (u.ach) return d.achievements[u.ach] > 0;
  if (u.level) return levelInfo(d.xp).level >= u.level;
  return false;
}

export function syncCosmetics(d) {
  const fresh = [];
  for (const c of COSMETICS) {
    if (d.cosmetics.owned[c.id]) continue;
    if (lookUnlocked(d, c)) { d.cosmetics.owned[c.id] = true; d.cosmetics.seen[c.id] = false; fresh.push(c); }
  }
  return fresh;
}

/** Human text for how a look is earned ("Earn the trophy Keep Breaker", "Reach rank 5", "Hatch it from a dragon egg"). */
export function unlockText(c, achById) {
  const u = c.unlock;
  if (u.default) return 'Yours from the start';
  if (u.ach) { const a = achById[u.ach]; return a ? `Trophy: ${a.name}` : 'A trophy'; }
  if (u.level) return `Reach rank ${u.level}`;
  return 'Found in dragon eggs';
}

/** Equip a look if it is owned. Returns true if it changed. */
export function equipLook(d, id) {
  const c = COSMETIC_BY_ID[id];
  if (!c || !d.cosmetics.owned[id]) return false;
  if (d.cosmetics.equipped[c.slot] === id) return false;
  d.cosmetics.equipped[c.slot] = id;
  return true;
}
