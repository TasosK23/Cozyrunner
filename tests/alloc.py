"""Allocation + frame-time probe: how much garbage does a run create per frame, and how long does a frame's JS take?
python3 tests/alloc.py [seconds]      (headless Chrome, software GL: judge the allocation numbers, not the fps)"""
import subprocess, sys, time, os
from playwright.sync_api import sync_playwright
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SECS=float(sys.argv[1]) if len(sys.argv)>1 else 12
PORT=8796
server=subprocess.Popen([sys.executable,'-m','http.server',str(PORT),'--bind','127.0.0.1'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(0.8)
try:
  with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox','--enable-unsafe-swiftshader','--enable-precise-memory-info','--js-flags=--expose-gc'])
    ctx=b.new_context(viewport={'width':412,'height':915},device_scale_factor=2,is_mobile=True,has_touch=True)
    pg=ctx.new_page(); pg.goto(f'http://localhost:{PORT}/index.html'); pg.wait_for_selector('#btn-play',state='visible'); pg.wait_for_timeout(500)
    pg.evaluate("()=>{const d=__cozy.saveStore.data; d.tutorial.done=true; d.settings.quality='high'; __cozy.applySettings(); __cozy.startRun(); __cozy.autoplay(true)}")
    pg.wait_for_timeout(2500)
    out=pg.evaluate("""async(secs)=>{
      let frames=0, alloc=0, last=performance.memory.usedJSHeapSize, gcs=0, jsMs=0, worst=0;
      const r=__cozy.renderer, orig=r.render.bind(r);
      r.render=(a,m,d)=>{const t0=performance.now();orig(a,m,d);const dt=performance.now()-t0;jsMs+=dt;if(dt>worst)worst=dt;frames++;
        const u=performance.memory.usedJSHeapSize; if(u>=last)alloc+=u-last; else gcs++; last=u;};
      await new Promise(res=>setTimeout(res,secs*1000));
      r.render=orig;
      return {frames,allocKBperFrame:alloc/1024/frames,gcs,renderMsAvg:jsMs/frames,worstMs:worst,dist:__cozy.run.distM,q:__cozy.quality.cfg.name};}""",SECS)
    print(out)
    b.close()
finally:
  server.terminate()
