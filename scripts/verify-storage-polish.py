"""V1.8 storage and continuous world editing in isolated desktop/mobile saves."""
import json,base64
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];out=ROOT/'docs/v1.8/qa/storage-polish';out.mkdir(parents=True,exist_ok=True)
seed=json.loads((ROOT/'docs/v1.6/qa/stability-baseline/fixtures/peak.json').read_text());seed.update(money=1e8,reducedMotion=True,skipBuildConfirmation=False)
seed['guidance']['notices']=False;seed['narrative'].update(companionsShown=True,intro='released')
for r in seed['community']['residents']:r.update(job='idle',prioritySource=None,cargo=None)
for g in seed['community']['golems']:g.update(stops=[],cargo=None)
seed['community'].update(batches=[],tasks={});seed['counts']['V2']=1;seed['community']['residents']=seed['community']['residents'][:1]
for b in seed['buffers'].values():b.update(raw=0,goods=0,delivered=0)
reports=[]
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--use-angle=metal']);page=b.new_page();page.goto('http://127.0.0.1:8932/scripts/v16-study/garden-art.html',wait_until='networkidle');page.wait_for_function('window.gardenArtReady')
 for id in ['lotus','fallenlog','hydrangea']:
  data=page.evaluate('(id)=>gardenArt[id]',id);(ROOT/f'public/icons/garden-{id}.png').write_bytes(base64.b64decode(data.split(',')[1]))
  bounds=page.evaluate('(id)=>gardenArtBounds.find(x=>x.id===id)',id);assert bounds['fits'],bounds
 page.screenshot(path=str(out/'garden.png'),full_page=True);b.close()
 for engine,width in [('chromium',1440),('webkit',390),('chromium',320)]:
  browser=getattr(p,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}));ctx=browser.new_context(viewport={'width':width,'height':844},is_mobile=width<760,has_touch=width<760)
  ctx.add_init_script('if(!localStorage.getItem("mc-clicker-world-v2"))localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(seed))+')')
  page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def press(q):
   print(engine,width,q,flush=True);page.locator(q).first.click()
  def pic(name):page.screenshot(path=str(out/f'{name}-{engine}-{width}.png'))
  def choose():
   page.wait_for_timeout(450)
   pt=page.evaluate('''async()=>{
    const w=mcDebug.world,s=mcDebug.state,m=w.mode,{Vector3}=await import('/node_modules/three/build/three.module.js'),{canPlace}=await import('/src/layout.js'),{housingPlacementReason}=await import('/src/housing.js'),{gardenPlacementReason}=await import('/src/garden.js');
    const canvas=w.renderer.domElement,b=canvas.getBoundingClientRect(),points=[];
    for(const p of w.placementSites||[]){const v=new Vector3(p.x,.19,p.z).project(w.camera);points.push({x:b.x+(v.x+1)*b.width/2,y:b.y+(1-v.y)*b.height/2});}
    for(let y=3;y<25;y++)for(let x=1;x<25;x++)points.push({x:b.x+b.width*x/25,y:b.y+b.height*y/25});
    return points.find(p=>{if(document.elementFromPoint(p.x,p.y)!==canvas)return false;const q=w.outdoorSiteAt({clientX:p.x,clientY:p.y});if(!q)return false;
     return m.kind.startsWith('home-')?!housingPlacementReason(s,m.type,q,m.moveId):m.kind.startsWith('garden-')?!gardenPlacementReason(s,m.type,q,m.moveId):canPlace(s,m.id,q,m.kind==='move'?m.id:null);
    });
   }''')
   assert pt,'no visible valid position'
   page.touchscreen.tap(pt['x'],pt['y']) if width<760 else page.mouse.click(pt['x'],pt['y'])
   assert page.locator('#placement-confirm').is_enabled(),page.locator('#placement-label').inner_text()
  try:
   page.goto('http://127.0.0.1:8932/',wait_until='networkidle');page.wait_for_function('window.mcDebug?.world')
   press('[data-nav="atlas"]');press('[data-detail="M15"]');assert page.locator('[data-facility-store="M15"]').is_visible()
   press('[data-facility-store="M15"]');press('#store-cancel');assert page.evaluate('!!mcDebug.state.placements.M15')
   press('[data-facility-store="M15"]');press('#store-confirm');assert page.evaluate('mcDebug.state.facilityStorage.M15===true');pic('stored')
   page.reload(wait_until='networkidle');page.wait_for_function('window.mcDebug?.world');assert page.evaluate('!mcDebug.state.placements.M15 && mcDebug.state.facilityStorage.M15')
   press('[data-nav="atlas"]');press('[data-detail="M15"]');press('[data-buy="M15"]');press('#placement-cancel');assert page.evaluate('mcDebug.state.facilityStorage.M15')
   press('[data-buy="M15"]');choose();press('#placement-confirm');assert page.evaluate('!mcDebug.state.facilityStorage.M15 && !!mcDebug.state.placements.M15');pic('replaced')
   press('[data-nav="village"]');press('[data-building-arrange]');assert page.locator('#placement-cancel').inner_text()=='完成整理';pic('arrange')
   # Select a real visible facility by hit-testing before performing a real pointer click.
   point=page.evaluate('''()=>{const w=mcDebug.world,c=w.renderer.domElement,b=c.getBoundingClientRect();for(let y=8;y<34;y++)for(let x=2;x<38;x++){const p={x:b.x+b.width*x/40,y:b.y+b.height*y/40};if(document.elementFromPoint(p.x,p.y)!==c)continue;const d=w.pick({clientX:p.x,clientY:p.y})?.userData;if(d?.item&&mcDebug.state.placements[d.item])return {...p,id:d.item};}}''');assert point
   page.mouse.click(point['x'],point['y']);assert page.evaluate('mcDebug.world.mode.kind')=='move';before=page.evaluate('(id)=>mcDebug.state.placements[id]',point['id']);press('#placement-rotate');press('#placement-cancel');assert page.evaluate('mcDebug.world.mode.kind')=='building-edit';assert page.evaluate('(id)=>mcDebug.state.placements[id]',point['id'])==before
   page.mouse.click(point['x'],point['y']);assert page.evaluate('mcDebug.world.mode.kind')=='move'
   for _ in range(4):press('#placement-rotate')
   assert page.locator('#placement-confirm').is_enabled();press('#placement-confirm');assert page.evaluate('mcDebug.world.mode.kind')=='building-edit'
   press('#placement-cancel');press('[data-village-tab="housing"]');occupied=page.locator('[data-home-store]').first
   occupied.click();assert not page.locator('#store-confirm').count() # no silent eviction
   empty=page.evaluate('mcDebug.state.housing.homes.find(h=>h.type!=="legacy"&&!Object.values(mcDebug.state.housing.assignments).some(a=>a.homeId===h.id))');assert empty
   before=page.evaluate('(type)=>mcDebug.state.housing.stored[type]||0',empty['type']);press('[data-home-store="'+empty['id']+'"]');press('#store-confirm');assert page.evaluate('(type)=>mcDebug.state.housing.stored[type]',empty['type'])==before+1;pic('empty-home')
   press('[data-home-build="'+empty['type']+'"]');choose();press('#placement-confirm');assert page.evaluate('(type)=>mcDebug.state.housing.stored[type]||0',empty['type'])==before
   if width<760:press('#hud-more')
   press('#settings');press('#power-lines-setting');press('#logistics-lines-setting');pic('lines');assert page.evaluate('mcDebug.state.editing.lines.power===false && mcDebug.state.editing.lines.logistics===false')
   press('#modal-close');page.reload(wait_until='networkidle');page.wait_for_function('window.mcDebug?.world');assert page.evaluate('mcDebug.state.editing.lines.power===false')
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert not errors,errors
   reports.append({'engine':engine,'width':width,'storageCancelReload':True,'freeFacilityReplace':True,'freeHomeReplace':True,'arrangeConfirmCancel':True,'emptyHomeStorage':True,'occupiedBlocked':True,'displayPrefsReload':True,'errors':errors})
  except Exception:
   pic('failure');print(errors,flush=True);raise
  finally:browser.close()
(out/'report.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2));print(reports)
