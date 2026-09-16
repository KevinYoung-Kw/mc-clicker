"""Public-service branches through production UI only, isolated saves."""
import argparse,json,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
a=argparse.ArgumentParser();a.add_argument('--url',default='http://127.0.0.1:8945/');a.add_argument('--engines',default='chromium:1440,chromium:320,webkit:390');a.add_argument('--xhs',action='store_true');a.add_argument('--out',default='docs/v2.0.0/qa/alpha2-civic');args=a.parse_args();out=ROOT/args.out;out.mkdir(parents=True,exist_ok=True)
seed=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {residentFixture} from './scripts/resident-fixture.mjs';import {prepareResearchFor} from './scripts/research-fixture.mjs';import {buy,sites,frontier} from './src/game.js';const s=residentFixture();for(const id of ['V21','V25']){prepareResearchFor(s,id);while(!sites(s,'overworld',null,id).length)buy(s,'V1',frontier(s)[0]);buy(s,id);}for(let n=0;n<3;n++)buy(s,'V1',frontier(s)[0]);s.narrative.companionsShown=true;s.narrative.openingChoice='returning';s.guidance.notices=false;s.reducedMotion=true;console.log(JSON.stringify(s))"],cwd=ROOT,text=True))
rows=[]
with sync_playwright() as pw:
 for spec in args.engines.split(','):
  engine,width=spec.split(':');width=int(width)
  mobile=width<760;b=getattr(pw,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}));ctx=b.new_context(viewport={'width':width,'height':900 if not mobile else 844},is_mobile=mobile,has_touch=mobile)
  ctx.add_init_script('if(!localStorage.getItem("mc-clicker-world-v2"))localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(seed))+')')
  p=ctx.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.goto(args.url,wait_until='networkidle')
  if args.xhs:p.locator('#xhs-start button').click()
  def press(q):
   el=p.locator(q).first;el.tap() if mobile else el.click()
  def saved():return p.evaluate('JSON.parse(localStorage.getItem("mc-clicker-world-v2"))')
  def shot(name):p.screenshot(path=str(out/f'{name}-{engine}-{width}.png'))
  def choose():
   p.wait_for_timeout(300);box=p.locator('#world canvas').bounding_box();pts=[(box['x']+box['width']*x/26,box['y']+box['height']*y/30) for y in range(1,29) for x in range(1,26)];pts.sort(key=lambda pt:(pt[0]-box['x']-box['width']/2)**2+(pt[1]-box['y']-box['height']/2)**2)
   for x,y in pts:
    if not p.evaluate('p=>document.elementFromPoint(p.x,p.y)===document.querySelector("#world canvas")',{'x':x,'y':y}):continue
    p.touchscreen.tap(x,y) if mobile else p.mouse.click(x,y)
    if p.locator('#placement-confirm').is_enabled():return
   shot('no-valid-position');raise AssertionError('No valid position')
  try:
   press('[data-nav="village"]');press('[data-life-open]');press('[data-civic-build="V25"]');choose();press('#placement-cancel');assert not saved()['life']['sites']
   press('[data-civic-build="V25"]');press('#placement-rotate');choose();shot('preview');before=saved();press('#placement-confirm');p.wait_for_function('JSON.parse(localStorage.getItem("mc-clicker-world-v2")).life.sites.length===1');after=saved();item=after['life']['sites'][0];assert item['rotation']==1
   cost=before['money']+after['total']-before['total']-(after['life']['spent']-before['life']['spent'])-after['money'];assert abs(cost-3900)<1
   p.locator('[data-civic-move]').scroll_into_view_if_needed();shot('services');assert p.locator('#panel-content').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
   press('[data-civic-move]');press('#placement-rotate');choose();press('#placement-confirm');assert saved()['life']['sites'][0]['rotation']==2
   press('[data-civic-store]');press('#civic-store');assert saved()['life']['sites'][0]['stored']
   press('[data-civic-move]');choose();before=saved();press('#placement-confirm');after=saved();assert not after['life']['sites'][0]['stored'];assert abs(before['money']+after['total']-before['total']-(after['life']['spent']-before['life']['spent'])-after['money'])<1
   expected=after['life']['sites'];p.reload(wait_until='networkidle')
   if args.xhs:press('#xhs-start button')
   assert saved()['life']['sites']==expected;assert not p.locator('#fallback').is_visible();assert not errors,errors
   press('[data-nav="village"]');press('[data-life-open]');p.locator('[data-life-service="V25"]').scroll_into_view_if_needed();shot('restored')
   rows.append({'engine':engine,'width':width,'cancel':True,'paidBuild3900':True,'rotate':True,'storeAndReplaceFree':True,'reloadExact':True,'noOverflow':True,'noPageErrors':True});print(rows[-1],flush=True);(out/'report.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
  except Exception:
   shot('failure');print('ERRORS',errors,p.evaluate('()=>[...document.querySelectorAll("#panel-content *")].filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>({tag:e.tagName,cls:e.className,width:e.getBoundingClientRect().width}))'),flush=True);(out/'failure.txt').write_text(p.locator('body').inner_text());raise
  finally:b.close()
