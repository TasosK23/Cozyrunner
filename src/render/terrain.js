/**
 * terrain.js — the floating islands Bramble runs on, drawn from the run's ground segments.
 * Everything is built from paths each frame (only the visible slice of each island), so an
 * island can be any length. Decorations (spikes, roots, pebbles, ash tufts) are placed by a
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

    // ---- jagged rocks and dead scrub standing on the island (behind the lip)
    const b0 = Math.floor(a / 173);
    const b1 = Math.floor(b / 173);
    for (let k = b0; k <= b1; k++) {
      if (hash2(k, 41) < 0.4) continue;
      const x = k * 173 + hash2(k, 42) * 130;
      if (x < a + 22 || x > b - 22) continue;
      const sc = 0.7 + hash2(k, 43) * 0.7;
      const bx = x - camX;
      ctx.fillStyle = pal.bush[k & 1];
      ctx.beginPath();
      ctx.moveTo(bx - 15 * sc, groundY - 2);
      ctx.lineTo(bx - 11 * sc, groundY - 11 * sc);
      ctx.lineTo(bx - 4 * sc, groundY - 15 * sc);
      ctx.lineTo(bx + 3 * sc, groundY - 12 * sc);
      ctx.lineTo(bx + 11 * sc, groundY - 17 * sc);
      ctx.lineTo(bx + 16 * sc, groundY - 2);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.beginPath(); ctx.moveTo(bx - 4 * sc, groundY - 15 * sc); ctx.lineTo(bx + 3 * sc, groundY - 12 * sc); ctx.lineTo(bx - 1 * sc, groundY - 5 * sc); ctx.closePath(); ctx.fill();
    }

    // ---- stone lip: a cracked slab edge with a glowing ember seam
    const gx = a - camX;
    const gw = b - a;
    const capL = x0 >= L ? 6 : 0;
    const capR = x1 <= R ? 6 : 0;
    ctx.fillStyle = pal.grass;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(gx - capL, groundY - 8, gw + capL + capR, 17, 3);
    else ctx.rect(gx - capL, groundY - 8, gw + capL + capR, 17);
    ctx.fill();
    ctx.strokeStyle = pal.grassLight; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(gx + 2, groundY - 5); ctx.lineTo(gx + gw - 2, groundY - 5); ctx.stroke();
    ctx.strokeStyle = pal.grassDark; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(gx - capL + 4, groundY + 8); ctx.lineTo(gx + gw + capR - 4, groundY + 8); ctx.stroke();
    // slab joints
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.4;
    ctx.beginPath();
    const j0 = Math.floor(a / 46); const j1 = Math.floor(b / 46);
    for (let k = j0; k <= j1; k++) { const x = k * 46 + hash2(k, 51) * 10 - camX; if (x < gx || x > gx + gw) continue; ctx.moveTo(x, groundY - 5); ctx.lineTo(x - 2, groundY + 8); }
    ctx.stroke();
    // a thin glowing seam under the lip
    ctx.strokeStyle = 'rgba(255,110,40,0.55)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(gx + 3, groundY + 9.5); ctx.lineTo(gx + gw - 3, groundY + 9.5); ctx.stroke();

    // ---- small spikes of bone, crystal and cold embers on top (instead of flowers)
    const f0 = Math.floor(a / 74);
    const f1 = Math.floor(b / 74);
    for (let k = f0; k <= f1; k++) {
      if (hash2(k, 21) < 0.45) continue;
      const x = k * 74 + hash2(k, 22) * 60;
      if (x < a + 8 || x > b - 8) continue;
      const hgt = 6 + hash2(k, 23) * 9;
      const xx = x - camX;
      ctx.fillStyle = pal.flowers[(hash2(k, 24) * pal.flowers.length) | 0];
      ctx.beginPath(); ctx.moveTo(xx - 3, groundY - 6); ctx.lineTo(xx + 0.5, groundY - 6 - hgt); ctx.lineTo(xx + 3, groundY - 6); ctx.closePath(); ctx.fill();
      if (hash2(k, 25) > 0.55) { ctx.beginPath(); ctx.moveTo(xx + 3, groundY - 6); ctx.lineTo(xx + 6, groundY - 6 - hgt * 0.6); ctx.lineTo(xx + 8, groundY - 6); ctx.closePath(); ctx.fill(); }
    }
  }

  /** Little ash-tufts / jagged shards drawn AFTER Cinder so he runs "through" the rubble. */
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
        ctx.lineTo(x - camX + lean * 0.4, groundY - h * 0.55);
        ctx.lineTo(x - camX + lean, groundY - h * 0.9);
      }
      ctx.stroke();
    };
    for (let i = 0; i < run.segs.length; i++) draw(run.segs[i].x0, run.segs[i].x1);
    draw(run.openStart, Infinity);
  }
}
