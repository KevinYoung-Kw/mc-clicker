from pathlib import Path
import sys,json
from playwright.sync_api import sync_playwright
out=Path('docs/qa');out.mkdir(exist_ok=True);errors=[];result={}
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--use-angle=metal'] if sys.platform=='darwin' else [])
 page=b.new_page(viewport={'width':1440,'height':960});page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:8890');page.wait_for_function('window.mcDebug');page.wait_for_timeout(500)
 assert not page.locator('#collection-open').is_visible()
 page.evaluate('mcDebug.state.money=20');page.locator('[data-nav=build]').click();page.wait_for_function('document.querySelector("[data-icon=T1]").complete');page.screenshot(path=str(out/'60-collection-start.png'));page.locator('[data-buy=T1]').click();page.locator('[data-nav=world]').click();page.wait_for_timeout(500)
 contact=page.evaluate('''async()=>{const T=await import('/node_modules/three/build/three.module.js'),{PICK_TIP,PICK_CONTACT}=await import('/src/pickaxe.js');const w=mcDebug.world;w.queuedHit=false;w.hitAt=w.time-PICK_CONTACT;w.last=performance.now();w.update(true);w.graph.updateMatrixWorld(true);const tip=w.pickTool.localToWorld(PICK_TIP.clone()),top=w.hero.localToWorld(new T.Vector3(0,1.26,.3));return{error:tip.distanceTo(top),tip:tip.toArray(),top:top.toArray(),minToolY:new T.Box3().setFromObject(w.pickTool).min.y,angle:w.pickTool.rotation.z}}''')
 assert contact['error']<.002 and abs(contact['angle']+1.5708)<.01 and contact['minToolY']>=contact['top'][1]-.002,contact;result['pickaxeContact']=contact
 page.screenshot(path=str(out/'63-pixel-pickaxe.png'))
 page.evaluate("async()=>{const {completeFixture}=await import('/scripts/fixtures.mjs');const s=completeFixture();s.money=1e6;delete s.counts.L10;delete s.counts.L11;mcDebug.setState(s)}")
 page.locator('[data-nav=build]').click();page.locator('[data-open=owned]').click();assert page.locator('.owned-section').count()==2
 assert page.locator('[data-card=L10]').count()==0;assert page.locator('[data-card=X2]').count()==0
 assert page.locator('[data-card=T1] .complete-badge').count()==1 and page.locator('[data-buy=T1]').count()==0
 page.screenshot(path=str(out/'64-owned-facilities.png'))
 page.locator('[data-detail=V4]').click();page.locator('[data-crop=pumpkin]').click();assert page.evaluate("mcDebug.state.crops.selected==='pumpkin' && mcDebug.state.crops.owned.pumpkin")
 page.locator('[data-crop=carrot]').click();assert page.evaluate("mcDebug.state.crops.selected==='carrot'")
 page.screenshot(path=str(out/'65-farm-shop.png'))
 farm=page.evaluate('''async()=>{const T=await import('/node_modules/three/build/three.module.js'),w=mcDebug.world;return new T.Box3().setFromObject(w.roots.V4).min.y;}''');assert abs(farm-.16)<.03,farm
 page.locator('[data-nav=live]').click();page.wait_for_selector('.live-page');page.locator('[data-studio-tab=equipment]').click()
 page.locator('[data-buy=L10]').click();assert page.evaluate('mcDebug.state.counts.L10===1');assert page.locator('.live-page').count()==1
 page.screenshot(path=str(out/'66-studio-equipment.png'))
 # A new title owns precisely one item. A preview never changes money or equipment.
 page.locator('#collection-open').click();page.locator('[data-extra-buy=title-1]').click()
 assert page.evaluate("mcDebug.state.collection.equipped.title==='title-1' && !mcDebug.state.collection.owned['title-2']")
 page.screenshot(path=str(out/'61-collection-shop.png'));before=page.evaluate('JSON.stringify(mcDebug.state.collection)');page.locator('[data-preview=title-2]').click();assert page.evaluate('JSON.stringify(mcDebug.state.collection)')==before
 page.locator('[data-preview-close]').click();page.locator('[data-collection-tab=frame]').click();page.locator('[data-extra-buy=frame-1]').click();assert page.locator('body').get_attribute('data-frame')=='frame-1'
 page.locator('[data-collection-tab=studio]').click();page.locator('[data-extra-buy=studioWall-1]').click();page.locator('[data-extra-buy=studioDesk-1]').click()
 assert page.evaluate("mcDebug.state.collection.equipped.studioWall==='studioWall-1' && mcDebug.state.collection.equipped.studioDesk==='studioDesk-1'")
 page.locator('#modal-close').click();page.wait_for_timeout(400);page.locator('[data-studio-tab=program]').click();page.screenshot(path=str(out/'67-personal-studio.png'))
 page.locator('#studio-back').click();page.locator('#collection-open').click();page.locator('[data-collection-tab=world]').click()
 for id in ['world-day','world-weather','world-rain','world-snow','world-fireflies','world-meteor']:
  page.locator('[data-extra-buy='+id+']').click()
 page.locator('[data-weather]').select_option('rain');page.locator('[data-cycle]').uncheck();page.locator('[data-phase]').fill('0.8');page.locator('#modal-close').click();page.locator('[data-nav=world]').click();page.wait_for_timeout(600)
 assert page.evaluate('mcDebug.world.atmosphereView.particles.visible && mcDebug.world.atmosphereView.glows.visible')
 page.screenshot(path=str(out/'68-rainy-night.png'))
 # Explicit lifecycle simulation: all queues and scenery time remain unchanged.
 pause=page.evaluate('''async()=>{window.dispatchEvent(new Event('blur'));const snapshot=()=>JSON.stringify({money:mcDebug.state.money,clock:mcDebug.state.atmosphere.clock,buffers:mcDebug.state.buffers,harvest:mcDebug.state.harvest});const before=snapshot();await new Promise(r=>setTimeout(r,1200));const same=before===snapshot();window.dispatchEvent(new Event('focus'));return same;}''');assert pause
 page.locator('#collection-open').click();page.locator('[data-weather]').select_option('snow');page.locator('#modal-close').click()
 # Geometry cost and responsive shop navigation stay bounded.
 metrics=page.evaluate('''async()=>{const w=mcDebug.world;let rebuilds=0;const old=w.buildInstances;w.buildInstances=function(...a){rebuilds++;return old.apply(this,a)};const times=[];for(let i=0;i<6;i++){const t=performance.now();document.querySelector('[data-nav='+(i%2?'world':'build')+']').click();times.push(performance.now()-t);await new Promise(r=>setTimeout(r,420));}w.buildInstances=old;const frames=[];let last;await new Promise(done=>{function f(t){if(last)frames.push(t-last);last=t;if(frames.length<60)requestAnimationFrame(f);else done()}requestAnimationFrame(f)});frames.sort((a,b)=>a-b);return{rebuilds,maxClick:Math.max(...times),frameMedian:frames[30],frameP95:frames[57],drawCalls:w.renderer.info.render.calls,triangles:w.renderer.info.render.triangles};}''');assert metrics['rebuilds']==0,metrics
 page.set_viewport_size({'width':390,'height':844});page.locator('#collection-open').click();page.wait_for_timeout(500);page.screenshot(path=str(out/'69-weather-shop-phone.png'))
 page.locator('[data-collection-tab=cursor]').click();page.locator('[data-extra-buy=cursor-2]').click();page.screenshot(path=str(out/'70-cursor-shop-phone.png'))
 assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
 page.locator('#modal-close').click();page.locator('[data-nav=build]').click();page.locator('[data-open=owned]').click();page.locator('[data-detail=V4]').click();page.locator('[data-crop=potato]').click();page.screenshot(path=str(out/'71-farm-phone.png'))
 page.locator('[data-nav=live]').click();page.wait_for_selector('.live-page');page.locator('[data-studio-tab=equipment]').click();page.screenshot(path=str(out/'72-equipment-phone.png'))
 for width,height in [(360,800),(844,390),(768,1024)]:
  page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(450);assert not page.evaluate('document.documentElement.scrollWidth>innerWidth'),(width,height)
 page.locator('#collection-open').click();page.locator('[data-collection-tab=world]').click();page.locator('#modal-close').click()
 page.evaluate('mcDebug.state.reducedMotion=true');page.locator('#studio-back').click();page.wait_for_timeout(450);assert not page.evaluate('mcDebug.world.atmosphereView.particles.visible')
 result.update({'errors':errors,'ownedTabs':True,'facilityPurchases':True,'singleItemOwnership':True,'previewDoesNotEquip':True,'studioIndependentSlots':True,'foregroundPause':pause,'cropGroundY':farm,'performance':metrics,'mobile':True})
 assert not errors,errors
 (out/'collection-observations.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False));b.close()
