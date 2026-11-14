"""Close-up shots of the dragon hero in each pose.  python3 tests/hero.py  -> screenshots/hero-*.png"""
import subprocess, sys, time, os
from playwright.sync_api import sync_playwright
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__))); SH=os.path.join(ROOT,'screenshots'); os.makedirs(SH,exist_ok=True)
server=subprocess.Popen([sys.executable,'-m','http.server','8781','--bind','127.0.0.1'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(0.8)
errs=[]
try:
  with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox','--enable-unsafe-swiftshader'])
    ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=3,is_mobile=True,has_touch=True)
    pg=ctx.new_page()
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda x: errs.append(x.text) if x.type=='error' else None)
    pg.goto('http://localhost:8781/index.html'); pg.wait_for_selector('#btn-play',state='visible'); pg.wait_for_timeout(500)
    # title pose + yawn (t%7 in 5.1..6.4)
    def clip(name, y0=0.40, y1=0.75):
        pg.evaluate("()=>{__cozy.loop.stop(); __cozy.renderer.render(0.0,'title',0.016);}")
        pg.screenshot(path=f'{SH}/hero-{name}.png', clip={'x':0,'y':844*y0,'width':260,'height':844*(y1-y0)})
        pg.evaluate("()=>__cozy.loop.start()")
    pg.wait_for_timeout(400); clip('title')
    pg.evaluate("()=>{__cozy.renderer.vis.t=5.6}"); clip('yawn-fire')
    pg.evaluate("()=>{__cozy.saveStore.data.tutorial.done=true}")
    pg.tap('#btn-play'); pg.wait_for_timeout(1300)
    def runclip(name, y0=0.40, y1=0.75):
        pg.evaluate("()=>{__cozy.loop.stop(); __cozy.renderer.render(0.0,'running',0.016);}")
        pg.screenshot(path=f'{SH}/hero-{name}.png', clip={'x':0,'y':844*y0,'width':260,'height':844*(y1-y0)})
        pg.evaluate("()=>__cozy.loop.start()")
    runclip('run')
    pg.evaluate("()=>__cozy.autoplay(false)")
    pg.touchscreen.tap(200,500); pg.wait_for_timeout(260); runclip('jump', 0.30, 0.70)
    pg.touchscreen.tap(200,500); pg.wait_for_timeout(120); runclip('glide', 0.28, 0.68)
    print('errors:',errs or 'none')
    b.close()
finally: server.terminate()
