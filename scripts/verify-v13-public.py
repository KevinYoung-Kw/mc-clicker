from pathlib import Path
import sys,json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/qa'/(sys.argv[2] if len(sys.argv)>2 else 'v13-live');OUT.mkdir(exist_ok=True);url=sys.argv[1];report=[]
seed=json.loads((ROOT/'docs/qa/v13/legacy-fixture.json').read_text());seed['collection']['owned'].update({'world-rain':True,'world-weather':True,'world-day':True,'frame-2':True});seed['collection']['equipped']['frame']='frame-2';seed['atmosphere']['weather']='rain';seed['atmosphere']['auto']=False
with sync_playwright() as p:
 for engine,width in [('chromium',1440),('webkit',390)]:
  b=getattr(p,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}))
  for mode in ['fresh','legacy']:
   c=b.new_context(viewport={'width':width,'height':1000 if width>760 else 844},is_mobile=width<760,has_touch=width<760,accept_downloads=True);page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   if mode=='legacy':page.add_init_script('if(!localStorage.getItem("mc-clicker-world-v2"))localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(seed))+')')
   page.goto(url,wait_until='networkidle');page.wait_for_selector('#mine');page.locator('#mine').click();assert page.evaluate('typeof window.mcDebug')=='undefined'
   if width<760:page.locator('#hud-more').click()
   page.locator('#settings').click();assert 'V'+json.loads((ROOT/'package.json').read_text())['version'] in page.locator('#modal-content').inner_text()
   if mode=='legacy':
    assert page.locator('#environment-settings').is_visible();page.locator('#environment-settings').click();page.wait_for_selector('[data-env-place]');assert page.locator('[data-env-buy="env-rain"]').count()==0;assert page.locator('[data-env-preview]').count()==0
    page.screenshot(path=OUT/f'{engine}-{mode}-observatory.png')
    # A full page reload must keep migrated ownership and the free placement option.
    page.wait_for_function('JSON.parse(localStorage.getItem("mc-clicker-world-v2")||"{}").version===7',timeout=15000);page.reload(wait_until='networkidle');page.wait_for_selector('#mine');page.locator('#mine').click()
    if width<760:page.locator('#hud-more').click()
    page.locator('#settings').click();page.locator('#environment-settings').click();page.wait_for_selector('[data-env-place]');assert page.locator('[data-env-buy="env-rain"]').count()==0;assert page.locator('[data-env-preview]').count()==0
    page.locator('#panel-close').click()
   else:page.locator('#modal-close').click()
   if width<760 and page.locator('#share-open').is_hidden():page.locator('#hud-more').click()
   page.locator('#share-open').click();page.wait_for_selector('#generate-card');assert page.locator('#appearance-trial,[data-web-trial]').count()==0;page.locator('#generate-card').click();page.wait_for_selector('#download-card:not([hidden])',timeout=60000)
   with page.expect_download() as dl:page.locator('#download-card').click()
   dl.value.save_as(OUT/f'{engine}-{mode}-share.png');assert not errors,errors
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   page.screenshot(path=OUT/f'{engine}-{mode}.png');report.append({'browser':engine,'width':width,'mode':mode,'version':json.loads((ROOT/'package.json').read_text())['version'],'debug':False,'shareDownload':True,'legacyEnvironment':mode=='legacy','errors':errors});print(engine,mode,'passed',flush=True);c.close()
  b.close()
(OUT/'browser-report.json').write_text(json.dumps(report,indent=2))
