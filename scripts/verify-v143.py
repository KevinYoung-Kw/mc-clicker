"""V1.4.3 real purchase, fold, scroll/focus and responsive verification. Isolated saves only."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/v1.4.3/qa/browser';OUT.mkdir(parents=True,exist_ok=True)
seed=json.loads((ROOT/'docs/qa/v13/fixture.json').read_text())
seed['savedAt']=1;seed['upgrades']={'revision':0,'levels':{}};seed['counts']['M9']=1;seed['money']=1e12;seed['skipPurchaseConfirmation']=False;seed['reducedMotion']=True
reports=[]
with sync_playwright() as pw:
 for engine,width,height in [('chromium',1440,960),('chromium',320,740),('webkit',390,844)]:
  browser=getattr(pw,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}));mobile=width<760
  ctx=browser.new_context(viewport={'width':width,'height':height},is_mobile=mobile,has_touch=mobile)
  ctx.add_init_script('if(!sessionStorage.getItem("qa-seeded")){localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(seed))+');sessionStorage.setItem("qa-seeded","1")}')
  page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:8890/',wait_until='networkidle');page.wait_for_selector('#world canvas')
  def press(selector):
   loc=page.locator(selector).first
   loc.tap() if mobile else loc.click()
   page.wait_for_timeout(100)
  def fit():
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
   assert page.locator('#panel-content').evaluate('e=>e.scrollWidth<=e.clientWidth+1'),'panel overflow'
  def shot(name):
   page.wait_for_timeout(400);page.screenshot(path=OUT/f'{engine}-{width}-{name}.png')
  def drill():
   page.evaluate('mcDebug.world.onAction({type:"select",id:"M9"})');page.wait_for_selector('[data-mod-owner="M9"]')
   if mobile and page.locator('#panel-expand').get_attribute('aria-expanded')!='true':press('#panel-expand')
  drill();assert '本体 Lv.2' in page.locator('.mod-growth').inner_text()
  assert page.locator('[data-mod-card="drill-diamond"]').get_attribute('data-state')=='locked'
  page.locator('.facility-mods').scroll_into_view_if_needed();fit();shot('drill-level-1')
  fold='[data-fold="mods:M9:locked"]';press(fold+' > summary')
  assert page.locator(fold).evaluate('e=>e.open')
  press('#panel-close');drill();assert page.locator(fold).evaluate('e=>e.open')
  # Native keyboard focus survives a structural rerender without resetting the fold.
  page.locator(fold+' > summary').focus()
  page.evaluate('mcDebug.state.upgrades.revision++');page.wait_for_timeout(650)
  assert page.locator(fold).evaluate('e=>e.open')
  assert page.locator(fold+' > summary').evaluate('e=>e===document.activeElement')
  # A real modification purchase preserves the original confirmation flow.
  button='[data-mod-buy="drill-buffer"]';press(button)
  assert page.locator('#placement-confirm').is_visible();press('#placement-confirm')
  assert page.evaluate('mcDebug.state.upgrades.levels["drill-buffer"]')==1
  assert page.locator(fold).evaluate('e=>e.open')
  assert page.locator('[data-mod-card="drill-buffer"]').get_attribute('data-state')=='locked'
  assert 'Lv.2' in page.locator('[data-mod-card="drill-buffer"] .mod-reason').inner_text()
  # Following a missing base level reaches the real base purchase, not another currency.
  press('[data-mod-select="drill-buffer"]');assert page.locator('.mod-detail:visible').count()==1;press('[data-mod-card="drill-buffer"] [data-mod-need="M9"]');press('[data-buy="M9"]');press('#placement-confirm')
  assert page.evaluate('mcDebug.state.counts.M9')==2
  assert page.locator('[data-mod-card="drill-buffer"]').get_attribute('data-state')=='ready'
  assert page.locator(fold).evaluate('e=>e.open')
  page.locator('.facility-mods').scroll_into_view_if_needed();fit();shot('drill-level-2');press('[data-mod-select="drill-steel"]');assert page.locator('.mod-detail:visible').count()==1;press('[data-mod-select="drill-cooling"]');assert page.locator('.mod-detail:visible').count()==1;shot('one-detail');press('[data-mod-select="drill-cooling"]');assert page.locator('.mod-detail:visible').count()==0
  # Close is also a preference, not just open; reload uses the saved purchase.
  press(fold+' > summary');page.reload(wait_until='networkidle');drill()
  assert not page.locator(fold).evaluate('e=>e.open')
  assert page.evaluate('mcDebug.state.upgrades.levels["drill-buffer"]')==1
  # Main management folds remember explicit changes across tabs, close and purchase rebuilds.
  press('[data-nav="network"]');press('[data-industry-tab="power"]')
  equipment='[data-fold="industry:power:equipment"]';assert page.locator(equipment).evaluate('e=>e.open')
  press(equipment+' > summary');press('[data-industry-tab="automation"]');press('[data-industry-tab="power"]')
  assert not page.locator(equipment).evaluate('e=>e.open')
  press(equipment+' > summary');page.locator(equipment).scroll_into_view_if_needed()
  before=page.locator('#panel-content').evaluate('e=>e.scrollTop');press('#panel-close');press('[data-nav="network"]')
  assert page.locator(equipment).evaluate('e=>e.open')
  after=page.locator('#panel-content').evaluate('e=>e.scrollTop');assert abs(after-before)<6,(before,after)
  fit();shot('industry-power')
  # An actual checkbox action rebuilds the panel and retains keyboard focus.
  switch=page.locator('[data-auto-connect]')
  if switch.count():
   switch.focus();switch.press('Space');page.wait_for_timeout(400)
   assert page.locator('[data-auto-connect]').evaluate('e=>e===document.activeElement')
  press('[data-nav="village"]');fold2='[data-fold="village:education"]';assert page.locator(fold2).evaluate('e=>e.open')
  press(fold2+' > summary');press('[data-village-tab="production"]');press('[data-village-tab="residents"]')
  assert not page.locator(fold2).evaluate('e=>e.open');fit();shot('village')
  page.reload(wait_until='networkidle');press('[data-nav="village"]');assert not page.locator(fold2).evaluate('e=>e.open')
  for theme in ['web-theme-backpack','web-theme-oak','web-theme-redstone','web-theme-end']:
   page.evaluate('(theme)=>{const s=structuredClone(mcDebug.state);s.webAppearance.owned[theme]=true;s.webAppearance.equipped.theme=theme;mcDebug.setState(s)}',theme)
   drill();page.locator('.facility-mods').scroll_into_view_if_needed();fit();shot(theme)
  assert not errors,errors
  reports.append({'engine':engine,'viewport':[width,height],'errors':errors,'scrollReturn':{'before':before,'after':after},'checks':['real modification purchase','base level requirement link and unlock','save reload','open and closed fold persistence','purchase rebuild','keyboard focus','scroll anchor','four themes','no horizontal overflow']})
  print(json.dumps(reports[-1],ensure_ascii=False),flush=True);ctx.close();browser.close()
(OUT/'report.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2)+'\n')
