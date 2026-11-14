/**
 * quests.js — daily quests (3, with one free reroll a day) and the weekly challenge.
 * Pure data logic on the save object: no DOM. Quests are generated from the date, so they are the same
 * on every device that day, and nothing here ever punishes a missed day: old quests just refresh.
 */
import { mulberry32, hashString } from '../core/rng.js';
import { dayKey, weekKey } from '../core/clock.js';
import { QUESTS, QUEST_BY_ID, WEEKLY, WEEKLY_BY_ID } from '../data/quests.js';
import { levelInfo } from './progress.js';

export const QUEST_XP = 20;

const tierFor = (level) => (level < 4 ? 0 : level < 9 ? 1 : 2);

function eligible(data, avoid) {
  const best = data.best.distance + 150;
  return QUESTS.filter((q) => (q.minBest || 0) <= best && !avoid.has(q.metric));
}

function makeQuest(tpl, tier) { return { t: tpl.id, i: tier, p: 0, done: false }; }

/** Make sure today's quests and this week's challenge exist. Returns true if anything was (re)generated. */
export function ensureQuests(data, now) {
  let changed = false;
  const today = dayKey(now);
  const q = data.quests;
  // sanitize whatever was loaded (arrays aren't deep-checked by the save repair)
  q.list = (Array.isArray(q.list) ? q.list : []).filter((e) => e && QUEST_BY_ID[e.t]).map((e) => ({
    t: e.t, i: Math.max(0, Math.min(2, e.i | 0)), p: Math.max(0, +e.p || 0), done: !!e.done,
  }));
  if (q.day !== today || q.list.length !== 3) {
    const rng = mulberry32(hashString(`${today}|quests`));
    const tier = tierFor(levelInfo(data.xp).level);
    const used = new Set();
    const list = [];
    for (let n = 0; n < 3; n++) {
      const pool = eligible(data, used);
      const pick = pool[Math.floor(rng() * pool.length)];
      used.add(pick.metric);
      list.push(makeQuest(pick, tier));
    }
    q.day = today; q.list = list; q.rerolled = false;
    changed = true;
  }
  const wk = weekKey(now);
  const w = data.weekly;
  if (w.week !== wk || !WEEKLY_BY_ID[w.id]) {
    const rng = mulberry32(hashString(`${wk}|weekly`));
    const tpl = WEEKLY[Math.floor(rng() * WEEKLY.length)];
    data.weekly = { week: wk, id: tpl.id, progress: 0, target: tpl.target, claimed: false };
    changed = true;
  }
  return changed;
}

/** Text, numbers for a quest entry. */
export function describeQuest(entry) {
  const tpl = QUEST_BY_ID[entry.t];
  const target = tpl.targets[entry.i];
  return { text: tpl.text.replace('{n}', target), target, reward: tpl.reward[entry.i], progress: Math.min(entry.p, target), done: entry.done, id: tpl.id };
}

export function describeWeekly(data) {
  const tpl = WEEKLY_BY_ID[data.weekly.id];
  if (!tpl) return null;
  return { text: tpl.text.replace('{n}', tpl.target.toLocaleString('en-US')), target: tpl.target, reward: tpl.reward,
    progress: Math.min(data.weekly.progress, tpl.target), done: data.weekly.progress >= tpl.target, claimed: data.weekly.claimed };
}

/**
 * Feed a finished run into the quests. Rewards are paid immediately.
 * @returns {{completed: Array<{text:string, reward:number}>, weekly: null | {text:string, reward:number}}}
 */
export function applyRunToQuests(data, summary) {
  const completed = [];
  for (const e of data.quests.list) {
    if (e.done) continue;
    const tpl = QUEST_BY_ID[e.t];
    const v = +summary[tpl.metric] || 0;
    e.p = tpl.scope === 'max' ? Math.max(e.p, v) : e.p + v;
    if (e.p >= tpl.targets[e.i]) {
      e.done = true;
      const reward = tpl.reward[e.i];
      data.seedsBank += reward;
      data.xp += QUEST_XP;
      completed.push({ text: describeQuest(e).text, reward });
    }
  }
  let weekly = null;
  const w = data.weekly;
  const wt = WEEKLY_BY_ID[w.id];
  if (wt && !w.claimed) {
    w.progress += +summary[wt.metric] || 0;
    if (w.progress >= wt.target) {
      w.claimed = true;
      data.seedsBank += wt.reward;
      data.chests.pending++;
      weekly = { text: wt.text.replace('{n}', wt.target.toLocaleString('en-US')), reward: wt.reward };
    }
  }
  return { completed, weekly };
}

/** One free swap per day: replace an unfinished quest with a different one. */
export function rerollQuest(data, index, now) {
  const q = data.quests;
  const e = q.list[index];
  if (!e || e.done || q.rerolled) return false;
  const used = new Set(q.list.map((x) => QUEST_BY_ID[x.t].metric));
  used.delete(QUEST_BY_ID[e.t].metric);
  const pool = eligible(data, used).filter((tpl) => tpl.id !== e.t);
  if (!pool.length) return false;
  const rng = mulberry32(hashString(`${dayKey(now)}|reroll|${index}`));
  const pick = pool[Math.floor(rng() * pool.length)];
  q.list[index] = makeQuest(pick, tierFor(levelInfo(data.xp).level));
  q.rerolled = true;
  return true;
}
