import sys
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
OUT=Path('docs/qa'); OUT.mkdir(exist_ok=True)
errors=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--use-angle=metal'] if sys.platform=='darwin' else [])
 page=browser.new_page(viewport={"width":1440,"height":960},device_scale_factor=1)
 page.on('pageerror',lambda e: errors.append(str(e)))
 page.goto('http://127.0.0.1:8890/'); page.wait_for_load_state('networkidle');page.wait_for_timeout(1000)
 page.screenshot(path=str(OUT/'10-new-opening-desktop.png'))
 print('Initial buttons',page.locator('button:visible').all_text_contents()[:15])
 for _ in range(10): page.locator('#mine').click()
 page.wait_for_timeout(300);page.locator('[data-nav="build"]').click();page.locator('[data-buy="T1"]').click()
 for _ in range(15): page.locator('#mine').click()
 page.wait_for_timeout(300);page.locator('[data-buy="V1"]').click();page.wait_for_timeout(500)
 point=page.evaluate('''()=>{const w=mcDebug.world,m=w.markers[0],p=m.position.clone().project(w.camera),r=w.renderer.domElement.getBoundingClientRect();return {x:r.x+(p.x+1)*r.width/2,y:r.y+(1-p.y)*r.height/2}}''')
 page.mouse.click(point['x'],point['y']);page.locator('#placement-confirm').click();page.wait_for_timeout(500)
 print('Land bought',page.evaluate('mcDebug.state.counts.V1'))
 page.evaluate('''async()=>{const {fresh,buy,frontier,sites}=await import('/src/game.js');const {topological}=await import('/src/catalog.js');const s=fresh();s.money=1e7;const ids=['T1','V1','V2','T7','T2','V3','V4','V7','V8','V9','V10','V11','V12','M1','M2','T3','M3','M4','M5','M6','M7','M8','M9','M10','M11','M16','M17','L1','L2','L3','L4','L5','L6','M13','L10'];for(const i of topological()){if(!ids.includes(i.id))continue;if(i.place&&!sites(s,i.realm,null,i.id).length)buy(s,'V1',{...frontier(s,i.realm)[0],realm:i.realm});const r=buy(s,i.id);if(!r.ok)throw Error(i.id+':'+r.reason);}s.counts.V2=8;s.counts.V12=2;s.harvest.farm=1;s.harvest.wool=1;s.live.viewers=1250;s.live.peak=1250;mcDebug.setState(s);}''')
 (page.locator('#studio-back') if page.locator('#studio-back').is_visible() else page.locator('[data-nav=world]')).click();page.wait_for_timeout(1300)
 page.screenshot(path=str(OUT/'11-new-village-desktop.png'))
 page.locator('[data-nav="network"]').click();page.wait_for_timeout(400);page.screenshot(path=str(OUT/'12-new-network.png'))
 page.locator('[data-nav="live"]').click();page.wait_for_timeout(500);page.screenshot(path=str(OUT/'13-new-live.png'))
 print('Rendering',page.evaluate('({calls:mcDebug.world.renderer.info.render.calls,triangles:mcDebug.world.renderer.info.render.triangles,batchCount:mcDebug.world.batch.length})'))
 (page.locator('#studio-back') if page.locator('#studio-back').is_visible() else page.locator('[data-nav=world]')).click();page.set_viewport_size({"width":390,"height":844});page.wait_for_timeout(700)
 page.screenshot(path=str(OUT/'14-new-mobile-world.png'))
 page.locator('[data-nav="build"]').click();page.wait_for_timeout(300);page.screenshot(path=str(OUT/'15-new-mobile-build.png'))
 page.locator('[data-nav="live"]').click();page.wait_for_timeout(500);page.screenshot(path=str(OUT/'16-new-mobile-live.png'))
 print('Overflow',page.evaluate('document.documentElement.scrollWidth>innerWidth'))
 print('Errors',errors)
 (OUT/'new-observations.json').write_text(json.dumps({'errors':errors,'overflow':page.evaluate('document.documentElement.scrollWidth>innerWidth')},ensure_ascii=False,indent=2))
 browser.close()
