import sys
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
OUT=Path('docs/qa');OUT.mkdir(exist_ok=True)
errors=[];checks={}
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--use-angle=metal'] if sys.platform=='darwin' else [])
 context=browser.new_context(viewport={'width':1440,'height':960},device_scale_factor=1,accept_downloads=True)
 page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8890/');page.wait_for_load_state('networkidle')
 page.evaluate("async()=>{const {completeFixture}=await import('/scripts/fixtures.mjs');const s=completeFixture();s.money=1234567890;mcDebug.setState(s);}")
 (page.locator('#studio-back') if page.locator('#studio-back').is_visible() else page.locator('[data-nav=world]')).click();page.wait_for_timeout(800)
 page.screenshot(path=str(OUT/'20-full-world.png'))
 checks['purchases']=page.evaluate('Object.values(mcDebug.state.counts).filter(Boolean).length')
 for realm in ['nether','end']:
  page.locator(f'[data-realm={realm}]').click();page.wait_for_timeout(700);page.screenshot(path=str(OUT/f'21-{realm}.png'))
  assert page.evaluate('mcDebug.world.view')==realm
 checks['three_dimensions']=True
 page.locator('[data-nav=network]').click();page.locator('[data-option=dispatch]').select_option('clear');page.locator('[data-option=priority]').select_option('nether')
 assert page.evaluate('mcDebug.state.dispatch')=='clear';assert page.evaluate('mcDebug.state.priority')=='nether'
 checks['dispatch']=True
 page.locator('[data-nav=live]').click();page.locator('[data-camera=E9]').click();page.wait_for_timeout(500)
 assert page.evaluate('mcDebug.world.shot')=='E9';assert page.evaluate('mcDebug.world.view')=='end'
 page.screenshot(path=str(OUT/'22-dragon-live.png'));checks['live_camera']=True
 (page.locator('#studio-back') if page.locator('#studio-back').is_visible() else page.locator('[data-nav=world]')).click();page.locator('#settings').click();page.locator('#cosmetic-settings').click()
 page.locator('[data-cosmetic=title]').select_option('2');page.locator('[data-cosmetic=sky]').select_option('1');page.locator('[data-cosmetic=flag]').select_option('2')
 assert '村民上班' in page.title();page.locator('#modal-close').click();checks['cosmetics']=True
 page.locator('#album').click();page.wait_for_selector('#share-card canvas');page.screenshot(path=str(OUT/'23-statistics.png'))
 with page.expect_download() as download:page.locator('#download-card').click()
 download.value.save_as(str(OUT/'24-world-card.png'));checks['png_download']=True
 page.locator('#return-world').click();page.locator('#settings').click()
 with page.expect_download() as download:page.locator('#export-save').click()
 download.value.save_as(str(OUT/'full-save.json'))
 page.locator('#reset-request').click();page.locator('#reset-cancel').click();assert page.evaluate('mcDebug.state.counts.E9')==1
 page.reload();page.wait_for_load_state('networkidle');assert page.evaluate('mcDebug.state.counts.E9')==1;assert '村民上班' in page.title();checks['reload_and_cancel_reset']=True
 # Touch event verification uses a touch-enabled context, not only a narrow desktop viewport.
 mobile=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
 mp=mobile.new_page();mp.on('pageerror',lambda e:errors.append(str(e)));mp.goto('http://127.0.0.1:8890/');mp.wait_for_load_state('networkidle')
 mp.evaluate("async()=>{const {completeFixture}=await import('/scripts/fixtures.mjs');const s=completeFixture();s.counts.M14=0;s.counts.V15=0;s.counts.L6=1;s.harvest.farm=1;mcDebug.setState(s);}")
 (mp.locator('#studio-back') if mp.locator('#studio-back').is_visible() else mp.locator('[data-nav=world]')).tap();mp.wait_for_timeout(500);cdp=mobile.new_cdp_session(mp)
 def hold(locator,ms):
  locator.scroll_into_view_if_needed();mp.wait_for_timeout(150);box=locator.bounding_box();x=box['x']+box['width']/2;y=box['y']+box['height']/2
  cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]});mp.wait_for_timeout(ms);cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});mp.wait_for_timeout(250)
 before=mp.evaluate('mcDebug.state.clicks');hold(mp.locator('#mine'),900);assert mp.evaluate('mcDebug.state.clicks')>before+1;checks['touch_hold_mine']=True
 harvest=mp.evaluate('mcDebug.state.harvestCount');hold(mp.locator('[data-chip=farm]'),1000);assert mp.evaluate('mcDebug.state.harvestCount')==harvest+1;checks['touch_harvest']=True
 # Pan and pinch genuinely alter the camera; dragging cancels hold.
 canvas=mp.locator('#world canvas').bounding_box();y=canvas['y']+canvas['height']*.35
 initial=mp.evaluate('mcDebug.world.pan.x')
 cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':60,'y':y}]});cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':110,'y':y+30}]});cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
 assert mp.evaluate('mcDebug.world.pan.x')!=initial
 zoom=mp.evaluate('mcDebug.world.zoom')
 cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':140,'y':y,'id':1},{'x':240,'y':y,'id':2}]});cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':100,'y':y,'id':1},{'x':280,'y':y,'id':2}]});cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
 assert mp.evaluate('mcDebug.world.zoom')!=zoom;checks['touch_pan_pinch']=True
 mp.locator('[data-nav=live]').tap();mp.locator('[data-camera=V4]').tap();mp.wait_for_timeout(600)
 mp.evaluate("async()=>{const {emit}=await import('/src/game.js');mcDebug.state.live.rainCooldown=0;mcDebug.state.live.gifts=[];emit(mcDebug.state,'harvest','麦田大丰收','overworld');}");mp.wait_for_timeout(500)
 gifts=mp.locator('[data-gift]');assert gifts.count()>=5
 initial_gifts=gifts.count();boxes=[gifts.nth(i).bounding_box() for i in range(min(4,initial_gifts))]
 first=boxes[0];cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':first['x']+first['width']/2,'y':first['y']+first['height']/2}]})
 for box in boxes[1:]:cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':box['x']+box['width']/2,'y':box['y']+box['height']/2}]})
 cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});mp.wait_for_timeout(300)
 assert gifts.count()<=initial_gifts-3;checks['touch_sweep_gifts']=True
 hold(mp.locator('#studio-host'),1350);assert mp.evaluate('mcDebug.state.live.host')>0;checks['touch_host']=True
 mp.screenshot(path=str(OUT/'25-touch-live.png'))
 mp.locator('#studio-back').tap();mp.locator('[data-nav=network]').tap();mp.locator('[data-option=dispatch]').select_option('orders');assert mp.evaluate('mcDebug.state.dispatch')=='orders';checks['touch_dispatch']=True
 for width,height in [(360,800),(390,844),(844,390)]:
  mp.set_viewport_size({'width':width,'height':height});(mp.locator('#studio-back') if mp.locator('#studio-back').is_visible() else mp.locator('[data-nav=world]')).tap();mp.wait_for_timeout(300)
  assert not mp.evaluate('document.documentElement.scrollWidth>innerWidth');mp.screenshot(path=str(OUT/f'26-responsive-{width}.png'))
 checks['responsive_no_overflow']=True
 assert not errors,errors
 (OUT/'full-observations.json').write_text(json.dumps({'checks':checks,'pageErrors':errors},ensure_ascii=False,indent=2));print(json.dumps(checks,ensure_ascii=False,indent=2))
 browser.close()
