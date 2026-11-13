/**
 * loop.js — fixed-timestep game loop.
 *
 * The game always simulates in exact 1/60 s steps (so physics are identical on a 60 Hz
 * budget phone and a 120 Hz S24+, and a seeded run is reproducible). Rendering happens
 * once per display frame, and receives `alpha` (0..1): how far we are between the last
 * and next simulation step, so motion stays buttery on high-refresh screens.
 */
export class Loop {
  constructor(update, render, dt = 1 / 60, maxSteps = 6) {
    this.update = update;
    this.render = render;
    this.dt = dt;
    this.maxSteps = maxSteps;
    this.acc = 0;
    this.last = 0;
    this.raf = 0;
    this.running = false;
    this._frame = this._frame.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.acc = 0;
    this.raf = requestAnimationFrame(this._frame);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  _frame(now) {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this._frame);
    let delta = (now - this.last) / 1000;
    this.last = now;
    if (delta > 0.25) delta = 0.25;   // came back from a hidden tab: don't fast-forward
    if (delta < 0) delta = 0;
    this.acc += delta;
    let steps = 0;
    while (this.acc >= this.dt && steps < this.maxSteps) {
      this.update(this.dt);
      this.acc -= this.dt;
      steps++;
    }
    if (steps === this.maxSteps) this.acc = 0;   // too slow: drop time instead of spiralling
    this.render(this.acc / this.dt, delta);
  }
}
