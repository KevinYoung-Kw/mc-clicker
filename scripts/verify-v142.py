"""Mobile menu/render lifecycle, management controls and themes; isolated saves only."""
from pathlib import Path
import argparse,json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--url',default='http://127.0.0.1:8890/');p.add_argument('--out',default='docs/v1.4.2/qa/browser');args=p.parse_args()
out=ROOT/args.out;out.mkdir(parents=True,exist_ok=True)
seed=json.loads((ROOT/'docs/qa/v13/fixture.json').read_text());seed['savedAt']=1;seed['reducedMotion']=False;seed['counts']['V2']=24
reports=[]
with sync_playwright() as pw:
 for engine,width,height in [('chromium',1440,960),('chromium',320,740),('webkit',390,844)]:
  browser=getattr(pw,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}));mobile=width<760
  ctx=browser.new_context(viewport={'width':width,'height':height},is_mobile=mobile,has_touch=mobile)
  ctx.add_init_script('if(!sessionStorage.getItem("qa-seeded")){localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(seed))+');sessionStorage.setItem("qa-seeded","1")}')
  page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(args.url,wait_until='networkidle');page.wait_for_selector('#world canvas')
  def press(selector):
   loc=page.locator(selector).first
   loc.tap() if mobile else loc.click()
  def shot(name):page.wait_for_timeout(500);page.screenshot(path=out/f'{engine}-{width}-{name}.png')
  def fit():
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
   assert page.locator('#panel-content').evaluate('e=>e.scrollWidth<=e.clientWidth+1'), 'panel overflow'
  def scene():
   page.wait_for_timeout(550)
   status=page.evaluate('''()=>{const w=mcDebug.world;return {time:w.time,active:w.active,contextLost:w.renderer.getContext().isContextLost(),finite:[...w.camera.projectionMatrix.elements,...w.camera.position.toArray(),w.displaySize].every(Number.isFinite),visible:getComputedStyle(document.querySelector('#stage')).visibility,calls:w.renderer.info.render.calls,camera:w.captureCamera(),rendering:w.raf}}''')
   assert status['finite'] and status['visible']=='visible' and status['calls']>0 and not status['contextLost'],status
   return status
  page.evaluate('mcDebug.go("world");mcDebug.world.zoom=.7;mcDebug.world.yaw=.32;mcDebug.world.resize()')
  original=page.evaluate('mcDebug.world.captureCamera()');loop=[]
  for i in range(16):
   nav=['build','village','network','atlas'][i%4];press(f'[data-nav="{nav}"]')
   if mobile and i%3==0:press('#panel-expand')
   if i%2:press('#panel-close')
   else:press(f'[data-nav="{nav}"]')
   status=scene();loop.append(status)
   assert abs(status['camera']['zoom']-original['zoom'])<1e-6
   assert abs(status['camera']['yaw']-original['yaw'])<1e-6
  shot('world-after-menus');print(engine,width,'menu loops passed',flush=True)
  # A full-screen mail panel can be exited or switched to another menu.
  page.evaluate('mcDebug.world.onAction({type:"select",id:"V18"})');page.wait_for_selector('#mail-panel');press('[data-mail-open]');fit();shot('mail')
  press('[data-nav="network"]');press('[data-industry-tab="power"]');fit();shot('power')
  assert page.locator('.electricity-dashboard').evaluate('e=>getComputedStyle(e).borderTopWidth')=='1px'
  press('[data-industry-tab="automation"]');fit();shot('automation')
  steps=page.locator('[data-actuator][data-delta="1"]:not(:disabled)')
  if steps.count():
   before=page.evaluate('({...mcDebug.state.grid.automation})');press('[data-actuator][data-delta="1"]:not(:disabled)')
   after=page.evaluate('({...mcDebug.state.grid.automation})');assert before!=after
   press('[data-actuator][data-delta="-1"]:not(:disabled)')
  press('[data-industry-tab="logistics"]');fit();shot('logistics');press('[data-haul-choose]');fit();shot('hauler')
  press('[data-haul-cancel]');press('[data-nav="village"]');fit();shot('residents')
  assert page.locator('.resident-roster [data-person]').count()==24
  press('[data-roster-view="jobs"]');fit();shot('jobs');press('[data-workplace]');fit();shot('assign')
  press('[data-job-cancel]') if page.locator('[data-job-cancel]').count() else None
  press('[data-roster-view="people"]');press('[data-person]');fit();shot('resident-detail')
  # Secondary training folds remain open during simulation refreshes.
  training=page.locator('.management-disclosure').last;training.locator('summary').click();page.wait_for_timeout(1200);assert training.get_attribute('open') is not None
  press('[data-nav="build"]');fit()
  order=page.locator('.construction-tabs > button').evaluate_all('(els)=>els.map(e=>e.hasAttribute("data-expand-land")?"expand":e.dataset.open)')
  assert order==['expand','build','owned'],order
  shot('shop');press('[data-expand-land]');page.wait_for_selector('#placement-cancel');fit();shot('land');press('#placement-cancel');press('#panel-close');scene()
  # Device detail enters the same management UI after moving to the studio.
  page.evaluate('mcDebug.go("live")');page.wait_for_selector('body.live-page')
  for tab in ['program','equipment','arrange','decor']:
   press(f'[data-room-tab="{tab}"]');press(f'[data-room-tab="{tab}"]');scene()
  page.evaluate('mcDebug.world.onAction({type:"studio-select",key:"L1"})');page.wait_for_selector('[data-connection-actions="L1"]');fit();shot('indoor-jukebox')
  page.evaluate('mcDebug.go("world")');scene()
  if mobile:
   page.set_viewport_size({'width':height,'height':width});scene()
   page.set_viewport_size({'width':width,'height':height});scene()
  # Force actual GL context loss while a full-screen menu covers the scene.
  press('[data-nav="network"]')
  supported=page.evaluate('''()=>{const gl=mcDebug.world.renderer.getContext();window.qaLose=gl.getExtension('WEBGL_lose_context');if(!qaLose)return false;qaLose.loseContext();return true}''')
  if supported:
   page.wait_for_function('mcDebug.world.contextLost===true');press('#panel-close')
   page.wait_for_timeout(250);page.evaluate('qaLose.restoreContext()');page.wait_for_function('mcDebug.world.contextLost===false');scene();shot('context-restored')
  else:press('#panel-close')
  for theme in ['web-theme-backpack','web-theme-oak','web-theme-redstone','web-theme-end']:
   page.evaluate('(theme)=>{const s=structuredClone(mcDebug.state);s.webAppearance.owned[theme]=true;s.webAppearance.equipped.theme=theme;mcDebug.setState(s);mcDebug.go("network")}',theme)
   press('[data-industry-tab="automation"]');fit();shot(theme)
  assert not errors,errors
  reports.append({'engine':engine,'width':width,'menuCycles':len(loop),'glRecoveryExercised':supported,'errors':errors,'lastScene':loop[-1]})
  ctx.close();browser.close();print(engine,width,'passed',flush=True)
(out/'results.json').write_text(json.dumps(reports,indent=2)+'\n')
