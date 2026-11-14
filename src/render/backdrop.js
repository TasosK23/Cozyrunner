/**
 * backdrop.js — the parallax world behind Bramble.
 *
 * Each layer is painted ONCE into an offscreen canvas "tile" (that repeats seamlessly), then
 * scrolled at its own speed by blitting 2-3 copies per frame. That's how we get 5 layers of
 * storybook art at 60 FPS on a phone: the expensive drawing happens at load/resize only.
 *
 * Layers, far to near (factor = how much it moves relative to the ground):
 *   sky gradient + sun  (static)
 *   islets + clouds     0.05 / 0.09   far floating islets and soft clouds
 *   far hills           0.16
 *   near hills + trees  0.30
 *   cloud sea           0.30          (below the islands: what you see through the gaps)
 */
import { mulberry32 } from '../core/rng.js';

const TAU = Math.PI * 2;
export const TILE_W = 900;   // units; every layer repeats every 900 units

function makeTile(wUnits, hUnits, pxScale, draw) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(wUnits * pxScale);
  c.height = Math.ceil(hUnits * pxScale);
  const g = c.getContext('2d');
  g.scale(pxScale, pxScale);
  draw(g, wUnits, hUnits);
  return { canvas: c, w: wUnits, h: hUnits };
}

/** Draw `fn` at x, and again one tile left/right so shapes wrap around the tile edges. */
function wrapDraw(w, x, extent, fn) {
  fn(x);
  if (x < extent) fn(x + w);
  if (x > w - extent) fn(x - w);
}

function cloud(g, x, y, s, pal) {
  g.fillStyle = pal.cloudShade;
  g.beginPath();
  g.ellipse(x, y + 7 * s, 46 * s, 12 * s, 0, 0, TAU);
  g.fill();
  g.fillStyle = pal.cloud;
  const parts = [[-28, 2, 17], [-10, -8, 22], [12, -6, 20], [30, 2, 16], [0, 4, 20]];
  for (const [dx, dy, r] of parts) { g.beginPath(); g.arc(x + dx * s, y + dy * s, r * s, 0, TAU); g.fill(); }
}

function layerIslets(pal) {
  return (g, w, h) => {
    const r = mulberry32(11);
    // distant clouds
    for (let i = 0; i < 4; i++) {
      const x = (i + 0.2 + r() * 0.5) * (w / 4);
      const y = 56 + r() * (h * 0.5);
      const sc = 0.8 + r() * 0.5;
      g.globalAlpha = 0.85;
      wrapDraw(w, x, 90, (xx) => cloud(g, xx, y, sc, pal));
    }
    g.globalAlpha = 1;
    // far floating islets (hazy)
    const spots = [[130, 0.34, 1.0], [470, 0.18, 0.8], [760, 0.46, 1.2]];
    for (const [x, fy, s] of spots) {
      const y = h * fy + 60;
      g.globalAlpha = 0.8;
      wrapDraw(w, x, 90, (xx) => {
        g.fillStyle = pal.isletSoil;
        g.beginPath(); g.moveTo(xx - 38 * s, y); g.quadraticCurveTo(xx - 20 * s, y + 38 * s, xx, y + 54 * s);
        g.quadraticCurveTo(xx + 20 * s, y + 38 * s, xx + 38 * s, y); g.closePath(); g.fill();
        g.fillStyle = pal.islet;
        g.beginPath(); g.ellipse(xx, y, 40 * s, 10 * s, 0, 0, TAU); g.fill();
        // a tiny round tree
        g.fillStyle = pal.trunk; g.fillRect(xx - 2 * s, y - 16 * s, 4 * s, 16 * s);
        g.fillStyle = pal.treeA; g.beginPath(); g.arc(xx, y - 22 * s, 11 * s, 0, TAU); g.fill();
        // chimney smoke puff on the other side
        g.fillStyle = 'rgba(255,255,255,0.7)';
        g.beginPath(); g.arc(xx + 22 * s, y - 20 * s, 4 * s, 0, TAU); g.arc(xx + 26 * s, y - 28 * s, 5 * s, 0, TAU); g.fill();
      });
    }
    g.globalAlpha = 1;
  };
}

function layerClouds(pal) {
  return (g, w, h) => {
    const r = mulberry32(5);
    for (let i = 0; i < 6; i++) {
      const x = (i + r() * 0.8) * (w / 6);
      const y = 56 + r() * (h - 130);
      const sc = 0.8 + r() * 0.6;
      g.globalAlpha = 0.95;
      wrapDraw(w, x, 90, (xx) => cloud(g, xx, y, sc, pal));
    }
    g.globalAlpha = 1;
  };
}

/** Rolling hills that tile: a sum of sines whose periods divide the tile width. */
function hillPath(g, w, base, amps, phases) {
  g.beginPath();
  g.moveTo(0, base + 400);
  for (let x = 0; x <= w; x += 12) {
    let y = base;
    for (let k = 0; k < amps.length; k++) y -= amps[k] * Math.sin((TAU * (k + 1) * x) / w + phases[k]);
    g.lineTo(x, y);
  }
  g.lineTo(w, base + 400);
  g.closePath();
}

