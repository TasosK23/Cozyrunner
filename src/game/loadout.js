/**
 * loadout.js — turns "what the player owns" (upgrades + the equipped companion) into plain numbers
 * a run uses. Pure functions, no DOM: easy to test and to read.
 */
import { PLAYER } from '../data/balance.js';
import { UPGRADE_BY_ID, upgradeValue } from '../data/upgrades.js';
import { COMPANION_BY_ID, COMPANIONS } from '../data/companions.js';
import { levelInfo } from './progress.js';

export function defaultLoadout() {
  return {
    hearts: PLAYER.hearts, magnetR: 0, powerMul: 1, glideMul: 1, comboBonus: 0, slowAfterHit: 0,
    revealBonus: false, glowStart: 0, glowKeep: 1, chestLuck: 0, startBlanket: false, companion: '',
  };
}

/** @param data the save's data object */
export function buildLoadout(data) {
  const L = defaultLoadout();
  const up = data.upgrades || {};
  L.magnetR += upgradeValue(UPGRADE_BY_ID.magnet, up.magnet | 0);
  L.powerMul += (up.duration | 0) * UPGRADE_BY_ID.duration.per;
  L.hearts += (up.hearts | 0) * UPGRADE_BY_ID.hearts.per;
  L.glideMul += (up.glide | 0) * UPGRADE_BY_ID.glide.per;
  L.comboBonus += (up.combo | 0) * UPGRADE_BY_ID.combo.per;

  const id = data.companions && data.companions.equipped;
  const c = COMPANION_BY_ID[id];
  if (c && data.companions.owned && data.companions.owned[id]) {
    L.companion = id;
    const e = c.effect;
    if (e.hearts) L.hearts += e.hearts;
    if (e.glideMul) L.glideMul *= e.glideMul;
    if (e.magnetR) L.magnetR += e.magnetR;
    if (e.slowAfterHit) L.slowAfterHit = e.slowAfterHit;
    if (e.comboBonus) L.comboBonus += e.comboBonus;
    if (e.revealBonus) L.revealBonus = true;
    if (e.glowStart) L.glowStart = e.glowStart;
    if (e.glowKeep) L.glowKeep = e.glowKeep;
    if (e.chestLuck) L.chestLuck = e.chestLuck;
    if (e.startBlanket) L.startBlanket = true;
    if (e.powerMul) L.powerMul *= e.powerMul;
  }
  L.hearts = Math.min(PLAYER.maxHearts, L.hearts);
  return L;
}

/** How far a companion's unlock is: {cur, target, pct, done}. */
export function companionProgress(data, comp) {
  const st = data.stats || {};
  const { metric, target } = comp.unlock;
  let cur = 0;
  switch (metric) {
    case 'totalSeeds': cur = st.totalSeeds | 0; break;
    case 'totalDistance': cur = st.totalDistance | 0; break;
    case 'glideGaps': cur = st.glideGaps | 0; break;
    case 'nearMisses': cur = st.nearMisses | 0; break;
    case 'bestCombo': cur = st.bestCombo | 0; break;
    case 'lanterns': cur = st.lanterns | 0; break;
    case 'fireflies': cur = st.fireflies | 0; break;
    case 'chestsOpened': cur = (data.chests && data.chests.opened) | 0; break;
    case 'level': cur = levelInfo(data.xp | 0).level; break;
    default: cur = 0;
  }
  const c = Math.min(cur, target);
  return { cur: c, target, pct: target > 0 ? c / target : 1, done: cur >= target };
}

/** The locked companion that is closest to unlocking (shown on the game-over screen), or null. */
export function nextCompanion(data) {
  let best = null;
  for (const c of COMPANIONS) {
    if (data.companions && data.companions.owned && data.companions.owned[c.id]) continue;
    const pr = companionProgress(data, c);
    if (!best || pr.pct > best.pr.pct) best = { comp: c, pr };
  }
  return best;
}

/** Unlock every companion whose goal is met. Returns the list of newly unlocked ones. */
export function unlockEarned(data) {
  const out = [];
  for (const c of COMPANIONS) {
    if (data.companions.owned[c.id]) continue;
    if (companionProgress(data, c).done) {
      data.companions.owned[c.id] = true;
      if (!data.companions.equipped) data.companions.equipped = c.id;
      out.push(c);
    }
  }
  return out;
}
