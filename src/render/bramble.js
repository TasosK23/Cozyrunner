/**
 * bramble.js — draws Bramble, drawn entirely with canvas paths (no images).
 *
 * Bramble: a round, fluffy, moss-green fox-like critter with pointed ears, a big leaf on its head,
 * a bushy tail, and a small lantern swinging on a stick.
 *
 * Animation toolbox:
 *  - squash & stretch via two springs (sx, sy) kicked on jump / land / slide
 *  - run cycle (legs, bounce, tail wag), blinking, leaf wobble, lantern pendulum
 *  - poses: run, jump, fall, glide (leaf spins like a little propeller), slide (belly-flop pancake),
 *           hurt (wobble + dizzy stars), idle (breathing + yawn), sleepy (game over flop + zzz)
 */
const TAU = Math.PI * 2;
const C = {
  body: '#8ebd6b', bodyDark: '#6c9d58', outline: '#4f7a42', belly: '#eef5cc', ear: '#f2b9a9',
  cheek: '#f5a3a0', eye: '#3a2d28', leaf: '#a9db6f', leafDark: '#6fae4a', stick: '#a97d52',
  tail: '#7aa95f', tailTip: '#f6f1cf', lantern: '#ffd980', lanternFrame: '#8a5a2b', foot: '#6a9854',
};

