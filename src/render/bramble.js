/**
 * bramble.js — draws the dragon hero, entirely with canvas paths (no images).
 * (The file and class keep the old name "Bramble" so nothing else had to change; the dragon is called Cinder.)
 *
 * Cinder is built like Smaug: a long, low, serpentine body with a deep chest, a gold-plated belly, rust-red
 * scales, a swan-curved neck, a wedge-shaped horned head with a heavy brow and burning amber eyes, a row of
 * dorsal spines, powerful hind haunches, taloned forelegs, and big bat-membrane wings (arm bone + four
 * fingers, scalloped trailing edge). The wings lie folded along his back while he runs and spread when he
 * glides or air-jumps. When his inner fire is burning (the "glow" meter) his spines, belly plates and eyes
 * blaze, and he breathes fire during the Inferno Dash / Firestorm power-ups (and in a title-screen yawn).
 *
 * Animation toolbox:
 *  - squash & stretch via two springs (sx, sy) kicked on jump / land / slide
 *  - run cycle (diagonal trot, bounce, tail sway), blinking, wing spring, tail-ember pendulum
 *  - poses: run, jump (jaw open, legs trailing), glide (wings spread and flutter), slide (low skid),
 *           hurt (shudder + sparks), idle (breathing, smoke, fire-yawn), knocked-out (head droops, wings limp)
 */
import { quality } from '../core/quality.js';

const TAU = Math.PI * 2;
const C = {
  scale: '#a5301f', scaleDark: '#5e1712', scaleLight: '#d4512a',
  outline: '#220c0c',
  belly: '#d9a441', bellyDark: '#8e5f1a', bellyLight: '#ffd878',
  horn: '#cdb88c', hornDark: '#7d6a48',
  eye: '#ffc62a', eyeCore: '#1a0606',
  claw: '#e9dcc0',
  wing: '#8d2a22', wingDark: '#4a1210', wingBone: '#2a0d0c', wingLight: '#c0452e',
  ember: '#ff7a2a', emberHot: '#ffd36a',
  spine: '#2b0f0e',
};

const lerp = (a, b, u) => a + (b - a) * u;
const blazeColor = (u) => `rgb(${Math.round(lerp(43, 255, u))},${Math.round(lerp(15, 135, u))},${Math.round(lerp(14, 40, u))})`;

/** Catmull-Rom through [x, y, width] control points -> dense samples. */
function catmull(P, seg) {
  const out = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)]; const p1 = P[i]; const p2 = P[i + 1]; const p3 = P[Math.min(P.length - 1, i + 2)];
    for (let s = 0; s < seg; s++) {
      const u = s / seg; const u2 = u * u; const u3 = u2 * u;
      const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1]), f(p0[2], p1[2], p2[2], p3[2])]);
    }
  }
  out.push(P[P.length - 1].slice());
  return out;
}

/**
 * One bat-style wing. (sx, sy) is the shoulder. spread 0 = folded along the back, 1 = fully open.
 * Four finger bones fan from the wrist; the membrane's trailing edge is scalloped between the tips and
 * attaches to the body at the hip.
 */
