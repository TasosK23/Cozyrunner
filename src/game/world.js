/**
 * world.js — one run of the game: the course, Bramble, pickups, scoring, hearts, combo, power-ups,
 * biomes, festivals.
 *
 * `Run.update(dt, tick)` is the fixed 1/60 s simulation step. It is deterministic (given the same
 * seed and the same inputs on the same ticks it plays out identically) and allocation-light in the
 * hot path: hazards and pickups come from pre-built pools.
 *
 * Things happen -> `this.emit(name, a, b)` is called. juice.js turns those into particles, sounds
 * and haptics; main.js turns 'over' into the game-over screen. The simulation never touches the DOM.
 */
import {
  PLAYER, HAZARDS, SCORE, COMBO, GLOW, PICKUP, VIEW, UNITS_PER_METER, WORD, POOLS, DYING_TIME, speedAt,
  ZONES, BIOME, FESTIVAL, POWER,
} from '../data/balance.js';
import { POWER_ORDER } from '../data/powerups.js';
import { makePlayer, stepPlayer, playerBox, boxHitsHazard, zoneMul, EV } from './physics.js';
import { Generator } from './generator.js';
import { updateHints } from './tutorial.js';
import { defaultLoadout } from './loadout.js';

const GAP = 'gap';
const ZMUL = { fluff: ZONES.fluff, gustTail: ZONES.gustTail, gustHead: ZONES.gustHead, fog: ZONES.fog };

function makeHazard() {
  return {
    active: false, type: '', x0: 0, x1: 0, y0: 0, y1: 0, cy: 0, hint: '',
    passed: false, hit: false, minClear: 999, glided: false, fell: false, nm: false,
  };
}
function makePickup() {
  return { active: false, type: '', x: 0, y: 0, r: 0, lit: false, letter: 0, magnet: false, kind: 0, var: 0 };
}

export class Run {
  /** @param tutorial the save's tutorial flags object (mutated as hints are learned) */
  constructor(tutorial) {
    this.tut = tutorial;
    this.emit = () => {};
    this.hazards = Array.from({ length: POOLS.hazards }, makeHazard);
    this.pickups = Array.from({ length: POOLS.pickups }, makePickup);
    this.segs = [];                 // closed island segments {x0,x1}
    this.pads = [];                 // bouncy mushrooms {x0,x1,x}
    this.zones = [];                // speed zones {kind,x0,x1,mul,entered}
    this.decor = [];                // clouds, rainbows... {kind,x0,x1,announce,seen}
    this.fests = [];                // festival stretches
    this.openStart = -3000;         // the current open-ended island begins here
    this.groundFn = (x) => this.groundAt(x);
    this.padFn = (x) => this.padAt(x);
    this.gen = new Generator(this);
    this._box = { x0: 0, x1: 0, y0: 0, y1: 0 };
    this.p = makePlayer(0);
    this.L = defaultLoadout();
    this.P = { ...PLAYER };
    this.reset(1, { script: false, bestMeters: 0 });
  }

