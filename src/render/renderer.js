/**
 * renderer.js — owns the canvas: sizing, camera, and the draw order every frame.
 *
 * Drawing happens in "world units": we scale the canvas so VIEW.width (520) units always span the
 * screen width. That means the game looks and plays identically on any phone; only the vertical
 * amount of sky/sea above and below changes with the screen's height.
 *
 * Biomes: each biome has its own pre-painted Backdrop. The renderer keeps the ones it needs (the current
 * one, the one coming up, always the meadow), builds new ones one layer per frame so nothing hitches, and
 * cross-fades two of them while Bramble walks through the doorway between biomes. Palettes are blended and
 * cached in 1/24 steps.
 */
import { VIEW, BIOME, UNITS_PER_METER, POWER } from '../data/balance.js';
import { quality } from '../core/quality.js';
import { BIOMES, BIOME_ORDER, mixPalette } from '../data/biomes.js';
import { Backdrop } from './backdrop.js';
import { Terrain } from './terrain.js';
import { drawProps, drawPowerIcon, POWER_COLOR } from './props.js';
import { t } from '../data/strings.js';
import { hash2 } from '../core/rng.js';
import { drawCompanion } from './companions.js';

const TAU = Math.PI * 2;
const STEPS = 24;
const smooth = (u) => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };

