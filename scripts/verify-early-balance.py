"""Real controls on isolated saves: level gates, early iron and postal value."""
from pathlib import Path
import argparse,json,subprocess
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://127.0.0.1:8890/');args=parser.parse_args()
fixture=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {residentFixture} from './scripts/resident-fixture.mjs';const s=residentFixture();for(const id of ['M9','M2','T3']){delete s.counts[id];delete s.placements[id];}s.counts.M1=1;s.narrative.companionsShown=true;s.narrative.intro='released';s.guidance.notices=false;console.log(JSON.stringify(s));"],cwd=ROOT))
reports=[]
with sync_playwright() as p:
 for engine,width in [('chromium',1440),('webkit',390),('chromium',320)]:
  browser=getattr(p,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}))
  context=browser.new_context(viewport={'width':width,'height':900 if width>760 else 844},is_mobile=width<760,has_touch=width<760)
  context.add_init_script('if(!localStorage.getItem("mc-clicker-world-v2"))localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(fixture))+')')
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def press(q):
   b=page.locator(q).first;b.tap() if width<760 else b.click()
  def state():return page.evaluate('JSON.parse(localStorage.getItem("mc-clicker-world-v2"))')
  def detail(family,id):
   press('[data-nav="atlas"]');press(f'[data-family="{family}"]');press(f'[data-detail="{id}"]')
  page.goto(args.url,wait_until='networkidle')
  detail('M','M9');assert '3 级' in page.locator('[data-card="M9"] [data-purchase-reason]').inner_text()
  assert page.locator('[data-buy="M9"]').get_attribute('data-purchase-state')=='locked'
  press('[data-prerequisite="M1"]');assert '红石钻机' in page.locator('[data-card="M1"]').inner_text()
  for level in [2,3]:
   press('[data-buy="M1"]');press('#placement-confirm');assert state()['counts']['M1']==level
  detail('M','M9');assert page.locator('[data-buy="M9"]').get_attribute('data-purchase-state')=='ready'
  detail('T','T3');assert not state()['counts'].get('M2');press('[data-buy="T3"]');press('#placement-confirm');assert state()['counts']['T3']==1
  press('[data-nav="build"]');press('[data-open="owned"]');press('[data-family="all"]');press('[data-detail="V18"]');press('[data-mail-tab="postal"]')
  assert '40 秒' in page.locator('[data-postal-payback]').inner_text()
  payback=page.locator('[data-postal-payback]').bounding_box();button=page.locator('[data-mail-upgrade]').bounding_box()
  assert payback['y']+payback['height']<=button['y']+1
  press('[data-mail-upgrade]');assert state()['mail']['postalLevel']==2
  assert '50 秒' in page.locator('[data-postal-payback]').inner_text()
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  assert page.locator('#panel').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
  page.screenshot(path=str(ROOT/f'docs/v1.6/qa/alpha3/postal-{engine}-{width}.png'))
  assert not errors,errors;reports.append({'engine':engine,'width':width,'gatesAndJump':True,'ironBeforeFurnace':True,'postalValueAndUpgrade':True,'errors':errors})
  context.close();browser.close()
(ROOT/'docs/v1.6/qa/alpha3/early-browser.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2)+'\n');print(json.dumps(reports,ensure_ascii=False))