function hillY(w, x, base, amps, phases) {
  let y = base;
  for (let k = 0; k < amps.length; k++) y -= amps[k] * Math.sin((TAU * (k + 1) * x) / w + phases[k]);
  return y;
}

/** Fade whatever is already drawn toward `color` over the last `len` units (only where pixels exist). */
function hazeBottom(g, w, h, len, color) {
  g.save();
  g.globalCompositeOperation = 'source-atop';
  const gr = g.createLinearGradient(0, h - len, 0, h);
  gr.addColorStop(0, color + '00'); gr.addColorStop(1, color + 'ff');
  g.fillStyle = gr; g.fillRect(0, h - len, w, len);
  g.restore();
}

function layerHillsFar(pal) {
  return (g, w, h) => {
    const base = h - 140;          // the ground line sits 100 units above the bottom of this tile
    const amps = [34, 18, 9]; const ph = [0.3, 1.7, 2.9];
    const gr = g.createLinearGradient(0, base - 70, 0, base + 60);
    gr.addColorStop(0, pal.hillFar[0]); gr.addColorStop(1, pal.hillFar[1]);
    g.fillStyle = gr;
    hillPath(g, w, base, amps, ph); g.fill();
    hazeBottom(g, w, h, 120, pal.sea[0]);
  };
}

function layerHillsNear(pal) {
  return (g, w, h) => {
    const base = h - 136;
    const amps = [26, 14, 7]; const ph = [1.2, 0.4, 2.2];
    const gr = g.createLinearGradient(0, base - 50, 0, base + 60);
    gr.addColorStop(0, pal.hillNear[0]); gr.addColorStop(1, pal.hillNear[1]);
    g.fillStyle = gr;
    hillPath(g, w, base, amps, ph); g.fill();
    // round storybook trees standing on the hill
    const r = mulberry32(21);
    for (let i = 0; i < 9; i++) {
      const x = ((i + 0.3 + r() * 0.5) / 9) * w;
      const y = hillY(w, x, base, amps, ph) + 4;
      const s = 0.7 + r() * 0.7;
      g.fillStyle = pal.trunk; g.fillRect(x - 2.5 * s, y - 20 * s, 5 * s, 22 * s);
      g.fillStyle = r() > 0.5 ? pal.treeA : pal.treeB;
      g.beginPath(); g.arc(x, y - 30 * s, 15 * s, 0, TAU); g.arc(x - 11 * s, y - 22 * s, 11 * s, 0, TAU); g.arc(x + 11 * s, y - 22 * s, 11 * s, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.16)';
      g.beginPath(); g.arc(x - 4 * s, y - 35 * s, 7 * s, 0, TAU); g.fill();
    }
    hazeBottom(g, w, h, 110, pal.sea[0]);
  };
}

function layerSea(pal) {
  return (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, pal.sea[0]); gr.addColorStop(0.5, pal.sea[1]); gr.addColorStop(1, pal.sea[2]);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const r = mulberry32(8);
    for (let row = 0; row < 4; row++) {
      for (let i = 0; i < 6; i++) {
        const x = ((i + r() * 0.8) / 6) * w;
        const y = 70 + row * (h / 4.6);
        const sc = 1.5 + r() * 0.8;
        g.globalAlpha = 0.7 + row * 0.08;
        wrapDraw(w, x, 110, (xx) => cloud(g, xx, y, sc, pal));
      }
    }
    g.globalAlpha = 1;
    // soft top edge so it melts into the hills' haze: ONE full-tile mask whose alpha ramps 0 -> 1
    // over the first 80 units. (destination-in clears everything a fill doesn't cover, so it must
    // cover the whole tile in a single fill.)
    g.globalCompositeOperation = 'destination-in';
    const m = g.createLinearGradient(0, 0, 0, h);
    m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(80 / h, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = m; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
  };
}

export class Backdrop {
  constructor() { this.layers = []; this.pxScale = 0; }

  /** (Re)build all tiles. `pxScale` = device pixels per world unit. */
  build(pxScale, pal) {
    this.pxScale = pxScale;
    this.layers = [
      { id: 'islets', factor: 0.05, top: -540, tile: makeTile(TILE_W, 380, pxScale, layerIslets(pal)) },
      { id: 'clouds', factor: 0.10, top: -420, tile: makeTile(TILE_W, 300, pxScale, layerClouds(pal)) },
      { id: 'hillsFar', factor: 0.16, top: -210 - 40, tile: makeTile(TILE_W, 350, pxScale, layerHillsFar(pal)) },
      { id: 'hillsNear', factor: 0.30, top: -170 - 36, tile: makeTile(TILE_W, 306, pxScale, layerHillsNear(pal)) },
    ];
    this.sea = { factor: 0.30, top: 40, tile: makeTile(TILE_W, 460, pxScale, layerSea(pal)) };
  }

  /** drawY = groundY. `drift` adds slow cloud movement independent of Bramble. */
  drawLayer(ctx, L, camX, groundY, viewW, drift) {
    const w = L.tile.w;
    const off = (((camX * L.factor + drift) % w) + w) % w;
    const y = groundY + L.top;
    for (let x = -off; x < viewW; x += w) ctx.drawImage(L.tile.canvas, x, y, w + 0.6, L.tile.h);
  }
}
