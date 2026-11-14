"""A/B frame cost: switch one feature off at a time, median of 5x40 frames, CPU raster (no GPU) at dpr 2.
python3 tests/profile2.py [startM]"""
import subprocess, sys, time, os
from playwright.sync_api import sync_playwright
ROOT=os.path.abspath(os.environ.get('ROOT_DIR') or os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PORT='8789'
server=subprocess.Popen([sys.executable,'-m','http.server',PORT,'--bind','127.0.0.1'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(0.8)
sm=int(sys.argv[1]) if len(sys.argv)>1 else 0
SETUP="""()=>{
 const R=__cozy.renderer; window.__orig={hero:R.vis.draw, glow:R.vis.glow, weather:R._weather, fx:R.fx.draw, hud:R.hud.draw, tdraw:R.terrain.draw, tfront:R.terrain.drawFront, set:R._drawSet, door:R._doorway, zones:R._zones, bats:R._bats, aur:R._auras, moon:R._moon, title:R._titleCard};
 window.__set=(name)=>{ const o=window.__orig; const nop=()=>{};
   R.vis.draw=o.hero; R.vis.glow=o.glow; R._weather=o.weather; R.fx.draw=o.fx; R.hud.draw=o.hud; R.terrain.draw=o.tdraw; R.terrain.drawFront=o.tfront; R._drawSet=o.set; R._doorway=o.door; R._zones=o.zones; R._bats=o.bats; R._auras=o.aur; R._moon=o.moon; R._titleCard=o.title;
   if(name==='noglow') R.vis.glow=null;
   if(name==='nohero') R.vis.draw=nop;
   if(name==='noweather') R._weather=nop;
   if(name==='nofx') R.fx.draw=nop;
   if(name==='nohud') R.hud.draw=nop;
   if(name==='noterrain'){R.terrain.draw=nop;R.terrain.drawFront=nop;}
   if(name==='nolayers') R._drawSet=nop;
   if(name==='nodoor') {R._doorway=nop;R._zones=nop;R._bats=nop;R._auras=nop;}
 };
 window.__bench=(n,reps)=>{const r=[];for(let k=0;k<reps;k++){const t=performance.now();for(let i=0;i<n;i++){__cozy.step(1);R.render(0.5,'running',1/60);}r.push((performance.now()-t)/n);}r.sort((a,b)=>a-b);return r[Math.floor(reps/2)];};
}"""
VARIANTS=os.environ.get('VARIANTS','base,noglow,nohero,noweather,nofx,nohud,noterrain,nolayers,nodoor,base').split(',')
try:
  with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox','--disable-gpu','--disable-accelerated-2d-canvas'])
    ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2.0,is_mobile=True,has_touch=True)
    pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(f'http://localhost:{PORT}/index.html?startM={sm}'); pg.wait_for_selector('#btn-play',state='visible'); pg.wait_for_timeout(400)
    pg.evaluate("()=>{__cozy.saveStore.data.tutorial.done=true}")
    pg.tap('#btn-play'); pg.wait_for_timeout(400)
    pg.evaluate("()=>{__cozy.autoplay(true)}"); pg.wait_for_timeout(1500)
    pg.evaluate("()=>{__cozy.loop.stop()}")
    pg.evaluate(SETUP)
    pg.evaluate("()=>window.__bench(30,2)")   # warm up
    for v in VARIANTS:
        pg.evaluate(f"()=>window.__set('{v}')")
        ms=pg.evaluate("()=>window.__bench(40,5)")
        print(f'{v:10s} {ms:6.2f} ms')
    print('errors:',errs or 'none')
    b.close()
finally: server.terminate()
