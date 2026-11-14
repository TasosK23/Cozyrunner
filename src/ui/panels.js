/**
 * panels.js — the menu sheets that open over the title screen: Companions, Upgrades, Quests & Daily,
 * Settings, and the Mystery Acorn reveal. Each panel is a function that returns HTML for the sheet; clicks are
 * handled with one delegated listener. All numbers come from the save and the data files, nothing is hard-wired here.
 */
import { COMPANIONS, RARITIES } from '../data/companions.js';
import { UPGRADES, upgradeValue } from '../data/upgrades.js';
import { companionProgress } from '../game/loadout.js';
import { ensureQuests, describeQuest, describeWeekly, rerollQuest } from '../game/quests.js';
import { dailyStatus } from '../game/daily.js';
import { openChest } from '../game/chests.js';
import { levelInfo } from '../game/progress.js';
import { paintPortrait } from '../render/companions.js';
import { clock } from '../core/clock.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const ICON = {
  seed: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c4 5 6 8 0 17-6-9-4-12 0-17z" fill="#ffd24a" stroke="#c98a10" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  check: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#4f9f4a" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

export class Panels {
  /**
   * @param c {saveStore, audio, haptics, onChange(kind), onClose()}
   *   onChange is called after anything that should refresh the loadout (equip, buy) so the next run uses it.
   */
  constructor(c) {
    this.c = c;
    this.root = $('#screen-menu');
    this.body = $('#menu-body');
    this.titleEl = $('#menu-title');
    this.panel = '';
    this.chestState = null;
    $('#menu-back').addEventListener('click', (e) => { e.preventDefault(); this.close(); });
    this.body.addEventListener('click', (e) => this._click(e));
    this.body.addEventListener('input', (e) => this._input(e));
    window.addEventListener('keydown', (e) => { if (e.code === 'Escape' && this.isOpen()) this.close(); });
  }

  get data() { return this.c.saveStore.data; }
  isOpen() { return !this.root.classList.contains('hidden'); }

  open(name) {
    this.panel = name;
    this.root.classList.remove('hidden');
    this.render();
    this.c.audio.sfx('ui');
  }

  close() {
    this.root.classList.add('hidden');
    this.panel = '';
    this.c.saveStore.commit();
    this.c.audio.sfx('back');
    this.c.onClose();
  }

  render() {
    const d = this.data;
    const now = clock.now();
    ensureQuests(d, now);
    const bank = `<div class="bank">${ICON.seed}<b>${d.seedsBank.toLocaleString('en-US')}</b></div>`;
    let html = '';
    switch (this.panel) {
      case 'companions': this.titleEl.textContent = 'Companions'; html = bank + this._companions(); break;
      case 'upgrades': this.titleEl.textContent = 'Cozy Upgrades'; html = bank + this._upgrades(); break;
      case 'quests': this.titleEl.textContent = 'Quests & Daily'; html = this._quests(now); break;
      case 'settings': this.titleEl.textContent = 'Settings'; html = this._settings(); break;
      case 'chest': this.titleEl.textContent = 'Mystery Acorn'; html = this._chest(); break;
      default:
    }
    this.body.innerHTML = html;
    if (this.panel === 'companions') {
      for (const cv of this.body.querySelectorAll('canvas[data-comp]')) paintPortrait(cv, cv.dataset.comp, cv.dataset.lock === '1');
      let changed = false;
      for (const co of COMPANIONS) if (d.companions.owned[co.id] && !d.companions.seen[co.id]) { d.companions.seen[co.id] = true; changed = true; }
      if (changed) this.c.saveStore.commitSoon();
    }
  }

