import os,json,sys,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
base=os.environ.get('MC_RELEASE_URL','http://127.0.0.1:8893/projects/mc-clicker-2/')
fixture=subprocess.run(['node','--input-type=module','-e',"import{completeFixture}from './scripts/fixtures.mjs';const s=completeFixture();s.money=1e7;delete s.counts.L10;delete s.counts.L11;console.log(JSON.stringify(s))"],capture_output=True,text=True,check=True)
save=json.loads(fixture.stdout);errors=[];http=[]
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--use-angle=metal'] if sys.platform=='darwin' else [])
 context=b.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True)
 context.add_init_script("localStorage.setItem('mc-clicker-world-v2',"+json.dumps(json.dumps(save))+");")
 page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('response',lambda r:http.append(r.url) if r.status>=400 else None)
 page.goto(base);page.wait_for_load_state('networkidle');assert page.evaluate('typeof mcDebug')=='undefined'
 page.locator('[data-nav=build]').tap();page.locator('[data-open=owned]').tap();assert page.locator('.owned-section').count()==2
 page.locator('[data-detail=V4]').tap();page.locator('[data-crop=carrot]').tap();assert page.locator('[data-crop=carrot]').get_attribute('class').endswith('active')
 page.locator('#collection-open').tap();page.locator('[data-extra-buy=title-0]').tap();assert page.title()=='橡木小镇 · MC Clicker 2.0'
 page.locator('[data-collection-tab=share]').tap();page.locator('[data-extra-buy=share-2]').tap();page.locator('#modal-close').tap()
 page.locator('[data-nav=live]').tap();page.wait_for_selector('.live-page');page.locator('[data-studio-tab=equipment]').tap();page.locator('[data-buy=L10]').tap();assert page.locator('[data-card=L10] .complete-badge').count()==1;assert page.locator('[data-studio-view=equipment]').is_visible()
 page.locator('#studio-back').tap();page.locator('#album').tap();page.wait_for_selector('#share-card canvas');
 with page.expect_download() as download:page.locator('#download-card').tap()
 file=download.value;assert file.suggested_filename.endswith('.png');assert Path(file.path()).stat().st_size>10000
 page.screenshot(path='docs/qa/73-collection-release-share.png');assert not errors,errors;assert not http,http
 result={'url':base,'mobileFarmPurchase':True,'ownedSections':True,'individualTitlePurchase':True,'studioEquipmentPurchase':True,'sharePNG':True,'noDebug':True,'errors':errors,'httpErrors':http}
 Path('docs/qa/collection-release-observations.json').write_text(json.dumps(result,indent=2));print(json.dumps(result));b.close()
