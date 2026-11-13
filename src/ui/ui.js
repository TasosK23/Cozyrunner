/**
 * ui.js — the DOM screens: title, pause, game over. (The in-run HUD is drawn on the canvas.)
 * Text comes from strings.js. The game-over screen counts numbers up and animates the goal bar,
 * because watching numbers climb is half the reward.
 */
import { t } from '../data/strings.js';

const $ = (sel) => document.querySelector(sel);

function easeOut(u) { return 1 - Math.pow(1 - u, 3); }

export class UI {
  /** @param h handlers {play, again, home, resume, restart, pause, skipTips} */
  constructor(h) {
    this.h = h;
    this.screens = { title: $('#screen-title'), pause: $('#screen-pause'), over: $('#screen-over') };
    this.btnPause = $('#btn-pause');
    this.btnSkip = $('#btn-skip');
    this.overReadyAt = 0;
    this.anim = 0;

    for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
    for (const el of document.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));

    const click = (sel, fn) => $(sel).addEventListener('click', (e) => { e.preventDefault(); fn(); });
    click('#btn-play', () => h.play());
    click('#btn-again', () => { if (performance.now() >= this.overReadyAt) h.again(); });
    click('#btn-home', () => h.home());
    click('#btn-resume', () => h.resume());
    click('#btn-restart', () => h.restart());
    click('#btn-pause-home', () => h.home());
    click('#btn-pause', () => h.pause());
    click('#btn-skip', () => h.skipTips());

    // keyboard shortcuts on menu screens
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const ok = e.code === 'Space' || e.code === 'Enter';
      if (!ok) return;
      if (!this.screens.title.classList.contains('hidden')) { e.preventDefault(); h.play(); }
      else if (!this.screens.over.classList.contains('hidden')) { e.preventDefault(); if (performance.now() >= this.overReadyAt) h.again(); }
      else if (!this.screens.pause.classList.contains('hidden')) { e.preventDefault(); h.resume(); }
    });
  }

  _only(name) {
    for (const k of Object.keys(this.screens)) this.screens[k].classList.toggle('hidden', k !== name);
  }

  hideAll() { this._only(''); }

  showTitle(bestMeters) {
    this._only('title');
    $('#title-best').textContent = bestMeters > 0 ? t('title.best', { m: bestMeters }) : t('title.first');
    this.setRunning(false, false);
  }

  /** Show/hide the in-run buttons. */
  setRunning(on, tips) {
    this.btnPause.classList.toggle('hidden', !on);
    this.btnSkip.classList.toggle('hidden', !(on && tips));
  }

  setTips(on) { this.btnSkip.classList.toggle('hidden', !on); }

  showPause() { this._only('pause'); }
  hidePause() { this._only(''); }

  /**
   * @param s {title, distM, score, seeds, newBest, prevBestM, levelBefore, levelAfter, persistent}
   */
  showOver(s) {
    this._only('over');
    this.overReadyAt = performance.now() + 250;     // ignore the frantic taps right after a tumble
    cancelAnimationFrame(this.anim);

    $('#over-title').textContent = s.title;
    $('#over-newbest').classList.toggle('hidden', !s.newBest);
    $('#o-warn').classList.toggle('hidden', s.persistent);
    $('#o-warn').textContent = t('over.storage');
    const cmp = $('#o-compare');
    if (s.prevBestM <= 0) cmp.textContent = t('over.compare.first');
    else if (s.newBest) cmp.textContent = t('over.compare.ahead', { m: s.distM - s.prevBestM });
    else cmp.textContent = t('over.compare.behind', { m: s.prevBestM - s.distM });

    const fill = $('#o-fill');
    const goal = $('#o-goal');
    fill.classList.remove('animate');
    fill.style.width = `${Math.round(s.levelBefore.pct * 100)}%`;
    goal.textContent = t('over.goal', { pct: Math.round(s.levelBefore.pct * 100), level: s.levelBefore.level + 1 });

    // count-up for the three numbers
    const els = [[$('#o-dist'), s.distM, (v) => `${v} m`], [$('#o-score'), s.score, (v) => String(v)], [$('#o-seeds'), s.seeds, (v) => String(v)]];
    const t0 = performance.now();
    const dur = 900;
    const tick = (now) => {
      const u = Math.min(1, (now - t0) / dur);
      for (const [el, to, fmt] of els) el.textContent = fmt(Math.round(to * easeOut(u)));
      if (u < 1) this.anim = requestAnimationFrame(tick);
    };
    this.anim = requestAnimationFrame(tick);

    // goal bar: fill up, roll over if we levelled up, then settle
    setTimeout(() => {
      fill.classList.add('animate');
      if (s.levelAfter.level > s.levelBefore.level) {
        fill.style.width = '100%';
        setTimeout(() => {
          goal.textContent = t('over.levelup', { level: s.levelAfter.level });
          fill.classList.remove('animate');
          fill.style.width = '0%';
          requestAnimationFrame(() => requestAnimationFrame(() => {
            fill.classList.add('animate');
            fill.style.width = `${Math.round(s.levelAfter.pct * 100)}%`;
            setTimeout(() => { goal.textContent = t('over.goal', { pct: Math.round(s.levelAfter.pct * 100), level: s.levelAfter.level + 1 }); }, 1000);
          }));
        }, 950);
      } else {
        fill.style.width = `${Math.round(s.levelAfter.pct * 100)}%`;
        goal.textContent = t('over.goal', { pct: Math.round(s.levelAfter.pct * 100), level: s.levelAfter.level + 1 });
      }
    }, 350);
  }
}
