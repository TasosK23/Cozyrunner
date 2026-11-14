/**
 * companions.js — code-drawn art for Bramble's nine companions. Each is drawn in a ~44x44 box centered
 * on (0,0), facing right. `silhouette` paints it as one flat dark shape (locked companions on the menu).
 * The same function draws the little follower in the game and the portraits on the Companions screen.
 */
const TAU = Math.PI * 2;

function body(ctx, fill, stroke, silhouette) {
  ctx.fillStyle = silhouette ? '#6f6580' : fill;
  ctx.strokeStyle = silhouette ? '#6f6580' : stroke;
  ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
}
function eye(ctx, x, y, r, silhouette) {
  if (silhouette) return;
  ctx.fillStyle = '#3b2f3a'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + r * 0.35, y - r * 0.35, r * 0.35, 0, TAU); ctx.fill();
}
function blush(ctx, x, y, silhouette) {
  if (silhouette) return;
  ctx.fillStyle = 'rgba(255,150,160,0.55)'; ctx.beginPath(); ctx.ellipse(x, y, 3.4, 2.2, 0, 0, TAU); ctx.fill();
}

export function drawCompanion(ctx, id, x, y, t, scale = 1, silhouette = false) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(scale, scale);
  const bob = Math.sin(t * 4) * 1.5;
  switch (id) {
    case 'bumbly': {                       // bumblebee
      ctx.translate(0, bob);
      const fl = Math.sin(t * 38) * 0.4 + 0.6;
      ctx.fillStyle = silhouette ? '#6f6580' : 'rgba(220,240,255,0.85)'; ctx.strokeStyle = silhouette ? '#6f6580' : 'rgba(120,150,190,0.8)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.ellipse(-4, -12, 7, 4 + fl * 4, -0.5, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(5, -12, 7, 4 + fl * 4, 0.5, 0, TAU); ctx.fill(); ctx.stroke();
      body(ctx, '#ffd23f', '#7a5a14', silhouette);
      ctx.beginPath(); ctx.ellipse(0, 0, 15, 11, 0, 0, TAU); ctx.fill(); ctx.stroke();
      if (!silhouette) { ctx.fillStyle = '#3b2f3a'; ctx.fillRect(-4, -10, 4.5, 20); ctx.fillRect(5, -9, 4, 18); }
      eye(ctx, 9, -2, 2.4, silhouette); blush(ctx, 8, 4, silhouette);
      break;
    }
    case 'dot': {                          // ladybug
      ctx.translate(0, bob * 0.6);
      body(ctx, '#ef5b5b', '#8a2a2a', silhouette);
      ctx.beginPath(); ctx.arc(0, 0, 14, Math.PI, 0); ctx.lineTo(14, 4); ctx.quadraticCurveTo(0, 12, -14, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (!silhouette) {
        ctx.fillStyle = '#3b2f3a';
        ctx.beginPath(); ctx.arc(-5, -6, 2.6, 0, TAU); ctx.arc(4, -8, 2.4, 0, TAU); ctx.arc(7, -1, 2.2, 0, TAU); ctx.arc(-8, 0, 2.2, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(12, 2, 6, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#3b2f3a'; ctx.beginPath(); ctx.moveTo(14, -2); ctx.lineTo(18, -9); ctx.stroke();
      }
      eye(ctx, 13, 1, 1.6, silhouette);
      break;
    }
    case 'puff': {                         // tiny cloud
      ctx.translate(0, bob);
      body(ctx, '#ffffff', '#9fb8d6', silhouette);
      ctx.beginPath(); ctx.arc(-10, 4, 8, 0, TAU); ctx.arc(-1, -4, 12, 0, TAU); ctx.arc(11, 3, 9, 0, TAU); ctx.rect(-10, 4, 21, 8); ctx.fill();
      eye(ctx, -3, 2, 1.8, silhouette); eye(ctx, 6, 2, 1.8, silhouette); blush(ctx, -8, 7, silhouette); blush(ctx, 11, 7, silhouette);
      break;
    }
    case 'dozy': {                         // snail buddy
      body(ctx, '#f7e6c8', '#b79b74', silhouette);
      ctx.beginPath(); ctx.moveTo(-18, 10); ctx.quadraticCurveTo(-20, -2, -10, -4); ctx.lineTo(14, 2); ctx.quadraticCurveTo(20, 6, 16, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
      body(ctx, '#f4b3a3', '#c4786b', silhouette);
      ctx.beginPath(); ctx.arc(2, -4, 11, 0, TAU); ctx.fill(); ctx.stroke();
      if (!silhouette) { ctx.strokeStyle = '#e58f86'; ctx.beginPath(); for (let a = 0; a < 7; a += 0.4) { const r = 1 + a * 1.4; const px = 2 + Math.cos(a) * r; const py = -4 + Math.sin(a) * r; if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); } ctx.stroke(); }
      body(ctx, '#f7e6c8', '#b79b74', silhouette);
      ctx.beginPath(); ctx.moveTo(-14, -3); ctx.lineTo(-17, -13); ctx.stroke();
      ctx.beginPath(); ctx.arc(-17, -14, 3, 0, TAU); ctx.fill(); ctx.stroke();
      if (!silhouette) { ctx.strokeStyle = '#3b2f3a'; ctx.beginPath(); ctx.moveTo(-19, -14); ctx.lineTo(-15, -14); ctx.stroke(); }
      break;
    }
    case 'thimble': {                      // hedgehog
      ctx.translate(0, bob * 0.5);
      body(ctx, '#8a6a52', '#4f3a2b', silhouette);
      ctx.beginPath();
      for (let i = 0; i <= 10; i++) { const a = Math.PI + (i / 10) * Math.PI; const r = i % 2 ? 19 : 14; ctx.lineTo(Math.cos(a) * r - 2, Math.sin(a) * r + 8); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      body(ctx, '#f3d9bd', '#9a7a5a', silhouette);
      ctx.beginPath(); ctx.ellipse(8, 5, 11, 9, 0, 0, TAU); ctx.fill(); ctx.stroke();
      eye(ctx, 11, 3, 2, silhouette);
      if (!silhouette) { ctx.fillStyle = '#3b2f3a'; ctx.beginPath(); ctx.arc(18, 6, 2, 0, TAU); ctx.fill(); }
      blush(ctx, 9, 9, silhouette);
      break;
    }
    case 'lumi': {                         // moth
      ctx.translate(0, bob);
      const fl = Math.sin(t * 14) * 0.25 + 0.75;
      ctx.save(); ctx.scale(1, fl);
      body(ctx, '#f1e6ff', '#9a84c8', silhouette);
      ctx.beginPath(); ctx.ellipse(-8, -6, 14, 9, -0.5, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(-4, 4, 11, 7, 0.4, 0, TAU); ctx.fill(); ctx.stroke();
      if (!silhouette) { ctx.fillStyle = 'rgba(255,214,122,0.8)'; ctx.beginPath(); ctx.arc(-12, -7, 3, 0, TAU); ctx.arc(-6, 3, 2.4, 0, TAU); ctx.fill(); }
      ctx.restore();
      body(ctx, '#c8b4e8', '#7a64a8', silhouette);
      ctx.beginPath(); ctx.ellipse(2, 0, 8, 5.5, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(10, -2, 4.5, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(11, -6); ctx.quadraticCurveTo(15, -14, 18, -12); ctx.stroke();
      eye(ctx, 11.5, -2.5, 1.6, silhouette);
      break;
    }
    case 'glimmer': {                      // firefly
      ctx.translate(0, bob * 1.3);
      const fl = Math.sin(t * 30) * 0.4 + 0.6;
      ctx.fillStyle = silhouette ? '#6f6580' : 'rgba(255,255,255,0.8)';
      ctx.beginPath(); ctx.ellipse(-3, -10, 9, 3 + fl * 4, -0.5, 0, TAU); ctx.ellipse(6, -10, 9, 3 + fl * 4, 0.5, 0, TAU); ctx.fill();
      if (!silhouette) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const gr = ctx.createRadialGradient(-6, 6, 1, -6, 6, 24);
        gr.addColorStop(0, 'rgba(255,235,120,0.9)'); gr.addColorStop(1, 'rgba(255,235,120,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(-6, 6, 24, 0, TAU); ctx.fill(); ctx.restore();
      }
      body(ctx, '#7a5a3a', '#3b2f3a', silhouette);
      ctx.beginPath(); ctx.ellipse(2, 0, 11, 8, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = silhouette ? '#6f6580' : '#ffe27a'; ctx.beginPath(); ctx.ellipse(-6, 2, 6, 6, 0, 0, TAU); ctx.fill();
      eye(ctx, 9, -2, 2, silhouette);
      break;
    }
    case 'poppy': {                        // acorn mouse
      ctx.translate(0, bob * 0.5);
      body(ctx, '#d9a066', '#7a4f26', silhouette);
      ctx.beginPath(); ctx.ellipse(0, 4, 12, 13, 0, 0, TAU); ctx.fill(); ctx.stroke();
      body(ctx, '#9a6a3a', '#5a3a1a', silhouette);
      ctx.beginPath(); ctx.ellipse(0, -6, 14, 8, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(0, -19); ctx.stroke();
      body(ctx, '#f3d9bd', '#9a7a5a', silhouette);
      ctx.beginPath(); ctx.arc(-9, -6, 5, 0, TAU); ctx.arc(9, -6, 5, 0, TAU); ctx.fill(); ctx.stroke();
      eye(ctx, -4, 3, 2, silhouette); eye(ctx, 5, 3, 2, silhouette); blush(ctx, -8, 8, silhouette); blush(ctx, 9, 8, silhouette);
      if (!silhouette) { ctx.strokeStyle = '#d9a066'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-10, 15); ctx.quadraticCurveTo(-22, 16, -22, 6); ctx.stroke(); }
      break;
    }
    case 'pip': {                          // kettle dragon
      ctx.translate(0, bob);
      body(ctx, '#ff9a6a', '#a8482a', silhouette);
      ctx.beginPath(); ctx.ellipse(0, 3, 15, 13, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(14, 2); ctx.quadraticCurveTo(22, -2, 21, -9); ctx.stroke();
      ctx.beginPath(); ctx.arc(-15, 0, 6, 1.4, 4.9); ctx.stroke();
      body(ctx, '#ffd36a', '#a8482a', silhouette);
      ctx.beginPath(); ctx.moveTo(-8, -9); ctx.lineTo(-4, -17); ctx.lineTo(0, -9); ctx.lineTo(4, -17); ctx.lineTo(8, -9); ctx.closePath(); ctx.fill(); ctx.stroke();
      body(ctx, '#ffffff', '#a8482a', silhouette);
      ctx.beginPath(); ctx.ellipse(0, 12, 8, 4, 0, 0, TAU); ctx.fill();
      eye(ctx, -2, 0, 2.2, silhouette); eye(ctx, 8, 0, 2.2, silhouette); blush(ctx, -6, 6, silhouette);
      if (!silhouette) {                    // steam
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        const ph = (t * 0.8) % 1; ctx.globalAlpha = 1 - ph; ctx.beginPath(); ctx.arc(21, -12 - ph * 12, 3 + ph * 3, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      }
      break;
    }
    default:
  }
  ctx.restore();
}

/** Paint a companion portrait onto a small <canvas> element (used by the Companions screen). */
export function paintPortrait(canvas, id, silhouette, t = 0.6) {
  const c = canvas.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth || 64; const h = canvas.clientHeight || 64;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, h);
  drawCompanion(c, id, w / 2, h / 2 + 2, t, Math.min(w, h) / 48, silhouette);
}
