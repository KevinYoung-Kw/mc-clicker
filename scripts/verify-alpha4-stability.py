"""Real placement/upgrade controls and the version log, in isolated test saves."""
from pathlib import Path
import argparse,json,time
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
a=argparse.ArgumentParser();a.add_argument('--url',default='http://127.0.0.1:8917/');a.add_argument('--out',default='docs/v1.7/qa/alpha4-stability');a.add_argument('--engines',default='chromium:1440,webkit:390,chromium:320');args=a.parse_args()
out=ROOT/args.out;out.mkdir(parents=True,exist_ok=True)
seed=json.loads((ROOT/'docs/v1.6/qa/stability-baseline/fixtures/peak.json').read_text());seed.update(money=2e15,reducedMotion=True,skipPurchaseConfirmation=True);seed['upgrades']['levels'].pop('drill-steel',None);seed['counts']['M9']=3;seed['guidance']['notices']=False
reports=[]
with sync_playwright() as p:
 for setting in args.engines.split(','):
  engine,width=setting.split(':');width=int(width);mobile=width<760
  browser=getattr(p,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}))
  context=browser.new_context(viewport={'width':width,'height':900 if not mobile else 844},is_mobile=mobile,has_touch=mobile)
  context.add_init_script('if(!localStorage.getItem("mc-clicker-world-v2"))localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(seed))+')')
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def press(q):
   el=page.locator(q).first;el.tap() if mobile else el.click()
  def screenshot(name):page.screenshot(path=str(out/f'{name}-{engine}-{width}.png'))
  def open_item(id):
   press('[data-nav="atlas"]');press(f'[data-detail="{id}"]')
  def visible_area():
   return page.evaluate('''()=>{const w=mcDebug.world;return {visible:w.availableSurface?.root.visible===true,parent:w.availableSurface?.root.parent===w.markerGroup,vertices:w.availableSurface?.root.children[0]?.geometry.attributes.position.count,valid:w.interior?w.studioGhost?.userData.valid:w.outdoorCue?.fill.userData.valid,rotation:w.mode?.rotation,site:w.mode?.site}}''')
  def choose(valid=True,exclude=None):
   for attempt in range(6):
    page.wait_for_timeout(400)
    pt=page.evaluate('''async({valid,exclude})=>{
     const w=mcDebug.world,{canPlace}=await import('/src/layout.js'),{canPlaceStudio}=await import('/src/studio-placement.js'),{Vector3}=await import('/node_modules/three/build/three.module.js');
     const canvas=w.renderer.domElement,b=canvas.getBoundingClientRect(),points=[];
     for(const s of w.interior?w.studioCandidates:w.placementSites){const v=new Vector3(s.x,w.interior?.23:.19,s.z).project(w.camera);points.push({x:b.x+(v.x+1)*b.width/2,y:b.y+(1-v.y)*b.height/2});}
     for(let y=1;y<25;y++)for(let x=1;x<25;x++)points.push({x:b.x+b.width*x/25,y:b.y+b.height*y/25});
     return points.find(p=>{if(p.y<b.top+110||p.y>b.bottom-40||document.elementFromPoint(p.x,p.y)!==canvas)return false;
      const e={clientX:p.x,clientY:p.y},site=w.interior?w.studioSiteAt(e):w.outdoorSiteAt(e);if(!site||exclude&&site.x===exclude.x&&site.z===exclude.z)return false;
      return (w.interior?canPlaceStudio(mcDebug.state,w.mode.key,site):canPlace(mcDebug.state,w.mode.id,site,w.mode.id))===valid;
     });
    }''',{'valid':valid,'exclude':exclude})
    if not pt:break
    page.touchscreen.tap(pt['x'],pt['y']) if mobile else page.mouse.click(pt['x'],pt['y'])
    area=visible_area()
    if area['site'] and area.get('valid')==valid and (not exclude or any(area['site'].get(k)!=exclude.get(k) for k in ['x','z'])):return area
   raise AssertionError(('no clickable site',valid,pt,visible_area()))
  try:
   page.goto(args.url,wait_until='networkidle');page.wait_for_function('!!window.mcDebug?.world')
   # Profile actual purchase handler, including its syncs; verify terrain paths and walkers survive.
   open_item('M9');page.locator('[data-mod-buy="drill-steel"]').scroll_into_view_if_needed()
   page.evaluate('''()=>{const w=mcDebug.world;window.upgradeBefore={nav:w.navigation,walkers:w.walkers.map(a=>({id:a.person?.id||a.id,x:a.x,z:a.z,path:a.path})),root:w.roots.M9};window.syncTimes=[];window.motionKept=[];const sync=w.sync.bind(w);w.sync=function(s){const before=this.walkers.map(a=>({x:a.x,z:a.z,path:a.path})),root=this.roots.M9;let t=performance.now();const result=sync(s);syncTimes.push(performance.now()-t);if(root!==this.roots.M9)motionKept.push(this.walkers.every((a,i)=>a.x===before[i]?.x&&a.z===before[i]?.z&&a.path===before[i]?.path));return result}}''')
   press('[data-mod-buy="drill-steel"]');page.wait_for_function('mcDebug.state.upgrades.levels["drill-steel"]===1')
   upgrade=page.evaluate('''()=>({syncMs:syncTimes.filter(t=>t>.5),navReused:upgradeBefore.nav===mcDebug.world.navigation,modelRebuilt:upgradeBefore.root!==mcDebug.world.roots.M9,walkerMotionPreserved:motionKept.every(Boolean)})''')
   print(engine,width,upgrade,flush=True)
   assert upgrade['navReused'] and upgrade['modelRebuilt'] and upgrade['walkerMotionPreserved'],upgrade
   screenshot('upgrade')
   # A valid selection stays green while rotating, invalid selection, and selecting again.
   press('[data-move="M9"]');initial=visible_area();assert initial['visible'] and initial['parent'],initial
   rotation=[]
   for i in range(4):
    press('#placement-rotate');area=visible_area();assert area['visible'] and area['parent'],area;rotation.append(area)
   selected=choose();assert selected['visible'] and selected['valid'],selected
   screenshot('placement-valid')
   invalid=choose(False);assert invalid['visible'] and not invalid['valid'],invalid
   selected=choose();assert selected['visible'] and selected['valid'],selected
   screenshot('placement-reselected')
   press('#placement-cancel');assert page.evaluate('mcDebug.world.availableSurface===null')
   # An actual layout change must invalidate navigation, unlike an upgrade.
   press('[data-move="M9"]');old=page.evaluate('({...mcDebug.state.placements.M9})');press('#home-view');choose(exclude=old)
   page.evaluate('window.previousNav=mcDebug.world.navigation');press('#placement-confirm')
   moved=page.evaluate('({site:mcDebug.state.placements.M9,navChanged:previousNav!==mcDebug.world.navigation})')
   assert moved['site']!=old and moved['navChanged'],moved
   # Indoor equipment uses the same range/candidate semantics.
   open_item('L2')
   if page.locator('[data-enter-studio]').count():press('[data-enter-studio]')
   page.wait_for_timeout(300)
   # Select owned equipment through the room inventory.
   press('[data-room-tab="arrange"]');press('[data-room-select="L3:0"]');press('[data-room-move="L3:0"]')
   indoor=visible_area();assert indoor['visible'],indoor
   press('#placement-rotate');assert visible_area()['visible']
   indoor=choose();assert indoor['visible'] and indoor['valid'],indoor;screenshot('studio-placement');press('#placement-cancel')
   # All major releases, keyboard navigation and mobile scroll to the earliest entry.
   if not page.locator('#info-open').is_visible():press('#hud-more')
   press('#info-open');press('#info-tab-versions')
   assert page.locator('#info-versions').is_visible()
   assert page.locator('.version-history>li').count()==8
   assert page.locator('#info-news').is_hidden() and page.locator('#info-guide').is_hidden()
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   screenshot('versions-top')
   await_theme=page.evaluate('''async()=>{const {applyWebAppearance}=await import('/src/appearance-view.js');applyWebAppearance(mcDebug.state,{...mcDebug.state.webAppearance.equipped,theme:'web-theme-end'})}''')
   screenshot('versions-dark')
   page.evaluate('''async()=>{const {applyWebAppearance}=await import('/src/appearance-view.js');applyWebAppearance(mcDebug.state)}''')
   page.locator('.version-history>li').last.scroll_into_view_if_needed();screenshot('versions-oldest')
   if not mobile:
    page.locator('#info-tab-versions').focus();page.keyboard.press('ArrowRight');assert page.locator('#info-news').is_visible()
    page.keyboard.press('End');assert page.locator('#info-versions').is_visible()
    page.keyboard.press('ArrowLeft');assert page.locator('#info-guide').is_visible()
   press('#modal-close');page.reload(wait_until='networkidle');page.wait_for_function('!!window.mcDebug?.world')
   assert page.evaluate('mcDebug.state.upgrades.levels["drill-steel"]')==1
   assert not errors,errors
   reports.append({'engine':engine,'width':width,'upgrade':upgrade,'rotation':rotation,'invalid':invalid,'selected':selected,'move':moved,'studio':indoor,'versions':8,'errors':errors})
   (out/'browser-report.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2))
  except Exception:
   screenshot('failure');raise
  finally:browser.close()
 (out/'browser-report.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2))
print(json.dumps(reports,ensure_ascii=False))
