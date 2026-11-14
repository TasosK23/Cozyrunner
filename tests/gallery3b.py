"""Stage 2 gallery part 2: new hazards, zones, festival, power-ups.  python3 tests/gallery3.py"""
import subprocess, sys, time, os
from playwright.sync_api import sync_playwright
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__))); SH=os.path.join(ROOT,'screenshots'); os.makedirs(SH,exist_ok=True)
server=subprocess.Popen([sys.executable,'-m','http.server','8771','--bind','127.0.0.1'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(0.8)
FREEZE = "() => { __cozy.loop.stop(); __cozy.renderer.render(0.0,'running',0.016); }"
errs=[]
def grab(page,name,cond,timeout=50000):
    try:
        page.wait_for_function(cond,timeout=timeout)
        page.evaluate(FREEZE); page.screenshot(path=f'{SH}/{name}.png'); page.evaluate("()=>__cozy.loop.start()"); print('shot',name)
    except Exception as e: print('MISS',name,str(e)[:60])
try:
  with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox','--enable-unsafe-swiftshader'])
    ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
    def open_at(m):
        pg=ctx.new_page()
        pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda x: errs.append(x.text) if x.type=='error' else None)
        pg.goto(f'http://localhost:8771/index.html?startM={m}'); pg.wait_for_selector('#btn-play',state='visible'); pg.wait_for_timeout(300)
        pg.evaluate("()=>{__cozy.saveStore.data.tutorial.done=true}")
        pg.tap('#btn-play'); pg.evaluate("__cozy.autoplay(true)")
        return pg
    near="(t,lo,hi)=>__cozy.run.hazards.some(h=>h.active&&h.type===t&&h.x0-__cozy.run.p.x>lo&&h.x0-__cozy.run.p.x<hi)"
    pg=open_at(1445); grab(pg,'h3-gust',"()=>__cozy.run.zoneKind==='gustTail'||__cozy.run.zoneKind==='gustHead'"); pg.close()
    pg=open_at(1610); grab(pg,'h4-fog',"()=>__cozy.run.zoneKind==='fog'"); pg.close()
    print('errors:',errs or 'none')
    b.close()
finally: server.terminate()
