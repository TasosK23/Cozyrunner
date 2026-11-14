/** toast.js — small pop-ups ("Trophy earned") that float at the top, never block taps and clean up after themselves. */
const MAX = 3;

export class Toasts {
  constructor(root) { this.root = root; }

  /** @param t {title, sub, tier, html} (html = icon markup shown at the left) */
  show(t, ms = 3600) {
    if (!this.root) return;
    while (this.root.children.length >= MAX) this.root.firstElementChild.remove();
    const el = document.createElement('div');
    el.className = `toast ${t.tier ? 'tier-' + t.tier : ''}`;
    el.setAttribute('role', 'status');
    const ic = document.createElement('span'); ic.className = 'toast-ic'; ic.innerHTML = t.html || '';
    const tx = document.createElement('div'); tx.className = 'toast-tx';
    const b = document.createElement('b'); b.textContent = t.title;
    const s = document.createElement('span'); s.textContent = t.sub || '';
    tx.append(b, s); el.append(ic, tx);
    this.root.appendChild(el);
    setTimeout(() => el.classList.add('out'), ms - 350);
    setTimeout(() => el.remove(), ms);
    return el;
  }
}
