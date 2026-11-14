"""End-to-end smoke test in a real (headless) Chrome with phone emulation.
Run:  python3 tests/e2e.py        (starts its own static server on :8765)
"""
import subprocess, sys, time, json, os
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.join(ROOT, 'screenshots'); os.makedirs(SHOTS, exist_ok=True)
URL = 'http://localhost:8765/index.html?debug'
server = subprocess.Popen([sys.executable, '-m', 'http.server', '8765', '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
results = []
def check(name, ok, extra=''):
    results.append((name, ok)); print(('PASS ' if ok else 'FAIL ') + name + (f'  [{extra}]' if extra else ''))

try:
  with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--disable-gpu-sandbox', '--enable-unsafe-swiftshader'])
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True,
                              user_agent='Mozilla/5.0 (Linux; Android 14; SM-S926B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36')
    page = ctx.new_page()
    errors = []
    page.on('console', lambda m: errors.append(f'console.{m.type}: {m.text}') if m.type in ('error',) else None)
    page.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))

    page.goto(URL); page.wait_for_selector('#btn-play', state='visible', timeout=10000)
    page.wait_for_timeout(600)
    check('title screen loads', page.evaluate("__cozy.mode") == 'title')
    page.screenshot(path=f'{SHOTS}/01-title.png')

    # --- start a run by tapping Play
    page.tap('#btn-play'); page.wait_for_timeout(500)
    check('play starts a run', page.evaluate("__cozy.mode") == 'running' and page.evaluate("__cozy.run.state") == 'running')
    check('pause button visible', page.is_visible('#btn-pause'))

    # --- a real touch tap makes Bramble jump
    j0 = page.evaluate("__cozy.run.stats.jumps")
    page.touchscreen.tap(195, 500); page.wait_for_timeout(250)
    j1 = page.evaluate("__cozy.run.stats.jumps")
    check('touch tap = jump', j1 > j0, f'{j0}->{j1}')
    page.screenshot(path=f'{SHOTS}/02-jump.png')

    # --- swipe down = slide (CDP touch drag)
    cdp = ctx.new_cdp_session(page)
    page.wait_for_timeout(900)
    s0 = page.evaluate("__cozy.run.stats.slides")
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': 200, 'y': 450}]})
    for k in range(1, 6):
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': 200, 'y': 450 + k * 14}]}); page.wait_for_timeout(12)
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []}); page.wait_for_timeout(150)
    s1 = page.evaluate("__cozy.run.stats.slides")
    check('swipe down = slide (and not a jump)', s1 > s0, f'{s0}->{s1}')

    # --- keyboard works too
    page.keyboard.press('Space'); page.wait_for_timeout(120)

    # --- no input => Bramble eventually tumbles, game over appears, best is saved
    deadline = time.time() + 70
    while time.time() < deadline and page.evaluate("__cozy.mode") != 'over': page.wait_for_timeout(300)
    check('run ends by itself (hearts run out)', page.evaluate("__cozy.mode") == 'over')
    page.wait_for_timeout(1300)
    check('game-over card visible', page.is_visible('#screen-over') and page.is_visible('#btn-again'))
    page.screenshot(path=f'{SHOTS}/03-gameover.png')
    saved = json.loads(page.evaluate("localStorage.getItem('lanternfold.save')"))
    check('save written with version', saved.get('v') == 2 and saved['stats']['runs'] == 1, f"runs={saved['stats']['runs']} xp={saved['xp']} bank={saved['seedsBank']}")

    # --- instant restart
    t0 = time.time(); page.wait_for_timeout(300); page.tap('#btn-again'); page.wait_for_function("__cozy.mode === 'running'", timeout=2000)
    check('run again restarts instantly', time.time() - t0 < 1.5, f'{time.time()-t0:.2f}s')

    # --- autopilot plays for a while (visual check + integration)
    page.evaluate("__cozy.autoplay(true)")
    page.wait_for_timeout(12000)
    st = page.evaluate("({d: __cozy.run.distM, h: __cozy.run.stats.hits, s: __cozy.run.state, score: __cozy.run.score, seeds: __cozy.run.seedsGot, fps: document.querySelector('#debug').textContent})")
    page.screenshot(path=f'{SHOTS}/04-autoplay-a.png')
    page.wait_for_timeout(2300); page.screenshot(path=f'{SHOTS}/05-autoplay-b.png')
    page.wait_for_timeout(2300); page.screenshot(path=f'{SHOTS}/06-autoplay-c.png')
    check('autopilot ran without bumps in the real browser', st['h'] == 0 and st['d'] > 100, f"{st['d']:.0f} m, score {st['score']}, hits {st['h']}")
    print('   debug overlay:', st['fps'].replace('\n', ' | '))

    # --- pause via hidden tab
    page.evaluate("Object.defineProperty(document,'hidden',{value:true,configurable:true}); document.dispatchEvent(new Event('visibilitychange'))")
    page.wait_for_timeout(200)
    check('hiding the tab auto-pauses', page.evaluate("__cozy.mode") == 'paused' and page.is_visible('#screen-pause'))
    page.screenshot(path=f'{SHOTS}/07-pause.png')
    page.evaluate("Object.defineProperty(document,'hidden',{value:false,configurable:true})")
    page.tap('#btn-resume'); page.wait_for_timeout(300)
    check('resume works', page.evaluate("__cozy.mode") == 'running')
    page.evaluate("__cozy.autoplay(false)")

    # --- in-browser chunk validation
    res = page.evaluate("__cozy.validate()")
    check('all chunks validate in the browser', all(r['ok'] for r in res), f'{len(res)} chunks')

    # --- corrupted save must never crash
    for junk in ['{not json', '[]', '"hi"', '{"v":1,"best":"banana","xp":"x","stats":null,"settings":5}', 'null']:
        page.evaluate("(j)=>localStorage.setItem('lanternfold.save', j)", junk)
        page.reload(); page.wait_for_selector('#btn-play', state='visible', timeout=8000)
        okm = page.evaluate("__cozy.mode") == 'title'
        if not okm: check(f'survives corrupt save {junk!r}', False)
    check('corrupted saves never crash the game', True)
    page.evaluate("localStorage.removeItem('lanternfold.save')")

    # --- storage fully disabled: still playable, warns on game over
    ctx2 = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    ctx2.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw new Error('denied')}})")
    pg2 = ctx2.new_page(); e2 = []
    pg2.on('pageerror', lambda e: e2.append(str(e)))
    pg2.goto(URL); pg2.wait_for_selector('#btn-play', state='visible', timeout=8000); pg2.tap('#btn-play'); pg2.wait_for_timeout(600)
    check('playable with storage disabled', pg2.evaluate("__cozy.mode") == 'running' and not e2, '; '.join(e2))
    pg2.evaluate("__cozy.run.hearts=1; __cozy.run.invuln=0")
    dl = time.time() + 60
    while time.time() < dl and pg2.evaluate("__cozy.mode") != 'over': pg2.wait_for_timeout(300)
    pg2.wait_for_timeout(800)
    check('storage-disabled game over shows a gentle warning', pg2.is_visible('#o-warn'))
    ctx2.close()

    # --- desktop viewport
    ctx3 = browser.new_context(viewport={'width': 1280, 'height': 800})
    pg3 = ctx3.new_page(); pg3.goto(URL); pg3.wait_for_selector('#btn-play', state='visible'); pg3.wait_for_timeout(500)
    pg3.screenshot(path=f'{SHOTS}/08-desktop-title.png')
    pg3.keyboard.press('Space'); pg3.wait_for_timeout(1200)
    pg3.keyboard.press('Space'); pg3.wait_for_timeout(300)
    check('desktop: Space starts + jumps', pg3.evaluate("__cozy.mode") == 'running' and pg3.evaluate("__cozy.run.stats.jumps") >= 1)
    pg3.screenshot(path=f'{SHOTS}/09-desktop-run.png')
    ctx3.close()

    check('no console errors / page errors', not errors, '; '.join(errors[:5]))
    browser.close()
finally:
    server.terminate()

bad = [n for n, ok in results if not ok]
print(f"\n{len(results)-len(bad)}/{len(results)} checks passed" + (f"  FAILED: {bad}" if bad else ''))
sys.exit(1 if bad else 0)
