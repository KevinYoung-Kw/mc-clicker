from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/qa/v13'
legacy=json.loads((OUT/'legacy-fixture.json').read_text());raw=json.loads(json.dumps(legacy['victory']['snapshot']));raw['victory']=legacy['victory']
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--use-angle=metal']);page=b.new_page(viewport={'width':1440,'height':1000},accept_downloads=True);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8890/',wait_until='networkidle');page.wait_for_function('!!window.mcDebug?.world');page.evaluate('s=>mcDebug.setState(s)',raw)
 frozen=page.evaluate('JSON.stringify(mcDebug.state.victory.snapshot)');assert page.evaluate('mcDebug.state.victory.snapshot.version')==6
 page.evaluate("async()=>{const{WEB_ITEMS}=await import('/src/web-catalog.js');const{buyWeb}=await import('/src/presentation.js');mcDebug.state.money=1e12;for(const i of WEB_ITEMS.filter(i=>i.slot==='shareCard'))buyWeb(mcDebug.state,i.id);mcDebug.showStats(true)}");page.wait_for_selector('#share-card-style')
 for style in ['web-card-worklog','web-card-oak','web-card-redstone','web-card-end']:
  page.locator('#share-card-style').select_option(style);page.locator('#generate-card').click();page.wait_for_selector('#download-card:not([hidden])',timeout=60000)
  with page.expect_download() as dl:page.locator('#download-card').click()
  dl.value.save_as(OUT/f'card-victory-{style}.png');assert page.evaluate('JSON.stringify(mcDebug.state.victory.snapshot)')==frozen
  assert page.locator('[data-victory-renderer]').count()==0
 assert not errors;page.screenshot(path=OUT/'victory-share.png');(OUT/'victory-report.json').write_text(json.dumps({'errors':errors,'legacySnapshotSchema':6,'immutableSnapshot':True,'cards':4,'temporaryRenderersRemaining':0},indent=2));print('Four legacy victory cards passed');b.close()
