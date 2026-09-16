"""Real pointer flows against the production build, with an isolated test save."""
import argparse, json, subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser()
parser.add_argument('--url',default='http://127.0.0.1:8894/')
parser.add_argument('--out',default='docs/v1.6/qa/world-editing')
parser.add_argument('--engines',default='chromium:1440,webkit:390,chromium:320')
args=parser.parse_args();out=ROOT/args.out;out.mkdir(parents=True,exist_ok=True)
fixture=json.loads(subprocess.check_output(['node','--input-type=module','-e','''
import {fresh,buy} from './src/game.js';
import {buyEarlyGuidance} from './scripts/early-fixture.mjs';
import {worldScenery} from './src/layout.js';
const s=fresh(42);s.money=1e8;s.play=1200;s.counts.T1=1;
for(const [x,z] of [[0,0],[1,0],[0,1],[-1,0],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){const r=buy(s,'V1',{x,z,realm:'overworld'});if(!r.ok)throw Error(r.reason);}
buyEarlyGuidance(s);Object.assign(s.counts,{V20:3,V4:1,M16:1,X1:1});
s.placements.V20={x:-5,z:-5,realm:'overworld'};s.placements.V4={x:4,z:-4,realm:'overworld'};s.placements.M16={x:0,z:-5,realm:'overworld'};
s.garden.cleared=worldScenery(s).filter(p=>p.native).map(p=>p.id);
s.guidance.notices=false;s.guidance.counter=true;s.narrative.companionsShown=true;s.narrative.intro='released';s.narrative.legacy=true;s.reducedMotion=true;s.savedAt=1;
console.log(JSON.stringify(s));'''],cwd=ROOT))
reports=[]
with sync_playwright() as p:
 for spec in args.engines.split(','):
  engine,width=spec.split(':');width=int(width);mobile=width<760
  browser=getattr(p,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}))
  context=browser.new_context(viewport={'width':width,'height':844},is_mobile=mobile,has_touch=mobile)
  context.add_init_script('if(!localStorage.getItem("mc-clicker-world-v2"))localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(fixture))+')')
  page=context.new_page();errors=[];failed=[];flows=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('response',lambda r:failed.append(r.url) if r.status>=400 else None)
  def press(q):
   loc=page.locator(q).first
   loc.tap() if mobile else loc.click()
  def saved():return page.evaluate('JSON.parse(localStorage.getItem("mc-clicker-world-v2"))')
  def durable(data):
   value=json.loads(json.dumps({key:data[key] for key in ['editing','land','garden','placements']}))
   value['garden'].pop('revision',None)
   value['garden']['stored']={k:v for k,v in value['garden']['stored'].items() if v>0}
   for objects in value['land']['scenery'].values():
    for obj in objects:obj.setdefault('scale',1);obj.setdefault('variant',0)
   return value
  def screenshot(name):page.screenshot(path=str(out/f'{name}-{engine}-{width}.png'))
  def stage_points():
   box=page.locator('#world canvas').bounding_box()
   points=[(box['x']+box['width']*x/24,box['y']+box['height']*y/32) for y in range(1,31) for x in range(1,24)]
   points.sort(key=lambda pt:(pt[0]-box['x']-box['width']/2)**2+(pt[1]-box['y']-box['height']/2)**2)
   return points
  def choose(condition=None):
   page.wait_for_timeout(250)
   for x,y in stage_points():
    if not page.evaluate('p=>document.elementFromPoint(p.x,p.y)===document.querySelector("#world canvas")',{'x':x,'y':y}):continue
    page.touchscreen.tap(x,y) if mobile else page.mouse.click(x,y)
    if page.locator('#placement-confirm').is_enabled() and (condition is None or condition()):return x,y
   screenshot('failed-choice');raise AssertionError('No valid visible position')
  def open_shop():
   press('[data-nav="build"]')
   if page.locator('#first-shop-all').count():press('#first-shop-all')
  def open_facility(ident):
   press('[data-nav="atlas"]');press(f'[data-detail="{ident}"]')
  try:
   page.goto(args.url,wait_until='networkidle');page.wait_for_selector('#world canvas')
   assert page.evaluate('typeof window.mcDebug')=='undefined'
   open_shop();press('[data-expand-land]');press('#placement-repeat')
   assert page.locator('#placement-repeat').get_attribute('aria-pressed')=='true'
   # Finishing continuous mode never commits the currently previewed parcel.
   before=saved();choose();press('#placement-cancel')
   assert len(saved()['chunks']['overworld'])==len(before['chunks']['overworld'])
   assert saved()['money']>=before['money']
   press('[data-expand-land]');assert page.locator('#placement-repeat').get_attribute('aria-pressed')=='true'
   for n in range(1,6):
    old=saved();choose();screenshot('continuous-land') if n==1 else None
    press('#placement-confirm')
    page.wait_for_function('n=>JSON.parse(localStorage.getItem("mc-clicker-world-v2")).chunks.overworld.length===n',arg=9+n)
    assert saved()['land']['purchased']['overworld']==9+n
    expected=int(__import__('math').ceil(25*1.65**(8+n)))
    assert abs((old['money']-saved()['money'])-expected)<50
    assert page.locator('#placement-bar').is_visible()
    assert page.locator('#placement-confirm').is_disabled()
   flows.append('five consecutive land purchases: new site each time, prices, no automatic reconfirmation')
   press('#placement-land-mode');choose();press('#placement-confirm')
   assert len(saved()['land']['stored']['overworld'])==1
   assert len(saved()['chunks']['overworld'])==13
   press('#placement-undo');assert len(saved()['chunks']['overworld'])==14
   assert page.locator('#placement-undo').is_hidden()
   choose();press('#placement-confirm');press('#placement-land-mode')
   assert '不扣绿宝石' in page.locator('#placement-detail').inner_text()
   before=saved()['money'];choose();press('#placement-confirm')
   assert len(saved()['land']['stored']['overworld'])==0
   assert saved()['land']['purchased']['overworld']==14
   assert saved()['money']>=before
   assert page.locator('#placement-undo').is_hidden(),'reused parcel still offers undo'
   screenshot('stored-land');press('#placement-cancel')
   flows.append('store empty land, undo once, store and re-place free without reducing land prices')
   open_facility('M16');press('[data-move="M16"]')
   old=saved()['placements']['M16'];press('#placement-rotate');screenshot('facility-turn')
   assert '朝向 90°' in page.locator('#placement-detail').inner_text()
   press('#placement-cancel');assert saved()['placements']['M16']==old
   press('[data-move="M16"]');press('#placement-rotate');press('#placement-confirm')
   turned=saved()['placements']['M16'];assert turned['rotation']==1
   assert (turned['x'],turned['z'])==(old['x'],old['z'])
   flows.append('rectangular facility: cancel keeps orientation; confirm rotates in place')
   open_facility('V20')
   if mobile and page.locator('#panel-expand').get_attribute('aria-expanded')!='true':press('#panel-expand')
   page.locator('[data-garden-continuous]').evaluate('e=>window.originalContinuous=e')
   press('[data-garden-continuous]');page.wait_for_timeout(350)
   assert page.locator('[data-garden-continuous]').evaluate('e=>e===window.originalContinuous'),'toggle replaced itself and lost focus'
   press('[data-garden-level="trees"]');press('[data-garden-plant="hedge"]');press('#placement-rotate')
   hint=page.locator('#placement-detail').inner_text()
   for n in range(1,6):
    choose();press('#placement-confirm')
    assert len(saved()['garden']['plants'])==n
    assert saved()['garden']['plants'][-1]['rotation']==1
    assert page.locator('#placement-confirm').is_disabled()
    assert page.locator('#placement-detail').inner_text()==hint
   screenshot('continuous-garden');press('#placement-cancel')
   # Arrangement stays continuous regardless of the planting preference.
   press('[data-garden-continuous]')
   assert page.locator('[data-garden-continuous]').get_attribute('aria-pressed')=='false'
   flows.append('five consecutive rotated hedges, orientation retained, old site cleared')
   press('[data-garden-tab="arrange"]');press('[data-garden-edit]')
   choose();selected=page.locator('#placement-label').inner_text();press('#placement-confirm')
   assert len(saved()['garden']['plants'])==4
   press('#placement-undo');assert len(saved()['garden']['plants'])==5
   choose();old_plants=saved()['garden']['plants'];press('#placement-move');press('#placement-rotate');press('#placement-cancel')
   assert saved()['garden']['plants']==old_plants
   assert '先选择布景' in page.locator('#placement-confirm').inner_text()
   choose();press('#placement-move');choose();press('#placement-confirm')
   assert '先选择布景' in page.locator('#placement-confirm').inner_text()
   assert len(saved()['garden']['plants'])==5
   screenshot('garden-arrange');press('#placement-cancel')
   assert page.locator('.garden-panel').is_visible()
   flows.append('world garden selection, return to storage, undo, move and remain in arrange mode, return to same panel')
   before=saved();page.reload(wait_until='networkidle');page.wait_for_selector('#world canvas')
   after=saved()
   assert durable(after)==durable(before),'durable layout or preferences changed on reload'
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
   assert not errors,errors
   assert not failed,failed
   flows.append('save/reload preferences, orientation, parcels and garden; no overflow or console errors')
   reports.append({'engine':engine,'width':width,'version':json.loads((ROOT/'package.json').read_text())['version'],'errors':errors,'failedResources':failed,'flows':flows})
   print(engine,width,'passed',flush=True)
  except Exception:
   screenshot('failure');print(page.locator('#placement-bar').inner_text(),errors,flush=True);raise
  finally:context.close();browser.close()
(out/'report.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2)+'\n')
