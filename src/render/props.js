/**
 * props.js — hazards, pickups, tell-markers and the best-run ghost. All code-drawn.
 *
 * Every hazard gets a "tell": a soft bubble with an arrow that fades in as it approaches
 * (green up-arrow = jump, blue down-arrow = slide, double arrow = glide), so you always know
 * what is coming and what to do. (Stage 2 adds a matching sound.)
 */
import { FESTIVAL } from '../data/balance.js';

const TAU = Math.PI * 2;
let glowSprite = null;

function glow() {
  if (glowSprite || typeof document === 'undefined') return glowSprite;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,205,120,0.9)');
  gr.addColorStop(0.4, 'rgba(255,140,60,0.38)');
  gr.addColorStop(1, 'rgba(255,110,40,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  glowSprite = c;
  return c;
}

function drawGlow(ctx, x, y, size, alpha) {
  const s = glow();
  if (!s) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  ctx.drawImage(s, x - size / 2, y - size / 2, size, size);
  ctx.restore();
}

// ------------------------------------------------------------------ tells
function drawTell(ctx, x, y, kind, alpha, t) {
  if (alpha <= 0.02) return;
  const bob = Math.sin(t * 6) * 2.5;
  ctx.save();
  ctx.globalAlpha = alpha * 0.92;
  ctx.translate(x, y + bob);
  ctx.fillStyle = 'rgba(32,22,30,0.88)';
  ctx.strokeStyle = 'rgba(255,170,90,0.75)';
  ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.arc(0, 0, 14, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.lineWidth = 3.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (kind === 'slide') {
    ctx.strokeStyle = '#7fc4ff';
    ctx.beginPath(); ctx.moveTo(-6, -4); ctx.lineTo(0, 4); ctx.lineTo(6, -4); ctx.stroke();
  } else if (kind === 'glide') {
    ctx.strokeStyle = '#ffd36a';
    ctx.beginPath(); ctx.moveTo(-6, 1); ctx.lineTo(0, -5); ctx.lineTo(6, 1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-6, 8); ctx.lineTo(0, 2); ctx.lineTo(6, 8); ctx.stroke();
  } else {
    ctx.strokeStyle = '#8be07a';
    ctx.beginPath(); ctx.moveTo(-6, 4); ctx.lineTo(0, -4); ctx.lineTo(6, 4); ctx.stroke();
  }
  ctx.restore();
}

function tellAlpha(ahead) {
  if (ahead > 540) return 0;
  const inA = Math.min(1, (540 - ahead) / 140);
  const outA = ahead < 20 ? Math.max(0, (ahead + 60) / 80) : 1;
  return Math.max(0, Math.min(inA, outA));
}

// ------------------------------------------------------------------ hazards
/** The "snail" hazard is now a spiked magma crawler: an armored rock beetle with glowing cracks. */
function drawSnail(ctx, x, g, t, hz) {
  const cx = x;
  const breathe = Math.sin(t * 2.4 + cx * 0.02) * 0.8;
  ctx.save();
  ctx.translate(cx, g);
  drawGlow(ctx, 0, -12, 60, 0.35 + 0.1 * Math.sin(t * 3 + cx));
  ctx.strokeStyle = '#1b1218'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  for (let i = -1; i <= 1; i++) {
    const sw = Math.sin(t * 5 + i * 1.7) * 2;
    ctx.beginPath(); ctx.moveTo(i * 9, -8); ctx.lineTo(i * 12 + sw - 4, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i * 9, -8); ctx.lineTo(i * 12 + sw + 4, 0); ctx.stroke();
  }
  ctx.fillStyle = '#3a2f3c'; ctx.strokeStyle = '#150d14'; ctx.lineWidth = 2.2; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-23, -6); ctx.quadraticCurveTo(-24, -26 - breathe, 0, -28 - breathe); ctx.quadraticCurveTo(24, -26 - breathe, 24, -6); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#4c4050';
  ctx.beginPath(); ctx.moveTo(-14, -12); ctx.lineTo(-6, -24); ctx.lineTo(4, -12); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(2, -12); ctx.lineTo(10, -22); ctx.lineTo(18, -12); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#ff8a3a'; ctx.lineWidth = 2; ctx.globalAlpha = 0.75 + 0.25 * Math.sin(t * 4 + cx);
  ctx.beginPath(); ctx.moveTo(-8, -26); ctx.lineTo(-4, -18); ctx.lineTo(-10, -10); ctx.moveTo(8, -26); ctx.lineTo(12, -17); ctx.lineTo(7, -9); ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#d9cdb0'; ctx.strokeStyle = '#150d14'; ctx.lineWidth = 1.4;
  for (let i = 0; i < 4; i++) { const sx = -15 + i * 10; ctx.beginPath(); ctx.moveTo(sx - 3.4, -24 + Math.abs(i - 1.5) * 3); ctx.lineTo(sx, -36 + Math.abs(i - 1.5) * 4); ctx.lineTo(sx + 3.4, -24 + Math.abs(i - 1.5) * 3); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = '#2b2230'; ctx.beginPath(); ctx.ellipse(-24, -9, 8, 7, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.arc(-27, -11, 1.9, 0, TAU); ctx.arc(-21, -12, 1.9, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#150d14'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(-30, -15); ctx.lineTo(-24, -12); ctx.moveTo(-18, -15); ctx.lineTo(-22, -12.5); ctx.stroke();
  ctx.restore();
}

/** The "vine" hazard is now a hanging iron portcullis: chains from above and a row of spikes. Slide under it. */
function drawVine(ctx, h, camX, g, t) {
  const x0 = h.x0 - camX;
  const w = h.x1 - h.x0;
  const cx = x0 + w / 2;
  const bottom = g - h.y0;
  const top = -80;
  const sway = Math.sin(t * 1.7 + h.x0 * 0.03) * 1.2;
  ctx.save();
  ctx.strokeStyle = '#4a4650'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  for (const s of [-0.32, 0.32]) {
    const bx = cx + s * w + sway;
    ctx.setLineDash([5, 3]);
    ctx.beginPath(); ctx.moveTo(bx, top); ctx.lineTo(bx, bottom - 26); ctx.stroke();
    ctx.setLineDash([]);
  }
  const bx = cx - w * 0.5 + sway;
  ctx.fillStyle = '#34303a'; ctx.strokeStyle = '#120d14'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.rect(bx - 2, bottom - 30, w + 4, 9); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#5a5662'; ctx.fillRect(bx, bottom - 29, w, 2);
  ctx.fillStyle = '#6a6672'; ctx.strokeStyle = '#120d14'; ctx.lineWidth = 1.6; ctx.lineJoin = 'round';
  const n = 5;
  for (let i = 0; i < n; i++) {
    const sx = bx + (w * (i + 0.5)) / n;
    ctx.beginPath(); ctx.moveTo(sx - 4.2, bottom - 21); ctx.lineTo(sx, bottom + 1); ctx.lineTo(sx + 4.2, bottom - 21); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  drawGlow(ctx, cx + sway, bottom - 24, 70, 0.22);
  ctx.restore();
}

// ------------------------------------------------------------------ pickups
/** Glow-seeds are now ember shards: small faceted fire-crystals. */
function drawSeed(ctx, x, y, t) {
  const b = Math.sin(t * 3 + x * 0.05) * 2;
  drawGlow(ctx, x, y + b, 30, 0.6);
  ctx.save(); ctx.translate(x, y + b); ctx.rotate(Math.sin(t * 1.4 + x * 0.02) * 0.2);
  ctx.fillStyle = '#ff9a3a'; ctx.strokeStyle = '#a8350f'; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, -2); ctx.lineTo(3.5, 7); ctx.lineTo(-3.5, 7); ctx.lineTo(-6, -2); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffd36a';
  ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, -2); ctx.lineTo(0, 1); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.moveTo(-3.5, -3); ctx.lineTo(-1.4, -6); ctx.lineTo(-0.6, -2.5); ctx.closePath(); ctx.fill();
  ctx.restore();
}

/** The "lantern" pickup is now a brazier-torch: unlit it is cold iron with dying coals, lit it roars. */
function drawLantern(ctx, q, camX, g, t) {
  const x = q.x - camX;
  const y = g - q.y + Math.sin(t * 2 + q.x * 0.03) * 2.5;
  const lit = q.lit;
  if (lit) drawGlow(ctx, x, y - 6, 110, 0.85 + Math.sin(t * 7) * 0.08);
  ctx.strokeStyle = '#3a343c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 7, y - 24); ctx.lineTo(x, y + 12); ctx.lineTo(x + 7, y - 24); ctx.stroke();
  ctx.fillStyle = '#2f2a33'; ctx.strokeStyle = '#120d14'; ctx.lineWidth = 1.8; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x - 11, y - 6); ctx.lineTo(x + 11, y - 6); ctx.lineTo(x + 7, y + 7); ctx.lineTo(x - 7, y + 7); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#6a6672'; ctx.fillRect(x - 12, y - 8, 24, 3);
  if (lit) {
    const f = Math.sin(t * 11) * 1.5;
    ctx.fillStyle = '#ff7a2a'; ctx.beginPath(); ctx.moveTo(x - 9, y - 7); ctx.quadraticCurveTo(x - 10, y - 22, x + f, y - 32); ctx.quadraticCurveTo(x + 10, y - 20, x + 9, y - 7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffc24a'; ctx.beginPath(); ctx.moveTo(x - 5, y - 7); ctx.quadraticCurveTo(x - 5, y - 17, x + f * 0.6, y - 24); ctx.quadraticCurveTo(x + 5, y - 16, x + 5, y - 7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff4c0'; ctx.beginPath(); ctx.ellipse(x, y - 10, 2.4, 4.4 + Math.sin(t * 9) * 0.6, 0, 0, TAU); ctx.fill();
  } else {
    ctx.fillStyle = '#18121a'; ctx.beginPath(); ctx.ellipse(x, y - 8, 8, 2.2, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,120,60,0.55)'; ctx.beginPath(); ctx.arc(x - 2, y - 7, 1.4, 0, TAU); ctx.arc(x + 3, y - 8, 1.1, 0, TAU); ctx.fill();
  }
}

/** The heart pickup is now a dragon heart: a glowing crimson heart cradled in a scale. */
function drawTea(ctx, q, camX, g, t) {
  const x = q.x - camX;
  const y = g - q.y + Math.sin(t * 2.4 + q.x * 0.04) * 3;
  drawGlow(ctx, x, y, 54, 0.6);
  ctx.save(); ctx.translate(x, y + 3);
  ctx.fillStyle = '#5a2030'; ctx.strokeStyle = '#220a12'; ctx.lineWidth = 1.8; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(-13, -2); ctx.lineTo(-8, -9); ctx.lineTo(0, -4); ctx.lineTo(8, -9); ctx.lineTo(13, -2); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
  const hp = 1 + Math.sin(t * 6) * 0.07;
  ctx.save(); ctx.translate(x, y - 6); ctx.scale(hp, hp);
  ctx.fillStyle = '#ff4d5a'; ctx.strokeStyle = '#8a1626'; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.moveTo(0, 9); ctx.bezierCurveTo(-14, -1, -9, -13, 0, -5); ctx.bezierCurveTo(9, -13, 14, -1, 0, 9); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.ellipse(-4, -4, 2, 3, -0.5, 0, TAU); ctx.fill();
  ctx.restore();
}

/** The golden firefly is now a phoenix wisp: a living flame bird. */
function drawFirefly(ctx, q, camX, g, t) {
  const x = q.x - camX + Math.cos(t * 2.3) * 6;
  const y = g - q.y + Math.sin(t * 3.1) * 7;
  drawGlow(ctx, x, y, 96 + Math.sin(t * 8) * 8, 0.95);
  const flap = Math.sin(t * 16);
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = '#ff7a2a'; ctx.strokeStyle = '#b8350f'; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-4, 0); ctx.quadraticCurveTo(-14, -10 - flap * 7, -22, -4 - flap * 9); ctx.quadraticCurveTo(-12, 0, -4, 3); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(4, 0); ctx.quadraticCurveTo(14, -10 - flap * 7, 22, -4 - flap * 9); ctx.quadraticCurveTo(12, 0, 4, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffb83a';
  ctx.beginPath(); ctx.moveTo(-3, 6); ctx.quadraticCurveTo(-6, 20, 0, 26 + flap * 2); ctx.quadraticCurveTo(6, 20, 3, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffd36a'; ctx.beginPath(); ctx.ellipse(0, 0, 6, 8, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(4, -6); ctx.lineTo(11, -4); ctx.lineTo(4, -2); ctx.closePath(); ctx.fillStyle = '#ff9a3a'; ctx.fill();
  ctx.fillStyle = '#2a0d10'; ctx.beginPath(); ctx.arc(2, -4, 1.3, 0, TAU); ctx.fill();
  ctx.restore();
}

/** F-I-R-E letters: carved rune coins. */
function drawLetter(ctx, q, camX, g, t, ch) {
  const x = q.x - camX;
  const y = g - q.y + Math.sin(t * 2.6 + q.x * 0.03) * 3;
  drawGlow(ctx, x, y, 56, 0.6);
  ctx.fillStyle = '#2f2530'; ctx.strokeStyle = '#ff9a3a'; ctx.lineWidth = 2.6; ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i * (TAU / 6); const px = x + Math.cos(a) * 16; const py = y + Math.sin(a) * 16; if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffb347'; ctx.font = '900 17px ui-rounded, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(ch, x, y + 1);
  ctx.textBaseline = 'alphabetic';
}

// ------------------------------------------------------------------ Stage 2 hazards & pickups
/** A falling cinder: a glowing fireball with a short tail. Hitbox is 18x18. */
function drawDrop(ctx, h, camX, g, t) {
  const cx = (h.x0 + h.x1) / 2 - camX;
  const cy = g - h.cy;
  drawGlow(ctx, cx, cy, 46, 0.55);
  ctx.save();
  ctx.translate(cx, cy);
  const fl = Math.sin(t * 20 + h.x0) * 1.2;
  ctx.fillStyle = '#ff5a2a'; ctx.strokeStyle = '#8a2208'; ctx.lineWidth = 1.6; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(fl, -17); ctx.quadraticCurveTo(10, -4, 8, 3); ctx.arc(0, 3, 8.2, 0, Math.PI); ctx.quadraticCurveTo(-10, -4, fl, -17); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.ellipse(0, 3, 5, 6, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff2b0'; ctx.beginPath(); ctx.ellipse(0, 4, 2.4, 3.2, 0, 0, TAU); ctx.fill();
  ctx.restore();
}

/** Steam vent (the old "bouncy mushroom"): a stone vent that squashes then blasts a jet of steam. */
function drawPad(ctx, pad, camX, g, t) {
  const x = pad.x - camX;
  const sq = Math.max(0, pad.squash || 0);
  ctx.save();
  ctx.translate(x + 29, g - 3);
  drawGlow(ctx, 0, -10, 90, 0.3 + sq * 0.4);
  // stone cone
  ctx.fillStyle = '#4a4252'; ctx.strokeStyle = '#150e18'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(-18, -14 + sq * 4); ctx.lineTo(18, -14 + sq * 4); ctx.lineTo(30, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#5d5568'; ctx.beginPath(); ctx.moveTo(-18, -14 + sq * 4); ctx.lineTo(18, -14 + sq * 4); ctx.lineTo(14, -9 + sq * 3); ctx.lineTo(-14, -9 + sq * 3); ctx.closePath(); ctx.fill();
  // glowing mouth
  ctx.fillStyle = '#ff7a2a'; ctx.beginPath(); ctx.ellipse(0, -14 + sq * 4, 12, 3.4 - sq, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffd36a'; ctx.beginPath(); ctx.ellipse(0, -14 + sq * 4, 6, 1.6, 0, 0, TAU); ctx.fill();
  // steam puffs rising (idle wisps; a taller column when triggered)
  ctx.fillStyle = 'rgba(235,225,225,0.7)';
  const n = 3 + Math.round(sq * 3);
  for (let i = 0; i < n; i++) {
    const ph = (t * (0.7 + sq * 0.8) + i / n) % 1;
    ctx.globalAlpha = (1 - ph) * (0.55 + sq * 0.35);
    ctx.beginPath(); ctx.arc(Math.sin(ph * 6 + i * 2) * 4, -18 - ph * (30 + sq * 50), 4 + ph * (6 + sq * 4), 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawGoldSeed(ctx, x, y, t, swarm) {
  const b = Math.sin(t * 3.4 + x * 0.05) * 2.4;
  drawGlow(ctx, x, y + b, swarm ? 40 : 50, 0.9);
  ctx.save(); ctx.translate(x, y + b); ctx.rotate(Math.sin(t * 2 + x) * 0.2);
  ctx.fillStyle = swarm ? '#ffe28a' : '#ffc928'; ctx.strokeStyle = swarm ? '#e08a20' : '#b86a08'; ctx.lineWidth = 1.8; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(8, -3); ctx.lineTo(5, 8); ctx.lineTo(-5, 8); ctx.lineTo(-8, -3); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(8, -3); ctx.lineTo(0, 1); ctx.closePath(); ctx.fill();
  ctx.restore();
}

const POWER_COLOR = { honey: '#ffbf3f', hop: '#9fd8ff', dash: '#ff6a3a', burst: '#ffd36a', blanket: '#ff8a5a' };
const POWER_KINDS = ['honey', 'hop', 'dash', 'burst', 'blanket'];

/** honey = Gold Magnet (horseshoe), hop = Wing Gust, dash = Inferno Dash (flame), burst = Firestorm, blanket = Scale Shield */
function drawPowerIcon(ctx, kind, x, y, s, t) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  switch (kind) {
    case 'honey':
      ctx.strokeStyle = '#c4362a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 1, 8, Math.PI, 0); ctx.lineTo(8, 7); ctx.moveTo(-8, 1); ctx.lineTo(-8, 7); ctx.stroke();
      ctx.strokeStyle = '#e8e2d6'; ctx.beginPath(); ctx.moveTo(8, 6); ctx.lineTo(8, 10); ctx.moveTo(-8, 6); ctx.lineTo(-8, 10); ctx.stroke();
      break;
    case 'hop':
      ctx.fillStyle = '#cfe9ff'; ctx.strokeStyle = '#4a7aa8';
      ctx.beginPath(); ctx.moveTo(-10, 8); ctx.quadraticCurveTo(-10, -8, 2, -12); ctx.quadraticCurveTo(10, -12, 12, -4); ctx.quadraticCurveTo(6, -6, 4, -2); ctx.quadraticCurveTo(8, 0, 6, 6); ctx.quadraticCurveTo(0, 2, -2, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    case 'dash':
      ctx.fillStyle = '#ff6a3a'; ctx.strokeStyle = '#8a2a10';
      ctx.beginPath(); ctx.moveTo(0, -14); ctx.quadraticCurveTo(12, -2, 8, 7); ctx.quadraticCurveTo(0, 14, -8, 7); ctx.quadraticCurveTo(-11, -2, -3, -7); ctx.quadraticCurveTo(-2, -3, 1, -5); ctx.quadraticCurveTo(2, -10, 0, -14); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffd36a'; ctx.beginPath(); ctx.moveTo(0, -2); ctx.quadraticCurveTo(5, 3, 3, 8); ctx.quadraticCurveTo(0, 10, -3, 8); ctx.quadraticCurveTo(-5, 3, 0, -2); ctx.fill();
      break;
    case 'burst':
      ctx.fillStyle = '#ffd36a'; ctx.strokeStyle = '#b8601a';
      ctx.beginPath();
      for (let i = 0; i < 16; i++) { const a = i * (TAU / 16) + t * 0.8; const r = i % 2 ? 6 : 13; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    default:
      ctx.fillStyle = '#a8442e'; ctx.strokeStyle = '#3a1410';
      ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(10, -10); ctx.lineTo(10, 1); ctx.quadraticCurveTo(10, 10, 0, 14); ctx.quadraticCurveTo(-10, 10, -10, 1); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e8c070'; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(5, 0); ctx.lineTo(0, 8); ctx.lineTo(-5, 0); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

export { drawPowerIcon, POWER_COLOR, POWER_KINDS };

function drawPower(ctx, q, camX, g, t) {
  const x = q.x - camX;
  const y = g - q.y + Math.sin(t * 2.2 + q.x * 0.03) * 4;
  const kind = POWER_KINDS[q.kind % 5];
  const col = POWER_COLOR[kind];
  drawGlow(ctx, x, y, 80, 0.55);
  ctx.fillStyle = 'rgba(32,22,30,0.92)'; ctx.strokeStyle = col; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x, y, 18, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 5);
  ctx.beginPath(); ctx.arc(x, y, 22 + Math.sin(t * 5) * 1.5, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
  drawPowerIcon(ctx, kind, x, y, 0.85, t);
}

// ------------------------------------------------------------------ decor (background-ish things placed by chunks/events)
function drawDecor(ctx, d, camX, g, t) {
  const x0 = d.x0 - camX; const x1 = d.x1 - camX;
  if (x1 < -40 || x0 > 620) return;
  if (d.kind === 'cloud') {                              // a brooding smoke cloud dripping cinders
    const w = d.x1 - d.x0; const cx = x0 + w / 2; const y = g - 250;
    ctx.save();
    const n = Math.max(3, Math.round(w / 55));
    ctx.fillStyle = '#3d3140'; ctx.strokeStyle = '#241a28'; ctx.lineWidth = 1.6;
    for (let i = 0; i < n; i++) {
      const bx = x0 + 14 + ((w - 28) * i) / (n - 1);
      const by = y + Math.sin(t * 1.2 + i * 1.7) * 3;
      ctx.beginPath(); ctx.arc(bx, by, 26 + (i % 2) * 6, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = '#54445a';
    for (let i = 0; i < n; i++) { const bx = x0 + 14 + ((w - 28) * i) / (n - 1); ctx.beginPath(); ctx.arc(bx, y - 10 + (i % 2) * 4, 20, 0, TAU); ctx.fill(); }
    // glowing underbelly and furious brow
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.4;
    const gr = ctx.createLinearGradient(0, y + 8, 0, y + 40); gr.addColorStop(0, 'rgba(255,110,40,0.55)'); gr.addColorStop(1, 'rgba(255,110,40,0)');
    ctx.fillStyle = gr; ctx.fillRect(x0 - 6, y + 8, w + 12, 32);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.strokeStyle = '#ff9a3a'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - 18, y - 6); ctx.lineTo(cx - 5, y); ctx.moveTo(cx + 18, y - 6); ctx.lineTo(cx + 5, y); ctx.stroke();
    ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.arc(cx - 10, y + 6, 2.4, 0, TAU); ctx.arc(cx + 10, y + 6, 2.4, 0, TAU); ctx.fill();
    ctx.restore();
  } else if (d.kind === 'rainbow') {                    // an arc of molten gold shards
    const w = d.x1 - d.x0; const cx = x0 + w / 2; const r = Math.max(60, w / 2);
    const cols = ['#ff4a2a', '#ff7a2a', '#ffa83a', '#ffd36a', '#fff0a0', '#ffc24a'];
    ctx.save(); ctx.lineWidth = 6; ctx.globalAlpha = 0.85; ctx.lineCap = 'butt';
    for (let i = 0; i < cols.length; i++) { ctx.strokeStyle = cols[i]; ctx.beginPath(); ctx.arc(cx, g + 30, r - i * 5.5, Math.PI, 0); ctx.stroke(); }
    ctx.restore();
  } else if (d.kind === 'lanternrow') {                 // a string of braziers
    ctx.save(); ctx.strokeStyle = 'rgba(30,20,28,0.8)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x0, g - 230); ctx.quadraticCurveTo((x0 + x1) / 2, g - 190, x1, g - 230); ctx.stroke();
    for (let i = 0; i <= 6; i++) {
      const u = i / 6; const lx = x0 + (x1 - x0) * u; const ly = g - 230 + Math.sin(u * Math.PI) * 40 + 10;
      drawGlow(ctx, lx, ly + 8, 54, 0.6);
      ctx.fillStyle = '#ff7a2a'; ctx.beginPath(); ctx.moveTo(lx - 5, ly + 14); ctx.quadraticCurveTo(lx - 6, ly + 2, lx, ly - 6 + Math.sin(t * 9 + i) * 1.5); ctx.quadraticCurveTo(lx + 6, ly + 2, lx + 5, ly + 14); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffd36a'; ctx.beginPath(); ctx.ellipse(lx, ly + 10, 2.4, 4, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}

/** The Fire Festival: a string of war-banners and braziers, and a ring that shrinks onto each beat. */
function drawFestival(ctx, run, camX, g, t, px) {
  for (let i = 0; i < run.fests.length; i++) {
    const f = run.fests[i];
    const x0 = f.x0 - camX; const x1 = f.x1 - camX;
    if (x1 < -40 || x0 > 620) continue;
    ctx.save();
    ctx.strokeStyle = 'rgba(30,20,28,0.8)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x0, g - 200); ctx.quadraticCurveTo((x0 + x1) / 2, g - 150, x1, g - 200); ctx.stroke();
    const n = Math.max(4, Math.round((f.x1 - f.x0) / 60));
    const cols = ['#9a2a30', '#d9722a', '#7a2230', '#e8a23a'];
    for (let k = 0; k <= n; k++) {
      const u = k / n; const lx = x0 + (x1 - x0) * u; const ly = g - 200 + Math.sin(u * Math.PI) * 50 + 4;
      ctx.fillStyle = cols[k % cols.length];
      ctx.beginPath(); ctx.moveTo(lx - 7, ly); ctx.lineTo(lx + 7, ly); ctx.lineTo(lx + 7, ly + 18); ctx.lineTo(lx, ly + 13 + Math.sin(t * 3 + k) * 1.5); ctx.lineTo(lx - 7, ly + 18); ctx.closePath(); ctx.fill();
      if (k % 2 === 0) { drawGlow(ctx, lx, ly - 4, 40, 0.55); ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.arc(lx, ly - 4, 4, 0, TAU); ctx.fill(); }
    }
    ctx.restore();
  }
  const f = run.fest;
  if (f && f.active && !f.finished) {
    const FEST = FESTIVAL;
    for (let k = 0; k < FEST.beats; k++) {
      if (f.hit[k]) continue;
      const tau = f.t0 + k * FEST.beatLen - run.time;
      if (tau > FEST.lead + 0.05 || tau < -FEST.window) continue;
      const u = Math.max(0, Math.min(1, tau / FEST.lead));
      const r = 22 + 70 * u;
      const a = Math.max(0, Math.min(1, 1 - Math.abs(tau) / (FEST.lead + 0.1)) + 0.25);
      const cy = g - run.p.y - 34;
      ctx.save(); ctx.globalAlpha = Math.min(1, a);
      ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(px, cy, r, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, cy, 22, 0, TAU); ctx.stroke();
      ctx.restore();
      break;
    }
  }
}

function drawGhost(ctx, x, g, t, label, hover) {
  const y = g - (hover ? 24 + Math.sin(t * 2) * 4 : 0);
  ctx.save();
  ctx.globalAlpha = 0.66;
  ctx.strokeStyle = 'rgba(220,230,255,0.9)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, g); ctx.lineTo(x, y - 80); ctx.stroke();
  ctx.fillStyle = 'rgba(200,215,255,0.85)';
  ctx.beginPath(); ctx.moveTo(x, y - 80); ctx.lineTo(x + 58, y - 76 + Math.sin(t * 4) * 2); ctx.lineTo(x + 48, y - 66); ctx.lineTo(x + 58, y - 58); ctx.lineTo(x, y - 60); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#3a4468'; ctx.font = '800 10px ui-rounded, system-ui, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(label, x + 5, y - 66);
  ctx.fillStyle = 'rgba(210,222,255,0.78)';
  ctx.beginPath(); ctx.moveTo(x - 16, y - 20); ctx.quadraticCurveTo(x - 18, y - 40, x - 2, y - 44); ctx.lineTo(x + 16, y - 38); ctx.lineTo(x + 24, y - 30); ctx.lineTo(x + 8, y - 24); ctx.quadraticCurveTo(x - 4, y - 16, x - 16, y - 20); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 8, y - 42); ctx.quadraticCurveTo(x - 18, y - 56, x - 32, y - 56); ctx.quadraticCurveTo(x - 18, y - 46, x - 2, y - 38); ctx.fill();
  ctx.fillStyle = 'rgba(60,70,110,0.9)'; ctx.beginPath(); ctx.moveTo(x + 2, y - 36); ctx.lineTo(x + 12, y - 33); ctx.lineTo(x + 3, y - 31); ctx.fill();
  ctx.restore();
}

export function drawProps(ctx, run, camX, groundY, t, bestLabel) {
  const px = run.p.x;
  const letters = ['F', 'I', 'R', 'E'];

  // best-run ghost
  if (run.ghostX > 0 && !run.ghostPassed && run.ghostX - camX < 700) {
    drawGhost(ctx, run.ghostX - camX, groundY, t, bestLabel, !run.groundAt(run.ghostX));
  }

  for (let i = 0; i < run.decor.length; i++) drawDecor(ctx, run.decor[i], camX, groundY, t);
  drawFestival(ctx, run, camX, groundY, t, run.p.x - camX);
  for (let i = 0; i < run.pads.length; i++) {
    const pd = run.pads[i];
    const sx = pd.x - camX;
    if (sx > 640 || sx < -90) continue;
    drawPad(ctx, pd, camX, groundY, t);
    const ahead = pd.x0 - px;
    if (ahead > -30) drawTell(ctx, sx + 29, groundY - 70, 'jump', tellAlpha(ahead) * 0.8, t);
  }

  for (let i = 0; i < run.hazards.length; i++) {
    const h = run.hazards[i];
    if (!h.active) continue;
    const sx = h.x0 - camX;
    if (sx > 700 || h.x1 - camX < -80) continue;
    const ahead = h.x0 - px;
    if (h.type === 'snail') drawSnail(ctx, sx + (h.x1 - h.x0) / 2, groundY, t, h);
    else if (h.type === 'vine') drawVine(ctx, h, camX, groundY, t);
    else if (h.type === 'drop') drawDrop(ctx, h, camX, groundY, t);
    if (!h.passed && ahead > -40) {
      const a = tellAlpha(ahead);
      if (h.type === 'snail') drawTell(ctx, sx + 19, groundY - 78, 'jump', a, t);
      else if (h.type === 'vine') drawTell(ctx, sx + 22, groundY - 96, 'slide', a, t);
      else if (h.type === 'drop') { /* the raindrop itself is the warning; its sound tells you too */ }
      else drawTell(ctx, (h.x0 + h.x1) / 2 - camX, groundY - 90, h.hint === 'glide' ? 'glide' : 'jump', a, t);
    }
  }

  for (let i = 0; i < run.pickups.length; i++) {
    const q = run.pickups[i];
    if (!q.active) continue;
    const sx = q.x - camX;
    if (sx > 620 || sx < -60) continue;
    switch (q.type) {
      case 'seed':
        if (q.var === 1 || q.var === 2) drawGoldSeed(ctx, sx, groundY - q.y, t, q.var === 2);
        else drawSeed(ctx, sx, groundY - q.y, t);
        break;
      case 'power': drawPower(ctx, q, camX, groundY, t); break;
      case 'lantern': drawLantern(ctx, q, camX, groundY, t); break;
      case 'tea': drawTea(ctx, q, camX, groundY, t); break;
      case 'firefly': drawFirefly(ctx, q, camX, groundY, t); break;
      case 'letter': drawLetter(ctx, q, camX, groundY, t, letters[q.letter]); break;
      default:
    }
  }
}
