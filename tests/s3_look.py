"""Stage 3 visual smoke: opens every new sheet + the title at a few phone sizes and saves screenshots.  python3 tests/s3_look.py"""
import subprocess, sys, time, os
from playwright.sync_api import sync_playwright
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__))); SH=os.path.join(ROOT,'screenshots'); os.makedirs(SH,exist_ok=True)
PORT=8791
server=subprocess.Popen([sys.executable,'-m','http.server',str(PORT),'--bind','127.0.0.1'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(0.8)
try:
  with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'])
    for (w,h,tag) in [(412,915,'s24'),(360,640,'small')]:
      ctx=b.new_context(viewport={'width':w,'height':h},device_scale_factor=2,is_mobile=True,has_touch=True)
      pg=ctx.new_page(); errs=[]
      pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None)
      pg.goto(f'http://localhost:{PORT}/index.html?debug'); pg.wait_for_selector('#btn-play',state='visible'); pg.wait_for_timeout(500)
      pg.evaluate("""()=>{const d=__cozy.saveStore.data; d.tutorial.done=true; d.tutorial.jump=d.tutorial.slide=d.tutorial.glide=true; d.stats.runs=30; d.stats.totalDistance=18000; d.stats.nearMisses=60; d.stats.totalSeeds=900;
        d.best.distance=1300; d.best.seconds=200; d.stats.bestCombo=4; d.seenBiomes=['meadow','teacup','grove']; d.xp=900; d.seedsBank=420;
        d.achievements.first_flame=1; d.achievements.ashen_wings=1; d.achievements.keep_breaker=1; d.achievements.close_call=1;
        d.cosmetics.owned['scales.obsidian']=true; d.cosmetics.owned['eyes.crimson']=true; d.cosmetics.owned['horns.obsidian']=true; d.cosmetics.seen['eyes.crimson']=false;
        __cozy.goTitle()}""")
      pg.wait_for_timeout(400); pg.screenshot(path=f'{SH}/t3-{tag}-title.png')
      for name in ['achievements','wardrobe','stats','settings']:
        pg.evaluate(f"()=>__cozy.panels.open('{name}')"); pg.wait_for_timeout(500)
        pg.screenshot(path=f'{SH}/t3-{tag}-{name}.png')
        if name=='settings':
          pg.evaluate("()=>{document.querySelector('#menu-body').scrollTop=99999}"); pg.wait_for_timeout(200); pg.screenshot(path=f'{SH}/t3-{tag}-settings2.png')
        if name=='wardrobe':
          pg.evaluate("()=>{const d=__cozy.saveStore.data; d.cosmetics.equipped.scales='scales.obsidian'; d.cosmetics.equipped.eyes='eyes.crimson'; __cozy.panels.render()}"); pg.wait_for_timeout(400)
          pg.screenshot(path=f'{SH}/t3-{tag}-wardrobe-obs.png')
          pg.evaluate("()=>{__cozy.panels.wardTab='flame'; __cozy.panels.preview={flame:'flame.azure'}; __cozy.panels.render()}"); pg.wait_for_timeout(400)
          pg.screenshot(path=f'{SH}/t3-{tag}-wardrobe-flame.png')
        pg.evaluate("()=>__cozy.panels.close()")
      print(tag,'errors:',errs[:5])
      ctx.close()
    b.close()
finally:
  server.terminate()
