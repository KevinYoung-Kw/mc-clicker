"""Production end-card smoke test in an isolated mobile browser, with no debug API."""
import argparse,json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--url',required=True);p.add_argument('--label',required=True);a=p.parse_args()
out=ROOT/'docs/qa'/('victory-'+a.label);out.mkdir(parents=True,exist_ok=True)
seed=json.loads((ROOT/'docs/v1.1l/simulation/calibrated/no-livestream-save.json').read_text())
report={'url':a.url,'errors':[],'failedResponses':[],'viewport':[390,600],'fixture':'calibrated/no-livestream-save.json'}
with sync_playwright() as pw:
 browser=pw.webkit.launch();context=browser.new_context(viewport={'width':390,'height':600},is_mobile=True,has_touch=True,accept_downloads=True)
 context.add_init_script('if(!localStorage.getItem("mc-clicker-world-v2"))localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(seed))+')')
 page=context.new_page();page.on('pageerror',lambda e:report['errors'].append(str(e)));page.on('response',lambda r:report['failedResponses'].append(r.url) if r.status>=400 else None)
 page.goto(a.url,wait_until='networkidle');assert page.evaluate('typeof mcDebug')=='undefined';assert 'V1.1L级版' in page.title()
 if not page.locator('#share-open').is_visible():page.locator('#hud-more').tap()
 page.locator('#share-open').tap();page.locator('[data-card-mode="victory"]').tap();assert '首次通关' in page.locator('[data-share-scene]').inner_text()
 page.locator('#generate-card').tap();page.wait_for_selector('#share-card-preview canvas',timeout=60000)
 report['imageSize']=page.locator('#share-card-preview canvas').evaluate('c=>[c.width,c.height]');assert report['imageSize']==[1440,1920]
 assert page.locator('[data-victory-renderer]').count()==0
 with page.expect_download() as download:page.locator('#download-card').tap()
 download.value.save_as(out/'no-livestream-victory.png')
 assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
 page.locator('#modal').evaluate('e=>e.scrollTop=0');page.screenshot(path=str(out/'panel.png'))
 assert not report['errors'],report['errors'];assert not report['failedResponses'],report['failedResponses'];report['passed']=True
 browser.close()
(out/'observations.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False))
