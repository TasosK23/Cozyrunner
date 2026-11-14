"""Slide under a vine with the dragon: does the art clear the vine? python3 tests/hero3.py -> screenshots/hero-vine-*.png"""
import subprocess, sys, time, os, io
from playwright.sync_api import sync_playwright
from PIL import Image
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__))); SH=os.path.join(ROOT,'screenshots')
server=subprocess.Popen([sys.executable,'-m','http.server','8783','--bind','127.0.0.1'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(0.8)
errs=[]
POLL="""(off)=>new Promise((res)=>{
  const run=__cozy.run; let n=0;
  const f=()=>{ n++;
    const p=run.p;
    for(const h of run.hazards){ if(h.active&&h.type==='vine'&&p.x>h.x0+off&&p.x<h.x1+60&&p.grounded&&p.slideT>0.05){ __cozy.loop.stop(); res({x:p.x,h:[h.x0,h.x1],n}); return; } }
    if(n>3000){res(null);return;}
    requestAnimationFrame(f); };
  requestAnimationFrame(f); })"""
try:
  with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox','--enable-unsafe-swiftshader'])
    ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=4,is_mobile=True,has_touch=True)
    pg=ctx.new_page()
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda x: errs.append(x.text) if x.type=='error' else None)
    pg.goto('http://localhost:8783/index.html'); pg.wait_for_selector('#btn-play',state='visible'); pg.wait_for_timeout(500)
    pg.evaluate("()=>{__cozy.saveStore.data.tutorial.done=true}")
    pg.tap('#btn-play'); pg.wait_for_timeout(300)
    pg.evaluate("()=>__cozy.autoplay(true)")
    gy=pg.evaluate("()=>Math.round(innerHeight*0.68)")
    for k,off in enumerate([-8, 14, 40]):
        r=pg.evaluate(POLL, off); print('capture',k,r)
        if r:
            img=pg.screenshot(clip={'x':0,'y':gy-100,'width':230,'height':118})
            Image.open(io.BytesIO(img)).convert('RGB').save(f'{SH}/hero-vine-{k}.png')
            pg.evaluate("()=>__cozy.loop.start()"); pg.wait_for_timeout(900)
    print('errors:',errs or 'none')
    b.close()
finally: server.terminate()
