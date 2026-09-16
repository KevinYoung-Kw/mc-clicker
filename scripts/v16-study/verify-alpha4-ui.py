"""Mobile sheet integration plus measured notice lifecycle using real modules.

Pointer swipes use Chromium's touch protocol; WebKit uses real pointer drags.
The isolated subtitle harness does not advance gameplay or touch user saves.
"""
import json, subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/v1.6/qa/alpha4-review/mobile';OUT.mkdir(parents=True,exist_ok=True)
fixture=json.loads(subprocess.check_output(['node','--input-type=module','-e', '''
import {fresh} from './src/game.js';
const s=fresh(42);s.money=100000;s.play=1800;
Object.assign(s.counts,{T1:1,V1:4,V2:2,V18:1,V20:2,M1:1,M4:1,M5:1,L1:1,L2:1,X1:1});
s.chunks.overworld=[{x:0,z:0},{x:1,z:0},{x:0,z:1},{x:1,z:1}];
s.placements={V18:{x:3,z:0,realm:'overworld'},L2:{x:5,z:5,realm:'overworld'}};
Object.assign(s.guidance,{info:true,goals:true,counter:true,notices:false});
Object.assign(s.narrative,{intro:'released',companionsShown:true,legacy:true});s.savedAt=1;
console.log(JSON.stringify(s));'''],cwd=ROOT))
reports=[]
with sync_playwright() as p:
 for engine,width in [('chromium',320),('webkit',390),('chromium',1440)]:
  browser=getattr(p,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}))
  mobile=width<760
  context=browser.new_context(viewport={'width':width,'height':844},is_mobile=mobile,has_touch=mobile)
  context.add_init_script('localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(fixture))+')')
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  cdp=context.new_cdp_session(page) if engine=='chromium' and mobile else None
  def press(q):
   loc=page.locator(q).first
   loc.tap() if mobile else loc.click()
  def swipe(q,dx=0,dy=80):
   box=page.locator(q).bounding_box();x=box['x']+box['width']/2;y=box['y']+box['height']/2
   if cdp:
    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
    for step in range(1,9):
     cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+dx*step/8,'y':y+dy*step/8}]});page.wait_for_timeout(16)
    cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
   else:
    page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+dx,y+dy,steps=8);page.mouse.up()
   page.wait_for_timeout(350)
  def full():return page.locator('#game').evaluate('e=>e.classList.contains("sheet-expanded")')
  try:
   page.goto('http://127.0.0.1:8890/',wait_until='networkidle');page.wait_for_function('!!window.mcDebug?.world')
   styles=page.locator('style[data-vite-dev-id]').all_text_contents()
   checks=[]
   if mobile:
    for name in ['build','village','network','atlas','mail','live']:
     print(engine,width,name,flush=True)
     page.evaluate('name=>mcDebug.go(name)', 'atlas' if name in ['mail','live'] else name);page.wait_for_timeout(350)
     if name in ['mail','live']:press('[data-detail="'+('V18' if name=='mail' else 'L2')+'"]');page.wait_for_timeout(600)
     if name=='live':
      press('[data-room-tab]')
     if not full():press('#panel-expand');page.wait_for_timeout(350)
     assert full(),name
     if name=='village':
      page.evaluate('window.dispatchEvent(new Event("blur"))');page.wait_for_timeout(200)
      page.screenshot(path=str(OUT/f'{engine}-{width}-village-notice.png'))
      page.evaluate('window.dispatchEvent(new Event("focus"))');page.wait_for_timeout(950)
      assert page.locator('#panel-notice-slot').is_hidden()
      page.screenshot(path=str(OUT/f'{engine}-{width}-village-clear.png'))
     swipe('#panel-content',dy=-70);assert full(),name+' body scroll closed sheet'
     swipe('.drawer-handle',dx=70,dy=5);assert full(),name+' horizontal swipe changed sheet'
     swipe('.drawer-handle',dy=80);assert not full(),name+' first down did not collapse'
     assert page.locator('#panel').is_visible()
     swipe('.drawer-handle',dy=80);assert page.locator('#panel').is_hidden(),name+' second down did not close'
     assert not page.locator('#stage').evaluate('e=>e.inert')
     assert page.locator('#world canvas').is_visible()
     assert page.evaluate('Object.values(mcDebug.world.camera.position).every(Number.isFinite)')
     if name=='live':assert page.locator('body').evaluate('e=>e.classList.contains("live-page")')
     checks.append(name+': body scroll, horizontal ignore, full → half → close, world/room restored')
    page.evaluate('mcDebug.go("world");mcDebug.go("build")');page.wait_for_timeout(350)
    press('[data-expand-land]');assert page.locator('#placement-bar').is_visible()
    before=page.locator('#placement-label').inner_text()
    # Header dragging must never silently cancel an active placement.
    if page.locator('.panel-header').is_visible():swipe('.panel-header',dy=60)
    else:assert page.locator('.drawer-handle').is_hidden()
    assert page.locator('#placement-bar').is_visible() and page.locator('#placement-label').inner_text()==before
    page.evaluate('mcDebug.state.money=0;mcDebug.advance(0)')
    page.wait_for_function('document.querySelector("#placement-confirm").textContent==="绿宝石不足"')
    assert '还差' in page.locator('#placement-label').inner_text()
    press('#placement-cancel');checks.append('placement ignores sheet gestures; insufficient funds explain money, not position')
    page.screenshot(path=str(OUT/f'{engine}-{width}-world-restored.png'))
   # An actual late-game purchase uses the exact same unit as the HUD.
   page.evaluate('mcDebug.state.money=1e13;mcDebug.state.counts.E8=1;mcDebug.state.counts.E2=1;mcDebug.state.endEyes=12;mcDebug.go("atlas")')
   press('[data-detail="E9"]');page.wait_for_timeout(150)
   assert '3.600B' in page.locator('[data-buy="E9"]').inner_text()
   shortfall=page.evaluate('''()=>{mcDebug.state.money=1e6;mcDebug.advance(0);return document.querySelector('[data-card="E9"] [data-purchase-reason]').textContent}''')
   assert '3.599B' in shortfall,shortfall
   page.evaluate('mcDebug.state.money=1e13;mcDebug.advance(0)');page.wait_for_timeout(120)
   page.screenshot(path=str(OUT/f'{engine}-{width}-shop-units.png'))
   checks.append('real dragon price 3.600B, shortfall 3.599B; shared HUD currency rule')
   # Same styles, notification renderer and HUD binding, isolated event timing.
   markup='''<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'''+''.join('<style>'+s+'</style>' for s in styles)+'''</head><body><header class="hud"></header><main id="game" class="panel-open sheet-expanded"><div id="stage"><div id="world-label"></div><div id="world-controls"></div></div><nav class="hotbar"><button>商城</button><button>村庄</button><button>工业</button></nav><aside id="panel"><header class="panel-header"><div><h2>村庄</h2></div><button id="panel-close">×</button></header><div id="panel-content">'''+''.join(f'<button style="display:block;width:100%;height:64px" id="row-{i}">工作地点 {i}</button>' for i in range(25))+'''</div></aside></main><div id="notice-center" popover="manual" hidden><div id="toast" hidden></div><div id="foreground-status" hidden></div></div></body></html>'''
   page.route('**/ui-review-harness',lambda route:route.fulfill(body=markup,content_type='text/html'))
   page.goto('http://127.0.0.1:8890/ui-review-harness')
   page.evaluate('''async()=>{
    const {createNotifications,bindSceneHud}=await import('/src/notifications.js');
    const $=q=>document.querySelector(q);window.notices=createNotifications($('#notice-center'),{enabled:false});
    window.line=document.createElement('div');line.id='narrator';line.innerHTML='<p></p>';notices.mountNarrator(line);
    bindSceneHud({stage:$('#stage'),label:$('#world-label'),controls:$('#world-controls'),hotbar:$('.hotbar'),notices:$('#notice-center')});
    window.say=t=>{line.querySelector('p').textContent=t;notices.narrate(!!t);};
   }''');page.wait_for_timeout(150)
   assert page.locator('#panel-notice-slot').is_hidden()
   page.evaluate('notices.show("环境事件",{kind:"event"})');assert page.locator('#notice-center').is_hidden()
   page.evaluate('notices.show("还差 15 绿宝石",{kind:"error",duration:1000})');page.wait_for_timeout(150)
   if mobile:
    slot=page.locator('#panel-notice-slot').bounding_box();notice=page.locator('#notification-shell').bounding_box();header=page.locator('.panel-header').bounding_box()
    assert slot['height']<96 and notice['y']>=header['y']+header['height']
    assert notice['y']+notice['height']<=slot['y']+slot['height']
   page.wait_for_timeout(1800);assert page.locator('#panel-notice-slot').is_hidden()
   checks.append('unowned info gates events, free errors reserve actual height then release')
   page.evaluate('say("先把这片空地收起来，之后还能免费摆回世界里。")');page.wait_for_timeout(120)
   if mobile:
    top=page.locator('#panel-content').bounding_box()['y']
    page.evaluate('say("")');page.wait_for_timeout(200)
    page.evaluate('say("这是下一句话。")');page.wait_for_timeout(150)
    assert page.locator('#panel-content').bounding_box()['y']==top,'sentence gap moved list'
    page.evaluate('document.querySelector("#panel-content").scrollTop=250');page.wait_for_timeout(250)
    row=page.locator('#row-7').bounding_box()['y'];page.evaluate('say("")');page.wait_for_timeout(950)
    assert page.locator('#panel-notice-slot').is_hidden()
    assert abs(page.locator('#row-7').bounding_box()['y']-row)<1,'scroll anchor shifted'
    page.evaluate('document.querySelector("#panel-content").scrollTop=0;say("先看这一条通知。")');page.wait_for_timeout(150)
    box=page.locator('#row-1').bounding_box();page.mouse.move(box['x']+20,box['y']+20);page.mouse.down()
    top=page.locator('#panel-content').bounding_box()['y'];page.evaluate('say("")');page.wait_for_timeout(1000)
    assert page.locator('#panel-content').bounding_box()['y']==top,'collapsed under held pointer'
    page.mouse.up();page.wait_for_timeout(250);assert page.locator('#panel-notice-slot').is_hidden()
    checks.append('sentence gaps stable, scroll anchor preserved, no collapse under a finger')
   for theme in ['','web-theme-backpack','web-theme-oak','web-theme-redstone','web-theme-end']:
    page.evaluate('t=>{document.body.dataset.theme=t;notices.pause(true)}',theme);page.wait_for_timeout(100)
    assert page.locator('#foreground-status').is_visible()
    assert page.locator('#notification-shell').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
   page.screenshot(path=str(OUT/f'{engine}-{width}-notice.png'))
   page.evaluate('notices.pause(false);say("")');page.wait_for_timeout(950)
   assert page.locator('#panel-notice-slot').is_hidden()
   page.screenshot(path=str(OUT/f'{engine}-{width}-no-blank.png'))
   checks.append('five themes, pause visible, resumed silence clears lane; desktop never reserves lane')
   assert not errors,errors
   reports.append({'engine':engine,'width':width,'checks':checks,'errors':errors})
   print(engine,width,'passed',flush=True)
  except Exception:
   page.screenshot(path=str(OUT/f'failure-{engine}-{width}.png'));raise
  finally:context.close();browser.close()
(OUT/'report.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2)+'\n')
