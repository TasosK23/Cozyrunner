/**
 * props.js — hazards, pickups, tell-markers and the best-run ghost. All code-drawn.
 *
 * Every hazard gets a "tell": a soft bubble with an arrow that fades in as it approaches
 * (green up-arrow = jump, blue down-arrow = slide, double arrow = glide), so you always know
 * what is coming and what to do. (Stage 2 adds a matching sound.)
 */
const TAU = Math.PI * 2;
let glowSprite = null;

function glow() {
  if (glowSprite || typeof document === 'undefined') return glowSprite;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,240,170,0.9)');
  gr.addColorStop(0.4, 'rgba(255,225,130,0.35)');
  gr.addColorStop(1, 'rgba(255,215,120,0)');
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
  ctx.fillStyle = '#fffaf0';
  ctx.strokeStyle = 'rgba(120,85,55,0.55)';
  ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.arc(0, 0, 14, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.lineWidth = 3.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (kind === 'slide') {
    ctx.strokeStyle = '#4a97d6';
    ctx.beginPath(); ctx.moveTo(-6, -4); ctx.lineTo(0, 4); ctx.lineTo(6, -4); ctx.stroke();
  } else if (kind === 'glide') {
    ctx.strokeStyle = '#6dae3e';
    ctx.beginPath(); ctx.moveTo(-6, 1); ctx.lineTo(0, -5); ctx.lineTo(6, 1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-6, 8); ctx.lineTo(0, 2); ctx.lineTo(6, 8); ctx.stroke();
  } else {
    ctx.strokeStyle = '#5bb04a';
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
function drawSnail(ctx, x, g, t, hz) {
  const cx = x;       // hitbox is 38 wide; art is a bit larger
  const breathe = Math.sin(t * 1.8 + cx * 0.02) * 0.8;
  ctx.save();
  ctx.translate(cx, g);
  // body (head toward the left, where Bramble comes from)
  ctx.fillStyle = '#f7e6c8'; ctx.strokeStyle = '#b79b74'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-24, 0);
  ctx.quadraticCurveTo(-27, -12 - breathe, -17, -17 - breathe);
  ctx.quadraticCurveTo(-7, -17, 2, -11);
  ctx.lineTo(22, -9); ctx.quadraticCurveTo(28, -5, 25, 0); ctx.closePath();
  ctx.fill(); ctx.stroke();
  // sleepy eye stalks
  ctx.strokeStyle = '#b79b74'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-21, -14); ctx.lineTo(-25, -26); ctx.moveTo(-14, -16); ctx.lineTo(-14, -28); ctx.stroke();
  ctx.fillStyle = '#f7e6c8';
  ctx.beginPath(); ctx.arc(-25, -27, 4, 0, TAU); ctx.arc(-14, -29, 4, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#4a3a30'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-27.5, -27); ctx.lineTo(-22.5, -27); ctx.moveTo(-16.5, -29); ctx.lineTo(-11.5, -29); ctx.stroke();
  // cheek
  ctx.fillStyle = 'rgba(245,163,160,0.8)'; ctx.beginPath(); ctx.ellipse(-19, -8, 3.4, 2.2, 0, 0, TAU); ctx.fill();
  // shell
  ctx.fillStyle = '#f4b3a3'; ctx.strokeStyle = '#c4786b'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(8, -17, 15, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#e58f86'; ctx.lineWidth = 2.2;
  ctx.beginPath();
  for (let a = 0; a < 9; a += 0.4) { const r = 1.4 + a * 1.25; const px = 8 + Math.cos(a) * r; const py = -17 + Math.sin(a) * r; if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
  ctx.stroke();
  // floating z z
  ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.strokeStyle = 'rgba(90,70,110,0.6)'; ctx.lineWidth = 3;
  ctx.font = '800 13px ui-rounded, system-ui, sans-serif'; ctx.textAlign = 'center';
  const zt = (t * 0.7 + cx * 0.013) % 1;
  ctx.globalAlpha = 1 - zt;
  ctx.strokeText('z', -6 + zt * 8, -36 - zt * 22); ctx.fillText('z', -6 + zt * 8, -36 - zt * 22);
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawVine(ctx, h, camX, g, t) {
  const x0 = h.x0 - camX;
  const w = h.x1 - h.x0;
  const cx = x0 + w / 2;
  const bottom = g - h.y0;         // y where the chimes end (the hitbox edge)
  const top = -80;
  const sway = Math.sin(t * 1.7 + h.x0 * 0.03);
  ctx.save();
  // strands
  ctx.strokeStyle = '#5da04e'; ctx.lineCap = 'round';
  for (let s = -1; s <= 1; s++) {
    ctx.lineWidth = s === 0 ? 5 : 3.2;
    ctx.beginPath();
    const bx = cx + s * (w * 0.34);
    ctx.moveTo(bx, top);
    const steps = 9;
    for (let i = 1; i <= steps; i++) {
      const yy = top + ((bottom - 20 - top) * i) / steps;
      const xx = bx + Math.sin(i * 0.9 + s + t * 1.2) * 4 * (i / steps) + sway * 2 * (i / steps);
      ctx.lineTo(xx, yy);
    }
    ctx.stroke();
  }
  // leaves along the thick strand
  ctx.fillStyle = '#85c565'; ctx.strokeStyle = '#58994a'; ctx.lineWidth = 1.4;
  for (let i = 0; i < 9; i++) {
    const yy = bottom - 28 - i * 26;
    if (yy < -20) break;
    const side = i % 2 ? 1 : -1;
    ctx.save(); ctx.translate(cx + sway * 1.5, yy); ctx.rotate(side * (0.9 + 0.12 * Math.sin(t * 2 + i)));
    ctx.beginPath(); ctx.ellipse(side * 9, 0, 10, 4.6, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  // wind chime: ring + three tubes that end at the hitbox edge
  const ringY = bottom - 22;
  ctx.fillStyle = '#c9954f'; ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.ellipse(cx + sway * 1.5, ringY, w * 0.5, 4.5, 0, 0, TAU); ctx.fill(); ctx.stroke();
  const tubes = [[-0.32, 18, '#ffd98a'], [0, 22, '#9fd8f0'], [0.32, 16, '#f6b3c6']];
  for (let i = 0; i < 3; i++) {
    const ang = Math.sin(t * 2.6 + i * 1.7 + h.x0 * 0.05) * 0.14;
    ctx.save();
    ctx.translate(cx + sway * 1.5 + tubes[i][0] * w, ringY + 2);
    ctx.rotate(ang);
    ctx.fillStyle = tubes[i][2]; ctx.strokeStyle = 'rgba(100,70,50,0.7)'; ctx.lineWidth = 1.4;
    const len = Math.min(tubes[i][1], bottom - ringY - 2 + 12);
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-2.8, 0, 5.6, len + 2, 2.8); else ctx.rect(-2.8, 0, 5.6, len + 2);
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ pickups
function drawSeed(ctx, x, y, t) {
  const b = Math.sin(t * 3 + x * 0.05) * 2;
  drawGlow(ctx, x, y + b, 30, 0.55);
  ctx.fillStyle = '#fff2ad'; ctx.strokeStyle = '#e8b947'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y + b - 8); ctx.quadraticCurveTo(x + 7, y + b - 1, x, y + b + 6); ctx.quadraticCurveTo(x - 7, y + b - 1, x, y + b - 8);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(x - 1.8, y + b - 2.5, 1.5, 0, TAU); ctx.fill();
}

function drawLantern(ctx, q, camX, g, t) {
  const x = q.x - camX;
  const y = g - q.y + Math.sin(t * 2 + q.x * 0.03) * 2.5;
  const lit = q.lit;
  if (lit) drawGlow(ctx, x, y, 96, 0.8 + Math.sin(t * 7) * 0.08);
  ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(x, y - 24); ctx.lineTo(x, y - 14); ctx.stroke();
  ctx.fillStyle = lit ? '#ffcf6a' : '#d9bf9c'; ctx.strokeStyle = lit ? '#c47f2a' : '#a68a68'; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.ellipse(x, y, 11, 14, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = lit ? 'rgba(196,127,42,0.7)' : 'rgba(166,138,104,0.7)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.ellipse(x, y, 5, 14, 0, 0, TAU); ctx.moveTo(x - 11, y); ctx.lineTo(x + 11, y); ctx.stroke();
  ctx.fillStyle = '#7a5a3a';
  ctx.fillRect(x - 6, y - 16, 12, 4); ctx.fillRect(x - 5, y + 12, 10, 3);
  if (lit) { ctx.fillStyle = '#fff7d1'; ctx.beginPath(); ctx.ellipse(x, y, 3.2, 5.4 + Math.sin(t * 9) * 0.6, 0, 0, TAU); ctx.fill(); }
  else { ctx.fillStyle = 'rgba(80,60,40,0.55)'; ctx.font = '800 9px ui-rounded, system-ui'; ctx.textAlign = 'center'; ctx.fillText('z', x + 1, y + 3); }
}

function drawTea(ctx, q, camX, g, t) {
  const x = q.x - camX;
  const y = g - q.y + Math.sin(t * 2.4 + q.x * 0.04) * 3;
  drawGlow(ctx, x, y, 44, 0.5);
  ctx.save(); ctx.translate(x, y); ctx.rotate(-0.5 + Math.sin(t * 2) * 0.12);
  ctx.fillStyle = '#9fe08a'; ctx.strokeStyle = '#4f9f4a'; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.moveTo(-13, 7); ctx.bezierCurveTo(-12, -13, 6, -17, 14, -9); ctx.bezierCurveTo(12, 5, -2, 12, -13, 7); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-12, 6); ctx.quadraticCurveTo(0, -2, 11, -8); ctx.stroke();
  ctx.restore();
  // a tiny heart floats above it
  ctx.fillStyle = '#f48a92';
  const hy = y - 20 - Math.sin(t * 3) * 1.5;
  ctx.beginPath(); ctx.moveTo(x, hy + 4); ctx.bezierCurveTo(x - 8, hy - 2, x - 4, hy - 8, x, hy - 3); ctx.bezierCurveTo(x + 4, hy - 8, x + 8, hy - 2, x, hy + 4); ctx.fill();
}

function drawFirefly(ctx, q, camX, g, t) {
  const x = q.x - camX + Math.cos(t * 2.3) * 6;
  const y = g - q.y + Math.sin(t * 3.1) * 7;
  drawGlow(ctx, x, y, 80 + Math.sin(t * 8) * 8, 0.95);
  const flap = Math.sin(t * 40) * 0.5 + 0.5;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath(); ctx.ellipse(x - 4, y - 5, 7, 3 + flap * 3, -0.6, 0, TAU); ctx.ellipse(x + 4, y - 5, 7, 3 + flap * 3, 0.6, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffcf33'; ctx.strokeStyle = '#d99a14'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(x, y, 5, 6.5, 0, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff6b0'; ctx.beginPath(); ctx.arc(x, y + 3, 2.6, 0, TAU); ctx.fill();
}

function drawLetter(ctx, q, camX, g, t, ch) {
  const x = q.x - camX;
  const y = g - q.y + Math.sin(t * 2.6 + q.x * 0.03) * 3;
  drawGlow(ctx, x, y, 52, 0.55);
  ctx.fillStyle = '#fff4d6'; ctx.strokeStyle = '#e59a45'; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.arc(x, y, 14, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#d9772c'; ctx.font = '800 17px ui-rounded, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(ch, x, y + 1);
  ctx.textBaseline = 'alphabetic';
}

// ------------------------------------------------------------------ best-run ghost
function drawGhost(ctx, x, g, t, label, hover) {
  const y = g - (hover ? 24 + Math.sin(t * 2) * 4 : 0);
  ctx.save();
  ctx.globalAlpha = 0.62;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, g); ctx.lineTo(x, y - 74); ctx.stroke();
  // little banner
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath(); ctx.moveTo(x, y - 74); ctx.lineTo(x + 56, y - 70 + Math.sin(t * 4) * 2); ctx.lineTo(x + 50, y - 58); ctx.lineTo(x, y - 54); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#7a6a8a'; ctx.font = '800 10px ui-rounded, system-ui, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(label, x + 5, y - 61);
  // sleepy ghost-Bramble silhouette
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.beginPath(); ctx.ellipse(x, y - 24, 20, 19, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 14, y - 38); ctx.lineTo(x - 18, y - 52); ctx.lineTo(x - 6, y - 42); ctx.moveTo(x + 14, y - 38); ctx.lineTo(x + 17, y - 52); ctx.lineTo(x + 5, y - 42); ctx.fill();
  ctx.strokeStyle = 'rgba(110,100,140,0.8)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x - 10, y - 27); ctx.quadraticCurveTo(x - 6, y - 24, x - 2, y - 27); ctx.moveTo(x + 3, y - 27); ctx.quadraticCurveTo(x + 7, y - 24, x + 11, y - 27); ctx.stroke();
  ctx.restore();
}

export function drawProps(ctx, run, camX, groundY, t, bestLabel) {
  const px = run.p.x;
  const letters = ['C', 'O', 'Z', 'Y'];

  // best-run ghost
  if (run.ghostX > 0 && !run.ghostPassed && run.ghostX - camX < 700) {
    drawGhost(ctx, run.ghostX - camX, groundY, t, bestLabel, !run.groundAt(run.ghostX));
  }

  for (let i = 0; i < run.hazards.length; i++) {
    const h = run.hazards[i];
    if (!h.active) continue;
    const sx = h.x0 - camX;
    if (sx > 700 || h.x1 - camX < -80) continue;
    const ahead = h.x0 - px;
    if (h.type === 'snail') drawSnail(ctx, sx + (h.x1 - h.x0) / 2, groundY, t, h);
    else if (h.type === 'vine') drawVine(ctx, h, camX, groundY, t);
    if (!h.passed && ahead > -40) {
      const a = tellAlpha(ahead);
      if (h.type === 'snail') drawTell(ctx, sx + 19, groundY - 78, 'jump', a, t);
      else if (h.type === 'vine') drawTell(ctx, sx + 22, groundY - 96, 'slide', a, t);
      else drawTell(ctx, (h.x0 + h.x1) / 2 - camX, groundY - 90, h.hint === 'glide' ? 'glide' : 'jump', a, t);
    }
  }

  for (let i = 0; i < run.pickups.length; i++) {
    const q = run.pickups[i];
    if (!q.active) continue;
    const sx = q.x - camX;
    if (sx > 620 || sx < -60) continue;
    switch (q.type) {
      case 'seed': drawSeed(ctx, sx, groundY - q.y, t); break;
      case 'lantern': drawLantern(ctx, q, camX, groundY, t); break;
      case 'tea': drawTea(ctx, q, camX, groundY, t); break;
      case 'firefly': drawFirefly(ctx, q, camX, groundY, t); break;
      case 'letter': drawLetter(ctx, q, camX, groundY, t, letters[q.letter]); break;
      default:
    }
  }
}
