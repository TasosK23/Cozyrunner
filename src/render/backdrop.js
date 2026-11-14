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

function layerIslets(pal) {
  return (g, w, h) => {
    const r = mulberry32(11);
    // distant clouds
    for (let i = 0; i < 4; i++) {
      const x = (i + 0.2 + r() * 0.5) * (w / 4);
      const y = 56 + r() * (h * 0.5);
      const sc = 0.8 + r() * 0.5;
      g.globalAlpha = pal.style.sea === 'clouds' ? 0.85 : 0.55;
      wrapDraw(w, x, 90, (xx) => cloud(g, xx, y, sc, pal));
    }
    g.globalAlpha = 1;
    // far floating islets (hazy)
    const spots = [[130, 0.34, 1.0], [470, 0.18, 0.8], [760, 0.46, 1.2]];
    for (const [x, fy, s0] of spots) {
      const s = pal.style.far === 'peaks' ? s0 * 1.35 : s0;
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
        if (pal.windows) glowAt(g, xx + 22 * s, y - 8 * s, 10 * s, pal.windows, 0.7);   // a lamp
        else {
          g.fillStyle = 'rgba(255,255,255,0.7)';
          g.beginPath(); g.arc(xx + 22 * s, y - 20 * s, 4 * s, 0, TAU); g.arc(xx + 26 * s, y - 28 * s, 5 * s, 0, TAU); g.fill();
        }
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

function layerFar(pal) {
  return (g, w, h) => {
    const base = h - 140;          // the ground line sits 100 units above the bottom of this tile
    const gr = g.createLinearGradient(0, base - 80, 0, base + 60);
    gr.addColorStop(0, pal.hillFar[0]); gr.addColorStop(1, pal.hillFar[1]);
    g.fillStyle = gr;
    const style = pal.style.far;
    if (style === 'peaks' || style === 'mountains') {
      const hs = peakPath(g, w, base + 10, 3, 120, style === 'peaks' ? 4 : 13); g.fill();
      if (style === 'peaks') {                       // pale snow-icing caps
        g.fillStyle = 'rgba(255,255,255,0.7)';
        for (let k = 0; k < 3; k++) {
          const cx = ((k + 0.5) / 3) * w; const top = base + 10 - 120 * hs[k];
          g.beginPath(); g.moveTo(cx, top); g.lineTo(cx - 24 * hs[k], top + 26 * hs[k]); g.lineTo(cx - 8, top + 20 * hs[k]); g.lineTo(cx, top + 30 * hs[k]); g.lineTo(cx + 9, top + 20 * hs[k]); g.lineTo(cx + 24 * hs[k], top + 26 * hs[k]); g.closePath(); g.fill();
        }
      } else {                                       // moonlit ridge line
        g.strokeStyle = 'rgba(200,215,255,0.22)'; g.lineWidth = 2;
        g.beginPath();
        for (let i = 0; i <= 90; i++) { const x = (i / 90) * w; const u = (x / w) * 3; const k = Math.min(2, Math.floor(u)); const f = u - k; const tri = 1 - Math.abs(f * 2 - 1); const y = base + 10 - 120 * hs[k] * Math.pow(tri, 0.85); if (i === 0) g.moveTo(x, y); else g.lineTo(x, y); }
        g.stroke();
      }
    } else {
      const amps = [34, 18, 9]; const ph = [0.3, 1.7, 2.9];
      hillPath(g, w, base, amps, ph); g.fill();
      const r = mulberry32(31);
      if (style === 'village') {                     // distant cottages
        for (let i = 0; i < 8; i++) {
          const x = ((i + 0.3 + r() * 0.4) / 8) * w; const y = hillY(w, x, base, amps, ph) + 3;
          const bw = 10 + r() * 8; const bh = 8 + r() * 6;
          g.fillStyle = 'rgba(130,85,75,0.38)';
          g.fillRect(x - bw / 2, y - bh, bw, bh);
          g.beginPath(); g.moveTo(x - bw / 2 - 2, y - bh); g.lineTo(x, y - bh - 9); g.lineTo(x + bw / 2 + 2, y - bh); g.closePath(); g.fill();
          g.fillStyle = 'rgba(255,215,120,0.8)'; g.fillRect(x - 1.5, y - bh * 0.7, 3, 3.4);
        }
      } else if (style === 'grove') {                // distant giant mushrooms
        for (let i = 0; i < 7; i++) {
          const x = ((i + 0.3 + r() * 0.4) / 7) * w; const y = hillY(w, x, base, amps, ph) + 4;
          const sh = 34 + r() * 36; const cw = 20 + r() * 20;
          g.fillStyle = 'rgba(40,40,110,0.4)';
          g.fillRect(x - 4, y - sh, 8, sh);
          g.beginPath(); g.ellipse(x, y - sh, cw, cw * 0.55, 0, Math.PI, 0); g.fill();
          glowAt(g, x - cw * 0.3, y - sh - cw * 0.2, 9, pal.glow, 0.5);
        }
      }
    }
    hazeBottom(g, w, h, 120, pal.sea[0]);
  };
}

function tree(g, x, y, s, pal, color) {
  g.fillStyle = pal.trunk; g.fillRect(x - 2.5 * s, y - 20 * s, 5 * s, 22 * s);
  g.fillStyle = color;
  g.beginPath(); g.arc(x, y - 30 * s, 15 * s, 0, TAU); g.arc(x - 11 * s, y - 22 * s, 11 * s, 0, TAU); g.arc(x + 11 * s, y - 22 * s, 11 * s, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.16)';
  g.beginPath(); g.arc(x - 4 * s, y - 35 * s, 7 * s, 0, TAU); g.fill();
}

/** Returns {fn, chimneys} so the renderer can puff smoke from the Teacup Village chimneys. */
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

    if (style === 'houses') {
      const bodies = ['#fff1dc', '#ffe2c2', '#f9d3c0', '#f6e7a8'];
      const roofs = ['#d96a4e', '#c4553f', '#b9654a'];
      for (let i = 0; i < 6; i++) {
        const x = ((i + 0.3 + r() * 0.35) / 6) * w; const y = hillY(w, x, base, amps, ph) + 5;
        const bw = 30 + r() * 12; const bh = 22 + r() * 8;
        g.fillStyle = bodies[i % bodies.length]; g.strokeStyle = 'rgba(110,70,50,0.5)'; g.lineWidth = 1.4;
        g.fillRect(x - bw / 2, y - bh, bw, bh); g.strokeRect(x - bw / 2, y - bh, bw, bh);
        g.fillStyle = roofs[i % roofs.length];
        g.beginPath(); g.moveTo(x - bw / 2 - 4, y - bh); g.lineTo(x, y - bh - 18); g.lineTo(x + bw / 2 + 4, y - bh); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = '#8a5a3a'; g.fillRect(x - 4, y - 13, 8, 13);
        glowAt(g, x + bw * 0.28, y - bh * 0.55, 10, pal.windows, 0.7);
        g.fillStyle = pal.windows; g.fillRect(x + bw * 0.28 - 3, y - bh * 0.55 - 3, 6, 6);
        g.fillStyle = '#8a5a3a'; g.fillRect(x + bw / 2 - 9, y - bh - 20, 5, 12);       // chimney
        if (out) out.chimneys.push({ x: x + bw / 2 - 6.5, y: y - bh - 22 });
        if (i % 2 === 0) tree(g, x + bw / 2 + 14, y, 0.55, pal, pal.treeA);
      }
      // the giant teacup landmark
      const tx = w * 0.58; const ty = hillY(w, tx, base, amps, ph) + 4;
      g.fillStyle = '#e9d9ff'; g.beginPath(); g.ellipse(tx, ty, 30, 7, 0, 0, TAU); g.fill();                  // saucer
      g.fillStyle = '#fff'; g.strokeStyle = '#7a9be0'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(tx - 22, ty - 20); g.quadraticCurveTo(tx - 22, ty - 1, tx, ty - 2); g.quadraticCurveTo(tx + 22, ty - 1, tx + 22, ty - 20); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.arc(tx + 24, ty - 14, 8, -1.2, 1.4); g.stroke();                                         // handle
      g.fillStyle = '#c98f5a'; g.beginPath(); g.ellipse(tx, ty - 20, 22, 4, 0, 0, TAU); g.fill();                // tea
      if (out) out.chimneys.push({ x: tx - 6, y: ty - 24, steam: true });
    } else if (style === 'mushrooms') {
      const caps = ['#e07aa7', '#7ab8e0', '#e0b97a', '#a98ae6'];
      for (let i = 0; i < 9; i++) {
        const x = ((i + 0.3 + r() * 0.4) / 9) * w; const y = hillY(w, x, base, amps, ph) + 5;
        const s = 0.7 + r() * 0.9;
        const col = caps[i % caps.length];
        glowAt(g, x, y - 16 * s, 34 * s, pal.glow, 0.28);
        g.fillStyle = '#f3e6d8'; g.fillRect(x - 3.5 * s, y - 22 * s, 7 * s, 23 * s);
        g.fillStyle = col; g.strokeStyle = 'rgba(60,30,70,0.45)'; g.lineWidth = 1.3;
        g.beginPath(); g.ellipse(x, y - 22 * s, 18 * s, 12 * s, 0, Math.PI, 0); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.8)';
        g.beginPath(); g.arc(x - 7 * s, y - 27 * s, 2.6 * s, 0, TAU); g.arc(x + 5 * s, y - 29 * s, 2 * s, 0, TAU); g.arc(x + 9 * s, y - 24 * s, 1.8 * s, 0, TAU); g.fill();
        if (i % 3 === 0) {                                                                                      // a fern
          g.strokeStyle = pal.treeB; g.lineWidth = 2.2; g.lineCap = 'round';
          for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(x + 22 * s, y); g.quadraticCurveTo(x + 22 * s + k * 6, y - 18, x + 22 * s + k * 12, y - 12); g.stroke(); }
        }
      }
    } else if (style === 'berries') {
      for (let i = 0; i < 8; i++) {
        const x = ((i + 0.3 + r() * 0.4) / 8) * w; const y = hillY(w, x, base, amps, ph) + 5;
        const s = 0.8 + r() * 0.7;
        if (i % 3 === 0) { tree(g, x, y, s, pal, pal.treeA); continue; }
        g.fillStyle = pal.bush[i & 1];
        g.beginPath(); g.arc(x, y - 10 * s, 14 * s, Math.PI, 0); g.arc(x + 14 * s, y - 5 * s, 10 * s, Math.PI * 1.1, 0.1); g.arc(x - 14 * s, y - 5 * s, 10 * s, Math.PI * 0.9, Math.PI * 1.9); g.fill();
        for (let k = 0; k < 7; k++) {
          g.fillStyle = k % 2 ? '#ff9b5e' : '#ff6f91';
          g.beginPath(); g.arc(x + (r() - 0.5) * 30 * s, y - (4 + r() * 16) * s, 2.6 * s, 0, TAU); g.fill();
        }
      }
    } else if (style === 'reeds') {
      for (let i = 0; i < 12; i++) {
        const x = ((i + 0.3 + r() * 0.4) / 12) * w; const y = hillY(w, x, base, amps, ph) + 5;
        g.strokeStyle = '#1f5470'; g.lineWidth = 2; g.lineCap = 'round';
        for (let k = 0; k < 4; k++) {
          const hx = x + (k - 1.5) * 5; const hh = 26 + r() * 22;
          g.beginPath(); g.moveTo(hx, y); g.quadraticCurveTo(hx + (r() - 0.5) * 8, y - hh * 0.6, hx + (k - 1.5) * 3, y - hh); g.stroke();
          if (k % 2) { g.fillStyle = '#5a4a5a'; g.beginPath(); g.ellipse(hx + (k - 1.5) * 3, y - hh - 4, 2.2, 6, 0, 0, TAU); g.fill(); }
        }
      }
      for (let i = 0; i < 4; i++) {                                                                           // lantern posts
        const x = ((i + 0.5) / 4) * w + (r() - 0.5) * 40; const y = hillY(w, x, base, amps, ph) + 5;
        g.strokeStyle = '#3a3f66'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 52); g.stroke();
        glowAt(g, x, y - 56, 26, pal.glow, 0.7);
        g.fillStyle = pal.glow; g.strokeStyle = '#8a5a2b'; g.lineWidth = 1.4;
        g.beginPath(); g.ellipse(x, y - 56, 6, 8, 0, 0, TAU); g.fill(); g.stroke();
      }
    } else {                                                                                                  // 'trees'
      for (let i = 0; i < 9; i++) {
        const x = ((i + 0.3 + r() * 0.5) / 9) * w;
        const y = hillY(w, x, base, amps, ph) + 4;
        const s = 0.7 + r() * 0.7;
        tree(g, x, y, s, pal, r() > 0.5 ? pal.treeA : pal.treeB);
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
    if (style === 'water') {
      g.lineCap = 'round';
      for (let i = 0; i < 46; i++) {                       // ripples
        const x = r() * w; const y = 20 + r() * (h - 30); const len = 14 + r() * 30;
        g.strokeStyle = `rgba(190,205,255,${0.1 + r() * 0.14})`; g.lineWidth = 1.5;
        wrapDraw(w, x, 50, (xx) => { g.beginPath(); g.moveTo(xx, y); g.quadraticCurveTo(xx + len / 2, y - 3, xx + len, y); g.stroke(); });
      }
      for (let i = 0; i < 7; i++) {                        // lantern reflections
        const x = ((i + 0.4) / 7) * w + r() * 40;
        wrapDraw(w, x, 30, (xx) => {
          for (let k = 0; k < 7; k++) {
            g.fillStyle = `rgba(255,217,138,${0.22 - k * 0.025})`;
            g.beginPath(); g.ellipse(xx + Math.sin(k * 1.6 + i) * 3, 20 + k * 20, 9 - k * 0.8, 3, 0, 0, TAU); g.fill();
          }
        });
      }
    } else if (style === 'mist') {
      for (let row = 0; row < 5; row++) {
        for (let i = 0; i < 5; i++) {
          const x = ((i + r() * 0.8) / 5) * w; const y = 40 + row * (h / 5.4);
          g.fillStyle = `rgba(235,225,255,${0.12 + row * 0.04})`;
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
