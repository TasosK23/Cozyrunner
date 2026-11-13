/**
 * terrain.js — the floating islands Bramble runs on, drawn from the run's ground segments.
 * Everything is built from paths each frame (only the visible slice of each island), so an
 * island can be any length. Decorations (flowers, roots, pebbles, grass tufts) are placed by a
 * position hash, so they never flicker or shift as you scroll.
 */
import { hash2 } from '../core/rng.js';

const TAU = Math.PI * 2;
const TAPER = 90;   // how long the rounded underside taper at an island's end is

function ease(u) { u = Math.max(0, Math.min(1, u)); return Math.sin(u * Math.PI * 0.5); }

function bodyDepth(x, x0, x1) {
  let d = 78 + 9 * Math.sin(x * 0.019) + 5 * Math.sin(x * 0.053 + 1.3);
  d *= ease((x - x0) / TAPER);
  d *= ease((x1 - x) / TAPER);
  return d + 5;
}

export class Terrain {
  constructor() { this.soil = null; this.groundY = -1; }

  /** Cache the soil gradient (it depends on the screen's ground line). */
  prepare(ctx, groundY, pal) {
    if (this.groundY === groundY && this.pal === pal) return;
    this.groundY = groundY; this.pal = pal;
    const g = ctx.createLinearGradient(0, groundY, 0, groundY + 92);
    g.addColorStop(0, pal.soilTop); g.addColorStop(1, pal.soilBottom);
    this.soil = g;
  }

  draw(ctx, run, camX, groundY, viewW, pal) {
    for (let i = 0; i < run.segs.length; i++) this._island(ctx, run.segs[i].x0, run.segs[i].x1, camX, groundY, viewW, pal);
    this._island(ctx, run.openStart, Infinity, camX, groundY, viewW, pal);
  }

