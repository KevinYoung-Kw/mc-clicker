"""Isolated browser QA for V1.7: actual navigation, state updates and layout."""
import argparse, json
from pathlib import Path
from playwright.sync_api import sync_playwright

parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://127.0.0.1:8890/');parser.add_argument('--out',default='docs/v1.7/qa/browser');parser.add_argument('--production',action='store_true');args=parser.parse_args()
out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
base=json.loads(Path('docs/v1.6/qa/stability-baseline/fixtures/peak.json').read_text())
base['guidance']['notices']=False
report=[]
with sync_playwright() as p:
 for engine,width in [('chromium',1440),('chromium',320),('webkit',390)]:
  browser=getattr(p,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}))
  context=browser.new_context(viewport={'width':width,'height':900 if width>760 else 844},is_mobile=width<760,has_touch=width<760)
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  if args.production:page.add_init_script('const fixture=sessionStorage.getItem("qa-v17-fixture");if(fixture)localStorage.setItem("mc-clicker-world-v2",fixture);')
  page.goto(args.url,wait_until='networkidle')
  if args.production:assert page.evaluate('typeof mcDebug')=='undefined'
  else:page.wait_for_function('window.mcDebug?.world')
  def load(fixture):
   if args.production:
    page.evaluate('s=>sessionStorage.setItem("qa-v17-fixture",JSON.stringify(s))',fixture);page.reload(wait_until='networkidle');page.wait_for_selector('#world canvas')
   else:page.evaluate('s=>mcDebug.setState(s)',fixture)
  def press(q):
   loc=page.locator(q).first
   loc.tap() if width<760 else loc.click()
  load(base)
  press('[data-nav="network"]');page.wait_for_timeout(900)
  assert page.locator('.production-summary').is_visible()
  assert page.locator('[data-production-target]').is_visible()
  before=page.locator('.production-summary').bounding_box()
  page.wait_for_timeout(2100)
  after=page.locator('.production-summary').bounding_box();assert abs(before['height']-after['height'])<1
  assert page.locator('#panel-content').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
  page.screenshot(path=str(out/f'production-{engine}-{width}.png'))
  # One-click diagnosis opens the same facility detail used by the world.
  target=page.locator('[data-production-target]').get_attribute('data-target');press('[data-production-target]');page.wait_for_timeout(600)
  assert page.locator('#panel-title').inner_text().strip()
  press('#panel-close');assert page.locator('#world canvas').is_visible()
  press('[data-nav="network"]');press('[data-industry-tab="power"]');page.wait_for_timeout(500)
  assert page.locator('[data-demand]').is_visible();assert page.locator('[data-consumption]').is_visible()
  press('[data-nav="village"]');press('[data-village-tab="market"]');page.wait_for_timeout(1000)
  receipts=page.locator('[data-market-receipts]');assert receipts.is_visible()
  receipts.scroll_into_view_if_needed();receipts.focus()
  page.evaluate('window.__receiptList=document.querySelector("[data-market-receipts]");window.__receiptRow=__receiptList.querySelector("[data-receipt]");__receiptList.scrollTop=30')
  page.wait_for_timeout(6500)
  assert page.evaluate('document.querySelector("[data-market-receipts]")===__receiptList&&(!__receiptRow||__receiptRow.isConnected)')
  assert page.evaluate('document.activeElement===__receiptList')
  assert page.locator('#panel-content').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
  page.screenshot(path=str(out/f'market-{engine}-{width}.png'))
  # Themes reuse their own variables; no new fixed-color cards.
  if width==390:
   for theme in ['web-theme-backpack','web-theme-oak','web-theme-redstone','web-theme-end']:
    fixture=json.loads(json.dumps(base));fixture['webAppearance']['owned'][theme]=True;fixture['webAppearance']['equipped']['theme']=theme
    load(fixture);page.wait_for_timeout(400)
    if args.production:press('[data-nav="village"]');press('[data-village-tab="market"]');page.wait_for_timeout(600)
    assert page.locator('body').get_attribute('data-theme')==theme
    receipts.scroll_into_view_if_needed();assert page.locator('#panel-content').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
    page.screenshot(path=str(out/f'market-{theme}.png'))
  press('#panel-close')
  for realm in ['nether','end','overworld']:
   if width<760:press('#realm-toggle')
   press('[data-realm="'+realm+'"]');press('[data-nav="network"]');press('[data-industry-tab="production"]');page.wait_for_timeout(400)
   assert page.locator('[data-production-realm]').inner_text()=={'nether':'下界','end':'末地','overworld':'主世界'}[realm]
   press('#panel-close');assert page.locator('#world canvas').is_visible()
  assert not errors,errors
  report.append({'engine':engine,'width':width,'build':'production' if args.production else 'dev','productionHeightStable':True,'receiptNodesAndFocusStable':True,'threeWorlds':True,'overflow':False,'errors':errors,'diagnosticTarget':target})
  (out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
  print(engine,width,'passed',flush=True);context.close();browser.close()
