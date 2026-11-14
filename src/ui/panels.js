/**
 * panels.js — the menu sheets that open over the title screen: Companions, Upgrades, Quests & Daily,
 * Settings, and the Mystery Acorn reveal. Each panel is a function that returns HTML for the sheet; clicks are
 * handled with one delegated listener. All numbers come from the save and the data files, nothing is hard-wired here.
 */
import { COMPANIONS, RARITIES } from '../data/companions.js';
import { UPGRADES, upgradeValue } from '../data/upgrades.js';
import { ACHIEVEMENTS, ACHIEVEMENT_BY_ID, TIER } from '../data/achievements.js';
import { COSMETICS, COSMETIC_BY_ID, SLOTS } from '../data/cosmetics.js';
import { BIOMES, BIOME_ORDER } from '../data/biomes.js';
import { companionProgress } from '../game/loadout.js';
import { ensureQuests, describeQuest, describeWeekly, rerollQuest } from '../game/quests.js';
import { achievementProgress, equipLook, unlockText } from '../game/achievements.js';
import { dailyStatus } from '../game/daily.js';
import { openChest } from '../game/chests.js';
import { levelInfo } from '../game/progress.js';
import { paintPortrait } from '../render/companions.js';
import { clock } from '../core/clock.js';
import { pwa } from '../core/pwa.js';
import { ICON, medal } from './icons.js';
import { VERSION } from '../data/meta.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const fmtTime = (sec) => { sec = Math.max(0, Math.round(sec)); const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60); return h ? `${h} h ${m} min` : `${m} min ${sec % 60} s`; };

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
    this.wardTab = 'scales';          // wardrobe: which slot tab is showing
    this.preview = {};                // wardrobe: locked looks being previewed {slot: id}
    this.trophyFilter = 'all';
    this.confirmReset = false;
    this._pv = 0;
    pwa.onChange(() => { if (this.panel === 'settings' && this.isOpen()) this._refreshPwa(); });
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
    if (this.panel === 'wardrobe') for (const c of COSMETICS) if (this.data.cosmetics.owned[c.id]) this.data.cosmetics.seen[c.id] = true;
    this.panel = '';
    this.preview = {}; this.confirmReset = false;
    cancelAnimationFrame(this._pv); this._pv = 0;
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
      case 'companions': this.titleEl.textContent = 'War Beasts'; html = bank + this._companions(); break;
      case 'upgrades': this.titleEl.textContent = 'The Forge'; html = bank + this._upgrades(); break;
      case 'quests': this.titleEl.textContent = 'Quests & Daily'; html = this._quests(now); break;
      case 'settings': this.titleEl.textContent = 'Settings'; html = this._settings(); break;
      case 'achievements': this.titleEl.textContent = 'Trophies'; html = this._trophies(); break;
      case 'wardrobe': this.titleEl.textContent = 'Wardrobe'; html = this._wardrobe(); break;
      case 'stats': this.titleEl.textContent = 'Stats'; html = this._stats(); break;
      case 'chest': this.titleEl.textContent = 'Dragon Egg'; html = this._chest(); break;
      default:
    }
    const keep = this.body.scrollTop;
    this.body.innerHTML = html;
    if (this.panel === 'achievements' || this.panel === 'wardrobe' || this.panel === 'settings') this.body.scrollTop = keep;
    if (this.panel === 'wardrobe') this._startPreview();
    if (this.panel === 'settings') this._refreshPwa();
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
        ? (eq === co.id ? '<span class="tag on">With Cinder</span>' : '<button class="btn small" data-act="equip" data-id="' + co.id + '">Summon</button>')
        : `<div class="mini"><i style="width:${Math.round(pr.pct * 100)}%"></i></div><span class="hint">${esc(co.unlock.text.replace('{n}', co.unlock.target))} (${pr.cur}/${pr.target})</span>`;
      return `<article class="comp ${owned ? '' : 'locked'}" style="--rar:${r.color}">
        ${isNew ? '<span class="new">NEW</span>' : ''}
        <canvas data-comp="${co.id}" data-lock="${owned ? 0 : 1}" aria-hidden="true"></canvas>
        <h3>${owned ? esc(co.name) : '???'}</h3>
        <span class="rar">${r.name}${owned ? ' · ' + esc(co.kind) : ''}</span>
        <p>${owned ? esc(co.desc) : 'A beast lurks somewhere in the ashlands. Keep flying to draw it out.'}</p>
        ${status}
      </article>`;
    }).join('');
    const none = eq ? `<button class="btn small ghost" data-act="unequip">Fly alone</button>` : '';
    return `<p class="lead">One war-beast flies beside Cinder at a time.</p><div class="comp-grid">${cards}</div><div class="center-row">${none}</div>`;
  }

  // ---------------------------------------------------------------- upgrades
  _upgrades() {
    const d = this.data;
    return `<p class="lead">Spend embers at the forge for permanent boosts.</p>` + UPGRADES.map((u) => {
      const lv = d.upgrades[u.id] | 0;
      const maxed = lv >= u.max;
      const cost = maxed ? 0 : u.costs[lv];
      const can = !maxed && d.seedsBank >= cost;
      const pips = Array.from({ length: u.max }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('');
      const cur = upgradeValue(u, lv); const next = upgradeValue(u, Math.min(u.max, lv + 1));
      const shown = maxed ? cur : next;
      const desc = u.desc.replace('{v}', shown).replace('{s}', shown === 1 ? '' : 's');
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
      <p>One shared course each day. First run pays a bonus and a dragon egg.</p>
      <div class="facts"><span>Streak <b>${st.streak}</b> day${st.streak === 1 ? '' : 's'}</span><span>Best today <b>${st.best} m</b></span><span>Streak freezes <b>${st.freezes}</b></span></div>
      <p class="hint">${st.playedToday ? 'Played today. You can run it again for a better score.' : st.atRisk ? 'Fly today to keep your streak alive. A freeze covers one missed day.' : 'Start a streak any day.'}</p>
      <div class="center-row"><button class="btn" data-act="daily">${st.playedToday ? 'Fly Daily again' : 'Fly the Daily Run'}</button></div>
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
        <div class="q-side">${w.claimed ? ICON.check : `<span class="reward">${ICON.seed}${w.reward} + egg</span>`}</div>
      </div>` : '';
    const lv = levelInfo(d.xp);
    const acorn = d.chests.pending > 0 ? `<div class="center-row"><button class="btn" data-act="openchest">Hatch Dragon Egg (${d.chests.pending})</button></div>` : '';
    return acorn + daily + `<section class="sheet-sec"><h3>Today's quests</h3>${qs}${wk}<p class="hint">Rank ${lv.level} · quests refresh every day. Nothing is lost if you skip one.</p></section>`;
  }

  // ---------------------------------------------------------------- trophies
  _trophies() {
    const d = this.data;
    const total = ACHIEVEMENTS.length;
    const got = ACHIEVEMENTS.filter((a) => d.achievements[a.id] > 0).length;
    const f = this.trophyFilter;
    const chip = (id, label) => `<button class="chip ${f === id ? 'sel' : ''}" data-act="filter" data-f="${id}" aria-pressed="${f === id}">${label}</button>`;
    const loot = {};
    for (const c of COSMETICS) if (c.unlock.ach) (loot[c.unlock.ach] = loot[c.unlock.ach] || []).push(c);
    const list = ACHIEVEMENTS.map((a) => ({ a, p: achievementProgress(d, a) })).filter(({ p }) => f === 'all' || (f === 'done' ? p.done : !p.done));
    if (f === 'todo') list.sort((x, y) => y.p.pct - x.p.pct);
    const rows = list.map(({ a, p }) => {
      const t = TIER[a.tier];
      const lt = (loot[a.id] || []).map((c) => `${SLOTS.find((sl) => sl.id === c.slot).name}: ${c.name}`).join(', ');
      return `<div class="troph ${p.done ? 'done' : ''}" style="--tier:${t.color}">
        ${medal(a.tier, !p.done)}
        <div class="tr-main"><h3>${esc(a.name)}</h3><p>${esc(a.desc)}</p>
          ${p.done ? '' : `<div class="mini"><i style="width:${Math.round(p.pct * 100)}%"></i></div><span class="hint">${fmt(p.cur)} / ${fmt(p.target)}</span>`}
          ${lt ? `<span class="loot">Unlocks ${esc(lt)}</span>` : ''}
        </div>
        <div class="tr-side">${p.done ? ICON.check : `<span class="reward">${ICON.seed}${t.embers}</span>`}</div>
      </div>`;
    }).join('');
    return `<div class="bank"><b>${got}</b>&nbsp;/ ${total} trophies</div>
      <div class="mini big"><i style="width:${Math.round((got / total) * 100)}%"></i></div>
      <div class="center-row chips">${chip('all', 'All')}${chip('todo', 'To do')}${chip('done', 'Earned')}</div>
      ${rows || '<p class="lead">Nothing here yet. Keep flying.</p>'}`;
  }

  // ---------------------------------------------------------------- wardrobe
  _swatch(c) {
    const p = c.pal;
    const cols = {
      scales: [p.scale || '#a5301f', p.scaleLight || '#d4512a', p.belly || '#d9a441'],
      horns: [p.horn || '#cdb88c', p.hornDark || '#7d6a48', p.claw || '#e9dcc0'],
      eyes: [p.eye || '#ffc62a'],
      flame: [p.ember || '#ff7a2a', p.emberHot || '#ffd36a'],
    }[c.slot];
    return cols.map((col) => `<i style="background:${col}"></i>`).join('');
  }

  _wardrobe() {
    const d = this.data;
    const slot = this.wardTab;
    const tabs = SLOTS.map((sl) => {
      const fresh = COSMETICS.some((c) => c.slot === sl.id && d.cosmetics.owned[c.id] && !d.cosmetics.seen[c.id]);
      return `<button class="chip ${sl.id === slot ? 'sel' : ''}" data-act="tab" data-tab="${sl.id}" aria-pressed="${sl.id === slot}">${sl.name}${fresh ? ' <span class="pip">NEW</span>' : ''}</button>`;
    }).join('');
    const cards = COSMETICS.filter((c) => c.slot === slot).map((c) => {
      const owned = !!d.cosmetics.owned[c.id];
      const eq = d.cosmetics.equipped[slot] === c.id;
      const r = RARITIES[c.rarity];
      const fresh = owned && !d.cosmetics.seen[c.id];
      const status = owned
        ? (eq ? '<span class="tag on">Equipped</span>' : `<button class="btn small" data-act="look" data-id="${c.id}">Equip</button>`)
        : `<span class="hint">${esc(unlockText(c, ACHIEVEMENT_BY_ID))}</span>`;
      return `<article class="look ${owned ? '' : 'locked'} ${eq ? 'eq' : ''} ${this.preview[slot] === c.id ? 'pv' : ''}" style="--rar:${r.color}" ${owned ? '' : `data-act="try" data-id="${c.id}" tabindex="0"`}>
        ${fresh ? '<span class="new">NEW</span>' : ''}
        <div class="sw">${this._swatch(c)}</div>
        <h3>${esc(c.name)}</h3><span class="rar">${r.name}</span>
        <p>${esc(c.text)}</p>${status}
      </article>`;
    }).join('');
    return `<canvas id="hero-preview" class="hero-pv" aria-label="Preview of Cinder wearing the chosen look"></canvas>
      <div class="center-row chips">${tabs}</div>
      <p class="hint center">Tap a locked look to preview it on Cinder.</p>
      <div class="look-grid">${cards}</div>`;
  }

  _startPreview() {
    const cv = this.body.querySelector('#hero-preview');
    if (!cv || !this.c.previewHero) return;
    cancelAnimationFrame(this._pv);
    const frame = () => {
      if (this.panel !== 'wardrobe' || !this.isOpen()) { this._pv = 0; return; }
      this.c.previewHero(cv, { ...this.data.cosmetics.equipped, ...this.preview });
      this._pv = requestAnimationFrame(frame);
    };
    frame();
  }

  // ---------------------------------------------------------------- stats
  _stats() {
    const d = this.data; const st = d.stats; const lv = levelInfo(d.xp);
    const row = (k, v) => `<div class="stat-row"><span>${k}</span><b>${v}</b></div>`;
    const sec = (title, rows) => `<section class="sheet-sec"><h3>${title}</h3>${rows.join('')}</section>`;
    const km = (m) => (m >= 10000 ? `${(m / 1000).toFixed(1)} km` : `${fmt(m)} m`);
    const gotT = ACHIEVEMENTS.filter((a) => d.achievements[a.id] > 0).length;
    const gotC = COMPANIONS.filter((c) => d.companions.owned[c.id]).length;
    const forge = UPGRADES.reduce((n, u) => n + (d.upgrades[u.id] | 0), 0);
    const forgeMax = UPGRADES.reduce((n, u) => n + u.max, 0);
    const looks = COSMETICS.filter((c) => d.cosmetics.owned[c.id]).length;
    let fav = '';
    let favN = 0;
    for (const c of COMPANIONS) { const n = st.runsByCompanion[c.id] | 0; if (n > favN) { favN = n; fav = c.name; } }
    const lands = BIOME_ORDER.map((id) => `<span class="land ${d.seenBiomes.includes(id) ? 'seen' : ''}">${d.seenBiomes.includes(id) ? esc(BIOMES[id].name) : '???'}</span>`).join('');
    return sec('Career', [
      row('Rank', `${lv.level} <small>(${fmt(lv.into)} / ${fmt(lv.need)} XP)</small>`),
      row('Flights', fmt(st.runs)),
      row('Time in the air', fmtTime(st.totalSeconds)),
      row('Distance flown', km(st.totalDistance)),
      row('Best flight', `${fmt(d.best.distance)} m`),
      row('Best score', fmt(d.best.score)),
      row('Longest flight', fmtTime(st.longestRun)),
    ]) + sec('Plunder', [
      row('Embers collected', fmt(st.totalSeeds)),
      row('Braziers lit', fmt(st.lanterns)),
      row('Phoenix wisps', fmt(st.fireflies)),
      row('F-I-R-E spelled', fmt(st.words)),
      row('Power-ups used', fmt(st.powerups)),
    ]) + sec('Skill', [
      row('Near-misses', fmt(st.nearMisses)),
      row('Chasms glided', fmt(st.glideGaps)),
      row('Portcullises slid under', fmt(st.vinesSlid)),
      row('Hits taken', fmt(st.hits)),
      row('Best combo', `x${Math.max(1, st.bestCombo)}`),
      row('Longest flight without a hit', `${fmt(st.cleanBest || 0)} m`),
    ]) + `<section class="sheet-sec"><h3>The Realm</h3><div class="lands">${lands}</div></section>` + sec('War-camp', [
      row('War-beasts called', `${gotC} / ${COMPANIONS.length}`),
      row('Favourite beast', fav ? `${esc(fav)} <small>(${favN} flights)</small>` : '-'),
      row('Dragon eggs hatched', fmt(d.chests.opened)),
      row('Forge upgrades', `${forge} / ${forgeMax}`),
      row('Looks collected', `${looks} / ${COSMETICS.length}`),
      row('Trophies', `${gotT} / ${ACHIEVEMENTS.length}`),
    ]) + sec('Daily Run', [
      row('Daily Runs flown', fmt(st.dailyRuns)),
      row('Current streak', `${d.daily.streak} day${d.daily.streak === 1 ? '' : 's'}`),
      row('Best streak', `${d.daily.bestStreak} day${d.daily.bestStreak === 1 ? '' : 's'}`),
    ]);
  }

  // ---------------------------------------------------------------- settings
  _settings() {
    const s = this.data.settings;
    const slider = (key, label) => `<div class="set-row"><label for="s-${key}">${label}</label>
      <input id="s-${key}" type="range" min="0" max="100" step="5" value="${Math.round(s[key + 'Vol'] * 100)}" data-set="${key}Vol">
      <button class="chip ${s[key] ? '' : 'off'}" data-act="toggle" data-key="${key}" aria-pressed="${!!s[key]}">${s[key] ? 'On' : 'Muted'}</button></div>`;
    const tog = (key, label, hint) => `<div class="set-row"><label>${label}${hint ? `<small>${hint}</small>` : ''}</label>
      <button class="chip ${s[key] ? '' : 'off'}" data-act="toggle" data-key="${key}" role="switch" aria-checked="${!!s[key]}" aria-label="${esc(label)}">${s[key] ? 'On' : 'Off'}</button></div>`;
    const seg = (key, label, opts) => `<div class="set-row col"><label>${label}</label><div class="seg" role="radiogroup" aria-label="${esc(label)}">${opts.map(([v, n]) =>
      `<button class="${s[key] === v ? 'on' : ''}" data-act="seg" data-key="${key}" data-v="${v}" role="radio" aria-checked="${s[key] === v}">${n}</button>`).join('')}</div></div>`;
    const sec = (t) => `<h3 class="set-h">${t}</h3>`;
    return sec('Sound') + slider('music', 'Music') + slider('sfx', 'Sound effects') +
      sec('Play') +
      tog('gentle', 'Gentle mode', 'One extra heart on normal runs (not the Daily Run)') +
      tog('tapSlide', 'Tap to slide', 'Tap the lower part of the screen to slide: no swipe needed') +
      tog('leftHanded', 'Left-handed layout', 'Pause button on the left') +
      tog('breakReminder', 'Break reminders', 'A short note after a long session') +
      sec('Comfort and access') +
      tog('haptics', 'Vibration', 'Haptic feedback on phones') +
      tog('shake', 'Screen shake', 'Impact rumble on hits') +
      tog('flashes', 'Screen flashes', 'Brief white flashes on big moments') +
      tog('reducedMotion', 'Reduced motion', 'No zoom, beat pulse, ambient drift or shake') +
      tog('highContrast', 'High contrast', 'Dimmer backdrop, bright outlines on hazards and pickups') +
      tog('largeText', 'Large text', 'Bigger HUD and menu text') +
      sec('Performance') +
      seg('quality', 'Graphics', [['auto', 'Auto'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low']]) +
      tog('showFps', 'Show FPS', 'A small frame-rate counter') +
      sec('Install and offline') + '<div id="pwa-box" class="set-box"></div>' +
      sec('Save data') + this._saveBox() +
      sec('About') + `<div class="set-box"><p><b>Emberwing Run</b> v${esc(VERSION)}</p>
        <p class="hint">An endless runner made with plain HTML, CSS and JavaScript. Every picture and sound is generated by code. Your progress lives only on this device.</p></div>`;
  }

  _saveBox() {
    const reset = this.confirmReset
      ? `<p><b>Erase everything?</b> Embers, trophies, beasts and looks are lost for good.</p><div class="center-row"><button class="btn small danger" data-act="reset2">Yes, erase it all</button><button class="btn small ghost" data-act="reset0">Keep my progress</button></div>`
      : '<div class="center-row"><button class="btn small ghost" data-act="reset1">Erase all progress</button></div>';
    return `<div class="set-box"><p>Copy this code somewhere safe to back up your save, or paste a code here to restore it.</p>
      <textarea id="save-code" rows="3" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="Save code"></textarea>
      <div class="center-row"><button class="btn small" data-act="export">Show my code</button><button class="btn small" data-act="copy">Copy</button><button class="btn small ghost" data-act="import">Restore from code</button></div>
      <p class="hint" id="save-msg" role="status"></p>${reset}</div>`;
  }

  _refreshPwa() {
    const box = this.body.querySelector('#pwa-box');
    if (!box) return;
    const s = pwa.state;
    const lines = [];
    if (pwa.standalone) lines.push('<p>Running as an installed app.</p>');
    if (!s.supported) lines.push('<p>Offline mode is not available in this browser, but the game works while you are online.</p>');
    else if (s.error) lines.push(`<p>Offline mode could not start (${esc(s.error)}). The game still works online.</p>`);
    else if (s.offlineReady) lines.push(`<p><b>Ready to play offline.</b> <small>${s.files} files saved${s.version ? ` · build ${esc(s.version)}` : ''}</small></p>`);
    else lines.push('<p>Saving the game for offline play. This takes a moment the first time you are online.</p>');
    if (pwa.ios && !pwa.standalone) lines.push('<p class="hint">To install on iPhone or iPad: open this page in Safari, tap the Share button, then "Add to Home Screen".</p>');
    const btns = [];
    if (pwa.canInstall) btns.push('<button class="btn small" data-act="install">Install app</button>');
    if (s.waiting) btns.push('<button class="btn small" data-act="applyupdate">Update ready: restart</button>');
    else if (s.registered) btns.push(`<button class="btn small ghost" data-act="checkupdate" ${s.checking ? 'aria-disabled="true"' : ''}>${s.checking ? 'Checking...' : 'Check for update'}</button>`);
    box.innerHTML = lines.join('') + (btns.length ? `<div class="center-row">${btns.join('')}</div>` : '') + '<p class="hint" id="upd-msg" role="status"></p>';
  }

  // ---------------------------------------------------------------- chest
  _chest() {
    const d = this.data;
    const st = this.chestState;
    if (!st) {
      if (d.chests.pending <= 0) return '<p class="lead">No dragon eggs waiting. Finish a Daily Run or a strong run to find one.</p>';
      return `<div class="acorn" data-act="crack" role="button" tabindex="0" aria-label="Crack the egg"><div class="acorn-art">${this._acornSvg()}</div></div>
        <p class="lead">${d.chests.pending} egg${d.chests.pending === 1 ? '' : 's'} waiting. Tap to crack it open!</p>`;
    }
    const r = st.reward;
    const rar = RARITIES[r.rarity];
    const parts = [];
    if (r.seeds) parts.push(`<div class="prize">${ICON.seed}<b>+${r.seeds}</b> embers</div>`);
    if (r.xp) parts.push(`<div class="prize"><b>+${r.xp}</b> XP</div>`);
    if (r.look) parts.push(`<div class="prize look-win"><span class="sw">${this._swatch(r.look)}</span><div><b>${esc(r.look.name)}</b> for Cinder's wardrobe!<br><small>${esc(r.look.text)}</small></div></div>`);
    if (r.companion) parts.push(`<div class="prize comp-win"><canvas data-comp="${r.companion.id}" data-lock="0"></canvas><div><b>${esc(r.companion.name)}</b> answers your call!<br><small>${esc(r.companion.desc)}</small></div></div>`);
    const more = d.chests.pending > 0 ? `<button class="btn" data-act="anotherchest">Crack another (${d.chests.pending})</button>` : '';
    return `<div class="reveal" style="--rar:${rar.color}"><h3>${rar.name} egg!</h3>${parts.join('')}</div><div class="center-row">${more}</div>`;
  }

  _acornSvg() {          // a dragon egg: dark shell with glowing ember cracks and scale ridges
    return '<svg viewBox="0 0 120 150" width="140" height="175" aria-hidden="true"><defs><radialGradient id="eg" cx="50%" cy="60%" r="60%"><stop offset="0" stop-color="#ff7a2a" stop-opacity=".55"/><stop offset="1" stop-color="#ff7a2a" stop-opacity="0"/></radialGradient></defs><ellipse cx="60" cy="86" rx="58" ry="62" fill="url(#eg)"/><path d="M60 14 C92 14 104 64 104 94 C104 126 84 142 60 142 C36 142 16 126 16 94 C16 64 28 14 60 14Z" fill="#3a2a3e" stroke="#120a14" stroke-width="4" stroke-linejoin="round"/><path d="M26 60 Q60 72 94 60 M20 84 Q60 98 100 84 M22 108 Q60 122 98 108" fill="none" stroke="#54405a" stroke-width="3"/><path d="M60 22 L54 46 L66 62 L56 84 L68 104 L60 124" fill="none" stroke="#ff8a3a" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/><path d="M40 40 Q34 60 38 74" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="5" stroke-linecap="round"/></svg>';
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
      case 'seg':
        d.settings[el.dataset.key] = el.dataset.v;
        this.c.saveStore.commitSoon(); this.c.onSettings(); audio.sfx('ui'); this.render();
        break;
      case 'filter': this.trophyFilter = el.dataset.f; audio.sfx('ui'); this.render(); break;
      case 'tab': this.wardTab = el.dataset.tab; this.preview = {}; audio.sfx('ui'); this.render(); break;
      case 'try': {
        const c = COSMETIC_BY_ID[el.dataset.id];
        if (c) { this.preview = { ...this.preview, [c.slot]: c.id }; audio.sfx('ui'); this.render(); }
        break;
      }
      case 'look':
        if (equipLook(d, el.dataset.id)) {
          const c = COSMETIC_BY_ID[el.dataset.id];
          d.cosmetics.seen[c.id] = true;
          delete this.preview[c.slot];
          audio.sfx('equip'); this.c.saveStore.commitSoon(); onChange('look'); this.render();
        }
        break;
      case 'export': this._exportCode(); break;
      case 'copy': this._copyCode(); break;
      case 'import': this._importCode(); break;
      case 'reset1': this.confirmReset = true; audio.sfx('ui'); this.render(); break;
      case 'reset0': this.confirmReset = false; audio.sfx('back'); this.render(); break;
      case 'reset2':
        this.confirmReset = false; this.c.saveStore.reset(); this.c.onSettings(); onChange('reset'); audio.sfx('back'); this.render();
        this._msg('Progress erased. A fresh start.');
        break;
      case 'install': pwa.install().then(() => this._refreshPwa()); break;
      case 'checkupdate':
        pwa.checkUpdate().then((r) => {
          const m = this.body.querySelector('#upd-msg');
          if (m) m.textContent = { ready: 'A new version is ready.', current: 'You have the latest version.', offline: 'Could not check: you seem to be offline.', unsupported: 'Updates are not available here.' }[r] || '';
        });
        break;
      case 'applyupdate': audio.sfx('ui'); pwa.applyUpdate(); break;
      default:
    }
  }

  _msg(text) { const m = this.body.querySelector('#save-msg'); if (m) m.textContent = text; }

  _exportCode() {
    const ta = this.body.querySelector('#save-code');
    if (!ta) return;
    this.c.saveStore.commit();
    ta.value = this.c.saveStore.exportCode();
    ta.focus(); ta.select();
    this._msg('This is your save code. Press Copy, then keep it somewhere safe.');
  }

  async _copyCode() {
    const ta = this.body.querySelector('#save-code');
    if (!ta) return;
    if (!ta.value) this._exportCode();
    try { await navigator.clipboard.writeText(ta.value); this._msg('Copied to the clipboard.'); return; } catch (_) { /* fall through */ }
    ta.focus(); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
    this._msg(ok ? 'Copied to the clipboard.' : 'Select the code and copy it by hand.');
  }

  _importCode() {
    const ta = this.body.querySelector('#save-code');
    if (!ta) return;
    const text = ta.value.trim();
    if (!text) { this._msg('Paste a save code into the box first.'); return; }
    if (this.c.saveStore.importCode(text)) {
      this.c.onSettings(); this.c.onChange('import'); this.c.audio.sfx('unlock');
      this.render();
      this._msg('Save restored.');
    } else {
      this.c.audio.sfx('deny');
      this._msg('That code did not work. Check that you copied all of it.');
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

  /** Tap the egg: shudder, crack, then reveal. */
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
