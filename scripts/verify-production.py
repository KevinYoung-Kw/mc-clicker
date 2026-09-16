import sys
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
OUT=Path('docs/qa');errors=[];bad=[];checks={}
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--use-angle=metal'] if sys.platform=='darwin' else [])
 context=browser.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True,accept_downloads=True)
 page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('response',lambda r:bad.append({'status':r.status,'url':r.url}) if r.status>=400 else None)
 page.goto('http://127.0.0.1:8891/');page.wait_for_load_state('networkidle');page.wait_for_timeout(500)
 assert page.evaluate('typeof window.mcDebug')=='undefined';checks['no_production_debug']=True
 page.screenshot(path=str(OUT/'30-production-opening-phone.png'))
 for _ in range(10):page.locator('#mine').tap()
 page.locator('[data-nav=build]').tap();page.locator('[data-buy=T1]').tap();page.wait_for_timeout(500)
 assert page.locator('#click-value').text_content()!='+1';checks['production_purchase']=True
 page.screenshot(path=str(OUT/'31-production-build-phone.png'))
 page.locator('#settings').tap();page.locator('#import-save').set_input_files(str(OUT/'full-save.json'));page.locator('#confirm-import').tap();page.wait_for_timeout(500)
 (page.locator('#studio-back') if page.locator('#studio-back').is_visible() else page.locator('[data-nav=world]')).tap();assert page.locator('[data-realm=end]').is_visible();checks['production_import']=True
 page.locator('[data-realm=nether]').tap();page.wait_for_timeout(400);assert page.locator('#game').evaluate('e=>e.classList.contains("dark-world")') is False # imported twilight sky
 page.locator('[data-nav=live]').tap();page.locator('[data-camera=E9]').tap();page.wait_for_timeout(500);page.screenshot(path=str(OUT/'32-production-dragon-phone.png'))
 page.locator('#studio-back').tap();page.locator('[data-nav=network]').tap();page.locator('[data-option=dispatch]').select_option('orders');page.wait_for_timeout(300)
 (page.locator('#studio-back') if page.locator('#studio-back').is_visible() else page.locator('[data-nav=world]')).tap();page.set_viewport_size({'width':844,'height':390});page.wait_for_timeout(600);page.screenshot(path=str(OUT/'33-production-landscape.png'))
 assert not page.evaluate('document.documentElement.scrollWidth>innerWidth');checks['production_mobile_and_landscape']=True
 page.locator('#album').tap();page.wait_for_selector('#share-card canvas')
 with page.expect_download() as d:page.locator('#download-card').tap()
 assert d.value.suggested_filename.endswith('.png');checks['production_card']=True
 assert not errors,errors;assert not bad,bad
 (OUT/'production-observations.json').write_text(json.dumps({'checks':checks,'errors':errors,'httpErrors':bad},ensure_ascii=False,indent=2));print(json.dumps(checks,indent=2));browser.close()
