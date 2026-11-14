"""Achieved FPS of the REAL game loop (autopilot) over a few seconds.  python3 tests/fps.py [root-dir] [port] [--cpu]
--cpu = no GPU at all (pure software raster), the harshest case; default = headless SwiftShader GL."""
import subprocess, sys, time, os
from playwright.sync_api import sync_playwright
args=[a for a in sys.argv[1:] if not a.startswith('--')]
ROOT=os.path.abspath(args[0]) if args else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT=args[1] if len(args)>1 else '8791'
cpu='--cpu' in sys.argv
server=subprocess.Popen([sys.executable,'-m','http.server',PORT,'--bind','127.0.0.1'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(0.8)
try:
  with sync_playwright() as p:
    la=['--no-sandbox']+(['--disable-gpu','--disable-accelerated-2d-canvas'] if cpu else ['--enable-unsafe-swiftshader'])
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=la)
    ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=3,is_mobile=True,has_touch=True)
    pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(f'http://localhost:{PORT}/index.html'); pg.wait_for_selector('#btn-play',state='visible'); pg.wait_for_timeout(500)
    pg.evaluate("()=>{__cozy.saveStore.data.tutorial.done=true}")
    pg.tap('#btn-play'); pg.wait_for_timeout(400)
    pg.evaluate("()=>{__cozy.autoplay(true)}"); pg.wait_for_timeout(1500)
    fps=pg.evaluate("""()=>new Promise(res=>{const R=__cozy.renderer; const f=R.render.bind(R); let n=0; R.render=(...a)=>{n++; return f(...a)}; const t=performance.now(); setTimeout(()=>{R.render=f; res(n/((performance.now()-t)/1000))},3000)})""")
    q=pg.evaluate("()=>document.querySelector('#debug')?document.querySelector('#debug').textContent:''")
    print(f'{os.path.basename(ROOT)}: {fps:.1f} fps  errors: {errs or "none"}')
    b.close()
finally: server.terminate()
