"""Real themed dropdowns, assignment/locate, text layout and saved jobs. Isolated saves."""
from pathlib import Path
import json, re
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'docs/qa/v132'; OUT.mkdir(parents=True,exist_ok=True)
seed=json.loads((ROOT/'docs/qa/v13/fixture.json').read_text()); seed['reducedMotion']=True
report=[]
with sync_playwright() as p:
 for engine,width in [('chromium',1440),('webkit',390),('chromium',320)]:
  b=getattr(p,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}))
  ctx=b.new_context(viewport={'width':width,'height':960 if width>760 else 844},is_mobile=width<760,has_touch=width<760,accept_downloads=True)
  page=ctx.new_page(); errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def press(loc):
   loc.tap() if width<760 else loc.click()
  def companion(id='resident-1'):
   page.evaluate('(id)=>mcDebug.openCompanion(id)',id);page.wait_for_selector('.resident-name')
  def menu(selector):
   trigger=page.locator(selector).locator('..').get_by_role('combobox')
   press(trigger);page.wait_for_selector('.game-select-menu');return trigger
  def choose(pattern):press(page.get_by_role('option').filter(has_text=re.compile(pattern)).first)
  def bounded():
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   assert page.locator('.game-select-menu').evaluate('(e)=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1}')
  page.goto('http://127.0.0.1:8890/',wait_until='networkidle');page.wait_for_function('!!window.mcDebug?.world')
  page.evaluate('s=>mcDebug.setState(s)',seed);companion()
  assert not page.get_by_text(re.compile('在世界里找到|在直播间里找到')).count()
  assert page.locator('.resident-name > [data-person-focus]').count()==1
  a=page.locator('.resident-name h3').bounding_box();z=page.locator('.resident-locate').bounding_box();assert z['x']>=a['x']+a['width']-1
  trigger=menu('[data-assign]');bounded();assert page.get_by_role('option').count()==10
  assert '农田' in page.get_by_role('option').filter(has_text='农民').inner_text()
  assert '自动收割' in page.get_by_role('option').filter(has_text='农民').inner_text()
  assert '加速 10%' in page.get_by_role('option').filter(has_text='音序师').inner_text()
  page.screenshot(path=OUT/f'{engine}-{width}-jobs.png')
  choose('农民');page.wait_for_function('mcDebug.state.community.residents[0].job==="farmer"')
  assert page.locator('.game-select-menu').count()==0
  page.wait_for_function('document.activeElement?.getAttribute("role")==="combobox"')
  assert '农民' in page.locator('[data-assign]').locator('..').inner_text()
  # The actual simulation keeps the menu open and its trigger stable while status numbers update.
  menu('[data-assign]');page.evaluate('mcDebug.advance(3)');page.wait_for_timeout(1000);assert page.locator('.game-select-menu').is_visible()
  page.locator('[data-assign]').locator('..').get_by_role('combobox').press('Escape');assert page.locator('.game-select-menu').count()==0
  # Keyboard selection uses the same native change handler; no mining from Space.
  combo=page.locator('[data-assign]').locator('..').get_by_role('combobox');combo.press('Space');combo.press('Home');combo.press('Enter')
  page.wait_for_function('mcDebug.state.community.residents[0].job==="idle"')
  menu('[data-assign]');choose('农民')
  companion('resident-2');page.evaluate('mcDebug.state.counts.V4=1');companion('resident-2')
  menu('[data-assign]');full=page.get_by_role('option').filter(has_text='农民');assert full.get_attribute('aria-disabled')=='true';assert '岗位已满' in full.inner_text()
  full.click(force=True);assert page.evaluate('mcDebug.state.community.residents[1].job')=='idle';choose('乐师')
  page.wait_for_function('mcDebug.state.community.residents[1].job==="musician"')
  # Training and selection values continue to use the original data flow.
  companion();menu('[data-study]');choose('物流');assert page.locator('[data-study]').input_value()=='hauling'
  assert page.locator('[data-train]').get_attribute('data-skill')=='hauling'
  press(page.locator('.resident-locate'));page.wait_for_function('mcDebug.world.focusedCompanion==="resident-1"')
  page.evaluate('mcDebug.save()');page.reload(wait_until='networkidle');page.wait_for_function('!!window.mcDebug?.world')
  assert page.evaluate('mcDebug.state.community.residents[0].job')=='farmer';assert page.evaluate('mcDebug.state.community.residents[1].job')=='musician'
  for theme in ['', 'web-theme-backpack','web-theme-oak','web-theme-redstone','web-theme-end']:
   page.evaluate('(theme)=>{const s=structuredClone(mcDebug.state);s.webAppearance.equipped.theme=theme;if(theme)s.webAppearance.owned[theme]=true;mcDebug.setState(s)}',theme)
   companion();menu('[data-assign]');bounded();page.screenshot(path=OUT/f'{engine}-{width}-{theme or "default"}.png')
   page.locator('[data-assign]').locator('..').get_by_role('combobox').press('Escape')
  # A dropdown inside the share dialog must appear over the dialog and remain clickable.
  page.locator('#share-open').evaluate('e=>e.click()');page.get_by_role('combobox',name='纪念卡样式').wait_for()
  menu('#share-card-style');bounded();choose('默认');assert page.locator('#modal').evaluate('e=>e.open')
  page.locator('#generate-card').click();page.wait_for_selector('#download-card:not([hidden])',timeout=60000)
  page.evaluate('document.querySelector("#modal").close()')
  # Existing global selectors, including callbacks that rebuild the panel.
  page.evaluate('mcDebug.go("network")');page.locator('[data-industry-tab="logistics"]').click();menu('[data-option="priority"]');choose('优先运输')
  assert page.evaluate('mcDebug.state.priority')=='logistics'
  menu('[data-option="beacon"]');choose('物流强化');assert page.evaluate('mcDebug.state.beacon')=='logistics'
  page.locator('[data-industry-tab="automation"]').click();menu('[data-auto="farm"]');choose('1 台');assert page.evaluate('mcDebug.state.grid.automation.farm')==1
  page.evaluate('mcDebug.go("atlas")');page.locator('[data-detail="V19"]').first.click()
  for id in ['env-weather','env-rain']:
   page.locator(f'[data-env-buy="{id}"]').click();page.locator('#placement-confirm').click()
  menu('[data-env-select]');choose('晴');assert page.evaluate('mcDebug.state.environment.weather')=='clear'
  page.screenshot(path=OUT/f'{engine}-{width}-weather.png')
  # Long plain-language descriptions must fit the smallest viewport.
  page.evaluate('mcDebug.state.counts.V2=0;mcDebug.go("atlas")');page.locator('[data-detail="V2"]').first.click();assert page.get_by_text('一种可以自己赚绿宝石的生物',exact=False).count()>0
  page.screenshot(path=OUT/f'{engine}-{width}-villager-copy.png');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  assert not errors,errors
  report.append(dict(engine=engine,width=width,assignment=True,location=True,keyboard=True,themes=5,nativeHandlersPreserved=True,savedJobs=True,errors=errors));print(engine,width,'passed',flush=True)
  ctx.close();b.close()
(OUT/'browser-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
