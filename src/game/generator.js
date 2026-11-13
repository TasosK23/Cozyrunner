/**
 * generator.js — builds the course ahead of Bramble by stitching chunks together.
 *
 * The "difficulty director" works like music: tension, then release.
 *  - Target difficulty climbs with distance (+1 every 400 m, capped at 5), with a little jitter.
 *  - Every chunk adds its difficulty to a "heat" meter. When heat passes the limit, the next chunk
 *    is a BREATHER (calm seed trails, no hazards) and the heat cools to zero.
 *  - The first run follows a scripted tutorial order of chunks.
 *
 * Everything random comes from ONE seeded generator, consumed strictly in chunk order, so the same
 * seed always builds the exact same course (that's how the Daily Run will work in Stage 2).
 * Nothing here depends on how the player plays: only on distance.
 */
import { mulberry32 } from '../core/rng.js';
import { CHUNKS, CHUNK_BY_ID } from '../data/chunks.js';
import { DIRECTOR, SPAWN, UNITS_PER_METER } from '../data/balance.js';

const PLAYABLE = CHUNKS.filter((c) => !c.start);
const BREATHERS = PLAYABLE.filter((c) => c.diff === 0);

/** Order of chunks in the very first run (teaches jump, slide, jump-gap, glide). */
export const TUTORIAL_SCRIPT = [
  'start', 'lone-snail', 'breather-trail', 'lone-vine', 'breather-arcs', 'small-gap', 'breather-wave', 'long-gap',
];

export class Generator {
  /** @param world object with spawnHazard/spawnPickup/closeGround/openGround (see world.js) */
  constructor(world) {
    this.world = world;
    this.rng = mulberry32(1);
    this.cursor = 0;
    this.reset(1, false);
  }

  reset(seed, useScript) {
    this.rng = mulberry32(seed);
    this.cursor = 0;               // world x where the next chunk begins
    this.index = 0;
    this.heat = 0;
    this.recent = [];
    this.script = useScript ? TUTORIAL_SCRIPT.slice() : null;
    this.letterIdx = 0;
    this.lastLetterM = -999;
    this.chunkLog = [];            // ids in order (debug + tests)
  }

  /** Build chunks until the course reaches `upToX`. */
  ensure(upToX) {
    while (this.cursor < upToX) this._buildNext();
  }

  skipScript() { this.script = null; }

  _pick() {
    const m = this.cursor / UNITS_PER_METER;
    if (this.index === 0) return CHUNK_BY_ID.start;
    if (this.script && this.script.length) return CHUNK_BY_ID[this.script.shift()] || CHUNK_BY_ID['breather-trail'];
    this.script = null;

    const rng = this.rng;
    let breather = this.heat >= DIRECTOR.heatLimit;
    let pool;
    let target = 0;
    if (breather) {
      pool = BREATHERS;
      this.heat = 0;
    } else {
      target = Math.min(5, 1 + Math.floor(m / DIRECTOR.metersPerLevel));
      const j = rng();
      if (j < 0.25) target += 1; else if (j > 0.82) target -= 1;
      target = Math.max(1, Math.min(5, target));
      while (target > 1 && m < DIRECTOR.minMeters[target]) target--;
      pool = PLAYABLE.filter((c) => c.diff === target);
      if (!pool.length) pool = PLAYABLE.filter((c) => c.diff > 0 && c.diff <= target);
      this.heat += target;
    }
    let fresh = pool.filter((c) => !this.recent.includes(c.id));
    if (!fresh.length) fresh = pool;
    let total = 0;
    for (const c of fresh) total += c.w ?? 1;
    let r = rng() * total;
    for (const c of fresh) {
      r -= c.w ?? 1;
      if (r <= 0) return c;
    }
    return fresh[fresh.length - 1];
  }

  _buildNext() {
    const chunk = this._pick();
    const x0 = this.cursor;
    const w = this.world;
    this.chunkLog.push(chunk.id);

    for (const [x, gw] of chunk.gaps) {
      w.closeGround(x0 + x);
      w.spawnHazard('gap', x0 + x, x0 + x + gw);
      w.openGround(x0 + x + gw);
    }
    for (const [type, x] of chunk.hazards) w.spawnHazard(type, x0 + x);
    for (const pk of chunk.pickups) this._spawnPickup(pk, x0);

    this.recent.push(chunk.id);
    if (this.recent.length > 4) this.recent.shift();
    this.cursor += chunk.len;
    this.index++;
  }

  /** Decide what a pickup spot becomes. Rolls happen in a fixed order so seeds stay deterministic. */
  _spawnPickup(pk, x0) {
    let type = pk.t;
    const x = x0 + pk.x;
    const m = x / UNITS_PER_METER;
    if (type === 'slot') {
      const r = this.rng();
      let acc = m >= SPAWN.fireflyMinM ? SPAWN.fireflyChance : 0;
      if (r < acc) type = 'firefly';
      else if (r < (acc += SPAWN.teaChance)) type = 'tea';
      else if (r < (acc += SPAWN.letterChance) && m - this.lastLetterM >= SPAWN.letterMinGapM) type = 'letter';
      else if (r < (acc += SPAWN.lanternChance)) type = 'lantern';
      else type = 'seed';
    }
    if (type === 'letter') {
      this.world.spawnPickup('letter', x, pk.y, this.letterIdx);
      this.letterIdx = (this.letterIdx + 1) % 4;
      this.lastLetterM = m;
    } else {
      this.world.spawnPickup(type, x, pk.y, 0);
    }
  }
}
