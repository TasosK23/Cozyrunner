/**
 * hud.js — the in-run overlay, drawn on the canvas in screen pixels (not world units).
 * Kept deliberately quiet: hearts + flame meter top-left, score in the middle, a combo only when
 * it matters. The thumb zone (bottom of the screen) stays completely clear.
 */
import { t } from '../data/strings.js';
import { WORD, COMBO, GLOW } from '../data/balance.js';

const TAU = Math.PI * 2;
const FONT = 'Impact, "Arial Narrow Bold", "Segoe UI", system-ui, sans-serif';
const FONT_TXT = '"Segoe UI", system-ui, -apple-system, Roboto, sans-serif';
const INK = 'rgba(20,6,10,0.9)';

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
    this.scale = 1;         // 'Large text' multiplier
    this.mirror = false;    // 'Left-handed' layout
    this.multPulse = 0;
    this.heartPulse = 0;
    this.lastMult = 1;
    this.lastHearts = 3;
    this.letterPulse = [0, 0, 0, 0];
    this.hintAlpha = 0;
    this.hintKey = '';
  }

  showBanner(text, seconds = 1.6, color = '#ffd9a8') { this.banner = { text, t: seconds, max: seconds, color }; }
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
    const kk = this.scale || 1;
    // left-handed layout: the hearts and flame meter move to the right, the pause button takes the left corner
    const left = this.mirror ? W - safe.right - 14 - Math.max(112, 16 + run.maxHearts * 27) * kk : safe.left + 14;

    const k = this.scale || 1;                          // "Large text" setting: grow each HUD block around its anchor
    const grow = (ox, oy) => { if (k !== 1) { ctx.save(); ctx.translate(ox, oy); ctx.scale(k, k); ctx.translate(-ox, -oy); } };
    const done = () => { if (k !== 1) ctx.restore(); };

    // ---- hearts
    grow(left, top);
    for (let i = 0; i < run.maxHearts; i++) {
      const x = left + 10 + i * 27;
      const full = i < run.hearts;
      const s = 10 + (full && i === run.hearts - 1 ? this.heartPulse * 3 : 0);
      heart(ctx, x, top + 14, s, full ? '#e8343f' : 'rgba(20,10,16,0.55)', full ? '#5a0f18' : 'rgba(255,255,255,0.28)');
    }

    // ---- flame meter (the brazier icon on the left)
    const gy = top + 40;
    ctx.fillStyle = 'rgba(20,10,16,0.6)';
    ctx.strokeStyle = 'rgba(255,170,90,0.55)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(left + 20, gy, 86, 11, 6) : ctx.rect(left + 20, gy, 86, 11);
    ctx.fill(); ctx.stroke();
    const gf = Math.min(1, run.glow / GLOW.max);
    if (gf > 0) {
      const gg = ctx.createLinearGradient(left + 21, 0, left + 104, 0); gg.addColorStop(0, '#ff4a2a'); gg.addColorStop(1, '#ffc24a');
      ctx.fillStyle = gg;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(left + 21.5, gy + 1.5, Math.max(8, 83 * gf), 8, 4) : ctx.rect(left + 21.5, gy + 1.5, 83 * gf, 8);
      ctx.fill();
    }
    // flame icon
    ctx.fillStyle = gf > 0 ? '#ff8a2a' : '#4a4250'; ctx.strokeStyle = gf > 0 ? '#8a2a10' : '#18101a'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(left + 9, gy - 4); ctx.quadraticCurveTo(left + 17, gy + 5, left + 14, gy + 11); ctx.quadraticCurveTo(left + 9, gy + 16, left + 4, gy + 11); ctx.quadraticCurveTo(left + 1, gy + 5, left + 9, gy - 4); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (gf > 0) { ctx.fillStyle = '#ffd36a'; ctx.beginPath(); ctx.ellipse(left + 9, gy + 9, 2.6, 4, 0, 0, TAU); ctx.fill(); }

    done();

    // ---- score + distance (center)
    const cx = W / 2;
    grow(cx, top);
    ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    ctx.font = `900 36px ${FONT}`;
    ctx.lineWidth = 6; ctx.strokeStyle = INK;
    ctx.strokeText(String(run.score), cx, top + 34);
    ctx.fillStyle = '#fff1dc'; ctx.fillText(String(run.score), cx, top + 34);
    ctx.font = `700 15px ${FONT_TXT}`; ctx.lineWidth = 4;
    const dm = t('hud.m', { m: Math.floor(run.distM) });
    ctx.strokeText(dm, cx, top + 54); ctx.fillStyle = 'rgba(255,225,190,0.95)'; ctx.fillText(dm, cx, top + 54);

    // ---- combo
    if (run.mult >= 2) {
      const pop = 1 + this.multPulse * 0.35;
      ctx.save(); ctx.translate(cx, top + 88); ctx.scale(pop, pop);
      ctx.font = `900 ${22 + run.mult * 2}px ${FONT}`;
      ctx.lineWidth = 6; ctx.strokeStyle = INK;
      ctx.strokeText(`x${run.mult}`, 0, 0);
      ctx.fillStyle = run.mult >= 5 ? '#ff7a2a' : '#ffb347'; ctx.fillText(`x${run.mult}`, 0, 0);
      ctx.restore();
      const f = Math.max(0, Math.min(1, run.chainT / COMBO.timeout));
      ctx.fillStyle = 'rgba(20,10,16,0.6)'; ctx.fillRect(cx - 30, top + 96, 60, 5);
      ctx.fillStyle = '#ff9a3a'; ctx.fillRect(cx - 30, top + 96, 60 * f, 5);
    }

    // ---- F-I-R-E letters
    const ly = top + (run.mult >= 2 ? 122 : 84);
    ctx.font = `900 14px ${FONT}`;
    for (let i = 0; i < 4; i++) {
      const got = run.letters[i];
      const lx = cx + (i - 1.5) * 24;
      const sc = 1 + this.letterPulse[i] * 0.5;
      ctx.save(); ctx.translate(lx, ly); ctx.scale(sc, sc);
      ctx.globalAlpha = got ? 1 : (run.lettersGot > 0 ? 0.4 : 0.22);
      ctx.fillStyle = got ? '#3a1a14' : 'rgba(20,10,16,0.6)';
      ctx.strokeStyle = got ? '#ff9a3a' : 'rgba(255,255,255,0.3)'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) { const an = -Math.PI / 2 + k * (TAU / 6); const hx = Math.cos(an) * 11; const hy = Math.sin(an) * 11; if (k === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = got ? '#ffb347' : 'rgba(255,255,255,0.45)'; ctx.textBaseline = 'middle';
      ctx.fillText(WORD[i], 0, 1);
      ctx.restore();
    }
    ctx.textBaseline = 'alphabetic'; ctx.globalAlpha = 1;
    done();

    // ---- hint bubble
    if (this.hintAlpha > 0.02 && this.hintKey) {
      const a = this.hintAlpha;
      const main = t(`hint.${this.hintKey}`);
      const sub = t(`hint.${this.hintKey}.sub`);
      const by = H * 0.36 + (1 - a) * 8;
      ctx.save(); ctx.globalAlpha = a;
      if (k !== 1) { ctx.translate(cx, by); ctx.scale(k, k); ctx.translate(-cx, -by); }
      const Wk = W / k;
      let fs = 22;                                       // shrink long hints so they always fit the bubble
      ctx.font = `900 ${fs}px ${FONT}`;
      const room = Wk - 36 - 44;
      if (ctx.measureText(main).width > room) { fs = Math.max(13, Math.floor((fs * room) / ctx.measureText(main).width)); ctx.font = `900 ${fs}px ${FONT}`; }
      const w = Math.min(Wk - 36, Math.max(ctx.measureText(main).width, 200) + 44);
      ctx.fillStyle = 'rgba(24,14,20,0.9)'; ctx.strokeStyle = 'rgba(255,150,70,0.8)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(cx - w / 2, by - 30, w, 62, 8) : ctx.rect(cx - w / 2, by - 30, w, 62);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffd9a8'; ctx.fillText(main, cx, by - 3);
      ctx.font = `600 13px ${FONT_TXT}`; ctx.fillStyle = 'rgba(255,225,200,0.78)'; ctx.fillText(sub, cx, by + 19);
      ctx.restore();
    }

    // ---- celebration banner
    if (this.banner) {
      const b = this.banner;
      const age = b.max - b.t;
      const pop = age < 0.25 ? 0.5 + (age / 0.25) * 0.65 : age < 0.4 ? 1.15 - (age - 0.25) * 1 : 1;
      const fade = b.t < 0.4 ? b.t / 0.4 : 1;
      ctx.save(); ctx.globalAlpha = fade; ctx.translate(cx, H * 0.24); ctx.scale(pop * k, pop * k);
      ctx.font = `900 40px ${FONT}`; ctx.lineWidth = 8; ctx.strokeStyle = INK;
      ctx.strokeText(b.text, 0, 0); ctx.fillStyle = b.color; ctx.fillText(b.text, 0, 0);
      ctx.restore();
    }
  }
}
