"""Contact sheet of the dragon hero in many poses.  python3 tests/hero2.py -> screenshots/hero-sheet.png"""
import subprocess, sys, time, os, io
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__))); SH=os.path.join(ROOT,'screenshots'); os.makedirs(SH,exist_ok=True)
server=subprocess.Popen([sys.executable,'-m','http.server','8782','--bind','127.0.0.1'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(0.8)
errs=[]; tiles=[]
LOW='--low' in sys.argv
SETTLE="()=>{const v=__cozy.renderer.vis;for(let i=0;i<50;i++)v.update(1/60,__cozy.run,MODE);__cozy.renderer.render(0,MODE,0.0001);}"
try:
  with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox','--enable-unsafe-swiftshader'])
    ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=4,is_mobile=True,has_touch=True)
    pg=ctx.new_page()
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda x: errs.append(x.text) if x.type=='error' else None)
    pg.goto('http://localhost:8781/index.html'.replace('8781','8782')); pg.wait_for_selector('#btn-play',state='visible'); pg.wait_for_timeout(500)
    pg.evaluate("()=>{__cozy.saveStore.data.tutorial.done=true}")
    pg.tap('#btn-play'); pg.wait_for_timeout(1200)
    pg.evaluate("()=>{__cozy.loop.stop();__cozy.autoplay(false)}")
    if LOW: pg.evaluate("async()=>{const m=await import('/src/core/quality.js'); m.quality.set(2);}")
    # ground y in CSS px
    gy=pg.evaluate("()=>Math.round(innerHeight*0.68)")
    def shot(name, js, mode='running', up=110, w=200, x0=0):
        pg.evaluate("()=>{const r=__cozy.run;r.p.slideT=0;r.pu.dash=0;r.pu.burst=0;r.glow=0;r.invuln=0;r.state='running';const v=__cozy.renderer.vis;v.hurt=0;}")
        pg.evaluate(js)
        pg.evaluate(SETTLE.replace('MODE',f"'{mode}'"))
        img=pg.screenshot(clip={'x':x0,'y':gy-up,'width':w,'height':up+18})
        tiles.append((name,Image.open(io.BytesIO(img)).convert('RGB')))
    for i,ph in enumerate([0,0.8,1.6,2.4]):
        shot(f'run{i}', f"()=>{{__cozy.renderer.vis.runPhase={ph};}}")
    shot('slide', "()=>{const r=__cozy.run;r.p.grounded=true;r.p.slideT=0.4;}")
    shot('hurt', "()=>{__cozy.renderer.vis.kick('hit');}")
    shot('dying', "()=>{__cozy.run.state='dying';}")
    shot('blaze', "()=>{__cozy.run.glow=40;}")
    shot('breath', "()=>{__cozy.run.pu.dash=2;__cozy.run.glow=30;}")
    pg.evaluate("()=>{const r=__cozy.run;r.p.grounded=false;r.p.vy=-300;}")
    shot('jump-up', "()=>{const r=__cozy.run;r.p.grounded=false;r.p.vy=-500;}", up=150)
    shot('fall', "()=>{const r=__cozy.run;r.p.grounded=false;r.p.vy=500;}", up=150)
    shot('glide', "()=>{const r=__cozy.run;r.p.grounded=false;r.p.gliding=true;r.p.vy=60;}", up=150)
    print('errors:',errs or 'none')
    b.close()
finally: server.terminate()
# contact sheet
cols=4; tw=max(t.width for _,t in tiles); th=max(t.height for _,t in tiles)
rows=(len(tiles)+cols-1)//cols
sheet=Image.new('RGB',(cols*tw,rows*th),(20,10,14)); d=ImageDraw.Draw(sheet)
for i,(n,t) in enumerate(tiles):
    x=(i%cols)*tw; y=(i//cols)*th; sheet.paste(t,(x,y)); d.text((x+8,y+6),n,fill=(255,255,255))
sheet.save(f'{SH}/hero-sheet{"-low" if LOW else ""}.png'); print('sheet',sheet.size)
