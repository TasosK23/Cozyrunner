"""Stage 2 gallery part 2: new hazards, zones, festival, power-ups.  python3 tests/gallery3.py"""
import subprocess, sys, time, os
from playwright.sync_api import sync_playwright
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__))); SH=os.path.join(ROOT,'screenshots'); os.makedirs(SH,exist_ok=True)
server=subprocess.Popen([sys.executable,'-m','http.server','8769','--bind','127.0.0.1'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(0.8)
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
        pg.goto(f'http://localhost:8769/index.html?startM={m}'); pg.wait_for_selector('#btn-play',state='visible'); pg.wait_for_timeout(300)
        pg.evaluate("()=>{__cozy.saveStore.data.tutorial.done=true}")
        pg.tap('#btn-play'); pg.evaluate("__cozy.autoplay(true)")
        return pg
    near="(t,lo,hi)=>__cozy.run.hazards.some(h=>h.active&&h.type===t&&h.x0-__cozy.run.p.x>lo&&h.x0-__cozy.run.p.x<hi)"
    pg=open_at(440); grab(pg,'h1-drop',f"()=>({near})('drop',90,200)"); pg.close()
    pg=open_at(840); grab(pg,'h2-pad',"()=>__cozy.run.pads.some(q=>q.x-__cozy.run.p.x>60&&q.x-__cozy.run.p.x<200)"); 
    grab(pg,'h2-bounce',"()=>__cozy.run.pads.some(q=>q.squash>0.5)"); pg.close()
    pg=open_at(1240); grab(pg,'h3-gust',"()=>__cozy.run.zoneKind==='gustTail'||__cozy.run.zoneKind==='gustHead'"); pg.close()
    pg=open_at(1640); grab(pg,'h4-fog',"()=>__cozy.run.zoneKind==='fog'"); pg.close()
    pg=open_at(40); grab(pg,'h5-fluff',"()=>__cozy.run.zoneKind==='fluff'"); pg.close()
    pg=open_at(990); grab(pg,'h6-festival',"()=>{const r=__cozy.run;return r.fest&&r.fest.active&&r.fest.next>=1}"); pg.close()
    pg=open_at(100); grab(pg,'h7-power',"()=>__cozy.run.pickups.some(q=>q.active&&q.type==='power'&&q.x-__cozy.run.p.x>60&&q.x-__cozy.run.p.x<240)",90000)
    grab(pg,'h8-poweractive',"()=>Object.values(__cozy.run.pu).some(v=>v>3)",60000); pg.close()
    pg=open_at(385); grab(pg,'h9-door',"()=>{const r=__cozy.run;return r.p.x/18>392&&r.p.x/18<396}"); pg.close()
    print('errors:',errs or 'none')
    b.close()
finally: server.terminate()
