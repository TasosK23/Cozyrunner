/**
 * backdrop.js — the parallax world behind Bramble, painted in a different style for each biome.
 *
 * Each layer is painted ONCE into an offscreen canvas "tile" (that repeats seamlessly), then
 * scrolled at its own speed by blitting 2-3 copies per frame. That's how we get 5 layers of
 * storybook art at 60 FPS on a phone: the expensive drawing happens off to the side, not per frame.
 *
 * A Backdrop is one biome's set of tiles. The renderer keeps the current biome's set and builds the NEXT
 * one in the background (one layer per frame, see `step()`), then cross-fades between the two as Bramble
 * walks through the doorway.
 *
 * Layers, far to near (factor = how much it moves relative to the ground):
 *   stars (night only)  islets + clouds 0.05  clouds 0.10  far land 0.16  near land 0.30  sea 0.30
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

let glowDot = null;
function glowAt(g, x, y, r, color, a) {
  if (!glowDot) {
    glowDot = document.createElement('canvas'); glowDot.width = glowDot.height = 64;
    const c = glowDot.getContext('2d');
    const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gr; c.fillRect(0, 0, 64, 64);
  }
  // tint the white glow by drawing a colored disc under 'lighter' with the sprite as the alpha shape
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = a;
  g.fillStyle = color;
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  g.restore();
}

// ------------------------------------------------------------------ sky decoration
function layerStars() {
  return (g, w, h) => {
    const r = mulberry32(99);
    for (let i = 0; i < 70; i++) {
      const x = r() * w; const y = r() * h * 0.85;
      const s = 0.6 + r() * 1.3;
      g.fillStyle = r() > 0.8 ? '#ffe8b0' : '#ffffff';
      g.globalAlpha = 0.5 + r() * 0.5;
      g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill();
    }
    g.globalAlpha = 1;
  };
}

/** A distant dragon in flight: a tiny dark silhouette (wings up, tail trailing). */
function farDragon(g, x, y, s, color) {
  g.fillStyle = color;
  g.beginPath(); g.ellipse(x, y, 9 * s, 3.4 * s, -0.15, 0, TAU); g.fill();
  g.beginPath(); g.moveTo(x + 8 * s, y - 1 * s); g.lineTo(x + 17 * s, y - 3 * s); g.lineTo(x + 8 * s, y + 2 * s); g.fill();
  g.beginPath(); g.moveTo(x - 8 * s, y); g.quadraticCurveTo(x - 20 * s, y + 3 * s, x - 28 * s, y - 2 * s); g.lineTo(x - 22 * s, y + 4 * s); g.quadraticCurveTo(x - 14 * s, y + 5 * s, x - 6 * s, y + 2 * s); g.fill();
  g.beginPath(); g.moveTo(x - 2 * s, y - 2 * s); g.lineTo(x - 12 * s, y - 15 * s); g.lineTo(x - 5 * s, y - 9 * s); g.lineTo(x + 1 * s, y - 17 * s); g.lineTo(x + 3 * s, y - 8 * s); g.lineTo(x + 10 * s, y - 12 * s); g.lineTo(x + 5 * s, y - 1 * s); g.closePath(); g.fill();
}

