/**
 * renderer.js — owns the canvas: sizing, camera, and the draw order every frame.
 *
 * Drawing happens in "world units": we scale the canvas so VIEW.width (520) units always span the
 * screen width. That means the game looks and plays identically on any phone; only the vertical
 * amount of sky/sea above and below changes with the screen's height.
 */
import { VIEW } from '../data/balance.js';
import { quality } from '../core/quality.js';
import { BIOMES } from '../data/biomes.js';
import { Backdrop } from './backdrop.js';
import { Terrain } from './terrain.js';
import { drawProps } from './props.js';
import { t } from '../data/strings.js';

const TAU = Math.PI * 2;

export class Renderer {
  constructor(canvas, run, fx, vis, hud) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.run = run; this.fx = fx; this.vis = vis; this.hud = hud;
    this.pal = BIOMES.meadow;
    this.backdrop = new Backdrop();
    this.terrain = new Terrain();
    this.cssW = 0; this.cssH = 0; this.dpr = 1; this.scale = 1; this.viewH = 0; this.groundY = 0;
    this.safe = { top: 0, left: 0, right: 0, bottom: 0 };
    this.time = 0;
    this.skyGrad = null; this.sunGrad = null;
  }

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
    if (Math.abs(px - this.backdrop.pxScale) > 0.01) this.backdrop.build(px, this.pal);

    const c = this.ctx;
    c.setTransform(dpr * this.scale, 0, 0, dpr * this.scale, 0, 0);
    const g = this.groundY;
    this.skyGrad = c.createLinearGradient(0, 0, 0, g + 70);
    this.skyGrad.addColorStop(0, this.pal.skyTop);
    this.skyGrad.addColorStop(0.55, this.pal.skyMid);
    this.skyGrad.addColorStop(0.93, this.pal.skyHorizon);
    this.skyGrad.addColorStop(1, this.pal.sea[0]);
    const sx = VIEW.width * 0.76; const sy = g * 0.26;
    this.sunGrad = c.createRadialGradient(sx, sy, 6, sx, sy, 150);
    this.sunGrad.addColorStop(0, 'rgba(255,248,205,0.95)');
    this.sunGrad.addColorStop(0.18, 'rgba(255,244,190,0.55)');
    this.sunGrad.addColorStop(1, 'rgba(255,240,180,0)');
    this.sunPos = { x: sx, y: sy };
    this.terrain.groundY = -1;   // force soil gradient rebuild
  }

  render(alpha, mode, frameDt) {
    const ctx = this.ctx;
    const run = this.run;
    const W = VIEW.width;
    const g = this.groundY;
    this.time += frameDt;
    const tt = this.time;

    ctx.setTransform(this.dpr * this.scale, 0, 0, this.dpr * this.scale, 0, 0);
    const camX = run.prevCamX + (run.camX - run.prevCamX) * alpha;
    const py = run.prevY + (run.p.y - run.prevY) * alpha;

    // ---- sky
    ctx.fillStyle = this.skyGrad;
    ctx.fillRect(0, 0, W, this.viewH);
    ctx.fillStyle = this.sunGrad;
    ctx.fillRect(0, 0, W, g);
    ctx.fillStyle = 'rgba(255,252,225,0.95)';
    ctx.beginPath(); ctx.arc(this.sunPos.x, this.sunPos.y, 26, 0, TAU); ctx.fill();

    // ---- parallax layers (clouds drift on their own, too)
    const bd = this.backdrop;
    const L = bd.layers;
    bd.drawLayer(ctx, L[0], camX, g, W, tt * 1.5);
    bd.drawLayer(ctx, L[1], camX, g, W, tt * 4);
    bd.drawLayer(ctx, L[2], camX, g, W, 0);
    bd.drawLayer(ctx, L[3], camX, g, W, 0);
    // cloud sea (below the islands) and a fill for very tall screens
    const sea = bd.sea;
    bd.drawLayer(ctx, sea, camX, g, W, tt * 3);
    const seaBottom = g + sea.top + sea.tile.h;
    if (seaBottom < this.viewH) {
      ctx.fillStyle = this.pal.sea[2];
      ctx.fillRect(0, seaBottom - 1, W, this.viewH - seaBottom + 2);
    }

    if (quality.cfg.ambient) this._butterflies(ctx, camX, g, tt);

    // ---- islands
    this.terrain.prepare(ctx, g, this.pal);
    this.terrain.draw(ctx, run, camX, g, W, this.pal);

    // ---- hazards + pickups (+ best-run ghost)
    drawProps(ctx, run, camX, g, tt, t('over.best'));

    // ---- Bramble
    const px = W * VIEW.playerX;
    this.vis.draw(ctx, px, g - py, g, py, run, mode);

    // ---- foreground grass, particles
    this.terrain.drawFront(ctx, run, camX, g, W, this.pal);
    this.fx.draw(ctx, camX, g);

    // ---- HUD in screen pixels
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.hud.draw(ctx, run, this.cssW, this.cssH, this.safe);
  }

  /** A few drifting butterflies for the meadow. Purely cosmetic and very cheap. */
  _butterflies(ctx, camX, g, t) {
    for (let i = 0; i < 3; i++) {
      const bx = ((i * 233 + t * (14 + i * 4) - camX * 0.22) % 640 + 640) % 640 - 60;
      const by = g - 130 - i * 46 + Math.sin(t * 1.7 + i * 2) * 16;
      const flap = Math.abs(Math.sin(t * 9 + i)) * 0.9 + 0.1;
      const hue = ['#ffb3c8', '#ffd98a', '#b9d8ff'][i];
      ctx.fillStyle = hue; ctx.strokeStyle = 'rgba(110,80,70,0.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(bx - 3.5, by, 4 * flap, 5.5, -0.3, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(bx + 3.5, by, 4 * flap, 5.5, 0.3, 0, TAU); ctx.fill(); ctx.stroke();
    }
  }
}
