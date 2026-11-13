/**
 * world.js — one run of the game: the course, Bramble, pickups, scoring, hearts, combo.
 *
 * `Run.update(dt, tick)` is the fixed 1/60 s simulation step. It is deterministic (given the same
 * seed and the same inputs on the same ticks it plays out identically) and allocation-free in the
 * hot path: hazards and pickups come from pre-built pools.
 *
 * Things happen -> `this.emit(name, a, b)` is called. juice.js turns those into particles, sounds
 * and haptics; main.js turns 'over' into the game-over screen. The simulation never touches the DOM.
 */
import {
  PLAYER, HAZARDS, SCORE, COMBO, GLOW, PICKUP, VIEW, UNITS_PER_METER, WORD, POOLS, DYING_TIME, speedAt,
} from '../data/balance.js';
import { makePlayer, stepPlayer, playerBox, boxHitsHazard, EV } from './physics.js';
import { Generator } from './generator.js';
import { updateHints } from './tutorial.js';

const GAP = 'gap';

function makeHazard() {
  return {
    active: false, type: '', x0: 0, x1: 0, y0: 0, y1: 0, hint: '',
    passed: false, hit: false, minClear: 999, glided: false, fell: false, nm: false,
  };
}
function makePickup() {
  return { active: false, type: '', x: 0, y: 0, r: 0, lit: false, letter: 0, magnet: false };
}

export class Run {
  /** @param tutorial the save's tutorial flags object (mutated as hints are learned) */
  constructor(tutorial) {
    this.tut = tutorial;
    this.emit = () => {};
    this.hazards = Array.from({ length: POOLS.hazards }, makeHazard);
    this.pickups = Array.from({ length: POOLS.pickups }, makePickup);
    this.segs = [];                 // closed island segments {x0,x1}
    this.openStart = -3000;         // the current open-ended island begins here
    this.groundFn = (x) => this.groundAt(x);
    this.gen = new Generator(this);
    this._box = { x0: 0, x1: 0, y0: 0, y1: 0 };
    this.p = makePlayer(0);
    this.reset(1, { script: false, bestMeters: 0 });
  }

  /** Start (or restart) a run. Cheap: no allocation beyond a couple of small objects. */
  reset(seed, opts = {}) {
    this.seed = seed;
    this.state = 'ready';           // ready | running | dying | over
    for (const h of this.hazards) h.active = false;
    for (const q of this.pickups) q.active = false;
    this.segs.length = 0;
    this.openStart = -3000;
    this.p = makePlayer(0);
    this.prevX = 0; this.prevY = 0;
    this.camX = this.p.x - VIEW.width * VIEW.playerX;
    this.prevCamX = this.camX;
    this.time = 0; this.dyingT = 0;
    this.speed = 0; this.speedMul = 1;
    this.distM = 0;
    this.score = 0; this.distAcc = 0;
    this.seedsGot = 0;
    this.chain = 0; this.chainT = 0; this.mult = 1;
    this.hearts = PLAYER.hearts; this.maxHearts = PLAYER.hearts;
    this.invuln = 0; this.hurtT = 0;
    this.glow = 0;
    this.letters = [false, false, false, false]; this.lettersGot = 0;
    this.bubble = false; this.bubbleX = 0;
    this.hintKey = ''; this.hintT = 0;
    this.bestMeters = opts.bestMeters || 0;
    this.ghostX = this.bestMeters * UNITS_PER_METER;
    this.ghostPassed = this.ghostX <= 0;
    this.newBest = false;
    this.stats = {
      seeds: 0, lanterns: 0, fireflies: 0, words: 0, nearMisses: 0, gaps: 0, glideGaps: 0, hits: 0,
      bestMult: 1, bestChain: 0, glides: 0, jumps: 0, slides: 0,
    };
    this.useScript = !!opts.script && !this.tut.done;
    this.gen.reset(seed, this.useScript);
    this.gen.ensure(this.p.x + VIEW.lookahead);
  }

  begin() { this.state = 'running'; }

  groundAt(x) {
    const pad = PLAYER.edgePad;
    if (x >= this.openStart - pad) return true;
    for (let i = 0; i < this.segs.length; i++) {
      const s = this.segs[i];
      if (x >= s.x0 - pad && x <= s.x1 + pad) return true;
    }
    return false;
  }

  // ------------------------------------------------------------------ generator -> world API
  closeGround(x) { this.segs.push({ x0: this.openStart, x1: x }); }
  openGround(x) { this.openStart = x; }

