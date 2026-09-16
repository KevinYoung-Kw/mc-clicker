"""WebKit compatibility smoke check; desktop WebKit emulating a phone, not a physical iPhone."""
import argparse,json,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];KEY='mc-clicker-world-v2'
p=argparse.ArgumentParser();p.add_argument('--url',required=True);p.add_argument('--label',required=True);args=p.parse_args()
out=ROOT/'docs/qa'/('webkit-mobile-'+args.label);out.mkdir(parents=True,exist_ok=True)
seed=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {residentFixture}from'./scripts/resident-fixture.mjs';const s=residentFixture();s.reducedMotion=false;s.guidance.info=false;console.log(JSON.stringify(s));"],cwd=ROOT,text=True))
r={'url':args.url,'engine':'desktop WebKit with mobile viewport/touch emulation','checks':[],'errors':[]}
with sync_playwright() as pw:
 browser=pw.webkit.launch()
 try:
  ctx=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=1)
  ctx.add_init_script('localStorage.setItem('+json.dumps(KEY)+','+json.dumps(json.dumps(seed))+');')
  page=ctx.new_page();page.on('pageerror',lambda e:r['errors'].append(str(e)))
  page.goto(args.url,wait_until='networkidle');page.wait_for_timeout(800)
  assert page.locator('#fallback').is_hidden();assert page.locator('.hud').bounding_box()['height']==60
  page.locator('#hud-more').tap();assert page.locator('#hud-tools').is_visible() and page.locator('#info-open').is_hidden();page.locator('#hud-more').tap()
  page.evaluate('window.dispatchEvent(new Event("blur"))');assert page.locator('#notice-center').is_hidden();page.evaluate('window.dispatchEvent(new Event("focus"))')
  r['checks'].append('WebGL, 60px header, functional touch menu and unpurchased information gating')
  button=page.locator('#mine');css=button.evaluate('(e)=>({selection:getComputedStyle(e).userSelect,webkitSelection:getComputedStyle(e).webkitUserSelect,callout:getComputedStyle(e).webkitTouchCallout,supportsCallout:CSS.supports("-webkit-touch-callout","none")})');r['css']=css
  assert css['selection']=='none' or css['webkitSelection']=='none'
  if css['supportsCallout']:assert css['callout']=='none'
  before=page.evaluate('mcDebug.state.clicks');button.tap();assert page.evaluate('mcDebug.state.clicks')==before+1
  b=button.bounding_box();page.mouse.move(b['x']+b['width']/2,b['y']+b['height']/2);page.mouse.down();page.wait_for_timeout(1600)
  assert page.evaluate('mcDebug.state.clicks')>=before+6
  assert page.evaluate('String(getSelection())')==''
  page.mouse.up();after=page.evaluate('mcDebug.state.clicks');page.wait_for_timeout(500);assert page.evaluate('mcDebug.state.clicks')==after
  for ev in ['contextmenu','selectstart','copy']:assert button.evaluate('(e,t)=>!e.dispatchEvent(new Event(t,{bubbles:true,cancelable:true}))',ev)
  r['checks'].append('WebKit non-selectable mining control, actual touch tap, held pointer repeat/release and canceled native-menu events')
  page.locator('#world canvas').dispatch_event('wheel',{'deltaY':-450,'bubbles':True,'cancelable':True});page.wait_for_timeout(600);before=page.evaluate('mcDebug.world.captureCamera()')
  page.locator('[data-nav="build"]').tap();page.wait_for_timeout(550);page.locator('#panel-close').tap();page.wait_for_timeout(550)
  assert page.evaluate('mcDebug.world.captureCamera()')==before
  page.screenshot(path=out/'phone.png');r['checks'].append('WebKit camera restores after synthetic wheel zoom and touch opening/closing shop')
  assert not r['errors'],r['errors'];r['passed']=True
 except Exception as e:
  r['passed']=False;r['failure']=str(e)
  if 'page' in locals():page.screenshot(path=out/'failure.png')
  raise
 finally:
  (out/'observations.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n');browser.close()
print(json.dumps({'passed':True,'checks':len(r['checks'])}))
