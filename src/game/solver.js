/**
 * solver.js — the "is this level beatable?" proof machine.
 *
 * How it works: we play the chunk with Bramble's REAL physics (physics.js), but instead of
 * one player we track EVERY state a player could be in. Every 0.05 s the player may choose:
 *   do nothing / tap (jump or glide) / keep holding the jump / swipe down.
 * We branch on all choices, throw away any branch that hits a hazard or falls, and merge
 * branches that look the same (same height, speed, flags). If at the end at least one branch
 * is standing on the ground, the chunk is beatable.
 *
 * Safety margins (so "beatable" means "beatable by a human", not "by a perfect machine"):
 *   - hazards are checked against Bramble's hitbox GROWN by `pad` units (the game shrinks it)
 *   - decisions are only allowed every 0.05 s
 *   - every chunk is tested at several speeds, including a few % faster/slower
 *   - CASUAL mode (default): the player may only tap, hold and slide on the ground. Expert tricks
 *     like fast-falling mid-air into a roll are NOT allowed to "rescue" a pattern.
 *
 * Because every chunk starts AND ends with "standing on the ground", chunks chain:
 * if each piece is beatable from grounded->grounded, any sequence of pieces is beatable.
 */
import { PLAYER, SIM, SPEED, HAZARDS } from '../data/balance.js';
import { makePlayer, copyPlayer, stepPlayer, playerBox, boxHitsHazard } from './physics.js';

const STEPS_PER_DECISION = 3;   // 3 x (1/60 s) = 0.05 s
const SOLVER_PAD = 5;
const MAX_STATES = 900;

const ACTIONS = [
  { press: false, hold: false, slide: false },   // 0: nothing
  { press: true,  hold: true,  slide: false },   // 1: tap (jump / glide) and hold
  { press: false, hold: true,  slide: false },   // 2: keep holding (higher jump)
  { press: false, hold: false, slide: true },    // 3: swipe down
];

/** Turn a chunk definition into collision data. */
export function chunkToCourse(chunk) {
  const hazards = [];
  for (const [type, x] of chunk.hazards) {
    if (type === 'snail') hazards.push({ type, x0: x, x1: x + HAZARDS.snail.w, y0: 0, y1: HAZARDS.snail.h });
    else if (type === 'vine') hazards.push({ type, x0: x, x1: x + HAZARDS.vine.w, y0: HAZARDS.vine.bottom, y1: HAZARDS.vine.top });
    else throw new Error(`unknown hazard ${type}`);
  }
  const gaps = chunk.gaps.map(([x, w]) => ({ x0: x, x1: x + w }));
  const pad = PLAYER.edgePad;
  const groundAt = (x) => {
    for (const g of gaps) if (x > g.x0 + pad && x < g.x1 - pad) return false;
    return true;
  };
  return { hazards, gaps, groundAt, endX: chunk.len };
}

function keyOf(s) {
  return (
    ((s.y / 5) | 0) + ',' + ((s.vy / 60) | 0) + ',' +
    (s.grounded ? 1 : 0) + (s.gliding ? 1 : 0) + (s.glideAvail ? 1 : 0) + (s.jumpCut ? 1 : 0) +
    (s.slideOnLand ? 1 : 0) + (s.jumpBuf > 0 ? 1 : 0) + ',' +
    ((s.coyote * 30) | 0) + ',' + ((s.glideT * 10) | 0) + ',' + ((s.slideT * 10) | 0)
  );
}

/** Standing on the ground, not mid-slide: the state every chunk must start and end in. */
export function isCanonical(s) {
  return s.grounded && s.slideT <= 0 && s.jumpBuf <= 0;
}

/**
 * Move every state in `frontier` forward by one decision (0.05 s), trying every allowed action.
 * Each surviving child remembers which ROOT action it descended from (`_root`) so the live
 * autopilot can pick a first move. Returns a de-duplicated array of surviving states.
 */
function advance(frontier, course, speed, pad, casual, box, inp) {
  const dt = SIM.dt;
  const next = new Map();
  for (const s of frontier) {
    for (let ai = 0; ai < ACTIONS.length; ai++) {
      if (ai === 2 && (s.grounded || !s.jumpCut)) continue;   // holding only matters mid-rise
      if (ai === 3 && !s.grounded && casual) continue;        // casual: no mid-air fast-fall tricks
      const t = copyPlayer({}, s);
      t._root = s._root;
      if (t._root === undefined) t._root = ai;
      let dead = false;
      for (let k = 0; k < STEPS_PER_DECISION && !dead; k++) {
        inp.press = k === 0 && ACTIONS[ai].press;
        inp.slide = k === 0 && ACTIONS[ai].slide;
        inp.hold = ACTIONS[ai].hold;
        stepPlayer(t, inp, dt, speed, course.groundAt);
        if (t.y < PLAYER.fallY) { dead = true; break; }
        playerBox(t, pad, box);
        for (const h of course.hazards) {
          if (boxHitsHazard(box, h)) { dead = true; break; }
        }
      }
      if (dead) continue;
      const key = keyOf(t);
      if (!next.has(key)) next.set(key, t);
    }
  }
  let out = [...next.values()];
  if (out.length > MAX_STATES) {            // keep an even spread, never random
    const stride = out.length / MAX_STATES;
    out = Array.from({ length: MAX_STATES }, (_, i) => out[Math.floor(i * stride)]);
  }
  return out;
}