  /** Start (or restart) a run. Cheap: no allocation beyond a couple of small objects. */
  reset(seed, opts = {}) {
    this.seed = seed;
    this.state = 'ready';           // ready | running | dying | over
    this.daily = !!opts.daily;
    this.L = opts.loadout || defaultLoadout();
    this.P = { ...PLAYER, glideDur: PLAYER.glideDur * this.L.glideMul };
    this.revealBonus = !!this.L.revealBonus;
    for (const h of this.hazards) h.active = false;
    for (const q of this.pickups) q.active = false;
    this.segs.length = 0; this.pads.length = 0; this.zones.length = 0; this.decor.length = 0; this.fests.length = 0;
    const startX = (opts.startM || 0) * UNITS_PER_METER;
    this.openStart = startX - 3000;
    this.p = makePlayer(startX);
    this.prevX = startX; this.prevY = 0;
    this.camX = this.p.x - VIEW.width * VIEW.playerX;
    this.prevCamX = this.camX;
    this.time = 0; this.dyingT = 0;
    this.speed = 0; this.baseSpeed = 0; this.speedMul = 1; this.slowT = 0;
    this.distM = startX / UNITS_PER_METER;
    this.score = 0; this.distAcc = 0;
    this.seedsGot = 0;
    this.chain = 0; this.chainT = 0; this.mult = 1;
    this.hearts = this.L.hearts; this.maxHearts = this.L.hearts;
    this.invuln = 0; this.hurtT = 0;
    this.glow = this.L.glowStart || 0;
    this.letters = [false, false, false, false]; this.lettersGot = 0;
    this.bubble = false; this.bubbleX = 0;
    this.hintKey = ''; this.hintT = 0;
    this.bestMeters = opts.bestMeters || 0;
    this.ghostX = this.bestMeters * UNITS_PER_METER;
    this.ghostPassed = this.ghostX <= 0;
    this.newBest = false;
    // power-ups: seconds left per kind (blanket: seconds until it wears off, or 0 = none)
    this.pu = { honey: 0, hop: 0, dash: 0, burst: 0, blanket: 0 };
    this.puMax = { honey: 1, hop: 1, dash: 1, burst: 1, blanket: 1 };
    this.puWarned = { honey: false, hop: false, dash: false, burst: false, blanket: false };
    this.hopJumps = 0;
    this.dashGrace = 0;
    this.lastPowerKind = '';
    this.fest = null;               // the festival Bramble is inside right now
    this.zoneKind = '';             // kind of speed zone Bramble is inside right now ('' = none)
    this.biomeK = Math.floor(this.distM / BIOME.lengthM);   // which biome stretch (0,1,2...) we're in
    this.stats = {
      seeds: 0, lanterns: 0, fireflies: 0, words: 0, nearMisses: 0, gaps: 0, glideGaps: 0, hits: 0,
      bestMult: 1, bestChain: 0, glides: 0, jumps: 0, slides: 0,
      vinesSlid: 0, powerups: 0, bounces: 0, perfectBeats: 0, festivals: 0, biomes: 0, surprises: 0, converted: 0,
    };
    this.useScript = !!opts.script && !this.tut.done;
    this.gen.reset(seed, this.useScript, startX);
    this.gen.ensure(this.p.x + VIEW.lookahead);
    if (this.L.startBlanket) { this.pu.blanket = 9999; this.puMax.blanket = 9999; }   // Pip's blanket never wears off
  }

  begin() {
    this.state = 'running';
    this.emit('biome', this.biomeK, true);
  }

  groundAt(x) {
    const pad = PLAYER.edgePad;
    if (x >= this.openStart - pad) return true;
    for (let i = 0; i < this.segs.length; i++) {
      const s = this.segs[i];
      if (x >= s.x0 - pad && x <= s.x1 + pad) return true;
    }
    return false;
  }

  padAt(x) {
    for (let i = 0; i < this.pads.length; i++) {
      const q = this.pads[i];
      if (x >= q.x0 && x <= q.x1) return true;
    }
    return false;
  }

  /** The course as the beatability solver sees it (used by the bot and the debug autopilot). */
  courseView(maxAhead = 900) {
    const px = this.p.x;
    return {
      hazards: this.hazards.filter((h) => h.active && h.type !== GAP && h.x1 > px - 40 && h.x0 < px + maxAhead),
      groundAt: this.groundFn,
      padAt: this.pads.length ? this.padFn : null,
      zones: this.zones,
    };
  }

  // ------------------------------------------------------------------ generator -> world API
  closeGround(x) { this.segs.push({ x0: this.openStart, x1: x }); }
  openGround(x) { this.openStart = x; }

