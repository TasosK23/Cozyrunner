"""Stage 2 gallery: one screenshot per biome, the biome blend, and the new hazards.  python3 tests/gallery2.py"""
import subprocess, sys, time, os
from playwright.sync_api import sync_playwright
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__))); SH=os.path.join(ROOT,'screenshots'); os.makedirs(SH,exist_ok=True)
server=subprocess.Popen([sys.executable,'-m','http.server','8768','--bind','127.0.0.1'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(0.8)
FREEZE = "() => { __cozy.loop.stop(); __cozy.renderer.render(0.0,'running',0.016); }"
errs=[]
def shot(page,name):
    page.evaluate(FREEZE); page.screenshot(path=f'{SH}/{name}.png'); page.evaluate("()=>__cozy.loop.start()")
def grab(page,name,cond,timeout=40000):
    page.wait_for_function(cond,timeout=timeout); shot(page,name)
try:
  with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox','--enable-unsafe-swiftshader'])
    ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
    def open_at(m):
        pg=ctx.new_page()
        pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda x: errs.append(x.text) if x.type=='error' else None)
        pg.goto(f'http://localhost:8768/index.html?startM={m}'); pg.wait_for_selector('#btn-play',state='visible'); pg.wait_for_timeout(300)
        pg.evaluate("()=>{__cozy.saveStore.data.tutorial.done=true}")
        pg.tap('#btn-play'); pg.evaluate("__cozy.autoplay(true)"); pg.wait_for_timeout(1400)
        return pg
    for k,name in enumerate(['meadow','teacup','grove','heights','lake']):
        pg=open_at(k*400+80); shot(pg,f'b{k}-{name}'); pg.close()
    for k in range(1,5):
        pg=open_at(k*400-6); shot(pg,f'b{k}-blend'); pg.close()
    print('errors:',errs or 'none')
    b.close()
finally: server.terminate()
