/**
 * hud.js — the in-run overlay, drawn on the canvas in screen pixels (not world units).
 * Kept deliberately quiet: hearts + glow meter top-left, score in the middle, a combo only when
 * it matters. The thumb zone (bottom of the screen) stays completely clear.
 */
import { t } from '../data/strings.js';
import { WORD, COMBO, GLOW } from '../data/balance.js';

const TAU = Math.PI * 2;
const FONT = 'ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif';

function heart(ctx, x, y, s, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.95);
  ctx.bezierCurveTo(x - s * 1.25, y + s * 0.1, x - s * 0.85, y - s * 0.85, x, y - s * 0.3);
  ctx.bezierCurveTo(x + s * 0.85, y - s * 0.85, x + s * 1.25, y + s * 0.1, x, y + s * 0.95);
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = stroke; ctx.stroke();
}

export class Hud {
  constructor() {
    this.banner = null;     // {text, t, max, color}
    this.multPulse = 0;
    this.heartPulse = 0;
    this.lastMult = 1;
    this.lastHearts = 3;
    this.letterPulse = [0, 0, 0, 0];
    this.hintAlpha = 0;
    this.hintKey = '';
  }

  showBanner(text, seconds = 1.6, color = '#fff3c4') { this.banner = { text, t: seconds, max: seconds, color }; }
  pulseMult() { this.multPulse = 1; }
  pulseHeart() { this.heartPulse = 1; }
  pulseLetter(i) { this.letterPulse[i] = 1; }

