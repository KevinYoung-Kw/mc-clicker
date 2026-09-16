"""Exercise menu toggles, income affordance and card layout in isolated saves."""
from pathlib import Path
import argparse, json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:8890/')
parser.add_argument('--out', default='docs/v1.4/qa/interface')
parser.add_argument('--production', action='store_true')
args=parser.parse_args();out=ROOT/args.out;out.mkdir(parents=True,exist_ok=True)
seed=json.loads((ROOT/'docs/qa/v13/fixture.json').read_text())
seed['savedAt']=1;seed['money']=1000000;seed['reducedMotion']=True
results=[]
with sync_playwright() as p:
 for engine,width,height in [('chromium',1440,960),('chromium',320,740),('webkit',390,844)]:
  browser=getattr(p,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}))
  context=browser.new_context(viewport={'width':width,'height':height},is_mobile=width<760,has_touch=width<760)
  context.add_init_script('if(!sessionStorage.getItem("qa-seeded")){localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(seed))+');sessionStorage.setItem("qa-seeded","1")}')
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def press(selector):
   loc=page.locator(selector)
   loc.tap() if width<760 else loc.click()
  def shot(name):page.screenshot(path=out/f'{engine}-{width}-{name}.png')
  def fit():
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'), 'page overflow'
   assert page.locator('#panel-content').evaluate('e=>e.scrollWidth<=e.clientWidth+1'), 'panel overflow'
  page.goto(args.url,wait_until='networkidle');page.wait_for_selector('#world canvas')
  if args.production:assert page.evaluate('typeof window.mcDebug')=='undefined'
  if page.locator('#panel').is_visible():press('#panel-close')
  wallet=page.locator('#income-open').bounding_box()
  assert wallet['height']>=44 and wallet['y']>=0
  assert wallet['y']+wallet['height']<=page.locator('.hud').bounding_box()['height']+2
  assert '明细' in page.locator('#income-open').inner_text()
  press('#income-open');assert page.locator('.income-panel').is_visible()
  assert page.locator('#income-open').get_attribute('aria-expanded')=='true'
  assert page.locator('.income-lines').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
  shot('income');press('#modal-close')
  page.wait_for_function('document.querySelector("#income-open").getAttribute("aria-expanded")==="false"')
  for menu in ['build','village','network','atlas']:
   button=f'[data-nav="{menu}"]'
   press(button);assert page.locator('#panel').is_visible()
   assert page.locator(button).get_attribute('aria-expanded')=='true'
   press(button);assert page.locator('#panel').is_hidden()
   assert page.locator(button).get_attribute('aria-expanded')=='false'
   press(button);assert page.locator('#panel').is_visible();press('#panel-close')
  press('[data-nav="network"]');press('[data-industry-tab="power"]')
  assert page.locator('[data-industry-tab="power"]').get_attribute('aria-pressed')=='true'
  fit();shot('power')
  press('[data-nav="village"]');press('[data-village-tab="construction"]');fit();shot('village')
  # A facility's status and actions must no longer be squeezed into a text subcolumn.
  cards=page.locator('.management-equipment article')
  assert cards.count()>0
  for card in cards.all():
   for status in card.locator('.facility-status').all():
    assert status.bounding_box()['width']>=card.bounding_box()['width']-30, 'narrow equipment status'
  # Switch tabs while fully expanded; the active entry remains a close control.
  if width<760:
   if page.locator('#panel-expand').get_attribute('aria-expanded')!='true':press('#panel-expand')
   press('[data-nav="build"]');assert page.locator('#game').evaluate('e=>e.classList.contains("sheet-expanded")')
   press('[data-nav="build"]');assert page.locator('#panel').is_hidden()
  else:
   press('#panel-close');page.keyboard.press('1');assert page.locator('#panel').is_visible()
   page.keyboard.press('1');assert page.locator('#panel').is_hidden()
  if not args.production:
   # Programmatic links stay idempotent and camera memory survives repeated toggles.
   page.evaluate('mcDebug.go("world");mcDebug.world.zoom=1.8;mcDebug.world.yaw=.55;mcDebug.world.resize()')
   before=page.evaluate('mcDebug.world.captureCamera()')
   press('[data-nav="build"]');page.evaluate('mcDebug.go("build")');assert page.locator('#panel').is_visible()
   press('[data-nav="build"]')
   after=page.evaluate('mcDebug.world.captureCamera()')
   if width<760:
    assert abs(before['zoom']-after['zoom'])<.001 and abs(before['yaw']-after['yaw'])<.001
   page.evaluate('mcDebug.go("live")');page.wait_for_selector('body.live-page')
   for tab in ['program','equipment','arrange','decor']:
    button=f'[data-room-tab="{tab}"]'
    press(button);assert page.locator(button).get_attribute('aria-expanded')=='true'
    press(button);assert page.locator('#panel').is_hidden()
    assert page.locator('body.live-page').count()==1,'closing room menu must not exit the room'
   page.evaluate('mcDebug.go("world")')
   for theme in ['web-theme-backpack','web-theme-oak','web-theme-redstone','web-theme-end']:
    page.evaluate('(theme)=>{const s=structuredClone(mcDebug.state);s.webAppearance.owned[theme]=true;s.webAppearance.equipped.theme=theme;mcDebug.setState(s)}',theme)
    press('#income-open');shot(theme+'-income');press('#modal-close')
    page.evaluate('mcDebug.go("village")');press('[data-village-tab="construction"]');fit();shot(theme+'-village');press('#panel-close')
  assert not errors,errors
  results.append(dict(engine=engine,width=width,walletHitArea=wallet,errors=errors))
  context.close();browser.close();print(engine,width,'passed',flush=True)
(out/'results.json').write_text(json.dumps(results,indent=2)+'\n')