  // ---------------------------------------------------------------- companions
  _companions() {
    const d = this.data;
    const eq = d.companions.equipped;
    const cards = COMPANIONS.map((co) => {
      const owned = !!d.companions.owned[co.id];
      const r = RARITIES[co.rarity];
      const pr = companionProgress(d, co);
      const isNew = owned && !d.companions.seen[co.id];
      const status = owned
        ? (eq === co.id ? '<span class="tag on">With Bramble</span>' : '<button class="btn small" data-act="equip" data-id="' + co.id + '">Bring along</button>')
        : `<div class="mini"><i style="width:${Math.round(pr.pct * 100)}%"></i></div><span class="hint">${esc(co.unlock.text.replace('{n}', co.unlock.target))} (${pr.cur}/${pr.target})</span>`;
      return `<article class="comp ${owned ? '' : 'locked'}" style="--rar:${r.color}">
        ${isNew ? '<span class="new">NEW</span>' : ''}
        <canvas data-comp="${co.id}" data-lock="${owned ? 0 : 1}" aria-hidden="true"></canvas>
        <h3>${owned ? esc(co.name) : '???'}</h3>
        <span class="rar">${r.name}${owned ? ' · ' + esc(co.kind) : ''}</span>
        <p>${owned ? esc(co.desc) : 'A shy friend is hiding somewhere in the garden.'}</p>
        ${status}
      </article>`;
    }).join('');
    const none = eq ? `<button class="btn small ghost" data-act="unequip">Go solo</button>` : '';
    return `<p class="lead">One friend can follow Bramble at a time.</p><div class="comp-grid">${cards}</div><div class="center-row">${none}</div>`;
  }

