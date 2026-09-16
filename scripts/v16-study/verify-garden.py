from pathlib import Path
import json,subprocess,sys
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'docs/v1.6/qa/garden';OUT.mkdir(parents=True,exist_ok=True)
fixture=json.loads(subprocess.check_output(['node','scripts/resident-fixture.mjs'],cwd=ROOT))
reports=[]
with sync_playwright() as p:
 for engine,width in [('chromium',1440),('webkit',390),('chromium',320)]:
  if len(sys.argv)>1 and sys.argv[1]!=engine:continue
  b=getattr(p,engine).launch(headless=True)
  context=b.new_context(viewport={'width':width,'height':960 if width>760 else 844},is_mobile=width<760,has_touch=width<760)
  page=context.new_page();page.set_default_timeout(12000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:8890/',wait_until='networkidle');page.wait_for_function('window.mcDebug?.world')
  page.evaluate('''s=>{s.play=1200;s.money=1e7;s.reducedMotion=true;s.guidance.notices=false;s.guidance.counter=true;s.narrative.companionsShown=true;s.narrative.intro='released';mcDebug.setState(s);mcDebug.go('build')}''',fixture)
  # Discover and purchase the physical workyard through the same shop and placement.
  page.locator('[data-family="V"]').click()
  # The real catalogue offers five discoveries at once. Atlas opens the same item.
  page.evaluate("mcDebug.go('atlas')")
  page.locator('[data-detail="V20"]').click();page.locator('[data-buy="V20"]').click()
  def pick_site(type=None):
   page.wait_for_timeout(250)
   args={'type':type}
   point=page.evaluate('''async({type})=>{const T=await import('/node_modules/three/build/three.module.js'),G=await import('/src/garden.js');const w=mcDebug.world,s=mcDebug.state,mode=w.mode;let points=type?G.gardenSites(s,type,mode.rotation||0,mode.moveId).filter(p=>!G.gardenPlacementReason(s,type,p,mode.moveId)):w.placementSites;const r=w.renderer.domElement.getBoundingClientRect();for(const p of points){const v=new T.Vector3(p.x,.20,p.z).project(w.camera),x=r.x+(v.x+1)*r.width/2,y=r.y+(1-v.y)*r.height/2;const el=document.elementFromPoint(x,y);if(x>r.x+20&&x<r.right-20&&y>r.y+50&&y<r.bottom-20&&el===w.renderer.domElement)return {x,y,p};}throw Error('No visible legal position');}''',args)
   if width<760:page.touchscreen.tap(point['x'],point['y'])
   else:page.mouse.click(point['x'],point['y'])
   page.wait_for_timeout(150)
   assert page.locator('#placement-confirm').is_enabled(),page.locator('#placement-label').inner_text()
   return point
  pick_site();page.locator('#placement-confirm').click();page.wait_for_timeout(200)
  if not page.locator('.garden-panel').count():page.locator('[data-detail="V20"]').first.click()
  page.wait_for_timeout(200)
  assert page.locator('.garden-panel').is_visible()
  if width<760:page.locator('#panel-expand').click();page.wait_for_timeout(100)
  page.screenshot(path=str(OUT/f'garden-{engine}-{width}-ground.png'))
  # Ground selection, cancelled placement, then a paid placement.
  page.locator('[data-garden-plant="turf"]').click();pick_site('turf');assert page.evaluate('mcDebug.state.garden.plants.length')==0
  page.screenshot(path=str(OUT/f'garden-{engine}-{width}-preview.png'))
  page.locator('#placement-cancel').click();assert page.evaluate('mcDebug.state.garden.plants.length')==0
  page.locator('[data-garden-plant="turf"]').click();pick_site('turf');page.locator('#placement-confirm').click()
  assert page.evaluate('mcDebug.state.garden.plants.length')==1
  page.locator('[data-garden-level="flowers"]').click();page.locator('[data-garden-plant="wildflowers"]').click();pick_site('wildflowers');page.locator('#placement-confirm').click()
  assert page.evaluate('mcDebug.state.garden.plants.length')==2,page.evaluate('({mode:mcDebug.world.mode,plants:mcDebug.state.garden.plants,label:document.querySelector("#placement-label").textContent,errors:document.body.innerText.slice(0,300)})')
  # Upgrade stays in this panel and unlocks the tree collection, without relocating.
  old=page.evaluate('JSON.stringify(mcDebug.state.placements.V20)')
  page.locator('[data-buy="V20"]').click();page.locator('#placement-confirm').click()
  assert page.evaluate('mcDebug.state.counts.V20')==2;assert page.evaluate('JSON.stringify(mcDebug.state.placements.V20)')==old
  page.locator('[data-garden-level="trees"]').click();assert page.locator('[data-garden-plant="bamboo"]').is_enabled()
  # Arrange from the list only. World taps cannot select a plant accidentally.
  page.locator('[data-garden-tab="arrange"]').click()
  planted=page.evaluate('mcDebug.state.garden.plants[1].id')
  while not page.locator(f'[data-garden-object="{planted}"]').count():page.locator('[data-garden-more]').click()
  page.locator(f'[data-garden-object="{planted}"]').click();page.wait_for_timeout(100)
  assert page.evaluate('mcDebug.world.mode.kind')=='garden-edit'
  assert page.evaluate('document.querySelector("#world-controls").hidden')
  assert page.evaluate('(()=>{const w=mcDebug.world,r=w.renderer.domElement.getBoundingClientRect();return w.pick({clientX:r.x+r.width/2,clientY:r.y+r.height/2})===null})()')
  page.locator('[data-garden-move]').click();pick_site('wildflowers');page.locator('#placement-cancel').click()
  assert page.evaluate('mcDebug.world.mode.kind')=='garden-edit'
  page.locator('[data-garden-move]').click();pick_site('wildflowers');page.locator('#placement-confirm').click()
  assert page.evaluate('mcDebug.state.garden.plants.length')==2,page.evaluate('({mode:mcDebug.world.mode,plants:mcDebug.state.garden.plants,label:document.querySelector("#placement-label").textContent,errors:document.body.innerText.slice(0,300)})')
  page.locator('[data-garden-clear]').click();assert page.evaluate('mcDebug.state.garden.plants.length')==1
  page.locator('[data-garden-undo]').click();assert page.evaluate('mcDebug.state.garden.plants.length')==2,page.evaluate('({mode:mcDebug.world.mode,plants:mcDebug.state.garden.plants,label:document.querySelector("#placement-label").textContent,errors:document.body.innerText.slice(0,300)})')
  page.screenshot(path=str(OUT/f'garden-{engine}-{width}-arrange.png'))
  # Normal item/page navigation always removes the garden interaction mode.
  page.locator('[data-nav="build"]').click();assert page.evaluate('mcDebug.world.mode') is None
  saved=page.evaluate('()=>{mcDebug.save();return JSON.parse(JSON.stringify(mcDebug.state.garden))}')
  page.reload(wait_until='networkidle');page.wait_for_function('window.mcDebug?.world')
  assert page.evaluate('mcDebug.state.garden.plants')==saved['plants']
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  assert not errors,errors
  reports.append({'engine':engine,'width':width,'plantsSaved':len(saved['plants']),'errors':errors,'flows':['build workyard','cancel placement','plant ground','plant flowers','upgrade workyard','tree unlock','move cancel','move','clear','undo','exit','reload']})
  print(engine,width,'passed',flush=True);context.close();b.close()
(OUT/'browser-report.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2)+'\n')
