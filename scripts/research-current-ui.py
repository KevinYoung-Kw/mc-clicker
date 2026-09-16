"""Read-only research capture of existing production, logistics and market panels.
Uses isolated restored fixtures; this is not a gameplay or human-comprehension test.
Run against dev port 8890 with uv run --python 3.11 --with playwright python.
"""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/research/2026-09-08/qa/ui';OUT.mkdir(parents=True,exist_ok=True)
seed=json.loads((ROOT/'docs/qa/v13/fixture.json').read_text());seed.update(money=1e9,savedAt=1,reducedMotion=True)
reports=[]
with sync_playwright() as p:
 for engine,width in [('chromium',1440),('webkit',390)]:
  b=getattr(p,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}))
  c=b.new_context(viewport={'width':width,'height':900},is_mobile=width<760,has_touch=width<760)
  page=c.new_page();page.set_default_timeout(20000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:8890/',wait_until='networkidle');page.wait_for_function('!!window.mcDebug')
  page.evaluate('(s)=>mcDebug.setState(s)',seed)
  page.evaluate('window.dispatchEvent(new Event("blur"))')
  nav=page.locator('[data-nav]').evaluate_all('es=>es.filter(e=>!e.hidden).map(e=>({id:e.dataset.nav,text:e.innerText}))')
  assert any(x['id']=='network' for x in nav),nav
  def press(sel):
   e=page.locator(sel).first
   e.tap() if width<760 else e.click()
   page.wait_for_timeout(300)
  def expand():
   if width<760 and page.locator('#panel-expand').is_visible() and page.locator('#panel-expand').get_attribute('aria-expanded')!='true':press('#panel-expand')
  def capture(name):
   page.screenshot(path=OUT/f'{name}-{engine}-{width}.png')
   return {'name':name,'text':page.locator('#panel-content').inner_text(),'buttons':page.locator('#panel-content button').evaluate_all('es=>es.filter(e=>e.getClientRects().length).map(e=>({text:e.innerText,label:e.getAttribute("aria-label")}))'),'panelOverflow':page.locator('#panel-content').evaluate('e=>e.scrollWidth>e.clientWidth+1'),'documentOverflow':page.evaluate('document.documentElement.scrollWidth>innerWidth+1')}
  press('[data-nav="network"]');expand();production=capture('industrial-production')
  tabs=page.locator('[data-industry-tab]').evaluate_all('es=>es.map(e=>e.dataset.industryTab)')
  screens=[production]
  if 'logistics' in tabs:press('[data-industry-tab="logistics"]');screens.append(capture('industrial-logistics'))
  press('[data-nav="village"]')
  tabs=page.locator('[data-village-tab]').evaluate_all('es=>es.map(e=>e.dataset.villageTab)')
  assert 'market' in tabs,tabs
  press('[data-village-tab="market"]');expand();screens.append(capture('village-market'))
  reports.append({'engine':engine,'width':width,'method':'Restored historical gameplay fixture in isolated browser, inspected current panel controls; not a new-player comprehension test. No synthetic transaction rows injected.', 'screens':screens,'errors':errors})
  print(json.dumps({'engine':engine,'width':width,'screens':[{'name':s['name'],'text':s['text'][:1500],'overflow':s['panelOverflow'] or s['documentOverflow']} for s in screens],'errors':errors},ensure_ascii=False),flush=True)
  b.close()
(OUT/'inspection.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2)+'\n')
