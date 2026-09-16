import json
from pathlib import Path
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1];out=R/'docs/v1.8/qa/shopping-recommendations';out.mkdir(parents=True,exist_ok=True);seed=json.loads((out/'seed.json').read_text());results=[]
with sync_playwright() as p:
 for engine,width in [('chromium',1440),('webkit',390),('chromium',320)]:
  b=getattr(p,engine).launch(headless=True);c=b.new_context(viewport={'width':width,'height':844},is_mobile=width<760,has_touch=width<760)
  c.add_init_script('if(!localStorage.getItem("mc-clicker-world-v2"))localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(seed))+')')
  page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def click(q):page.locator(q).first.click()
  try:
   page.goto('http://127.0.0.1:8932/',wait_until='networkidle');page.evaluate('window.dispatchEvent(new Event("blur"))');click('[data-nav="build"]')
   assert page.locator('[data-shopping-upgrade="V18"]').count()==1
   assert page.locator('[data-shop-mod="drill-steel"]').count()==2
   page.screenshot(path=str(out/f'progress-{engine}-{width}.png'))
   click('.shop-order .game-select-trigger');page.get_by_role('option',name='绿宝石从低到高',exact=True).click()
   assert page.locator('#shop-order').input_value()=='price'
   page.screenshot(path=str(out/f'price-{engine}-{width}.png'))
   click('[data-shop-mod="drill-steel"]');assert page.locator('[data-mod-card="drill-steel"]').get_attribute('data-expanded')=='true';assert page.locator('#mod-detail-drill-steel').is_visible()
   click('[data-nav="build"]');click('[data-open-postal]');assert page.locator('[data-mail-upgrade]').is_visible()
   click('[data-mail-upgrade]');assert 'Lv.2' in page.locator('[data-postal-level]').inner_text()
   click('[data-nav="build"]');assert page.locator('[data-shopping-upgrade="V18"]').count()==1
   click('[data-open="owned"]');assert page.locator('#shop-order').input_value()=='price';assert page.locator('[data-shopping-upgrade="M9"]').count()==1
   page.reload(wait_until='networkidle');click('[data-nav="build"]');assert page.locator('#shop-order').input_value()=='price'
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert not errors,errors
   results.append({'engine':engine,'width':width,'upgradeDiscovery':True,'sortAndReload':True,'exactModDetail':True,'postalUpgradeAndReturn':True,'ownedSameOffers':True,'noOverflow':True,'errors':errors})
  except Exception:
   page.screenshot(path=str(out/f'failure-{engine}-{width}.png'));print(errors,flush=True);raise
  finally:b.close()
(out/'report.json').write_text(json.dumps(results,ensure_ascii=False,indent=2));print(results)
