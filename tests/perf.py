"""Frame CPU cost in software GL.  python3 tests/perf.py [root-dir] [port]   -> prints ms per frame for sim, render, both."""
import subprocess, sys, time, os
from playwright.sync_api import sync_playwright
ROOT=os.path.abspath(sys.argv[1]) if len(sys.argv)>1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT=sys.argv[2] if len(sys.argv)>2 else '8785'
server=subprocess.Popen([sys.executable,'-m','http.server',PORT,'--bind','127.0.0.1'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(0.8)
try:
  with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox','--enable-unsafe-swiftshader'])
    ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=1.5,is_mobile=True,has_touch=True)
    pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(f'http://localhost:{PORT}/index.html'); pg.wait_for_selector('#btn-play',state='visible'); pg.wait_for_timeout(500)
    pg.evaluate("()=>{__cozy.saveStore.data.tutorial.done=true}")
    pg.tap('#btn-play'); pg.wait_for_timeout(500)
    pg.evaluate("()=>{__cozy.autoplay(true)}"); pg.wait_for_timeout(1500)
    js="""(n)=>{const R=__cozy.renderer; const runs=[];
      for(let k=0;k<7;k++){ const t=performance.now(); for(let i=0;i<n;i++){__cozy.step(1);R.render(0.5,'running',1/60);} runs.push((performance.now()-t)/n); }
      runs.sort((a,b)=>a-b); return {min:runs[0], median:runs[3], max:runs[6]};}"""
    r=pg.evaluate(js,60)
    print({k:round(v,2) for k,v in r.items()}, 'errors:',errs or 'none')
    b.close()
finally: server.terminate()
