/**
 * progress.js — profile XP and levels.
 * Level 1 -> 2 needs 100 XP, then each level needs 50 more than the last (100, 150, 200 ...).
 * Early levels come fast (a good first run is most of one), later ones stretch out gently.
 */
import { XP } from '../data/balance.js';

export function xpForRun(distMeters, seeds) {
  return Math.round(distMeters * XP.perMeter + seeds * XP.perSeed + XP.perRun);
}

/** @returns {{level:number, into:number, need:number, pct:number}} */
export function levelInfo(totalXp) {
  let level = 1;
  let need = XP.level1;
  let rem = Math.max(0, totalXp);
  while (rem >= need && level < 999) {
    rem -= need;
    level++;
    need = XP.level1 + XP.perLevelGrowth * (level - 1);
  }
  return { level, into: rem, need, pct: need > 0 ? rem / need : 0 };
}
