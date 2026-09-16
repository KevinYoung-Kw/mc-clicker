"""UI regression: stable HUD/cargo nodes, device control semantics and layout tools.
Runs against a development server using isolated seeded browser contexts only.
"""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/v1.4.3/qa/controls';OUT.mkdir(parents=True,exist_ok=True)
seed=json.loads((ROOT/'docs/qa/v13/fixture.json').read_text());seed.update(money=1e12,savedAt=1,reducedMotion=True)
reports=[]
with sync_playwright() as p:
 for engine,width,height in [('chromium',1440,960),('chromium',760,900),('chromium',320,740),('webkit',390,844)]:
  b=getattr(p,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}));mobile=width<760
  c=b.new_context(viewport={'width':width,'height':height},is_mobile=mobile,has_touch=mobile)
  c.add_init_script('if(!sessionStorage.seeded){localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(seed))+');sessionStorage.seeded="1"}')
  page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:8890/',wait_until='networkidle');page.wait_for_function('!!window.mcDebug')
  def press(selector):
   node=page.locator(selector).first
   node.tap() if mobile else node.click()
   page.wait_for_timeout(120)
  def expand():
   if mobile and page.locator('#panel-expand').get_attribute('aria-expanded')!='true': press('#panel-expand')
  def fit():
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'document overflow'
   assert page.locator('#panel-content').evaluate('e=>e.scrollWidth<=e.clientWidth+1'),'panel overflow'
   assert page.locator('.hud').evaluate('e=>e.scrollWidth<=e.clientWidth+1'),'HUD overflow'
  def shot(name):
   page.screenshot(path=OUT/f'{engine}-{width}-{name}.png')
  def drill():
   page.evaluate('mcDebug.world.onAction({type:"select",id:"M9"})');expand()
  drill();fit()
  assert page.locator('.item-hero').evaluate('e=>e.nextElementSibling.getBoundingClientRect().top-e.getBoundingClientRect().bottom')>=15
  assert page.locator('[data-focus-item="M9"]').bounding_box()['y'] < page.locator('.item-hero').bounding_box()['y']
  press('[data-focus-item="M9"]');assert page.evaluate('Number.isFinite(mcDebug.world.zoom)')
  pos=page.evaluate('JSON.stringify(mcDebug.state.placements.M9)');money=page.evaluate('mcDebug.state.money')
  press('[data-move="M9"]');assert page.locator('#placement-cancel').is_visible();press('#placement-cancel')
  assert page.evaluate('JSON.stringify(mcDebug.state.placements.M9)')==pos,'cancel relocation changed position'
  drill();button='[data-connection-actions="M9"] [data-connection-primary]'
  press(button)
  assert page.evaluate('mcDebug.state.grid.disabled.includes("M9")')
  assert page.locator(button).get_attribute('data-run-state')=='paused'
  assert '恢复' in page.locator(button).get_attribute('aria-label')
  assert page.locator(button+' svg').count()==1
  shot('paused')
  press(button);assert not page.evaluate('mcDebug.state.grid.disabled.includes("M9")')
  assert page.locator(button).get_attribute('data-run-state')=='enabled'
  page.locator(button).evaluate('e=>window.qaControl=e');page.wait_for_timeout(650)
  assert page.locator(button).evaluate('e=>e===window.qaControl && !!e.querySelector("svg")'),'timer replaced icon/button'
  # On desktop/tablet and mobile alike, prices crossing digit/unit boundaries keep neighbours fixed.
  page.evaluate('window.dispatchEvent(new Event("blur"))')
  boxes=[]
  for value in [9,99,9999,999999,1000000,999999999,1000000000,1e12,1e18,1e100]:
   page.evaluate('(v)=>{mcDebug.state.money=v;mcDebug.state.rate=v;mcDebug.advance(0)}',value);page.wait_for_timeout(70)
   fit();boxes.append(page.locator('#power-top').bounding_box())
  assert max(x['x'] for x in boxes)-min(x['x'] for x in boxes)<1,'money moved energy'
  assert '百万' not in page.locator('#money').inner_text()
  assert '明细' not in page.locator('#income-open').inner_text()
  press('#income-open');assert page.locator('[data-income-balance]').inner_text();press('#modal-close')
  press('[data-nav="village"]');press('[data-village-tab="construction"]');expand();fit()
  assert page.locator('.equipment-heading .facility-icon').count()>0
  assert '管理 / 改造' not in page.locator('#panel-content').inner_text()
  press('.equipment-heading [data-manage-item="V3"]');assert page.locator('.item-toolbar').is_visible()
  press('[data-nav="village"]');press('[data-village-tab="market"]');expand()
  # Inject two synthetic display rows after pausing; preserve real production/settlement rules.
  page.evaluate('''()=>{window.dispatchEvent(new Event('blur'));mcDebug.state.community.batches=[{id:'qa-a',label:'麦田收获',qty:9,claimed:null,delivered:0},{id:'qa-b',label:'矿区原料',qty:999,claimed:'r1',delivered:0}];mcDebug.state.orders=[{id:'qa-order',label:'集市订单',progress:9,target:10000,reward:1234,life:60.1}];mcDebug.advance(0)}''')
  page.wait_for_timeout(300);fit()
  page.locator('[data-cargo-id="qa-a"]').evaluate('e=>window.qaCargo=e');page.locator('[data-order-id="qa-order"]').evaluate('e=>window.qaOrder=e')
  anchor=page.locator('.market-cargo').bounding_box();bottom=page.locator('.management-equipment').bounding_box()['y']
  for qty,status,seconds in [(10,'r2',60),(999999,None,59),(1e12,'r2',9),(999,None,0)]:
   page.evaluate('''([qty,status,seconds])=>{mcDebug.state.community.batches[0].qty=qty;mcDebug.state.community.batches[0].claimed=status;mcDebug.state.orders[0].life=seconds;mcDebug.state.orders[0].progress=qty;mcDebug.advance(0)}''',[qty,status,seconds]);page.wait_for_timeout(70)
   assert page.locator('[data-cargo-id="qa-a"]').evaluate('e=>e===window.qaCargo')
   assert page.locator('[data-order-id="qa-order"]').evaluate('e=>e===window.qaOrder')
   assert abs(page.locator('.management-equipment').bounding_box()['y']-bottom)<1,'cargo moved shop'
  assert page.locator('[data-order-time]').inner_text()=='00:00'
  page.evaluate('mcDebug.state.community.batches=[];mcDebug.advance(0)');page.wait_for_timeout(70)
  assert abs(page.locator('.management-equipment').bounding_box()['y']-bottom)<1,'empty cargo moved shop'
  # Populate a screenshot with genuine-looking goods while keeping deterministic UI updates.
  page.evaluate('mcDebug.state.community.batches=[{id:"qa-a",label:"麦田收获",qty:1200,claimed:null,delivered:0},{id:"qa-b",label:"矿区原料",qty:9800,claimed:"r1",delivered:0}];mcDebug.advance(0)')
  for theme in ['', 'web-theme-backpack','web-theme-oak','web-theme-redstone','web-theme-end']:
   page.evaluate('(t)=>document.body.dataset.theme=t',theme);fit();shot('market-'+(theme or 'default'))
  # Room controls use the same icons, and target the item's saved indoor location.
  page.evaluate('document.body.dataset.theme="";mcDebug.go("world");mcDebug.world.onAction({type:"select",id:"L2"})');page.wait_for_timeout(500)
  page.evaluate('mcDebug.world.onAction({type:"studio-select",key:"L1"})');page.wait_for_timeout(300);expand()
  assert page.locator('[data-room-focus="L1"]').is_visible()
  press('[data-room-focus="L1"]');assert page.evaluate('Number.isFinite(mcDebug.world.zoom)')
  press('[data-room-move="L1"]');assert page.locator('#placement-cancel').is_visible();press('#placement-cancel')
  fit();shot('studio')
  assert not errors,errors
  reports.append(dict(engine=engine,width=width,stableHud=True,stableCargo=True,stableOrderNodes=True,deviceToggle=True,locationAndMove=True,themes=5,errors=errors));c.close();b.close()
(OUT/'report.json').write_text(json.dumps(reports,indent=2)+'\n');print('Facility controls: all four viewports passed')
