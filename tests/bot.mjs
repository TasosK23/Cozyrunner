// Run:  node tests/bot.mjs [seedCount=4] [meters=2500]
// An autopilot plays the REAL game engine (world.js) using the solver's lookahead. If the course
// builder, gap geometry or chunk stitching ever creates an unfair spot, the bot gets bumped here.
import { Run } from '../src/game/world.js';
import { planAction } from '../src/game/solver.js';

const seeds = Number(process.argv[2] || 4);
const targetM = Number(process.argv[3] || 2500);
let bad = 0;

for (let seed = 1; seed <= seeds; seed++) {
  const run = new Run({ jump: true, slide: true, glide: true, done: true });
  run.reset(seed * 7919, { script: false, bestMeters: 0 });
  run.begin();
  let tick = 0, act = { press: false, hold: false, slide: false };
  const inp = { press: false, hold: false, slide: false };
  let lost = null;
  const t0 = Date.now();
  while (run.distM < targetM && run.state === 'running') {
    if (tick % 3 === 0) {
      const hz = run.hazards.filter((h) => h.active && h.type !== 'gap' && h.x1 > run.p.x - 40 && h.x0 < run.p.x + 900);
      const a = planAction({ hazards: hz, groundAt: run.groundFn }, run.p, run.speed || 250, 22);
      act = a || { press: false, hold: false, slide: false };
      if (!a && !lost) lost = `no safe plan at ${run.distM.toFixed(0)} m`;
    }
    const first = tick % 3 === 0;
    inp.press = first && act.press; inp.slide = first && act.slide; inp.hold = act.hold;
    run.update(1 / 60, inp);
    tick++;
    if (run.stats.hits > 0 && !lost) lost = `bumped at ${run.distM.toFixed(0)} m (chunks: ${run.gen.chunkLog.slice(-3).join(', ')})`;
  }
  const ok = !lost && run.stats.hits === 0;
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} seed ${seed * 7919}: ${run.distM.toFixed(0)} m, score ${run.score}, seeds ${run.seedsGot}, ` +
    `near-misses ${run.stats.nearMisses}, glide-gaps ${run.stats.glideGaps}/${run.stats.gaps}, ${run.gen.chunkLog.length} chunks, ${((Date.now() - t0) / 1000).toFixed(1)}s` +
    (lost ? `  <- ${lost}` : ''));
}
console.log(bad ? `\n${bad} run(s) hit trouble` : '\nBot cleared every course without a single bump.');
process.exit(bad ? 1 : 0);
