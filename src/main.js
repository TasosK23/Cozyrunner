/**
 * main.js — boots the game and wires everything together.
 *
 * Game modes:  title -> running <-> paused -> over -> (run again | title)
 * Each frame: the Loop runs fixed 1/60 s updates (input -> Run.update), then one render.
 */
import { SaveStore } from './core/save.js';
import { Loop } from './core/loop.js';
import { Input } from './core/input.js';
import { haptics } from './core/haptics.js';
import { quality, QualityMonitor, QUALITY_NAMES } from './core/quality.js';
import { pwa } from './core/pwa.js';
import { Run } from './game/world.js';
import { createJuice } from './game/juice.js';
import { xpForRun, levelInfo } from './game/progress.js';
import { buildLoadout, nextCompanion, unlockEarned } from './game/loadout.js';
import { ensureQuests, applyRunToQuests } from './game/quests.js';
import { dailySeed, dailyStatus, recordDaily } from './game/daily.js';
import { rollChest } from './game/chests.js';
import { clock, dayKey } from './core/clock.js';
import { audio } from './audio/audio.js';
import { Panels } from './ui/panels.js';
import { BIOMES, BIOME_ORDER } from './data/biomes.js';
import { COMPANIONS } from './data/companions.js';
import { UPGRADES } from './data/upgrades.js';
import { TIER } from './data/achievements.js';
import { SLOTS } from './data/cosmetics.js';
import { evaluateAchievements, syncCosmetics } from './game/achievements.js';
import { Toasts } from './ui/toast.js';
import { medal } from './ui/icons.js';
import { planAction } from './game/solver.js';
import { FX } from './render/fx.js';
import { BrambleVisual } from './render/bramble.js';
import { Hud } from './render/hud.js';
import { Renderer } from './render/renderer.js';
import { UI } from './ui/ui.js';
import { t, STRINGS } from './data/strings.js';
import { VERSION } from './data/meta.js';
import { SIM, BREAK_AFTER_MIN, BIOME } from './data/balance.js';

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');

// ------------------------------------------------------------------ core objects
const saveStore = new SaveStore();
saveStore.load();
if (saveStore.isNew && typeof matchMedia === 'function') {
  // first visit: start from the phone's own accessibility preferences (the player can still change them in Settings)
  const pref = (q) => { try { return matchMedia(q).matches; } catch (_) { return false; } };
  if (pref('(prefers-reduced-motion: reduce)')) saveStore.data.settings.reducedMotion = true;
  if (pref('(prefers-contrast: more)')) saveStore.data.settings.highContrast = true;
}
haptics.enabled = !!saveStore.data.settings.haptics;

const app = $('#app');
const canvas = $('#game');
const fx = new FX();
const run = new Run(saveStore.data.tutorial);
const vis = new BrambleVisual();
const hud = new Hud();
const renderer = new Renderer(canvas, run, fx, vis, hud);
/** Shared "game feel" dials: the juice layer sets them, the main loop applies and decays them. */
const ctl = { hitstop: 0, slow: 0, shake: 0, flash: 0, slowPulse: 0, zoom: 1 };
const juice = createJuice({ run, fx, vis, hud, ctl, renderer, settings: saveStore.data.settings });
const input = new Input(canvas);
const IDLE = { press: false, hold: false, slide: false };
const toasts = new Toasts($('#toasts'));
let runTrophies = [];        // trophies earned while flying this run (they pop up live; the game-over card lists them too)
let runLooks = [];
let liveT = 0;

let mode = 'title';          // title | running | paused | over
let sessionPlayS = 0;        // seconds actually played this session (for the gentle break note)
let breakShown = false;
let pendingDaily = false;
let startM = Number(params.get('startM')) || 0;     // debug: begin a run this many meters in
let autoplay = false;        // debug autopilot
let dbgPanel = null;         // the ?debug panel (null for normal players)
let autoTick = 0;
let autoAct = IDLE;

$('#ver').textContent = `v${VERSION}`;

// ------------------------------------------------------------------ run lifecycle
function newSeed() { return ((Date.now() ^ Math.floor(Math.random() * 4294967296)) >>> 0) || 1; }

