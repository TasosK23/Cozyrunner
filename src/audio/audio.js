/**
 * audio.js — every sound in Lanternfold Run is synthesized here with the Web Audio API.
 * No audio files, no samples: oscillators, filtered noise and a tiny generated reverb.
 *
 *   - sfx(name, a, b)       one-shot effects (jump, seed chimes, bonks, power-ups, UI...)
 *   - music: a generative score per biome (see MOODS) that gets fuller as the run speeds up
 *   - ambient: a soft bed of wind/water plus the odd bird, bell or frog per biome
 *
 * Browsers only allow sound after a tap, so `unlock()` is called from the first pointer/key event.
 * Everything is safe to call before that (it just does nothing) and safe if Web Audio is missing.
 * Music and effects have their own volume and on/off switches (see setSettings).
 */
import { mulberry32 } from '../core/rng.js';

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const PENT_MAJ = [0, 2, 4, 7, 9];
const PENT_MIN = [0, 3, 5, 7, 10];

/**
 * One mood per biome. root = MIDI note of the key, chords = [semitone offset, 'M'|'m'] over 4 bars,
 * lead = how melody notes sound, amb = ambient bed (filter freq, level).
 */
const MOODS = [
  { id: 'meadow', root: 60, scale: PENT_MAJ, tempo: 92, chords: [[0, 'M'], [-3, 'm'], [-7, 'M'], [-5, 'M']],
    lead: { type: 'triangle', dur: 0.5, harm: 2, harmV: 0.25 }, pad: 'triangle', amb: { f: 500, g: 0.012 } },
  { id: 'teacup', root: 53, scale: PENT_MAJ, tempo: 84, chords: [[0, 'M'], [7, 'M'], [-3, 'm'], [5, 'M']],
    lead: { type: 'sine', dur: 0.7, harm: 3, harmV: 0.3 }, pad: 'sine', amb: { f: 900, g: 0.008 } },
  { id: 'grove', root: 50, scale: PENT_MIN, tempo: 88, chords: [[0, 'm'], [-4, 'M'], [3, 'M'], [-2, 'M']],
    lead: { type: 'sine', dur: 0.4, harm: 4, harmV: 0.18 }, pad: 'triangle', amb: { f: 700, g: 0.014 } },
  { id: 'heights', root: 55, scale: PENT_MAJ, tempo: 100, chords: [[0, 'M'], [2, 'M'], [-3, 'm'], [-5, 'M']],
    lead: { type: 'sine', dur: 0.9, harm: 2, harmV: 0.35 }, pad: 'triangle', amb: { f: 350, g: 0.02 } },
  { id: 'lake', root: 57, scale: PENT_MIN, tempo: 72, chords: [[0, 'm'], [-4, 'M'], [3, 'M'], [-2, 'M']],
    lead: { type: 'sine', dur: 1.1, harm: 2, harmV: 0.4 }, pad: 'sine', amb: { f: 260, g: 0.016 } },
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
      case 'jump': this._tone(300, 0.14, { type: 'triangle', to: 600, vol: 0.16 }); break;
      case 'airjump': this._tone(520, 0.12, { type: 'sine', to: 900, vol: 0.14 }); this._noise(0.1, { f0: 2500, filter: 'highpass', vol: 0.03 }); break;
      case 'glide': this._noise(0.28, { f0: 700, f1: 1200, q: 0.8, vol: 0.05 }); this._tone(440, 0.22, { type: 'sine', to: 520, vol: 0.05 }); break;
      case 'slide': this._noise(0.24, { filter: 'lowpass', f0: 1400, f1: 300, vol: 0.13 }); break;
      case 'land': {
        const k = Math.min(1, (a || 300) / 900);
        this._tone(140, 0.12, { type: 'sine', to: 60, vol: 0.12 + 0.14 * k });
        this._noise(0.07, { filter: 'lowpass', f0: 800, vol: 0.04 + 0.05 * k });
        break;
      }
      case 'seed': {
        const idx = (a && a.var === 1) ? 5 : Math.min(7, Math.max(0, ((b || 1) - 1) % 8));
        const semis = [0, 2, 4, 7, 9, 12, 14, 16][idx];
        this._tone(mtof(72 + semis), 0.16, { type: 'sine', vol: 0.12 });
        this._tone(mtof(84 + semis), 0.09, { type: 'triangle', vol: 0.04 });
        break;
      }
      case 'lantern': this._bell(660, 0.8, 0.13); this._bell(990, 0.6, 0.07, this.ctx.currentTime + 0.06); break;
      case 'firefly': this._arp(84, [0, 4, 7, 12, 16], 0.06, { type: 'sine', vol: 0.11, dur: 0.3 }); break;
      case 'letter': this._arp(76, [0, 7], 0.07, { type: 'triangle', vol: 0.13, dur: 0.3 }); break;
      case 'word': this._arp(72, [0, 4, 7, 12, 16, 19], 0.07, { type: 'triangle', vol: 0.14, dur: 0.45 }); break;
      case 'heart': this._arp(72, [0, 4, 7], 0.08, { type: 'sine', vol: 0.13, dur: 0.35 }); break;
      case 'teabonus': this._arp(79, [0, 7], 0.06, { type: 'sine', vol: 0.1, dur: 0.25 }); break;
      case 'hit':
        this._tone(190, 0.28, { type: 'triangle', to: 70, vol: 0.2 });
        this._noise(0.12, { filter: 'lowpass', f0: 900, vol: 0.12 });
        break;
      case 'fall': this._tone(620, 0.55, { type: 'sine', to: 160, vol: 0.14, vib: 7 }); break;
      case 'bubblepop': this._tone(400, 0.12, { type: 'sine', to: 950, vol: 0.14 }); break;
      case 'dying': this._arp(67, [0, -2, -5, -9], 0.22, { type: 'sine', vol: 0.12, dur: 0.6 }); break;
      case 'power': {
        const base = { honey: 76, hop: 79, dash: 72, burst: 84, blanket: 69 }[a] || 76;
        this._arp(base, [0, 4, 7, 12, 16], 0.05, { type: 'triangle', vol: 0.13, dur: 0.3 });
        break;
      }
      case 'powerwarn': this._tone(880, 0.06, { type: 'triangle', vol: 0.07 }); this._tone(880, 0.06, { type: 'triangle', vol: 0.07, when: this.ctx.currentTime + 0.12 }); break;
      case 'powerend': this._tone(520, 0.2, { type: 'sine', to: 300, vol: 0.09 }); break;
      case 'blanket': this._noise(0.25, { filter: 'lowpass', f0: 600, vol: 0.12 }); this._tone(240, 0.3, { type: 'sine', to: 120, vol: 0.12 }); break;
      case 'convert': this._noise(0.35, { filter: 'highpass', f0: 3000, vol: 0.05 }); this._bell(1175, 0.5, 0.07); break;
      case 'bounce': this._tone(190, 0.38, { type: 'sine', to: 720, vol: 0.17, vib: 14, toT: 0.6 }); this._tone(380, 0.2, { type: 'triangle', to: 900, vol: 0.05 }); break;
      case 'zone':
        if (a === 'fluff') this._noise(0.5, { f0: 1600, f1: 700, q: 0.7, vol: 0.05 });
        else if (a === 'gustTail' || a === 'gustHead') this._noise(0.7, { f0: 300, f1: 1400, q: 1.2, vol: 0.08, attack: 0.25 });
        break;
      case 'multup': this._arp(76 + ((a || 2) - 2) * 2, [0, 7], 0.06, { type: 'triangle', vol: 0.12, dur: 0.22 }); break;
      case 'nearmiss': this._tone(1568, 0.14, { type: 'sine', vol: 0.1 }); this._tone(2093, 0.1, { type: 'sine', vol: 0.05, when: this.ctx.currentTime + 0.04 }); break;
      case 'newbest': this._arp(72, [0, 4, 7, 12, 7, 12, 16], 0.08, { type: 'triangle', vol: 0.14, dur: 0.4 }); break;
      case 'beat': this._tone(960, 0.06, { type: 'sine', vol: 0.06 }); this._noise(0.04, { f0: 3500, filter: 'highpass', vol: 0.02 }); break;
      case 'perfect': this._arp(79 + ((a || 0) * 2), [0, 7, 12], 0.05, { type: 'sine', vol: 0.14, dur: 0.3 }); break;
      case 'festival': this._bell(523, 1.0, 0.1); this._bell(784, 1.0, 0.08, this.ctx.currentTime + 0.12); break;
      case 'festivaldone': this._arp(72, [0, 4, 7, 12, 16, 19, 24], 0.07, { type: 'triangle', vol: 0.13, dur: 0.5 }); break;
      case 'biome': this._bell(392, 1.4, 0.1); this._bell(523, 1.4, 0.09, this.ctx.currentTime + 0.18); this._bell(659, 1.6, 0.08, this.ctx.currentTime + 0.36); break;
      case 'surprise': this._arp(84, [0, 5, 9, 12, 17], 0.06, { type: 'sine', vol: 0.09, dur: 0.35 }); break;
      case 'tell': this._tell(a); break;
      case 'ui': this._tone(620, 0.07, { type: 'sine', vol: 0.09 }); break;
      case 'back': this._tone(440, 0.08, { type: 'sine', vol: 0.08 }); break;
      case 'buy': this._arp(79, [0, 7, 12], 0.06, { type: 'triangle', vol: 0.12, dur: 0.3 }); break;
      case 'deny': this._tone(200, 0.14, { type: 'triangle', vol: 0.08 }); break;
      case 'equip': this._arp(76, [0, 5], 0.07, { type: 'sine', vol: 0.1, dur: 0.25 }); break;
      case 'unlock': this._arp(72, [0, 4, 7, 12, 16, 19, 24], 0.08, { type: 'triangle', vol: 0.14, dur: 0.5 }); break;
      case 'chestshake': this._noise(0.12, { filter: 'lowpass', f0: 500, vol: 0.1 }); this._tone(150, 0.1, { type: 'triangle', vol: 0.08 }); break;
      case 'chestopen': {
        const n = { common: [0, 7], uncommon: [0, 4, 7, 12], rare: [0, 4, 7, 12, 16, 19], legendary: [0, 4, 7, 12, 16, 19, 24, 28] }[a] || [0, 7];
        this._arp(72, n, 0.085, { type: 'triangle', vol: 0.14, dur: 0.55 });
        this._noise(0.4, { f0: 3000, filter: 'highpass', vol: 0.04, attack: 0.1 });
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
      case 'snail': this._tone(196, 0.16, { type: 'sine', vol: 0.06 }); this._tone(165, 0.2, { type: 'sine', vol: 0.05, when: now + 0.1 }); break;
      case 'vine': this._tone(988, 0.12, { type: 'sine', vol: 0.05 }); this._tone(784, 0.16, { type: 'sine', vol: 0.05, when: now + 0.08 }); break;
      case 'gap': this._noise(0.35, { f0: 260, f1: 520, q: 1.5, vol: 0.05, attack: 0.15 }); break;
      case 'drop': this._tone(1319, 0.06, { type: 'sine', vol: 0.05 }); this._tone(1760, 0.05, { type: 'sine', vol: 0.04, when: now + 0.07 }); break;
      case 'pad': this._tone(300, 0.14, { type: 'sine', to: 420, vol: 0.05 }); break;
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
    const tri = chord[1] === 'M' ? [0, 4, 7] : [0, 3, 7];
    const stepLen = 60 / (m.tempo * (1 + 0.1 * x)) / 2;

    if (i % 2 === 0) this._beatTimes.push(t);

    // pad: a soft chord every bar
    if (i === 0) {
      for (let k = 0; k < 3; k++) {
        this._tone(mtof(rootM + 12 + tri[k]), stepLen * 8 * 1.05, { when: t, type: m.pad, vol: 0.035 * q, attack: 0.5, bus: 'music', lp: 1400, force: true });
      }
    }
    // bass: roots on beats 1 and 3
    if ((i === 0 || i === 4) && x > 0.22 && !this.menu) {
      this._tone(mtof(rootM - 12), stepLen * 3.5, { when: t, type: 'sine', vol: 0.09, attack: 0.02, bus: 'music', verb: false, force: true });
    }
    // melody: a gentle random walk on the pentatonic scale
    const rest = this.menu ? 0.55 : 0.4 - 0.15 * x;
    if ((i % 2 === 0 || x > 0.5) && rng() > rest) {
      this._lastMelody = Math.max(0, Math.min(9, this._lastMelody + [-2, -1, -1, 0, 1, 1, 2][Math.floor(rng() * 7)]));
      const deg = this._lastMelody;
      const note = m.root + 12 + m.scale[deg % 5] + 12 * Math.floor(deg / 5) + (chord[0] % 12 === 0 ? 0 : 0);
      this._tone(mtof(note), m.lead.dur, { when: t, type: m.lead.type, vol: 0.07 * q, attack: 0.008, bus: 'music', force: true });
      this._tone(mtof(note) * m.lead.harm, m.lead.dur * 0.4, { when: t, type: 'sine', vol: 0.07 * q * m.lead.harmV, bus: 'music', force: true });
    }
    if (this.menu) return;
    // soft kick on 1 and 3, shaker on the off-beats, wood tick on 2 and 4 when things get lively
    if (x > 0.42 && (i === 0 || i === 4)) {
      this._tone(120, 0.16, { when: t, type: 'sine', to: 48, vol: 0.14, bus: 'music', verb: false, force: true });
    }
    if (x > 0.52 && i % 2 === 1) this._noise(0.05, { when: t, f0: 6500, filter: 'highpass', vol: 0.025 * x, bus: 'music', force: true });
    if (x > 0.68 && (i === 2 || i === 6)) this._tone(1100, 0.05, { when: t, type: 'square', vol: 0.025, bus: 'music', lp: 2400, verb: false, force: true });
    // sparkly arpeggio at full tilt
    if (x > 0.78 && i % 2 === 1) this._tone(mtof(rootM + 24 + tri[(i >> 1) % 3]), 0.18, { when: t, type: 'triangle', vol: 0.035, bus: 'music', force: true });

    // ambient moments (a bird, a bell, a frog...) every so often
    if (t > this._nextAmb) {
      this._nextAmb = t + 4 + rng() * 7;
      this._ambientEvent(m.id, t, rng);
    }
  }

  _ambientEvent(id, t, rng) {
    switch (id) {
      case 'meadow': {   // a small bird
        const f = 2400 + rng() * 800;
        this._tone(f, 0.08, { when: t, type: 'sine', to: f * 1.3, vol: 0.03, bus: 'music', force: true });
        this._tone(f * 1.1, 0.08, { when: t + 0.1, type: 'sine', to: f * 1.5, vol: 0.03, bus: 'music', force: true });
        break;
      }
      case 'teacup': this._bell(1047, 1.2, 0.035, t); break;
      case 'grove': this._tone(180, 0.1, { when: t, type: 'sine', to: 320, vol: 0.05, bus: 'music', force: true }); break;
      case 'heights': this._arp(88, [0, 4, 7, 12], 0.12, { type: 'sine', vol: 0.03, dur: 0.6, bus: 'music', when: t }); break;
      case 'lake': this._tone(220, 0.14, { when: t, type: 'sine', to: 440, vol: 0.04, bus: 'music', force: true }); break;
      default:
    }
  }
}

/** One shared engine for the whole game. */
export const audio = new AudioEngine();
