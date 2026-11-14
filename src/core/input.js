/**
 * input.js — turns touches / mouse / keyboard into three simple per-tick signals:
 *   press : a jump/glide tap just happened
 *   hold  : the jump button is still held (longer hold = higher jump)
 *   slide : a swipe-down (or Down key) just happened
 *
 * Tap vs swipe: both start with a finger-down. We wait a hair (INTENT_MS) to see whether the
 * finger moves downward; if it does it's a swipe (slide), otherwise it's a tap (jump).
 * 34 ms is about two frames, which is invisible, but it stops a slide from jumping first.
 * Events are queued and consumed one per simulation tick so rapid taps are never lost.
 */
const INTENT_MS = 34;
const SWIPE_PX = 14;

export class Input {
  constructor(target) {
    this.target = target;
    this.enabled = false;
    this.pointers = new Map();
    this.pendingPress = 0;
    this.pendingSlide = 0;
    this.keyHold = false;
    this.slideZone = 0;       // accessibility: > 0 = tapping below this fraction of the screen height slides (no swipe needed)
    this.onPause = null;
    this._out = { press: false, hold: false, slide: false };

    target.addEventListener('pointerdown', (e) => this._down(e));
    target.addEventListener('pointermove', (e) => this._move(e));
    target.addEventListener('pointerup', (e) => this._up(e));
    target.addEventListener('pointercancel', (e) => this._up(e));
    window.addEventListener('keydown', (e) => this._keyDown(e));
    window.addEventListener('keyup', (e) => this._keyUp(e));
    window.addEventListener('blur', () => this.reset());
  }

  setEnabled(on) {
    this.enabled = on;
    this.reset();
  }

  reset() {
    this.pointers.clear();
    this.pendingPress = 0;
    this.pendingSlide = 0;
    this.keyHold = false;
  }

  get holding() {
    for (const p of this.pointers.values()) if (p.jump) return true;
    return this.keyHold;
  }

  _down(e) {
    if (!this.enabled) return;
    e.preventDefault();
    try { this.target.setPointerCapture(e.pointerId); } catch (_) { /* not critical */ }
    if (this.slideZone > 0) {
      const r = this.target.getBoundingClientRect();
      if (r.height > 0 && (e.clientY - r.top) / r.height >= this.slideZone) {
        this.pendingSlide++;
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now(), decided: true, jump: false, swiped: true });
        return;
      }
    }
    this.pointers.set(e.pointerId, {
      x: e.clientX, y: e.clientY, t: performance.now(),
      decided: false, jump: false, swiped: false,
    });
  }

  _move(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p || p.swiped) return;
    const dy = e.clientY - p.y;
    const dx = e.clientX - p.x;
    if (dy > SWIPE_PX && dy > Math.abs(dx) * 1.2) {
      p.swiped = true;
      p.decided = true;       // this finger will never produce a jump
      p.jump = false;
      this.pendingSlide++;
    }
  }

  _up(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    if (!p.decided && !p.swiped) {   // a quick tap: fire now
      p.decided = true;
      this.pendingPress++;
    }
    this.pointers.delete(e.pointerId);
  }

  _keyDown(e) {
    if (e.repeat) return;
    switch (e.code) {
      case 'Space': case 'ArrowUp': case 'KeyW':
        if (!this.enabled) return;
        e.preventDefault();
        this.pendingPress++;
        this.keyHold = true;
        break;
      case 'ArrowDown': case 'KeyS':
        if (!this.enabled) return;
        e.preventDefault();
        this.pendingSlide++;
        break;
      case 'KeyP': case 'Escape':
        if (this.onPause) this.onPause();
        break;
      default:
    }
  }

  _keyUp(e) {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') this.keyHold = false;
  }

  /** Called once per simulation tick. Returns a reused object (no allocation). */
  tick(now) {
    for (const p of this.pointers.values()) {
      if (!p.decided && now - p.t >= INTENT_MS) {
        p.decided = true;
        p.jump = true;
        this.pendingPress++;
      }
    }
    const out = this._out;
    out.press = this.pendingPress > 0;
    if (out.press) this.pendingPress--;
    out.slide = this.pendingSlide > 0;
    if (out.slide) this.pendingSlide--;
    out.hold = out.press || this.holding;
    return out;
  }
}
