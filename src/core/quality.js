/**
 * quality.js — adaptive quality. If frames take too long for a couple of seconds, we step
 * down: fewer particles, lower canvas resolution, no ambient extras. It only ever steps down
 * during a session (so the game never flickers between looks).
 */
const LEVELS = [
  { name: 'high',   dprCap: 2,    particles: 220, ambient: true,  lite: false },
  { name: 'medium', dprCap: 1.5,  particles: 120, ambient: true,  lite: false },
  { name: 'low',    dprCap: 1,    particles: 60,  ambient: false, lite: true },   // lite: the hero skips glows, the far wing and fine detail
];

export const QUALITY_NAMES = LEVELS.map((l) => l.name);

export const quality = {
  level: 0,
  get cfg() { return LEVELS[this.level]; },
  set(level) { this.level = Math.max(0, Math.min(LEVELS.length - 1, level | 0)); },
};

export class QualityMonitor {
  /** @param {(level:number)=>void} onChange */
  constructor(onChange) {
    this.onChange = onChange;
    this.ema = 16.7;
    this.slow = 0;
    this.warmup = 90;   // ignore the first frames
    this.pinned = false; // true when the player picked a graphics level by hand: never change it automatically
  }

  /** Reset after the tab was hidden or a big layout change. */
  hiccup() { this.warmup = 60; this.slow = 0; }

  sample(frameMs) {
    if (this.pinned) return;
    if (this.warmup > 0) { this.warmup--; return; }
    if (frameMs > 200) return;   // a pause, not slowness
    this.ema += (frameMs - this.ema) * 0.08;
    // 25 ms average = under 40 FPS. Require ~2.5 s of it before reacting.
    if (this.ema > 25) this.slow++; else this.slow = Math.max(0, this.slow - 2);
    if (this.slow > 150 && quality.level < LEVELS.length - 1) {
      quality.set(quality.level + 1);
      this.slow = 0;
      this.warmup = 120;
      this.ema = 16.7;
      this.onChange(quality.level);
    }
  }
}
