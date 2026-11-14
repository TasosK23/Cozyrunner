"""Where does a frame go?  CPU-raster canvas (no GPU) so every call is synchronous and attributable.
python3 tests/profile.py [startM ...]    e.g. 0 900 1500"""
import subprocess, sys, time, os, json
from playwright.sync_api import sync_playwright
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT='8788'
server=subprocess.Popen([sys.executable,'-m','http.server',PORT,'--bind','127.0.0.1'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(0.8)
flags=[a for a in sys.argv[1:] if not a.isdigit()]
starts=[int(a) for a in sys.argv[1:] if a.isdigit()] or [0]
WRAP="""()=>{
 const R=__cozy.renderer; window.__acc={};
 const wrap=(obj,name,label)=>{ const f=obj[name]; if(typeof f!=='function')return; obj[name]=function(...a){const t=performance.now(); const r=f.apply(this,a); window.__acc[label]=(window.__acc[label]||0)+(performance.now()-t); return r;}; };
 for(const n of ['_drawSet','_weather','_doorway','_zones','_auras','_titleCard','_bats','_moon','_sky']) wrap(R,n,'R.'+n);
 wrap(R.terrain,'draw','terrain.draw'); wrap(R.terrain,'drawFront','terrain.drawFront'); wrap(R.terrain,'prepare','terrain.prepare');
 wrap(R.fx,'draw','fx.draw'); wrap(R.hud,'draw','hud.draw'); wrap(R.vis,'draw','hero.draw');
 wrap(R,'render','RENDER TOTAL');
}"""
try:
  with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox','--disable-gpu','--disable-accelerated-2d-canvas'])
    for sm in starts:
      ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2.0,is_mobile=True,has_touch=True)
      pg=ctx.new_page(); errs=[]
      pg.on('pageerror',lambda e:errs.append(str(e)))
      pg.goto(f'http://localhost:{PORT}/index.html?startM={sm}'); pg.wait_for_selector('#btn-play',state='visible'); pg.wait_for_timeout(400)
      pg.evaluate("()=>{__cozy.saveStore.data.tutorial.done=true}")
      pg.tap('#btn-play'); pg.wait_for_timeout(400)
      pg.evaluate("()=>{__cozy.autoplay(true)}"); pg.wait_for_timeout(1800)
      pg.evaluate("()=>{__cozy.loop.stop()}")
      pg.evaluate(WRAP)
      if 'noglow' in flags: pg.evaluate("()=>{__cozy.renderer.vis.glow=null}")
      if 'nohero' in flags: pg.evaluate("()=>{__cozy.renderer.vis.draw=function(){}}")
      N=90
      pg.evaluate(f"()=>{{for(let i=0;i<{N};i++){{__cozy.step(1);__cozy.renderer.render(0.5,'running',1/60);}}}}")
      acc=pg.evaluate("()=>window.__acc"); st=pg.evaluate("()=>({m:Math.round(__cozy.run.p.x/18),biome:__cozy.renderer.pal&&__cozy.renderer.pal.id})")
      tot=acc.get('RENDER TOTAL',1)/N
      print(f'--- startM={sm}  now at {st}  total {tot:.2f} ms/frame (CPU raster, dpr 2)')
      for k,v in sorted(acc.items(), key=lambda kv:-kv[1]):
        if k=='RENDER TOTAL': continue
        print(f'   {k:18s} {v/N:6.2f} ms  {100*v/N/tot:4.0f}%')
      known=sum(v for k,v in acc.items() if k not in ('RENDER TOTAL','R._drawSet') )  # inclusive, rough
      print('   errors:',errs or 'none'); ctx.close()
    b.close()
finally: server.terminate()
