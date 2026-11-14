"""V8 CPU profile of the render loop (CPU-raster canvas) -> top self-time functions.  python3 tests/profile3.py [root] [startM]"""
import subprocess, sys, time, os, collections
from playwright.sync_api import sync_playwright
args=[a for a in sys.argv[1:] if not a.startswith('--')]
ROOT=os.path.abspath(args[0]) if args and not args[0].isdigit() else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
nums=[a for a in args if a.isdigit()]; sm=int(nums[0]) if nums else 0
PORT='8796'
server=subprocess.Popen([sys.executable,'-m','http.server',PORT,'--bind','127.0.0.1'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(0.8)
try:
  with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox','--disable-gpu','--disable-accelerated-2d-canvas'])
    ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
    pg=ctx.new_page()
    pg.goto(f'http://localhost:{PORT}/index.html?startM={sm}'); pg.wait_for_selector('#btn-play',state='visible'); pg.wait_for_timeout(400)
    pg.evaluate("()=>{__cozy.saveStore.data.tutorial.done=true}"); pg.tap('#btn-play'); pg.wait_for_timeout(400)
    pg.evaluate("()=>{__cozy.autoplay(true)}")
    pg.evaluate("async()=>{const m=await import('/src/core/quality.js'); m.QualityMonitor.prototype.sample=function(){}; }")
    pg.wait_for_timeout(1500)
    cdp=ctx.new_cdp_session(pg)
    cdp.send('Profiler.enable'); cdp.send('Profiler.setSamplingInterval',{'interval':200})
    cdp.send('Profiler.start'); pg.wait_for_timeout(4000)
    prof=cdp.send('Profiler.stop')['profile']
    nodes={n['id']:n for n in prof['nodes']}
    dt=prof['timeDeltas']; samples=prof['samples']
    selft=collections.Counter()
    for sid,d in zip(samples,dt): selft[sid]+=d
    tot=sum(selft.values())
    agg=collections.Counter()
    for nid,t in selft.items():
        cf=nodes[nid]['callFrame']; url=cf['url'].split('/')[-1]
        agg[(cf['functionName'] or '(anon)', url, cf['lineNumber']+1 if url else 0)]+=t
    print(f'total sampled {tot/1000:.0f} ms over 4 s window')
    for (fn,url,ln),t in agg.most_common(22):
        print(f'  {100*t/tot:5.1f}%  {fn:28s} {url}:{ln}')
    b.close()
finally: server.terminate()
