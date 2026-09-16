"""Isolated real UI purchase checks; never reads the player's production save."""
import argparse,json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--url',required=True);args=p.parse_args()
out=ROOT/'docs/v1.1l/upgrades-ui';out.mkdir(parents=True,exist_ok=True)
seed=json.loads((ROOT/'docs/v1.1l/simulation/baseline/industrial-first-save.json').read_text())
seed['realm']='overworld';seed['upgrades']={'version':1,'revision':0,'levels':{}};seed['skipPurchaseConfirmation']=False
report={'cases':[],'errors':[]}
with sync_playwright() as pw:
 for engine,width,height in [('chromium',1440,960),('webkit',390,600),('webkit',320,640)]:
  browser=getattr(pw,engine).launch(**({'args':['--use-angle=metal']} if engine=='chromium' else {}))
  context=browser.new_context(viewport={'width':width,'height':height},is_mobile=width<700,has_touch=width<700)
  context.add_init_script('if (!localStorage.getItem("mc-clicker-world-v2")) localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(seed))+')')
  page=context.new_page();page.on('pageerror',lambda error:report['errors'].append(str(error)))
  page.goto(args.url);page.wait_for_function('!!window.mcDebug');page.evaluate('mcDebug.go("network")')
  page.locator('[data-industry-tab="production"]').click()
  page.locator('.equipment-mod-link[data-manage-item="M9"]').click()
  buy=page.locator('.mod-near [data-mod-buy="drill-steel"]');buy.scroll_into_view_if_needed();buy.click()
  assert page.locator('#placement-confirm').is_visible()
  page.locator('#placement-confirm').click()
  page.wait_for_function('mcDebug.state.upgrades.levels["drill-steel"]===1')
  assert page.locator('#panel').is_visible()
  assert page.locator('[data-mod-owner="M9"]').is_visible()
  tree=page.locator('[data-mod-tree="M9"]');tree.locator(':scope > summary').click();page.wait_for_timeout(100)
  assert tree.get_attribute('open') is not None
  page.locator('[data-mod-tree="M9"] [data-mod-buy="drill-diamond"]').scroll_into_view_if_needed()
  page.locator('[data-mod-tree="M9"] [data-mod-buy="drill-diamond"]').click()
  page.locator('#placement-cancel').click()
  assert not page.evaluate('mcDebug.state.upgrades.levels["drill-diamond"] || 0')
  # Optional quick purchase respects the existing preference without a second panel.
  page.evaluate('mcDebug.state.skipPurchaseConfirmation=true')
  page.locator('[data-mod-tree="M9"] [data-mod-buy="drill-diamond"]').click()
  page.wait_for_function('mcDebug.state.upgrades.levels["drill-diamond"]===1')
  page.locator('[data-mod-owner="M9"]').scroll_into_view_if_needed();page.wait_for_timeout(350)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  if width<700 and not page.locator('#game').evaluate('e=>e.classList.contains("sheet-expanded")'):
   page.locator('#panel-expand').click();page.wait_for_timeout(300)
  path=out/f'{engine}-{width}-upgrades.png';page.screenshot(path=str(path))
  case={'engine':engine,'viewport':[width,height],'checks':['facility-owned entry','confirmed purchase','panel stays open','complete tree','cancel preserves levels','quick-purchase preference','no horizontal overflow'],'image':path.name,'upgrades':page.evaluate('mcDebug.state.upgrades.levels')}
  if width<700:
   assert page.locator('#game').evaluate('e=>e.classList.contains("sheet-expanded")')
   page.locator('[data-nav="village"]').click();assert page.locator('#panel-title').inner_text()=='村庄'
   case['checks'].append('expanded mobile sheet keeps menu switching')
  page.evaluate('mcDebug.save()');page.reload();page.wait_for_function('!!window.mcDebug');assert page.evaluate('mcDebug.state.upgrades.levels["drill-diamond"]')==1;case['checks'].append('reload preserves paid levels')
  report['cases'].append(case);browser.close()
assert not report['errors'],report['errors']
(out/'observations.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False))
