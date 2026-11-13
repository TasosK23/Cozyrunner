/**
 * tutorial.js — learn-by-playing hints. No walls of text: when the first unlearned kind of hazard
 * is about to arrive, a small bubble tells you what to do. Each hint disappears for good once you've
 * passed that kind of hazard (see Run._taught). "Skip tips" turns them all off.
 */
const HINT_RANGE = 460;   // show the hint when the hazard is this far ahead (units)

/** Sets run.hintKey to 'jump' | 'slide' | 'glide' | '' for the HUD to draw. */
export function updateHints(run) {
  const tut = run.tut;
  if (tut.done) { run.hintKey = ''; return; }
  const px = run.p.x;
  let best = null;
  for (let i = 0; i < run.hazards.length; i++) {
    const h = run.hazards[i];
    if (!h.active || h.passed) continue;
    if (tut[h.hint]) continue;              // already learned this one
    const ahead = h.x0 - px;
    if (ahead > HINT_RANGE || ahead < -40) continue;
    if (!best || h.x0 < best.x0) best = h;
  }
  run.hintKey = best ? best.hint : '';
}
