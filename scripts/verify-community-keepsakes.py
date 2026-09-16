"""Isolated real controls: discover/claim/place/cancel/rotate/store/reload, small screens."""
import json,subprocess,base64
from pathlib import Path
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1];out=R/'docs/v1.8/qa/community-keepsakes';out.mkdir(parents=True,exist_ok=True)
seed=json.loads(subprocess.check_output(['node','--input-type=module','-e','''
import fs from 'node:fs';import {restore,sites,buy} from './src/game.js';import {noteCommunityAction,discoverCommunityWealth}from './src/community-stories.js';
const s=restore(JSON.parse(fs.readFileSync('docs/v1.8/qa/shopping-recommendations/seed.json')),0);s.play=2400;s.money=1e8;s.reducedMotion=true;s.sound=false;s.guidance.notices=false;s.narrative.openingChoice='returning';s.narrative.companionsShown=true;s.editing.gardenContinuous=true;s.counts.X1=1;s.skipBuildConfirmation=false;
for(let x=-2;x<=2;x++)for(let z=-2;z<=2;z++)if(!s.chunks.overworld.some(c=>c.x===x&&c.z===z))s.chunks.overworld.push({x,z});
s.counts.V1=s.chunks.overworld.length;if(!s.counts.V20){s.counts.V20=1;s.placements.V20=sites(s,'overworld',null,'V20')[0];}
noteCommunityAction(s,'versions',{random:()=>0});discoverCommunityWealth(s,()=>0);s.communityStories.unlocked.push('village-stage');s.communityStories.rolled.push('community-stage');s.communityStories.triggers['community-stage']=s.play;
console.log(JSON.stringify(s));'''],cwd=R,text=True))
(out/'seed.json').write_text(json.dumps(seed,ensure_ascii=False));reports=[]
with sync_playwright() as p:
 for engine,width in [('chromium',1440),('webkit',390),('chromium',320)]:
  b=getattr(p,engine).launch(headless=True);c=b.new_context(viewport={'width':width,'height':900 if width>760 else 844},is_mobile=width<760,has_touch=width<760)
  c.add_init_script('if(!localStorage.getItem("mc-clicker-world-v2"))localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(seed))+')')
  page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def click(q):
   print(engine,width,q,flush=True);page.locator(q).first.click()
  def pause():page.evaluate('window.dispatchEvent(new Event("blur"))')
  def open_garden():
   click('[data-nav="atlas"]');click('[data-detail="V20"]');click('[data-garden-tab="souvenirs"]')
  def choose():
   page.wait_for_timeout(400)
   points=page.evaluate('''()=>{const w=mcDebug.world,canvas=w.renderer.domElement,b=canvas.getBoundingClientRect(),points=[];for(let y=1;y<30;y++)for(let x=1;x<30;x++){const p={x:b.x+b.width*x/31,y:b.y+b.height*y/31};if(document.elementFromPoint(p.x,p.y)!==canvas)continue;const q=w.outdoorSiteAt({clientX:p.x,clientY:p.y});if(q&&w.placementSites.some(k=>Math.abs(k.x-q.x)<.01&&Math.abs(k.z-q.z)<.01))points.push(p);}return points;}''')
   for point in points:
    page.touchscreen.tap(point['x'],point['y']) if width<760 else page.mouse.click(point['x'],point['y'])
    if page.locator('#placement-confirm').is_enabled():return
   raise AssertionError('No valid visible garden site')
  try:
   page.goto('http://127.0.0.1:8932/',wait_until='networkidle');page.wait_for_function('window.mcDebug?.world');pause();open_garden()
   assert page.locator('[data-souvenir]').count()==3
   if width<760:click('#panel-expand')
   page.screenshot(path=str(out/f'collection-{engine}-{width}.png'))
   initial=page.evaluate('mcDebug.state.money');click('[data-souvenir-claim="village-stage"]');assert page.locator('[data-souvenir-claim="village-stage"]').count()==0
   assert page.evaluate('mcDebug.state.garden.stored["village-stage"]')==1
   click('[data-garden-plant="village-stage"]');click('#placement-cancel');assert page.evaluate('mcDebug.state.garden.stored["village-stage"]')==1
   click('[data-garden-plant="village-stage"]');click('#placement-rotate');choose();page.screenshot(path=str(out/f'placement-{engine}-{width}.png'));click('#placement-confirm')
   assert page.evaluate('mcDebug.state.garden.plants.filter(p=>p.type==="village-stage").length')==1
   assert page.evaluate('mcDebug.state.garden.plants.find(p=>p.type==="village-stage").rotation')==1
   assert page.evaluate('mcDebug.state.money')==initial
   assert not page.locator('#placement-bar').is_visible()
   assert page.evaluate('mcDebug.state.editing.gardenContinuous') is True
   click('[data-souvenir-find]');click('[data-garden-clear]');assert page.evaluate('mcDebug.state.garden.stored["village-stage"]')==1
   page.evaluate('mcDebug.save()');page.reload(wait_until='networkidle');page.wait_for_function('window.mcDebug?.world');pause();open_garden()
   assert page.locator('[data-souvenir-claim="village-stage"]').count()==0;assert page.evaluate('mcDebug.state.garden.stored["village-stage"]')==1
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert not errors,errors
   reports.append({'engine':engine,'width':width,'claimOnce':True,'cancelPreservesStock':True,'rotateAndPlace':True,'noCharge':True,'storeReload':True,'noOverflow':True,'errors':errors})
  except Exception:
   page.screenshot(path=str(out/f'failure-{engine}-{width}.png'));print(errors);raise
  finally:b.close()
(out/'report.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2));print(reports)
