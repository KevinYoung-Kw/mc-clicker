# Historical V1.3.0 checks: run at tag mc-clicker-v1.3.0. For current direct-use flows run verify-v131.py.
"""V1.3 browser flows. Run with_server.py on 8890; isolated contexts only.
Requires a real-purchase fixture at docs/qa/v13/fixture.json (engineeringFixture).
Desktop Chromium + 390px WebKit + narrow Chromium; not physical phone testing.
"""
from pathlib import Path
import json,base64,sys
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/qa/v13';OUT.mkdir(exist_ok=True)
seed=json.loads((OUT/'fixture.json').read_text());seed['reducedMotion']=False
report={'browsers':[],'cards':[]}

def closed(page):
 page.evaluate("document.querySelector('#modal').close()")
def item(page,id):
 closed(page);page.evaluate("mcDebug.go('atlas')");page.locator(f'[data-detail="{id}"]').first.click()
def shot(page,name):
 page.screenshot(path=OUT/(name+'.png'))
def boxfit(page):
 return page.evaluate("()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,canvas:document.querySelector('#world canvas').getBoundingClientRect().toJSON()})")
with sync_playwright() as p:
 for engine,width in [('chromium',1440),('webkit',390),('chromium',320)]:
  browser=getattr(p,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}))
  ctx=browser.new_context(viewport={'width':width,'height':1000 if width>760 else 844},is_mobile=width<760,has_touch=width<760,accept_downloads=True)
  page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:8890/',wait_until='networkidle');page.wait_for_function('!!window.mcDebug?.world');page.evaluate('s=>mcDebug.setState(s)',seed);page.wait_for_timeout(600)
  page.evaluate("document.querySelector('#collection-open').click()");page.wait_for_selector('[data-web-trial]')
  page.locator('[data-collection-tab="theme"]').click();page.locator('[data-preview="web-theme-backpack"]').click()
  page.locator('[data-extra-buy]').click();assert page.locator('#placement-confirm').is_visible();assert not page.evaluate("!!mcDebug.state.webAppearance.owned['web-theme-backpack']")
  page.locator('#placement-cancel').click();assert page.locator('#collection-shop').is_visible();assert not page.evaluate("!!mcDebug.state.webAppearance.owned['web-theme-backpack']")
  page.locator('[data-extra-buy]').click();page.locator('#placement-confirm').click();assert page.evaluate("mcDebug.state.webAppearance.owned['web-theme-backpack']===true");assert page.locator('#collection-shop').is_visible()
  page.evaluate('mcDebug.state.skipPurchaseConfirmation=true');page.locator('[data-preview="web-theme-oak"]').click();page.locator('[data-extra-buy]').click();assert page.evaluate("mcDebug.state.webAppearance.owned['web-theme-oak']===true");assert page.locator('#placement-bar').is_hidden()
  page.evaluate('mcDebug.state.skipPurchaseConfirmation=false')
  for theme in ['backpack','oak','redstone','end']:
   page.locator(f'[data-preview="web-theme-{theme}"]').click();page.locator('[data-web-trial]').click();assert page.evaluate('document.body.dataset.theme')=='web-theme-'+theme
   page.locator('[data-trial-compare]').click();assert page.evaluate('document.body.dataset.theme')=='web-theme-oak';page.locator('[data-trial-compare]').click()
   closed(page);page.locator('#settings').evaluate('e=>e.click()');shot(page,f'{engine}-{width}-{theme}-settings');assert page.locator('#appearance-trial').is_visible()
   page.locator('[data-trial-return]').click();assert page.locator('#appearance-trial').is_visible();shot(page,f'{engine}-{width}-{theme}-shop')
  # Preview never writes ownership, resets the economy or captures a stale save.
  before=page.evaluate('mcDebug.state.total');page.wait_for_timeout(600);page.evaluate('mcDebug.save()');assert page.evaluate('mcDebug.state.total')>=before
  page.reload(wait_until='networkidle');page.wait_for_function('!!window.mcDebug?.world');assert page.evaluate('document.body.dataset.theme')=='web-theme-oak'
  assert not page.evaluate("!!mcDebug.state.webAppearance.owned['web-theme-end']")
  # Individual cursor trials preserve native interaction semantics.
  page.evaluate("document.querySelector('#collection-open').click()");page.wait_for_selector('[data-collection-tab="cursor"]');page.locator('[data-collection-tab="cursor"]').click()
  for cursor in ['stone','oak','copper','diamond','amethyst','obsidian']:
   page.locator(f'[data-preview="web-cursor-{cursor}"]').click();page.locator('[data-web-trial]').click();assert page.evaluate('document.body.dataset.cursor')=='web-cursor-'+cursor
   page.locator('[data-trial-compare]').click();page.locator('[data-trial-compare]').click()
   # Rasterize the actual operation asset, not the enlarged shop illustration.
   result=page.evaluate('''async id=>{const {cursorArt}=await import('/src/web-art.js');const svg=cursorArt(id);const img=new Image();img.src='data:image/svg+xml,'+encodeURIComponent(svg);await img.decode();const c=document.createElement('canvas');c.width=c.height=32;const x=c.getContext('2d');x.drawImage(img,0,0);return {alpha:x.getImageData(0,0,1,1).data[3],cursor:getComputedStyle(document.querySelector('[data-web-trial]')).cursor};}''','web-cursor-'+cursor)
   assert result['alpha']==255
   if width>760: assert '0 0' in result['cursor']
  page.locator('[data-trial-end]').click();page.locator('[data-collection-tab="theme"]').click();page.locator('[data-preview="web-theme-end"]').click();page.locator('[data-web-trial]').click();closed(page)
  item(page,'V18');page.locator('[data-mail-open]').first.click();shot(page,f'{engine}-{width}-mail')
  # No theme may make a selected mail tab or primary control light-on-light.
  contrast=page.locator('[data-mail-tab="letters"]').evaluate('(e)=>({fg:getComputedStyle(e).color,bg:getComputedStyle(e).backgroundColor})');assert contrast['fg']!=contrast['bg']
  item(page,'V19');page.wait_for_selector('[data-env-buy]')
  before=page.evaluate('JSON.stringify(mcDebug.state.environment)');page.locator('[data-env-preview="env-rain"]').click();page.wait_for_timeout(1000);assert page.evaluate("!mcDebug.state.environment.modules['env-rain']");assert not page.evaluate("mcDebug.state.environment.seen.includes('rain')");page.locator('[data-env-preview="env-rain"]').click()
  for id in ['env-sundial','env-weather','env-rain','env-snow','env-stars']:
   page.locator(f'[data-env-buy="{id}"]').click();page.locator('#placement-confirm').click();assert page.evaluate('id=>!!mcDebug.state.environment.modules[id]',id)
  shot(page,f'{engine}-{width}-observatory');assert boxfit(page)['scroll']<=width
  page.evaluate("mcDebug.go('world')");page.evaluate("async()=>{const{setEnvironment}=await import('/src/environment.js');setEnvironment(mcDebug.state,{phase:.02,weather:'clear'})}");page.wait_for_timeout(2400);shot(page,f'{engine}-{width}-night')
  page.evaluate("async()=>{const{setEnvironment}=await import('/src/environment.js');setEnvironment(mcDebug.state,{phase:.5,weather:'snow'})}");page.wait_for_timeout(11000)
  page.evaluate("mcDebug.go('live')");page.wait_for_timeout(1500);shot(page,f'{engine}-{width}-studio');assert page.evaluate('mcDebug.world.atmosphereView.group.visible===false')
  assert page.evaluate('mcDebug.world.graph.getObjectsByProperty("isMesh",true).some(o=>o.parent?.userData.weatherWindow)')
  # Real current-world PNG export for every paid card skin, plus the free default.
  if width==1440:
   page.evaluate("mcDebug.go('world')");page.evaluate("async()=>{const {WEB_ITEMS}=await import('/src/web-catalog.js');const{buyWeb}=await import('/src/presentation.js');for(const i of WEB_ITEMS.filter(i=>i.slot==='shareCard'))buyWeb(mcDebug.state,i.id)}")
   awaitable=page.evaluate("mcDebug.showStats()");page.wait_for_selector('#share-card-style')
   for style in ['','web-card-worklog','web-card-oak','web-card-redstone','web-card-end']:
    page.locator('#share-card-style').select_option(style);page.locator('#generate-card').click();page.wait_for_selector('#download-card:not([hidden])',timeout=60000)
    with page.expect_download() as d: page.locator('#download-card').click()
    file=OUT/f'card-{style or "default"}.png';d.value.save_as(file);report['cards'].append(str(file.relative_to(ROOT)))
   shot(page,'desktop-share')
   # Text input still uses a text caret under every material cursor.
   page.evaluate("async()=>{const {buyWeb}=await import('/src/presentation.js');buyWeb(mcDebug.state,'web-cursor-stone');mcDebug.save()}");page.locator('#share-url').click();page.locator('#share-url').select_text();assert page.locator('#share-url').evaluate('e=>getComputedStyle(e).cursor')=='text'
  assert not errors,errors
  report['browsers'].append({'engine':engine,'width':width,'errors':errors,'fit':boxfit(page),'flows':['purchase-confirm-cancel','instant-purchase','theme-trial-other-panels','reload-restoration','six-cursor-operation-assets','mail','observatory-preview-purchase','indoor-snow']});print(engine,width,'passed',flush=True)
  ctx.close();browser.close()
(OUT/'browser-report.json').write_text(json.dumps(report,indent=2))