function applySettings() {
  const st = saveStore.data.settings;
  haptics.enabled = !!st.haptics;
  renderer.reduced = !!st.reducedMotion;
  renderer.contrast = !!st.highContrast;
  renderer.noFlash = !st.flashes || !!st.reducedMotion;
  hud.scale = st.largeText ? 1.2 : 1;
  hud.mirror = !!st.leftHanded;
  input.slideZone = st.tapSlide ? 0.68 : 0;
  document.documentElement.classList.toggle('large', !!st.largeText);
  app.classList.toggle('lefty', !!st.leftHanded);
  app.classList.toggle('hc', !!st.highContrast);
  audio.setSettings({ music: st.music, sfx: st.sfx, musicVol: st.musicVol, sfxVol: st.sfxVol });
  dbg.classList.toggle('hidden', !(DEBUG || st.showFps));
  // graphics: a hand-picked level is pinned; 'auto' lets the quality monitor step down by itself
  const qi = QUALITY_NAMES.indexOf(st.quality);
  if (qi >= 0) {
    if (!qm.pinned || quality.level !== qi) { qm.pinned = true; quality.set(qi); fx.setLimit(quality.cfg.particles); resize(); }
  } else if (qm.pinned) {
    qm.pinned = false; quality.set(0); fx.setLimit(quality.cfg.particles); resize(); qm.hiccup();
  }
  vis.setLook(saveStore.data.cosmetics.equipped);
}

function currentLoadout(daily = false) { return buildLoadout(saveStore.data, { daily }); }

/** Small red dots on the title tiles: something new worth a look. */
function titleInfo() {
  const d = saveStore.data;
  const now = clock.now();
  ensureQuests(d, now);
  const ds = dailyStatus(d, now);
  const canBuy = [...Object.keys(d.upgrades)].some((id) => {
    const u = UPGRADES.find((x) => x.id === id);
    const lv = d.upgrades[id] | 0;
    return u && lv < u.max && d.seedsBank >= u.costs[lv];
  });
  return {
    seeds: d.seedsBank, dailyDone: ds.playedToday, streak: ds.streak,
    hideMeta: d.stats.runs < 1 && !d.tutorial.done,           // first-ever visit: keep the title simple
    dots: {
      companions: COMPANIONS.some((c) => d.companions.owned[c.id] && !d.companions.seen[c.id]),
      upgrades: canBuy,
      quests: d.chests.pending > 0,
      wardrobe: Object.keys(d.cosmetics.owned).some((id) => d.cosmetics.owned[id] && !d.cosmetics.seen[id]),
      settings: pwa.state.waiting,
    },
  };
}

function goTitle() {
  fx.clear();
  hud.banner = null;
  renderer.titleCard = null;
  run.reset(2026, { script: false, bestMeters: 0, loadout: currentLoadout() });
  mode = 'title';
  input.setEnabled(false);
  audio.setMenu(true); audio.setBiome(0); audio.setPaused(false);
  ui.showTitle(saveStore.data.best.distance, titleInfo());
}

function startRun(opts = {}) {
  audio.unlock();
  fx.clear();
  hud.banner = null; hud.hintAlpha = 0;
  renderer.titleCard = null;
  vis.hurt = 0;
  const tut = saveStore.data.tutorial;
  const daily = !!opts.daily;
  const seed = daily ? dailySeed(dayKey(clock.now())) : newSeed();
  run.reset(seed, {
    script: !tut.done && !daily && !startM,
    bestMeters: saveStore.data.best.distance,
    loadout: currentLoadout(daily),
    daily,
    startM,
  });
  runTrophies = []; runLooks = []; liveT = 1;
  run.begin();
  const equipped = saveStore.data.companions.equipped;
  if (equipped && run.L.companion) saveStore.data.stats.runsByCompanion[equipped] = (saveStore.data.stats.runsByCompanion[equipped] | 0) + 1;
  mode = 'running';
  ui.hideAll();
  ui.setRunning(true, !tut.done && !daily && !startM);
  input.setEnabled(true);
  qm.hiccup();
  autoTick = 0;
  ctl.hitstop = 0; ctl.slow = 0; ctl.shake = 0; ctl.flash = 0;
  audio.setMenu(false); audio.setPaused(false);
  audio.startMusic();
}