function wing(ctx, sx, sy, spread, flap, scale, fill, light, far) {
  const Af = [-3.18, -3.25, -3.32, -3.40];     // folded: fingers trail back along the spine
  const Ao = [-0.95, -1.50, -2.08, -2.66];     // open: leading finger up, last finger back
  const Lb = [44, 48, 44, 36];
  const wx = sx - (4 + 10 * spread) * scale;
  const wy = sy - (6 + 20 * spread) * scale;   // wrist
  const tips = [];
  for (let i = 0; i < 4; i++) {
    const a = Af[i] + (Ao[i] - Af[i]) * spread + flap * (0.6 + i * 0.15);
    const l = Lb[i] * (0.6 + 0.4 * spread) * scale;
    tips.push([wx + Math.cos(a) * l, wy + Math.sin(a) * l]);
  }
  const bx = sx - 22 * scale; const by = sy + 9 * scale;
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // membrane
  ctx.fillStyle = fill; ctx.strokeStyle = C.outline; ctx.lineWidth = 1.7;
  ctx.beginPath();
  ctx.moveTo(wx, wy);
  ctx.lineTo(tips[0][0], tips[0][1]);
  const mids = [];
  for (let i = 1; i < 4; i++) {
    const mx = (tips[i - 1][0] + tips[i][0]) / 2; const my = (tips[i - 1][1] + tips[i][1]) / 2;
    const cx = mx + (wx - mx) * 0.38; const cy = my + (wy - my) * 0.38;
    mids.push([cx, cy]);
    ctx.quadraticCurveTo(cx, cy, tips[i][0], tips[i][1]);
  }
  ctx.quadraticCurveTo((tips[3][0] + bx) / 2 + (wx - bx) * 0.12, (tips[3][1] + by) / 2 + (wy - by) * 0.12, bx, by);
  ctx.lineTo(sx, sy);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // warmer band near the leading edge + faint veins
  if (!far) {
    ctx.globalAlpha = 0.35; ctx.fillStyle = light;
    ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(tips[0][0], tips[0][1]); ctx.lineTo(tips[1][0], tips[1][1]); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (!far) {
    ctx.strokeStyle = 'rgba(30,8,8,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < mids.length; i++) { ctx.moveTo(wx, wy); ctx.lineTo(mids[i][0], mids[i][1]); }
    ctx.stroke();
  }
  // arm bone + finger bones
  ctx.strokeStyle = C.outline; ctx.lineWidth = 5.6;
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(wx, wy); ctx.stroke();
  ctx.strokeStyle = far ? C.scaleDark : C.scale; ctx.lineWidth = 3.4;
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(wx, wy); ctx.stroke();
  ctx.strokeStyle = C.wingBone; ctx.lineWidth = 2.3;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) { ctx.moveTo(wx, wy); ctx.lineTo(tips[i][0], tips[i][1]); }
  ctx.stroke();
  if (!far) {                                           // knuckle + thumb claw + fingertip claw (the far wing is just a dark shape)
    ctx.fillStyle = C.scale; ctx.strokeStyle = C.outline; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(wx, wy, 3.4, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.claw;
    ctx.beginPath(); ctx.moveTo(wx - 1.5, wy - 2); ctx.lineTo(wx + 5.5, wy - 8 - 3 * spread); ctx.lineTo(wx + 2.2, wy + 0.5); ctx.closePath();
    ctx.moveTo(tips[0][0] + 1.9, tips[0][1]); ctx.arc(tips[0][0], tips[0][1], 1.9, 0, TAU); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

export class BrambleVisual {
  constructor() {
    this.sx = 1; this.sy = 1; this.vsx = 0; this.vsy = 0;
    this.runPhase = 0; this.t = 0;
    this.blinkT = 2; this.blink = 0;
    this.lantern = 0; this.lanternV = 0;     // tail swing
    this.leaf = 0; this.leafV = 0;           // wing spring
    this.tilt = 0;
    this.hurt = 0;
    this.prevVy = 0;
    this.glow = this._makeGlow();
    this.idleT = 0;
    this.landPuff = 0;
  }

  _makeGlow() {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,170,70,0.95)');
    gr.addColorStop(0.35, 'rgba(255,110,40,0.42)');
    gr.addColorStop(1, 'rgba(255,80,20,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return c;
  }

  /** Called by juice.js on gameplay events to kick the springs. */
  kick(name, v = 0) {
    switch (name) {
      case 'jump': this.vsy = 7; this.vsx = -5; this.leafV = 7; break;
      case 'land': {
        const s = Math.min(1, v / 900);
        this.sy = 1 - 0.3 * s; this.sx = 1 + 0.25 * s; this.vsy = 0; this.vsx = 0;
        break;
      }
      case 'glide': this.vsy = 4; this.leafV = 9; break;
      case 'hit': this.hurt = 1; this.vsy = -4; break;
      case 'collect': this.vsy = 3; this.vsx = -2; break;
      default:
    }
  }

  update(dt, run, mode) {
    const p = run.p;
    this.t += dt;
    // springs back to rest (1,1), with a pose target while sliding / dying
    let tx = 1, ty = 1;
    const sliding = run.state === 'running' && p.grounded && p.slideT > 0;
    if (sliding) { tx = 1.22; ty = 0.52; }
    else if (run.state === 'dying' || run.state === 'over') { tx = 1.25; ty = 0.72; }
    else if (mode === 'title') {
      const c = this.t % 7;
      if (c > 5.1 && c < 6.4) { tx = 0.94; ty = 1.12; }   // rears up for a fire-yawn
    }
    const k = 260, d = 17;
    this.vsx += ((tx - this.sx) * k - this.vsx * d) * dt;
    this.vsy += ((ty - this.sy) * k - this.vsy * d) * dt;
    this.sx += this.vsx * dt;
    this.sy += this.vsy * dt;

    if (run.state === 'running' && p.grounded) this.runPhase += run.speed * dt * 0.05;
    else if (run.state === 'running') this.runPhase += dt * 4;

    // blink every few seconds
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blink = 0.13; this.blinkT = 2 + Math.random() * 2.5; }
    if (this.blink > 0) this.blink -= dt;

    // tail swings opposite to vertical acceleration
    const acc = (p.vy - this.prevVy) / Math.max(dt, 1e-3);
    this.prevVy = p.vy;
    const drive = Math.max(-1.2, Math.min(1.2, -acc * 0.0009 - p.vy * 0.0004));
    this.lanternV += ((drive - this.lantern) * 90 - this.lanternV * 7) * dt;
    this.lantern += this.lanternV * dt;

    // wing spring: lifts when rising, trails when falling
    const leafTarget = p.gliding ? 0 : Math.max(-0.7, Math.min(0.7, -p.vy * 0.0007));
    this.leafV += ((leafTarget - this.leaf) * 140 - this.leafV * 9) * dt;
    this.leaf += this.leafV * dt;

    if (this.hurt > 0) this.hurt = Math.max(0, this.hurt - dt);
    const tt = run.state === 'running' && !p.grounded ? Math.max(-0.35, Math.min(0.3, -p.vy * 0.00055)) : 0;
    this.tilt += (tt - this.tilt) * Math.min(1, dt * 12);
  }

  /**
   * @param x,y   screen position of the dragon's feet (logical units)
   * @param py    height above ground (for the shadow)
   */
  draw(ctx, x, y, groundY, py, run, mode) {
    const p = run.p;
    const state = run.state;
    const sleepy = state === 'dying' || state === 'over';
    const sliding = state === 'running' && p.grounded && p.slideT > 0;
    const gliding = state === 'running' && p.gliding;
    const airborne = state === 'running' && !p.grounded;
    const idle = mode === 'title';
    const t = this.t;
    const lite = this.lite = !!quality.cfg.lite;      // slow phones: skip glows, the far wing and fine detail
    const blaze = Math.min(1, (run.glow || 0) / 40);
    const powered = !!(run.pu && (run.pu.dash > 0 || run.pu.burst > 0));

    // ground shadow
    const sh = Math.max(0.35, 1 - py / 220);
    ctx.fillStyle = 'rgba(10,4,8,0.34)';
    ctx.beginPath(); ctx.ellipse(x - 18, groundY + 2, 38 * sh * (sliding ? 1.3 : 1), 5.5 * sh, 0, 0, TAU); ctx.fill();

    // invulnerability blink
    let alpha = 1;
    if (state === 'running' && run.invuln > 0) alpha = (Math.floor(t * 14) % 2) ? 0.45 : 1;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x - 18, y);       // body is long: chest and forelegs sit under the hitbox, the head leads it
    let wob = 0;
    if (this.hurt > 0) wob = Math.sin(t * 38) * 0.22 * this.hurt;
    ctx.rotate(this.tilt + wob);
    ctx.scale(this.sx, this.sy);

    const ph = this.runPhase;
    const bounce = p.grounded && state === 'running' && !sliding ? Math.abs(Math.sin(ph * 2)) * 2.6 : 0;
    const breathe = idle || sleepy ? Math.sin(t * 2.4) * 0.9 : 0;
    ctx.translate(0, -bounce);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';

    const legState = sleepy ? 'sleep' : sliding ? 'slide' : (state === 'running' && p.grounded) ? 'run' : idle ? 'stand' : 'air';
    const spread = sleepy ? 0.06 : gliding ? 1 : airborne ? 0.4 + Math.min(0.5, Math.abs(this.leaf) * 0.9) : 0.26 + Math.abs(this.leaf) * 0.5;
    const flap = sleepy ? 0.3 : gliding ? Math.sin(t * 22) * 0.16 : this.leaf * 0.9;

    // ---- far wing and far legs (behind the body)
    if (!lite) {
        ctx.save(); ctx.globalAlpha = alpha * 0.9;
        wing(ctx, -1, -38, spread, flap - 0.16, 1.2, C.wingDark, C.wingLight, true);
        ctx.restore();
    }
    this._leg(ctx, -12, -25, ph, legState, true, false);
    this._leg(ctx, 15, -27, ph + Math.PI, legState, true, true);

    // ---- spine: tail -> hips -> back -> chest -> neck -> head base
    const sway = Math.sin(ph * 2 + 1) * 0.35 + (idle ? Math.sin(t * 2.2) * 0.25 : 0) + (p.grounded ? 0 : -0.5) + this.lantern * 0.5;
    const lowHead = sleepy ? 14 : sliding ? 21 : 0;
    const fwd = sliding ? 7 : 0;
    const P = [
      [-68, -5 + sway * 14, 1.4],
      [-52, -13 + sway * 9, 4.2],
      [-35, -20 + sway * 4, 9],
      [-19, -27, 16],
      [-3, -32 + breathe * 0.3, 20],
      [11, -32 + breathe * 0.4, 22],
      [19, -40 + breathe * 0.6 + lowHead * 0.3, 15],
      [23 + fwd * 0.5, -50 + breathe * 0.8 + lowHead * 0.6, 11.5],
      [27 + fwd * 0.8, -58 + breathe + lowHead, 10],
      [30 + fwd, -63 + breathe + lowHead, 10],
    ];
    const S = catmull(P, 6);
    const N = S.length;
    const nr = [];
    for (let i = 0; i < N; i++) {
      const a = S[Math.max(0, i - 1)]; const b = S[Math.min(N - 1, i + 1)];
      let tx = b[0] - a[0]; let ty = b[1] - a[1];
      const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      nr.push([-ty, tx, tx, ty]);
    }

    // dorsal spines (drawn first so the body hides their roots)
    ctx.fillStyle = blaze > 0.05 ? blazeColor(blaze) : C.spine; ctx.strokeStyle = C.outline; ctx.lineWidth = 1.2;
    ctx.beginPath();                                    // every spine in one path: a single fill and a single stroke
    for (let i = 6; i < N - 5; i += 3) {
      const [px, py, w] = S[i]; const [nx, ny, tx, ty] = nr[i];
      const h = i < 18 ? 3 + i * 0.28 : i < 36 ? 9.5 : lerp(9.5, 4.5, (i - 36) / (N - 1 - 36));
      const b0x = px - nx * w * 0.46; const b0y = py - ny * w * 0.46;
      ctx.moveTo(b0x - tx * 3.4, b0y - ty * 3.4);
      ctx.lineTo(b0x - nx * h - tx * h * 0.6, b0y - ny * h - ty * h * 0.6);
      ctx.lineTo(b0x + tx * 3.4, b0y + ty * 3.4);
      ctx.closePath();
    }
    ctx.fill(); ctx.stroke();

    // body polygon
    ctx.fillStyle = C.scale; ctx.strokeStyle = C.outline; ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (let i = 0; i < N; i++) { const [px, py, w] = S[i]; const [nx, ny] = nr[i]; const X = px - nx * w / 2; const Y = py - ny * w / 2; if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y); }
    for (let i = N - 1; i >= 0; i--) { const [px, py, w] = S[i]; const [nx, ny] = nr[i]; ctx.lineTo(px + nx * w / 2, py + ny * w / 2); }
    ctx.closePath(); ctx.fill(); ctx.stroke();

    // back highlight and a few scale marks
    if (!lite) {
      ctx.strokeStyle = C.scaleLight; ctx.globalAlpha = alpha * 0.5; ctx.lineWidth = 2.6;
      ctx.beginPath();
      let started = false;
      for (let i = 14; i < N - 6; i++) { const [px, py, w] = S[i]; const [nx, ny] = nr[i]; const X = px - nx * w * 0.27; const Y = py - ny * w * 0.27; if (!started) { ctx.moveTo(X, Y); started = true; } else ctx.lineTo(X, Y); }
      ctx.stroke();
      ctx.globalAlpha = alpha * 0.28; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.1;
      ctx.beginPath();
      for (let i = 16; i < N - 8; i += 4) { const [px, py, w] = S[i]; const [nx, ny] = nr[i]; const r = w * 0.2; ctx.moveTo(px - nx * w * 0.02 - r, py - ny * w * 0.02); ctx.arc(px - nx * w * 0.02, py - ny * w * 0.02, r, Math.PI, 0, true); }
      ctx.stroke();
      ctx.globalAlpha = alpha;
    }

    // gold belly plates (hips to chin)
    let b0 = 0; while (b0 < N - 1 && S[b0][0] < -24) b0++;
    ctx.fillStyle = C.belly; ctx.strokeStyle = C.bellyDark; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = b0; i < N - 2; i++) { const [px, py, w] = S[i]; const [nx, ny] = nr[i]; const X = px + nx * (w * 0.5 - 0.9); const Y = py + ny * (w * 0.5 - 0.9); if (i === b0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y); }
    for (let i = N - 3; i >= b0; i--) { const [px, py, w] = S[i]; const [nx, ny] = nr[i]; ctx.lineTo(px + nx * w * 0.06, py + ny * w * 0.06); }
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    for (let i = b0 + 1; i < N - 3; i += 3) { const [px, py, w] = S[i]; const [nx, ny] = nr[i]; ctx.moveTo(px + nx * w * 0.06, py + ny * w * 0.06); ctx.lineTo(px + nx * (w * 0.5 - 0.9), py + ny * (w * 0.5 - 0.9)); }
    ctx.stroke();
    // plates catch the light (and burn when blazing)
    if (!lite) {
      ctx.strokeStyle = blaze > 0.05 ? C.emberHot : C.bellyLight; ctx.globalAlpha = alpha * (0.5 + 0.5 * blaze); ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = b0 + 2; i < N - 4; i++) { const [px, py, w] = S[i]; const [nx, ny] = nr[i]; const X = px + nx * w * 0.34; const Y = py + ny * w * 0.34; if (i === b0 + 2) ctx.moveTo(X, Y); else ctx.lineTo(X, Y); }
      ctx.stroke();
      ctx.globalAlpha = alpha;
    }
    // embedded gems
    if (!sleepy && !lite) {
      const gem = (i, col) => { const [px, py, w] = S[i]; const [nx, ny] = nr[i]; const X = px + nx * w * 0.34; const Y = py + ny * w * 0.34; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X, Y, 1.5, 0, TAU); ctx.fill(); };
      gem(b0 + 6, '#7fe0ff'); gem(b0 + 14, '#ff4a5a'); gem(b0 + 22, '#8cff9a');
    }
    // chest fire glow
    if (this.glow && !lite && (blaze > 0.02 || idle)) {
      const gs = 30 + blaze * 50 + Math.sin(t * 6) * 2;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.3 + blaze * 0.6;
      ctx.drawImage(this.glow, 13 - gs / 2, -24 - gs / 2, gs, gs); ctx.restore();
    }

    // tail tip: a bone barb that smoulders
    {
      const [ex, ey] = S[0]; const [nx2, ny2, tx2, ty2] = nr[0];
      ctx.fillStyle = C.horn; ctx.strokeStyle = C.outline; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(ex + tx2 * 3, ey + ty2 * 3 - 3); ctx.lineTo(ex - tx2 * 9, ey - ty2 * 9); ctx.lineTo(ex + tx2 * 3, ey + ty2 * 3 + 3); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (this.glow && !lite && (blaze > 0 || idle)) {
        const gs = 34 + blaze * 34 + Math.sin(t * 7) * 3;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.45 + blaze * 0.5;
        ctx.drawImage(this.glow, ex - 4 - gs / 2, ey - gs / 2, gs, gs); ctx.restore();
      }
    }

    // ---- near legs
    this._leg(ctx, -16, -25, ph + Math.PI, legState, false, false);
    this._leg(ctx, 12, -27, ph, legState, false, true);

    // ---- near wing
    wing(ctx, 5, -39, spread, flap, 1.3, C.wing, C.wingLight, false);

    // ---- head
    const hb = S[N - 1];
    let headAng = 0.14;
    if (sleepy) headAng = 0.62;
    else if (airborne) headAng = 0.14 - Math.max(-0.2, Math.min(0.25, p.vy * 0.0003));
    else if (state === 'running' && !sliding) headAng += Math.sin(ph * 2 + 0.6) * 0.05;
    else if (sliding) headAng = 0.04;
    const yawnT = idle ? (t % 7) : 0;
    const yawn = idle && yawnT > 5.1 && yawnT < 6.4;
    const open = yawn || (airborne && !gliding) || this.hurt > 0.2 || powered;
    const breath = powered ? 1 : yawn ? Math.sin(((yawnT - 5.1) / 1.3) * Math.PI) : 0;
    this._head(ctx, hb[0], hb[1], headAng, open, blaze, breath, this.blink > 0 || sleepy, sleepy, idle, t, alpha);

    // ---- hurt sparks
    if (this.hurt > 0.15) {
      ctx.fillStyle = '#ffb347';
      for (let i = 0; i < 3; i++) {
        const a = t * 9 + (i * TAU) / 3;
        this._miniStar(ctx, hb[0] + Math.cos(a) * 17, hb[1] - 28 + Math.sin(a) * 5, 4.2);
      }
    }
    ctx.restore();

    // ember shield (soft rescue after a fall)
    if (run.bubble) {
      ctx.save();
      const g = ctx.createRadialGradient(x - 24, y - 44, 4, x - 16, y - 33, 62);
      g.addColorStop(0, 'rgba(255,220,150,0.35)'); g.addColorStop(0.7, 'rgba(255,120,50,0.18)'); g.addColorStop(1, 'rgba(255,90,30,0.6)');
      ctx.fillStyle = g; ctx.strokeStyle = 'rgba(255,190,110,0.95)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x - 16, y - 33, 62 + Math.sin(t * 6) * 1.4, 46 + Math.sin(t * 6) * 1.2, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }

  /** A wedge-shaped, horned dragon head. Origin = back of the skull where the neck joins; +x = forward. */
  _head(ctx, hx, hy, ang, open, blaze, breath, eyesShut, sleepy, idle, t, alpha) {
    ctx.save();
    ctx.translate(hx, hy); ctx.rotate(ang); ctx.scale(1.18, 1.18);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const out = C.outline;

    // horns and cheek spikes first (their roots hide behind the skull)
    ctx.fillStyle = C.horn; ctx.strokeStyle = out; ctx.lineWidth = 1.7;
    const hw = this.leaf * 0.12;
    ctx.beginPath();                                      // two swept horns and two cheek spikes: one path, one fill, one stroke
    ctx.moveTo(-2, -8.5); ctx.quadraticCurveTo(-15, -20 + hw * 14, -34, -14 + hw * 26); ctx.quadraticCurveTo(-17, -10.5, -9, -2); ctx.closePath();
    ctx.moveTo(-5, -5); ctx.quadraticCurveTo(-16, -9 + hw * 8, -27, -3.5 + hw * 14); ctx.quadraticCurveTo(-15, -2, -9, 2); ctx.closePath();
    ctx.moveTo(-5, 4); ctx.lineTo(-15, 10); ctx.lineTo(-6, 8.5); ctx.closePath();
    ctx.moveTo(-3, 6.5); ctx.lineTo(-11, 15); ctx.lineTo(-1, 10.5); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.hornDark;
    ctx.beginPath(); ctx.moveTo(-8, -9); ctx.lineTo(-15, -13); ctx.lineTo(-11, -8); ctx.closePath(); ctx.fill();

    // mouth interior (visible when the jaw drops)
    const ja = open ? 0.46 : 0.03;
    const pvx = -3; const pvy = 5.5;
    const rot = (px, py) => [pvx + px * Math.cos(ja) - py * Math.sin(ja), pvy + px * Math.sin(ja) + py * Math.cos(ja)];
    if (open) {
      const jt = rot(23, 2.2); const jm = rot(8, -1.2);
      ctx.fillStyle = blaze > 0.05 || breath > 0 ? '#ff6a2a' : '#7a1418';
      ctx.beginPath(); ctx.moveTo(-3, 5.5); ctx.lineTo(8, 4.4); ctx.lineTo(23.5, 3.4); ctx.lineTo(jt[0], jt[1]); ctx.lineTo(jm[0], jm[1]); ctx.closePath(); ctx.fill();
    }
    // lower jaw
    ctx.save(); ctx.translate(pvx, pvy); ctx.rotate(ja);
    ctx.fillStyle = C.scaleDark; ctx.strokeStyle = out; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(-3, -1); ctx.lineTo(-1, 3.8); ctx.lineTo(8, 4.8); ctx.lineTo(20, 4.4); ctx.lineTo(24.5, 2.2); ctx.lineTo(22, -0.8); ctx.lineTo(8, -1.5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.belly; ctx.beginPath(); ctx.moveTo(0, 2.6); ctx.lineTo(8, 3.6); ctx.lineTo(19, 3.3); ctx.lineTo(17, 4.2); ctx.lineTo(8, 4.4); ctx.lineTo(0, 3.4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = C.claw;                                           // lower fangs
    ctx.beginPath(); ctx.moveTo(14, -1.2); ctx.lineTo(15.4, -4.4); ctx.lineTo(17, -1.2); ctx.closePath();
    ctx.moveTo(20, -1); ctx.lineTo(21.2, -3.6); ctx.lineTo(22.6, -1); ctx.closePath(); ctx.fill();
    ctx.restore();

    // skull + snout
    ctx.fillStyle = C.scale; ctx.strokeStyle = out; ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-8, 3);
    ctx.bezierCurveTo(-11, -4, -6, -9, 1, -9.5);
    ctx.lineTo(8, -8);
    ctx.quadraticCurveTo(14, -7.5, 18, -5);
    ctx.lineTo(25, -3);
    ctx.quadraticCurveTo(27.5, -1.5, 26.5, 1.8);
    ctx.lineTo(23, 3.2);
    ctx.lineTo(8, 4.2);
    ctx.quadraticCurveTo(2, 5.2, -4, 6);
    ctx.quadraticCurveTo(-9, 6.5, -8, 3);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // top-of-snout highlight and cheek shade
    ctx.strokeStyle = C.scaleLight; ctx.globalAlpha = alpha * 0.55; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(-1, -8); ctx.quadraticCurveTo(10, -7.2, 24, -2.6); ctx.stroke();
    ctx.globalAlpha = alpha * 0.4; ctx.fillStyle = C.scaleDark;
    ctx.beginPath(); ctx.moveTo(-7, 1); ctx.quadraticCurveTo(-1, 6, 7, 3.4); ctx.lineTo(3, 1.4); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = alpha;
    // snout ridge horn
    ctx.fillStyle = C.horn; ctx.strokeStyle = out; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(14, -7); ctx.lineTo(17.4, -11.4); ctx.lineTo(19.2, -5.4); ctx.closePath(); ctx.fill(); ctx.stroke();
    // upper fangs (hang over the jaw: a permanent snarl)
    ctx.fillStyle = C.claw; ctx.strokeStyle = out; ctx.lineWidth = 0.9;
    const fx = [9.5, 13.5, 17.5, 21.5]; const fl = [3, 3.4, 3.8, 5.8];
    ctx.beginPath();
    for (let i = 0; i < 4; i++) { ctx.moveTo(fx[i] - 1.7, 4.1); ctx.lineTo(fx[i] + 0.2, 4.1 + fl[i]); ctx.lineTo(fx[i] + 1.7, 4.1); ctx.closePath(); }
    ctx.fill(); ctx.stroke();
    // nostril
    ctx.fillStyle = C.eyeCore; ctx.beginPath(); ctx.ellipse(22.8, -1, 1.7, 1.1, -0.4, 0, TAU); ctx.fill();

    // brow + eye
    ctx.fillStyle = C.scaleDark; ctx.strokeStyle = out; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(-3, -9.2); ctx.lineTo(10, -6.6); ctx.lineTo(12.4, -3.8); ctx.lineTo(1, -5.6); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (eyesShut) {
      ctx.strokeStyle = C.eyeCore; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(0.5, -4.3); ctx.lineTo(11, -2.7 + (sleepy ? 1.4 : 0)); ctx.stroke();
    } else {
      ctx.fillStyle = C.eye; ctx.strokeStyle = out; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(0.2, -4.2); ctx.quadraticCurveTo(5.2, -6.2, 11, -2.6); ctx.quadraticCurveTo(5.6, -0.6, 0.2, -4.2); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = C.eyeCore; ctx.beginPath(); ctx.ellipse(6.1, -3.5, 1.05, 2.5, 0.1, 0, TAU); ctx.fill();
      if (this.glow && !this.lite) {
        const gs = 16 + blaze * 12;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.4 + blaze * 0.5;
        ctx.drawImage(this.glow, 6 - gs / 2, -3.5 - gs / 2, gs, gs); ctx.restore();
      }
    }

    // smoke from the nostrils when idle or blazing
    if ((idle || blaze > 0.1) && !sleepy && breath <= 0) {
      ctx.fillStyle = 'rgba(200,190,190,0.6)';
      for (let i = 0; i < 2; i++) {
        const ph2 = ((t * 0.9 + i * 0.5) % 1);
        ctx.globalAlpha = alpha * (1 - ph2) * 0.6;
        ctx.beginPath(); ctx.arc(26 + ph2 * 8, -3 - ph2 * 13, 1.8 + ph2 * 3.2, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = alpha;
    }

    // fire breath
    if (breath > 0.02) {
      const jt = rot(22, 1.2);
      ctx.save(); ctx.translate(jt[0] - 1, jt[1] - 1.2 + (open ? 0 : 0)); ctx.globalCompositeOperation = 'lighter';
      const cols = ['rgba(255,90,30,0.75)', 'rgba(255,165,55,0.85)', 'rgba(255,238,170,0.95)'];
      for (let k = 0; k < 3; k++) {
        const L = (34 - k * 7 + Math.sin(t * 24 + k * 2) * 4) * breath;
        const wd = (10 - k * 2.6) * breath;
        ctx.fillStyle = cols[k];
        ctx.beginPath(); ctx.moveTo(0, -1.6 * (1 - k * 0.25));
        ctx.quadraticCurveTo(L * 0.55, -wd, L, Math.sin(t * 20 + k) * 2.4);
        ctx.quadraticCurveTo(L * 0.55, wd, 0, 2.4 * (1 - k * 0.25)); ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  /**
   * One leg. kind: hind (big haunch, digitigrade) or fore (taloned arm). state: run | stand | slide | sleep | air.
   * Hips/shoulders are given in body space; the foot goes where the gait says and a two-bone solve bends the leg.
   */
  _leg(ctx, hx, hy, phase, state, far, fore) {
    const sw = Math.sin(phase * 2); const lift = Math.max(0, Math.cos(phase * 2));
    let fx; let fy;
    switch (state) {
      case 'run': fx = hx + (fore ? 6 : 3) + sw * 11; fy = -lift * (fore ? 9 : 10); break;
      case 'stand': fx = hx + (fore ? 6 : 3); fy = 0; break;
      case 'slide': fx = hx + (fore ? 14 : -8); fy = -2; break;
      case 'sleep': fx = hx + (fore ? 12 : -5); fy = -1; break;
      default: fx = hx + (fore ? 14 : -15); fy = fore ? -19 : -13; break;   // air: forelegs reach, hind legs trail
    }
    const colBody = far ? C.scaleDark : C.scale;
    ctx.save();
    ctx.fillStyle = colBody; ctx.strokeStyle = C.outline; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    let segs; let blob;
    if (!fore) {
      const ax = fx - 4; const ay = fy - 10;                                       // ankle: up and behind the foot
      const kx = (hx + ax) / 2 + 9; const ky = (hy + ay) / 2 - 2;                  // knee bulges forward
      blob = [hx + 1, hy + 4, 11, 10.5, -0.4];                                     // the haunch
      segs = [[hx + 1, hy + 5, kx, ky, 11], [kx, ky, ax, ay, 6.8], [ax, ay, fx, fy - 1, 5.2]];
    } else {
      const kx = (hx + fx) / 2 - 5; const ky = (hy + fy) / 2;                      // elbow bends back
      blob = [hx, hy + 2, 8.5, 8.5, 0];
      segs = [[hx, hy + 2, kx, ky, 8], [kx, ky, fx, fy - 1, 5.2]];
    }
    // the whole limb is ONE path (haunch + a tapered quad per bone + a round joint at each end), filled twice:
    // outline colour a hair bigger, then body colour. Two raster passes per limb instead of a dozen.
    const limb = (grow) => {
      ctx.beginPath();
      ctx.ellipse(blob[0], blob[1], blob[2] + grow, blob[3] + grow, blob[4], 0, TAU);
      for (let i = 0; i < segs.length; i++) {
        const [x0, y0, x1, y1, w] = segs[i];
        const dx = x1 - x0; const dy = y1 - y0; const l = Math.hypot(dx, dy) || 1;
        const hw = w / 2 + grow; const nx = (-dy / l) * hw; const ny = (dx / l) * hw;
        ctx.moveTo(x0 - nx, y0 - ny); ctx.lineTo(x1 - nx, y1 - ny); ctx.lineTo(x1 + nx, y1 + ny); ctx.lineTo(x0 + nx, y0 + ny); ctx.closePath();
        ctx.moveTo(x1 + hw, y1); ctx.arc(x1, y1, hw, 0, TAU);
      }
    };
    ctx.fillStyle = C.outline; limb(1.5); ctx.fill();
    ctx.fillStyle = colBody; limb(0); ctx.fill();
    // muscle highlight on the haunch / upper arm (the far limbs stay dark)
    if (!far) {
      ctx.fillStyle = C.scaleLight; ctx.globalAlpha = 0.35;
      ctx.beginPath(); ctx.ellipse(blob[0] - 1.5, blob[1] - 2.2, blob[2] * 0.55, blob[3] * 0.4, -0.5, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // foot pad and talons
    ctx.fillStyle = colBody; ctx.strokeStyle = C.outline; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.ellipse(fx + 3, fy - 1.2, 6.5, 3.4, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.claw; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 0; k < 3; k++) {
      const by = fy - 3 + k * 2.4;
      ctx.moveTo(fx + 7, by - 1.4); ctx.lineTo(fx + 13.5, by + 0.8 + (state === 'air' ? 1 : 0)); ctx.lineTo(fx + 7, by + 1.6); ctx.closePath();
    }
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  _miniStar(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      const rr = i % 2 ? r * 0.45 : r;
      const px = x + Math.cos(a) * rr; const py = y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
  }
}