  spawnHazard(type, x0, x1, y = 0) {
    for (const h of this.hazards) {
      if (h.active) continue;
      h.active = true; h.type = type; h.passed = false; h.hit = false; h.minClear = 999;
      h.glided = false; h.fell = false; h.nm = false; h.cy = 0;
      if (type === 'snail') {
        h.x0 = x0; h.x1 = x0 + HAZARDS.snail.w; h.y0 = 0; h.y1 = HAZARDS.snail.h; h.hint = 'jump';
      } else if (type === 'vine') {
        h.x0 = x0; h.x1 = x0 + HAZARDS.vine.w; h.y0 = HAZARDS.vine.bottom; h.y1 = HAZARDS.vine.top; h.hint = 'slide';
      } else if (type === 'drop') {
        h.x0 = x0; h.x1 = x1; h.cy = y; h.y0 = y - HAZARDS.drop.r; h.y1 = y + HAZARDS.drop.r; h.hint = '';
      } else {
        h.x0 = x0; h.x1 = x1; h.y0 = 0; h.y1 = 0; h.hint = (x1 - x0) >= 170 ? 'glide' : 'jump';
      }
      return h;
    }
    return null;   // pool exhausted: skip (never crash)
  }

  spawnPickup(type, x, y, letter = 0, variant = 0, kind = 0) {
    for (const q of this.pickups) {
      if (q.active) continue;
      q.active = true; q.type = type; q.x = x; q.y = y; q.lit = false; q.letter = letter; q.magnet = false;
      q.kind = kind; q.var = variant;
      q.r = type === 'lantern' ? PICKUP.lanternR : type === 'tea' ? PICKUP.teaR
        : type === 'firefly' ? PICKUP.fireflyR : type === 'letter' ? PICKUP.letterR
          : type === 'power' ? PICKUP.powerR : PICKUP.seedR;
      return q;
    }
    return null;
  }

  spawnPad(x) { this.pads.push({ x, x0: x - HAZARDS.pad.pad, x1: x + HAZARDS.pad.w + HAZARDS.pad.pad, squash: 0 }); }
  spawnZone(kind, x0, x1) { this.zones.push({ kind, x0, x1, mul: ZMUL[kind] ?? 1, entered: false }); }
  spawnDecor(d) { d.seen = false; this.decor.push(d); }
  spawnFestival(x0, x1) {
    this.fests.push({ x0, x1, t0: -1, next: 0, hit: new Array(FESTIVAL.beats).fill(false), hits: 0, finished: false, active: false });
  }
  spawnHiddenBonus(x) {
    for (let i = 0; i < 5; i++) this.spawnPickup('seed', x + i * 34, 150 + 26 * Math.sin((Math.PI * i) / 4), 0, 1);
  }

  // ------------------------------------------------------------------ scoring helpers
  _addChain(n) {
    this.chain += n;
    this.chainT = COMBO.timeout + this.L.comboBonus;
    const m = Math.min(COMBO.maxMult, 1 + Math.floor(this.chain / COMBO.perLevel));
    if (m > this.mult) { this.mult = m; this.emit('multup', m); }
    if (this.mult > this.stats.bestMult) this.stats.bestMult = this.mult;
    if (this.chain > this.stats.bestChain) this.stats.bestChain = this.chain;
  }

  _addScore(base) {
    const g = Math.round(base * this.mult);
    this.score += g;
    return g;
  }

  _addSeeds(n) { this.seedsGot += n; this.stats.seeds += n; }

  // ------------------------------------------------------------------ power-ups
  _activate(kindIdx) {
    const kind = POWER_ORDER[kindIdx % POWER_ORDER.length];
    const mul = this.L.powerMul;
    let dur = POWER[kind].dur * mul;
    if (kind === 'hop') { this.hopJumps = POWER.hop.jumps; }
    this.pu[kind] = dur; this.puMax[kind] = dur; this.puWarned[kind] = false;
    this.lastPowerKind = kind;
    this.stats.powerups++;
    this.emit('power', kind);
    if (kind === 'burst') this.emit('burststart');
  }

  _endPower(kind) {
    this.pu[kind] = 0; this.puWarned[kind] = false;
    if (kind === 'hop') this.hopJumps = 0;
    if (kind === 'dash') this.dashGrace = 1.0;     // a moment of safety right after the dash
    this.emit('powerend', kind);
  }

