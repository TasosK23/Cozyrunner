/**
 * companions.js — code-drawn art for Cinder's nine companions (dragon-war bestiary). Each is drawn in a
 * ~44x44 box centered on (0,0), facing right. `silhouette` paints it as one flat dark shape (locked
 * companions on the menu). The same function draws the follower in the game and the Companions portraits.
 * Ids are kept stable for saves: bumbly=Ember wisp, dot=Scorch salamander, puff=Gale wyvern, dozy=Basalt,
 * thimble=Fang wolf, lumi=Shade raven, glimmer=Blaze imp, poppy=Grub goblin, pip=Vorath elder drake.
 */
const TAU = Math.PI * 2;
const SIL = '#5a4f66';

function body(ctx, fill, stroke, silhouette) {
  ctx.fillStyle = silhouette ? SIL : fill;
  ctx.strokeStyle = silhouette ? SIL : stroke;
  ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
}
/** A narrow, angry slit eye with a hot colour. */
function eye(ctx, x, y, r, silhouette, col = '#ffb524') {
  if (silhouette) return;
  ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x, y, r * 1.1, r * 0.8, -0.25, 0, TAU); ctx.fill();
  ctx.fillStyle = '#1a0a10'; ctx.beginPath(); ctx.ellipse(x + r * 0.2, y, r * 0.28, r * 0.7, 0, 0, TAU); ctx.fill();
}
function brow(ctx, x, y, w, silhouette) {
  if (silhouette) return;
  ctx.strokeStyle = '#1a0a10'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(x - w, y - 2); ctx.lineTo(x + w, y + 1.5); ctx.stroke();
}
function glow(ctx, x, y, r, a, silhouette) {
  if (silhouette) return;
  const g = ctx.createRadialGradient(x, y, 1, x, y, r);
  g.addColorStop(0, `rgba(255,150,60,${a})`); g.addColorStop(1, 'rgba(255,90,30,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}

export function drawCompanion(ctx, id, x, y, t, scale = 1, silhouette = false) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(scale, scale);
  const bob = Math.sin(t * 4) * 1.5;
  switch (id) {
    case 'bumbly': {                       // Ember — a living flame wisp with a skull-ish face
      ctx.translate(0, bob);
      glow(ctx, 0, 0, 30, 0.7, silhouette);
      const f = Math.sin(t * 12) * 2;
      body(ctx, '#ff6a2a', '#a8350f', silhouette);
      ctx.beginPath(); ctx.moveTo(-12, 10); ctx.quadraticCurveTo(-18, -4, -6, -14 + f); ctx.quadraticCurveTo(-4, -6, 0, -8); ctx.quadraticCurveTo(2, -16, 8, -20 - f); ctx.quadraticCurveTo(8, -8, 14, 0); ctx.quadraticCurveTo(16, 12, 0, 15); ctx.quadraticCurveTo(-8, 15, -12, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
      body(ctx, '#ffc24a', '#a8350f', silhouette);
      ctx.beginPath(); ctx.moveTo(-6, 11); ctx.quadraticCurveTo(-9, 2, -1, -4); ctx.quadraticCurveTo(0, 2, 5, -1); ctx.quadraticCurveTo(10, 8, 0, 13); ctx.closePath(); ctx.fill();
      eye(ctx, -1, 4, 2.2, silhouette, '#2a0a10'); eye(ctx, 7, 4, 2.2, silhouette, '#2a0a10'); brow(ctx, 3, 0, 7, silhouette);
      break;
    }
    case 'dot': {                          // Scorch — a lava salamander
      ctx.translate(0, bob * 0.6);
      body(ctx, '#3f2e38', '#150a10', silhouette);
      ctx.beginPath(); ctx.moveTo(-20, 8); ctx.quadraticCurveTo(-26, 2, -22, -4); ctx.quadraticCurveTo(-14, 4, -10, 2); ctx.quadraticCurveTo(0, -9, 10, -3); ctx.quadraticCurveTo(20, -6, 22, 2); ctx.lineTo(18, 8); ctx.quadraticCurveTo(0, 14, -20, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-4, 10); ctx.lineTo(-7, 17); ctx.moveTo(10, 9); ctx.lineTo(13, 16); ctx.stroke();
      if (!silhouette) {
        ctx.strokeStyle = '#ff8a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-8, 1); ctx.lineTo(-2, -3); ctx.lineTo(4, 0); ctx.lineTo(10, -3); ctx.stroke();
        ctx.fillStyle = '#ff8a3a'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-4 + i * 8, -6); ctx.lineTo(-1 + i * 8, -12); ctx.lineTo(2 + i * 8, -6); ctx.fill(); }
      }
      eye(ctx, 17, -1, 1.9, silhouette); brow(ctx, 17, -4, 3.4, silhouette);
      break;
    }
    case 'puff': {                         // Gale — a storm wyvern hatchling
      ctx.translate(0, bob);
      const fl = Math.sin(t * 9);
      body(ctx, '#5b6b8c', '#1e2740', silhouette);
      ctx.beginPath(); ctx.moveTo(-2, -2); ctx.quadraticCurveTo(-14, -16 - fl * 6, -24, -8 - fl * 8); ctx.quadraticCurveTo(-18, -4, -20, 2); ctx.quadraticCurveTo(-10, 0, -2, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(2, 3, 12, 8, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-10, 6); ctx.quadraticCurveTo(-20, 12, -24, 8); ctx.lineTo(-24, 14); ctx.quadraticCurveTo(-14, 16, -8, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(10, -2); ctx.lineTo(20, -6); ctx.lineTo(22, 0); ctx.lineTo(16, 5); ctx.lineTo(10, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
      body(ctx, '#d6c9a6', '#1e2740', silhouette);
      ctx.beginPath(); ctx.moveTo(12, -3); ctx.lineTo(10, -11); ctx.lineTo(16, -5); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (!silhouette) { ctx.strokeStyle = '#bfe3ff'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(-10, -2); ctx.lineTo(-7, -2); ctx.lineTo(-11, 4); ctx.stroke(); }
      eye(ctx, 15, -1, 1.7, silhouette, '#9fe0ff');
      break;
    }
    case 'dozy': {                         // Basalt — a stone-shelled tortoise-golem
      ctx.translate(0, bob * 0.5);
      body(ctx, '#2f2630', '#120a14', silhouette);
      ctx.beginPath(); ctx.moveTo(-8, 12); ctx.lineTo(-8, 18); ctx.moveTo(10, 12); ctx.lineTo(10, 18); ctx.stroke();
      body(ctx, '#463b4c', '#120a14', silhouette);
      ctx.beginPath(); ctx.moveTo(-20, 12); ctx.quadraticCurveTo(-22, -14, 0, -15); ctx.quadraticCurveTo(22, -14, 20, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
      body(ctx, '#d9cdb0', '#120a14', silhouette);
      for (let i = 0; i < 3; i++) { const sx = -10 + i * 10; ctx.beginPath(); ctx.moveTo(sx - 3.5, -12 + Math.abs(i - 1) * 3); ctx.lineTo(sx, -22 + Math.abs(i - 1) * 3); ctx.lineTo(sx + 3.5, -12 + Math.abs(i - 1) * 3); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      if (!silhouette) { ctx.strokeStyle = '#ff8a3a'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(-6, -12); ctx.lineTo(-2, -4); ctx.lineTo(-8, 4); ctx.moveTo(8, -12); ctx.lineTo(10, -3); ctx.stroke(); }
      body(ctx, '#3a2f3c', '#120a14', silhouette);
      ctx.beginPath(); ctx.ellipse(20, 6, 7, 6, 0, 0, TAU); ctx.fill(); ctx.stroke();
      eye(ctx, 22, 4, 1.8, silhouette); brow(ctx, 22, 1.5, 3.5, silhouette);
      break;
    }
    case 'thimble': {                      // Fang — a dire-wolf pup
      ctx.translate(0, bob * 0.6);
      body(ctx, '#6e6a78', '#1c1822', silhouette);
      ctx.beginPath(); ctx.moveTo(-18, 6); ctx.quadraticCurveTo(-24, -6, -16, -10); ctx.quadraticCurveTo(-10, -2, -6, -4); ctx.quadraticCurveTo(4, -12, 12, -6); ctx.lineTo(20, -2); ctx.lineTo(24, 3); ctx.lineTo(16, 6); ctx.lineTo(14, 12); ctx.lineTo(-12, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-8, 12); ctx.lineTo(-9, 18); ctx.moveTo(10, 12); ctx.lineTo(11, 18); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(8, -7); ctx.lineTo(8, -16); ctx.lineTo(14, -8); ctx.closePath(); ctx.fill(); ctx.stroke();
      body(ctx, '#e9e4ee', '#1c1822', silhouette);
      ctx.beginPath(); ctx.moveTo(16, 3); ctx.lineTo(18, 8); ctx.lineTo(20, 3); ctx.closePath(); ctx.fill();   // fang
      if (!silhouette) { ctx.fillStyle = '#2a2430'; ctx.fillRect(24, 1, 2.5, 2.5); }
      eye(ctx, 13, -2, 1.8, silhouette, '#ff5a3a'); brow(ctx, 13, -5, 3.5, silhouette);
      break;
    }
    case 'lumi': {                         // Shade — a raven with ember eyes
      ctx.translate(0, bob);
      const fl = Math.sin(t * 10);
      body(ctx, '#201a2a', '#0a060e', silhouette);
      ctx.beginPath(); ctx.moveTo(-2, -2); ctx.quadraticCurveTo(-12, -18 - fl * 5, -24, -10 - fl * 6); ctx.quadraticCurveTo(-14, -6, -14, 0); ctx.quadraticCurveTo(-8, 0, -2, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 3, 12, 8, 0.15, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-10, 7); ctx.lineTo(-22, 12); ctx.lineTo(-18, 6); ctx.lineTo(-24, 4); ctx.lineTo(-10, 2); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(11, -4, 6.5, 0, TAU); ctx.fill(); ctx.stroke();
      body(ctx, '#8a8294', '#0a060e', silhouette);
      ctx.beginPath(); ctx.moveTo(16, -6); ctx.lineTo(26, -2); ctx.lineTo(16, -1); ctx.closePath(); ctx.fill(); ctx.stroke();
      eye(ctx, 12, -5, 1.6, silhouette, '#ff5a3a');
      break;
    }
    case 'glimmer': {                      // Blaze — a fire imp
      ctx.translate(0, bob);
      glow(ctx, 0, 0, 28, 0.45, silhouette);
      body(ctx, '#d4442a', '#5a1208', silhouette);
      ctx.beginPath(); ctx.moveTo(-3, -4); ctx.quadraticCurveTo(-18, -16, -22, -6); ctx.quadraticCurveTo(-14, -8, -10, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(3, -4); ctx.quadraticCurveTo(14, -16, 18, -6); ctx.quadraticCurveTo(12, -8, 8, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 6, 9, 10, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -6, 8, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-5, 14); ctx.quadraticCurveTo(-12, 20, -17, 14); ctx.stroke();
      body(ctx, '#efe3c6', '#5a1208', silhouette);
      ctx.beginPath(); ctx.moveTo(-6, -11); ctx.lineTo(-9, -19); ctx.lineTo(-2, -13); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(6, -11); ctx.lineTo(9, -19); ctx.lineTo(2, -13); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (!silhouette) { ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.moveTo(10, 14); ctx.quadraticCurveTo(14, 8, 12, 2); ctx.quadraticCurveTo(18, 8, 16, 14); ctx.fill(); }   // handheld flame
      eye(ctx, -3.5, -6, 1.8, silhouette, '#ffe27a'); eye(ctx, 3.5, -6, 1.8, silhouette, '#ffe27a'); brow(ctx, 0, -9.5, 6, silhouette);
      break;
    }
    case 'poppy': {                        // Grub — a sneaky goblin treasure-hunter
      ctx.translate(0, bob * 0.7);
      body(ctx, '#5f8a3a', '#1c3010', silhouette);
      ctx.beginPath(); ctx.moveTo(-11, -6); ctx.lineTo(-26, -12); ctx.lineTo(-12, -1); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(11, -6); ctx.lineTo(26, -12); ctx.lineTo(12, -1); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 8, 9, 10, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, -5, 12, 9, 0, 0, TAU); ctx.fill(); ctx.stroke();
      body(ctx, '#4a3a2e', '#140c08', silhouette);
      ctx.beginPath(); ctx.moveTo(-12, -9); ctx.quadraticCurveTo(0, -20, 12, -9); ctx.lineTo(10, -6); ctx.quadraticCurveTo(0, -12, -10, -6); ctx.closePath(); ctx.fill(); ctx.stroke();
      body(ctx, '#efe3c6', '#140c08', silhouette);
      ctx.beginPath(); ctx.moveTo(-5, 2); ctx.lineTo(-4, 6); ctx.lineTo(-2, 2); ctx.moveTo(2, 2); ctx.lineTo(3, 6); ctx.lineTo(5, 2); ctx.fill();
      if (!silhouette) { ctx.fillStyle = '#ffc928'; ctx.beginPath(); ctx.arc(14, 14, 4.2, 0, TAU); ctx.fill(); ctx.strokeStyle = '#8a5a08'; ctx.lineWidth = 1.2; ctx.stroke(); }
      eye(ctx, -5, -4, 2, silhouette, '#ffe27a'); eye(ctx, 5, -4, 2, silhouette, '#ffe27a');
      break;
    }
    case 'pip': {                          // Vorath — a young elder drake, the legendary one
      ctx.translate(0, bob);
      glow(ctx, 0, 0, 32, 0.4, silhouette);
      const fl = Math.sin(t * 6);
      body(ctx, '#7a2a3a', '#240a12', silhouette);
      ctx.beginPath(); ctx.moveTo(-4, -4); ctx.quadraticCurveTo(-12, -22 - fl * 3, -26, -14 - fl * 4); ctx.quadraticCurveTo(-20, -8, -22, -2); ctx.quadraticCurveTo(-14, -2, -6, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-14, 6); ctx.quadraticCurveTo(-26, 10, -26, 4); ctx.quadraticCurveTo(-20, 16, -8, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 4, 14, 10, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(8, -2); ctx.lineTo(22, -4); ctx.lineTo(26, 3); ctx.lineTo(14, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
      body(ctx, '#e8c070', '#240a12', silhouette);
      ctx.beginPath(); ctx.moveTo(-3, 12); ctx.quadraticCurveTo(4, 15, 12, 10); ctx.lineTo(10, 7); ctx.quadraticCurveTo(2, 10, -3, 8); ctx.closePath(); ctx.fill();
      body(ctx, '#efe3c6', '#240a12', silhouette);
      ctx.beginPath(); ctx.moveTo(10, -3); ctx.quadraticCurveTo(4, -14, -4, -14); ctx.quadraticCurveTo(4, -8, 8, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(14, -3); ctx.quadraticCurveTo(12, -12, 6, -16); ctx.quadraticCurveTo(14, -10, 17, -3); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (!silhouette) {
        ctx.fillStyle = '#ffb347'; const ph = (t * 1.2) % 1;                        // smoulder from the jaw
        ctx.globalAlpha = 1 - ph; ctx.beginPath(); ctx.arc(27 + ph * 6, 4 - ph * 4, 2.4 + ph * 3, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      }
      eye(ctx, 17, -1, 1.9, silhouette); brow(ctx, 17, -4, 3.6, silhouette);
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
