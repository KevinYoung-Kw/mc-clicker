from pathlib import Path
import argparse,json,subprocess
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--baseline',action='store_true');p.add_argument('--url',default='http://127.0.0.1:8890/');args=p.parse_args()
fixture=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {residentFixture} from './scripts/resident-fixture.mjs';const s=residentFixture();s.community.golems[0].stops=[];s.narrative.companionsShown=true;s.narrative.intro='released';s.guidance.notices=false;console.log(JSON.stringify(s));"],cwd=ROOT))
reports=[]
with sync_playwright() as p:
 for engine,width in ([('chromium',1440)] if args.baseline else [('chromium',1440),('webkit',390),('chromium',320)]):
  browser=getattr(p,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}));context=browser.new_context(viewport={'width':width,'height':900 if width>760 else 844},is_mobile=width<760,has_touch=width<760)
  context.add_init_script('if(!localStorage.getItem("mc-clicker-world-v2"))localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(fixture))+')');page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def press(q):
   b=page.locator(q).first;b.tap() if width<760 else b.click()
  def golem():return page.evaluate('JSON.parse(localStorage.getItem("mc-clicker-world-v2")).community.golems[0]')
  def open_golem():
   press('[data-nav="village"]');press('[data-village-tab="helpers"]');press('[data-person="golem-1"]')
  page.goto(args.url,wait_until='networkidle');open_golem()
  press('[data-route-stop][value="V4"]');press('[data-route-stop][value="M1"]');before=golem()['stops'];press('[data-golem-upgrade="basket"]');after=golem()['stops']
  checked=page.locator('[data-route-stop]:checked').evaluate_all('els=>els.map(e=>e.value)')
  if not args.baseline:
   assert set(before)=={'V4','M1'},before;assert set(after)==set(before);assert set(checked)==set(before)
   press('[data-route-stop][value="M2"]');assert set(golem()['stops'])==set(before)
   assert not page.locator('[data-route-stop][value="M2"]').is_checked()
   press('[data-golem-upgrade="route"]');assert set(golem()['stops'])==set(before)
   press('[data-route-stop][value="M2"]');assert set(golem()['stops'])=={'V4','M1','M2'}
   page.reload(wait_until='networkidle');open_golem();assert set(page.locator('[data-route-stop]:checked').evaluate_all('els=>els.map(e=>e.value)'))=={'V4','M1','M2'}
   if width<760:press('#panel-expand')
   page.locator('[data-route-status]').scroll_into_view_if_needed()
   page.screenshot(path=str(ROOT/f'docs/v1.6/qa/alpha3/golem-{engine}-{width}.png'))
  assert not errors,errors;reports.append({'engine':engine,'width':width,'beforeUpgradeSaved':before,'afterUpgradeSaved':after,'afterUpgradeChecked':checked,'errors':errors});context.close();browser.close()
path=ROOT/'docs/v1.6/qa/alpha3'/('golem-baseline.json' if args.baseline else 'golem-browser.json');path.write_text(json.dumps(reports,ensure_ascii=False,indent=2)+'\n');print(json.dumps(reports,ensure_ascii=False))