  _tickPowers(dt) {
    for (let i = 0; i < POWER_ORDER.length; i++) {
      const k = POWER_ORDER[i];
      if (this.pu[k] <= 0) continue;
      this.pu[k] -= dt;
      if (!this.puWarned[k] && k !== 'blanket' && this.pu[k] <= POWER.warn && this.pu[k] > 0) {
        this.puWarned[k] = true; this.emit('powerwarn', k);
      }
      if (this.pu[k] <= 0) this._endPower(k);
    }
    if (this.dashGrace > 0) this.dashGrace -= dt;
    if (this.slowT > 0) this.slowT -= dt;
  }

  /** Lantern Burst: hazards that touch the aura become glow-seeds. */
  _burstAura() {
    const p = this.p;
    const R = POWER.burst.radius;
    for (let i = 0; i < this.hazards.length; i++) {
      const h = this.hazards[i];
      if (!h.active || h.type === GAP || h.passed) continue;
      if (h.x1 < p.x - 30 || h.x0 > p.x + R) continue;
      h.active = false;
      this.stats.converted++;
      const cx = (h.x0 + h.x1) / 2;
      const cy = h.type === 'vine' ? 50 : Math.max(24, (h.y0 + h.y1) / 2);
      for (let k = 0; k < 4; k++) this.spawnPickup('seed', cx + (k - 1.5) * 16, cy + (k % 2) * 10, 0, 2);
      this.emit('convert', h);
    }
    for (let i = 0; i < this.pickups.length; i++) {
      const q = this.pickups[i];
      if (q.active && q.type === 'lantern' && !q.lit && Math.abs(q.x - p.x) < R) this._collect(q);
    }
  }

  // ------------------------------------------------------------------ the simulation step
  update(dt, tick) {
    this.prevX = this.p.x;
    this.prevY = this.p.y;
    this.prevCamX = this.camX;
    if (this.state === 'ready' || this.state === 'over') { this.time += dt; return; }
    this.time += dt;

    if (this.state === 'dying') { this._updateDying(dt); return; }

    const p = this.p;
    this.distM = p.x / UNITS_PER_METER;

    // ---- speed: the course speed, plus power-up / companion effects, then the zone under Bramble
    let base = speedAt(this.distM) * this.speedMul;
    if (this.pu.dash > 0) base *= POWER.dash.mul;
    if (this.slowT > 0) base *= 1 - 0.16 * Math.min(1, this.slowT / 0.4);
    this.baseSpeed = base;
    this.speed = base * zoneMul(this.zones, p.x);

    // ---- Cloud Hop gives free mid-air jumps
    p.extraJumps = this.pu.hop > 0 ? this.hopJumps : 0;

    // ---- Bramble
    if (this.bubble) this._updateBubble(dt);
    else stepPlayer(p, tick, dt, this.speed, this.groundFn, this.P, this.pads.length ? this.padFn : null);
    const ev = p.ev;
    if (ev) this._handlePhysicsEvents(ev);

    // Teapot Dash: steam holds Bramble up over gaps
    if (this.pu.dash > 0 && !this.bubble && !p.grounded && p.y < 6 && !this.groundAt(p.x)) {
      if (p.y < 0) p.y = 0;
      if (p.vy < 0) p.vy = 0;
    }
    if (!this.bubble && p.y < PLAYER.fallY) this._fall();

    // ---- build ahead, tidy behind
    this.gen.ensure(p.x + VIEW.lookahead);
    this.camX = p.x - VIEW.width * VIEW.playerX;
    this._cull();

    // ---- zones, biomes, festivals, surprises
    this._updateZones();
    this._updateBiome();
    this._updateDecor();
    this._updateFestival(tick);

    // ---- hazards, pickups
    if (this.pu.burst > 0) this._burstAura();
    this._updateHazards();
    this._updatePickups(dt);

    // ---- timers
    this._tickPowers(dt);
    if (this.invuln > 0) this.invuln -= dt;
    if (this.hurtT > 0) this.hurtT -= dt;
    if (this.glow > 0) this.glow = Math.max(0, this.glow - GLOW.drain * this.L.glowKeep * dt);
    if (this.chain > 0) {
      this.chainT -= dt;
      if (this.chainT <= 0) { this.chain = 0; this.mult = 1; this.emit('chainend'); }
    }

    // ---- distance score (not multiplied by combo; glowing lantern gives a bonus)
    this.distAcc += (this.speed * dt / UNITS_PER_METER) * SCORE.perMeter * (this.glow > 0 ? SCORE.glowDistanceBonus : 1);
    if (this.distAcc >= 1) {
      const whole = Math.floor(this.distAcc);
      this.score += whole;
      this.distAcc -= whole;
    }

    // ---- best-run ghost
    if (!this.ghostPassed && p.x >= this.ghostX) {
      this.ghostPassed = true;
      this.newBest = true;
      this.emit('newbest');
    }

    updateHints(this);
  }