/**
 * Search all possible plays of a course at a constant `speed`.
 * @returns {{ok:boolean, failX:number, reason:string, peak:number}}
 */
export function solveCourse(course, speed, opts = {}) {
  const pad = opts.pad ?? SOLVER_PAD;
  const casual = opts.casual ?? true;   // by default the player may NOT rely on fast-fall tech
  const inp = { press: false, hold: false, slide: false };
  const box = { x0: 0, x1: 0, y0: 0, y1: 0 };
  let frontier = [makePlayer(opts.startX ?? 0)];
  let peak = 1;

  while (frontier[0].x < course.endX) {
    const next = advance(frontier, course, speed, pad, casual, box, inp);
    if (next.length === 0) return { ok: false, failX: frontier[0].x, reason: 'no surviving plays', peak };
    frontier = next;
    if (frontier.length > peak) peak = frontier.length;
  }

  const ok = frontier.some(isCanonical);
  return { ok, failX: course.endX, reason: ok ? '' : 'cannot finish standing on the ground', peak };
}

/**
 * Autopilot brain: from a LIVE player state, look `decisions` moves ahead and return the best
 * first action {press, hold, slide} that still has a survivable future, or null if doomed.
 * Used by tests (and the debug autoplay) to prove the real game's courses are beatable end to end.
 */
export function planAction(course, state, speed, decisions = 24, opts = {}) {
  const pad = opts.pad ?? SOLVER_PAD;
  const inp = { press: false, hold: false, slide: false };
  const box = { x0: 0, x1: 0, y0: 0, y1: 0 };
  const root = copyPlayer({}, state);
  root._root = undefined;
  let frontier = [root];
  for (let d = 0; d < decisions; d++) {
    frontier = advance(frontier, course, speed, pad, true, box, inp);
    if (!frontier.length) return null;
  }
  const safe = new Set();
  const any = new Set();
  for (const s of frontier) { any.add(s._root); if (isCanonical(s)) safe.add(s._root); }
  const roots = safe.size ? safe : any;
  for (const a of [0, 3, 1, 2]) if (roots.has(a)) return ACTIONS[a];
  return null;
}

/** Speeds a chunk of a given difficulty can appear at, with margins. */
export function validationSpeeds() {
  const mid = (SPEED.start + SPEED.max) / 2;
  return [SPEED.start * 0.96, SPEED.start, mid, SPEED.max, SPEED.max * 1.04];
}

/** Structural rules + the solver at every speed. */
export function validateChunk(chunk) {
  const problems = [];
  const course = chunkToCourse(chunk);
  if (chunk.diff > 0 && chunk.hazards.length + chunk.gaps.length === 0) problems.push('difficulty>0 but no hazards');
  if (chunk.diff === 0 && chunk.hazards.length + chunk.gaps.length > 0) problems.push('breather has hazards');
  const firstX = Math.min(...[...course.hazards.map((h) => h.x0), ...course.gaps.map((g) => g.x0)], Infinity);
  if (firstX !== Infinity && firstX < 240) problems.push(`first hazard at ${firstX} < 240 (not enough warning)`);
  for (const h of course.hazards) if (h.x1 > chunk.len - 120) problems.push('hazard too close to chunk end');
  for (const g of course.gaps) if (g.x1 > chunk.len - 120) problems.push('gap too close to chunk end');
  for (const p of chunk.pickups) {
    if (p.x < 0 || p.x > chunk.len) problems.push(`pickup x out of range (${p.x})`);
    if (p.y < 0) problems.push('pickup below ground');
  }
  const perSpeed = [];
  for (const v of validationSpeeds()) {
    const r = solveCourse(course, v);
    perSpeed.push({ speed: Math.round(v), ...r });
    if (!r.ok) problems.push(`unbeatable at speed ${Math.round(v)} (${r.reason} near x=${Math.round(r.failX)})`);
  }
  return { id: chunk.id, ok: problems.length === 0, problems, perSpeed };
}
