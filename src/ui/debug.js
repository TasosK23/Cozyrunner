/**
 * debug.js — the developer panel, only mounted with ?debug in the URL (normal players never load it).
 *
 *   frame graph    last 120 frame times (green < 20 ms, amber < 33 ms, red slower); 16.7 and 33.3 ms guide lines
 *   Hitboxes       draws the player hit area, hazards and pickups on the world (what the game really tests)
 *   God            hearts never run out
 *   Gfx            cycle Auto / High / Medium / Low (pins the adaptive quality)
 *   Start at       begin the next run at 0 / 400 / 800 / 1200 / 1600 m (every land)
 *   +1000 embers, Unlock all (trophies, looks, beasts), +1 day (clock shift, for Daily/quests/streak), Wipe save
 */
const $ = (s) => document.querySelector(s);

export function mountDebug(h) {
  const app = $('#app');
  const el = document.createElement('div');
  el.id = 'dbg-panel';
  el.innerHTML = `<button class="dbg-head" data-d="fold" aria-expanded="false">DEBUG <span id="dbg-fps">--</span></button>
    <div class="dbg-body hidden"><canvas id="dbg-graph" width="240" height="56"></canvas><div id="dbg-text"></div>
    <div class="dbg-btns">
      <button data-d="boxes">Hitboxes</button><button data-d="god">God</button><button data-d="gfx">Gfx: auto</button>
      <button data-d="start" data-m="0">Start 0</button><button data-d="start" data-m="400">400</button><button data-d="start" data-m="800">800</button><button data-d="start" data-m="1200">1200</button><button data-d="start" data-m="1600">1600</button>
      <button data-d="embers">+1000 embers</button><button data-d="unlock">Unlock all</button><button data-d="day">+1 day</button><button data-d="wipe">Wipe save</button>
    </div></div>`;
  app.appendChild(el);
  const body = el.querySelector('.dbg-body');
  const g = el.querySelector('#dbg-graph').getContext('2d');
  const hist = new Float32Array(120); let hi = 0;
  const state = { god: false, boxes: false, gfx: 'auto' };
  const fpsEl = el.querySelector('#dbg-fps');
  const text = el.querySelector('#dbg-text');
  const pre = $('#debug');          // the text overlay moves into the panel
  pre.classList.remove('hidden'); text.appendChild(pre);

  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-d]'); if (!b) return;
    e.preventDefault();
    const d = h.saveStore.data;
    switch (b.dataset.d) {
      case 'fold': { const open = body.classList.toggle('hidden') === false; b.setAttribute('aria-expanded', String(open)); break; }
      case 'boxes': state.boxes = !state.boxes; h.renderer.showBoxes = state.boxes; b.classList.toggle('on', state.boxes); break;
      case 'god': state.god = !state.god; b.classList.toggle('on', state.god); break;
      case 'gfx': {
        const order = ['auto', 'high', 'medium', 'low'];
        state.gfx = order[(order.indexOf(state.gfx) + 1) % order.length];
        d.settings.quality = state.gfx; h.applySettings(); b.textContent = `Gfx: ${state.gfx}`; break;
      }
      case 'start': h.setStartM(Number(b.dataset.m)); h.toast(`Next run starts at ${b.dataset.m} m`); break;
      case 'embers': d.seedsBank += 1000; h.saveStore.commit(); h.toast('+1000 embers'); break;
      case 'unlock': h.unlockAll(); h.toast('Everything unlocked'); break;
      case 'day': h.clock.shiftDays(1); h.toast('Clock +1 day'); break;
      case 'wipe': h.saveStore.reset(); location.reload(); break;
      default:
    }
  });

  return {
    state,
    frame(dtSec) {
      hist[hi] = dtSec * 1000; hi = (hi + 1) % hist.length;
      if ((hi & 7) !== 0 || body.classList.contains('hidden')) return;
      g.clearRect(0, 0, 240, 56);
      for (let i = 0; i < hist.length; i++) {
        const ms = hist[(hi + i) % hist.length];
        g.fillStyle = ms < 20 ? '#5fd07a' : ms < 33.4 ? '#f2b84a' : '#ff5a4a';
        const bh = Math.min(56, (ms / 50) * 56);
        g.fillRect(i * 2, 56 - bh, 1.6, bh);
      }
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1;
      for (const ms of [16.7, 33.3]) { const y = 56 - (ms / 50) * 56; g.beginPath(); g.moveTo(0, y); g.lineTo(240, y); g.stroke(); }
    },
    setFps(v, q) { fpsEl.textContent = `${v.toFixed(0)} fps · ${q}`; },
  };
}
