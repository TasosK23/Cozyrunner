"""Stage 3 end-to-end: migration, trophies (live + game-over), wardrobe, stats, every setting and its effect,
backup/restore/reset, debug panel.   python3 tests/e2e3.py"""
import subprocess, sys, time, os, json
from playwright.sync_api import sync_playwright
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__))); SH=os.path.join(ROOT,'screenshots'); os.makedirs(SH,exist_ok=True)
PORT=8795
server=subprocess.Popen([sys.executable,'-m','http.server',str(PORT),'--bind','127.0.0.1'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(0.8)
URL=f'http://localhost:{PORT}/index.html'
res=[]
def check(n,ok,x=''):
    res.append(ok); print(('PASS ' if ok else 'FAIL ')+n+(f'  [{x}]' if x else ''))
ERRS=[]
def new_page(b, init=None, query='', w=412, h=915):
    ctx=b.new_context(viewport={'width':w,'height':h},device_scale_factor=2,is_mobile=True,has_touch=True)
    if init: ctx.add_init_script(init)
    pg=ctx.new_page()
    pg.on('pageerror',lambda e:ERRS.append(str(e))); pg.on('console',lambda m: ERRS.append(m.text) if m.type=='error' else None)
    pg.goto(URL+query); pg.wait_for_selector('#btn-play',state='visible'); pg.wait_for_timeout(400)
    return ctx,pg
def returning(pg):
    pg.evaluate("()=>{const d=__cozy.saveStore.data; d.tutorial.done=true; d.tutorial.jump=d.tutorial.slide=d.tutorial.glide=true; d.stats.runs=Math.max(d.stats.runs,1); __cozy.goTitle()}"); pg.wait_for_timeout(250)
def end_run(pg):
    pg.evaluate("()=>__cozy.run._startDying()"); pg.wait_for_function("()=>__cozy.mode==='over'",timeout=9000); pg.wait_for_timeout(400)
try:
  with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'])

    # ================================================== 1. a Stage-2 (v2) save upgrades without losing anything
    v2={"v":2,"seedsBank":777,"xp":321,"best":{"distance":1234,"score":9000,"combo":4,"seeds":50,"seconds":80},"upgrades":{"magnet":2,"hearts":1},
        "companions":{"owned":{"bumbly":True,"dot":True},"seen":{"bumbly":True,"dot":True},"equipped":"dot"},
        "settings":{"music":False,"musicVol":0.25,"haptics":True},"stats":{"runs":9,"totalDistance":5000,"totalSeeds":400,"bestCombo":4},
        "tutorial":{"jump":True,"slide":True,"glide":True,"done":True},"seenBiomes":["meadow","teacup"]}
    ctx,pg=new_page(b,init="localStorage.setItem('lanternfold.save',%s)"%json.dumps(json.dumps(v2)))
    d=pg.evaluate("()=>__cozy.saveStore.data")
    check('v2 save loads as v3 with progress intact', d['v']==3 and d['seedsBank']==777 and d['xp']==321 and d['best']['distance']==1234 and d['upgrades']['magnet']==2 and d['companions']['equipped']=='dot' and d['stats']['runs']==9 and d['seenBiomes']==['meadow','teacup'])
    check('old settings kept, new ones defaulted', d['settings']['music'] is False and d['settings']['musicVol']==0.25 and d['settings']['quality']=='auto' and d['settings']['gentle'] is False)
    check('equipped beast still applies', pg.evaluate("()=>__cozy.run.L.companion")=='dot' and pg.evaluate("()=>__cozy.run.L.hearts")==5, 'hearts = 3 base +1 forge +1 Scorch')
    pg.evaluate("()=>__cozy.saveStore.commit()")
    check('saved back as version 3', json.loads(pg.evaluate("()=>localStorage.getItem('lanternfold.save')"))['v']==3)
    ctx.close()

    # ================================================== 2. trophies: live toast, game-over list, ember + look rewards
    ctx,pg=new_page(b); returning(pg)
    pg.tap('#btn-play'); pg.wait_for_timeout(600)
    pg.evaluate("()=>{__cozy.run.stats.bestMult=3}"); pg.wait_for_timeout(1200)
    toast=pg.evaluate("()=>[...document.querySelectorAll('.toast')].map(t=>t.innerText.replace(/\\n/g,' | '))")
    check('a live trophy pops up while flying (x3 combo -> Kindling)', any('Kindling' in t for t in toast), str(toast))
    pg.screenshot(path=f'{SH}/t3-toast.png')
    check('...and is saved + paid immediately', pg.evaluate("()=>__cozy.saveStore.data.achievements.kindling>0 && __cozy.saveStore.data.seedsBank>=30"))
    pg.evaluate("()=>{__cozy.saveStore.data.best.distance=1200}")      # as if a past run reached 1,200 m
    bank0=pg.evaluate("()=>__cozy.saveStore.data.seedsBank")
    end_run(pg)
    extra=pg.inner_text('#o-extra')
    check('game-over card lists trophies earned (live one included)', 'Trophy earned: Kindling' in extra and 'Trophy earned: First Flame' in extra and 'Trophy earned: Keep Breaker' in extra, extra[:160].replace('\n',' | '))
    check('game-over card announces the new look', 'New look for Cinder: Obsidian (Scales)' in extra)
    d=pg.evaluate("()=>__cozy.saveStore.data")
    check('trophy embers were banked (+30 first flame, +80 keep breaker, +30 ashen wings)', d['seedsBank']-bank0>=140, f"+{d['seedsBank']-bank0}")
    check('the unlocked look is owned and flagged NEW', d['cosmetics']['owned']['scales.obsidian'] and d['cosmetics']['seen']['scales.obsidian'] is False)
    pg.screenshot(path=f'{SH}/t3-gameover-trophies.png')
    pg.tap('#btn-home'); pg.wait_for_timeout(400)
    check('title shows a dot on Wardrobe', pg.evaluate("()=>!document.querySelector('#dot-wardrobe').classList.contains('hidden')"))

    # ---------- trophy hall
    pg.tap('[data-open=achievements]'); pg.wait_for_timeout(400)
    txt=pg.inner_text('#menu-body')
    n_done=pg.evaluate("()=>Object.values(__cozy.saveStore.data.achievements).filter(v=>v>0).length")
    import re
    check('Trophies sheet shows the count', re.search(r'\b%d\s+/\s+35 trophies' % n_done, txt.replace('\u00a0', ' ')) is not None, txt[:40].replace('\n', ' '))
    check('every trophy has a card', pg.locator('.troph').count()==35)
    pg.tap('[data-act=filter][data-f=done]'); pg.wait_for_timeout(200)
    check('"Earned" filter shows only earned trophies', pg.locator('.troph').count()==n_done and pg.locator('.troph:not(.done)').count()==0)
    pg.tap('[data-act=filter][data-f=todo]'); pg.wait_for_timeout(200)
    check('"To do" filter shows the rest, closest first', pg.locator('.troph.done').count()==0 and pg.locator('.troph').count()==35-n_done)
    pg.tap('#menu-back'); pg.wait_for_timeout(200)

    # ---------- wardrobe
    pg.tap('[data-open=wardrobe]'); pg.wait_for_timeout(600)
    check('Wardrobe opens on Scales with a hero preview', pg.locator('.look').count()==6 and pg.is_visible('#hero-preview'))
    inked=pg.evaluate("()=>{const c=document.querySelector('#hero-preview');const g=c.getContext('2d');const d=g.getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>20)n++;return n}")
    check('the preview actually draws Cinder', inked>3000, str(inked))
    check('NEW badge shows on the unlocked look', pg.locator('.look .new').count()>=1)
    pg.tap('[data-act=look][data-id="scales.obsidian"]'); pg.wait_for_timeout(300)
    check('equipping a look saves it and re-skins the hero', pg.evaluate("()=>__cozy.saveStore.data.cosmetics.equipped.scales")=='scales.obsidian' and 'scales.obsidian' in pg.evaluate("()=>__cozy.vis._lookKey"))
    check('...and shows "Equipped"', 'Equipped' in pg.inner_text('.look.eq'))
    locked=pg.locator('.look.locked').first
    has_equip=pg.evaluate("()=>[...document.querySelectorAll('.look.locked')].some(l=>l.querySelector('[data-act=look]'))")
    check('locked looks have no Equip button and show how to earn them', not has_equip and 'Trophy' in pg.inner_text('.look.locked'))
    pg.tap('.look.locked'); pg.wait_for_timeout(300)
    check('tapping a locked look previews it without owning it', pg.evaluate("()=>Object.keys(__cozy.panels.preview).length")==1 and pg.evaluate("()=>__cozy.saveStore.data.cosmetics.equipped.scales")=='scales.obsidian')
    for tab in ['horns','eyes','flame']:
        pg.tap(f'[data-act=tab][data-tab={tab}]'); pg.wait_for_timeout(250)
        check(f'{tab} tab lists its looks', pg.locator('.look').count()>=4)
    pg.screenshot(path=f'{SH}/t3-wardrobe.png')
    pg.tap('#menu-back'); pg.wait_for_timeout(300)
    check('NEW badges clear after viewing the wardrobe', pg.evaluate("()=>document.querySelector('#dot-wardrobe').classList.contains('hidden')"))
    pg.evaluate("()=>__cozy.saveStore.commit()"); pg.reload(); pg.wait_for_selector('#btn-play',state='visible'); pg.wait_for_timeout(500)
    check('the equipped look survives a reload', 'scales.obsidian' in pg.evaluate("()=>__cozy.vis._lookKey"))

    # ---------- an egg that holds a look renders
    pg.evaluate("""async()=>{const {COSMETIC_BY_ID}=await import('/src/data/cosmetics.js');const d=__cozy.saveStore.data;d.chests.pending=1;
      __cozy.panels.chestState={reward:{rarity:'rare',seeds:0,xp:0,companion:null,look:COSMETIC_BY_ID['eyes.frost']}};__cozy.panels.open('chest')}""")
    pg.wait_for_timeout(300)
    check('egg reveal shows a wardrobe look', 'Frostlight' in pg.inner_text('#menu-body'))
    pg.evaluate("()=>{__cozy.panels.chestState=null;__cozy.panels.close()}")

    # ---------- stats sheet
    pg.evaluate("()=>{const d=__cozy.saveStore.data; d.stats.totalDistance=123456; d.stats.nearMisses=777; d.stats.totalSeeds=4321; d.stats.cleanBest=910; d.stats.totalSeconds=7384; d.daily.bestStreak=5; d.seenBiomes=['meadow','teacup','grove']}")
    pg.tap('[data-open=stats]'); pg.wait_for_timeout(400)
    txt=pg.inner_text('#menu-body')
    check('Stats show distance, near-misses, embers', '123.5 km' in txt and '777' in txt and '4,321' in txt, '')
    check('Stats show time, clean flight, streak, lands', '2 h 3 min' in txt and '910 m' in txt and '5 days' in txt and '???' in txt)
    check('Stats list the five lands (unvisited ones hidden)', pg.locator('.land').count()==5 and pg.locator('.land.seen').count()==3)
    pg.screenshot(path=f'{SH}/t3-stats.png')
    pg.tap('#menu-back'); pg.wait_for_timeout(200)
    ctx.close()

    # ================================================== 3. settings: every switch, saved and effective
    ctx,pg=new_page(b); returning(pg)
    pg.evaluate("()=>__cozy.panels.open('settings')"); pg.wait_for_timeout(400)
    def tog(key):
        pg.evaluate(f"()=>document.querySelector('[data-act=toggle][data-key={key}]').scrollIntoView({{block:'center'}})"); pg.wait_for_timeout(80)
        pg.tap(f'[data-act=toggle][data-key={key}]'); pg.wait_for_timeout(120)
        return pg.evaluate(f"()=>__cozy.saveStore.data.settings.{key}")
    check('High contrast on -> renderer + page class', tog('highContrast') is True and pg.evaluate("()=>__cozy.renderer.contrast && document.querySelector('#app').classList.contains('hc')"))
    base=pg.evaluate("()=>parseFloat(getComputedStyle(document.querySelector('#menu-title')).fontSize)")
    check('Large text on -> menus grow 20% and HUD scales', tog('largeText') is True and pg.evaluate("()=>document.documentElement.classList.contains('large') && __cozy.hud.scale===1.2"))
    big=pg.evaluate("()=>parseFloat(getComputedStyle(document.querySelector('#menu-title')).fontSize)")
    check('...measured menu title font', abs(big/base-1.2)<0.03, f'{base:.1f}px -> {big:.1f}px')
    check('Left-handed on -> HUD mirrors + class', tog('leftHanded') is True and pg.evaluate("()=>__cozy.hud.mirror && document.querySelector('#app').classList.contains('lefty')"))
    check('Tap to slide on -> input zone set', tog('tapSlide') is True and pg.evaluate("()=>__cozy.input.slideZone")>0)
    check('Screen flashes off -> renderer never flashes', tog('flashes') is False and pg.evaluate("()=>__cozy.renderer.noFlash"))
    check('Reduced motion on -> renderer calm', tog('reducedMotion') is True and pg.evaluate("()=>__cozy.renderer.reduced"))
    check('Vibration toggle saves', tog('haptics') is False)
    check('Screen shake toggle saves', tog('shake') is False)
    check('Break reminders toggle saves', tog('breakReminder') is False)
    check('Gentle mode on saves', tog('gentle') is True)
    check('Show FPS on -> small counter appears (no ?debug)', tog('showFps') is True and pg.evaluate("()=>!document.querySelector('#debug').classList.contains('hidden')"))
    pg.wait_for_timeout(800)
    check('...and it reads like "NN fps"', 'fps' in pg.inner_text('#debug'), pg.inner_text('#debug'))
    pg.evaluate("()=>document.querySelector('[data-act=seg][data-v=low]').scrollIntoView({block:'center'})"); pg.wait_for_timeout(80)
    pg.tap('[data-act=seg][data-v=low]'); pg.wait_for_timeout(250)
    q=pg.evaluate("()=>({q:__cozy.quality.cfg.name,pin:__cozy.qm.pinned,s:__cozy.saveStore.data.settings.quality})")
    check('Graphics: Low pins the quality level', q=={'q':'low','pin':True,'s':'low'}, str(q))
    pg.tap('[data-act=seg][data-v=auto]'); pg.wait_for_timeout(250)
    q=pg.evaluate("()=>({q:__cozy.quality.cfg.name,pin:__cozy.qm.pinned})")
    check('Graphics: Auto unpins and returns to High', q=={'q':'high','pin':False}, str(q))
    pg.evaluate("()=>{document.querySelector('#menu-body').scrollTop=0}")
    pg.evaluate("()=>{const e=document.querySelector('#s-music');e.value=20;e.dispatchEvent(new Event('input',{bubbles:true}))}"); pg.wait_for_timeout(100)
    check('Music slider saves', abs(pg.evaluate("()=>__cozy.saveStore.data.settings.musicVol")-0.2)<0.01)
    pg.screenshot(path=f'{SH}/t3-settings-on.png')
    # gentle mode: hearts on a normal run vs the Daily Run
    pg.evaluate("()=>__cozy.panels.close()")
    pg.evaluate("()=>__cozy.startRun()"); pg.wait_for_timeout(300)
    h1=pg.evaluate("()=>__cozy.run.maxHearts"); pg.evaluate("()=>__cozy.goTitle()")
    pg.evaluate("()=>__cozy.startRun({daily:true})"); pg.wait_for_timeout(300)
    h2=pg.evaluate("()=>__cozy.run.maxHearts"); pg.evaluate("()=>__cozy.goTitle()")
    check('Gentle mode: 4 hearts on a normal run, 3 on the Daily Run', h1==4 and h2==3, f'{h1} / {h2}')
    # left-handed HUD + pause button position while running
    pg.evaluate("()=>__cozy.startRun()"); pg.wait_for_timeout(500)
    bx=pg.evaluate("()=>document.querySelector('#btn-pause').getBoundingClientRect().x")
    check('Left-handed: pause button sits at the left edge', bx<60, f'x={bx:.0f}')
    # tap-to-slide
    s0=pg.evaluate("()=>[__cozy.run.stats.slides,__cozy.run.stats.jumps]")
    pg.touchscreen.tap(206,860); pg.wait_for_timeout(300)
    s1=pg.evaluate("()=>[__cozy.run.stats.slides,__cozy.run.stats.jumps]")
    check('Tap to slide: a tap low on the screen slides (and does not jump)', s1[0]==s0[0]+1 and s1[1]==s0[1], f'{s0}->{s1}')
    pg.wait_for_timeout(700)
    pg.touchscreen.tap(206,420); pg.wait_for_timeout(250)
    s2=pg.evaluate("()=>[__cozy.run.stats.slides,__cozy.run.stats.jumps]")
    check('...while a tap higher up still jumps', s2[1]==s1[1]+1, f'{s1}->{s2}')
    pg.screenshot(path=f'{SH}/t3-lefty-run.png')
    pg.evaluate("()=>__cozy.goTitle()")
    # high contrast while flying
    pg.evaluate("()=>{__cozy.saveStore.data.settings.leftHanded=false;__cozy.saveStore.data.settings.tapSlide=false;__cozy.applySettings();__cozy.startRun();__cozy.autoplay(true)}")
    pg.wait_for_timeout(4500); pg.screenshot(path=f'{SH}/t3-contrast-run.png')
    d=pg.evaluate("()=>({m:__cozy.mode,dist:__cozy.run.distM,hits:__cozy.run.stats.hits})")
    check('High contrast + Large text: a run plays without trouble', d['m']=='running' and d['dist']>30, str(d))
    pg.evaluate("()=>{__cozy.autoplay(false);__cozy.goTitle()}")
    ctx.close()

    # ================================================== 3b. keyboard + OS preferences
    ctx,pg=new_page(b); returning(pg)
    pg.evaluate("()=>__cozy.panels.open('wardrobe')"); pg.wait_for_timeout(300)
    pg.focus('[data-act=tab][data-tab=horns]'); pg.keyboard.press('Enter'); pg.wait_for_timeout(300)
    check('Enter on a focused sheet button does not start the run behind it', pg.evaluate("()=>__cozy.mode")=='title' and pg.evaluate("()=>__cozy.panels.wardTab")=='horns')
    pg.keyboard.press('Space'); pg.wait_for_timeout(200)
    check('Space on a focused sheet button does not start the run either', pg.evaluate("()=>__cozy.mode")=='title')
    pg.evaluate("()=>__cozy.panels.close()"); pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
    check('...but with no sheet open, Enter still starts the run', pg.evaluate("()=>__cozy.mode")=='running')
    ctx.close()
    ctx=b.new_context(viewport={'width':412,'height':915},reduced_motion='reduce',forced_colors=None)
    pg=ctx.new_page(); pg.goto(URL); pg.wait_for_selector('#btn-play',state='visible'); pg.wait_for_timeout(400)
    check('first visit with the phone set to reduce motion -> the game starts calm', pg.evaluate("()=>__cozy.saveStore.data.settings.reducedMotion && __cozy.renderer.reduced"))
    ctx.close()
    ctx,pg=new_page(b)
    check('first visit with no preference -> motion stays on', pg.evaluate("()=>!__cozy.saveStore.data.settings.reducedMotion"))
    ctx.close()

    # ================================================== 4. backup, restore, erase
    ctx,pg=new_page(b); returning(pg)
    pg.evaluate("()=>{const d=__cozy.saveStore.data; d.seedsBank=4242; d.achievements.ember_hoard=99; d.cosmetics.owned['eyes.venom']=true; d.cosmetics.equipped.eyes='eyes.venom'; __cozy.panels.open('settings')}"); pg.wait_for_timeout(300)
    pg.evaluate("()=>document.querySelector('[data-act=export]').scrollIntoView({block:'center'})"); pg.wait_for_timeout(100)
    pg.tap('[data-act=export]'); pg.wait_for_timeout(200)
    code=pg.input_value('#save-code')
    check('Show my code -> an EW3 backup code', code.startswith('EW3.') and len(code)>200, code[:12])
    pg.evaluate("()=>{const d=__cozy.saveStore.data; d.seedsBank=1; d.achievements.ember_hoard=0; d.cosmetics.equipped.eyes='eyes.amber'}")
    pg.fill('#save-code','EW3.garbage.123'); pg.tap('[data-act=import]'); pg.wait_for_timeout(200)
    check('a bad code is refused with a message', 'did not work' in pg.inner_text('#save-msg') and pg.evaluate("()=>__cozy.saveStore.data.seedsBank")==1)
    pg.fill('#save-code',code); pg.tap('[data-act=import]'); pg.wait_for_timeout(300)
    d=pg.evaluate("()=>__cozy.saveStore.data")
    check('Restore from code brings everything back', d['seedsBank']==4242 and d['achievements']['ember_hoard']==99 and d['cosmetics']['equipped']['eyes']=='eyes.venom' and 'restored' in pg.inner_text('#save-msg'))
    pg.evaluate("()=>document.querySelector('[data-act=reset1]').scrollIntoView({block:'center'})"); pg.wait_for_timeout(100)
    pg.tap('[data-act=reset1]'); pg.wait_for_timeout(200)
    check('Erase asks to confirm first (nothing erased yet)', pg.is_visible('[data-act=reset2]') and pg.evaluate("()=>__cozy.saveStore.data.seedsBank")==4242)
    pg.tap('[data-act=reset0]'); pg.wait_for_timeout(150)
    check('"Keep my progress" cancels', pg.evaluate("()=>__cozy.saveStore.data.seedsBank")==4242 and not pg.is_visible('[data-act=reset2]'))
    pg.evaluate("()=>document.querySelector('[data-act=reset1]').scrollIntoView({block:'center'})"); pg.tap('[data-act=reset1]'); pg.wait_for_timeout(150); pg.tap('[data-act=reset2]'); pg.wait_for_timeout(300)
    d=pg.evaluate("()=>__cozy.saveStore.data")
    check('Erase everything resets the save', d['seedsBank']==0 and d['stats']['runs']==0 and all(v==0 for v in d['achievements'].values()) and d['cosmetics']['equipped']['eyes']=='eyes.amber')
    ctx.close()

    # ================================================== 5. debug panel is for ?debug only
    ctx,pg=new_page(b); 
    check('no debug panel for normal players', pg.locator('#dbg-panel').count()==0 and not pg.is_visible('#debug'))
    ctx.close()
    ctx,pg=new_page(b,query='?debug'); pg.wait_for_selector('#dbg-panel'); returning(pg)
    check('?debug mounts the panel (collapsed)', pg.is_visible('.dbg-head') and not pg.is_visible('#dbg-graph'))
    pg.tap('.dbg-head'); pg.wait_for_timeout(300)
    check('...opens with graph + readout + buttons', pg.is_visible('#dbg-graph') and 'fps' in pg.inner_text('#debug') and pg.locator('.dbg-btns button').count()>=10)
    pg.tap('[data-d=boxes]'); check('Hitboxes toggle reaches the renderer', pg.evaluate("()=>__cozy.renderer.showBoxes"))
    pg.tap('#btn-play'); pg.wait_for_timeout(1200); pg.screenshot(path=f'{SH}/t3-debug-boxes.png'); pg.evaluate("()=>__cozy.goTitle()")
    pg.tap('[data-d=unlock]'); pg.wait_for_timeout(200)
    check('Unlock all: every trophy, look and beast', pg.evaluate("()=>Object.values(__cozy.saveStore.data.achievements).every(v=>v>0) && Object.values(__cozy.saveStore.data.cosmetics.owned).every(Boolean) && Object.values(__cozy.saveStore.data.companions.owned).every(Boolean)"))
    pg.tap('[data-d=embers]'); check('+1000 embers', pg.evaluate("()=>__cozy.saveStore.data.seedsBank")>=1000)
    pg.tap('[data-d=start][data-m="800"]'); pg.tap('#btn-play'); pg.wait_for_timeout(600)
    check('Start at 800 m', pg.evaluate("()=>__cozy.run.distM")>=790, str(pg.evaluate("()=>__cozy.run.distM")))
    pg.tap('[data-d=god]'); pg.evaluate("()=>{__cozy.run.hearts=1}"); pg.wait_for_timeout(300)
    check('God mode keeps the hearts topped up', pg.evaluate("()=>__cozy.run.hearts")==pg.evaluate("()=>__cozy.run.maxHearts"))
    pg.evaluate("()=>__cozy.goTitle()")
    ctx.close()

    # ================================================== 6. title layout: the buttons never bury the dragon
    def title_geo(pg):
        return pg.evaluate("""()=>{const r=s=>document.querySelector(s).getBoundingClientRect(); const bt=r('.title-bottom'), tp=r('.title-pills');
          const tiles=[...document.querySelectorAll('.tiles .tile')].map(t=>t.getBoundingClientRect());
          return {stackTop:bt.top, pillsBottom:tp.bottom, tilesIn:tiles.every(t=>t.left>=0&&t.right<=innerWidth&&t.bottom<=innerHeight), scrollW:document.documentElement.scrollWidth}}""")
    for (w,h,slack) in [(412,780,8),(412,915,8),(390,844,8),(360,640,30)]:
        ctx,pg=new_page(b,w=w,h=h); returning(pg)
        g=title_geo(pg); ground=0.68*h
        check(f"title {w}x{h}: the buttons start below the dragon's feet", g['stackTop']>=ground-slack, f"stack top {g['stackTop']:.0f}, ground {ground:.0f}")
        check(f'title {w}x{h}: every tile is on screen, no sideways scroll', g['tilesIn'] and g['scrollW']<=w)
        check(f"title {w}x{h}: the status pills sit above the dragon's head", g['pillsBottom']<=ground-105, f"pills end {g['pillsBottom']:.0f}")
        ctx.close()
    ctx,pg=new_page(b,w=360,h=640); returning(pg)
    pg.evaluate("()=>document.querySelector('#btn-install').classList.remove('hidden')")      # as if Chrome offered installation
    chip=pg.evaluate("()=>{const c=document.querySelector('#btn-install').getBoundingClientRect(), t=document.querySelector('.tiles').getBoundingClientRect(); return {cb:c.bottom, tt:t.top, cr:c.right, cl:c.left, W:innerWidth}}")
    check('title 360x640: the Install chip sits with the pills, clear of the tiles and the dragon', chip['cb']<=0.68*640-100 and chip['cb']<=chip['tt'] and chip['cl']>=0 and chip['cr']<=chip['W'], str(chip))
    ctx.close()
    ctx,pg=new_page(b,w=360,h=640)
    check('a brand-new player sees only the hint and FLY', pg.is_visible('#btn-play') and pg.is_visible('#title-best') and not pg.is_visible('.tiles') and not pg.is_visible('#btn-daily') and not pg.is_visible('#title-seeds'))
    ctx.close()

    real=[e for e in ERRS if 'Failed to load resource' not in e]
    check('no console / page errors in any scenario', not real, '; '.join(real[:3]))
    b.close()
finally:
  server.terminate()
print(f"\n{sum(res)}/{len(res)} checks passed"+('' if all(res) else '  FAILED'))
sys.exit(0 if all(res) else 1)
