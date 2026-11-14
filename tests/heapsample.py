"""Where does the garbage come from?  Samples every JS allocation for N seconds of autopilot and prints the top allocators.
python3 tests/heapsample.py [seconds] [?query]"""
import subprocess, sys, time, os, collections
from playwright.sync_api import sync_playwright
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SECS=float(sys.argv[1]) if len(sys.argv)>1 else 8
PORT=8797
server=subprocess.Popen([sys.executable,'-m','http.server',str(PORT),'--bind','127.0.0.1'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(0.8)
try:
  with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox','--enable-unsafe-swiftshader'])
    ctx=b.new_context(viewport={'width':412,'height':915},device_scale_factor=2,is_mobile=True,has_touch=True)
    pg=ctx.new_page(); pg.goto(f'http://localhost:{PORT}/index.html'); pg.wait_for_selector('#btn-play',state='visible'); pg.wait_for_timeout(500)
    pg.evaluate("()=>{const d=__cozy.saveStore.data; d.tutorial.done=true; d.settings.quality='high'; __cozy.applySettings(); __cozy.startRun(); setInterval(()=>{if(__cozy.run.state==='running')__cozy.run.hearts=__cozy.run.maxHearts},100)}")
    pg.wait_for_timeout(2500)
    cdp=ctx.new_cdp_session(pg)
    cdp.send('HeapProfiler.enable')
    cdp.send('HeapProfiler.startSampling',{'samplingInterval':4096,'includeObjectsCollectedByMajorGC':True,'includeObjectsCollectedByMinorGC':True})
    frames0=pg.evaluate("()=>__cozy.loop.frames||0")
    pg.wait_for_timeout(int(SECS*1000))
    prof=cdp.send('HeapProfiler.stopSampling')['profile']
    agg=collections.Counter(); total=0
    def walk(n):
        global total
        cf=n['callFrame']; key=f"{cf['functionName'] or '(anon)'} {cf['url'].split('/')[-1]}:{cf['lineNumber']+1}"
        agg[key]+=n['selfSize']; total+=n['selfSize']
        for c in n.get('children',[]): walk(c)
    walk(prof['head'])
    print(f'total sampled allocation: {total/1e6:.1f} MB over {SECS:.0f}s')
    for k,v in agg.most_common(18): print(f'{v/1e6:8.2f} MB  {k}')
    b.close()
finally:
  server.terminate()