  _handlePhysicsEvents(ev) {
    const p = this.p;
    if (ev & EV.JUMP) { this.stats.jumps++; this.emit('jump'); }
    if (ev & EV.AIRJUMP) {
      this.emit('jump');
      if (this.pu.hop > 0) { this.hopJumps--; this.emit('hopjump', this.hopJumps); if (this.hopJumps <= 0) this._endPower('hop'); }
    }
    if (ev & EV.GLIDE) { this.stats.glides++; this.emit('glide'); }
    if (ev & EV.SLIDE) { this.stats.slides++; this.emit('slide'); }
    if (ev & EV.FASTFALL) this.emit('fastfall');
    if (ev & EV.LEDGE) this.emit('ledge');
    if (ev & EV.BOUNCE) {
      this.stats.bounces++;
      for (const q of this.pads) if (p.x >= q.x0 && p.x <= q.x1) q.squash = 1;
      this.emit('bounce');
    }
    if (ev & EV.LAND) {
      this.emit('land', p.landV);
      // near-miss: landed just past a gap's far edge
      for (const h of this.hazards) {
        if (h.active && h.type === GAP && !h.nm && !h.fell && p.x >= h.x1 && p.x <= h.x1 + HAZARDS.nearMiss.gapLand) {
          h.nm = true;
          this._nearMiss('gap');
        }
      }
    }
  }

  _nearMiss(kind) {
    this.stats.nearMisses++;
    this._addChain(COMBO.nearMissChain);
    const g = this._addScore(SCORE.nearMiss);
    this.emit('nearmiss', kind, g);
  }

  _updateZones() {
    const px = this.p.x;
    let inside = '';
    for (let i = 0; i < this.zones.length; i++) {
      const z = this.zones[i];
      if (px > z.x0 && px < z.x1) {
        inside = z.kind;
        if (!z.entered) { z.entered = true; this.emit('zone', z.kind); }
      }
    }
    this.zoneKind = inside;
  }

  _updateBiome() {
    const k = Math.floor(this.p.x / UNITS_PER_METER / BIOME.lengthM);
    if (k !== this.biomeK) {
      this.biomeK = k;
      this.stats.biomes++;
      this.emit('biome', k, false);
    }
  }

  _updateDecor() {
    const px = this.p.x;
    for (let i = 0; i < this.decor.length; i++) {
      const d = this.decor[i];
      if (d.announce && !d.seen && px > d.x0 - 360) {
        d.seen = true;
        this.stats.surprises++;
        this.emit('surprise', d.announce);
      }
    }
    for (let i = 0; i < this.pads.length; i++) if (this.pads[i].squash > 0) this.pads[i].squash = Math.max(0, this.pads[i].squash - 0.06);
  }

