"""Native SVG hotspots plus one real land placement per cursor, using an isolated save."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/v1.7/qa/appearance-polish'
f=json.loads((ROOT/'docs/v1.6/qa/stability-baseline/fixtures/peak.json').read_text());f['money']=1e12;f['guidance']['notices']=False
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--use-angle=metal']);page=b.new_page(viewport={'width':1440,'height':960});page.goto('http://127.0.0.1:8890/',wait_until='networkidle');page.wait_for_function('!!window.mcDebug?.world');page.evaluate('s=>mcDebug.setState(s)',f)
 pixels=page.evaluate('''async()=>{const {WEB_ITEMS}=await import('/src/web-catalog.js'),{cursorArt,cursorHotspot}=await import('/src/web-cursors.js');const result=[];for(const i of WEB_ITEMS.filter(i=>i.slot==='cursor')){for(const state of ['default','pointer','grab','grabbing']){const [x,y]=cursorHotspot(i.id,state),img=new Image();img.src='data:image/svg+xml,'+encodeURIComponent(cursorArt(i.id,state));await img.decode();const c=document.createElement('canvas');c.width=c.height=32;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);result.push({id:i.id,state,hotspot:[x,y],alpha:ctx.getImageData(x,y,1,1).data[3]});}}return result}''')
 assert all(x['alpha']>0 for x in pixels),pixels
 placements=[]
 for id in list(dict.fromkeys(x['id'] for x in pixels)):
  page.evaluate('''async id=>{const {applyWebAppearance}=await import('/src/appearance-view.js');mcDebug.state.webAppearance.owned[id]=true;mcDebug.state.webAppearance.equipped.cursor=id;applyWebAppearance(mcDebug.state)}''',id)
  if not page.locator('[data-expand-land]').is_visible():page.locator('[data-nav=build]').click()
  page.locator('[data-expand-land]').click();page.wait_for_function('mcDebug.world.mode?.kind==="expand"');page.wait_for_timeout(400)
  targets=page.evaluate('''async()=>{const {frontier}=await import('/src/game.js'),w=mcDebug.world,r=w.renderer.domElement.getBoundingClientRect();return frontier(mcDebug.state).map(s=>{const v=w.camera.position.clone().set(s.x*5,.16,s.z*5).project(w.camera);return {site:s,x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2}}).filter(p=>p.x>250&&p.x<1000&&p.y>180&&p.y<620)}''')
  assert targets,id
  target=targets[0];page.mouse.click(target['x'],target['y']);page.wait_for_function('!document.querySelector("#placement-confirm").disabled')
  before=page.evaluate('mcDebug.state.chunks.overworld.length');page.locator('#placement-confirm').click();page.wait_for_function('n=>mcDebug.state.chunks.overworld.length===n+1',arg=before)
  placements.append({'cursor':id,'site':target['site'],'built':True})
  if page.locator('#placement-cancel').is_visible():page.locator('#placement-cancel').click()
  print(id,'placement passed',flush=True)
  page.wait_for_timeout(1100)  # Respect the existing 0.9 s land construction animation.
 (OUT/'hotspots.json').write_text(json.dumps({'pixels':pixels,'placements':placements},indent=2));b.close()
