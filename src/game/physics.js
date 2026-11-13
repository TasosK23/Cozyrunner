/**
 * physics.js — Bramble's movement rules, as pure functions on a plain state object.
 *
 * IMPORTANT: this exact code runs in the live game AND inside the beatability solver
 * (solver.js). That's what makes "this chunk is provably beatable" trustworthy:
 * the solver isn't guessing, it's playing with the same rules you do.
 *
 * Coordinates: x grows to the right (the world scrolls past a runner moving at `speed`),
 * y is feet height above the ground line (up is positive).
 */
import { PLAYER } from '../data/balance.js';

/** Event bits set in `state.ev` during a step (so visuals/audio can react). */
export const EV = {
  JUMP: 1, GLIDE: 2, LAND: 4, SLIDE: 8, FASTFALL: 16, LEDGE: 32, AIRJUMP: 64,
};

export function makePlayer(x = 0) {
  return {
    x, y: 0, vy: 0,
    grounded: true,
    coyote: 0,          // s left of coyote time
    airT: 0,            // s since leaving the ground
    glideAvail: true,   // one flutter per jump
    gliding: false, glideT: 0,
    slideT: 0,          // >0 while sliding (only counts when grounded)
    slideOnLand: false, // fast-fall -> roll on landing
    jumpBuf: 0,         // s left of a remembered early tap
    jumpCut: false,     // this jump can still be shortened by releasing early
    held: false,
    extraJumps: 0,      // free mid-air jumps (Cloud Hop power-up, Stage 2)
    ev: 0, landV: 0,
  };
}

export function copyPlayer(d, s) {
  d.x = s.x; d.y = s.y; d.vy = s.vy; d.grounded = s.grounded; d.coyote = s.coyote;
  d.airT = s.airT; d.glideAvail = s.glideAvail; d.gliding = s.gliding; d.glideT = s.glideT;
  d.slideT = s.slideT; d.slideOnLand = s.slideOnLand; d.jumpBuf = s.jumpBuf;
  d.jumpCut = s.jumpCut; d.held = s.held; d.extraJumps = s.extraJumps; d.ev = s.ev; d.landV = s.landV;
  return d;
}

function doJump(s, P) {
  s.vy = P.jumpV;
  s.grounded = false;
  s.coyote = 0;
  s.airT = 0;
  s.glideAvail = true;
  s.gliding = false;
  s.slideT = 0;
  s.jumpCut = true;
  s.jumpBuf = 0;
  s.ev |= EV.JUMP;
}

/**
 * Advance Bramble by one fixed step.
 * @param s     player state (mutated)
 * @param inp   {press, hold, slide} for this tick
 * @param dt    seconds (always 1/60)
 * @param speed world speed this tick (units/second)
 * @param groundAt (x)=>bool  is there island under this x?
 */
export function stepPlayer(s, inp, dt, speed, groundAt, P = PLAYER) {
  s.ev = 0;
  s.held = !!inp.hold;
  if (s.coyote > 0) s.coyote -= dt;
  if (s.slideT > 0) s.slideT -= dt;
  if (s.jumpBuf > 0) s.jumpBuf -= dt;
  if (!s.grounded) s.airT += dt;
  if (s.gliding) {
    s.glideT -= dt;
    if (s.glideT <= 0) s.gliding = false;
  }

  // --- swipe down: slide on the ground, fast-fall in the air
  if (inp.slide) {
    if (s.grounded) {
      s.slideT = P.slideDur;
      s.ev |= EV.SLIDE;
    } else {
      if (s.vy > -P.fastFallV) s.vy = -P.fastFallV;
      s.gliding = false;
      s.slideOnLand = true;
      s.jumpCut = false;
      s.ev |= EV.FASTFALL;
    }
  }

  // --- tap: jump / mid-air jump / glide / remember for landing
  if (inp.press) {
    if (s.grounded || s.coyote > 0) {
      doJump(s, P);
    } else if (s.extraJumps > 0) {
      s.extraJumps--;
      s.vy = P.jumpV * 0.92;
      s.glideAvail = true;
      s.gliding = false;
      s.jumpCut = true;
      s.ev |= EV.AIRJUMP;
    } else if (s.glideAvail && !s.gliding && s.y > P.glideMinY && s.airT > P.glideMinAir && s.vy <= P.glideMaxRise) {
      s.gliding = true;
      s.glideAvail = false;
      s.glideT = P.glideDur;
      if (s.vy < P.glideLift) s.vy = P.glideLift;
      s.jumpCut = false;
      s.ev |= EV.GLIDE;
    } else {
      s.jumpBuf = P.jumpBuffer;   // "jump buffering": too early, remember it
    }
  }

  // --- move forward through the world
  s.x += speed * dt;

  // --- walked off a ledge?
  if (s.grounded) {
    if (!groundAt(s.x)) {
      s.grounded = false;
      s.coyote = P.coyote;
      s.airT = 0;
      s.glideAvail = true;
      s.jumpCut = false;
      s.ev |= EV.LEDGE;
    } else {
      s.y = 0;
      s.vy = 0;
    }
  }

  // --- airborne physics
  if (!s.grounded) {
    if (s.gliding) {
      s.vy -= P.glideGravity * dt;
      if (s.vy < -P.glideFall) s.vy = -P.glideFall;
    } else {
      s.vy -= P.gravity * dt;
    }
    if (s.jumpCut) {            // variable jump height: let go early = shorter hop
      if (!s.held && s.vy > P.jumpCutV) { s.vy = P.jumpCutV; s.jumpCut = false; }
      else if (s.vy <= 0) s.jumpCut = false;
    }
    s.y += s.vy * dt;

    if (s.y <= 0 && s.vy <= 0 && s.y > -P.ledgeSave && groundAt(s.x)) {
      s.landV = -s.vy;
      s.y = 0;
      s.vy = 0;
      s.grounded = true;
      s.gliding = false;
      s.glideAvail = true;
      s.airT = 0;
      s.ev |= EV.LAND;
      if (s.slideOnLand) {
        s.slideOnLand = false;
        s.slideT = P.slideOnLand;
        s.ev |= EV.SLIDE;
      }
      if (s.jumpBuf > 0) doJump(s, P);
    }
  }
}

/** Fill `out` with Bramble's hitbox. pad > 0 grows it, pad < 0 shrinks it (forgiveness). */
export function playerBox(s, pad, out, P = PLAYER) {
  const sliding = s.grounded && s.slideT > 0;
  const hw = (sliding ? P.slideW : P.standW) / 2 + pad;
  const hh = sliding ? P.slideH : P.standH;
  out.x0 = s.x - hw;
  out.x1 = s.x + hw;
  out.y0 = s.y - pad;
  out.y1 = s.y + hh + pad;
  return out;
}

export function boxHitsHazard(b, h) {
  return b.x1 > h.x0 && b.x0 < h.x1 && b.y1 > h.y0 && b.y0 < h.y1;
}
