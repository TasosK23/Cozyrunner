/**
 * daily.js — the Daily Run (same course for everyone that day) and its gentle streak.
 *
 * Streak rules, kind on purpose:
 *   - finishing a Daily Run on consecutive days grows the streak
 *   - missing ONE day is forgiven by a free "streak freeze" (one refills every week)
 *   - missing more just restarts the streak at 1: nothing is taken away, no shame
 */
import { hashString } from '../core/rng.js';
import { dayKey, weekKey, daysBetween } from '../core/clock.js';
import { DAILY } from '../data/balance.js';

export function dailySeed(day) { return hashString(`lanternfold|daily|${day}`) || 1; }

/** Refill the weekly freeze if a new week started. */
function refreshFreeze(d, now) {
  const wk = weekKey(now);
  if (d.freezeWeek !== wk) { d.freezeWeek = wk; d.freezes = DAILY.freezesPerWeek; }
}

export function dailyStatus(data, now) {
  const d = data.daily;
  const today = dayKey(now);
  const playedToday = d.lastDay === today;
  let atRisk = false;
  if (!playedToday && d.streak > 0 && d.lastDay) atRisk = daysBetween(d.lastDay, today) === 1;
  const freezes = d.freezeWeek === weekKey(now) ? d.freezes : DAILY.freezesPerWeek;
  return {
    today, playedToday, best: d.date === today ? d.best : 0, streak: playedToday || atRisk ? d.streak : (d.lastDay && daysBetween(d.lastDay, today) === 2 && freezes > 0 ? d.streak : 0),
    atRisk, freezes,
  };
}

/**
 * Record a finished Daily Run.
 * @returns {{first:boolean, streak:number, usedFreeze:boolean, bonusSeeds:number, newBest:boolean, chest:boolean}}
 */
export function recordDaily(data, summary, now) {
  const d = data.daily;
  const today = dayKey(now);
  refreshFreeze(d, now);
  if (d.date !== today) { d.date = today; d.best = 0; d.bestScore = 0; d.plays = 0; }
  const out = { first: false, streak: d.streak, usedFreeze: false, bonusSeeds: 0, newBest: false, chest: false };
  d.plays++;
  if (summary.distM > d.best) { d.best = summary.distM; out.newBest = d.plays > 1 || summary.distM > 0; }
  if (summary.score > d.bestScore) d.bestScore = summary.score;
  if (d.lastDay !== today) {
    out.first = true;
    const gap = d.lastDay ? daysBetween(d.lastDay, today) : 0;
    if (!d.lastDay) d.streak = 1;
    else if (gap === 1) d.streak++;
    else if (gap === 2 && d.freezes > 0) { d.freezes--; d.streak++; out.usedFreeze = true; }
    else d.streak = 1;
    d.lastDay = today;
    if (d.streak > d.bestStreak) d.bestStreak = d.streak;
    out.bonusSeeds = DAILY.bonusSeeds;
    data.seedsBank += out.bonusSeeds;
    data.stats.dailyRuns++;
    if (!data.chests) data.chests = { pity: 0, opened: 0, pending: 0 };
    data.chests.pending++;
    out.chest = true;
  }
  out.streak = d.streak;
  return out;
}