  // ---- Lantern Festival: beats arrive, a tap near a beat is "perfect"
  _updateFestival(tick) {
    const p = this.p;
    let f = null;
    for (let i = 0; i < this.fests.length; i++) {
      const c = this.fests[i];
      if (!c.finished && p.x >= c.x0 + 120 && p.x <= c.x1) { f = c; break; }
    }
    // leaving a festival early (or finishing it) wraps it up
    for (let i = 0; i < this.fests.length; i++) {
      const c = this.fests[i];
      if (c.active && !c.finished && (p.x > c.x1 || (c.t0 > 0 && this.time > c.t0 + FESTIVAL.beats * FESTIVAL.beatLen + 0.5))) this._finishFestival(c);
    }
    this.fest = f && !f.finished ? f : null;
    if (!f) return;
    if (!f.active) { f.active = true; f.t0 = this.time + FESTIVAL.lead; this.emit('festival'); }
    while (f.next < FESTIVAL.beats && this.time >= f.t0 + f.next * FESTIVAL.beatLen) {
      this.emit('beat', f.next);
      f.next++;
    }
    if (tick && tick.press) {
      let best = -1; let bd = 9;
      for (let k = 0; k < FESTIVAL.beats; k++) {
        if (f.hit[k]) continue;
        const d = Math.abs(this.time - (f.t0 + k * FESTIVAL.beatLen));
        if (d < bd) { bd = d; best = k; }
      }
      if (best >= 0 && bd <= FESTIVAL.window) {
        f.hit[best] = true; f.hits++;
        this.stats.perfectBeats++;
        this._addSeeds(FESTIVAL.perfectSeeds);
        this._addChain(2);
        const g = this._addScore(SCORE.perfectBeat);
        this.emit('perfect', best, g);
      }
    }
  }

  _finishFestival(f) {
    f.finished = true;
    this.stats.festivals++;
    let bonus = 0;
    if (f.hits >= FESTIVAL.beats) { bonus = FESTIVAL.allBonus; this._addSeeds(bonus); }
    this.emit('festivaldone', f.hits, bonus);
    if (this.fest === f) this.fest = null;
  }

  _updateHazards() {
    const p = this.p;
    const box = this._box;
    const canBeHit = this.invuln <= 0 && !this.bubble && this.pu.dash <= 0 && this.dashGrace <= 0;
    if (canBeHit) playerBox(p, -PLAYER.forgive, box);
    for (let i = 0; i < this.hazards.length; i++) {
      const h = this.hazards[i];
      if (!h.active) continue;

      if (h.type === GAP) {
        if (p.x > h.x0 && p.x < h.x1 && p.gliding) h.glided = true;
        if (!h.passed && p.x > h.x1 + 4) {
          h.passed = true;
          if (!h.fell) {
            this.stats.gaps++;
            if (h.glided) this.stats.glideGaps++;
            this.emit('gapclear', h);
          }
        }
        continue;
      }

      if (canBeHit && boxHitsHazard(box, h)) {
        h.hit = true;
        this._hit(h);
        if (this.state !== 'running') return;
        continue;
      }

      const overlapping = p.x + 14 > h.x0 && p.x - 14 < h.x1;
      if (overlapping && h.type === 'snail') {
        const clear = p.y - h.y1;
        if (clear < h.minClear) h.minClear = clear;
      }
      if (!h.passed && p.x - 14 > h.x1) {
        h.passed = true;
        if (!h.hit) {
          if (h.type === 'snail' && h.minClear < HAZARDS.nearMiss.snailClear) this._nearMiss('snail');
          else if (h.type === 'vine' && p.grounded && p.slideT > 0 && p.slideT < HAZARDS.nearMiss.vineSlideLeft) this._nearMiss('vine');
          if (h.type === 'vine' && p.grounded && p.slideT > 0) this.stats.vinesSlid++;
        }
        this._taught(h.hint);
      }
    }
  }

  _taught(key) {
    if (!key || this.tut[key] === undefined) return;
    if (!this.tut[key]) {
      this.tut[key] = true;
      if (this.tut.jump && this.tut.slide && this.tut.glide) this.tut.done = true;
      this.emit('tutorial');
    }
  }

  /** A Cozy Blanket soaks up one bump. Returns true if it did. */
  _blanketAbsorbs() {
    if (this.pu.blanket <= 0) return false;
    this.pu.blanket = 0;
    this.invuln = 1.1;
    this.emit('blanket');
    this.emit('powerend', 'blanket');
    return true;
  }

