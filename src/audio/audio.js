/**
 * audio.js — every sound in Emberwing Run is synthesized here with the Web Audio API.
 * No audio files, no samples: oscillators, filtered noise and a tiny generated reverb.
 *
 *   - sfx(name, a, b)       one-shot effects (jump, seed chimes, bonks, power-ups, UI...)
 *   - music: a dark generative score per biome (see MOODS): war drums, brass-like saws, minor modes; it gets fuller as the run speeds up
 *   - ambient: a low bed of wind and rumble plus the odd distant roar, toll or thunder per biome
 *
 * Browsers only allow sound after a tap, so `unlock()` is called from the first pointer/key event.
 * Everything is safe to call before that (it just does nothing) and safe if Web Audio is missing.
 * Music and effects have their own volume and on/off switches (see setSettings).
 */
import { mulberry32 } from '../core/rng.js';

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const PENT_MIN = [0, 3, 5, 7, 10];
const PHRYG = [0, 1, 5, 7, 8];          // dark, tense (Phrygian-flavoured pentatonic)
const HARM = [0, 2, 3, 7, 8];            // harmonic-minor flavour
const CHORDS = { M: [0, 4, 7], m: [0, 3, 7], p: [0, 7, 12], d: [0, 3, 6] };

/**
 * One mood per biome. root = MIDI note of the key, chords = [semitone offset, 'M'|'m'|'p'(power)|'d'(dim)]
 * over 4 bars, lead = how melody notes sound (brass-ish saw through a low-pass), amb = ambient bed.
 */
