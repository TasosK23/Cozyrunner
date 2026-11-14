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
import { quality, QualityMonitor } from './core/quality.js';
import { Run } from './game/world.js';
import { createJuice } from './game/juice.js';
import { xpForRun, levelInfo } from './game/progress.js';
import { planAction } from './game/solver.js';
import { FX } from './render/fx.js';
import { BrambleVisual } from './render/bramble.js';
import { Hud } from './render/hud.js';
import { Renderer } from './render/renderer.js';
import { UI } from './ui/ui.js';
import { t, STRINGS } from './data/strings.js';
import { VERSION } from './data/meta.js';
import { SIM } from './data/balance.js';

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');

// ------------------------------------------------------------------ core objects
const saveStore = new SaveStore();
saveStore.load();
haptics.enabled = !!saveStore.data.settings.haptics;

const app = $('#app');
const canvas = $('#game');
const fx = new FX();
const run = new Run(saveStore.data.tutorial);
const vis = new BrambleVisual();
const hud = new Hud();
const renderer = new Renderer(canvas, run, fx, vis, hud);
const juice = createJuice({ run, fx, vis, hud });
const input = new Input(canvas);
const IDLE = { press: false, hold: false, slide: false };

let mode = 'title';          // title | running | paused | over
let autoplay = false;        // debug autopilot
let autoTick = 0;
let autoAct = IDLE;

$('#ver').textContent = `v${VERSION}`;

// ------------------------------------------------------------------ run lifecycle
function newSeed() { return ((Date.now() ^ Math.floor(Math.random() * 4294967296)) >>> 0) || 1; }

function goTitle() {
  fx.clear();
  hud.banner = null;
  run.reset(2026, { script: false, bestMeters: 0 });
  mode = 'title';
  input.setEnabled(false);
  ui.showTitle(saveStore.data.best.distance);
}

function startRun() {
  fx.clear();
  hud.banner = null; hud.hintAlpha = 0;
  vis.hurt = 0;
  const tut = saveStore.data.tutorial;
  run.reset(newSeed(), { script: !tut.done, bestMeters: saveStore.data.best.distance });
  run.begin();
  mode = 'running';
  ui.hideAll();
  ui.setRunning(true, !tut.done);
  input.setEnabled(true);
  qm.hiccup();
  autoTick = 0;
}

function pauseRun() {
  if (mode !== 'running' || run.state !== 'running') return;
  mode = 'paused';
  input.setEnabled(false);
  ui.showPause();
  saveStore.commit();
}

function resumeRun() {
  if (mode !== 'paused') return;
  ui.hidePause();
  mode = 'running';
  input.setEnabled(true);
  run.grace(0.8);
  qm.hiccup();
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

  const d = saveStore.data;
  const s = run.stats;
  const distM = Math.floor(run.distM);
  const prevBest = d.best.distance;
  const newBest = distM > prevBest;
  const xp = xpForRun(distM, run.seedsGot);
  const before = levelInfo(d.xp);
  d.xp += xp;
  d.seedsBank += run.seedsGot;                 // seeds ALWAYS bank, even on a bad run
  const after = levelInfo(d.xp);

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
  const persistent = saveStore.commit();

  const titles = STRINGS['over.titles'];
  ui.showOver({
    title: titles[Math.floor(Math.random() * titles.length)],
    distM, score: run.score, seeds: run.seedsGot, xp,
    newBest: newBest && prevBest > 0 || (newBest && run.newBest),
    prevBestM: prevBest, levelBefore: before, levelAfter: after, persistent,
  });
}

run.emit = (name, a, b) => {
  juice(name, a, b);
  if (name === 'over') onOver();
  else if (name === 'tutorial') { saveStore.commitSoon(); if (saveStore.data.tutorial.done) ui.setTips(false); }
};

const ui = new UI({
  play: startRun,
  again: startRun,
  home: goTitle,
  resume: resumeRun,
  restart: startRun,
  pause: pauseRun,
  skipTips,
});
input.onPause = () => { if (mode === 'running') pauseRun(); else if (mode === 'paused') resumeRun(); };

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
  if (document.hidden) { pauseRun(); saveStore.commit(); } else qm.hiccup();
});
window.addEventListener('pagehide', () => saveStore.commit());
window.addEventListener('blur', () => { if (mode === 'running') pauseRun(); });

// ------------------------------------------------------------------ the loop
let fpsEma = 60;
let dbgTimer = 0;
const dbg = $('#debug');
if (DEBUG) dbg.classList.remove('hidden');

function update(dt) {
  if (mode === 'paused') return;
  fx.update(dt);
  vis.update(dt, run, mode);
  hud.update(dt, run);

  if (mode === 'running') {
    let tick;
    if (autoplay && run.state === 'running') {
      if (autoTick++ % 3 === 0) {
        const hz = run.hazards.filter((h) => h.active && h.type !== 'gap' && h.x1 > run.p.x - 40 && h.x0 < run.p.x + 900);
        autoAct = planAction({ hazards: hz, groundAt: run.groundFn }, run.p, run.speed || 250, 22) || IDLE;
      }
      const first = (autoTick - 1) % 3 === 0;
      tick = { press: first && autoAct.press, hold: autoAct.hold, slide: first && autoAct.slide };
    } else {
      tick = input.tick(performance.now());
    }
    run.update(dt, tick);
  } else {
    run.update(dt, IDLE);
  }
}

function render(alpha, frameDt) {
  renderer.render(alpha, mode, frameDt);
  if (mode === 'running') qm.sample(frameDt * 1000);
  if (DEBUG) {
    fpsEma += ((1 / Math.max(frameDt, 0.001)) - fpsEma) * 0.05;
    dbgTimer -= frameDt;
    if (dbgTimer <= 0) {
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

resize();
goTitle();
loop.start();

// Test + debug handle (harmless in production; handy for the validator and automated tests).
window.__cozy = {
  run, fx, input, saveStore, loop, renderer,
  get mode() { return mode; },
  startRun, goTitle, pauseRun, resumeRun,
  autoplay(on) { autoplay = !!on; },
  /** Advance the simulation without rendering (used by tests). */
  step(n, tick) { for (let i = 0; i < n; i++) run.update(SIM.dt, tick || IDLE); },
  async validate() {
    const [{ CHUNKS }, { validateChunk }] = await Promise.all([import('./data/chunks.js'), import('./game/solver.js')]);
    return CHUNKS.map((c) => validateChunk(c));
  },
};
void t;
