/**
 * clock.js — "what day is it?" in one place, so tests (and the debug panel) can pretend it is
 * another day without touching the real clock. Days are the player's LOCAL calendar days.
 */
let offset = 0;

export const clock = {
  now() { return Date.now() + offset; },
  /** Pretend it is `ms` right now (tests / debug). */
  set(ms) { offset = ms - Date.now(); },
  shiftDays(d) { offset += d * 86400000; },
  reset() { offset = 0; },
};

const pad = (n) => String(n).padStart(2, '0');

/** "2026-11-14" */
export function dayKey(ms = clock.now()) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDay(key) {
  const [y, m, d] = String(key).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);   // noon avoids daylight-saving edge cases
}

/** Whole days from key a to key b (b - a). */
export function daysBetween(a, b) {
  return Math.round((parseDay(b) - parseDay(a)) / 86400000);
}

/** ISO week, e.g. "2026-W46". Weeks start on Monday. */
export function weekKey(ms = clock.now()) {
  const d = new Date(ms);
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);              // the Thursday of this week
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${pad(week)}`;
}
