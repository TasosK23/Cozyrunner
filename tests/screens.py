"""Game-over card, pause screen, break note, dragon-egg reveal in the dark theme.  python3 tests/screens.py -> screenshots/sc-*.png"""
import subprocess, sys, time, os
from playwright.sync_api import sync_playwright
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__))); SH=os.path.join(ROOT,'screenshots'); os.makedirs(SH,exist_ok=True)
server=subprocess.Popen([sys.executable,'-m','http.server','8797','--bind','127.0.0.1'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(0.8)
errs=[]
try:
  with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox','--enable-unsafe-swiftshader'])
    ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
    pg=ctx.new_page()
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda x: errs.append(x.text) if x.type=='error' else None)
    pg.goto('http://localhost:8797/index.html'); pg.wait_for_selector('#btn-play',state='visible'); pg.wait_for_timeout(500)
    pg.evaluate("()=>{const d=__cozy.saveStore.data; d.tutorial.done=true; d.tutorial.jump=d.tutorial.slide=d.tutorial.glide=true; d.stats.runs=3; d.seedsBank=900; d.bestM=120; __cozy.goTitle()}")
    pg.wait_for_timeout(400)
    pg.tap('#btn-play'); pg.wait_for_timeout(1500)
    pg.evaluate("()=>__cozy.pauseRun()"); pg.wait_for_timeout(500); pg.screenshot(path=f'{SH}/sc-pause.png')
    pg.evaluate("()=>__cozy.resumeRun()"); pg.wait_for_timeout(200)
    pg.evaluate("()=>{__cozy.autoplay(false)}")
    # play until the run ends by itself (hearts run out)
    pg.evaluate("()=>{for(let i=0;i<6000&&__cozy.run.state!=='over';i++)__cozy.step(1)}")
    pg.wait_for_function("()=>__cozy.mode==='over'",timeout=20000); pg.wait_for_timeout(2600)
    pg.screenshot(path=f'{SH}/sc-gameover.png')
    # eggs: give a pending egg and open the reveal
    pg.evaluate("()=>{__cozy.saveStore.data.chests.pending=2; __cozy.ui.refreshOverChests(2)}"); pg.wait_for_timeout(300)
    if pg.is_visible('#btn-chest'):
        pg.tap('#btn-chest'); pg.wait_for_timeout(600); pg.screenshot(path=f'{SH}/sc-egg.png')
        pg.tap('[data-act=crack]'); pg.wait_for_timeout(1600); pg.screenshot(path=f'{SH}/sc-egg-open.png')
        pg.tap('#menu-back'); pg.wait_for_timeout(300)
    # break note
    pg.evaluate("()=>{__cozy.goTitle(); __cozy.addSessionMinutes(45)}"); pg.tap('#btn-play'); pg.wait_for_timeout(700)
    pg.evaluate("()=>{for(let i=0;i<3000&&__cozy.run.state!=='over';i++)__cozy.step(1)}"); pg.wait_for_timeout(1500)
    pg.screenshot(path=f'{SH}/sc-after.png')
    print('errors:',errs or 'none')
    b.close()
finally: server.terminate()