  spawnHazard(type, x0, x1) {
    for (const h of this.hazards) {
      if (h.active) continue;
      h.active = true; h.type = type; h.passed = false; h.hit = false; h.minClear = 999;
      h.glided = false; h.fell = false; h.nm = false;
      if (type === 'snail') {
        h.x0 = x0; h.x1 = x0 + HAZARDS.snail.w; h.y0 = 0; h.y1 = HAZARDS.snail.h; h.hint = 'jump';
      } else if (type === 'vine') {
        h.x0 = x0; h.x1 = x0 + HAZARDS.vine.w; h.y0 = HAZARDS.vine.bottom; h.y1 = HAZARDS.vine.top; h.hint = 'slide';
      } else {
        h.x0 = x0; h.x1 = x1; h.y0 = 0; h.y1 = 0; h.hint = (x1 - x0) >= 170 ? 'glide' : 'jump';
      }
      return h;
    }
    return null;   // pool exhausted: skip (never crash)
  }

  spawnPickup(type, x, y, letter) {
    for (const q of this.pickups) {
      if (q.active) continue;
      q.active = true; q.type = type; q.x = x; q.y = y; q.lit = false; q.letter = letter; q.magnet = false;
      q.r = type === 'lantern' ? PICKUP.lanternR : type === 'tea' ? PICKUP.teaR
        : type === 'firefly' ? PICKUP.fireflyR : type === 'letter' ? PICKUP.letterR : PICKUP.seedR;
      return q;
    }
    return null;
  }

  // ------------------------------------------------------------------ scoring helpers
  _addChain(n) {
    this.chain += n;
    this.chainT = COMBO.timeout;
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
    this.speed = speedAt(this.distM) * this.speedMul;

    // ---- Bramble
    if (this.bubble) this._updateBubble(dt);
    else stepPlayer(p, tick, dt, this.speed, this.groundFn);
    const ev = p.ev;
    if (ev) this._handlePhysicsEvents(ev);

    if (!this.bubble && p.y < PLAYER.fallY) this._fall();

    // ---- build ahead, tidy behind
    this.gen.ensure(p.x + VIEW.lookahead);
    this.camX = p.x - VIEW.width * VIEW.playerX;
    this._cull();

    // ---- hazards, pickups
    this._updateHazards();
    this._updatePickups(dt);

    // ---- timers
    if (this.invuln > 0) this.invuln -= dt;
    if (this.hurtT > 0) this.hurtT -= dt;
    if (this.glow > 0) this.glow = Math.max(0, this.glow - GLOW.drain * dt);
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
    if (ev & EV.AIRJUMP) this.emit('jump');
    if (ev & EV.GLIDE) { this.stats.glides++; this.emit('glide'); }
    if (ev & EV.SLIDE) { this.stats.slides++; this.emit('slide'); }
    if (ev & EV.FASTFALL) this.emit('fastfall');
    if (ev & EV.LEDGE) this.emit('ledge');
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

  _updateHazards() {
    const p = this.p;
    const box = this._box;
    const canBeHit = this.invuln <= 0 && !this.bubble;
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

  _hit(h) {
    this.hearts--;
    this.stats.hits++;
    this.chain = 0; this.mult = 1;
    this.invuln = PLAYER.invuln;
    this.hurtT = 1.0;
    this.emit('hit', h);
    if (this.hearts <= 0) { this._startDying(); return; }
    // a harmless hop backwards-ish so it reads as a bonk, not a stop
    const p = this.p;
    p.grounded = false; p.vy = 330; p.slideT = 0; p.gliding = false; p.glideAvail = true; p.jumpCut = false; p.y += 0.01;
  }

  _fall() {
    const p = this.p;
    this.hearts--;
    this.stats.hits++;
    this.chain = 0; this.mult = 1;
    for (const h of this.hazards) {
      if (h.active && h.type === GAP && p.x >= h.x0 - 20 && p.x <= h.x1 + 20) h.fell = true;
    }
    this.emit('fall');
    this.invuln = PLAYER.invuln + 0.3;
    this.hurtT = 1.0;
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
      stepPlayer(p, { press: false, hold: false, slide: false }, dt, this.speed, this.groundFn);
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
    const magnetR = this.glow > 0 ? GLOW.magnet : 0;
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
        this.seedsGot++; this.stats.seeds++;
        this._addChain(COMBO.seedChain);
        this._addScore(SCORE.seed);
        this.emit('seed', q, this.chain);
        break;
      }
      case 'tea': {
        q.active = false;
        if (this.hearts < this.maxHearts) { this.hearts++; this.emit('heart', q); }
        else { this.seedsGot += 5; this.stats.seeds += 5; this._addScore(SCORE.tea); this.emit('teabonus', q); }
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
        this.seedsGot += 20; this.stats.seeds += 20;
        this._addChain(COMBO.fireflyChain);
        const g = this._addScore(SCORE.firefly);
        this.emit('firefly', q, g);
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
  }

  /** Extra invulnerability after un-pausing, so a resume is never unfair. */
  grace(seconds) { if (this.invuln < seconds) this.invuln = seconds; }
}