  update(dt, run) {
    if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }
    this.multPulse = Math.max(0, this.multPulse - dt * 3);
    this.heartPulse = Math.max(0, this.heartPulse - dt * 2.5);
    for (let i = 0; i < 4; i++) this.letterPulse[i] = Math.max(0, this.letterPulse[i] - dt * 2.5);
    const want = run.state === 'running' ? run.hintKey : '';
    if (want) this.hintKey = want;
    this.hintAlpha += ((want ? 1 : 0) - this.hintAlpha) * Math.min(1, dt * 9);
  }

  draw(ctx, run, W, H, safe) {
    if (run.state === 'ready' || run.state === 'over') return;
    const top = safe.top + 10;
    const left = safe.left + 14;

    // ---- hearts
    for (let i = 0; i < run.maxHearts; i++) {
      const x = left + 10 + i * 27;
      const full = i < run.hearts;
      const s = 10 + (full && i === run.hearts - 1 ? this.heartPulse * 3 : 0);
      heart(ctx, x, top + 14, s, full ? '#f48a92' : 'rgba(255,255,255,0.35)', full ? '#b3454f' : 'rgba(140,110,100,0.6)');
    }

    // ---- glow meter (lantern)
    const gy = top + 40;
    ctx.fillStyle = 'rgba(255,248,230,0.55)';
    ctx.strokeStyle = 'rgba(130,90,50,0.55)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(left + 20, gy, 86, 11, 6) : ctx.rect(left + 20, gy, 86, 11);
    ctx.fill(); ctx.stroke();
    const gf = Math.min(1, run.glow / GLOW.max);
    if (gf > 0) {
      ctx.fillStyle = '#ffc94d';
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(left + 21.5, gy + 1.5, Math.max(8, 83 * gf), 8, 4) : ctx.rect(left + 21.5, gy + 1.5, 83 * gf, 8);
      ctx.fill();
    }
    ctx.fillStyle = gf > 0 ? '#ffd36a' : '#d9c3a1'; ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.ellipse(left + 9, gy + 6, 7, 9, 0, 0, TAU); ctx.fill(); ctx.stroke();

    // ---- score + distance (center)
    const cx = W / 2;
    ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    ctx.font = `800 34px ${FONT}`;
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(94,62,42,0.8)';
    ctx.strokeText(String(run.score), cx, top + 34);
    ctx.fillStyle = '#fffaf0'; ctx.fillText(String(run.score), cx, top + 34);
    ctx.font = `700 15px ${FONT}`; ctx.lineWidth = 4;
    const dm = t('hud.m', { m: Math.floor(run.distM) });
    ctx.strokeText(dm, cx, top + 54); ctx.fillStyle = 'rgba(255,250,240,0.95)'; ctx.fillText(dm, cx, top + 54);

    // ---- combo
    if (run.mult >= 2) {
      const pop = 1 + this.multPulse * 0.35;
      ctx.save(); ctx.translate(cx, top + 88); ctx.scale(pop, pop);
      ctx.font = `800 ${22 + run.mult * 2}px ${FONT}`;
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(94,62,42,0.8)';
      ctx.strokeText(`x${run.mult}`, 0, 0);
      ctx.fillStyle = run.mult >= 5 ? '#ffd36a' : '#ffe9a8'; ctx.fillText(`x${run.mult}`, 0, 0);
      ctx.restore();
      const f = Math.max(0, Math.min(1, run.chainT / COMBO.timeout));
      ctx.fillStyle = 'rgba(94,62,42,0.5)'; ctx.fillRect(cx - 30, top + 96, 60, 5);
      ctx.fillStyle = '#ffd36a'; ctx.fillRect(cx - 30, top + 96, 60 * f, 5);
    }

    // ---- C-O-Z-Y letters
    const ly = top + (run.mult >= 2 ? 122 : 84);
    ctx.font = `800 15px ${FONT}`;
    for (let i = 0; i < 4; i++) {
      const got = run.letters[i];
      const lx = cx + (i - 1.5) * 24;
      const sc = 1 + this.letterPulse[i] * 0.5;
      ctx.save(); ctx.translate(lx, ly); ctx.scale(sc, sc);
      ctx.globalAlpha = got ? 1 : (run.lettersGot > 0 ? 0.4 : 0.22);
      ctx.fillStyle = got ? '#fff4d6' : 'rgba(255,250,240,0.7)';
      ctx.strokeStyle = got ? '#e59a45' : 'rgba(120,90,60,0.55)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 10, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = got ? '#d9772c' : 'rgba(110,80,55,0.7)'; ctx.textBaseline = 'middle';
      ctx.fillText(WORD[i], 0, 1);
      ctx.restore();
    }
    ctx.textBaseline = 'alphabetic'; ctx.globalAlpha = 1;

    // ---- hint bubble
    if (this.hintAlpha > 0.02 && this.hintKey) {
      const a = this.hintAlpha;
      const main = t(`hint.${this.hintKey}`);
      const sub = t(`hint.${this.hintKey}.sub`);
      const by = H * 0.36 + (1 - a) * 8;
      ctx.save(); ctx.globalAlpha = a;
      ctx.font = `800 22px ${FONT}`;
      const w = Math.min(W - 36, Math.max(ctx.measureText(main).width, 200) + 44);
      ctx.fillStyle = 'rgba(255,250,238,0.94)'; ctx.strokeStyle = 'rgba(130,90,50,0.45)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(cx - w / 2, by - 30, w, 62, 22) : ctx.rect(cx - w / 2, by - 30, w, 62);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#5c4033'; ctx.fillText(main, cx, by - 3);
      ctx.font = `600 13px ${FONT}`; ctx.fillStyle = 'rgba(92,64,51,0.8)'; ctx.fillText(sub, cx, by + 19);
      ctx.restore();
    }

    // ---- celebration banner
    if (this.banner) {
      const b = this.banner;
      const age = b.max - b.t;
      const pop = age < 0.25 ? 0.5 + (age / 0.25) * 0.65 : age < 0.4 ? 1.15 - (age - 0.25) * 1 : 1;
      const fade = b.t < 0.4 ? b.t / 0.4 : 1;
      ctx.save(); ctx.globalAlpha = fade; ctx.translate(cx, H * 0.24); ctx.scale(pop, pop);
      ctx.font = `800 38px ${FONT}`; ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(94,62,42,0.85)';
      ctx.strokeText(b.text, 0, 0); ctx.fillStyle = b.color; ctx.fillText(b.text, 0, 0);
      ctx.restore();
    }
  }
}