  _island(ctx, x0, x1, camX, groundY, viewW, pal) {
    const L = camX - 50;
    const R = camX + viewW + 50;
    if (x1 < L || x0 > R) return;
    const a = Math.max(x0, L);
    const b = Math.min(x1, R);

    // ---- soil body with a rounded, tapering underside
    ctx.beginPath();
    ctx.moveTo(a - camX, groundY);
    ctx.lineTo(b - camX, groundY);
    const step = 18;
    let first = true;
    for (let x = b; x >= a - 0.001; x -= step) {
      const xx = Math.max(a, x);
      const y = groundY + bodyDepth(xx, x0, x1);
      if (first) { ctx.lineTo(xx - camX, y); first = false; } else ctx.lineTo(xx - camX, y);
    }
    ctx.closePath();
    ctx.fillStyle = this.soil;
    ctx.fill();
    ctx.strokeStyle = 'rgba(110,76,53,0.55)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // ---- pebbles in the soil + hanging roots
    const k0 = Math.floor(a / 34);
    const k1 = Math.floor(b / 34);
    ctx.fillStyle = pal.soilDot;
    ctx.globalAlpha = 0.28;
    for (let k = k0; k <= k1; k++) {
      const hx = hash2(k, 3);
      const x = k * 34 + hx * 30;
      if (x < a || x > b) continue;
      const d = bodyDepth(x, x0, x1);
      const y = groundY + 18 + hash2(k, 4) * Math.max(0, d - 34);
      ctx.beginPath(); ctx.ellipse(x - camX, y, 3 + hash2(k, 5) * 4, 2 + hash2(k, 6) * 2.5, 0, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = pal.root;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    const r0 = Math.floor(a / 61);
    const r1 = Math.floor(b / 61);
    for (let k = r0; k <= r1; k++) {
      if (hash2(k, 9) < 0.35) continue;
      const x = k * 61 + hash2(k, 10) * 40;
      if (x < a + 6 || x > b - 6) continue;
      const y = groundY + bodyDepth(x, x0, x1) - 2;
      const len = 10 + hash2(k, 11) * 26;
      const sway = (hash2(k, 12) - 0.5) * 16;
      ctx.beginPath();
      ctx.moveTo(x - camX, y);
      ctx.quadraticCurveTo(x - camX + sway, y + len * 0.5, x - camX + sway * 0.5, y + len);
      ctx.stroke();
    }

    // ---- bushes standing on the island (behind the grass lip)
    const b0 = Math.floor(a / 173);
    const b1 = Math.floor(b / 173);
    for (let k = b0; k <= b1; k++) {
      if (hash2(k, 41) < 0.4) continue;
      const x = k * 173 + hash2(k, 42) * 130;
      if (x < a + 22 || x > b - 22) continue;
      const sc = 0.7 + hash2(k, 43) * 0.6;
      const bx = x - camX;
      ctx.fillStyle = pal.bush[k & 1];
      ctx.beginPath();
      ctx.arc(bx, groundY - 7 * sc, 13 * sc, Math.PI, 0);
      ctx.arc(bx + 13 * sc, groundY - 3 * sc, 9 * sc, Math.PI * 1.15, Math.PI * 0.05);
      ctx.arc(bx - 13 * sc, groundY - 3 * sc, 9 * sc, Math.PI * 0.95, Math.PI * 1.85);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.beginPath(); ctx.arc(bx - 4 * sc, groundY - 14 * sc, 5 * sc, 0, TAU); ctx.fill();
    }

    // ---- grass lip
    const gx = a - camX;
    const gw = b - a;
    const capL = x0 >= L ? 6 : 0;
    const capR = x1 <= R ? 6 : 0;
    ctx.fillStyle = pal.grass;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(gx - capL, groundY - 8, gw + capL + capR, 17, 8);
    else ctx.rect(gx - capL, groundY - 8, gw + capL + capR, 17);
    ctx.fill();
    ctx.strokeStyle = pal.grassLight; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(gx + 2, groundY - 5); ctx.lineTo(gx + gw - 2, groundY - 5); ctx.stroke();
    ctx.strokeStyle = pal.grassDark; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(gx - capL + 4, groundY + 8); ctx.lineTo(gx + gw + capR - 4, groundY + 8); ctx.stroke();

    // ---- flowers on top
    const f0 = Math.floor(a / 74);
    const f1 = Math.floor(b / 74);
    for (let k = f0; k <= f1; k++) {
      if (hash2(k, 21) < 0.45) continue;
      const x = k * 74 + hash2(k, 22) * 60;
      if (x < a + 8 || x > b - 8) continue;
      const hgt = 7 + hash2(k, 23) * 8;
      ctx.strokeStyle = '#5ea34f'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(x - camX, groundY - 6); ctx.lineTo(x - camX, groundY - 6 - hgt); ctx.stroke();
      ctx.fillStyle = pal.flowers[(hash2(k, 24) * pal.flowers.length) | 0];
      ctx.beginPath(); ctx.arc(x - camX, groundY - 6 - hgt, 3.5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffd35c';
      ctx.beginPath(); ctx.arc(x - camX, groundY - 6 - hgt, 1.3, 0, TAU); ctx.fill();
    }
  }

  /** Little grass blades drawn AFTER Bramble so he runs "through" the lawn. */
  drawFront(ctx, run, camX, groundY, viewW, pal) {
    const draw = (x0, x1) => {
      const a = Math.max(x0, camX - 20);
      const b = Math.min(x1, camX + viewW + 20);
      if (b <= a) return;
      ctx.strokeStyle = pal.grassDark; ctx.lineWidth = 2; ctx.lineCap = 'round';
      const k0 = Math.floor(a / 19);
      const k1 = Math.floor(b / 19);
      ctx.beginPath();
      for (let k = k0; k <= k1; k++) {
        const x = k * 19 + hash2(k, 31) * 14;
        if (x < a + 3 || x > b - 3) continue;
        const h = 5 + hash2(k, 32) * 7;
        const lean = (hash2(k, 33) - 0.5) * 6;
        ctx.moveTo(x - camX, groundY + 3);
        ctx.quadraticCurveTo(x - camX + lean * 0.3, groundY - h * 0.5, x - camX + lean, groundY - h);
      }
      ctx.stroke();
    };
    for (let i = 0; i < run.segs.length; i++) draw(run.segs[i].x0, run.segs[i].x1);
    draw(run.openStart, Infinity);
  }
}