const MOODS = [
  { id: 'meadow', root: 45, scale: PENT_MIN, tempo: 84, chords: [[0, 'p'], [-2, 'p'], [-4, 'M'], [-5, 'p']],
    lead: { type: 'sawtooth', dur: 0.55, lp: 1500, harm: 2, harmV: 0.0 }, pad: 'sawtooth', amb: { f: 380, g: 0.022 } },
  { id: 'teacup', root: 43, scale: PHRYG, tempo: 78, chords: [[0, 'm'], [1, 'M'], [0, 'm'], [-2, 'M']],
    lead: { type: 'sawtooth', dur: 0.7, lp: 1300, harm: 2, harmV: 0.0 }, pad: 'sawtooth', amb: { f: 520, g: 0.018 } },
  { id: 'grove', root: 41, scale: PENT_MIN, tempo: 72, chords: [[0, 'm'], [-2, 'M'], [-5, 'p'], [1, 'd']],
    lead: { type: 'triangle', dur: 0.5, lp: 1800, harm: 2, harmV: 0.12 }, pad: 'sawtooth', amb: { f: 220, g: 0.026 } },
  { id: 'heights', root: 47, scale: HARM, tempo: 104, chords: [[0, 'm'], [-4, 'M'], [-2, 'M'], [-5, 'm']],
    lead: { type: 'sawtooth', dur: 0.45, lp: 1900, harm: 2, harmV: 0.0 }, pad: 'sawtooth', amb: { f: 300, g: 0.028 } },
  { id: 'lake', root: 40, scale: PHRYG, tempo: 66, chords: [[0, 'm'], [1, 'M'], [-4, 'M'], [1, 'd']],
    lead: { type: 'sawtooth', dur: 0.9, lp: 1100, harm: 2, harmV: 0.0 }, pad: 'sawtooth', amb: { f: 160, g: 0.03 } },
];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ok = typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext);
    this.settings = { music: true, sfx: true, musicVol: 0.7, sfxVol: 0.9 };
    this.voices = 0;
    this.beat = 0;                   // 1 right on a beat, decays to 0 (visual pulse)
    this.intensity = 0;
    this.targetIntensity = 0;
    this.biome = 0;
    this.paused = false;
    this.musicOn = false;            // music is running (the scheduler is ticking)
    this.menu = true;                // title / game-over: quieter, sparse
    this._rng = mulberry32(777);
    this._timer = 0;
    this._nextTime = 0;
    this._step = 0;
    this._bar = 0;
    this._mood = MOODS[0];
    this._pendingMood = null;
    this._beatTimes = [];
    this._nextAmb = 0;
    this._lastMelody = 2;
    this._lastTell = {};
  }

  // ---------------------------------------------------------------- set-up
  /** Call from a user gesture. Safe to call many times. */
  unlock() {
    if (!this.ok) return;
    try {
      if (!this.ctx) this._build();
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (_) { this.ok = false; }
  }

  _build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC({ latencyHint: 'interactive' });
    this.ctx = ctx;
    this.master = ctx.createGain(); this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.2;
    this.master.connect(comp); comp.connect(ctx.destination);
    this.sfxBus = ctx.createGain(); this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain(); this.musicBus.connect(this.master);
    // a little reverb for the music (generated impulse: decaying noise)
    this.verb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 1.3);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    this.verb.buffer = ir;
    this.verbSend = ctx.createGain(); this.verbSend.gain.value = 0.32;
    this.verbSend.connect(this.verb); this.verb.connect(this.musicBus);
    // noise source for percussion, wind, whooshes
    const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;
    // ambient bed
    this.ambSrc = ctx.createBufferSource(); this.ambSrc.buffer = nb; this.ambSrc.loop = true;
    this.ambFilter = ctx.createBiquadFilter(); this.ambFilter.type = 'lowpass'; this.ambFilter.frequency.value = 500;
    this.ambGain = ctx.createGain(); this.ambGain.gain.value = 0;
    this.ambSrc.connect(this.ambFilter); this.ambFilter.connect(this.ambGain); this.ambGain.connect(this.musicBus);
    this.ambSrc.start();
    this.applySettings();
    if (this._wantMusic) this.startMusic();
  }

  setSettings(s) {
    Object.assign(this.settings, s);
    this.applySettings();
  }

  applySettings() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const sfxV = this.settings.sfx ? this.settings.sfxVol : 0;
    const musV = this.settings.music ? this.settings.musicVol * 0.55 * (this.menu ? 0.8 : 1) * (this.paused ? 0.12 : 1) : 0;
    this.sfxBus.gain.setTargetAtTime(sfxV * 0.9, t, 0.03);
    this.musicBus.gain.setTargetAtTime(musV, t, 0.25);
    if (!this.settings.music && this.musicOn) this._stopScheduler();
    else if (this.settings.music && this._wantMusic && !this.musicOn) this._startScheduler();
  }

  /** Tab hidden / shown: save battery by suspending the whole audio context. */
  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  // ---------------------------------------------------------------- tiny synth parts
  _ok() { return this.ctx && this.ctx.state !== 'closed'; }

  /** One enveloped oscillator note. bus: 'sfx' | 'music'. */
  _tone(freq, dur, o = {}) {
    if (!this._ok()) return;
    if (this.voices > 30 && !o.force) return;
    const ctx = this.ctx;
    const t0 = (o.when ?? ctx.currentTime) + 0.002;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + dur * (o.toT ?? 0.9));
    if (o.vib) {
      const lfo = ctx.createOscillator(); const lg = ctx.createGain();
      lfo.frequency.value = o.vib; lg.gain.value = freq * 0.04;
      lfo.connect(lg); lg.connect(osc.frequency); lfo.start(t0); lfo.stop(t0 + dur + 0.1);
    }
    const vol = o.vol ?? 0.15;
    const a = o.attack ?? 0.006;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    let tail = g;
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; g.connect(f); tail = f; }
    tail.connect(o.bus === 'music' ? this.musicBus : this.sfxBus);
    if (o.bus === 'music' && o.verb !== false) tail.connect(this.verbSend);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
    this.voices++;
    osc.onended = () => { this.voices--; try { g.disconnect(); } catch (_) { /* gone */ } };
  }

  _noise(dur, o = {}) {
    if (!this._ok() || !this.noiseBuf) return;
    if (this.voices > 30 && !o.force) return;
    const ctx = this.ctx;
    const t0 = (o.when ?? ctx.currentTime) + 0.002;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = o.filter || 'bandpass';
    f.frequency.setValueAtTime(o.f0 ?? 1000, t0);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t0 + dur);
    f.Q.value = o.q ?? 1;
    const g = ctx.createGain();
    const vol = o.vol ?? 0.1;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + (o.attack ?? 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(o.bus === 'music' ? this.musicBus : this.sfxBus);
    src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.05);
    this.voices++;
    src.onended = () => { this.voices--; try { g.disconnect(); } catch (_) { /* gone */ } };
  }

  /** A little bell: fundamental + inharmonic overtone, long decay. */
  _bell(freq, dur = 0.7, vol = 0.12, when) {
    this._tone(freq, dur, { vol, type: 'sine', when });
    this._tone(freq * 2.76, dur * 0.5, { vol: vol * 0.35, type: 'sine', when });
  }

  /** A big gong: low fundamental plus inharmonic partials, long ring. */
  _gong(freq, vol = 0.14, when) {
    this._tone(freq, 2.4, { vol, type: 'sine', when, attack: 0.012 });
    this._tone(freq * 1.5, 1.8, { vol: vol * 0.5, type: 'sine', when });
    this._tone(freq * 2.76, 1.2, { vol: vol * 0.35, type: 'sine', when });
    this._tone(freq * 4.1, 0.7, { vol: vol * 0.18, type: 'sine', when });
    this._noise(0.25, { filter: 'bandpass', f0: freq * 6, q: 0.7, vol: vol * 0.25, when });
  }

  /** A short metal strike (anvil / shield clang). */
  _clang(freq = 520, vol = 0.12, when) {
    this._tone(freq, 0.32, { vol, type: 'square', when, lp: 3200 });
    this._tone(freq * 2.43, 0.22, { vol: vol * 0.45, type: 'sine', when });
    this._tone(freq * 3.8, 0.14, { vol: vol * 0.25, type: 'sine', when });
    this._noise(0.05, { filter: 'highpass', f0: 4000, vol: vol * 0.3, when });
  }

  /** A brass-like note (sawtooth through a low-pass). */
  _horn(freq, dur = 0.5, vol = 0.09, when) {
    this._tone(freq, dur, { vol, type: 'sawtooth', when, lp: Math.min(2400, freq * 5), attack: 0.03 });
  }

  _arp(base, steps, gap, o = {}) {
    if (!this._ok()) return;
    const t = this.ctx.currentTime;
    steps.forEach((s, i) => this._tone(mtof(base + s), o.dur ?? 0.25, { ...o, when: t + i * gap }));
  }

  // ---------------------------------------------------------------- sound effects
  /** Play a named effect. a, b are the same arguments the game event carries (e.g. chain count). */
  sfx(name, a, b) {
    if (!this._ok() || !this.settings.sfx || this.paused) return;
    switch (name) {
      case 'jump': this._tone(150, 0.16, { type: 'sawtooth', to: 360, vol: 0.12, lp: 1400 }); this._noise(0.1, { f0: 900, f1: 1800, q: 0.7, vol: 0.06 }); break;
      case 'airjump': this._noise(0.16, { f0: 700, f1: 2000, q: 0.8, vol: 0.1 }); this._tone(260, 0.12, { type: 'sawtooth', to: 520, vol: 0.07, lp: 1500 }); break;
      case 'glide': this._noise(0.34, { f0: 350, f1: 900, q: 0.8, vol: 0.07 }); this._tone(120, 0.3, { type: 'sawtooth', to: 150, vol: 0.04, lp: 500 }); break;
      case 'slide': this._noise(0.26, { filter: 'lowpass', f0: 1800, f1: 250, vol: 0.14 }); this._tone(90, 0.2, { type: 'sawtooth', to: 60, vol: 0.06, lp: 400 }); break;
      case 'land': {
        const k = Math.min(1, (a || 300) / 900);
        this._tone(120, 0.14, { type: 'sine', to: 45, vol: 0.14 + 0.16 * k });
        this._noise(0.09, { filter: 'lowpass', f0: 700, vol: 0.05 + 0.06 * k });
        break;
      }
      case 'seed': {                                       // ember pickup: a bright crackling spark that still climbs with the chain
        const idx = (a && a.var === 1) ? 5 : Math.min(7, Math.max(0, ((b || 1) - 1) % 8));
        const semis = [0, 2, 3, 7, 8, 12, 14, 15][idx];
        this._tone(mtof(69 + semis), 0.14, { type: 'square', vol: 0.06, lp: 3000 });
        this._tone(mtof(81 + semis), 0.08, { type: 'triangle', vol: 0.04 });
        this._noise(0.04, { filter: 'highpass', f0: 5000, vol: 0.03 });
        break;
      }
      case 'lantern': this._noise(0.4, { filter: 'lowpass', f0: 300, f1: 2400, q: 0.8, vol: 0.16, attack: 0.04 }); this._tone(110, 0.4, { type: 'sawtooth', to: 220, vol: 0.1, lp: 700 }); break;
      case 'firefly': this._arp(74, [0, 3, 7, 12, 15], 0.06, { type: 'sawtooth', vol: 0.07, dur: 0.3, lp: 2600 }); this._tone(1300, 0.34, { type: 'sawtooth', to: 2500, vol: 0.04, lp: 3000 }); break;
      case 'letter': this._clang(660, 0.09); break;
      case 'word': this._arp(62, [0, 3, 7, 12, 15, 19], 0.07, { type: 'sawtooth', vol: 0.09, dur: 0.45, lp: 2400 }); this._gong(98, 0.1); break;
      case 'heart': this._arp(64, [0, 3, 7], 0.08, { type: 'sawtooth', vol: 0.07, dur: 0.35, lp: 2200 }); break;
      case 'teabonus': this._arp(72, [0, 7], 0.06, { type: 'square', vol: 0.05, dur: 0.2, lp: 2600 }); break;
      case 'hit':
        this._tone(170, 0.3, { type: 'sawtooth', to: 55, vol: 0.18, lp: 900 });
        this._noise(0.16, { filter: 'lowpass', f0: 1100, vol: 0.14 });
        this._clang(300, 0.07);
        break;
      case 'fall': this._tone(320, 0.7, { type: 'sawtooth', to: 55, vol: 0.12, lp: 900, vib: 6 }); this._noise(0.4, { filter: 'lowpass', f0: 900, f1: 200, vol: 0.06 }); break;
      case 'bubblepop': this._clang(380, 0.12); this._noise(0.12, { filter: 'highpass', f0: 2500, vol: 0.06 }); break;
      case 'dying': this._arp(50, [0, -1, -5, -12], 0.24, { type: 'sawtooth', vol: 0.1, dur: 0.75, lp: 700 }); this._gong(73, 0.1); break;
      case 'power': {
        const base = { honey: 64, hop: 67, dash: 60, burst: 72, blanket: 57 }[a] || 64;
        this._arp(base, [0, 3, 7, 12, 15], 0.05, { type: 'sawtooth', vol: 0.08, dur: 0.3, lp: 2600 });
        if (a === 'dash') this._noise(0.3, { filter: 'lowpass', f0: 400, f1: 2400, vol: 0.12, attack: 0.05 });
        if (a === 'burst') this._noise(0.5, { filter: 'lowpass', f0: 300, f1: 3000, vol: 0.15, attack: 0.05 });
        break;
      }
      case 'powerwarn': this._tone(600, 0.06, { type: 'square', vol: 0.04, lp: 2000 }); this._tone(600, 0.06, { type: 'square', vol: 0.04, lp: 2000, when: this.ctx.currentTime + 0.12 }); break;
      case 'powerend': this._tone(360, 0.25, { type: 'sawtooth', to: 140, vol: 0.07, lp: 900 }); break;
      case 'blanket': this._clang(260, 0.16); this._tone(90, 0.3, { type: 'sine', to: 50, vol: 0.14 }); break;
      case 'convert': this._noise(0.35, { filter: 'highpass', f0: 3500, vol: 0.06 }); this._tone(900, 0.25, { type: 'sawtooth', to: 400, vol: 0.04, lp: 2000 }); break;
      case 'bounce': this._noise(0.4, { filter: 'bandpass', f0: 500, f1: 2600, q: 0.8, vol: 0.17, attack: 0.02 }); this._tone(110, 0.4, { type: 'sawtooth', to: 380, vol: 0.1, lp: 800 }); break;
      case 'zone':
        if (a === 'fluff') this._noise(0.5, { f0: 500, f1: 300, q: 0.7, vol: 0.07 });
        else if (a === 'gustTail' || a === 'gustHead') this._noise(0.8, { f0: 250, f1: 1100, q: 1.2, vol: 0.1, attack: 0.25 });
        else if (a === 'fog') this._tone(70, 0.7, { type: 'sawtooth', vol: 0.06, lp: 300, attack: 0.2 });
        break;
      case 'multup': this._clang(560 + ((a || 2) - 2) * 40, 0.07); break;
      case 'nearmiss': this._noise(0.14, { filter: 'highpass', f0: 2600, f1: 5500, vol: 0.09 }); this._tone(1400, 0.1, { type: 'sine', vol: 0.05 }); break;
      case 'newbest': this._arp(57, [0, 3, 7, 12, 7, 12, 15], 0.09, { type: 'sawtooth', vol: 0.1, dur: 0.45, lp: 2400 }); this._gong(110, 0.12); break;
      case 'beat': this._tone(100, 0.14, { type: 'sine', to: 55, vol: 0.12 }); this._tone(760, 0.04, { type: 'square', vol: 0.03, lp: 1800 }); break;
      case 'perfect': this._clang(700 + (a || 0) * 40, 0.1); this._tone(90, 0.12, { type: 'sine', to: 50, vol: 0.1 }); break;
      case 'festival': this._horn(mtof(45), 0.9, 0.1); this._horn(mtof(52), 0.9, 0.08, this.ctx.currentTime + 0.1); break;
      case 'festivaldone': this._arp(57, [0, 7, 12, 15, 19, 24], 0.08, { type: 'sawtooth', vol: 0.1, dur: 0.5, lp: 2600 }); this._gong(98, 0.1); break;
      case 'biome': this._gong(82, 0.16); this._horn(mtof(45), 1.2, 0.07, this.ctx.currentTime + 0.1); this._horn(mtof(52), 1.4, 0.06, this.ctx.currentTime + 0.3); break;
      case 'surprise': this._arp(69, [0, 3, 7, 10, 15], 0.06, { type: 'sawtooth', vol: 0.06, dur: 0.35, lp: 2600 }); break;
      case 'tell': this._tell(a); break;
      case 'ui': this._tone(420, 0.06, { type: 'square', vol: 0.05, lp: 1800 }); this._tone(90, 0.08, { type: 'sine', vol: 0.06 }); break;
      case 'back': this._tone(280, 0.08, { type: 'square', vol: 0.045, lp: 1400 }); break;
      case 'buy': this._clang(880, 0.09); this._clang(1170, 0.07, this.ctx.currentTime + 0.07); break;
      case 'deny': this._tone(110, 0.18, { type: 'sawtooth', vol: 0.08, lp: 500 }); break;
      case 'equip': this._arp(55, [0, 7], 0.09, { type: 'sawtooth', vol: 0.08, dur: 0.3, lp: 1800 }); this._clang(440, 0.06); break;
      case 'unlock': this._arp(55, [0, 3, 7, 12, 15, 19, 24], 0.08, { type: 'sawtooth', vol: 0.1, dur: 0.5, lp: 2600 }); this._gong(98, 0.1); break;
      case 'chestshake': this._noise(0.14, { filter: 'lowpass', f0: 400, vol: 0.12 }); this._tone(90, 0.12, { type: 'sawtooth', vol: 0.08, lp: 400 }); break;
      case 'chestopen': {
        const n = { common: [0, 7], uncommon: [0, 3, 7, 12], rare: [0, 3, 7, 12, 15, 19], legendary: [0, 3, 7, 12, 15, 19, 24, 27] }[a] || [0, 7];
        this._arp(55, n, 0.085, { type: 'sawtooth', vol: 0.1, dur: 0.55, lp: 2600 });
        this._noise(0.5, { f0: 300, f1: 3000, filter: 'lowpass', vol: 0.12, attack: 0.1 });
        if (a === 'legendary' || a === 'rare') this._gong(73, 0.12);
        break;
      }
      default:
    }
  }

  /** The audible "tell" for an approaching hazard: quiet, distinct, never alarming. */
  _tell(kind) {
    const now = this.ctx.currentTime;
    if (this._lastTell[kind] && now - this._lastTell[kind] < 0.25) return;
    this._lastTell[kind] = now;
    switch (kind) {
      case 'snail': this._tone(98, 0.2, { type: 'sawtooth', vol: 0.07, lp: 420 }); this._tone(82, 0.24, { type: 'sawtooth', vol: 0.06, lp: 380, when: now + 0.1 }); break;
      case 'vine': this._noise(0.05, { filter: 'highpass', f0: 3500, vol: 0.06 }); this._noise(0.05, { filter: 'highpass', f0: 3000, vol: 0.05, when: now + 0.07 }); this._tone(1100, 0.08, { type: 'square', vol: 0.025, lp: 2400, when: now + 0.03 }); break;
      case 'gap': this._noise(0.35, { f0: 200, f1: 420, q: 1.5, vol: 0.06, attack: 0.15 }); this._tone(60, 0.4, { type: 'sawtooth', vol: 0.05, lp: 260, attack: 0.1 }); break;
      case 'drop': this._tone(1500, 0.16, { type: 'sine', to: 800, vol: 0.05 }); break;
      case 'pad': this._noise(0.16, { filter: 'bandpass', f0: 1200, q: 0.8, vol: 0.05 }); break;
      default:
    }
  }

  // ---------------------------------------------------------------- music
  /** Begin the score (safe to call before unlock: it starts as soon as audio is ready). */
  startMusic() {
    this._wantMusic = true;
    if (!this.ctx || !this.settings.music || this.musicOn) return;
    this._startScheduler();
  }

  stopMusic() {
    this._wantMusic = false;
    this._stopScheduler();
  }

  _startScheduler() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    this._nextTime = this.ctx.currentTime + 0.08;
    this._step = 0;
    this._timer = setInterval(() => this._schedule(), 25);
    this.applySettings();
  }

  _stopScheduler() {
    this.musicOn = false;
    clearInterval(this._timer);
    this._timer = 0;
  }

  /** 0..4: which biome's mood to play (takes effect at the next bar line). */
  setBiome(idx) {
    this.biome = idx;
    this._pendingMood = MOODS[idx % MOODS.length];
    if (this.ctx && this.ambFilter && !this.musicOn) this._applyAmbient(this._pendingMood);
  }

  /** 0 (calm) .. 1 (full): the run's speed and combo. */
  setIntensity(x) { this.targetIntensity = Math.max(0, Math.min(1, x)); }

  /** Title / game over: quieter, sparser music. */
  setMenu(on) { this.menu = on; if (on) this.targetIntensity = 0; this.applySettings(); }

  /** Pause: duck to a whisper and stop scheduling. */
  setPaused(on) {
    if (this.paused === on) return;
    this.paused = on;
    if (!on && this.ctx) this._nextTime = Math.max(this._nextTime, this.ctx.currentTime + 0.05);
    this.applySettings();
  }

  _applyAmbient(m) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.ambFilter.frequency.setTargetAtTime(m.amb.f, t, 1.2);
    this.ambGain.gain.setTargetAtTime(m.amb.g, t, 1.2);
  }

  /** Per-frame: decay the beat pulse, glide intensity, fire visual beats. */
  update(dt) {
    this.intensity += (this.targetIntensity - this.intensity) * Math.min(1, dt * 0.8);
    if (this.beat > 0) this.beat = Math.max(0, this.beat - dt * 3.2);
    if (this.ctx && this._beatTimes.length) {
      const now = this.ctx.currentTime;
      while (this._beatTimes.length && this._beatTimes[0] <= now) { this._beatTimes.shift(); this.beat = 1; }
    }
  }

  _schedule() {
    if (!this.ctx || this.paused || this.ctx.state !== 'running') return;
    const horizon = this.ctx.currentTime + 0.14;
    let guard = 0;
    while (this._nextTime < horizon && guard++ < 8) {
      this._scheduleStep(this._nextTime, this._step);
      const tempo = this._mood.tempo * (1 + 0.1 * this.intensity);
      this._nextTime += 60 / tempo / 2;
      this._step = (this._step + 1) % 8;
      if (this._step === 0) this._bar++;
    }
  }

  _scheduleStep(t, i) {
    if (i === 0 && this._pendingMood && this._pendingMood !== this._mood) {
      this._mood = this._pendingMood;
      this._applyAmbient(this._mood);
    }
    if (i === 0 && !this._ambStarted) { this._ambStarted = true; this._applyAmbient(this._mood); }
    const m = this._mood;
    const x = this.intensity;
    const rng = this._rng;
    const q = this.menu ? 0.7 : 1;
    const chord = m.chords[this._bar % 4];
    const rootM = m.root + chord[0];
    const tri = CHORDS[chord[1]] || CHORDS.m;
    const stepLen = 60 / (m.tempo * (1 + 0.1 * x)) / 2;

    if (i % 2 === 0) this._beatTimes.push(t);

    // pad: a dark, brooding chord every bar (saw through a low-pass: reads as strings / low brass)
    if (i === 0) {
      for (let k = 0; k < 3; k++) {
        this._tone(mtof(rootM + 12 + tri[k]), stepLen * 8 * 1.05, { when: t, type: m.pad, vol: 0.026 * q, attack: 0.7, bus: 'music', lp: 800, force: true });
      }
    }
    // bass: a growling root on beats 1 and 3 (an octave up from the sub so phone speakers can play it)
    if ((i === 0 || i === 4) && x > 0.2 && !this.menu) {
      this._tone(mtof(rootM), stepLen * 3.2, { when: t, type: 'sawtooth', vol: 0.075, attack: 0.015, bus: 'music', verb: false, lp: 380, force: true });
    }
    // melody: a gentle random walk on the pentatonic scale
    const rest = this.menu ? 0.55 : 0.4 - 0.15 * x;
    if ((i % 2 === 0 || x > 0.5) && rng() > rest) {
      this._lastMelody = Math.max(0, Math.min(9, this._lastMelody + [-2, -1, -1, 0, 1, 1, 2][Math.floor(rng() * 7)]));
      const deg = this._lastMelody;
      const note = m.root + 12 + m.scale[deg % 5] + 12 * Math.floor(deg / 5) + (chord[0] % 12 === 0 ? 0 : 0);
      this._tone(mtof(note), m.lead.dur, { when: t, type: m.lead.type, vol: 0.055 * q, attack: 0.03, bus: 'music', lp: m.lead.lp, force: true });
      if (m.lead.harmV > 0) this._tone(mtof(note) * m.lead.harm, m.lead.dur * 0.4, { when: t, type: 'sine', vol: 0.055 * q * m.lead.harmV, bus: 'music', force: true });
    }
    if (this.menu) return;
    // war drums: a deep thud on 1 and 3 early, a second tom on the "and" of 2 and a snappy rim when things get lively
    if (x > 0.15 && (i === 0 || i === 4)) {
      this._tone(105, 0.24, { when: t, type: 'sine', to: 40, vol: 0.2, bus: 'music', verb: false, force: true });
      this._noise(0.06, { when: t, f0: 400, filter: 'lowpass', vol: 0.07, bus: 'music', force: true });
    }
    if (x > 0.45 && i === 3) this._tone(140, 0.18, { when: t, type: 'sine', to: 70, vol: 0.12, bus: 'music', verb: false, force: true });
    if (x > 0.58 && (i === 2 || i === 6)) { this._tone(190, 0.12, { when: t, type: 'triangle', to: 100, vol: 0.09, bus: 'music', verb: false, force: true }); this._noise(0.07, { when: t, f0: 2200, filter: 'bandpass', q: 0.8, vol: 0.05, bus: 'music', force: true }); }
    if (x > 0.5 && i % 2 === 1) this._noise(0.04, { when: t, f0: 6000, filter: 'highpass', vol: 0.018 * x, bus: 'music', force: true });
    // anvil clang on the last beat of every other bar at speed
    if (x > 0.7 && i === 6 && (this._bar & 1)) this._clang(mtof(rootM + 24), 0.045, t);
    // driving low ostinato at full tilt
    if (x > 0.78 && i % 2 === 1) this._tone(mtof(rootM + 12 + tri[(i >> 1) % 3]), 0.16, { when: t, type: 'sawtooth', vol: 0.03, bus: 'music', lp: 1000, verb: false, force: true });

    // ambient moments (a bird, a bell, a frog...) every so often
    if (t > this._nextAmb) {
      this._nextAmb = t + 4 + rng() * 7;
      this._ambientEvent(m.id, t, rng);
    }
  }

  _ambientEvent(id, t, rng) {
    switch (id) {
      case 'meadow': {   // a distant dragon roar now and then, otherwise a low wind moan
        if (rng() < 0.3) {
          this._tone(95, 1.3, { when: t, type: 'sawtooth', to: 52, vol: 0.05, bus: 'music', lp: 380, vib: 9, force: true });
          this._noise(1.0, { when: t, filter: 'lowpass', f0: 500, f1: 150, vol: 0.04, bus: 'music', force: true });
        } else this._noise(1.2, { when: t, filter: 'bandpass', f0: 300, f1: 520, q: 2, vol: 0.03, attack: 0.5, bus: 'music', force: true });
        break;
      }
      case 'teacup': this._gong(131, 0.05, t); break;                                                        // a far-off iron bell toll
      case 'grove': this._tone(70, 0.12, { when: t, type: 'sine', to: 140, vol: 0.07, bus: 'music', force: true }); this._noise(0.08, { when: t, filter: 'highpass', f0: 3000, vol: 0.02, bus: 'music', force: true }); break;   // a drip echoing in the cavern
      case 'heights': this._noise(2.2, { when: t, filter: 'lowpass', f0: 280, f1: 90, vol: 0.09, attack: 0.3, bus: 'music', force: true }); break;       // thunder
      case 'lake': this._tone(85, 0.18, { when: t, type: 'sine', to: 170, vol: 0.07, bus: 'music', force: true }); this._noise(0.5, { when: t + 0.1, filter: 'highpass', f0: 2500, vol: 0.02, bus: 'music', force: true }); break;   // lava bubble and hiss
      default:
    }
  }
}

/** One shared engine for the whole game. */
export const audio = new AudioEngine();
