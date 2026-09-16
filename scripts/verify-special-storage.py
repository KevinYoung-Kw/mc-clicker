"""Real controls on isolated saves; paused economy for deterministic storage checks."""
import json,base64
from pathlib import Path
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1];out=R/'docs/v1.8/qa/special-storage';out.mkdir(parents=True,exist_ok=True)
seed=json.loads((R/'docs/v1.6/qa/stability-baseline/fixtures/peak.json').read_text());seed.update(money=1e8,reducedMotion=True,skipBuildConfirmation=False,energy=0)
seed['guidance']['notices']=False;seed['narrative'].update(companionsShown=True,intro='released')
for r in seed['community']['residents']:r.update(job='idle',prioritySource=None,cargo=None)
for g in seed['community']['golems']:g.update(stops=[],cargo=None)
seed['community'].update(batches=[],tasks={})
for k in seed['grid']['automation']:seed['grid']['automation'][k]=0
for b in seed['buffers'].values():b.update(raw=0,goods=0)
seed['live']['gifts']=[];seed['harvest'].update(piston=0,treasure=0)
seed['dimensions'].update(heat=0,trips={},awaiting={'endRaw':0,'endGoods':0})
reports=[]
with sync_playwright() as p:
 for engine,width in [('chromium',1440),('webkit',390),('chromium',320)]:
  browser=getattr(p,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}));ctx=browser.new_context(viewport={'width':width,'height':844},is_mobile=width<760,has_touch=width<760)
  ctx.add_init_script('if(!localStorage.getItem("mc-clicker-world-v2"))localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(seed))+')')
  page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def click(q):
   print(engine,width,q,flush=True);page.locator(q).first.click()
  def shot(name):page.screenshot(path=str(out/f'{name}-{engine}-{width}.png'))
  def pause():
   page.evaluate('''()=>{window.dispatchEvent(new Event('blur'));const s=mcDebug.state;s.energy=0;for(const b of Object.values(s.buffers)){b.raw=0;b.goods=0;}s.live.gifts=[];s.dimensions.heat=0;s.dimensions.trips={};s.dimensions.awaiting={endRaw:0,endGoods:0};s.community.batches=[];s.community.tasks={};s.harvest.piston=0;s.harvest.treasure=0;}''')
  def goto():
   page.goto('http://127.0.0.1:8932/',wait_until='networkidle');page.wait_for_function('window.mcDebug?.world');pause()
  def choose():
   page.wait_for_timeout(350)
   point=page.evaluate('''()=>{const w=mcDebug.world,canvas=w.renderer.domElement,b=canvas.getBoundingClientRect();for(let y=2;y<24;y++)for(let x=1;x<24;x++){const p={x:b.x+b.width*x/25,y:b.y+b.height*y/25};if(document.elementFromPoint(p.x,p.y)!==canvas)continue;const q=w.outdoorSiteAt({clientX:p.x,clientY:p.y});if(q&&w.placementSites.some(k=>Math.abs(k.x-q.x)<.01&&Math.abs(k.z-q.z)<.01))return p;}}''')
   assert point,'no visible site';page.touchscreen.tap(point['x'],point['y']) if width<760 else page.mouse.click(point['x'],point['y'])
   assert page.locator('#placement-confirm').is_enabled()
  try:
   goto()
   if engine=='chromium' and width==1440:
    art=page.evaluate('''async()=>{const T=await import('/node_modules/three/build/three.module.js'),{homeModel}=await import('/src/housing-models.js'),{HOME_BY_ID}=await import('/src/housing-data.js');const scene=new T.Scene(),root=homeModel(HOME_BY_ID.cottage),r=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});r.setSize(256,256);r.setClearColor(0,0);scene.add(root);scene.add(new T.HemisphereLight('#fff6df','#78846a',2.1));const sun=new T.DirectionalLight('#fff0d2',3.2);sun.position.set(-4,8,5);scene.add(sun);const c=new T.OrthographicCamera(-.8,.8,.8,-.8,.05,60);c.position.set(6,5.3,8);c.lookAt(0,.5,0);r.render(scene,c);const image=r.domElement.toDataURL();r.dispose();return image;}''');(R/'public/icons/home-cottage.png').write_bytes(base64.b64decode(art.split(',')[1]))
   # Mail has its own UI, but uses the same storage/return flow.
   click('[data-nav="atlas"]');click('[data-detail="V18"]');assert page.locator('[data-mail-store]').is_visible();shot('mail-tools');click('[data-mail-store]');click('#store-cancel');assert page.evaluate('!!mcDebug.state.placements.V18')
   click('[data-mail-store]');click('#store-confirm');assert page.evaluate('mcDebug.state.facilityStorage.V18===true');shot('mail-stored');page.evaluate('mcDebug.save()')
   page.reload(wait_until='networkidle');page.wait_for_function('window.mcDebug?.world');pause();click('[data-nav="atlas"]');click('[data-detail="V18"]');assert page.locator('[data-buy="V18"]').inner_text().strip()=='免费摆回';click('[data-buy="V18"]');choose();click('#placement-confirm');assert page.evaluate('!mcDebug.state.facilityStorage.V18 && !!mcDebug.state.placements.V18')
   # Network entries are named, not two indistinguishable box icons.
   click('[data-nav="atlas"]');click('[data-detail="M4"]');click('[data-nav="network"]');assert page.locator('[data-building-details="M4"]').is_visible();assert page.locator('[data-building-details="M5"]').is_visible();shot('network-tools');click('[data-building-details="M4"]');click('[data-facility-store="M4"]');click('#store-confirm');assert page.evaluate('mcDebug.state.facilityStorage.M4===true')
   click('[data-nav="atlas"]');click('[data-detail="L2"]');click('[data-room-tab="equipment"]');assert page.locator('[data-facility-store="L2"]').is_visible();before=page.evaluate('mcDebug.state.studio.placements');shot('studio-tools');click('[data-facility-store="L2"]');click('#store-confirm');assert page.evaluate('mcDebug.state.facilityStorage.L2===true');assert not page.locator('body').evaluate("e=>e.classList.contains('live-page')");assert page.evaluate('mcDebug.state.studio.placements')==before;shot('studio-stored')
   # Third early home is a real catalogue entry with actual art.
   click('[data-nav="village"]');click('[data-village-tab="housing"]');click('[data-home-tab="build"]');assert page.locator('[data-home-product="cottage"]').is_visible();page.wait_for_function('document.querySelector("[data-home-product=cottage] img")?.naturalWidth>0')
   if width<760 and page.locator('#panel-expand').get_attribute('aria-expanded')!='true':click('#panel-expand')
   page.locator('[data-home-product="cottage"]').scroll_into_view_if_needed();page.wait_for_timeout(200);shot('cottage')
   click('[data-home-build="cottage"]');click('#placement-cancel')
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert not errors,errors
   reports.append({'engine':engine,'width':width,'mailCancelStoreReloadReplace':True,'networkTools':True,'studioStoragePreservesLayout':True,'cottageEntry':True,'errors':errors})
  except Exception:
   shot('failure');print(errors,flush=True);raise
  finally:browser.close()
(out/'report.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2));print(reports)
