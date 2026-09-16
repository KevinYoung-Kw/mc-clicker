"""Real CDP touch on the world cube, before/after iron pick; no button shortcut."""
from playwright.sync_api import sync_playwright
import json
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--use-angle=metal']);c=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);page=c.new_page();page.goto('http://127.0.0.1:8890/',wait_until='networkidle');page.wait_for_function('!!window.mcDebug')
 client=c.new_cdp_session(page)
 for iron in [False,True]:
  page.evaluate('''async iron=>{const {fresh}=await import('/src/game.js');const s=fresh();s.counts={T1:1,T2:1};if(iron)s.counts.T3=1;s.guidance.info=true;s.guidance.notices=false;s.narrative.companionsShown=true;mcDebug.setState(s)}''',iron);page.wait_for_timeout(1800)
  # Hit the actual 3D central cube, not the HTML collect button.
  pt=page.evaluate('''()=>{const w=mcDebug.world;const v=w.camera.position.clone().set(0,.55,0);w.hero.localToWorld(v);v.project(w.camera);const r=w.renderer.domElement.getBoundingClientRect();return {x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2}}''')
  before=page.evaluate('mcDebug.state.clicks');client.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[pt]});page.wait_for_timeout(1800);client.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});after=page.evaluate('mcDebug.state.clicks');assert (after-before>3 if iron else after-before==1),(iron,pt,before,after)
  print({'iron':iron,'worldTouchHits':after-before},flush=True)
 # Returning to a background tab does not mine queued hits.
 before=page.evaluate('mcDebug.state.clicks');other=c.new_page();other.goto('about:blank');page.wait_for_timeout(1200);page.bring_to_front();page.wait_for_timeout(300);assert page.evaluate('mcDebug.state.clicks')==before
 assert page.locator('#mine').evaluate("el=>getComputedStyle(el).webkitUserSelect")=='none'
 print({'copyDisabled':True,'returnWithoutReplay':True});b.close()
