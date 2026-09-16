"""V1.3.1 direct purchase/use flows; run dev server on 8890. Isolated test saves."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/qa/v131';OUT.mkdir(parents=True,exist_ok=True);seed=json.loads((ROOT/'docs/qa/v13/fixture.json').read_text());seed['sound']=True;seed.pop('records',None);seed.pop('audio',None)
report=[]
with sync_playwright() as p:
 for engine,width in [('chromium',1440),('webkit',390),('chromium',320)]:
  b=getattr(p,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}));ctx=b.new_context(viewport={'width':width,'height':1000 if width>760 else 844},is_mobile=width<760,has_touch=width<760,accept_downloads=True);page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:8890/',wait_until='networkidle');page.wait_for_function('!!window.mcDebug?.world');page.evaluate('s=>mcDebug.setState(s)',seed)
  def close():page.evaluate("document.querySelector('#modal').close()")
  def shop():page.locator('#collection-open').evaluate('e=>e.click()');page.wait_for_selector('[data-web-reset]')
  def absent():
   assert not page.locator('button').filter(has_text='试装').count();assert not page.locator('button').filter(has_text='试览').count();assert not page.locator('button').filter(has_text='试听').count();assert page.locator('#appearance-trial').count()==0
  shop();page.locator('[data-collection-tab="theme"]').click();page.locator('[data-web-select="web-theme-end"]').click();absent()
  assert page.locator('.appearance-actions button').count()==1;assert page.evaluate("document.body.dataset.theme||''")==''
  page.locator('[data-extra-buy]').click();page.locator('#placement-cancel').click();assert page.locator('#collection-shop').is_visible();assert not page.evaluate("!!mcDebug.state.webAppearance.owned['web-theme-end']")
  page.locator('[data-extra-buy]').click();page.locator('#placement-confirm').click();assert page.locator('#collection-shop').is_visible();assert page.evaluate('document.body.dataset.theme')=='web-theme-end'
  page.locator('[data-web-equip]').click();assert page.evaluate('document.body.dataset.theme')=='';page.locator('[data-web-equip]').click();assert page.evaluate('document.body.dataset.theme')=='web-theme-end'
  page.screenshot(path=OUT/f'{engine}-{width}-shop.png');page.evaluate('mcDebug.save()');page.reload(wait_until='networkidle');page.wait_for_function('!!window.mcDebug?.world');assert page.evaluate('document.body.dataset.theme')=='web-theme-end'
  shop();page.evaluate('mcDebug.state.skipPurchaseConfirmation=true');page.locator('[data-collection-tab="cursor"]').click();page.locator('[data-web-select="web-cursor-diamond"]').click();page.locator('[data-extra-buy]').click();assert page.evaluate("mcDebug.state.webAppearance.owned['web-cursor-diamond']");assert page.locator('#placement-bar').is_hidden();page.evaluate('mcDebug.state.skipPurchaseConfirmation=false')
  close();page.locator('#share-open').evaluate('e=>e.click()');page.get_by_role('combobox',name='纪念卡样式').wait_for();assert page.locator('#share-card-style option').count()==1;close()
  shop();page.locator('[data-collection-tab="share"]').click();page.locator('[data-web-select="web-card-oak"]').click();assert page.locator('#share-panel').count()==0;page.locator('[data-extra-buy]').click();page.locator('#placement-confirm').click();close()
  page.locator('#share-open').evaluate('e=>e.click()');page.get_by_role('combobox',name='纪念卡样式').wait_for();assert page.locator('#share-card-style option').count()==2;assert page.locator('#share-card-style').input_value()=='web-card-oak';page.locator('#generate-card').click();page.wait_for_selector('#download-card:not([hidden])',timeout=60000);assert page.locator('#download-card').inner_text()=='保存图片'
  with page.expect_download() as d:page.locator('#download-card').click()
  d.value.save_as(OUT/f'{engine}-{width}-share.png');absent();close()
  page.evaluate("mcDebug.go('atlas')");page.locator('[data-detail="V19"]').first.click();absent();assert page.locator('[data-env-buy]').count()==5
  for id in ['env-weather','env-rain']:
   page.locator(f'[data-env-buy="{id}"]').click();page.locator('#placement-confirm').click()
  assert page.locator('[data-env-select]').input_value()=='rain';page.locator('[data-env-toggle="env-rain"]').click();assert page.evaluate('mcDebug.state.environment.enabled["env-rain"]')==False;page.locator('[data-env-toggle="env-rain"]').click();page.screenshot(path=OUT/f'{engine}-{width}-observatory.png')
  page.evaluate("mcDebug.go('world')");shop();page.locator('[data-web-reset]').click();assert page.evaluate('document.body.dataset.theme')=='';assert page.evaluate('mcDebug.state.environment.weather')=='rain';assert page.evaluate("mcDebug.state.webAppearance.owned['web-theme-end']")
  close();page.evaluate("mcDebug.go('atlas')");page.locator('[data-detail="L1"]').first.click();page.locator('[data-room-select="L1"]').click();page.wait_for_selector('.record-library');absent();assert page.locator('[data-record]').count()==6
  page.locator('[data-record-buy="cavern"]').click();page.locator('#placement-cancel').click();assert page.evaluate('mcDebug.state.records.owned')==['meadow'];page.locator('[data-record-buy="cavern"]').click();page.locator('#placement-confirm').click();page.locator('[data-record-play="cavern"]').click()
  page.wait_for_function('mcDebug.audio.snapshot().selected==="cavern" && mcDebug.audio.snapshot().playing');page.locator('[data-record-toggle]').click();page.wait_for_function('mcDebug.audio.snapshot().decks===0');page.locator('[data-record-toggle]').click();page.wait_for_function('mcDebug.audio.snapshot().selected==="cavern"');page.screenshot(path=OUT/f'{engine}-{width}-records.png')
  page.evaluate('mcDebug.save()');page.reload(wait_until='networkidle');page.wait_for_function('!!window.mcDebug?.world');assert page.evaluate('mcDebug.state.records.owned')==['meadow','cavern'];assert page.evaluate('mcDebug.state.records.selected')=='cavern'
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert not errors,errors
  report.append({'engine':engine,'width':width,'purchaseCancelApplyReset':True,'savedOwnership':True,'ownedShareOnly':True,'weatherPurchaseAndToggle':True,'recordsBuyPlayPause':True,'errors':errors});print(engine,width,'passed',flush=True);ctx.close();b.close()
(OUT/'browser-report.json').write_text(json.dumps(report,indent=2))
