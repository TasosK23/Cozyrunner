"""Stage 2 end-to-end: menus, shop, companions, quests, daily, acorns, audio unlock, break note.  python3 tests/e2e2.py"""
import subprocess, sys, time, os, json
from playwright.sync_api import sync_playwright
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__))); SH=os.path.join(ROOT,'screenshots'); os.makedirs(SH,exist_ok=True)
server=subprocess.Popen([sys.executable,'-m','http.server','8772','--bind','127.0.0.1'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(0.8)
res=[]
def check(n,ok,x=''):
    res.append(ok); print(('PASS ' if ok else 'FAIL ')+n+(f'  [{x}]' if x else ''))
try:
  with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'])
    ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
    pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.goto('http://localhost:8772/index.html?debug'); pg.wait_for_selector('#btn-play',state='visible'); pg.wait_for_timeout(500)
    check('first visit: simple title (no menu tiles)', not pg.is_visible('.tiles') and not pg.is_visible('#btn-daily'))
    # make the player "returning"
    pg.evaluate("()=>{const d=__cozy.saveStore.data; d.tutorial.done=true; d.tutorial.jump=d.tutorial.slide=d.tutorial.glide=true; d.stats.runs=1; d.seedsBank=1000; __cozy.goTitle()}")
    pg.wait_for_timeout(300)
    check('returning player sees Daily + tiles + seeds', pg.is_visible('.tiles') and pg.is_visible('#btn-daily') and '1,000' in pg.inner_text('#title-seeds'))
    pg.screenshot(path=f'{SH}/s01-title.png')
    # audio unlocks on first tap
    pg.tap('#btn-play'); pg.wait_for_timeout(500)
    st=pg.evaluate("()=>__cozy.audio.ctx?__cozy.audio.ctx.state:'none'")
    check('audio context unlocked by first tap', st=='running', st)
    check('music scheduler running', pg.evaluate("()=>__cozy.audio.musicOn"))
    pg.evaluate("()=>__cozy.goTitle()"); pg.wait_for_timeout(200)
    # --- upgrades shop
    pg.tap('[data-open=upgrades]'); pg.wait_for_timeout(300); pg.screenshot(path=f'{SH}/s02-upgrades.png')
    check('upgrades sheet opens', pg.is_visible('#screen-menu') and 'Seed Magnet' in pg.inner_text('#menu-body'))
    pg.tap('[data-act=buy][data-id=magnet]'); pg.wait_for_timeout(200)
    d=pg.evaluate("()=>({lv:__cozy.saveStore.data.upgrades.magnet,bank:__cozy.saveStore.data.seedsBank})")
    check('buying an upgrade spends seeds', d['lv']==1 and d['bank']==940, str(d))
    l=pg.evaluate("()=>__cozy.run.L.magnetR"); 
    pg.tap('#menu-back'); pg.wait_for_timeout(200)
    check('loadout reflects the upgrade on the title', pg.evaluate("()=>__cozy.run.L.magnetR")>0, str(pg.evaluate("()=>__cozy.run.L.magnetR")))
    # --- companions
    pg.evaluate("()=>{const d=__cozy.saveStore.data; d.companions.owned.bumbly=true; d.companions.owned.dot=true; d.stats.totalSeeds=60; __cozy.goTitle()}")
    pg.tap('[data-open=companions]'); pg.wait_for_timeout(400); pg.screenshot(path=f'{SH}/s03-companions.png')
    check('companions sheet shows 9 cards', pg.locator('.comp').count()==9)
    pg.tap('[data-act=equip][data-id=dot]'); pg.wait_for_timeout(200)
    check('equip a companion -> +1 heart in the loadout', pg.evaluate("()=>__cozy.saveStore.data.companions.equipped")=='dot' and pg.evaluate("()=>__cozy.run.L.hearts")==4)
    pg.tap('#menu-back'); pg.wait_for_timeout(200)
    check('companion follows Bramble on the title', pg.evaluate("()=>__cozy.run.L.companion")=='dot')
    pg.screenshot(path=f'{SH}/s04-title-companion.png')
    # --- quests + daily
    pg.tap('[data-open=quests]'); pg.wait_for_timeout(300); pg.screenshot(path=f'{SH}/s05-quests.png')
    n=pg.locator('.quest').count()
    check('quests sheet: 3 daily + weekly', n==4, str(n))
    pg.tap('[data-act=reroll] >> nth=0'); pg.wait_for_timeout(200)
    check('free reroll used once', pg.evaluate("()=>__cozy.saveStore.data.quests.rerolled")==True and pg.locator('[data-act=reroll]').count()==0)
    pg.tap('[data-act=daily]'); pg.wait_for_timeout(500)
    check('Daily Run starts', pg.evaluate("()=>__cozy.run.daily")==True and pg.evaluate("()=>__cozy.mode")=='running')
    seed1=pg.evaluate("()=>__cozy.run.seed")
    pg.evaluate("()=>__cozy.startRun({daily:true})"); seed2=pg.evaluate("()=>__cozy.run.seed")
    check('Daily seed is the same all day', seed1==seed2, str(seed1))
    # same hazards for the same daily seed
    sig=lambda: pg.evaluate("()=>{__cozy.step(1200);return __cozy.run.hazards.filter(h=>h.active).map(h=>h.type+Math.round(h.x0)).join(',')}")
    a=sig(); pg.evaluate("()=>__cozy.startRun({daily:true})"); b2=sig()
    check('Daily course identical across attempts (deterministic)', a==b2 and len(a)>0)
    # finish the daily run quickly: kill it
    pg.evaluate("()=>{__cozy.autoplay(false); for(let i=0;i<4000&&__cozy.run.state!=='over';i++) __cozy.step(1)}")
    pg.wait_for_function("()=>__cozy.mode==='over'",timeout=15000); pg.wait_for_timeout(400)
    over=pg.inner_text('#screen-over')
    check('daily game-over shows streak + bonus', 'Daily Run' in over and 'streak 1' in over, over[:120].replace('\n',' | '))
    sv=pg.evaluate("()=>__cozy.saveStore.data")
    check('daily recorded: streak 1, acorn pending', sv['daily']['streak']==1 and sv['chests']['pending']>=1, f"streak={sv['daily']['streak']} acorns={sv['chests']['pending']}")
    pg.screenshot(path=f'{SH}/s06-over-extras.png')
    # --- acorn
    check('acorn button on game over', pg.is_visible('#btn-chest'))
    pg.tap('#btn-chest'); pg.wait_for_timeout(300); pg.tap('[data-act=crack]'); pg.wait_for_timeout(1300)
    check('acorn reveals a prize', pg.locator('.reveal').count()==1, pg.inner_text('#menu-body')[:60].replace('\n',' '))
    pg.screenshot(path=f'{SH}/s07-acorn.png')
    pg.tap('#menu-back'); pg.wait_for_timeout(200)
    # --- streak next day via the clock
    pg.evaluate("()=>{__cozy.clock.shiftDays(1); __cozy.goTitle()}"); pg.wait_for_timeout(200)
    check('streak shown as at risk/kept next day', 'day' in pg.inner_text('#btn-daily'))
    pg.evaluate("()=>{__cozy.startRun({daily:true}); for(let i=0;i<4000&&__cozy.run.state!=='over';i++) __cozy.step(1)}")
    pg.wait_for_function("()=>__cozy.mode==='over'",timeout=15000)
    check('streak grows to 2 on consecutive days', pg.evaluate("()=>__cozy.saveStore.data.daily.streak")==2)
    # --- settings
    pg.evaluate("()=>__cozy.goTitle()"); pg.tap('[data-open=settings]'); pg.wait_for_timeout(300); pg.screenshot(path=f'{SH}/s08-settings.png')
    pg.tap('[data-act=toggle][data-key=music]'); pg.wait_for_timeout(200)
    check('music mute toggle saved + applied', pg.evaluate("()=>__cozy.saveStore.data.settings.music")==False and pg.evaluate("()=>__cozy.audio.settings.music")==False and not pg.evaluate("()=>__cozy.audio.musicOn"))
    pg.tap('[data-act=toggle][data-key=music]'); pg.wait_for_timeout(100)
    pg.evaluate("()=>{const el=document.querySelector('[data-set=sfxVol]'); el.value=30; el.dispatchEvent(new Event('input',{bubbles:true}))}")
    check('SFX slider applies', abs(pg.evaluate("()=>__cozy.audio.settings.sfxVol")-0.3)<0.01)
    pg.tap('#menu-back'); pg.wait_for_timeout(200)
    # --- break note
    pg.evaluate("()=>{__cozy.addSessionMinutes(45); __cozy.startRun(); for(let i=0;i<4000&&__cozy.run.state!=='over';i++) __cozy.step(1)}")
    pg.wait_for_function("()=>__cozy.mode==='over'",timeout=15000); pg.wait_for_timeout(300)
    check('gentle break note after a long session', pg.is_visible('#break-note'))
    pg.screenshot(path=f'{SH}/s09-break.png')
    pg.tap('#break-ok'); 
    # --- pause ducks audio
    pg.evaluate("()=>{__cozy.startRun()}"); pg.wait_for_timeout(300); pg.evaluate("()=>__cozy.pauseRun()")
    check('pause ducks the music', pg.evaluate("()=>__cozy.audio.paused")==True)
    pg.evaluate("()=>__cozy.resumeRun()")
    check('resume restores the music', pg.evaluate("()=>__cozy.audio.paused")==False)
    # --- perf sample: cost of simulating + drawing a frame
    pg.evaluate("()=>{__cozy.autoplay(true)}"); pg.wait_for_timeout(1500)
    ms=pg.evaluate("()=>{const t=performance.now();for(let i=0;i<120;i++){__cozy.step(1);__cozy.renderer.render(0.5,'running',1/60)}return (performance.now()-t)/120}")
    check('frame CPU cost (sim+render) under 8 ms in software GL', ms<8, f'{ms:.2f} ms')
    check('no console / page errors', not errs, '; '.join(errs)[:200])
    b.close()
finally: server.terminate()
print(f'{sum(res)}/{len(res)} passed')
