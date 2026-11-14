/**
 * ui.js — the DOM screens: title, pause, game over. (The in-run HUD is drawn on the canvas.)
 * Text comes from strings.js. The game-over screen counts numbers up and animates the goal bar,
 * because watching numbers climb is half the reward.
 */
import { t } from '../data/strings.js';

const $ = (sel) => document.querySelector(sel);

function easeOut(u) { return 1 - Math.pow(1 - u, 3); }

export class UI {
  /** @param h handlers {play, again, home, resume, restart, pause, skipTips, daily, open(panel), chest} */
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
    click('#btn-daily', () => h.daily());
    click('#btn-chest', () => h.chest());
    click('#break-ok', () => $('#break-note').classList.add('hidden'));
    for (const el of document.querySelectorAll('[data-open]')) {
      el.addEventListener('click', (e) => { e.preventDefault(); h.open(el.dataset.open); });
    }

    // keyboard shortcuts on menu screens
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const ok = e.code === 'Space' || e.code === 'Enter';
      if (!ok || this.menuOpen()) return;            // a sheet is open: Space/Enter belong to its focused button
      if (!this.screens.title.classList.contains('hidden')) { e.preventDefault(); h.play(); }
      else if (!this.screens.over.classList.contains('hidden')) { e.preventDefault(); if (performance.now() >= this.overReadyAt) h.again(); }
      else if (!this.screens.pause.classList.contains('hidden')) { e.preventDefault(); h.resume(); }
    });
  }

  _only(name) {
    for (const k of Object.keys(this.screens)) this.screens[k].classList.toggle('hidden', k !== name);
  }

  hideAll() { this._only(''); }

  /** @param info {seeds, dailyDone, streak, dots:{companions,upgrades,quests}, hideMeta} */
  showTitle(bestMeters, info = {}) {
    this._only('title');
    $('#title-best').textContent = bestMeters > 0 ? t('title.best', { m: bestMeters }) : t('title.first');
    this.setRunning(false, false);
    this.refreshTitle(info);
  }

  refreshTitle(info = {}) {
    const meta = !info.hideMeta;
    $('#btn-daily').classList.toggle('hidden', !meta);
    document.querySelector('.tiles').classList.toggle('hidden', !meta);
    $('#title-seeds').classList.toggle('hidden', !meta);
    if (!meta) return;
    $('#title-seeds').textContent = `${(info.seeds || 0).toLocaleString('en-US')} embers`;
    $('#daily-label').textContent = info.dailyDone ? 'Daily Run again' : 'Daily Run';
    const b = $('#daily-badge');
    b.classList.toggle('hidden', !(info.streak > 0));
    b.textContent = `${info.streak || 0} day${info.streak === 1 ? '' : 's'}`;
    const dots = info.dots || {};
    for (const k of ['companions', 'upgrades', 'quests', 'wardrobe', 'settings']) $(`#dot-${k}`).classList.toggle('hidden', !dots[k]);
  }

  /** After the egg sheet closes on the game-over card: update the button. */
  refreshOverChests(n) {
    const cb = $('#btn-chest');
    cb.classList.toggle('hidden', !(n > 0));
    cb.textContent = `Hatch Dragon Egg (${n})`;
  }

  /** Is any menu sheet showing? */
  menuOpen() { return !$('#screen-menu').classList.contains('hidden'); }

  showBreak() { $('#break-note').classList.remove('hidden'); }

  /** Show/hide the in-run buttons. */
  setRunning(on, tips) {
    this.btnPause.classList.toggle('hidden', !on);
    this.btnSkip.classList.toggle('hidden', !(on && tips));
  }

  setTips(on) { this.btnSkip.classList.toggle('hidden', !on); }

  showPause() { this._only('pause'); }
  hidePause() { this._only(''); }

  _extras(s) {
    const x = $('#o-extra');
    const parts = [];
    const esc = (v) => String(v).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    if (s.daily) {
      const d = s.daily;
      parts.push(`<div class="xrow gold">Daily Run: streak ${d.streak} day${d.streak === 1 ? '' : 's'}${d.usedFreeze ? ' (a freeze saved it)' : ''}${d.bonusSeeds ? ` · +${d.bonusSeeds} embers` : ''}${d.chest ? ' · dragon egg!' : ''}</div>`);
    }
    for (const q of s.quests || []) parts.push(`<div class="xrow">Quest done: ${esc(q.text)} · +${q.reward} embers</div>`);
    if (s.weekly) parts.push(`<div class="xrow gold">Weekly challenge done: ${esc(s.weekly.text)} · +${s.weekly.reward} embers + egg</div>`);
    for (const a of s.trophies || []) parts.push(`<div class="xrow gold">Trophy earned: ${esc(a.name)} · +${a.embers} embers</div>`);
    for (const c of s.looks || []) parts.push(`<div class="xrow gold">New look for Cinder: ${esc(c.name)} (${esc(c.slotName)}). Find it in the Wardrobe.</div>`);
    for (const c of s.unlocked || []) parts.push(`<div class="xrow gold">${esc(c.name)} (${esc(c.kind)}) answers Cinder's call! Find it under Beasts.</div>`);
    for (const m of s.biomes || []) parts.push(`<div class="xrow">New land reached: ${esc(m)}</div>`);
    if (s.next) {
      const pct = Math.round(s.next.pr.pct * 100);
      parts.push(`<div class="xnext">${pct}% to a new war-beast: ${esc(s.next.comp.unlock.text.replace('{n}', s.next.comp.unlock.target))}<div class="mini"><i style="width:${pct}%"></i></div></div>`);
    }
    x.innerHTML = parts.join('');
    const cb = $('#btn-chest');
    cb.classList.toggle('hidden', !(s.chests > 0));
    cb.textContent = `Hatch Dragon Egg (${s.chests || 0})`;
  }

  /**
   * @param s {title, distM, score, seeds, newBest, prevBestM, levelBefore, levelAfter, persistent,
   *           quests, weekly, daily, unlocked, biomes, next, chests}
   */
  showOver(s) {
    this._only('over');
    this.overReadyAt = performance.now() + 250;     // ignore the frantic taps right after a tumble
    cancelAnimationFrame(this.anim);

    $('#over-title').textContent = s.title;
    $('#over-newbest').classList.toggle('hidden', !s.newBest);
    $('#o-warn').classList.toggle('hidden', s.persistent);
    this._extras(s);
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
