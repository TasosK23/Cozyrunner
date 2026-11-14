"""Takes screenshots of each hazard / pickup / state, for eyeballing the art.  python3 tests/gallery.py"""
import subprocess, sys, time, os
from playwright.sync_api import sync_playwright
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__))); SH=os.path.join(ROOT,'screenshots'); os.makedirs(SH,exist_ok=True)
server=subprocess.Popen([sys.executable,'-m','http.server','8767','--bind','127.0.0.1'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(0.8)

FREEZE = "() => { __cozy.loop.stop(); __cozy.renderer.render(0.0,'running',0.016); }"
def grab(page, name, cond, timeout=60000):
    page.wait_for_function(cond, timeout=timeout)       # polls on rAF
    page.evaluate(FREEZE); page.screenshot(path=f'{SH}/{name}.png'); page.evaluate("()=>__cozy.loop.start()")

try:
  with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
    pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.goto('http://localhost:8767/index.html'); pg.wait_for_selector('#btn-play',state='visible'); pg.wait_for_timeout(400)
    pg.screenshot(path=f'{SH}/g00-title.png')

    # first run = tutorial: catch the jump hint, slide hint, glide hint with the autopilot flying
    pg.tap('#btn-play'); pg.evaluate("__cozy.autoplay(true)")
    ahead = "(type)=>{const r=__cozy.run;for(const h of r.hazards){if(h.active&&h.type===type&&!h.passed&&h.x0-r.p.x>150&&h.x0-r.p.x<215)return true}return false}"
    grab(pg,'g01-hint-jump-snail',"()=>{const r=__cozy.run;return r.hintKey==='jump'&&r.hazards.some(h=>h.active&&h.type==='snail'&&!h.passed&&h.x0-r.p.x>150&&h.x0-r.p.x<215)}")
    grab(pg,'g02-hint-slide-vine',"()=>{const r=__cozy.run;return r.hintKey==='slide'&&r.hazards.some(h=>h.active&&h.type==='vine'&&!h.passed&&h.x0-r.p.x>140&&h.x0-r.p.x<200)}")
    grab(pg,'g03-hint-glide-gap',"()=>{const r=__cozy.run;return r.hintKey==='glide'&&r.hazards.some(h=>h.active&&h.type==='gap'&&!h.passed&&h.x0-r.p.x>120&&h.x0-r.p.x<180)}")
    grab(pg,'g04-gliding',"()=>{const r=__cozy.run;return r.p.gliding&&r.p.y>40}")
    # normal-flow things
    grab(pg,'g05-gap-small',"()=>{const r=__cozy.run;return r.hazards.some(h=>h.active&&h.type==='gap'&&!h.passed&&(h.x1-h.x0)<150&&h.x0-r.p.x>40&&h.x0-r.p.x<110)}")
    grab(pg,'g06-lit-lantern',"()=>{const r=__cozy.run;return r.glow>20&&r.p.grounded}")
    grab(pg,'g07-letter-or-tea',"()=>{const r=__cozy.run;return r.pickups.some(q=>q.active&&(q.type==='letter'||q.type==='tea')&&q.x-r.p.x>60&&q.x-r.p.x<260)}")
    grab(pg,'g08-combo',"()=>{const r=__cozy.run;return r.mult>=3&&!r.p.grounded}")
    pg.evaluate("__cozy.autoplay(false)")
    # now let a hazard bump us (no input): hurt state
    grab(pg,'g09-hurt',"()=>{const r=__cozy.run;return r.hurtT>0.8&&r.state==='running'}")
    # distance ghost: set a best, restart, look at ghost marker
    pg.evaluate("()=>{__cozy.saveStore.data.best.distance=60; __cozy.startRun(); __cozy.autoplay(true)}")
    grab(pg,'g10-best-ghost',"()=>{const r=__cozy.run;return r.ghostX>0&&!r.ghostPassed&&r.ghostX-r.p.x<330&&r.ghostX-r.p.x>240}")
    grab(pg,'g11-new-best',"()=>{const r=__cozy.run;return r.newBest&&r.p.x-r.ghostX>40&&r.p.x-r.ghostX<80}")
    pg.evaluate("__cozy.autoplay(false)")
    print('errors:',errs or 'none')
    b.close()
finally: server.terminate()
