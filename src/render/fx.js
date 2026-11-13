/**
 * fx.js — pooled particles and floating text. Nothing is allocated while playing: a fixed array
 * of particle slots is reused, and quality.js can lower how many may be alive at once.
 * Positions are in WORLD units (x along the course, y = height above ground).
 */
export const K = { DOT: 0, SPARK: 1, CONFETTI: 2, PUFF: 3, LEAF: 4, RING: 5, ZZZ: 6, STAR: 7 };

const TAU = Math.PI * 2;

export class FX {
  constructor(max = 240, popMax = 14) {
    this.parts = Array.from({ length: max }, () => ({
      on: false, k: 0, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 4, rot: 0, spin: 0, color: '#fff', g: 0, drag: 0,
    }));
    this.pops = Array.from({ length: popMax }, () => ({
      on: false, text: '', x: 0, y: 0, vy: 0, life: 0, max: 1, color: '#fff', size: 22,
    }));
    this.limit = max;
    this.count = 0;
    this.cursor = 0;
    this.popCursor = 0;
  }

  setLimit(n) { this.limit = Math.min(n, this.parts.length); }

  spawn(k, x, y, vx, vy, life, size, color, g = 0, spin = 0, drag = 0) {
    if (this.count >= this.limit) return null;
    const n = this.parts.length;
    for (let i = 0; i < n; i++) {
      const j = (this.cursor + i) % n;
      const q = this.parts[j];
      if (q.on) continue;
      q.on = true; q.k = k; q.x = x; q.y = y; q.vx = vx; q.vy = vy; q.life = life; q.max = life;
      q.size = size; q.color = color; q.g = g; q.spin = spin; q.drag = drag; q.rot = Math.random() * TAU;
      this.cursor = j + 1;
      this.count++;
      return q;
    }
    return null;
  }

  /** A ring of sparkles / dots flying outward. */
  burst(k, x, y, n, speed, life, size, colors, g = 0) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const s = speed * (0.4 + Math.random() * 0.6);
      this.spawn(k, x, y, Math.cos(a) * s, Math.sin(a) * s, life * (0.7 + Math.random() * 0.5), size * (0.6 + Math.random() * 0.8),
        colors[(Math.random() * colors.length) | 0], g, (Math.random() - 0.5) * 8);
    }
  }

  popup(text, x, y, color = '#fff', size = 22) {
    const q = this.pops[this.popCursor];
    this.popCursor = (this.popCursor + 1) % this.pops.length;
    q.on = true; q.text = text; q.x = x; q.y = y; q.vy = 46; q.life = 0.95; q.max = 0.95; q.color = color; q.size = size;
  }

  clear() {
    for (const q of this.parts) q.on = false;
    for (const q of this.pops) q.on = false;
    this.count = 0;
  }

  update(dt) {
    for (let i = 0; i < this.parts.length; i++) {
      const q = this.parts[i];
      if (!q.on) continue;
      q.life -= dt;
      if (q.life <= 0) { q.on = false; this.count--; continue; }
      q.vy -= q.g * dt;
      if (q.drag) { const d = Math.max(0, 1 - q.drag * dt); q.vx *= d; q.vy *= d; }
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.rot += q.spin * dt;
    }
    for (let i = 0; i < this.pops.length; i++) {
      const q = this.pops[i];
      if (!q.on) continue;
      q.life -= dt;
      if (q.life <= 0) { q.on = false; continue; }
      q.y += q.vy * dt;
      q.vy *= Math.max(0, 1 - 2.2 * dt);
    }
  }

  /** Draw in world space (ctx already scaled to units). sx = x - camX, sy = groundY - y. */
  draw(ctx, camX, groundY) {
    for (let i = 0; i < this.parts.length; i++) {
      const q = this.parts[i];
      if (!q.on) continue;
      const t = q.life / q.max;          // 1 -> 0
      const x = q.x - camX;
      const y = groundY - q.y;
      ctx.globalAlpha = t > 0.35 ? 1 : t / 0.35;
      ctx.fillStyle = q.color;
      switch (q.k) {
        case K.DOT:
          ctx.beginPath(); ctx.arc(x, y, q.size * (0.5 + 0.5 * t), 0, TAU); ctx.fill();
          break;
        case K.PUFF: {
          const r = q.size * (1.1 - t * 0.5 + 0.4);
          ctx.globalAlpha *= 0.55;
          ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
          break;
        }
        case K.SPARK: case K.STAR: {
          const r = q.size * (0.4 + 0.6 * t);
          ctx.save(); ctx.translate(x, y); ctx.rotate(q.rot);
          ctx.beginPath();
          ctx.moveTo(0, -r); ctx.quadraticCurveTo(r * 0.18, -r * 0.18, r, 0);
          ctx.quadraticCurveTo(r * 0.18, r * 0.18, 0, r); ctx.quadraticCurveTo(-r * 0.18, r * 0.18, -r, 0);
          ctx.quadraticCurveTo(-r * 0.18, -r * 0.18, 0, -r); ctx.fill();
          ctx.restore();
          break;
        }
        case K.CONFETTI:
          ctx.save(); ctx.translate(x, y); ctx.rotate(q.rot); ctx.scale(1, Math.abs(Math.cos(q.rot * 2)) * 0.8 + 0.2);
          ctx.fillRect(-q.size, -q.size * 0.5, q.size * 2, q.size);
          ctx.restore();
          break;
        case K.LEAF:
          ctx.save(); ctx.translate(x, y); ctx.rotate(q.rot);
          ctx.beginPath(); ctx.ellipse(0, 0, q.size, q.size * 0.5, 0, 0, TAU); ctx.fill();
          ctx.restore();
          break;
        case K.RING:
          ctx.strokeStyle = q.color; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(x, y, q.size * (1.8 - t), 0, TAU); ctx.stroke();
          break;
        case K.ZZZ:
          ctx.font = `800 ${q.size}px ui-rounded, system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText('z', x, y);
          break;
        default:
      }
    }
    ctx.globalAlpha = 1;

    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    for (let i = 0; i < this.pops.length; i++) {
      const q = this.pops[i];
      if (!q.on) continue;
      const t = q.life / q.max;
      const grow = t > 0.8 ? 0.6 + (1 - t) * 2 : 1;   // pop-in
      ctx.globalAlpha = t > 0.3 ? 1 : t / 0.3;
      ctx.font = `800 ${Math.round(q.size * Math.min(1, grow))}px ui-rounded, system-ui, sans-serif`;
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(92,60,40,0.85)';
      ctx.strokeText(q.text, q.x - camX, groundY - q.y);
      ctx.fillStyle = q.color;
      ctx.fillText(q.text, q.x - camX, groundY - q.y);
    }
    ctx.globalAlpha = 1;
  }
}
