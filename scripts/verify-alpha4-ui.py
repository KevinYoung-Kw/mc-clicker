"""Isolated production UI: stable camera, terrain editing and independent farms."""
import argparse,json,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
a=argparse.ArgumentParser();a.add_argument('--url',default='http://127.0.0.1:8971/');a.add_argument('--xhs',action='store_true');a.add_argument('--theme',default='');a.add_argument('--engines',default='chromium:1440,chromium:320,webkit:390');a.add_argument('--out',default='docs/v2.0.0/qa/alpha4');args=a.parse_args();out=(root/args.out).resolve();out.mkdir(parents=True,exist_ok=True)
seed=json.loads(subprocess.check_output(['node','--input-type=module','-e','''
import {residentFixture} from './scripts/resident-fixture.mjs';import {buy,sites,frontier} from './src/game.js';
const s=residentFixture();s.play=1800;while(!sites(s,'overworld',null,'V20').length)buy(s,'V1',frontier(s)[0]);let r=buy(s,'V20');if(!r.ok)throw Error(r.reason);
for(const id of ['V4','V7'])while(s.counts[id]<(id==='V4'?6:4)){r=buy(s,id);if(!r.ok)throw Error(r.reason);}
for(let i=0;i<3;i++)buy(s,'V1',frontier(s)[0]);s.guidance.notices=false;s.narrative.companionsShown=true;s.narrative.openingChoice='returning';s.reducedMotion=true;s.sound=false;
console.log(JSON.stringify(s));'''],cwd=root,text=True))
if args.theme:
 seed['webAppearance']['owned'][args.theme]=True;seed['webAppearance']['equipped']['theme']=args.theme
rows=[]
with sync_playwright() as pw:
 for spec in args.engines.split(','):
  engine,width=spec.split(':');w=int(width);mobile=w<760;h=900 if not mobile else 844
  b=getattr(pw,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}));ctx=b.new_context(viewport={'width':w,'height':h},has_touch=mobile,is_mobile=mobile)
  ctx.add_init_script('if(!sessionStorage.getItem("alpha4-seed")){localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(seed))+');sessionStorage.setItem("alpha4-seed","1")}')
  p=ctx.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
  def press(q):
   el=p.locator(q).first;el.tap() if mobile else el.click()
  def saved():return p.evaluate('JSON.parse(localStorage.getItem("mc-clicker-world-v2"))')
  def shot(name):p.screenshot(path=str(out/f'{name}-{engine}-{w}.png'))
  def rect():return p.locator('#world canvas').bounding_box()
  def same(a,b):assert all(abs(a[k]-b[k])<.5 for k in a),(a,b)
  def choose():
   p.wait_for_timeout(350);box=rect();pts=[(box['x']+box['width']*x/25,box['y']+box['height']*y/32) for y in range(1,30) for x in range(1,25)]
   pts.sort(key=lambda pt:(pt[0]-box['x']-box['width']/2)**2+(pt[1]-box['y']-box['height']*.45)**2)
   for x,y in pts:
    if not p.evaluate('p=>document.elementFromPoint(p.x,p.y)===document.querySelector("#world canvas")',{'x':x,'y':y}):continue
    p.touchscreen.tap(x,y) if mobile else p.mouse.click(x,y)
    if p.locator('#placement-confirm').is_enabled():return
   raise AssertionError('No reachable valid placement on visible canvas')
  try:
   p.goto(args.url,wait_until='networkidle')
   if args.xhs:press('#xhs-start button')
   p.wait_for_timeout(450);initial=rect();shot('world-before')
   for nav in ['build','village','network']:
    press(f'[data-nav="{nav}"]');p.wait_for_timeout(350);same(initial,rect())
    if mobile:
     if p.locator('#panel-expand').get_attribute('aria-expanded')!='true':press('#panel-expand')
     p.wait_for_timeout(350);same(initial,rect());assert p.locator('#stage').evaluate('e=>e.inert')
     press('#panel-expand');p.wait_for_timeout(350);same(initial,rect())
    press('#panel-close');p.wait_for_timeout(350);same(initial,rect());assert not p.locator('#stage').evaluate('e=>e.inert')
   shot('world-after')
   press('[data-nav="build"]');press('[data-open="owned"]');press('[data-detail="V20"]')
   if mobile:press('#panel-expand')
   assert p.locator('.terrain-row').count()==9
   assert p.locator('#panel-content').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
   shot('terrain')
   press('[data-garden-brush="2"]');assert p.locator('[data-garden-brush="2"]').get_attribute('aria-pressed')=='true'
   press('[data-garden-continuous]');assert p.locator('[data-garden-continuous]').get_attribute('aria-pressed')=='true'
   p.locator('[data-garden-continuous]').evaluate('e=>{window.qaNode=e;e.focus();}');p.wait_for_timeout(1100);assert p.evaluate('window.qaNode===document.querySelector("[data-garden-continuous]")&&document.activeElement===window.qaNode')
   press('[data-garden-continuous]');press('[data-garden-terrain="grassDark"]');choose();shot('terrain-placement');before=saved();press('#placement-cancel');after=saved();assert before['garden']['terrain']==after['garden']['terrain']
   press('[data-garden-brush="1"]');press('[data-garden-terrain="grassDark"]');choose();press('#placement-confirm');p.wait_for_timeout(250);assert 'grassDark' in saved()['garden']['terrain'].values()
   press('#panel-close');press('[data-nav="build"]');press('[data-open="owned"]');press('[data-detail="V4"]')
   if mobile and p.locator('#panel-expand').get_attribute('aria-expanded')!='true':press('#panel-expand')
   assert p.locator('[data-civic-build="V4"]').is_enabled();press('[data-civic-build="V4"]');choose();press('#placement-cancel');assert not saved()['life']['sites']
   press('[data-civic-build="V4"]');press('#placement-rotate');choose();shot('farm-placement');before=saved();press('#placement-confirm');p.wait_for_timeout(250);after=saved();branch=after['life']['sites'][0];assert branch['type']=='V4' and branch['rotation']==1
   cost=before['money']+after['total']-before['total']-(after['life']['spent']-before['life']['spent'])-after['money'];assert abs(cost-1388)<1,cost
   if mobile and p.locator('#panel-expand').get_attribute('aria-expanded')!='true':press('#panel-expand')
   p.locator('.farm-sites').scroll_into_view_if_needed();shot('farm-sites');assert p.locator('[data-farm-site]').count()==2
   assert p.locator('#panel-content').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
   p.locator('[data-farm-staff]').evaluate('e=>{window.qaNode=e;e.focus();}');p.wait_for_timeout(1250);assert p.evaluate('window.qaNode===document.querySelector("[data-farm-staff]")&&document.activeElement===window.qaNode')
   expected=branch['id'];p.reload(wait_until='networkidle')
   if args.xhs:press('#xhs-start button')
   assert saved()['life']['sites'][0]['id']==expected;assert saved()['life']['sites'][0]['rotation']==1
   assert not errors,errors
   rows.append({'engine':engine,'width':w,'theme':args.theme or 'default','stableCanvasRect':True,'expandCollapse':mobile,'terrainRows':9,'terrainPaintCancel':True,'farmPaidBuild':1388,'farmRotateReload':True,'stableFocus':True,'noOverflow':True,'errors':errors});print(rows[-1],flush=True);(out/'report.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
  except Exception:
   shot('failure');(out/f'failure-{engine}-{w}.txt').write_text(p.locator('body').inner_text());print(errors,flush=True);raise
  finally:b.close()
