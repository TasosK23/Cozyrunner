/**
 * juice.js — "game feel". Turns simulation events (from Run.emit) into particles, springs,
 * popups, banners and vibration. The simulation never calls rendering code directly; it just
 * announces what happened and this file decides how it should feel.
 * (Stage 2 will hang the sounds, screen shake, slow-mo and hit-stop here too.)
 */
import { K } from '../render/fx.js';
import { haptics } from '../core/haptics.js';
import { t } from '../data/strings.js';

const SEED_COLORS = ['#fff2ad', '#ffe27a', '#ffffff'];
const CONFETTI = ['#ff9fb3', '#ffd36a', '#9fe08a', '#9fd8f0', '#d6b3ff', '#ffffff'];

export function createJuice({ run, fx, vis, hud }) {
  return function onEvent(name, a, b) {
    const p = run.p;
    switch (name) {
      case 'jump':
        vis.kick('jump');
        for (let i = 0; i < 4; i++) fx.spawn(K.PUFF, p.x - 8 + i * 5, 3, -40 + Math.random() * 30, 20 + Math.random() * 20, 0.35, 5, '#fff7df', 0, 0, 3);
        break;
      case 'glide':
        vis.kick('glide');
        for (let i = 0; i < 6; i++) fx.spawn(K.LEAF, p.x + (Math.random() - 0.5) * 20, p.y + 40, (Math.random() - 0.5) * 70, 30 + Math.random() * 40, 0.7, 4, '#a9db6f', -60, 5);
        break;
      case 'land':
        vis.kick('land', a);
        if (a > 200) for (let i = 0; i < 6; i++) {
          const dir = i % 2 ? 1 : -1;
          fx.spawn(K.PUFF, p.x + dir * 6, 3, dir * (30 + Math.random() * 60), 10 + Math.random() * 22, 0.4, 4 + Math.random() * 3, '#fff3d6', 0, 0, 3);
        }
        break;
      case 'slide':
        for (let i = 0; i < 3; i++) fx.spawn(K.PUFF, p.x - 18 - i * 8, 4, -50 - Math.random() * 40, 8 + Math.random() * 14, 0.4, 4, '#fff3d6', 0, 0, 3);
        break;
      case 'fastfall': break;
      case 'seed':
        vis.kick('collect');
        fx.burst(K.SPARK, a.x, a.y, 4, 70, 0.4, 5, SEED_COLORS);
        break;
      case 'heart':
        hud.pulseHeart(); vis.kick('collect');
        fx.popup(t('popup.heart'), p.x + 10, p.y + 66, '#ffb3bf', 24);
        fx.burst(K.STAR, p.x, p.y + 28, 10, 110, 0.7, 6, ['#ffb3bf', '#fff'], -30);
        haptics.pulse(12);
        break;
      case 'teabonus':
        fx.popup('+5', p.x + 10, p.y + 66, '#d8ffc0', 20);
        break;
      case 'lantern':
        fx.popup(t('popup.glow'), a.x, a.y + 28, '#ffe08a', 24);
        fx.burst(K.SPARK, a.x, a.y, 14, 140, 0.8, 7, ['#ffd36a', '#fff3b0', '#ffffff']);
        fx.spawn(K.RING, a.x, a.y, 0, 0, 0.5, 26, '#ffe08a');
        vis.kick('collect');
        break;
      case 'firefly':
        fx.popup(t('popup.firefly'), a.x, a.y + 30, '#fff08a', 26);
        fx.burst(K.STAR, a.x, a.y, 26, 210, 1.1, 9, ['#ffe27a', '#fff', '#ffd36a', '#ffb347']);
        fx.spawn(K.RING, a.x, a.y, 0, 0, 0.7, 34, '#ffe08a');
        haptics.pulse([10, 30, 16]);
        break;
      case 'letter':
        hud.pulseLetter(a.letter);
        fx.burst(K.SPARK, a.x, a.y, 10, 110, 0.6, 6, ['#ffcf8a', '#fff4d6', '#ffffff']);
        vis.kick('collect');
        break;
      case 'word':
        hud.showBanner(t('popup.word'), 1.6, '#ffd8a0');
        fx.burst(K.CONFETTI, p.x, p.y + 40, 40, 260, 1.4, 4, CONFETTI, 260);
        haptics.pulse([10, 40, 10, 40, 16]);
        break;
      case 'multup':
        hud.pulseMult();
        break;
      case 'nearmiss':
        fx.popup(t(a === 'gap' ? 'popup.phew' : 'popup.close'), p.x + 30, p.y + 76, '#bfe9ff', 22);
        fx.burst(K.SPARK, p.x + 10, p.y + 24, 6, 110, 0.4, 5, ['#bfe9ff', '#ffffff']);
        break;
      case 'hit':
        vis.kick('hit');
        fx.burst(K.STAR, p.x, p.y + 30, 10, 130, 0.6, 6, ['#ffe27a', '#fff3b0']);
        haptics.pulse(40);
        break;
      case 'fall':
        fx.burst(K.PUFF, p.x, 0, 8, 80, 0.6, 9, ['#ffffff', '#e8f2fb']);
        haptics.pulse(30);
        break;
      case 'bubblepop':
        fx.burst(K.DOT, p.x, p.y + 28, 14, 120, 0.5, 4, ['#ffffff', '#d6efff']);
        break;
      case 'newbest':
        hud.showBanner(t('popup.newbest'), 2.0, '#ffe58a');
        fx.burst(K.CONFETTI, p.x + 30, p.y + 60, 56, 320, 1.8, 4, CONFETTI, 280);
        fx.burst(K.STAR, p.x + 30, p.y + 60, 14, 200, 1.0, 8, ['#ffe27a', '#ffffff']);
        haptics.pulse([14, 40, 14, 40, 22]);
        break;
      case 'dying':
        for (let i = 0; i < 3; i++) fx.spawn(K.ZZZ, p.x + 14 + i * 12, 54 + i * 18, 14, 22, 1.6 + i * 0.2, 14 + i * 3, '#ffffff', 0, 0);
        fx.burst(K.PUFF, p.x, 12, 10, 90, 0.8, 9, ['#fff7df', '#ffffff']);
        haptics.pulse([30, 40, 50]);
        break;
      default:
    }
  };
}