  _hit(h) {
    if (this._blanketAbsorbs()) return;
    this.hearts--;
    this.stats.hits++;
    this.chain = 0; this.mult = 1;
    this.invuln = PLAYER.invuln;
    this.hurtT = 1.0;
    if (this.L.slowAfterHit) this.slowT = this.L.slowAfterHit;
    this.emit('hit', h);
    if (this.hearts <= 0) { this._startDying(); return; }
    // a harmless hop backwards-ish so it reads as a bonk, not a stop
    const p = this.p;
    p.grounded = false; p.vy = 330; p.slideT = 0; p.gliding = false; p.glideAvail = true; p.jumpCut = false; p.y += 0.01;
  }

  _fall() {
    const p = this.p;
    const soaked = this._blanketAbsorbs();
    if (!soaked) {
      this.hearts--;
      this.stats.hits++;
      this.chain = 0; this.mult = 1;
      if (this.L.slowAfterHit) this.slowT = this.L.slowAfterHit;
    }
    for (const h of this.hazards) {
      if (h.active && h.type === GAP && p.x >= h.x0 - 20 && p.x <= h.x1 + 20) h.fell = true;
    }
    this.emit('fall');
    this.invuln = Math.max(this.invuln, PLAYER.invuln + 0.3);
    this.hurtT = soaked ? 0.4 : 1.0;
    // a soft bubble floats Bramble up and over to the next island
    this.bubble = true;
    this.bubbleX = this.openStart;
    for (const s of this.segs) if (s.x0 > p.x && s.x0 < this.bubbleX) this.bubbleX = s.x0;
    this.bubbleX += 30;
    p.vy = 0; p.gliding = false; p.slideT = 0;
    if (this.hearts <= 0) this._startDying();
  }

  _updateBubble(dt) {
    const p = this.p;
    p.x += this.speed * dt;
    p.y += (110 - p.y) * Math.min(1, dt * 7);
    p.vy = 0; p.grounded = false; p.ev = 0; p.airT = 0.2;
    if (p.x >= this.bubbleX) {
      this.bubble = false;
      p.glideAvail = true; p.jumpCut = false;
      this.emit('bubblepop');
    }
  }

  _startDying() {
    this.state = 'dying';
    this.dyingT = 0;
    this.chain = 0; this.mult = 1;
    for (const k of POWER_ORDER) this.pu[k] = 0;
    this.emit('dying');
  }

  _updateDying(dt) {
    this.dyingT += dt;
    const p = this.p;
    this.speed *= Math.max(0, 1 - dt * 3.4);          // the world eases to a stop
    if (this.bubble) {
      p.x += this.speed * dt;
      p.y += (60 - p.y) * Math.min(1, dt * 4);
    } else {
      stepPlayer(p, { press: false, hold: false, slide: false }, dt, this.speed, this.groundFn, this.P, null);
      if (p.ev & EV.LAND) this.emit('land', p.landV);
    }
    this.camX = p.x - VIEW.width * VIEW.playerX;
    if (this.dyingT >= DYING_TIME) {
      this.state = 'over';
      this.distM = p.x / UNITS_PER_METER;
      this.emit('over');
    }
  }

  _updatePickups(dt) {
    const p = this.p;
    const cx = p.x;
    const cy = p.y + (p.grounded && p.slideT > 0 ? 12 : 23);
    let magnetR = this.L.magnetR;
    if (this.glow > 0) magnetR = Math.max(magnetR, GLOW.magnet);
    if (this.pu.honey > 0) magnetR = Math.max(magnetR, POWER.honey.radius);
    for (let i = 0; i < this.pickups.length; i++) {
      const q = this.pickups[i];
      if (!q.active) continue;
      if (q.type === 'lantern' && q.lit) continue;
      const dx = cx - q.x;
      const dy = cy - q.y;
      const d2 = dx * dx + dy * dy;
      if (magnetR > 0 && q.type === 'seed' && d2 < magnetR * magnetR) {
        q.magnet = true;
      }
      if (q.magnet) {                       // honey-glow pull: seeds drift toward Bramble
        const d = Math.sqrt(d2) || 1;
        const pull = Math.min(d, 650 * dt);
        q.x += (dx / d) * pull;
        q.y += (dy / d) * pull;
      }
      const reach = q.r + PICKUP.reach;
      if (d2 < reach * reach) this._collect(q);
    }
  }