/** A slightly wobbly (fluffy) ellipse. */
function fuzzyEllipse(ctx, cx, cy, rx, ry, bumps, amp, phase) {
  const n = 40;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    const k = 1 + amp * Math.sin(a * bumps + phase);
    const x = cx + Math.cos(a) * rx * k;
    const y = cy + Math.sin(a) * ry * k;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export class BrambleVisual {
  constructor() {
    this.sx = 1; this.sy = 1; this.vsx = 0; this.vsy = 0;
    this.runPhase = 0; this.t = 0;
    this.blinkT = 2; this.blink = 0;
    this.lantern = 0; this.lanternV = 0;
    this.leaf = 0; this.leafV = 0;
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
    gr.addColorStop(0, 'rgba(255,226,140,0.95)');
    gr.addColorStop(0.35, 'rgba(255,200,100,0.40)');
    gr.addColorStop(1, 'rgba(255,190,90,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return c;
  }

  /** Called by juice.js on gameplay events to kick the springs. */
  kick(name, v = 0) {
    switch (name) {
      case 'jump': this.vsy = 7; this.vsx = -5; break;
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
    if (sliding) { tx = 1.28; ty = 0.56; }
    else if (run.state === 'dying' || run.state === 'over') { tx = 1.25; ty = 0.72; }
    else if (mode === 'title') {
      const c = this.t % 7;
      if (c > 5.1 && c < 6.4) { tx = 0.94; ty = 1.12; }   // a big sleepy stretch
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

    // lantern swings opposite to vertical acceleration
    const acc = (p.vy - this.prevVy) / Math.max(dt, 1e-3);
    this.prevVy = p.vy;
    const drive = Math.max(-1.2, Math.min(1.2, -acc * 0.0009 - p.vy * 0.0004));
    this.lanternV += ((drive - this.lantern) * 90 - this.lanternV * 7) * dt;
    this.lantern += this.lanternV * dt;

    // leaf wobble
    const leafTarget = p.gliding ? 0 : Math.max(-0.7, Math.min(0.7, -p.vy * 0.0007));
    this.leafV += ((leafTarget - this.leaf) * 140 - this.leafV * 9) * dt;
    this.leaf += this.leafV * dt;

    if (this.hurt > 0) this.hurt = Math.max(0, this.hurt - dt);
    const tt = run.state === 'running' && !p.grounded ? Math.max(-0.35, Math.min(0.3, -p.vy * 0.00055)) : 0;
    this.tilt += (tt - this.tilt) * Math.min(1, dt * 12);
  }

  /**
   * @param x,y   screen position of Bramble's feet (logical units)
   * @param py    height above ground (for the shadow)
   */
  draw(ctx, x, y, groundY, py, run, mode) {
    const p = run.p;
    const state = run.state;
    const sleepy = state === 'dying' || state === 'over';
    const sliding = state === 'running' && p.grounded && p.slideT > 0;
    const gliding = state === 'running' && p.gliding;
    const idle = mode === 'title';
    const t = this.t;

    // ground shadow
    const sh = Math.max(0.35, 1 - py / 220);
    ctx.fillStyle = 'rgba(70,50,30,0.20)';
    ctx.beginPath(); ctx.ellipse(x, groundY + 2, 22 * sh * (sliding ? 1.4 : 1), 5 * sh, 0, 0, TAU); ctx.fill();

    // invulnerability blink / bubble
    let alpha = 1;
    if (state === 'running' && run.invuln > 0) alpha = (Math.floor(t * 14) % 2) ? 0.45 : 1;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    let wob = 0;
    if (this.hurt > 0) wob = Math.sin(t * 38) * 0.28 * this.hurt;
    ctx.rotate(this.tilt + wob);
    ctx.scale(this.sx, this.sy);

    const ph = this.runPhase;
    const bounce = p.grounded && state === 'running' && !sliding ? Math.abs(Math.sin(ph * 2)) * 2.4 : 0;
    const breathe = idle || sleepy ? Math.sin(t * 2.4) * 0.8 : 0;
    ctx.translate(0, -bounce);

    // ---- tail (behind)
    const wag = Math.sin(ph * 2 + 1) * 0.25 + (idle ? Math.sin(t * 3) * 0.18 : 0) + (p.grounded ? 0 : -0.4);
    ctx.save();
    ctx.translate(-20, -22); ctx.rotate(-0.5 + wag);
    ctx.fillStyle = C.tail; ctx.strokeStyle = C.outline; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(-9, 0, 15, 9, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.tailTip;
    ctx.beginPath(); ctx.ellipse(-19, 0, 6.5, 6.5, 0, 0, TAU); ctx.fill();
    ctx.restore();

    // ---- back leg
    this._leg(ctx, -8, ph + Math.PI, p.grounded && !sliding, sleepy);

    // ---- ears (behind head)
    const earWig = Math.sin(t * 3.1) * 0.05 + (state === 'running' ? -p.vy * 0.0002 : 0);
    this._ear(ctx, -13, -43, -0.35 + earWig);
    this._ear(ctx, 11, -44, 0.3 + earWig);

    // ---- body
    ctx.fillStyle = C.body; ctx.strokeStyle = C.outline; ctx.lineWidth = 2.2;
    fuzzyEllipse(ctx, 0, -26 + breathe * 0.3, 24, 22 + breathe * 0.4, 14, 0.04, t * 0.8);
    ctx.fill(); ctx.stroke();
    // belly
    ctx.fillStyle = C.belly;
    ctx.beginPath(); ctx.ellipse(1, -18, 14, 12.5, 0, 0, TAU); ctx.fill();

    // ---- face
    ctx.fillStyle = C.cheek; ctx.globalAlpha = alpha * 0.75;
    ctx.beginPath(); ctx.ellipse(-14, -22, 4.6, 3.2, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(15, -22, 4.6, 3.2, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = alpha;
    const yawn = idle && (t % 7) > 5.1 && (t % 7) < 6.4;
    const closed = this.blink > 0 || sleepy || yawn;
    ctx.strokeStyle = C.eye; ctx.fillStyle = C.eye; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    if (closed) {
      ctx.beginPath(); ctx.moveTo(-12, -31); ctx.quadraticCurveTo(-8, sleepy ? -28 : -33, -4, -31); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(6, -31); ctx.quadraticCurveTo(10, sleepy ? -28 : -33, 14, -31); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.ellipse(-8, -31, 3.5, 4.6, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(10, -31, 3.5, 4.6, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-7, -33, 1.3, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(11, -33, 1.3, 0, TAU); ctx.fill();
    }
    // mouth
    ctx.strokeStyle = C.eye; ctx.lineWidth = 1.8;
    if (yawn) {
      ctx.fillStyle = '#7a3b34'; ctx.beginPath(); ctx.ellipse(1, -22, 4.5, 5.5, 0, 0, TAU); ctx.fill();
    } else if (state === 'running' && !p.grounded && !gliding) {
      ctx.fillStyle = '#7a3b34'; ctx.beginPath(); ctx.ellipse(1, -22.5, 2.6, 3, 0, 0, TAU); ctx.fill();
    } else if (this.hurt > 0.2) {
      ctx.beginPath(); ctx.moveTo(-3, -21); ctx.quadraticCurveTo(1, -24, 5, -21); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(-3, -23); ctx.quadraticCurveTo(1, -20, 5, -23); ctx.stroke();
    }

    // ---- front leg
    this._leg(ctx, 8, ph, p.grounded && !sliding, sleepy);

    // ---- leaf on head
    ctx.save();
    ctx.translate(1, -47);
    const flutter = gliding ? Math.sin(t * 34) * 0.55 : 0;
    ctx.rotate(-0.3 + this.leaf * 1.2 + flutter + (state === 'running' ? 0 : Math.sin(t * 1.6) * 0.06) + (sleepy ? 0.7 : 0));
    const ls = gliding ? 1.5 : 1;
    ctx.fillStyle = C.leaf; ctx.strokeStyle = C.leafDark; ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-5 * ls, -9 * ls, 4 * ls, -22 * ls, 17 * ls, -20 * ls);
    ctx.bezierCurveTo(19 * ls, -8 * ls, 9 * ls, 2 * ls, 0, 0);
    ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(1, -1); ctx.quadraticCurveTo(8 * ls, -7 * ls, 15 * ls, -18 * ls); ctx.stroke();
    ctx.restore();

    // ---- lantern on a stick (held out in front)
    this._lantern(ctx, run, t);

    // ---- dizzy stars when hurt
    if (this.hurt > 0.15) {
      ctx.fillStyle = '#ffe27a';
      for (let i = 0; i < 3; i++) {
        const a = t * 9 + (i * TAU) / 3;
        this._miniStar(ctx, Math.cos(a) * 17, -62 + Math.sin(a) * 4.5, 4.2);
      }
    }
    ctx.restore();

    // bubble (soft rescue after a fall)
    if (run.bubble) {
      ctx.save();
      ctx.globalAlpha = 0.6;
      const g = ctx.createRadialGradient(x - 8, y - 38, 4, x, y - 26, 38);
      g.addColorStop(0, 'rgba(255,255,255,0.8)'); g.addColorStop(0.7, 'rgba(190,230,255,0.25)'); g.addColorStop(1, 'rgba(160,215,255,0.55)');
      ctx.fillStyle = g; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(x, y - 26, 38 + Math.sin(t * 6) * 1.2, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.restore();
    }

    // sleepy zzz handled by juice (particles); nothing else to draw
  }

  _leg(ctx, baseX, phase, running, sleepy) {
    ctx.fillStyle = C.foot; ctx.strokeStyle = C.outline; ctx.lineWidth = 1.8;
    let lx = baseX, ly = -4;
    if (running) { lx += Math.sin(phase * 2) * 7; ly -= Math.max(0, Math.cos(phase * 2)) * 6; }
    else if (!sleepy) { ly = -9; lx = baseX * 0.8 + (baseX > 0 ? 2 : -2); }
    ctx.beginPath(); ctx.ellipse(lx, ly, 7.5, 5, 0, 0, TAU); ctx.fill(); ctx.stroke();
  }

  _ear(ctx, x, y, rot) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot);
    ctx.fillStyle = C.body; ctx.strokeStyle = C.outline; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-7, 2); ctx.quadraticCurveTo(-6, -13, 1, -19); ctx.quadraticCurveTo(8, -12, 8, 2); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = C.ear;
    ctx.beginPath(); ctx.moveTo(-3.5, 1); ctx.quadraticCurveTo(-3, -9, 1, -13); ctx.quadraticCurveTo(4.5, -8, 4.5, 1); ctx.closePath(); ctx.fill();
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

  _lantern(ctx, run, t) {
    const glowBoost = Math.min(1, run.glow / 60);
    ctx.strokeStyle = C.stick; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(11, -20); ctx.lineTo(33, -50); ctx.stroke();
    const ang = this.lantern;
    const lx = 33 + Math.sin(ang) * 9;
    const ly = -50 + Math.cos(ang) * 9 + 4;
    ctx.lineWidth = 1.2; ctx.strokeStyle = '#6b4a2b';
    ctx.beginPath(); ctx.moveTo(33, -50); ctx.lineTo(lx, ly - 7); ctx.stroke();
    if (this.glow) {
      const gs = 62 + glowBoost * 40 + Math.sin(t * 5) * 2;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.65 + glowBoost * 0.35;
      ctx.drawImage(this.glow, lx - gs / 2, ly - gs / 2, gs, gs);
      ctx.restore();
    }
    ctx.fillStyle = C.lantern; ctx.strokeStyle = C.lanternFrame; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(lx - 5.5, ly - 7, 11, 14, 4) : ctx.rect(lx - 5.5, ly - 7, 11, 14);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff6c9';
    ctx.beginPath(); ctx.ellipse(lx, ly, 2.4, 3.6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = C.lanternFrame;
    ctx.fillRect(lx - 4, ly - 9, 8, 2.6);
  }
}
