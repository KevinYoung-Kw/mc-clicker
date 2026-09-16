"""Check real guide navigation and image loading in desktop/mobile browsers."""
import argparse,json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
a=argparse.ArgumentParser();a.add_argument('--url',default='http://127.0.0.1:8917/');a.add_argument('--production',action='store_true');a.add_argument('--out');args=a.parse_args()
out=ROOT/args.out if args.out else ROOT/'docs/v1.7/qa/tutorials'/('production' if args.production else 'browser');out.mkdir(parents=True,exist_ok=True)
seed=json.loads((ROOT/'docs/v1.6/qa/stability-baseline/fixtures/peak.json').read_text());seed['guidance']['notices']=False;seed['narrative'].update(intro='released',companionsShown=True,legacy=True);seed['reducedMotion']=True
reports=[]
with sync_playwright() as p:
 for engine,width in [('chromium',1440),('webkit',390),('chromium',320)]:
  browser=getattr(p,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}));mobile=width<760
  context=browser.new_context(viewport={'width':width,'height':844},is_mobile=mobile,has_touch=mobile)
  context.add_init_script('if(!localStorage.getItem("mc-clicker-world-v2"))localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(seed))+')')
  page=context.new_page();errors=[];failed=[];requests=[]
  page.on('pageerror',lambda e:errors.append(str(e)));page.on('response',lambda r:failed.append(r.url) if r.status>=400 else None)
  page.on('request',lambda r:requests.append(r.url) if '.webp' in r.url and any(n in r.url for n in ['controls-','building','foreground','moving','jobs','delivery','power','studio','upgrades']) else None)
  def press(q):
   el=page.locator(q).first;el.tap() if mobile else el.click()
  def info():
   if not page.locator('#info-open').is_visible():press('#hud-more')
   press('#info-open')
  page.goto(args.url,wait_until='networkidle');assert '1.7.0-alpha.5' in page.title()
  if args.production:assert page.evaluate('typeof mcDebug')=='undefined'
  info();assert page.locator('#info-news').is_visible();page.wait_for_timeout(250)
  assert not requests,requests
  press('#info-tab-guide');assert page.locator('.tutorial-figure img').count()==9
  first=page.locator('[data-guide-controls]');first.scroll_into_view_if_needed();first.evaluate('e=>e.decode()');assert ('controls-touch' if mobile else 'controls-mouse') in first.get_attribute('src')
  page.screenshot(path=str(out/f'controls-{engine}-{width}.png'))
  def choose(name):
   press('.manual-controls .game-select-trigger')
   row=page.get_by_role('option',name=name,exact=True);row.tap() if mobile else row.click()
  checked=[]
  names=['采集与视角','购买与建造','前台收益','搬动与转向','村庄与岗位','搬运与成交','电力与自动化','直播间','设施改造']
  for name in names:
   choose(name)
   assert page.locator('.manual-page:visible').count()==1
   img=page.locator('.manual-page:visible img');img.evaluate('e=>e.decode()')
   d=img.evaluate('e=>({src:e.getAttribute("src"),actual:[e.naturalWidth,e.naturalHeight],reserved:[+e.getAttribute("width"),+e.getAttribute("height")],alt:e.alt,loading:e.loading,rect:e.getBoundingClientRect().toJSON()})')
   assert d['actual']==d['reserved'],d
   assert d['alt'] and d['loading']=='lazy',d
   assert d['rect']['x']>=0 and d['rect']['right']<=width,d
   assert page.locator('#modal-close').is_visible()
   checked.append({'src':d['src'],'size':d['actual']})
   if name in ['采集与视角','购买与建造','村庄与岗位','电力与自动化','直播间']:page.screenshot(path=str(out/f'{name}-{engine}-{width}.png'))
  choose('采集与视角');assert page.locator('#guide-prev').is_disabled()
  press('#guide-next');assert page.locator('.manual-page:visible').get_attribute('aria-label')=='购买与建造'
  press('#guide-prev');assert page.locator('.manual-page:visible').get_attribute('aria-label')=='采集与视角'
  assert page.locator('#modal').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  if not mobile:
   choose('采集与视角');page.locator('#info-tab-guide').focus();page.keyboard.press('ArrowRight');assert page.locator('#info-versions').is_visible()
   page.keyboard.press('Home');assert page.locator('#info-news').is_visible()
   press('#info-tab-guide');first.scroll_into_view_if_needed()
   page.dispatch_event('body','pointerdown',{'pointerType':'touch','bubbles':True});first.evaluate('e=>e.decode()');assert 'controls-touch' in first.get_attribute('src')
   page.dispatch_event('body','pointerdown',{'pointerType':'mouse','bubbles':True});first.evaluate('e=>e.decode()');assert 'controls-mouse' in first.get_attribute('src')
  press('#info-return');assert not page.locator('#modal').evaluate('e=>e.open')
  # Free help entry shares the same figures; no notification purchase is needed.
  if mobile:press('#hud-more');press('#quick-help')
  else:press('#settings');press('#basic-help')
  assert page.locator('.tutorial-figure img').count()==9
  assert page.locator('.manual-page:visible').count()==1
  assert not page.locator('#info-tab-news').count()
  assert page.locator('#modal').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
  assert not errors and not failed,(errors,failed)
  reports.append({'engine':engine,'width':width,'images':checked,'hiddenTabImageRequests':0,'freeGuide':True,'keyboard':not mobile,'errors':errors,'failed':failed})
  (out/'report.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2)+'\n');browser.close()
print('All 9 illustrated guides passed in 3 viewports.')