export class Renderer {
  constructor(canvas, run, fx, vis, hud) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.run = run; this.fx = fx; this.vis = vis; this.hud = hud;
    this.sets = new Map();               // biome index -> Backdrop
    this.palCache = new Map();
    this.pal = BIOMES.meadow;
    this.terrain = new Terrain();
    this.cssW = 0; this.cssH = 0; this.dpr = 1; this.scale = 1; this.viewH = 0; this.groundY = 0;
    this.safe = { top: 0, left: 0, right: 0, bottom: 0 };
    this.time = 0;
    this.skyGrad = null; this.skyKey = '';
    this.sunGrad = null;
    this.px = 0;                          // device pixels per world unit
    this.zoom = 1;                        // set by juice (speed zoom-out); anchored on Bramble
    this.shakeX = 0; this.shakeY = 0;     // set by juice (optional, gentle)
    this.flash = 0;                       // soft white flash 0..1
    this.beat = 0;                        // music beat pulse 0..1
    this.reduced = false;
    this.blend = { a: 0, b: 0, u: 1 };
    this.weatherSeed = 1;
    this.titleCard = null;                // {name, sub, t}
  }

  // ---------------------------------------------------------------- sizing
  /** Call on any size/orientation change, or when quality changes. */
  resize(cssW, cssH, rawDpr, safe) {
    if (safe) this.safe = safe;
    const dpr = Math.min(rawDpr || 1, quality.cfg.dprCap);
    this.cssW = cssW; this.cssH = cssH; this.dpr = dpr;
    this.canvas.width = Math.max(1, Math.round(cssW * dpr));
    this.canvas.height = Math.max(1, Math.round(cssH * dpr));
    this.scale = cssW / VIEW.width;
    this.viewH = cssH / this.scale;
    this.groundY = this.viewH * VIEW.groundFrac;

    const px = this.scale * dpr;
    if (Math.abs(px - this.px) > 0.01) {
      this.px = px;
      this.sets.clear();                  // different pixel scale: everything must be repainted
    }
    this.skyKey = '';
    this.terrain.groundY = -1;
    this._prime();
  }

  /** Make sure the sets for what's on screen exist right now (used at start, resize and big jumps). */
  _prime() {
    const m = this._bandAt(this.run.p ? this.run.p.x : 0);
    this._need(m.a, true); if (m.b !== m.a) this._need(m.b, true);
  }

  _need(idx, now) {
    let s = this.sets.get(idx);
    if (!s) {
      s = new Backdrop();
      s.start(this.px, BIOMES[BIOME_ORDER[idx]]);
      s.touched = this.time;
      this.sets.set(idx, s);
    }
    if (now) s.buildAll();
    return s;
  }

  /** Where in the garden is world position x? -> {a: biome idx, b: biome idx, u: blend 0..1, k: stretch number} */
  _bandAt(x) {
    const len = BIOME.lengthM * UNITS_PER_METER;
    const bx = x / len;
    const kb = Math.round(bx);
    const d = (bx - kb) * len;
    const n = BIOME_ORDER.length;
    const here = ((Math.floor(bx) % n) + n) % n;
    if (kb >= 1 && Math.abs(d) < BIOME.blendU) {
      const a = (((kb - 1) % n) + n) % n; const b = ((kb % n) + n) % n;
      return { a, b, u: smooth((d + BIOME.blendU) / (BIOME.blendU * 2)), k: Math.floor(bx), kb };
    }
    return { a: here, b: here, u: 1, k: Math.floor(bx), kb };
  }

  _mixed(a, b, u) {
    if (a === b || u >= 0.999) return BIOMES[BIOME_ORDER[b]];
    if (u <= 0.001) return BIOMES[BIOME_ORDER[a]];
    const q = Math.round(u * STEPS);
    if (q <= 0) return BIOMES[BIOME_ORDER[a]];
    if (q >= STEPS) return BIOMES[BIOME_ORDER[b]];
    const key = `${a}-${b}-${q}`;
    let p = this.palCache.get(key);
    if (!p) { p = mixPalette(BIOMES[BIOME_ORDER[a]], BIOMES[BIOME_ORDER[b]], q / STEPS); this.palCache.set(key, p); }
    return p;
  }

  /** Per-frame housekeeping: build the upcoming biome in the background, drop the ones far behind. */
  _manage(x) {
    const len = BIOME.lengthM * UNITS_PER_METER;
    const n = BIOME_ORDER.length;
    const bx = x / len;
    const here = ((Math.floor(bx) % n) + n) % n;
    const next = (here + 1) % n;
    const toBoundary = (Math.floor(bx) + 1) * len - x;
    this._need(here, false);
    if (toBoundary < 1500) this._need(next, false);
    // build one layer of the first unfinished set per frame
    for (const [, s] of this.sets) { if (!s.ready) { s.step(); break; } }
    // evict (keep at most 3: here, next, and the meadow for the title screen)
    if (this.sets.size > 3) {
      for (const idx of [...this.sets.keys()]) {
        if (this.sets.size <= 3) break;
        if (idx !== here && idx !== next && idx !== 0 && this.sets.get(idx).ready) this.sets.delete(idx);
      }
    }
  }

  _sky(pal) {
    const key = pal.skyTop + pal.skyMid + pal.skyHorizon + pal.sea[0];
    if (key === this.skyKey) return;
    this.skyKey = key;
    const c = this.ctx; const g = this.groundY;
    this.skyGrad = c.createLinearGradient(0, 0, 0, g + 70);
    this.skyGrad.addColorStop(0, pal.skyTop);
    this.skyGrad.addColorStop(0.55, pal.skyMid);
    this.skyGrad.addColorStop(0.93, pal.skyHorizon);
    this.skyGrad.addColorStop(1, pal.sea[0]);
    if (!this.sunGrad) {
      const sx = VIEW.width * 0.76; const sy = g * 0.26;
      this.sunPos = { x: sx, y: sy };
      this.sunGrad = c.createRadialGradient(sx, sy, 6, sx, sy, 150);
      this.sunGrad.addColorStop(0, 'rgba(255,248,205,0.95)');
      this.sunGrad.addColorStop(0.18, 'rgba(255,244,190,0.55)');
      this.sunGrad.addColorStop(1, 'rgba(255,240,180,0)');
    }
  }

  // ---------------------------------------------------------------- frame
  render(alpha, mode, frameDt) {
    const ctx = this.ctx;
    const run = this.run;
    const W = VIEW.width;
    const g = this.groundY;
    this.time += frameDt;
    const tt = this.time;
    const px0 = run.prevCamX + (run.camX - run.prevCamX) * alpha;
    const camX = px0;
    const py = run.prevY + (run.p.y - run.prevY) * alpha;
    const playerX = camX + W * VIEW.playerX;

    // ---- which biome(s) are we in?
    const band = this._bandAt(playerX);
    this.blend = band;
    this._manage(playerX);
    const setA = this.sets.get(band.a) && this.sets.get(band.a).ready ? this.sets.get(band.a) : this._need(band.a, true);
    let setB = this.sets.get(band.b);
    let u = band.u;
    if (band.b !== band.a && (!setB || !setB.ready)) {
      if (Math.abs(playerX - band.kb * BIOME.lengthM * UNITS_PER_METER) < 140) setB = this._need(band.b, true);
      else { setB = setA; u = 0; }
    }
    const pal = this._mixed(band.a, band.b, u);
    this.pal = pal;
    this._sky(pal);

    // ---- camera: zoom out a little with speed, anchored on Bramble; optional shake
    const anchorX = W * VIEW.playerX;
    const z = this.reduced ? 1 : this.zoom;
    ctx.setTransform(this.dpr * this.scale, 0, 0, this.dpr * this.scale, 0, 0);

    // ---- sky (never zoomed: it's a gradient)
    ctx.fillStyle = this.skyGrad;
    ctx.fillRect(0, 0, W, this.viewH);
    const night = pal.night || 0;
    if (night < 0.98) {
      ctx.globalAlpha = 1 - night;
      ctx.fillStyle = this.sunGrad; ctx.fillRect(0, 0, W, g);
      ctx.fillStyle = 'rgba(255,252,225,0.95)';
      ctx.beginPath(); ctx.arc(this.sunPos.x, this.sunPos.y + (pal.sunY - 0.26) * g * 0.6, 26, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    const starSet = (setB && setB.stars) ? setB : (setA.stars ? setA : null);
    if (starSet && night > 0.05) starSet.drawStars(ctx, camX, W, Math.min(1, night * 1.2), tt);
    if (night > 0.45) this._moon(ctx, Math.min(1, (night - 0.45) * 2), g);

    if (z !== 1) {
      ctx.save();
      ctx.translate(anchorX * (1 - z), (g) * (1 - z));
      ctx.scale(z, z);
    }
    if (this.shakeX || this.shakeY) ctx.translate(this.shakeX, this.shakeY);

    // ---- parallax layers: previous biome fully, the next one fading in over it
    this._drawSet(ctx, setA, 1, camX, g, W, tt);
    if (setB !== setA) this._drawSet(ctx, setB, u, camX, g, W, tt);
    const seaBottom = g + 40 + 460;
    if (seaBottom < this.viewH + 60) {
      ctx.fillStyle = pal.sea[2];
      ctx.fillRect(-W, seaBottom - 1, W * 3, this.viewH - seaBottom + 80);
    }

    // ---- ambient
    if (quality.cfg.ambient) {
      if (pal.id === 'meadow' || band.a === 0 || band.b === 0) this._butterflies(ctx, camX, g, tt, band.a === 0 && band.b === 0 ? 1 : (band.a === 0 ? 1 - u : u));
    }

    // ---- doorway between biomes
    this._doorway(ctx, band, camX, g, W, tt);

    // ---- speed-zone visuals that live behind Bramble
    this._zones(ctx, run, camX, g, W, tt, false);

    // ---- islands
    this.terrain.prepare(ctx, g, pal);
    this.terrain.draw(ctx, run, camX, g, W, pal);

    // ---- hazards + pickups (+ best-run ghost)
    drawProps(ctx, run, camX, g, tt, t('over.best'));

    // ---- Bramble, power-up rings
    const px = W * VIEW.playerX;
    this._auras(ctx, px, g - py - 30, run, tt);
    this.vis.draw(ctx, px, g - py, g, py, run, mode);
    if (run.L.companion && run.state !== 'over') {
      const cy = g - py - 70 + Math.sin(tt * 3) * 3 - Math.min(18, Math.max(-8, run.p.vy * 0.012));
      drawCompanion(ctx, run.L.companion, px - 46 + Math.sin(tt * 1.7) * 3, cy, tt, 0.78);
    }

    // ---- foreground grass, particles, front zone effects
    this.terrain.drawFront(ctx, run, camX, g, W, pal);
    this._zones(ctx, run, camX, g, W, tt, true);
    this.fx.draw(ctx, camX, g);
    if (z !== 1) ctx.restore();

    // ---- screen-space atmosphere
    this._weather(ctx, band, u, W, g, tt, camX);
    if (night > 0.02) { ctx.fillStyle = `rgba(14,18,60,${0.16 * night})`; ctx.fillRect(0, 0, W, this.viewH); }
    if (this.beat > 0.01 && !this.reduced) { ctx.fillStyle = `rgba(255,244,214,${0.05 * this.beat})`; ctx.fillRect(0, 0, W, this.viewH); }
    if (this.flash > 0.01) { ctx.fillStyle = `rgba(255,255,255,${0.5 * this.flash})`; ctx.fillRect(0, 0, W, this.viewH); }

    // ---- HUD in screen pixels
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.hud.draw(ctx, run, this.cssW, this.cssH, this.safe);
    this._titleCard(ctx, mode);
  }

  _drawSet(ctx, set, a, camX, g, W, tt) {
    if (!set || !set.ready || a <= 0.003) return;
    if (a < 0.999) ctx.globalAlpha = a;
    const L = set.layers;
    set.drawLayer(ctx, L[0], camX, g, W, tt * 1.5);
    set.drawLayer(ctx, L[1], camX, g, W, tt * 4);
    set.drawLayer(ctx, L[2], camX, g, W, 0);
    set.drawLayer(ctx, L[3], camX, g, W, 0);
    if (set.chimneys.length) this._smoke(ctx, set, L[3], camX, g, tt);
    set.drawLayer(ctx, set.sea, camX, g, W, tt * 3);
    ctx.globalAlpha = 1;
  }

  /** Chimney smoke and teapot steam in Teacup Village: a few puffs each, computed from time (no state). */
  _smoke(ctx, set, L, camX, g, tt) {
    if (!quality.cfg.ambient) return;
    const w = L.tile.w;
    const off = (((camX * L.factor) % w) + w) % w;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let c = 0; c < set.chimneys.length; c++) {
      const ch = set.chimneys[c];
      for (let rep = -1; rep < 3; rep++) {
        const sx = ch.x - off + rep * w;
        if (sx < -30 || sx > VIEW.width + 30) continue;
        for (let k = 0; k < 3; k++) {
          const ph = ((tt * 0.22 + k / 3 + c * 0.37) % 1);
          const y = g + L.top + ch.y - ph * 34;
          const x = sx + Math.sin(ph * 5 + c) * 5 + ph * 8;
          ctx.globalAlpha = (1 - ph) * 0.55;
          ctx.beginPath(); ctx.arc(x, y, 2.5 + ph * 5, 0, TAU); ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  _moon(ctx, a, g) {
    const x = VIEW.width * 0.76; const y = g * 0.2;
    ctx.save(); ctx.globalAlpha = a;
    const gr = ctx.createRadialGradient(x, y, 8, x, y, 90);
    gr.addColorStop(0, 'rgba(255,250,225,0.55)'); gr.addColorStop(1, 'rgba(255,250,225,0)');
    ctx.fillStyle = gr; ctx.fillRect(x - 100, y - 100, 200, 200);
    ctx.fillStyle = '#fffbe6'; ctx.beginPath(); ctx.arc(x, y, 22, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(210,205,190,0.45)';
    ctx.beginPath(); ctx.arc(x - 7, y - 4, 4.5, 0, TAU); ctx.arc(x + 6, y + 6, 3.2, 0, TAU); ctx.arc(x + 4, y - 9, 2.4, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /** A hanging lantern gate at every biome boundary. It floats overhead, so it never needs ground under it. */
  _doorway(ctx, band, camX, g, W, tt) {
    const len = BIOME.lengthM * UNITS_PER_METER;
    const k0 = Math.round((camX + W / 2) / len);
    for (let kb = Math.max(1, k0 - 1); kb <= k0 + 1; kb++) {
      const bx = kb * len - camX;
      if (bx < -120 || bx > W + 120) continue;
      const to = BIOMES[BIOME_ORDER[((kb % 5) + 5) % 5]];
      const col = to.accent;
      ctx.save();
      ctx.strokeStyle = 'rgba(110,80,60,0.75)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      const top = g - 250;
      ctx.beginPath(); ctx.moveTo(bx - 70, top + 70); ctx.quadraticCurveTo(bx, top - 14, bx + 70, top + 70); ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(bx - 66, top + 70); ctx.quadraticCurveTo(bx, top - 6, bx + 66, top + 70); ctx.stroke();
      // pennants along the arch
      for (let i = 1; i < 8; i++) {
        const u = i / 8; const x = bx - 70 + 140 * u; const y = top + 70 - 4 * 4 * u * (1 - u) * 21 + 4;
        ctx.fillStyle = i % 2 ? col : '#fff3d6';
        ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x + 5, y); ctx.lineTo(x, y + 12 + Math.sin(tt * 3 + i) * 1.5); ctx.closePath(); ctx.fill();
      }
      // a glowing lantern at the top
      ctx.fillStyle = col;
      const ly = top + 24 + Math.sin(tt * 1.6 + kb) * 2;
      ctx.beginPath(); ctx.ellipse(bx, ly, 9, 12, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(110,80,60,0.8)'; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5;
      const gr = ctx.createRadialGradient(bx, ly, 2, bx, ly, 42);
      gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(bx, ly, 42, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }

  /** Visual dressing for speed zones: drifting fluff, wind streaks, fog banks. All purely cosmetic. */
  _zones(ctx, run, camX, g, W, tt, front) {
    const zs = run.zones;
    for (let i = 0; i < zs.length; i++) {
      const z = zs[i];
      if (z.x1 - camX < -40 || z.x0 - camX > W + 40) continue;
      const a = Math.max(z.x0 - camX, -20); const b = Math.min(z.x1 - camX, W + 20);
      if (z.kind === 'fluff' && !front && quality.cfg.ambient) {
        for (let k = 0; k < 14; k++) {
          const wx = z.x0 + hash2(i * 31 + k, 5) * (z.x1 - z.x0);
          const sx = wx - camX + Math.sin(tt * 0.9 + k) * 12 - ((tt * 14 + k * 17) % 40);
          if (sx < -10 || sx > W + 10) continue;
          const sy = g - 24 - hash2(i + k * 7, 6) * 150 + Math.sin(tt * 1.4 + k * 2) * 10;
          ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1;
          ctx.beginPath();
          for (let r = 0; r < 6; r++) { const an = r * (TAU / 6) + tt * 0.5; ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(an) * 6, sy + Math.sin(an) * 6); }
          ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(sx, sy, 1.4, 0, TAU); ctx.fill();
        }
      } else if ((z.kind === 'gustTail' || z.kind === 'gustHead') && front && quality.cfg.ambient) {
        const dir = z.kind === 'gustTail' ? -1 : 1;           // tailwind streaks flow forward (leftward on screen as we run right)
        ctx.strokeStyle = z.kind === 'gustTail' ? 'rgba(255,255,255,0.7)' : 'rgba(200,215,255,0.7)';
        ctx.lineWidth = 2; ctx.lineCap = 'round';
        for (let k = 0; k < 9; k++) {
          const ph = (tt * (z.kind === 'gustTail' ? 1.9 : 1.2) + k * 0.37) % 1;
          const sx = z.kind === 'gustTail' ? b - ph * (b - a) : a + ph * (b - a);
          const sy = g - 30 - hash2(i + k * 3, 8) * 190;
          const len = 26 + hash2(i + k, 9) * 26;
          ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.7;
          ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx - dir * len * 0.5, sy - 4, sx - dir * len, sy); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      } else if (z.kind === 'fog' && front) {
        // a gentle haze that softens the FAR path only (hazards stay visible and keep their tell)
        const left = Math.max(a, W * VIEW.playerX + 90);
        if (b > left) {
          const gr = ctx.createLinearGradient(left, 0, left + 140, 0);
          gr.addColorStop(0, 'rgba(190,200,240,0)'); gr.addColorStop(1, 'rgba(190,200,240,0.28)');
          ctx.fillStyle = gr; ctx.fillRect(left, g - 220, Math.min(140, b - left), 250);
          if (b > left + 140) { ctx.fillStyle = 'rgba(190,200,240,0.28)'; ctx.fillRect(left + 140, g - 220, b - left - 140, 250); }
        }
      }
    }
  }

  /** Colored duration rings around Bramble for each active power-up; dash gets a steamy streak. */
  _auras(ctx, x, y, run, tt) {
    const pu = run.pu; let ring = 0;
    const kinds = ['honey', 'hop', 'dash', 'burst', 'blanket'];
    for (const k of kinds) {
      const left = pu[k];
      if (left <= 0) continue;
      const max = run.puMax[k] || 1;
      const warn = k !== 'blanket' && left < POWER.warn;
      if (warn && Math.floor(tt * 6) % 2) { ring++; continue; }
      const col = POWER_COLOR[k];
      const r = 38 + ring * 6;
      ctx.save();
      ctx.lineCap = 'round';
      if (k === 'blanket') {
        ctx.fillStyle = 'rgba(214,165,255,0.2)'; ctx.beginPath(); ctx.arc(x, y, r - 2, 0, TAU); ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.setLineDash([6, 5]); ctx.lineDashOffset = -tt * 14;
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
        ctx.strokeStyle = col; ctx.lineWidth = 3.4;
        ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0.02, left / max)); ctx.stroke();
      }
      ctx.restore();
      if (k === 'dash') {
        ctx.save(); ctx.globalAlpha = 0.55;
        for (let i = 0; i < 5; i++) {
          const ox = -30 - i * 22 - ((tt * 120) % 22);
          ctx.fillStyle = i % 2 ? '#ffd5cc' : '#ffffff';
          ctx.beginPath(); ctx.ellipse(x + ox, y + Math.sin(tt * 9 + i) * 5, 14 - i * 1.6, 6 - i * 0.6, 0, 0, TAU); ctx.fill();
        }
        ctx.restore();
      } else if (k === 'burst') {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5;
        const rr = POWER.burst.radius || 130;
        const gr = ctx.createRadialGradient(x, y, 10, x, y, rr);
        gr.addColorStop(0, 'rgba(255,235,150,0.55)'); gr.addColorStop(1, 'rgba(255,235,150,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill();
        ctx.restore();
      } else if (k === 'honey') {
        ctx.save(); ctx.globalAlpha = 0.18; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([3, 8]);
        ctx.beginPath(); ctx.arc(x, y, POWER.honey.radius || 175, 0, TAU); ctx.stroke();
        ctx.restore();
      }
      ring++;
    }
  }

  // ---------------------------------------------------------------- weather (screen space, stateless)
  _weatherKind(band, which) {
    const biomeIdx = which === 0 ? band.a : band.b;
    const opts = BIOMES[BIOME_ORDER[biomeIdx]].weather;
    const stretch = which === 0 && band.a !== band.b ? band.kb - 1 : (band.a !== band.b ? band.kb : band.k);
    const pick = Math.floor(hash2(stretch + 7, 3) * opts.length);
    return opts[pick % opts.length];
  }

  _weather(ctx, band, u, W, g, tt, camX) {
    if (!quality.cfg.ambient || this.reduced) return;
    if (band.a === band.b) this._weatherOne(ctx, this._weatherKind(band, 1), 1, W, g, tt, camX);
    else {
      this._weatherOne(ctx, this._weatherKind(band, 0), 1 - u, W, g, tt, camX);
      this._weatherOne(ctx, this._weatherKind(band, 1), u, W, g, tt, camX);
    }
  }

  _weatherOne(ctx, kind, a, W, g, tt, camX) {
    if (a < 0.02 || kind === 'none') return;
    ctx.save();
    const H = this.viewH;
    switch (kind) {
      case 'petals':
        for (let i = 0; i < 16; i++) {
          const x = (((i * 53.7 - tt * (18 + (i % 4) * 5) - camX * 0.5) % (W + 60)) + W + 60) % (W + 60) - 30;
          const y = (((i * 91.3 + tt * (22 + (i % 3) * 8)) % (H + 40)) + H + 40) % (H + 40) - 20;
          ctx.globalAlpha = a * 0.8; ctx.fillStyle = i % 3 ? '#ffd1dc' : '#ffffff';
          ctx.beginPath(); ctx.ellipse(x + Math.sin(tt * 2 + i) * 8, y, 4, 2.4, tt + i, 0, TAU); ctx.fill();
        }
        break;
      case 'rain':
        ctx.strokeStyle = 'rgba(210,230,255,0.55)'; ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let i = 0; i < 34; i++) {
          const x = (((i * 47.3 - camX * 0.9) % (W + 40)) + W + 40) % (W + 40) - 10;
          const y = (((i * 83.1 + tt * 520) % (H + 40)) + H + 40) % (H + 40) - 20;
          ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 13);
        }
        ctx.globalAlpha = a; ctx.stroke();
        break;
      case 'spores':
        for (let i = 0; i < 22; i++) {
          const x = (((i * 61.7 - tt * 6 - camX * 0.3) % (W + 40)) + W + 40) % (W + 40) - 20;
          const y = H - (((i * 77.3 + tt * (9 + (i % 5) * 3)) % (H * 0.9)));
          ctx.globalAlpha = a * (0.4 + 0.4 * Math.sin(tt * 2 + i));
          ctx.fillStyle = i % 2 ? '#9ff0d5' : '#f6b3ff';
          ctx.beginPath(); ctx.arc(x + Math.sin(tt + i) * 10, y, 1.8 + (i % 3) * 0.6, 0, TAU); ctx.fill();
        }
        break;
      case 'wind':
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
        for (let i = 0; i < 8; i++) {
          const ph = (tt * 0.7 + i * 0.29) % 1;
          const x = W + 40 - ph * (W + 160); const y = 40 + ((i * 97) % (g - 80));
          ctx.globalAlpha = a * Math.sin(ph * Math.PI) * 0.6;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 30, y - 6, x + 60, y); ctx.stroke();
        }
        break;
      case 'snow':
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 26; i++) {
          const x = (((i * 41.9 - tt * 8 - camX * 0.4) % (W + 40)) + W + 40) % (W + 40) - 20;
          const y = (((i * 67.7 + tt * (24 + (i % 4) * 7)) % (H + 20)) + H + 20) % (H + 20) - 10;
          ctx.globalAlpha = a * 0.85;
          ctx.beginPath(); ctx.arc(x + Math.sin(tt * 1.3 + i) * 9, y, 1.6 + (i % 3) * 0.6, 0, TAU); ctx.fill();
        }
        break;
      case 'fireflies':
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 16; i++) {
          const x = (((i * 57.1 - tt * 5 - camX * 0.35) % (W + 40)) + W + 40) % (W + 40) - 20 + Math.sin(tt * 0.9 + i * 2) * 14;
          const y = g * 0.35 + ((i * 53) % (g * 0.6)) + Math.cos(tt * 1.1 + i) * 12;
          const tw = 0.4 + 0.6 * Math.max(0, Math.sin(tt * 2.2 + i * 1.9));
          const gr = ctx.createRadialGradient(x, y, 0, x, y, 9);
          gr.addColorStop(0, 'rgba(255,240,150,0.95)'); gr.addColorStop(1, 'rgba(255,240,150,0)');
          ctx.globalAlpha = a * tw; ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.fill();
        }
        break;
      default:
    }
    ctx.restore();
  }

  _titleCard(ctx, mode) {
    const c = this.titleCard;
    if (!c || mode !== 'running') return;
    c.t += 1 / 60;
    const life = 3.2;
    if (c.t > life) { this.titleCard = null; return; }
    const a = Math.min(1, c.t / 0.4, (life - c.t) / 0.7);
    ctx.save();
    ctx.globalAlpha = Math.max(0, a);
    ctx.textAlign = 'center';
    const cx = this.cssW / 2; const y = this.safe.top + 205;
    ctx.fillStyle = 'rgba(70,45,60,0.22)';
    ctx.font = '800 26px ui-rounded, "SF Pro Rounded", Nunito, system-ui, sans-serif';
    ctx.fillText(c.name, cx + 1.5, y + 2);
    ctx.fillStyle = '#fffaf0'; ctx.strokeStyle = 'rgba(110,70,60,0.55)'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
    ctx.strokeText(c.name, cx, y); ctx.fillText(c.name, cx, y);
    ctx.font = '700 14px ui-rounded, "SF Pro Rounded", Nunito, system-ui, sans-serif';
    ctx.lineWidth = 3;
    ctx.strokeText(c.sub, cx, y + 24); ctx.fillText(c.sub, cx, y + 24);
    ctx.restore();
  }

  /** A few drifting butterflies for the meadow. Purely cosmetic and very cheap. */
  _butterflies(ctx, camX, g, t, alpha) {
    if (alpha < 0.03) return;
    ctx.globalAlpha = alpha;
    for (let i = 0; i < 3; i++) {
      const bx = ((i * 233 + t * (14 + i * 4) - camX * 0.22) % 640 + 640) % 640 - 60;
      const by = g - 130 - i * 46 + Math.sin(t * 1.7 + i * 2) * 16;
      const flap = Math.abs(Math.sin(t * 9 + i)) * 0.9 + 0.1;
      const hue = ['#ffb3c8', '#ffd98a', '#b9d8ff'][i];
      ctx.fillStyle = hue; ctx.strokeStyle = 'rgba(110,80,70,0.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(bx - 3.5, by, 4 * flap, 5.5, -0.3, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(bx + 3.5, by, 4 * flap, 5.5, 0.3, 0, TAU); ctx.fill(); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}