function pauseRun() {
  if (mode !== 'running' || run.state !== 'running') return;
  mode = 'paused';
  input.setEnabled(false);
  audio.setPaused(true);
  ui.showPause();
  saveStore.commit();
}

function resumeRun() {
  if (mode !== 'paused') return;
  ui.hidePause();
  mode = 'running';
  audio.setPaused(false);
  input.setEnabled(true);
  run.grace(0.8);
  qm.hiccup();
}

/** While flying: trophies measured by "best in one run" can unlock mid-flight, with a pop-up. */
function liveCheck(dt) {
  liveT -= dt;
  if (liveT > 0) return;
  liveT = 0.5;
  if (startM || run.state !== 'running') return;
  const d = saveStore.data;
  const live = {
    distM: Math.floor(run.distM), bestMult: run.stats.bestMult, seconds: run.time, seeds: run.seedsGot, hits: run.stats.hits,
    biomeCount: Math.min(BIOME_ORDER.length, Math.floor(run.p.x / 18 / BIOME.lengthM) + 1),
  };
  const got = evaluateAchievements(d, clock.now(), live);
  if (!got.length) return;
  const fresh = syncCosmetics(d);
  for (const a of got) { runTrophies.push(a); toasts.show({ title: 'Trophy earned', sub: `${a.name} · +${TIER[a.tier].embers} embers`, tier: a.tier, html: medal(a.tier) }); }
  for (const c of fresh) { runLooks.push(c); toasts.show({ title: 'New look', sub: `${SLOTS.find((sl) => sl.id === c.slot).name}: ${c.name}`, tier: 'silver', html: '' }); }
  audio.sfx('unlock');
  saveStore.commitSoon();
}

function skipTips() {
  const tut = saveStore.data.tutorial;
  tut.done = true; tut.jump = tut.slide = tut.glide = true;
  run.gen.skipScript();
  run.hintKey = '';
  ui.setTips(false);
  saveStore.commitSoon();
}

/** Runs when the sleepy animation finishes: bank everything, then show the game-over card. */
function onOver() {
  mode = 'over';
  input.setEnabled(false);
  ui.setRunning(false, false);
  audio.setMenu(true);

  const d = saveStore.data;
  const s = run.stats;
  const now = clock.now();
  const distM = Math.floor(run.distM);
  const prevBest = d.best.distance;
  const newBest = distM > prevBest;
  const xpBase = xpForRun(distM, run.seedsGot);
  const before = levelInfo(d.xp);
  d.xp += xpBase;
  d.seedsBank += run.seedsGot;                 // seeds ALWAYS bank, even on a bad run

  if (newBest) d.best.distance = distM;
  d.best.score = Math.max(d.best.score, run.score);
  d.best.combo = Math.max(d.best.combo, s.bestMult);
  d.best.seeds = Math.max(d.best.seeds, run.seedsGot);
  d.best.seconds = Math.max(d.best.seconds, Math.round(run.time));
  const st = d.stats;
  st.runs++; st.totalDistance += distM; st.totalSeeds += run.seedsGot; st.totalSeconds += Math.round(run.time);
  st.lanterns += s.lanterns; st.fireflies += s.fireflies; st.words += s.words; st.nearMisses += s.nearMisses;
  st.glideGaps += s.glideGaps; st.gaps += s.gaps; st.hits += s.hits;
  st.bestCombo = Math.max(st.bestCombo, s.bestMult);
  st.longestRun = Math.max(st.longestRun, Math.round(run.time));
  st.powerups += s.powerups; st.vinesSlid += s.vinesSlid; st.bounces += s.bounces;
  st.perfectBeats += s.perfectBeats; st.festivals += s.festivals; st.surprises += s.surprises;
  if (s.hits === 0) st.cleanBest = Math.max(st.cleanBest | 0, distM);

  // biomes visited (by id), for the "New place discovered" line
  const newPlaces = [];
  const maxK = Math.floor((run.p.x / 18) / BIOME.lengthM);
  for (let k = 0; k <= Math.min(maxK, BIOME_ORDER.length - 1); k++) {
    const id = BIOME_ORDER[k];
    if (!d.seenBiomes.includes(id)) { d.seenBiomes.push(id); if (k > 0) newPlaces.push(BIOMES[id].name); }
  }
  st.biomesSeen = d.seenBiomes.length;

  const summary = run.summary();
  const quests = applyRunToQuests(d, summary);
  const daily = run.daily ? recordDaily(d, summary, now) : null;
  const unlocked = unlockEarned(d);
  rollChest(d, { newBest, questDone: quests.completed.length > 0 || !!quests.weekly, luck: run.L.chestLuck }, Math.random);
  const after = levelInfo(d.xp);
  const trophies = runTrophies.concat(evaluateAchievements(d, now)).map((a) => ({ ...a, embers: TIER[a.tier].embers }));
  const looks = runLooks.concat(syncCosmetics(d)).map((c) => ({ ...c, slotName: SLOTS.find((sl) => sl.id === c.slot).name }));
  const persistent = saveStore.commit();

  // session time (for the gentle break note)
  sessionPlayS += run.time;
  let showBreak = false;
  if (d.settings.breakReminder && !breakShown && sessionPlayS >= BREAK_AFTER_MIN * 60) { showBreak = true; breakShown = true; }

  const titles = STRINGS['over.titles'];
  ui.showOver({
    title: run.daily ? 'Daily Run complete' : titles[Math.floor(Math.random() * titles.length)],
    distM, score: run.score, seeds: run.seedsGot, xp: xpBase,
    newBest: newBest && prevBest > 0,
    prevBestM: prevBest, levelBefore: before, levelAfter: after, persistent,
    quests: quests.completed, weekly: quests.weekly, daily, unlocked, biomes: newPlaces, trophies, looks,
    next: nextCompanion(d), chests: d.chests.pending,
  });
  if (unlocked.length || trophies.length || looks.length) audio.sfx('unlock');
  if (showBreak) { ui.showBreak(); sessionPlayS = 0; }
}

