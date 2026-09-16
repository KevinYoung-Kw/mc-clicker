"""Check actual building controls in isolated desktop/mobile saves."""
import argparse,json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--url',default='http://127.0.0.1:8932/');p.add_argument('--engines',default='chromium:1440,webkit:390,chromium:320');a=p.parse_args()
out=ROOT/'docs/v1.7/qa/building-polish';out.mkdir(parents=True,exist_ok=True)
seed=json.loads((ROOT/'docs/v1.6/qa/stability-baseline/fixtures/peak.json').read_text())
seed.update(money=1000000,reducedMotion=True,skipPurchaseConfirmation=True,skipBuildConfirmation=False)
seed['guidance']['notices']=False;seed['narrative'].update(companionsShown=True,intro='released')
reports=[]
with sync_playwright() as p:
 for config in a.engines.split(','):
  engine,width=config.split(':');width=int(width);mobile=width<760
  browser=getattr(p,engine).launch(headless=True,**({"args":["--use-angle=metal"]} if engine=="chromium" else {}))
  ctx=browser.new_context(viewport={'width':width,'height':844},is_mobile=mobile,has_touch=mobile)
  ctx.add_init_script('if(!localStorage.getItem("mc-clicker-world-v2"))localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(seed))+')')
  page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def press(q):
   print(q,flush=True);b=page.locator(q).first;b.tap() if mobile else b.click()
  def snapshot():return page.evaluate('({homes:mcDebug.state.housing,placements:mcDebug.state.placements,studio:mcDebug.state.studio,editing:mcDebug.state.editing})')
  def screenshot(name):page.screenshot(path=str(out/f'{name}-{engine}-{width}.png'))
  def item(id):press('[data-nav="atlas"]');press(f'[data-detail="{id}"]')
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
   page.touchscreen.tap(pt['x'],pt['y']) if mobile else page.mouse.click(pt['x'],pt['y'])
   assert page.locator('#placement-confirm').is_enabled(),page.locator('#placement-label').inner_text()
  try:
   page.goto(a.url,wait_until='networkidle');page.wait_for_function('!!window.mcDebug?.world')
   assert 'V1.8.0' in page.title()
   # Mail tools are visible before visiting the postal tab.
   item('V18');assert page.locator('[data-mail-tab="letters"]').get_attribute('aria-pressed')=='true'
   assert page.locator('[data-mail-move]').is_visible();screenshot('mail-tools')
   old=snapshot()['placements']['V18'];press('[data-mail-move]')
   assert page.evaluate('mcDebug.world.mode.site.x===mcDebug.state.placements.V18.x')
   press('#placement-rotate');press('#placement-cancel');assert snapshot()['placements']['V18']==old
   press('[data-mail-move]');choose();press('#placement-confirm');assert page.locator('#mail-panel').is_visible()
   # Studio exterior move must leave indoor mode and return intact on cancel/commit.
   item('L2');press('[data-room-tab="arrange"]');assert page.locator('[data-studio-building-move]').is_visible();screenshot('studio-tools')
   before=snapshot();press('[data-studio-building-move]');page.wait_for_function('!mcDebug.world.interior')
   press('#placement-rotate');press('#placement-cancel');page.wait_for_function('mcDebug.world.interior')
   assert snapshot()['placements']['L2']==before['placements']['L2']
   press('[data-studio-building-move]');page.wait_for_function('!mcDebug.world.interior');choose();press('#placement-confirm');page.wait_for_function('mcDebug.world.interior')
   assert snapshot()['studio']['placements']==before['studio']['placements']
   assert page.locator('[data-studio-building-move]').is_visible();press('#studio-back')
   # Every real outdoor catalogue placement can reach an edit tool via its detail.
   ids=page.evaluate('Object.keys(mcDebug.state.placements)')
   audited=[]
   for id in ids:
    if id in ['L2','V18']:continue
    item(id);assert page.locator(f'[data-move="{id}"]').is_visible(),id;audited.append(id)
   # Existing homes start with their own position selected; cancelling a turn is inert.
   press('[data-nav="village"]');press('[data-village-tab="housing"]')
   old=snapshot()['homes']['homes'][0];press(f'[data-home-move="{old["id"]}"]')
   assert page.evaluate('mcDebug.world.mode.site!==null')
   if mobile:press('#placement-rotate')
   else:page.keyboard.press('r')
   assert page.evaluate('mcDebug.world.mode.rotation')==((old.get('rotation',0)+1)%4)
   press('#placement-cancel');assert snapshot()['homes']['homes'][0]==old
   press('[data-home-tab="build"]');press('[data-home-continuous]');press('[data-home-build="hearth"]');press('#placement-rotate')
   count=len(snapshot()['homes']['homes']);rotation=page.evaluate('mcDebug.world.mode.rotation')
   for j in range(2):
    choose();press('#placement-confirm');assert len(snapshot()['homes']['homes'])==count+j+1
    assert page.locator('#placement-bar').is_visible();assert page.evaluate('mcDebug.world.mode.site===null')
    assert page.evaluate('mcDebug.world.mode.rotation')==rotation
    assert page.locator('#placement-confirm').is_disabled()
   screenshot('continuous-housing');press('#placement-cancel');assert len(snapshot()['homes']['homes'])==count+2
   # Fresh build inherits confirmed orientation; cancellation doesn't change it.
   press('[data-home-build="hearth"]');assert page.evaluate('mcDebug.world.mode.rotation')==rotation
   press('#placement-rotate');press('#placement-cancel')
   page.reload(wait_until='networkidle');assert snapshot()['editing']['homeContinuous']
   assert snapshot()['editing']['directions']['home']==rotation
   # Guide and version log point at the real entry and summarize recent changes.
   if not page.locator('#info-open').is_visible():press('#hud-more')
   press('#info-open');press('#info-tab-guide');press('.manual-controls .game-select-trigger');page.get_by_role('option',name='存档与读档',exact=True).click()
   assert '手机先点「菜单」' in page.locator('.manual-page:visible').inner_text();screenshot('save-guide')
   press('#info-tab-versions');assert '住宅支持连续建造' in page.locator('#info-versions').inner_text();screenshot('versions')
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   assert not errors,errors
   reports.append({'engine':engine,'width':width,'outdoorDetails':audited,'mailMove':True,'studioMoveReturn':True,'homeTurnCancel':True,'continuousHomes':2,'directionReload':True,'saveGuide':True,'versions':True,'errors':errors})
   print(engine,width,'passed',flush=True)
  except Exception:
   screenshot('failure');print(errors,flush=True);raise
  finally:ctx.close();browser.close()
(out/'report.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2)+'\n')
