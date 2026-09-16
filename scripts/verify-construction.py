from pathlib import Path
from playwright.sync_api import sync_playwright
import json, argparse
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://127.0.0.1:8890/');parser.add_argument('--out',default='docs/v1.4.1/qa/construction');args=parser.parse_args()
out=ROOT/args.out;out.mkdir(parents=True,exist_ok=True)
results=[]
with sync_playwright() as p:
 for engine,width,height in [('chromium',1440,960),('webkit',390,844),('chromium',320,740)]:
  b=getattr(p,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}))
  c=b.new_context(viewport={'width':width,'height':height},is_mobile=width<760,has_touch=width<760)
  page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(args.url,wait_until='networkidle')
  def shot(name):
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   box=page.locator('#placement-bar').bounding_box();assert box['y']>=0 and box['y']+box['height']<=height+1
   page.screenshot(path=out/f'{engine}-{width}-{name}.png')
  def net():return page.evaluate('mcDebug.state.money-mcDebug.state.total')
  def clicksite(site,room=False):
   xy=page.evaluate('''({site,room})=>{const w=mcDebug.world,r=w.renderer.domElement.getBoundingClientRect(),p=w.center.clone().set(site.x,room?.2:.19,site.z).project(w.camera);return{x:r.x+(p.x+1)*r.width/2,y:r.y+(1-p.y)*r.height/2}}''',dict(site=site,room=room))
   if width<760:page.touchscreen.tap(xy['x'],xy['y'])
   else:page.mouse.click(xy['x'],xy['y'])
   page.wait_for_timeout(500)
  page.evaluate('''async()=>{const {fresh,buy}=await import('/src/game.js');const s=fresh();s.money=10000;s.guidance.goals=true;for(const id of ['T1','V1','V18','V2']){const r=buy(s,id);if(!r.ok)throw Error(id+r.reason)}s.sound=false;mcDebug.setState(s);mcDebug.world.onAction({type:'select',id:'L1'})}''')
  page.locator('[data-buy="L1"]').click();page.wait_for_timeout(800);shot('world-area')
  site=page.evaluate('mcDebug.world.placementSites[0]');before=net()
  assert page.evaluate('mcDebug.world.markers.length===0')
  alpha=page.evaluate('mcDebug.world.availableSurface.fill.material.opacity');page.wait_for_timeout(450)
  assert abs(page.evaluate('mcDebug.world.availableSurface.fill.material.opacity')-alpha)>.002
  page.evaluate('mcDebug.state.reducedMotion=true');page.wait_for_timeout(120)
  alpha=page.evaluate('mcDebug.world.availableSurface.fill.material.opacity');page.wait_for_timeout(200)
  assert page.evaluate('mcDebug.world.availableSurface.fill.material.opacity')==alpha
  page.evaluate('mcDebug.state.reducedMotion=false')
  # Dragging the scene while placing cannot choose or buy a building.
  rect=page.locator('#world canvas').bounding_box();x=rect['x']+rect['width']/2;y=rect['y']+100
  page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+35,y+20,steps=5);page.mouse.up()
  assert page.evaluate('mcDebug.world.mode.site===null')
  page.locator('.home-view').click();page.wait_for_timeout(600)
  clicksite(dict(x=0,z=0));shot('world-blocked');assert page.locator('#placement-confirm').is_disabled()
  clicksite(site);shot('world-preview');assert page.locator('#placement-confirm').is_enabled()
  assert abs(net()-before)<.001
  page.locator('#placement-cancel').click();assert abs(net()-before)<.001
  assert not page.evaluate('mcDebug.state.sound');assert page.evaluate('!mcDebug.world.outdoorGhost && !mcDebug.world.availableSurface')
  page.locator('[data-buy="L1"]').click();page.wait_for_timeout(650);clicksite(site)
  page.locator('#placement-confirm').click();page.wait_for_timeout(700)
  assert abs(net()-(before-300))<.001
  assert page.evaluate('mcDebug.audio.snapshot().decks===1 && !mcDebug.audio.snapshot().failure')
  page.evaluate('mcDebug.state.sound=false;mcDebug.save()');page.reload(wait_until='networkidle')
  assert not page.evaluate('mcDebug.state.sound');page.locator('#mine').click();page.wait_for_timeout(300)
  assert page.evaluate('mcDebug.audio.snapshot().decks===0')
  print(engine,width,'purchase, mute, cancel, pulse and dragging passed',flush=True)
  page.evaluate('mcDebug.world.onAction({type:"select",id:"V1"})');page.locator('[data-buy="V1"]').click();page.wait_for_timeout(650);shot('land-area')
  land=page.evaluate('mcDebug.world.placementSites[0]');clicksite(land);shot('land-preview')
  assert page.locator('#placement-confirm').is_enabled();page.locator('#placement-cancel').click()
  seed=json.loads((ROOT/'docs/qa/v13/fixture.json').read_text());seed['money']=1000000;seed['counts']['L3']=0;seed['studio']={'version':1,'placements':{},'revision':0}
  page.evaluate('(s)=>{mcDebug.setState(s);mcDebug.go("live")}',seed);page.wait_for_timeout(1500)
  page.locator('[data-room-tab="equipment"]').click();page.locator('[data-buy="L3"]').click();page.wait_for_timeout(800);shot('room-area')
  candidate=page.evaluate('mcDebug.world.studioCandidates[0]');clicksite(candidate,True);shot('room-preview');assert page.locator('#placement-confirm').is_enabled()
  page.locator('#placement-cancel').click();assert not errors,errors
  results.append(dict(engine=engine,width=width,construction=True,expansion=True,studio=True,audio=True,pulse=True,reducedMotion=True,errors=errors))
  c.close();b.close()
(out/'results.json').write_text(json.dumps(results,indent=2)+'\n')