run.emit = (name, a, b) => {
  juice(name, a, b);
  if (name === 'over') onOver();
  else if (name === 'tutorial') { saveStore.commitSoon(); if (saveStore.data.tutorial.done) ui.setTips(false); }
};

/** Wardrobe preview: draw Cinder wearing `ids` into a small canvas (the shared hero is put back afterwards). */
function previewHero(cv, ids) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = cv.clientWidth; const h = cv.clientHeight;
  if (w < 4 || h < 4) return;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  vis.setLook(ids);
  const sc = Math.min(h / 128, w / 230);
  g.save(); g.translate(w * 0.5 + 14 * sc, h * 0.84); g.scale(sc, sc);
  g.fillStyle = 'rgba(0,0,0,0.38)'; g.beginPath(); g.ellipse(-16, 3, 50, 6, 0, 0, Math.PI * 2); g.fill();
  vis.draw(g, 0, 0, 0, 0, run, 'title');
  g.restore();
  vis.setLook(saveStore.data.cosmetics.equipped);
}

const ui = new UI({
  play: () => startRun(),
  again: () => startRun({ daily: run.daily }),
  home: goTitle,
  resume: resumeRun,
  restart: () => startRun({ daily: run.daily }),
  pause: pauseRun,
  skipTips,
  daily: () => startRun({ daily: true }),
  open: (name) => panels.open(name),
  chest: () => panels.open('chest'),
});
const panels = new Panels({
  saveStore, audio, haptics,
  getLuck: () => currentLoadout().chestLuck,
  previewHero,
  onChange: () => { vis.setLook(saveStore.data.cosmetics.equipped); if (mode === 'title') run.L = currentLoadout(); },
  onSettings: applySettings,
  onClose: () => { syncInstall(); if (mode === 'title') ui.refreshTitle(titleInfo()); else if (mode === 'over') ui.refreshOverChests(saveStore.data.chests.pending); },
  onDaily: () => startRun({ daily: true }),
});
input.onPause = () => { if (mode === 'running') pauseRun(); else if (mode === 'paused') resumeRun(); };
// Browsers only allow sound after a tap: unlock on the first one (and keep trying until the context runs).
for (const ev of ['pointerdown', 'touchstart', 'keydown']) window.addEventListener(ev, () => audio.unlock(), { passive: true });

