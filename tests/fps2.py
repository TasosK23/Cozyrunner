"""A/B real-loop FPS: one feature off at a time (same page, so same machine conditions).  python3 tests/fps2.py [--cpu] [startM]"""
import subprocess, sys, time, os
from playwright.sync_api import sync_playwright
ROOT=os.path.abspath(os.environ.get('ROOT_DIR') or os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PORT='8795'
cpu='--cpu' in sys.argv
nums=[a for a in sys.argv[1:] if a.isdigit()]
sm=int(nums[0]) if nums else 0
server=subprocess.Popen([sys.executable,'-m','http.server',PORT,'--bind','127.0.0.1'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(0.8)
SETUP="""()=>{
 const R=__cozy.renderer; window.__orig={hero:R.vis.draw, glow:R.vis.glow, weather:R._weather, fx:R.fx.draw, hud:R.hud.draw, tdraw:R.terrain.draw, tfront:R.terrain.drawFront, set:R._drawSet, door:R._doorway, zones:R._zones, bats:R._bats, aur:R._auras, moon:R._moon, title:R._titleCard};
 window.__set=(name)=>{ const o=window.__orig; const nop=()=>{};
   R.vis.draw=o.hero; R.vis.glow=o.glow; R._weather=o.weather; R.fx.draw=o.fx; R.hud.draw=o.hud; R.terrain.draw=o.tdraw; R.terrain.drawFront=o.tfront; R._drawSet=o.set; R._doorway=o.door; R._zones=o.zones; R._bats=o.bats; R._auras=o.aur; R._moon=o.moon; R._titleCard=o.title;
   for(const part of name.split('+')){
   if(part==='nohero') R.vis.draw=nop;
   if(part==='noweather') R._weather=nop;
   if(part==='nofx') R.fx.draw=nop;
   if(part==='nohud') R.hud.draw=nop;
   if(part==='noterrain'){R.terrain.draw=nop;R.terrain.drawFront=nop;}
   if(part==='nolayers') R._drawSet=nop;
   if(part==='nodoor') {R._doorway=nop;R._zones=nop;R._bats=nop;R._auras=nop;}
   }
 };
 window.__fps=(ms)=>new Promise(res=>{const f=R.render; let n=0; const w=R.render; R.render=function(...a){n++; return w.apply(this,a)}; const t=performance.now(); setTimeout(()=>{R.render=w; res(n/((performance.now()-t)/1000))},ms)});
}"""
VARIANTS=os.environ.get('VARIANTS','base,nohero,noweather,nofx,nohud,noterrain,nolayers,nodoor,base').split(',')
try:
  with sync_playwright() as p:
    la=['--no-sandbox']+(['--disable-gpu','--disable-accelerated-2d-canvas'] if cpu else ['--enable-unsafe-swiftshader'])
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=la)
    ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
    pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(f'http://localhost:{PORT}/index.html?startM={sm}'); pg.wait_for_selector('#btn-play',state='visible'); pg.wait_for_timeout(400)
    pg.evaluate("()=>{__cozy.saveStore.data.tutorial.done=true}")
    pg.tap('#btn-play'); pg.wait_for_timeout(400)
    pg.evaluate("()=>{__cozy.autoplay(true)}"); pg.evaluate(SETUP)
    pg.evaluate("async()=>{const m=await import('/src/core/quality.js'); m.QualityMonitor.prototype.sample=function(){}; }")   # pin the quality level: no adaptive step-down mid-test
    pg.wait_for_timeout(1200)
    print('mode:', 'cpu raster' if cpu else 'swiftshader', ' startM',sm, ' root',os.path.basename(ROOT))
    for v in VARIANTS:
        pg.evaluate(f"()=>window.__set('{v}')"); pg.wait_for_timeout(250)
        fps=pg.evaluate("()=>window.__fps(2200)")
        print(f'  {v:10s} {fps:5.1f} fps')
    q=pg.evaluate("()=>document.querySelector('#debug')?document.querySelector('#debug').textContent:''")
    print('errors:',errs or 'none')
    b.close()
finally: server.terminate()