  _collect(q) {
    switch (q.type) {
      case 'seed': {
        q.active = false;
        const n = q.var === 1 ? 3 : q.var === 2 ? 2 : 1;
        this._addSeeds(n);
        this._addChain(COMBO.seedChain);
        this._addScore(q.var === 1 ? SCORE.goldSeed : SCORE.seed);
        this.emit('seed', q, this.chain);
        break;
      }
      case 'tea': {
        q.active = false;
        if (this.hearts < this.maxHearts) { this.hearts++; this.emit('heart', q); }
        else { this._addSeeds(5); this._addScore(SCORE.tea); this.emit('teabonus', q); }
        this._addChain(COMBO.teaChain);
        break;
      }
      case 'lantern': {
        q.lit = true;
        this.stats.lanterns++;
        this.glow = Math.min(GLOW.max, this.glow + GLOW.perLantern);
        this._addChain(COMBO.lanternChain);
        const g = this._addScore(SCORE.lantern);
        this.emit('lantern', q, g);
        break;
      }
      case 'firefly': {
        q.active = false;
        this.stats.fireflies++;
        this._addSeeds(20);
        this._addChain(COMBO.fireflyChain);
        const g = this._addScore(SCORE.firefly);
        this.emit('firefly', q, g);
        break;
      }
      case 'power': {
        q.active = false;
        this._addChain(COMBO.letterChain);
        this._activate(q.kind);
        break;
      }
      case 'letter': {
        q.active = false;
        this.letters[q.letter] = true;
        this.lettersGot++;
        this._addChain(COMBO.letterChain);
        const g = this._addScore(SCORE.letter);
        this.emit('letter', q, g);
        if (this.letters.every(Boolean)) {
          this.stats.words++;
          const bonus = this._addScore(SCORE.word);
          this.emit('word', bonus);
          this.letters.fill(false);
        }
        break;
      }
      default:
    }
  }

  _cull() {
    const left = this.camX - 160;
    for (const h of this.hazards) if (h.active && h.x1 < left) h.active = false;
    for (const q of this.pickups) if (q.active && q.x < left) q.active = false;
    while (this.segs.length && this.segs[0].x1 < left - 200) this.segs.shift();
    while (this.pads.length && this.pads[0].x1 < left - 100) this.pads.shift();
    while (this.zones.length && this.zones[0].x1 < left - 300) this.zones.shift();
    while (this.decor.length && this.decor[0].x1 < left - 300) this.decor.shift();
    while (this.fests.length && this.fests[0].x1 < left - 300) this.fests.shift();
  }

  /** Extra invulnerability after un-pausing, so a resume is never unfair. */
  grace(seconds) { if (this.invuln < seconds) this.invuln = seconds; }

  /** Everything the meta game (quests, stats, unlocks) needs to know about this run. */
  summary() {
    const s = this.stats;
    return {
      distM: Math.floor(this.distM), score: this.score, seeds: this.seedsGot, lanterns: s.lanterns, fireflies: s.fireflies,
      words: s.words, nearMisses: s.nearMisses, glideGaps: s.glideGaps, gaps: s.gaps, hits: s.hits, bestMult: s.bestMult,
      glides: s.glides, slides: s.slides, jumps: s.jumps, vinesSlid: s.vinesSlid, powerups: s.powerups, bounces: s.bounces,
      perfectBeats: s.perfectBeats, festivals: s.festivals, biomes: s.biomes, surprises: s.surprises, runs: 1,
      seconds: Math.round(this.time), daily: this.daily,
    };
  }
}