// ------------------------------------------------------------------ sizing, safe areas, orientation
const probe = $('#safe-probe');
function measureSafe() {
  const cs = getComputedStyle(probe);
  return {
    top: parseFloat(cs.paddingTop) || 0, left: parseFloat(cs.paddingLeft) || 0,
    right: parseFloat(cs.paddingRight) || 0, bottom: parseFloat(cs.paddingBottom) || 0,
  };
}

function resize() {
  const r = app.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return;
  renderer.resize(r.width, r.height, window.devicePixelRatio || 1, measureSafe());
  checkOrientation();
}

function checkOrientation() {
  const landscapePhone = window.innerWidth > window.innerHeight * 1.2 && window.innerHeight < 520 &&
    window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  $('#rotate').classList.toggle('hidden', !landscapePhone);
  if (landscapePhone) pauseRun();
}

const qm = new QualityMonitor(() => {
  fx.setLimit(quality.cfg.particles);
  resize();
});

// "Install app" chip on the title (only when the browser offers it and the player has finished a run)
const btnInstall = $('#btn-install');
function syncInstall() { btnInstall.classList.toggle('hidden', !(pwa.canInstall && mode === 'title' && saveStore.data.stats.runs >= 1)); }
btnInstall.addEventListener('click', (e) => { e.preventDefault(); pwa.install().then(syncInstall); });
pwa.onChange(() => { syncInstall(); if (mode === 'title') ui.refreshTitle(titleInfo()); });

if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resize).observe(app);
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 160));
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

// ------------------------------------------------------------------ iOS/Android gesture suppression
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => { if (!e.target.closest || !e.target.closest('.scroll')) e.preventDefault(); }, { passive: false });

// ------------------------------------------------------------------ auto-pause + save on hide
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { pauseRun(); saveStore.commit(); audio.suspend(); } else { qm.hiccup(); audio.resume(); }
});
window.addEventListener('pagehide', () => saveStore.commit());
window.addEventListener('blur', () => { if (mode === 'running') pauseRun(); });

// ------------------------------------------------------------------ the loop
let fpsEma = 60;
let dbgTimer = 0;
const dbg = $('#debug');

/** Freeze the interpolation so a hit-stop shows a still frame instead of replaying the last step. */
function syncPrev() { run.prevX = run.p.x; run.prevY = run.p.y; run.prevCamX = run.camX; }

function update(dt) {
  if (mode === 'paused') return;
  fx.update(dt);
  vis.update(dt, run, mode);
  hud.update(dt, run);
  audio.update(dt);

  // ---- game-feel dials (decay, then hand to the renderer)
  const calm = saveStore.data.settings.reducedMotion;
  if (ctl.shake > 0) ctl.shake = Math.max(0, ctl.shake - dt * 2.6);
  if (ctl.flash > 0) ctl.flash = Math.max(0, ctl.flash - dt * 2.4);
  renderer.shakeX = calm || !saveStore.data.settings.shake ? 0 : (Math.random() - 0.5) * 7 * ctl.shake * ctl.shake;
  renderer.shakeY = calm || !saveStore.data.settings.shake ? 0 : (Math.random() - 0.5) * 5 * ctl.shake * ctl.shake;
  renderer.flash = ctl.flash;
  renderer.beat = audio.beat;
  const sp = run.speed || 0;
  const zoomTarget = mode === 'running' ? 1 - 0.07 * Math.max(0, Math.min(1, (sp - 240) / 230)) : 1;
  ctl.zoom += (zoomTarget - ctl.zoom) * Math.min(1, dt * 1.2);
  renderer.zoom = ctl.zoom;
  // music follows how fast and how lively the run is
  audio.setIntensity(mode === 'running' ? Math.min(1, Math.max(0, (sp - 220) / 250) * 0.75 + Math.min(0.25, (run.mult - 1) * 0.06)) : 0);

  if (mode === 'running') {
    // hit-stop: a tiny freeze on a bump
    if (ctl.hitstop > 0) { ctl.hitstop -= dt; syncPrev(); return; }
    let tick;
    if (autoplay && run.state === 'running') {
      if (autoTick++ % 3 === 0) {
        const hz = run.hazards.filter((h) => h.active && h.type !== 'gap' && h.x1 > run.p.x - 40 && h.x0 < run.p.x + 900);
        autoAct = planAction(run.courseView(900), run.p, run.baseSpeed || 250, 22) || IDLE;
        void hz;
      }
      const first = (autoTick - 1) % 3 === 0;
      tick = { press: first && autoAct.press, hold: autoAct.hold, slide: first && autoAct.slide };
    } else {
      tick = input.tick(performance.now());
    }
    // gentle slow-motion (Dozy's after-bump slow, tiny near-miss slow-down); the sim just sees a smaller dt
    let scale = 1;
    if (ctl.slow > 0) { ctl.slow -= dt; scale = 0.72; }
    if (ctl.slowPulse > 0) { ctl.slowPulse -= dt; scale = Math.min(scale, calm ? 1 : 0.85); }
    run.update(dt * scale, tick);
    if (dbgPanel && dbgPanel.state.god && run.state === 'running') run.hearts = run.maxHearts;
    liveCheck(dt);
  } else {
    run.update(dt, IDLE);
  }
}

