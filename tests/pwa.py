"""PWA tests: manifest + icons, service worker precache, OFFLINE play, sub-path hosting (like GitHub Pages), update flow,
install prompt.   python3 tests/pwa.py"""
import subprocess, sys, time, os, json, shutil, tempfile
from playwright.sync_api import sync_playwright
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT=8794
res=[]
def check(n,ok,x=''):
    res.append(ok); print(('PASS ' if ok else 'FAIL ')+n+(f'  [{x}]' if x else ''))

tmp=tempfile.mkdtemp(prefix='pwa-')
site=os.path.join(tmp,'Cozyrunner')                    # served at /Cozyrunner/ , exactly like GitHub Pages project pages
def copy_repo():
    shutil.copytree(ROOT,site,ignore=shutil.ignore_patterns('.git','screenshots','node_modules','__pycache__'))
copy_repo()
server=subprocess.Popen([sys.executable,'-m','http.server',str(PORT),'--bind','127.0.0.1'],cwd=tmp,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(0.8)
BASE=f'http://localhost:{PORT}/Cozyrunner/'
try:
  man=json.load(open(os.path.join(site,'asset-manifest.json')))
  check('asset manifest is in sync with the files', subprocess.run(['node','tools/gen-assets.mjs','--check'],cwd=ROOT,capture_output=True).returncode==0)
  with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'])
    ctx=b.new_context(viewport={'width':412,'height':915},device_scale_factor=2,is_mobile=True,has_touch=True)
    pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None)
    # ---- manifest + icons
    pg.goto(BASE+'index.html'); pg.wait_for_selector('#btn-play',state='visible')
    mf=pg.evaluate("async()=>{const l=document.querySelector('link[rel=manifest]');const r=await fetch(l.href);return {href:l.href,json:await r.json(),ct:r.headers.get('content-type')}}")
    j=mf['json']
    check('manifest linked + parses', j['name']=='Emberwing Run' and j['display']=='standalone', mf['href'])
    check('manifest uses relative start_url/scope (works under /Cozyrunner/)', j['start_url'].startswith('./') and j['scope']=='./')
    sizes=pg.evaluate("""async(icons)=>Promise.all(icons.map(i=>new Promise(r=>{const im=new Image();im.onload=()=>r([i.src,im.naturalWidth,im.naturalHeight,i.sizes,i.purpose]);im.onerror=()=>r([i.src,0,0,i.sizes,i.purpose]);im.src=new URL(i.src,document.baseURI).href})))""",j['icons'])
    check('icons load at their declared size', all(f'{w}x{h}'==s for _,w,h,s,_p in sizes), str([(s[0],s[1]) for s in sizes]))
    check('has a maskable icon and 192 + 512 "any" icons', {i['purpose'] for i in j['icons']}=={'any','maskable'} and {i['sizes'] for i in j['icons']}>={'192x192','512x512'})
    check('apple-touch-icon is 180x180', pg.evaluate("""async()=>{const l=document.querySelector('link[rel=apple-touch-icon]');return await new Promise(r=>{const im=new Image();im.onload=()=>r(im.naturalWidth+'x'+im.naturalHeight);im.onerror=()=>r('err');im.src=l.href})}""")=='180x180')
    # ---- service worker + precache
    pg.evaluate("()=>navigator.serviceWorker.ready"); pg.wait_for_timeout(800)
    sw=pg.evaluate("async()=>{await __cozy.pwa.refresh();const k=await caches.keys();const c=k.length?await (await caches.open(k[0])).keys():[];return {scope:(await navigator.serviceWorker.getRegistration()).scope,keys:k,n:c.length,st:__cozy.pwa.state}}")
    check('service worker registered with the /Cozyrunner/ scope', sw['scope']==BASE, sw['scope'])
    check('every game file is precached', sw['n']==len(man['files'])+1 and len(sw['keys'])==1, f"{sw['n']} cached = {len(man['files'])} files + the manifest; {sw['keys']}")
    check('page reports "offline ready"', sw['st']['offlineReady'] and sw['st']['version']==man['version'], str(sw['st']['version']))
    pg.reload(); pg.wait_for_selector('#btn-play',state='visible'); pg.wait_for_timeout(600)
    check('page is controlled by the worker after reload', pg.evaluate("()=>!!navigator.serviceWorker.controller"))
    # ---- OFFLINE
    ctx.set_offline(True)
    pg.reload(); pg.wait_for_selector('#btn-play',state='visible'); pg.wait_for_timeout(500)
    check('OFFLINE: the game boots from the cache', pg.evaluate("()=>typeof __cozy==='object' && __cozy.mode==='title'"))
    pg.tap('#btn-play'); pg.wait_for_timeout(500)
    pg.evaluate("()=>__cozy.autoplay(true)"); pg.wait_for_timeout(2500)
    d=pg.evaluate("()=>({m:__cozy.mode,dist:__cozy.run.distM,hits:__cozy.run.stats.hits})")
    check('OFFLINE: a run plays (autopilot)', d['m']=='running' and d['dist']>20 and d['hits']==0, str(d))
    pg.evaluate("()=>{__cozy.autoplay(false);__cozy.goTitle()}")
    pg.goto(BASE+'index.html?debug&startM=100'); pg.wait_for_selector('#btn-play',state='visible')
    check('OFFLINE: URLs with ?debug still load (cache ignores the query)', pg.evaluate("()=>typeof __cozy==='object'"))
    miss=pg.evaluate("async()=>{const r=await fetch('src/nope.js');return r.status}")
    check('OFFLINE: an unknown file gives a clean 503, not a crash', miss==503, str(miss))
    pg.goto(BASE); pg.wait_for_selector('#btn-play',state='visible')
    check('OFFLINE: the bare folder URL (home-screen launch) loads', pg.evaluate("()=>typeof __cozy==='object'"))
    pg.evaluate("()=>{const d=__cozy.saveStore.data; d.stats.runs=2; __cozy.panels.open('settings')}"); pg.wait_for_timeout(400)
    txt=pg.inner_text('#pwa-box')
    check('settings shows "Ready to play offline"', 'ready to play offline' in txt.lower(), txt[:60].replace('\n',' '))
    ctx.set_offline(False)
    # ---- install prompt
    pg.evaluate("""()=>{const e=new Event('beforeinstallprompt');e.prompt=()=>{window.__prompted=true};e.userChoice=Promise.resolve({outcome:'accepted'});window.dispatchEvent(e)}"""); pg.wait_for_timeout(300)
    check('install prompt: Settings offers "Install app"', pg.evaluate("()=>!!document.querySelector('#pwa-box [data-act=install]')"))
    pg.tap('#pwa-box [data-act=install]'); pg.wait_for_timeout(300)
    check('install prompt: tapping it triggers the browser prompt', pg.evaluate("()=>window.__prompted===true"))
    pg.evaluate("()=>__cozy.panels.close()")
    # ---- update flow: ship a new version in the served copy
    pg.goto(BASE+'index.html'); pg.wait_for_selector('#btn-play',state='visible'); pg.wait_for_timeout(500)
    v1=pg.inner_text('#ver')
    meta=os.path.join(site,'src/data/meta.js'); s=open(meta).read(); open(meta,'w').write(s.replace("'0.3.0'","'9.9.9'"))
    r=subprocess.run(['node','tools/gen-assets.mjs'],cwd=site,capture_output=True,text=True)
    check('new version generated in the served copy', r.returncode==0 and '9.9.9' in r.stdout, r.stdout.strip())
    out=pg.evaluate("async()=>{const r=await __cozy.pwa.checkUpdate();await new Promise(t=>setTimeout(t,1500));return {r,waiting:__cozy.pwa.state.waiting,keys:await caches.keys()}}")
    check('update downloads in the background and WAITS (no swap mid-game)', out['waiting'] and len(out['keys'])==2 and pg.inner_text('#ver')==v1, str(out))
    pg.evaluate("()=>{__cozy.saveStore.data.stats.runs=2;__cozy.goTitle();__cozy.panels.open('settings')}"); pg.wait_for_timeout(400)
    check('Settings shows "Update ready: restart"', pg.evaluate("()=>!!document.querySelector('#pwa-box [data-act=applyupdate]')"))
    with pg.expect_navigation():
        pg.tap('#pwa-box [data-act=applyupdate]')
    pg.wait_for_selector('#btn-play',state='visible'); pg.wait_for_timeout(800)
    keys=pg.evaluate("async()=>caches.keys()")
    check('after restart the new version runs', pg.inner_text('#ver')=='v9.9.9', pg.inner_text('#ver'))
    check('the old cache is cleaned up', len(keys)==1, str(keys))
    real=[e for e in errs if 'Failed to load resource' not in e]
    check('no console / page errors', not real, '; '.join(real[:3]))
    b.close()
finally:
  server.terminate(); shutil.rmtree(tmp,ignore_errors=True)
print(f"\n{sum(res)}/{len(res)} checks passed"+('' if all(res) else '  FAILED'))
sys.exit(0 if all(res) else 1)
