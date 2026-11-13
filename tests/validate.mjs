// Run:  node tests/validate.mjs
// Proves every hand-authored chunk is beatable (see src/game/solver.js) and checks basic structure.
import { CHUNKS } from '../src/data/chunks.js';
import { validateChunk } from '../src/game/solver.js';

let failed = 0;
const t0 = Date.now();
const ids = new Set();
console.log(`Validating ${CHUNKS.length} chunks...\n`);
for (const c of CHUNKS) {
  if (ids.has(c.id)) { console.log(`FAIL ${c.id}: duplicate id`); failed++; }
  ids.add(c.id);
  const r = validateChunk(c);
  const tag = r.ok ? 'ok  ' : 'FAIL';
  console.log(`${tag} d${c.diff} ${c.id.padEnd(18)} len ${String(c.len).padStart(4)}  speeds: ${r.perSpeed.map((s) => (s.ok ? 'o' : 'X')).join('')}`);
  for (const p of r.problems) console.log(`       - ${p}`);
  if (!r.ok) failed++;
}
const playable = CHUNKS.filter((c) => !c.start);
const byDiff = {};
for (const c of playable) byDiff[c.diff] = (byDiff[c.diff] || 0) + 1;
console.log(`\n${CHUNKS.length} chunks, by difficulty:`, byDiff, `(${Date.now() - t0} ms)`);
if (CHUNKS.length < 20) { console.log('FAIL: fewer than 20 chunks'); failed++; }
console.log(failed ? `\n${failed} problem(s)` : '\nAll chunks beatable.');
process.exit(failed ? 1 : 0);
