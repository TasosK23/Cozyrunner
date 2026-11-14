"""Screenshot every menu sheet (Beasts, Forge, Quests, Settings) plus game-over, pause and break note.  python3 tests/sheets.py"""
import subprocess, sys, time, os
from playwright.sync_api import sync_playwright
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__))); SH=os.path.join(ROOT,'screenshots'); os.makedirs(SH,exist_ok=True)
server=subprocess.Popen([sys.executable,'-m','http.server','8784','--bind','127.0.0.1'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(0.8)
errs=[]
try:
  with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox','--enable-unsafe-swiftshader'])
    ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
    pg=ctx.new_page()
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda x: errs.append(x.text) if x.type=='error' else None)
    pg.goto('http://localhost:8784/index.html'); pg.wait_for_selector('#btn-play',state='visible'); pg.wait_for_timeout(600)
    # give the save some bank so the sheets have something to show
    pg.evaluate("()=>{const d=__cozy.saveStore.data; d.tutorial.done=true; d.tutorial.jump=d.tutorial.slide=d.tutorial.glide=true; d.stats.runs=1; d.seedsBank=4000; __cozy.goTitle()}")
    pg.wait_for_timeout(500)
    for name in ['companions','upgrades','quests','settings']:
        pg.click(f'[data-open={name}]'); pg.wait_for_timeout(700)
        pg.screenshot(path=f'{SH}/s-{name}.png')
        # close: Escape or the close control
        closed=False
        for sel in ['[data-close]','.sheet-close','#btn-close','.sheet .close','button[aria-label=Close]']:
            if pg.locator(sel).count() and pg.locator(sel).first.is_visible():
                pg.locator(sel).first.click(); closed=True; break
        if not closed: pg.keyboard.press('Escape')
        pg.wait_for_timeout(500)
    print('errors:',errs or 'none')
    b.close()
finally: server.terminate()
