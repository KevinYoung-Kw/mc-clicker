"""V1.4 real UI flows in isolated browser saves, including WebKit touch."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/v1.4/qa';OUT.mkdir(parents=True,exist_ok=True)
seed=json.loads((ROOT/'docs/qa/v13/fixture.json').read_text())
seed['money']=1000000;seed['grid']['disabled']=[];seed['grid']['links'].update(M9=False,M8=False)
seed['grid']['automation'].update(farm=0,wool=0,mine=0)
seed['buffers']['overworld'].update(raw=10,goods=4)
seed['reducedMotion']=True
report=[]
with sync_playwright() as p:
 for engine,width in [('chromium',1440),('chromium',320),('webkit',390)]:
  browser=getattr(p,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}))
  context=browser.new_context(viewport={'width':width,'height':960 if width>760 else 844},is_mobile=width<760,has_touch=width<760)
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def press(selector):
   loc=page.locator(selector) if isinstance(selector,str) else selector
   loc.tap() if width<760 else loc.click()
  def tab(name):press(f'[data-industry-tab="{name}"]')
  def snapshot(name):page.screenshot(path=OUT/f'{engine}-{width}-{name}.png')
  def fit():
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'), 'page overflow'
   assert page.locator('#panel-content').evaluate('e=>e.scrollWidth<=e.clientWidth+1'),'panel overflow'
  page.goto('http://127.0.0.1:8890/',wait_until='networkidle');page.wait_for_function('!!window.mcDebug?.world')
  page.evaluate('s=>mcDebug.setState(s)',seed);page.evaluate('mcDebug.go("network")');tab('power')
  if width<760:assert page.locator('#game').evaluate('e=>e.classList.contains("sheet-expanded")')
  assert '未接入' in page.locator('[data-facility-status="M9"]').inner_text()
  press('[data-network-action="connect"][data-network-id="M9"]')
  page.wait_for_function('mcDebug.state.grid.links.M9===true')
  assert not page.locator('#modal').evaluate('e=>e.open'),'connection must not open a purchase dialog'
  page.wait_for_function('document.activeElement?.dataset.networkId==="M9"')
  press('[data-network-action="toggle"][data-network-id="M9"]')
  page.wait_for_function('mcDebug.state.grid.disabled.includes("M9")')
  assert page.evaluate('mcDebug.rates().electricity.perDevice.M9')==0
  press('[data-network-action="toggle"][data-network-id="M9"]')
  assert page.evaluate('!mcDebug.state.grid.disabled.includes("M9")')
  # Do not rebuild the connected card or move its focus during simulated time.
  page.locator('[data-connection-actions="M9"] button').first.evaluate('e=>{e.focus();window.v14Button=e;window.v14Rect=e.getBoundingClientRect().toJSON()}')
  page.wait_for_timeout(1600)
  assert page.evaluate('v14Button.isConnected&&document.activeElement===v14Button')
  assert page.evaluate('Math.abs(v14Button.getBoundingClientRect().y-v14Rect.y)<1')
  assert page.locator('[data-connection-actions="M9"]>div').evaluate('e=>e.getBoundingClientRect().height<56'), 'connection controls should be a compact row'
  fit();snapshot('power')
  press('[data-connect-all]');assert page.evaluate('mcDebug.state.grid.links.M8===true')
  press('[data-auto-connect]');assert page.evaluate('mcDebug.state.grid.autoConnect===true')
  # A map is optional, uses real layout and does not alter the world camera.
  camera=page.evaluate('mcDebug.world.captureCamera()')
  press('[data-network-map="power"]');assert page.locator('[data-network-svg] polyline').count()>0
  press('[data-map-zoom="1.3"]')
  svg=page.locator('[data-network-svg]');before=svg.get_attribute('viewBox')
  # Touch gestures include contacts starting on a facility, not only blank land.
  box=svg.bounding_box();x=box['x']+box['width']*.4;y=box['y']+box['height']*.5
  for type,id,cx,cy in [('pointerdown',1,x,y),('pointerdown',2,x+60,y),('pointermove',2,x+110,y),('pointerup',2,x+110,y),('pointerup',1,x,y)]:
   svg.dispatch_event(type,{'pointerId':id,'pointerType':'touch','clientX':cx,'clientY':cy,'bubbles':True})
  assert svg.get_attribute('viewBox')!=before,'pinch changes viewport'
  press('.network-map-picker summary');press('[data-map-pick="M7"]')
  fit();snapshot('map')
  press('[data-map-back]');assert page.evaluate('mcDebug.world.captureCamera()')==camera
  tab('logistics');press('[data-haul-choose="V4"]')
  press('[data-haul-assign="resident-1"]')
  page.wait_for_function('mcDebug.state.community.residents[0].prioritySource==="V4"')
  assert page.evaluate('mcDebug.state.community.residents[0].job')=='hauler'
  assert '阿木' in page.locator('[data-dispatch-source="V4"]').inner_text()
  press('[data-haul-choose="M1"]');press('[data-haul-cancel]');assert page.evaluate('mcDebug.state.community.residents[0].prioritySource')=='V4'
  fit();snapshot('logistics')
  tab('automation');press('[data-actuator="farm"][data-delta="1"]')
  assert page.evaluate('mcDebug.state.grid.automation.farm')==1
  press('[data-actuator="farm"][data-delta="-1"]');assert page.evaluate('mcDebug.state.grid.automation.farm')==0
  press('[data-actuator="farm"][data-delta="1"]');fit();snapshot('automation')
  # Bottom menu remains reachable in a full-height panel.
  press('[data-nav="village"]');press('.management-tabs [data-village-tab="residents"]')
  press('[data-roster-view="jobs"]');press('[data-workplace="farmer"]')
  press('[data-job-assign="resident-2"][data-job="farmer"]')
  assert page.evaluate('mcDebug.state.community.residents[1].job')=='farmer'
  fit();snapshot('jobs')
  page.evaluate('mcDebug.save()');page.reload(wait_until='networkidle');page.wait_for_function('!!window.mcDebug?.world')
  assert page.evaluate('mcDebug.state.grid.autoConnect') is True
  assert page.evaluate('mcDebug.state.grid.automation.farm')==1
  assert page.evaluate('mcDebug.state.community.residents[0].prioritySource')=='V4'
  assert page.evaluate('mcDebug.state.community.residents[1].job')=='farmer'
  # Purchased themes should not reintroduce width overflow or hide action labels.
  for theme in ['web-theme-backpack','web-theme-oak','web-theme-redstone','web-theme-end']:
   page.evaluate('(theme)=>{const s=structuredClone(mcDebug.state);s.webAppearance.owned[theme]=true;s.webAppearance.equipped.theme=theme;mcDebug.setState(s)}',theme)
   page.evaluate('mcDebug.go("network")');tab('logistics');fit();snapshot(theme)
  assert not errors,errors
  report.append(dict(engine=engine,width=width,connection=True,pause=True,fixedAllocation=True,hauling=True,workplaceBoard=True,save=True,mapCamera=True,stableFocus=True,themes=4,errors=errors))
  print(engine,width,'passed',flush=True);context.close();browser.close()
(OUT/'browser-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