function layerIslets(pal) {
  return (g, w, h) => {
    const r = mulberry32(11);
    // distant smoke clouds
    for (let i = 0; i < 4; i++) {
      const x = (i + 0.2 + r() * 0.5) * (w / 4);
      const y = 56 + r() * (h * 0.5);
      const sc = 0.8 + r() * 0.5;
      g.globalAlpha = pal.style.sea === 'clouds' ? 0.8 : 0.5;
      wrapDraw(w, x, 90, (xx) => cloud(g, xx, y, sc, pal));
    }
    g.globalAlpha = 1;
    // far dragons soaring (not in the caverns)
    if (pal.style.far !== 'grove') {
      const col = pal.night > 0.5 ? 'rgba(10,5,10,0.65)' : 'rgba(30,14,22,0.55)';
      farDragon(g, w * 0.22, h * 0.3, 0.8, col);
      farDragon(g, w * 0.31, h * 0.38, 0.55, col);
      farDragon(g, w * 0.74, h * 0.2, 0.7, col);
    }
    // far floating rock shards with a ruined watchtower or a burnt tree (hazy)
    const spots = [[130, 0.34, 1.0], [470, 0.18, 0.8], [760, 0.46, 1.2]];
    let k = 0;
    for (const [x, fy, s0] of spots) {
      const s = pal.style.far === 'peaks' ? s0 * 1.35 : s0;
      const y = h * fy + 60;
      const tower = (k++ % 2) === 0;
      g.globalAlpha = 0.85;
      wrapDraw(w, x, 90, (xx) => {
        g.fillStyle = pal.isletSoil;
        g.beginPath(); g.moveTo(xx - 38 * s, y); g.lineTo(xx - 24 * s, y + 22 * s); g.lineTo(xx - 10 * s, y + 30 * s); g.lineTo(xx + 2 * s, y + 58 * s); g.lineTo(xx + 16 * s, y + 28 * s); g.lineTo(xx + 38 * s, y); g.closePath(); g.fill();
        g.fillStyle = pal.islet;
        g.beginPath(); g.ellipse(xx, y, 40 * s, 9 * s, 0, 0, TAU); g.fill();
        if (tower) {
          g.fillStyle = pal.trunk;
          g.fillRect(xx - 7 * s, y - 30 * s, 14 * s, 30 * s);
          for (let c = 0; c < 3; c++) g.fillRect(xx - 7 * s + c * 5.5 * s, y - 36 * s, 3.4 * s, 6 * s);
          glowAt(g, xx, y - 20 * s, 9 * s, pal.windows || pal.glow, 0.8);
        } else {
          g.strokeStyle = pal.trunk; g.lineWidth = 3 * s; g.lineCap = 'round';
          g.beginPath(); g.moveTo(xx, y); g.lineTo(xx + 2 * s, y - 26 * s); g.moveTo(xx + 1 * s, y - 14 * s); g.lineTo(xx - 10 * s, y - 24 * s); g.moveTo(xx + 2 * s, y - 20 * s); g.lineTo(xx + 12 * s, y - 30 * s); g.stroke();
        }
        glowAt(g, xx + 22 * s, y - 2 * s, 12 * s, pal.glow, 0.55);       // a little lava seam
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
      g.globalAlpha = pal.night > 0.5 ? 0.6 : 0.95;
      wrapDraw(w, x, 90, (xx) => cloud(g, xx, y, sc, pal));
    }
    g.globalAlpha = 1;
  };
}

// ------------------------------------------------------------------ land
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

/** Pointy mountains that tile (n peaks per tile). */
function peakPath(g, w, base, n, amp, seed) {
  const r = mulberry32(seed);
  const hs = Array.from({ length: n }, () => 0.65 + r() * 0.45);
  g.beginPath();
  g.moveTo(0, base + 400);
  const steps = 90;
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * w;
    const u = (x / w) * n;
    const k = Math.min(n - 1, Math.floor(u));
    const f = u - k;
    const tri = 1 - Math.abs(f * 2 - 1);
    g.lineTo(x, base - amp * hs[k] * Math.pow(tri, 0.85));
  }
  g.lineTo(w, base + 400);
  g.closePath();
  return hs;
}

/** A smoking volcano cone with a glowing crater and lava streaks. */
function volcano(g, x, base, wd, ht, pal, erupt) {
  g.fillStyle = pal.hillFar[0];
  g.beginPath(); g.moveTo(x - wd, base + 40); g.lineTo(x - wd * 0.16, base - ht); g.lineTo(x + wd * 0.16, base - ht); g.lineTo(x + wd, base + 40); g.closePath(); g.fill();
  glowAt(g, x, base - ht, wd * 0.45, pal.glow, 0.8);
  g.strokeStyle = pal.glow; g.lineWidth = 2; g.globalAlpha = 0.75; g.lineCap = 'round';
  for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(x + i * wd * 0.07, base - ht + 4); g.quadraticCurveTo(x + i * wd * 0.2 + 6, base - ht * 0.6, x + i * wd * 0.34, base - ht * 0.18); g.stroke(); }
  g.globalAlpha = 1;
  if (erupt) {
    for (let i = 0; i < 6; i++) {                                     // a soft, drifting ash plume (radial fades, no hard edges)
      const px = x + Math.sin(i * 1.7) * 14 + i * 5; const py = base - ht - 12 - i * 17; const r = 16 + i * 6;
      const gr = g.createRadialGradient(px, py, 0, px, py, r);
      gr.addColorStop(0, `rgba(46,28,34,${0.62 - i * 0.07})`); gr.addColorStop(1, 'rgba(46,28,34,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(px, py, r, 0, TAU); g.fill();
    }
  }
}

function layerFar(pal) {
  return (g, w, h) => {
    const base = h - 140;          // the ground line sits 100 units above the bottom of this tile
    const gr = g.createLinearGradient(0, base - 80, 0, base + 60);
    gr.addColorStop(0, pal.hillFar[0]); gr.addColorStop(1, pal.hillFar[1]);
    g.fillStyle = gr;
    const style = pal.style.far;
    const r = mulberry32(31);
    if (style === 'peaks') {
      const hs = peakPath(g, w, base + 10, 3, 130, 4); g.fill();
      g.fillStyle = 'rgba(210,225,255,0.55)';                         // wind-blasted snow on the caps
      for (let k = 0; k < 3; k++) {
        const cx = ((k + 0.5) / 3) * w; const top = base + 10 - 130 * hs[k];
        g.beginPath(); g.moveTo(cx, top); g.lineTo(cx - 20 * hs[k], top + 24 * hs[k]); g.lineTo(cx - 6, top + 17 * hs[k]); g.lineTo(cx, top + 28 * hs[k]); g.lineTo(cx + 7, top + 18 * hs[k]); g.lineTo(cx + 20 * hs[k], top + 24 * hs[k]); g.closePath(); g.fill();
      }
      // distant lightning scars
      g.strokeStyle = 'rgba(190,215,255,0.35)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(w * 0.2, 6); g.lineTo(w * 0.2 - 10, 40); g.lineTo(w * 0.2 + 4, 44); g.lineTo(w * 0.2 - 8, 82); g.stroke();
    } else if (style === 'mountains') {
      const hs = peakPath(g, w, base + 10, 3, 120, 13); g.fill();
      g.strokeStyle = 'rgba(255,120,60,0.35)'; g.lineWidth = 2;
      g.beginPath();
      for (let i = 0; i <= 90; i++) { const x = (i / 90) * w; const u = (x / w) * 3; const k = Math.min(2, Math.floor(u)); const f = u - k; const tri = 1 - Math.abs(f * 2 - 1); const y = base + 10 - 120 * hs[k] * Math.pow(tri, 0.85); if (i === 0) g.moveTo(x, y); else g.lineTo(x, y); }
      g.stroke();
      volcano(g, w * 0.5, base + 8, 80, 125, pal, true);
    } else if (style === 'village') {                                   // ruined castle skyline
      const amps = [26, 14, 7]; const ph = [0.3, 1.7, 2.9];
      hillPath(g, w, base, amps, ph); g.fill();
      for (let i = 0; i < 4; i++) {
        const x = ((i + 0.35 + r() * 0.3) / 4) * w; const y = hillY(w, x, base, amps, ph) + 3;
        const bw = 26 + r() * 20; const bh = 44 + r() * 40;
        g.fillStyle = 'rgba(30,24,40,0.72)';
        g.fillRect(x - bw / 2, y - bh, bw, bh);
        for (let c = 0; c < 4; c++) g.fillRect(x - bw / 2 + c * (bw / 3.4), y - bh - 6, bw / 6.2, 7);          // battlements
        if (r() > 0.4) { g.beginPath(); g.moveTo(x - bw / 2 - 3, y - bh - 6); g.lineTo(x, y - bh - 26); g.lineTo(x + bw / 2 + 3, y - bh - 6); g.closePath(); g.fill(); }
        glowAt(g, x, y - bh * 0.6, 8, '#ffb347', 0.85);
      }
    } else if (style === 'grove') {                                     // crystal spires and stalagmites
      hillPath(g, w, base, [20, 10, 6], [0.8, 2.1, 0.3]); g.fill();
      for (let i = 0; i < 9; i++) {
        const x = ((i + 0.3 + r() * 0.4) / 9) * w; const y = base + 6;
        const sh = 40 + r() * 70; const cw = 8 + r() * 10;
        g.fillStyle = 'rgba(34,16,32,0.85)';
        g.beginPath(); g.moveTo(x - cw, y); g.lineTo(x - cw * 0.3, y - sh); g.lineTo(x + cw * 0.5, y - sh * 0.8); g.lineTo(x + cw, y); g.closePath(); g.fill();
        if (i % 3 === 0) glowAt(g, x, y - sh * 0.7, 16, i % 2 ? '#3fd0c0' : pal.glow, 0.55);
      }
    } else {                                                            // 'hills': volcanoes under smoky dusk
      const amps = [34, 18, 9]; const ph2 = [0.3, 1.7, 2.9];
      hillPath(g, w, base, amps, ph2); g.fill();
      volcano(g, w * 0.28, base + 4, 90, 110, pal, true);
      volcano(g, w * 0.78, base + 8, 64, 78, pal, false);
    }
    hazeBottom(g, w, h, 120, pal.sea[0]);
  };
}

/** A charred, bare tree with a few ember-lit branch tips. */
function deadTree(g, x, y, s, pal) {
  g.strokeStyle = pal.trunk; g.lineCap = 'round'; g.lineWidth = 5 * s;
  g.beginPath(); g.moveTo(x, y + 2); g.quadraticCurveTo(x - 3 * s, y - 24 * s, x + 2 * s, y - 42 * s); g.stroke();
  g.lineWidth = 3 * s;
  g.beginPath(); g.moveTo(x - 1 * s, y - 22 * s); g.lineTo(x - 15 * s, y - 36 * s); g.moveTo(x + 1 * s, y - 30 * s); g.lineTo(x + 14 * s, y - 44 * s); g.moveTo(x + 2 * s, y - 40 * s); g.lineTo(x - 6 * s, y - 54 * s); g.stroke();
  glowAt(g, x + 14 * s, y - 44 * s, 7 * s, pal.glow, 0.5);
}

function crystal(g, x, y, s, color, dark) {
  g.fillStyle = dark; g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(x - 6 * s, y); g.lineTo(x - 4 * s, y - 24 * s); g.lineTo(x, y - 36 * s); g.lineTo(x + 5 * s, y - 22 * s); g.lineTo(x + 7 * s, y); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = color; g.globalAlpha = 0.85;
  g.beginPath(); g.moveTo(x - 1 * s, y); g.lineTo(x, y - 34 * s); g.lineTo(x + 5 * s, y - 22 * s); g.lineTo(x + 7 * s, y); g.closePath(); g.fill();
  g.globalAlpha = 1;
}

/** Returns {fn, chimneys} so the renderer can drift smoke from the Ruined Keep's braziers. */
function layerNear(pal, out) {
  return (g, w, h) => {
    const base = h - 136;
    const amps = [26, 14, 7]; const ph = [1.2, 0.4, 2.2];
    const gr = g.createLinearGradient(0, base - 50, 0, base + 60);
    gr.addColorStop(0, pal.hillNear[0]); gr.addColorStop(1, pal.hillNear[1]);
    g.fillStyle = gr;
    hillPath(g, w, base, amps, ph); g.fill();
    const r = mulberry32(21);
    const style = pal.style.near;

    if (style === 'houses') {                                          // ruined keep: broken towers, walls, braziers, a dragon skull
      for (let i = 0; i < 5; i++) {
        const x = ((i + 0.3 + r() * 0.35) / 5) * w; const y = hillY(w, x, base, amps, ph) + 5;
        const bw = 30 + r() * 14; const bh = 34 + r() * 26;
        g.fillStyle = '#4a4552'; g.strokeStyle = 'rgba(15,10,20,0.7)'; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(x - bw / 2, y); g.lineTo(x - bw / 2, y - bh); g.lineTo(x - bw / 6, y - bh + 6); g.lineTo(x, y - bh - 4); g.lineTo(x + bw / 4, y - bh + 8); g.lineTo(x + bw / 2, y - bh + 2); g.lineTo(x + bw / 2, y); g.closePath(); g.fill(); g.stroke();
        g.strokeStyle = 'rgba(15,10,20,0.35)'; g.lineWidth = 1;                                           // brick courses
        for (let c = 1; c < 5; c++) { g.beginPath(); g.moveTo(x - bw / 2, y - c * bh / 5); g.lineTo(x + bw / 2, y - c * bh / 5); g.stroke(); }
        g.fillStyle = '#1d1824'; g.beginPath(); g.moveTo(x - 5, y); g.lineTo(x - 5, y - 14); g.quadraticCurveTo(x, y - 20, x + 5, y - 14); g.lineTo(x + 5, y); g.fill();    // doorway
        glowAt(g, x + bw * 0.26, y - bh * 0.62, 11, pal.windows, 0.8);
        g.fillStyle = pal.windows; g.fillRect(x + bw * 0.26 - 2.5, y - bh * 0.62 - 4, 5, 8);
        if (i % 2 === 0) {                                                                                 // torn banner
          g.fillStyle = '#8c2a2f'; g.beginPath(); g.moveTo(x - bw / 2 + 4, y - bh + 4); g.lineTo(x - bw / 2 + 14, y - bh + 4); g.lineTo(x - bw / 2 + 14, y - bh + 28); g.lineTo(x - bw / 2 + 9, y - bh + 22); g.lineTo(x - bw / 2 + 4, y - bh + 28); g.closePath(); g.fill();
        }
        if (i % 2) {                                                                                       // brazier on a stand
          g.strokeStyle = '#2a2024'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + bw / 2 + 12, y); g.lineTo(x + bw / 2 + 12, y - 18); g.stroke();
          g.fillStyle = '#2a2024'; g.beginPath(); g.moveTo(x + bw / 2 + 6, y - 18); g.lineTo(x + bw / 2 + 18, y - 18); g.lineTo(x + bw / 2 + 15, y - 12); g.lineTo(x + bw / 2 + 9, y - 12); g.closePath(); g.fill();
          glowAt(g, x + bw / 2 + 12, y - 24, 16, '#ff8a3a', 0.95);
          g.fillStyle = '#ffb347'; g.beginPath(); g.moveTo(x + bw / 2 + 8, y - 18); g.quadraticCurveTo(x + bw / 2 + 12, y - 36, x + bw / 2 + 16, y - 18); g.fill();
          if (out) out.chimneys.push({ x: x + bw / 2 + 12, y: y - 36 });
        }
      }
      // the dragon-skull landmark, half buried
      const tx = w * 0.58; const ty = hillY(w, tx, base, amps, ph) + 5;
      g.fillStyle = '#e4d9bf'; g.strokeStyle = '#6a5a44'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(tx - 34, ty); g.quadraticCurveTo(tx - 36, ty - 30, tx - 10, ty - 36); g.quadraticCurveTo(tx + 14, ty - 40, tx + 40, ty - 20); g.lineTo(tx + 44, ty - 12); g.lineTo(tx + 30, ty - 8); g.lineTo(tx + 24, ty); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#e4d9bf';
      g.beginPath(); g.moveTo(tx - 14, ty - 34); g.quadraticCurveTo(tx - 30, ty - 56, tx - 52, ty - 60); g.quadraticCurveTo(tx - 34, ty - 44, tx - 26, ty - 30); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(tx, ty - 38); g.quadraticCurveTo(tx - 10, ty - 62, tx - 30, ty - 72); g.quadraticCurveTo(tx - 14, ty - 52, tx - 8, ty - 34); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#1a1018'; g.beginPath(); g.ellipse(tx + 8, ty - 22, 8, 6, -0.3, 0, TAU); g.fill();
      glowAt(g, tx + 8, ty - 22, 10, '#ff8a3a', 0.8);
      g.fillStyle = '#1a1018'; for (let k = 0; k < 4; k++) g.fillRect(tx + 26 + k * 4, ty - 8, 2.4, 8);
    } else if (style === 'mushrooms') {                                // crystal clusters and lava cracks
      const cols = ['#ff7a3a', '#3fd0c0', '#ffb347', '#ff4a6a'];
      for (let i = 0; i < 8; i++) {
        const x = ((i + 0.3 + r() * 0.4) / 8) * w; const y = hillY(w, x, base, amps, ph) + 5;
        const s = 0.7 + r() * 0.9; const col = cols[i % cols.length];
        glowAt(g, x, y - 16 * s, 34 * s, col, 0.3);
        crystal(g, x - 9 * s, y, 0.8 * s, col, '#2c1a2e'); crystal(g, x, y, 1.1 * s, col, '#2c1a2e'); crystal(g, x + 10 * s, y, 0.7 * s, col, '#2c1a2e');
      }
      g.strokeStyle = pal.glow; g.lineWidth = 2; g.globalAlpha = 0.6; g.lineCap = 'round';                // glowing seams in the rock
      for (let i = 0; i < 6; i++) { const x = r() * w; const y = base + 18 + r() * 24; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 14, y + 6); g.lineTo(x + 22, y - 2); g.lineTo(x + 38, y + 5); g.stroke(); }
      g.globalAlpha = 1;
    } else if (style === 'berries') {                                  // jagged rock spires and gale-bent dead pines
      for (let i = 0; i < 8; i++) {
        const x = ((i + 0.3 + r() * 0.4) / 8) * w; const y = hillY(w, x, base, amps, ph) + 5;
        const s = 0.8 + r() * 0.8;
        if (i % 3 === 0) { deadTree(g, x, y, s * 0.8, pal); continue; }
        g.fillStyle = i % 2 ? '#3d4150' : '#4a4e60'; g.strokeStyle = 'rgba(10,12,20,0.6)'; g.lineWidth = 1.4;
        g.beginPath(); g.moveTo(x - 14 * s, y); g.lineTo(x - 7 * s, y - 30 * s); g.lineTo(x - 2 * s, y - 24 * s); g.lineTo(x + 3 * s, y - 52 * s); g.lineTo(x + 11 * s, y - 20 * s); g.lineTo(x + 16 * s, y); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = 'rgba(180,205,255,0.22)'; g.beginPath(); g.moveTo(x + 3 * s, y - 52 * s); g.lineTo(x - 2 * s, y - 24 * s); g.lineTo(x + 1 * s, y - 8 * s); g.closePath(); g.fill();
      }
    } else if (style === 'reeds') {                                    // obsidian shards and fire braziers
      for (let i = 0; i < 12; i++) {
        const x = ((i + 0.3 + r() * 0.4) / 12) * w; const y = hillY(w, x, base, amps, ph) + 5;
        const s = 0.7 + r() * 1.1;
        g.fillStyle = '#15101a'; g.strokeStyle = 'rgba(255,120,70,0.5)'; g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(x - 6 * s, y); g.lineTo(x - 2 * s, y - 34 * s); g.lineTo(x + 3 * s, y - 14 * s); g.lineTo(x + 7 * s, y - 28 * s); g.lineTo(x + 9 * s, y); g.closePath(); g.fill(); g.stroke();
      }
      for (let i = 0; i < 4; i++) {
        const x = ((i + 0.5) / 4) * w + (r() - 0.5) * 40; const y = hillY(w, x, base, amps, ph) + 5;
        g.strokeStyle = '#1f1219'; g.lineWidth = 3.4; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 46); g.stroke();
        g.fillStyle = '#1f1219'; g.beginPath(); g.moveTo(x - 8, y - 46); g.lineTo(x + 8, y - 46); g.lineTo(x + 5, y - 38); g.lineTo(x - 5, y - 38); g.closePath(); g.fill();
        glowAt(g, x, y - 56, 30, pal.glow, 0.8);
        g.fillStyle = '#ffb347'; g.beginPath(); g.moveTo(x - 6, y - 46); g.quadraticCurveTo(x - 2, y - 66, x + 1, y - 72); g.quadraticCurveTo(x + 3, y - 58, x + 6, y - 46); g.fill();
        g.fillStyle = '#fff1b0'; g.beginPath(); g.moveTo(x - 2, y - 46); g.quadraticCurveTo(x, y - 58, x + 2, y - 46); g.fill();
      }
    } else {                                                           // 'trees': charred husks and boulders
      for (let i = 0; i < 9; i++) {
        const x = ((i + 0.3 + r() * 0.5) / 9) * w;
        const y = hillY(w, x, base, amps, ph) + 4;
        const s = 0.7 + r() * 0.7;
        if (i % 3 === 2) {
          g.fillStyle = '#3d3238'; g.strokeStyle = 'rgba(10,6,10,0.6)'; g.lineWidth = 1.4;
          g.beginPath(); g.moveTo(x - 16 * s, y); g.lineTo(x - 11 * s, y - 14 * s); g.lineTo(x, y - 20 * s); g.lineTo(x + 12 * s, y - 12 * s); g.lineTo(x + 17 * s, y); g.closePath(); g.fill(); g.stroke();
          glowAt(g, x + 2 * s, y - 8 * s, 14 * s, pal.glow, 0.35);
        } else deadTree(g, x, y, s, pal);
      }
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
    const style = pal.style.sea;
    if (style === 'water') {                              // a lake of lava: dark crust plates over glowing cracks
      const gl = g.createLinearGradient(0, 0, 0, h);
      gl.addColorStop(0, 'rgba(255,200,90,0.0)'); gl.addColorStop(1, 'rgba(255,200,90,0.35)');
      g.fillStyle = gl; g.fillRect(0, 0, w, h);
      g.lineCap = 'round';
      for (let i = 0; i < 40; i++) {                       // glowing cracks
        const x = r() * w; const y = 14 + r() * (h - 24); const len = 16 + r() * 38;
        g.strokeStyle = `rgba(255,${190 + Math.floor(r() * 50)},90,${0.35 + r() * 0.4})`; g.lineWidth = 1.6 + r() * 1.4;
        wrapDraw(w, x, 60, (xx) => { g.beginPath(); g.moveTo(xx, y); g.lineTo(xx + len * 0.4, y - 4 + r() * 8); g.lineTo(xx + len, y + (r() - 0.5) * 6); g.stroke(); });
      }
      for (let i = 0; i < 16; i++) {                       // dark cooling crust
        const x = r() * w; const y = 24 + r() * (h - 50); const rx = 14 + r() * 26;
        g.fillStyle = `rgba(30,12,16,${0.55 + r() * 0.3})`;
        wrapDraw(w, x, 50, (xx) => { g.beginPath(); g.ellipse(xx, y, rx, 4 + r() * 3, 0, 0, TAU); g.fill(); });
      }
    } else if (style === 'mist') {
      for (let row = 0; row < 5; row++) {
        for (let i = 0; i < 5; i++) {
          const x = ((i + r() * 0.8) / 5) * w; const y = 40 + row * (h / 5.4);
          g.fillStyle = `rgba(255,120,60,${0.07 + row * 0.03})`;
          wrapDraw(w, x, 160, (xx) => { g.beginPath(); g.ellipse(xx, y, 120 + r() * 60, 22 + r() * 8, 0, 0, TAU); g.fill(); });
        }
      }
    } else {
      for (let row = 0; row < 4; row++) {
        for (let i = 0; i < 6; i++) {
          const x = ((i + r() * 0.8) / 6) * w;
          const y = 70 + row * (h / 4.6);
          const sc = 1.5 + r() * 0.8;
          g.globalAlpha = 0.7 + row * 0.08;
          wrapDraw(w, x, 110, (xx) => cloud(g, xx, y, sc, pal));
        }
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
  constructor() {
    this.layers = [];          // islets, clouds, far, near
    this.sea = null;
    this.stars = null;
    this.chimneys = [];
    this.pxScale = 0;
    this.jobs = [];
    this.pal = null;
  }

  get ready() { return this.jobs.length === 0 && this.sea !== null; }

  /** Queue every tile for building. Call step() once per frame, or buildAll() to do it right now. */
  start(pxScale, pal) {
    this.pxScale = pxScale; this.pal = pal;
    this.layers = [null, null, null, null]; this.sea = null; this.stars = null; this.chimneys = [];
    const px = pxScale;
    this.jobs = [
      () => { this.layers[0] = { id: 'islets', factor: 0.05, top: -540, tile: makeTile(TILE_W, 380, px, layerIslets(pal)) }; },
      () => { this.layers[1] = { id: 'clouds', factor: 0.10, top: -420, tile: makeTile(TILE_W, 300, px, layerClouds(pal)) }; },
      () => { this.layers[2] = { id: 'far', factor: 0.16, top: -250, tile: makeTile(TILE_W, 350, px, layerFar(pal)) }; },
      () => {
        const meta = { chimneys: [] };
        this.layers[3] = { id: 'near', factor: 0.30, top: -206, tile: makeTile(TILE_W, 306, px, layerNear(pal, meta)) };
        this.chimneys = meta.chimneys;
      },
      () => { this.sea = { factor: 0.30, top: 40, tile: makeTile(TILE_W, 460, px, layerSea(pal)) }; },
      () => { if (pal.night > 0.05) this.stars = { tile: makeTile(TILE_W, 420, px, layerStars()) }; },
    ];
  }

  /** Build one layer. Returns true while more remain. */
  step() {
    const j = this.jobs.shift();
    if (j) j();
    return this.jobs.length > 0;
  }

  buildAll() { while (this.step()); }

  /** Back-compat helper: rebuild everything now. */
  build(pxScale, pal) { this.start(pxScale, pal); this.buildAll(); }

  /** drawY = groundY. `drift` adds slow cloud movement independent of Bramble. */
  drawLayer(ctx, L, camX, groundY, viewW, drift) {
    if (!L) return;
    const w = L.tile.w;
    const off = (((camX * L.factor + drift) % w) + w) % w;
    const y = groundY + L.top;
    for (let x = -off - w; x < viewW; x += w) ctx.drawImage(L.tile.canvas, x, y, w + 0.6, L.tile.h);
  }

  drawStars(ctx, camX, viewW, alpha, tw) {
    if (!this.stars || alpha <= 0.01) return;
    const t = this.stars.tile;
    const off = (((camX * 0.02) % t.w) + t.w) % t.w;
    ctx.globalAlpha = alpha * (0.85 + 0.15 * Math.sin(tw * 1.3));
    for (let x = -off - t.w; x < viewW; x += t.w) ctx.drawImage(t.canvas, x, 0, t.w + 0.6, t.h);
    ctx.globalAlpha = 1;
  }
}
