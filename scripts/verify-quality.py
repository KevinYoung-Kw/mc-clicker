import json,time,sys
from pathlib import Path
from playwright.sync_api import sync_playwright
out=Path('docs/qa');errors=[];checks={}
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--use-angle=metal'] if sys.platform=='darwin' else [])
 context=b.new_context(viewport={'width':1440,'height':960},has_touch=True)
 page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.clock.install()
 page.goto('http://127.0.0.1:8890/');page.wait_for_load_state('networkidle')
 page.evaluate("async()=>{const {completeFixture}=await import('/scripts/fixtures.mjs');const s=completeFixture();s.money=1000000;mcDebug.setState(s);}")
 page.locator('[data-nav=world]').click();page.wait_for_timeout(500)
 snapshot='JSON.stringify(({money,total,buffers,play,project,harvest,live})=>({money,total,buffers,play,project,harvest,live}))'
 def state():return page.evaluate('(()=>{const s=mcDebug.state;return {money:s.money,total:s.total,buffers:s.buffers,play:s.play,project:s.project,harvest:s.harvest,live:s.live}})()')
 # Explicit browser blur/focus events exercise the application lifecycle latch; headless tabs otherwise all report focused.
 page.evaluate("window.dispatchEvent(new Event('blur'))");before=state();page.clock.fast_forward(467000);after=state();assert before==after,(before,after)
 assert page.locator('#foreground-status').is_visible();assert page.locator('#rate').text_content()=='0';checks['467_seconds_unfocused_no_change']=True
 page.evaluate("window.dispatchEvent(new Event('focus'))");page.wait_for_timeout(300);assert state()['play']>before['play'];checks['focus_resumes_without_catchup']=state()['play']-before['play']<1
 assert checks['focus_resumes_without_catchup']
 # Lifecycle event simulation is independent of the focus latch; headless Chromium does not honor native page freezing here.
 cdp=context.new_cdp_session(page);before=state();page.evaluate("document.dispatchEvent(new Event('freeze'))");page.clock.fast_forward(467000);page.evaluate("document.dispatchEvent(new Event('resume'))");after=state();assert after['play']-before['play']<.3,(before['play'],after['play']);checks['freeze_event_no_catchup']=True
 saved=page.evaluate('structuredClone(mcDebug.state)');saved['money']=15023
 page.add_init_script("const s="+json.dumps(saved)+";s.savedAt=Date.now()-467000;localStorage.setItem('mc-clicker-world-v2',JSON.stringify(s));window.__testInactive=true;Object.defineProperty(document,'hasFocus',{value:()=>!window.__testInactive});")
 page.reload();page.wait_for_load_state('networkidle');assert page.evaluate('mcDebug.state.money')==15023;checks['reload_no_offline_award']=True
 page.evaluate("window.__testInactive=false;window.dispatchEvent(new Event('focus'))")
 page.locator('[data-nav=world]').click();page.wait_for_timeout(700);page.screenshot(path=str(out/'60-quality-world.png'))
 page.evaluate('mcDebug.state.endEyes=0');page.locator('[data-nav=build]').click();page.locator('[data-open=owned]').click();page.locator('[data-detail=E2]').click();page.wait_for_timeout(500)
 page.screenshot(path=str(out/'61-portal-empty.png'))
 assert not page.locator('[data-realm=end]').is_visible()
 button=page.locator('[data-end-eye]');button.scroll_into_view_if_needed();box=button.bounding_box();x=box['x']+box['width']/2;y=box['y']+box['height']/2
 cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]});page.wait_for_timeout(2300);cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
 assert page.evaluate('mcDebug.state.endEyes')==12,page.evaluate('mcDebug.state.endEyes');checks['touch_12_eye_activation']=True
 page.screenshot(path=str(out/'62-portal-active.png'));page.locator('[data-action=enter-end]').click();assert page.evaluate('mcDebug.state.realm')=='end';assert page.evaluate('mcDebug.world.view')=='end'
 page.wait_for_timeout(600);page.screenshot(path=str(out/'63-end-scale.png'));checks['portal_enters_end']=True
 page.locator('[data-realm=nether]').click();page.wait_for_timeout(600);page.screenshot(path=str(out/'64-industrial-district.png'))
 # Actual first land purchase and once-only landing animation.
 page.evaluate("async()=>{const {fresh}=await import('/src/game.js');const s=fresh();s.money=10000;s.counts.T1=1;mcDebug.setState(s);}");page.locator('[data-nav=expand]').click()
 point=page.evaluate('()=>{const w=mcDebug.world,m=w.markers[0],p=m.position.clone().project(w.camera),r=w.renderer.domElement.getBoundingClientRect();return{x:r.x+(p.x+1)*r.width/2,y:r.y+(1-p.y)*r.height/2}}');page.mouse.click(point['x'],point['y']);page.locator('#placement-confirm').click()
 assert page.evaluate('!!mcDebug.world.landBuild');page.wait_for_timeout(180);page.screenshot(path=str(out/'65-land-rising.png'))
 page.wait_for_timeout(900);page.screenshot(path=str(out/'66-land-settled.png'))
 assert page.evaluate('Math.abs(mcDebug.world.graph.children.find(o=>o.userData.land)?.position.y)<.001');checks['land_lands_once']=True
 page.set_viewport_size({'width':390,'height':844});page.locator('[data-nav=build]').click();page.wait_for_timeout(450);page.screenshot(path=str(out/'67-land-phone.png'));assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
 assert not errors,errors
 result={'checks':checks,'errors':errors};(out/'quality-observations.json').write_text(json.dumps(result,indent=2));print(json.dumps(result));b.close()