  // ---------------------------------------------------------------- upgrades
  _upgrades() {
    const d = this.data;
    return `<p class="lead">Spend glow-seeds on small, permanent boosts.</p>` + UPGRADES.map((u) => {
      const lv = d.upgrades[u.id] | 0;
      const maxed = lv >= u.max;
      const cost = maxed ? 0 : u.costs[lv];
      const can = !maxed && d.seedsBank >= cost;
      const pips = Array.from({ length: u.max }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('');
      const cur = upgradeValue(u, lv); const next = upgradeValue(u, Math.min(u.max, lv + 1));
      const desc = u.desc.replace('{v}', maxed ? cur : next);
      return `<div class="up">
        <div class="up-main"><h3>${esc(u.name)}</h3><p>${esc(desc)}</p><div class="pips">${pips}</div></div>
        ${maxed ? '<span class="tag on">Maxed</span>' : `<button class="btn small ${can ? '' : 'ghost'}" data-act="buy" data-id="${u.id}" ${can ? '' : 'aria-disabled="true"'}>${ICON.seed}${cost}</button>`}
      </div>`;
    }).join('');
  }

  // ---------------------------------------------------------------- quests
  _quests(now) {
    const d = this.data;
    const st = dailyStatus(d, now);
    const daily = `<section class="sheet-sec">
      <h3>Daily Run</h3>
      <p>One shared course each day. First run pays a bonus and a mystery acorn.</p>
      <div class="facts"><span>Streak <b>${st.streak}</b> day${st.streak === 1 ? '' : 's'}</span><span>Best today <b>${st.best} m</b></span><span>Streak freezes <b>${st.freezes}</b></span></div>
      <p class="hint">${st.playedToday ? 'Played today. You can run it again for a better score.' : st.atRisk ? 'Play today to keep your streak. A freeze covers one missed day.' : 'Start a streak any day, with no pressure.'}</p>
      <div class="center-row"><button class="btn" data-act="daily">${st.playedToday ? 'Daily Run again' : 'Play Daily Run'}</button></div>
    </section>`;
    const qs = d.quests.list.map((e, i) => {
      const q = describeQuest(e);
      const pct = Math.round((q.progress / q.target) * 100);
      const rr = !q.done && !d.quests.rerolled ? `<button class="chip" data-act="reroll" data-i="${i}">Swap</button>` : '';
      return `<div class="quest ${q.done ? 'done' : ''}">
        <div class="q-main"><p>${esc(q.text)}</p><div class="mini"><i style="width:${pct}%"></i></div></div>
        <div class="q-side">${q.done ? ICON.check : `<span class="reward">${ICON.seed}${q.reward}</span>`}${rr}</div>
      </div>`;
    }).join('');
    const w = describeWeekly(d);
    const wk = w ? `<div class="quest weekly ${w.claimed ? 'done' : ''}">
        <div class="q-main"><p><b>This week:</b> ${esc(w.text)}</p><div class="mini"><i style="width:${Math.round((w.progress / w.target) * 100)}%"></i></div></div>
        <div class="q-side">${w.claimed ? ICON.check : `<span class="reward">${ICON.seed}${w.reward} + acorn</span>`}</div>
      </div>` : '';
    const lv = levelInfo(d.xp);
    const acorn = d.chests.pending > 0 ? `<div class="center-row"><button class="btn" data-act="openchest">Open Mystery Acorn (${d.chests.pending})</button></div>` : '';
    return acorn + daily + `<section class="sheet-sec"><h3>Today's quests</h3>${qs}${wk}<p class="hint">Level ${lv.level} · quests refresh every day. Nothing is ever lost if you skip one.</p></section>`;
  }

  // ---------------------------------------------------------------- settings
  _settings() {
    const s = this.data.settings;
    const slider = (key, label) => `<div class="set-row"><label for="s-${key}">${label}</label>
      <input id="s-${key}" type="range" min="0" max="100" step="5" value="${Math.round(s[key + 'Vol'] * 100)}" data-set="${key}Vol">
      <button class="chip ${s[key] ? '' : 'off'}" data-act="toggle" data-key="${key}">${s[key] ? 'On' : 'Muted'}</button></div>`;
    const tog = (key, label, hint) => `<div class="set-row"><label>${label}${hint ? `<small>${hint}</small>` : ''}</label>
      <button class="chip ${s[key] ? '' : 'off'}" data-act="toggle" data-key="${key}">${s[key] ? 'On' : 'Off'}</button></div>`;
    return slider('music', 'Music') + slider('sfx', 'Sound effects') +
      tog('haptics', 'Vibration', 'Gentle buzzes on phones') +
      tog('shake', 'Screen shake', 'A tiny wobble on bumps') +
      tog('reducedMotion', 'Reduced motion', 'No zoom, flashes or shake') +
      tog('breakReminder', 'Break reminders', 'A kind note after 25 minutes') +
      '<p class="hint">More options (accessibility, stats, save backup) arrive in the next update.</p>';
  }

  // ---------------------------------------------------------------- chest
  _chest() {
    const d = this.data;
    const st = this.chestState;
    if (!st) {
      if (d.chests.pending <= 0) return '<p class="lead">No mystery acorns waiting. Finish a Daily Run or a good run to find one.</p>';
      return `<div class="acorn" data-act="crack" role="button" tabindex="0" aria-label="Open the acorn"><div class="acorn-art">${this._acornSvg()}</div></div>
        <p class="lead">${d.chests.pending} acorn${d.chests.pending === 1 ? '' : 's'} waiting. Tap to open!</p>`;
    }
    const r = st.reward;
    const rar = RARITIES[r.rarity];
    const parts = [];
    if (r.seeds) parts.push(`<div class="prize">${ICON.seed}<b>+${r.seeds}</b> glow-seeds</div>`);
    if (r.xp) parts.push(`<div class="prize"><b>+${r.xp}</b> XP</div>`);
    if (r.companion) parts.push(`<div class="prize comp-win"><canvas data-comp="${r.companion.id}" data-lock="0"></canvas><div><b>${esc(r.companion.name)}</b> joined you!<br><small>${esc(r.companion.desc)}</small></div></div>`);
    const more = d.chests.pending > 0 ? `<button class="btn" data-act="anotherchest">Open another (${d.chests.pending})</button>` : '';
    return `<div class="reveal" style="--rar:${rar.color}"><h3>${rar.name} acorn!</h3>${parts.join('')}</div><div class="center-row">${more}</div>`;
  }

  _acornSvg() {
    return '<svg viewBox="0 0 120 130" width="150" height="160" aria-hidden="true"><ellipse cx="60" cy="86" rx="38" ry="38" fill="#d9a066" stroke="#7a4f26" stroke-width="4"/><path d="M18 60 Q60 20 102 60 Q96 74 60 72 Q24 74 18 60Z" fill="#9a6a3a" stroke="#5a3a1a" stroke-width="4" stroke-linejoin="round"/><path d="M60 30 L60 12" stroke="#5a3a1a" stroke-width="6" stroke-linecap="round"/><ellipse cx="46" cy="92" rx="5" ry="7" fill="#fff" opacity=".35"/></svg>';
  }

  // ---------------------------------------------------------------- events
  _click(e) {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    e.preventDefault();
    const d = this.data;
    const a = el.dataset.act;
    const { audio, onChange } = this.c;
    switch (a) {
      case 'equip':
        d.companions.equipped = el.dataset.id; audio.sfx('equip'); this.c.saveStore.commitSoon(); onChange('equip'); this.render(); break;
      case 'unequip':
        d.companions.equipped = ''; audio.sfx('back'); this.c.saveStore.commitSoon(); onChange('equip'); this.render(); break;
      case 'buy': {
        const u = UPGRADES.find((x) => x.id === el.dataset.id);
        const lv = d.upgrades[u.id] | 0;
        if (lv >= u.max) break;
        const cost = u.costs[lv];
        if (d.seedsBank < cost) { audio.sfx('deny'); el.classList.add('shake'); setTimeout(() => el.classList.remove('shake'), 400); break; }
        d.seedsBank -= cost; d.upgrades[u.id] = lv + 1;
        audio.sfx('buy'); this.c.saveStore.commit(); onChange('upgrade'); this.render();
        break;
      }
      case 'reroll':
        if (rerollQuest(d, +el.dataset.i, clock.now())) { audio.sfx('ui'); this.c.saveStore.commitSoon(); this.render(); }
        break;
      case 'daily': this.root.classList.add('hidden'); this.panel = ''; this.c.onDaily(); break;
      case 'openchest': this.chestState = null; this.panel = 'chest'; audio.sfx('ui'); this.render(); break;
      case 'crack': this._crack(); break;
      case 'anotherchest': this.chestState = null; this.render(); break;
      case 'toggle': {
        const k = el.dataset.key;
        d.settings[k] = !d.settings[k];
        this.c.saveStore.commitSoon(); this.c.onSettings(); audio.sfx('ui'); this.render();
        break;
      }
      default:
    }
  }

  _input(e) {
    const el = e.target.closest('[data-set]');
    if (!el) return;
    this.data.settings[el.dataset.set] = Math.max(0, Math.min(1, el.value / 100));
    this.c.onSettings();
    this.c.saveStore.commitSoon();
    if (el.dataset.set === 'sfxVol') this.c.audio.sfx('seed', null, 3);
  }

  /** Tap the acorn: wiggle, crack, then reveal. */
  _crack() {
    const art = this.body.querySelector('.acorn');
    if (!art || this._cracking) return;
    this._cracking = true;
    art.classList.add('wiggle');
    this.c.audio.sfx('chestshake');
    setTimeout(() => this.c.audio.sfx('chestshake'), 220);
    setTimeout(() => {
      const reward = openChest(this.data, this.c.getLuck());
      this._cracking = false;
      if (!reward) { this.render(); return; }
      this.chestState = { reward };
      this.c.audio.sfx('chestopen', reward.rarity);
      if (reward.companion) setTimeout(() => this.c.audio.sfx('unlock'), 500);
      this.c.saveStore.commit();
      this.c.onChange('chest');
      this.render();
      for (const cv of this.body.querySelectorAll('canvas[data-comp]')) paintPortrait(cv, cv.dataset.comp, false);
    }, 650);
  }
}
