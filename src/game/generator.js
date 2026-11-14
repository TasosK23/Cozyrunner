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
import { DIRECTOR, SPAWN, UNITS_PER_METER, BIOME, FESTIVAL, EVENTS, HAZARDS } from '../data/balance.js';
import { BIOME_ORDER, biomeIndexAt } from '../data/biomes.js';
import { POWER_ORDER } from '../data/powerups.js';

const PLAYABLE = CHUNKS.filter((c) => !c.start && !c.special);

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

  reset(seed, useScript, startX = 0) {
    this.rng = mulberry32(seed);
    // Surprise events and hidden bonuses use their OWN seeded streams, consumed exactly once per chunk,
    // so they can never change which hazards appear (the Daily Run stays identical for everyone).
    this.evRng = mulberry32((seed ^ 0xa5a5a5a5) >>> 0);
    this.bonusRng = mulberry32((seed ^ 0x3c6ef372) >>> 0);
    this.cursor = startX;          // world x where the next chunk begins
    this.nextFestM = (Math.floor(startX / UNITS_PER_METER / FESTIVAL.everyM) + 1) * FESTIVAL.everyM;
    this.lastEventIdx = -99;
    this.lastPowerM = -999;
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

  biomeAt(m) { return BIOME_ORDER[biomeIndexAt(m, BIOME.lengthM)]; }

  _pick() {
    const m = this.cursor / UNITS_PER_METER;
    if (this.index === 0) return CHUNK_BY_ID.start;
    if (this.script && this.script.length) return CHUNK_BY_ID[this.script.shift()] || CHUNK_BY_ID['breather-trail'];
    this.script = null;
    if (m >= this.nextFestM) {            // a Lantern Festival: calm, flat, nothing to dodge
      this.nextFestM += FESTIVAL.everyM;
      this.heat = 0;
      return CHUNK_BY_ID.festival;
    }
    const biome = this.biomeAt(m);
    const inBiome = (c) => !c.biomes || c.biomes.includes(biome);
    const BREATHERS = PLAYABLE.filter((c) => c.diff === 0 && inBiome(c));

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
      pool = PLAYABLE.filter((c) => c.diff === target && inBiome(c));
      if (!pool.length) pool = PLAYABLE.filter((c) => c.diff > 0 && c.diff <= target && inBiome(c));
      this.heat += target;
    }
    let fresh = pool.filter((c) => !this.recent.includes(c.id));
    if (!fresh.length) fresh = pool;
    let total = 0;
    const weight = (c) => (c.w ?? 1) * (c.biomes ? 2.6 : 1);   // a biome's own chunks show up more often
    for (const c of fresh) total += weight(c);
    let r = rng() * total;
    for (const c of fresh) {
      r -= weight(c);
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
    for (const [type, x, y] of chunk.hazards) {
      if (type === 'drop') w.spawnHazard('drop', x0 + x - HAZARDS.drop.r, x0 + x + HAZARDS.drop.r, y);
      else w.spawnHazard(type, x0 + x);
    }
    for (const x of chunk.pads || []) w.spawnPad(x0 + x);
    for (const z of chunk.zones || []) w.spawnZone(z.kind, x0 + z.x0, x0 + z.x1);
    if (chunk.rain) w.spawnDecor({ kind: 'cloud', x0: x0 + chunk.rain[0], x1: x0 + chunk.rain[1] });
    if (chunk.festival) w.spawnFestival(x0, x0 + chunk.len);
    for (const pk of chunk.pickups) this._spawnPickup(pk, x0);

    // one roll from each side stream per chunk, no matter what: keeps both streams in lockstep
    const ev1 = this.evRng(); const ev2 = this.evRng(); const bonus = this.bonusRng();
    if (!chunk.start && !chunk.festival && !this.script) {
      const m = x0 / UNITS_PER_METER;
      if (ev1 < EVENTS.chance && m >= EVENTS.minM && this.index - this.lastEventIdx > EVENTS.cooldownChunks) {
        this.lastEventIdx = this.index;
        this._spawnEvent(ev2, x0, chunk.len);
      }
      if (bonus < 0.55 && w.revealBonus) w.spawnHiddenBonus(x0 + chunk.len * 0.55);
    }

    this.recent.push(chunk.id);
    if (this.recent.length > 4) this.recent.shift();
    this.cursor += chunk.len;
    this.index++;
  }

  /** A surprise: a rainbow of golden seeds, a swarm of fireflies, or a row of sleepy lanterns. */
  _spawnEvent(r, x0, len) {
    const w = this.world;
    if (r < 0.34) {                       // rainbow bridge
      const xa = x0 + 140; const xb = x0 + len - 160;
      w.spawnDecor({ kind: 'rainbow', x0: xa, x1: xb, announce: 'rainbow' });
      for (let i = 0; i < 13; i++) w.spawnPickup('seed', xa + ((xb - xa) * i) / 12, 40 + 112 * Math.sin((Math.PI * i) / 12), 0, 1);
    } else if (r < 0.67) {                // firefly swarm
      const cx = x0 + len * 0.5;
      w.spawnDecor({ kind: 'swarm', x0: cx - 90, x1: cx + 90, announce: 'swarm' });
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        w.spawnPickup('seed', cx + Math.cos(a) * 82, 96 + Math.sin(a) * 46, 0, 2);
      }
    } else {                              // lantern row
      const xa = x0 + len * 0.28;
      w.spawnDecor({ kind: 'lanternrow', x0: xa, x1: xa + 400, announce: 'lanterns' });
      for (let i = 0; i < 6; i++) w.spawnPickup('lantern', xa + i * 80, 66 + (i % 2) * 22, 0);
    }
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
      else if (r < (acc += SPAWN.powerChance) && m >= SPAWN.powerMinM && m - this.lastPowerM >= SPAWN.powerMinGapM) type = 'power';
      else if (r < (acc += SPAWN.letterChance) && m - this.lastLetterM >= SPAWN.letterMinGapM) type = 'letter';
      else if (r < (acc += SPAWN.lanternChance)) type = 'lantern';
      else type = 'seed';
    }
    if (type === 'power') {
      this.lastPowerM = m;
      const kind = Math.floor(this.rng() * POWER_ORDER.length);
      this.world.spawnPickup('power', x, pk.y, 0, 0, kind);
    } else if (type === 'letter') {
      this.world.spawnPickup('letter', x, pk.y, this.letterIdx);
      this.letterIdx = (this.letterIdx + 1) % 4;
      this.lastLetterM = m;
    } else {
      this.world.spawnPickup(type, x, pk.y, 0);
    }
  }
}
