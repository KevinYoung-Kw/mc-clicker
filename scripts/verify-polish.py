import sys
from pathlib import Path
import json,hashlib
from playwright.sync_api import sync_playwright
OUT=Path('docs/qa');errors=[]
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--use-angle=metal'] if sys.platform=='darwin' else []);page=b.new_page(viewport={'width':1440,'height':960});page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8890/');page.wait_for_load_state('networkidle')
 initial=page.locator('[data-nav]:visible').all_text_contents();assert len(initial)==2,initial
 page.locator('#settings').click();assert page.locator('#cosmetic-settings').count()==0;page.locator('#modal-close').click()
 page.locator('[data-nav=build]').click();page.wait_for_selector('[data-icon=T1]');page.wait_for_function("document.querySelector('[data-icon=T1]')?.naturalWidth===192")
 page.screenshot(path=str(OUT/'40-progressive-opening.png'))
 page.evaluate("async()=>{const {completeFixture}=await import('/scripts/fixtures.mjs');mcDebug.setState(completeFixture());}");page.locator('[data-nav=world]').click();page.wait_for_timeout(700)
 navigation=page.evaluate('''()=>{const w=mcDebug.world;const positions=w.walkers.map(a=>[a.x,a.z]);let wallViolations=0,pairViolations=0,edgeViolations=0;for(let t=0;t<1200;t++){w.time+=.05;w.updateWalkers(.05);for(const a of w.walkers.filter(a=>a.active)){if(!w.navigation.clear(a.x,a.z,a.radius))wallViolations++;if(!w.navigation.onLand(a.x,a.z))edgeViolations++;}for(let i=0;i<w.walkers.length;i++)for(let j=i+1;j<w.walkers.length;j++){const a=w.walkers[i],c=w.walkers[j];if(a.active&&c.active&&Math.hypot(a.x-c.x,a.z-c.z)<a.radius+c.radius-.001)pairViolations++;}}return{actors:w.walkers.length,active:w.walkers.filter(a=>a.active).length,moved:w.walkers.filter((a,i)=>Math.hypot(a.x-positions[i][0],a.z-positions[i][1])>.2).length,wallViolations,pairViolations,edgeViolations,obstacles:w.colliders.length};}''')
 assert navigation['wallViolations']==0,navigation;assert navigation['pairViolations']==0,navigation;assert navigation['edgeViolations']==0,navigation;assert navigation['moved']>5,navigation
 page.screenshot(path=str(OUT/'41-walkable-world.png'))
 # Nothing about opening, closing or choosing a site should reconstruct the island.
 cache=page.evaluate('''()=>{const w=mcDebug.world;let builds=0;const original=w.buildInstances;w.buildInstances=function(...a){builds++;return original.apply(this,a)};const same=w.graph;for(let i=0;i<6;i++){document.querySelector('[data-nav=build]').click();document.querySelector('[data-nav=world]').click();}w.setMode({id:'V1',kind:'expand'});w.setMode(null);const panelBuilds=builds;w.setView('nether');w.setView('end');w.setView('overworld');const warmed=builds;w.setView('nether');w.setView('end');w.setView('overworld');return{panelBuilds,firstRealmBuilds:warmed-panelBuilds,repeatedRealmBuilds:builds-warmed,restoresSameGraph:w.graph===same};}''')
 assert cache['panelBuilds']==0,cache;assert cache['repeatedRealmBuilds']==0,cache;assert cache['restoresSameGraph'],cache
 # Also validate the independent Nether and End walkers and flying model visibility.
 realms=page.evaluate('''async()=>{const T=await import('/node_modules/three/build/three.module.js');const w=mcDebug.world,result={};for(const realm of ['nether','end']){w.setView(realm);w.target.copy(w.center);w.update(true);let blocked=0;for(let j=0;j<600;j++){w.time+=.05;w.updateWalkers(.05);for(const a of w.walkers.filter(a=>a.active))if(!w.navigation.clear(a.x,a.z,a.radius))blocked++;}const flyers={};for(const id of ['N6','N9','E9'])if(w.roots[id]){const center=new T.Box3().setFromObject(w.roots[id]).getCenter(new T.Vector3()).project(w.camera);flyers[id]={x:center.x,y:center.y};}result[realm]={walkers:w.walkers.length,active:w.walkers.filter(a=>a.active).length,blocked,flyers};}w.setView('overworld');return result;}''')
 for data in realms.values():
  assert data['blocked']==0 and data['walkers']==data['active'],data
  for point in data['flyers'].values():assert abs(point['x'])<1 and abs(point['y'])<1,point
 page.locator('[data-nav=build]').click();page.locator('[data-open=owned]').click();page.wait_for_timeout(500);page.screenshot(path=str(OUT/'42-real-item-icons.png'))
 page.locator('#settings').click();page.locator('#cosmetic-settings').click();assert page.locator('[data-cosmetic]').count()==4;page.locator('#modal-close').click()
 # A partial customization save reveals only the purchased capability.
 page.evaluate("async()=>{const {fresh}=await import('/src/game.js');const s=fresh();s.counts={T1:1,X2:1,X3:1};mcDebug.setState(s);}");page.locator('#settings').click();page.locator('#cosmetic-settings').click();assert page.locator('[data-cosmetic]').count()==1;assert page.locator('[data-cosmetic=title]').count()==1;assert page.locator('#cursor-setting').count()==0;page.locator('#modal-close').click()
 # Contact sheet renders the exact public assets, no fallback paths.
 ids=json.loads(Path('public/icons/manifest.json').read_text())['ids'];assert len(ids)==96
 hashes=[hashlib.sha256(Path(f'public/icons/{id}.png').read_bytes()).hexdigest() for id in ids];assert len(set(hashes))==96, len(set(hashes))
 sheet=b.new_page(viewport={'width':1440,'height':960});sheet.set_content('<body style="background:#f2f0e4;font:14px sans-serif;display:grid;grid-template-columns:repeat(12,1fr);gap:8px">'+''.join(f'<div style="text-align:center"><img src="http://127.0.0.1:8890/icons/{id}.png" width="92" height="92"><br>{id}</div>' for id in ids)+'</body>');sheet.wait_for_load_state('networkidle');sheet.screenshot(path=str(OUT/'43-icon-contact-sheet.png'),full_page=True)
 assert not errors,errors
 result={'initialToolbar':initial,'navigation60Seconds':navigation,'sceneCache':cache,'otherRealms':realms,'icons':{'count':96,'uniqueImages':96},'errors':errors};(OUT/'polish-observations.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False,indent=2));b.close()
