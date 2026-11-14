"""Generates the app icons (PNG) by drawing Cinder's head with the game's own renderer.
Run:  python3 tools/gen-icons.py        (needs Playwright + Chrome; only when the art changes — the PNGs are committed)
Writes icons/icon-192.png, icons/icon-512.png, icons/maskable-512.png, icons/apple-touch-icon.png"""
import base64, os, subprocess, sys, time
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'icons'); os.makedirs(OUT, exist_ok=True)
PORT = 8793
server = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)

DRAW = """(a) => {
  const { size, kind } = a;                         // kind: any (rounded, transparent corners) | full (opaque square: maskable, apple)
  const cv = document.createElement('canvas'); cv.width = cv.height = size; const g = cv.getContext('2d');
  const R = kind === 'any' ? size * 0.22 : 0;
  g.save();
  if (R) { g.beginPath(); g.roundRect(0, 0, size, size, R); g.clip(); }
  // night sky + ember glow rising from below
  let bg = g.createLinearGradient(0, 0, 0, size); bg.addColorStop(0, '#1a0b14'); bg.addColorStop(0.62, '#3a1418'); bg.addColorStop(1, '#7a2a14');
  g.fillStyle = bg; g.fillRect(0, 0, size, size);
  let gl = g.createRadialGradient(size * 0.5, size * 1.02, size * 0.02, size * 0.5, size * 1.02, size * 0.75);
  gl.addColorStop(0, 'rgba(255,150,50,0.85)'); gl.addColorStop(0.45, 'rgba(255,90,30,0.30)'); gl.addColorStop(1, 'rgba(255,60,20,0)');
  g.fillStyle = gl; g.fillRect(0, 0, size, size);
  // blood moon behind the head
  let mg = g.createRadialGradient(size * 0.62, size * 0.36, 0, size * 0.62, size * 0.36, size * 0.2);
  mg.addColorStop(0, '#ff7a54'); mg.addColorStop(0.75, '#d43a2c'); mg.addColorStop(1, '#a02420');
  g.fillStyle = 'rgba(255,90,60,0.16)'; g.beginPath(); g.arc(size * 0.62, size * 0.36, size * 0.27, 0, 6.2832); g.fill();
  g.fillStyle = mg; g.beginPath(); g.arc(size * 0.62, size * 0.36, size * 0.17, 0, 6.2832); g.fill();
  // sparks
  g.fillStyle = 'rgba(255,190,100,0.9)';
  for (const [x, y, r] of [[0.16, 0.74, 3], [0.26, 0.62, 2], [0.82, 0.7, 3.2], [0.74, 0.82, 2], [0.12, 0.5, 2], [0.9, 0.52, 2.4]]) { g.beginPath(); g.arc(size * x, size * y, r * size / 256, 0, 6.2832); g.fill(); }
  // the head (the game's own drawing code), facing right, eyes and jaw glowing
  const vis = __cozy.vis;
  vis.setLook({ scales: 'scales.cinder', horns: 'horns.bone', eyes: 'eyes.amber', flame: 'flame.ember' });
  const s = size / (kind === 'any' ? 94 : 108);
  g.save(); g.translate(size * 0.57 - 6 * s, size * (kind === 'any' ? 0.6 : 0.585) + 7 * s); g.scale(s, s);
  g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = size / 22;
  vis._head(g, 0, 0, -0.1, 0.16, 0.9, 0.015, false, false, false, 0, 1);   // breath 0.015: no flame, but no nostril smoke either
  g.restore();
  g.restore();
  return cv.toDataURL('image/png');
}"""

try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--enable-unsafe-swiftshader'])
        pg = b.new_page(viewport={'width': 600, 'height': 800})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(f'http://localhost:{PORT}/index.html'); pg.wait_for_selector('#btn-play', state='visible'); pg.wait_for_timeout(500)
        for name, size, kind in [('icon-192.png', 192, 'any'), ('icon-512.png', 512, 'any'), ('maskable-512.png', 512, 'full'), ('apple-touch-icon.png', 180, 'full')]:
            url = pg.evaluate(DRAW, {'size': size, 'kind': kind})
            open(os.path.join(OUT, name), 'wb').write(base64.b64decode(url.split(',', 1)[1]))
            print('wrote', name, size, kind)
        print('errors:', errs)
        b.close()
finally:
    server.terminate()