function render(alpha, frameDt) {
  renderer.render(alpha, mode, frameDt);
  if (dbgPanel) { dbgPanel.frame(frameDt); dbgPanel.setFps(fpsEma, quality.cfg.name); }
  if (mode === 'running') qm.sample(frameDt * 1000);
  if (DEBUG || saveStore.data.settings.showFps) {
    fpsEma += ((1 / Math.max(frameDt, 0.001)) - fpsEma) * 0.05;
    dbgTimer -= frameDt;
    if (dbgTimer <= 0 && !DEBUG) { dbgTimer = 0.5; dbg.textContent = `${fpsEma.toFixed(0)} fps · ${quality.cfg.name}`; }
    else if (dbgTimer <= 0) {
      dbgTimer = 0.25;
      const hz = run.hazards.filter((h) => h.active).length;
      const pk = run.pickups.filter((h) => h.active).length;
      dbg.textContent = `fps ${fpsEma.toFixed(0)}  q:${quality.cfg.name}  dpr ${renderer.dpr}\n` +
        `mode ${mode}/${run.state}  seed ${run.seed}\nhazards ${hz}  pickups ${pk}  particles ${fx.count}\n` +
        `dist ${run.distM.toFixed(0)}m  speed ${run.speed.toFixed(0)}  hearts ${run.hearts}`;
    }
  }
}

const loop = new Loop(update, render, SIM.dt, SIM.maxSteps);

applySettings();
resize();
goTitle();
loop.start();
pwa.init();
if (DEBUG) {
  import('./ui/debug.js').then(({ mountDebug }) => {
    dbgPanel = mountDebug({
      saveStore, renderer, clock, applySettings,
      setStartM(m) { startM = m | 0; },
      toast(msg) { toasts.show({ title: 'Debug', sub: msg, html: '' }, 1800); },
      unlockAll() {
        const d = saveStore.data;
        for (const k of Object.keys(d.achievements)) if (!d.achievements[k]) d.achievements[k] = Date.now();
        for (const k of Object.keys(d.cosmetics.owned)) { if (!d.cosmetics.owned[k]) { d.cosmetics.owned[k] = true; d.cosmetics.seen[k] = false; } }
        for (const c of COMPANIONS) d.companions.owned[c.id] = true;
        saveStore.commit(); run.L = currentLoadout();
      },
    });
  });
}

// Test + debug handle (harmless in production; handy for the validator and automated tests).
window.__cozy = {
  run, fx, input, saveStore, loop, renderer,
  get mode() { return mode; },
  startRun, goTitle, pauseRun, resumeRun, audio, panels, ui, ctl, clock, applySettings, vis, hud, pwa, toasts, qm, quality,
  get sessionPlayS() { return sessionPlayS; },
  addSessionMinutes(m) { sessionPlayS += m * 60; },
  autoplay(on) { autoplay = !!on; },
  /** Advance the simulation without rendering (used by tests). */
  step(n, tick) { for (let i = 0; i < n; i++) run.update(SIM.dt, tick || IDLE); },
  async validate() {
    const [{ CHUNKS }, { validateChunk }] = await Promise.all([import('./data/chunks.js'), import('./game/solver.js')]);
    return CHUNKS.map((c) => validateChunk(c));
  },
};
void t;
