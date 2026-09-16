import json
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
out=root/'docs/qa'
s=json.loads((root/'tests/fixtures/layout-v2.json').read_text());s['realm']='overworld';s['money']=1e7;s['reducedMotion']=True;s.setdefault('live',{})['director']=False
errors=[];results=[]
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--use-angle=metal'])
 for width,height in [(1360,900),(390,844),(320,720)]:
  c=b.new_context(viewport={'width':width,'height':height},is_mobile=width<760,has_touch=width<760);page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:8890/');page.wait_for_load_state('networkidle');page.evaluate('s=>mcDebug.setState(s)',s);page.locator('[data-nav=live]').click();page.wait_for_function('document.body.classList.contains("live-page")');page.wait_for_timeout(700)
  assert not page.locator('#panel').is_visible()
  stage=page.locator('#stage').bounding_box();assert page.locator('#stage').evaluate('(el)=>getComputedStyle(el).borderTopWidth')=='0px'
  assert stage['height']>height*.52,(width,stage)
  page.screenshot(path=str(out/f'room-first-{width}-default.png'))
  page.locator('[data-room-tab=equipment]').click();page.wait_for_timeout(200)
  panel=page.locator('#panel').bounding_box();stageopen=page.locator('#stage').bounding_box()
  if width<760:assert panel['height']<=height*.4+1,(width,panel)
  else:assert panel['width']==350,panel
  assert not (stageopen['x']<panel['x']+panel['width'] and stageopen['x']+stageopen['width']>panel['x'] and stageopen['y']<panel['y']+panel['height'] and stageopen['y']+stageopen['height']>panel['y']),(width,panel,stageopen)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
  page.screenshot(path=str(out/f'room-first-{width}-equipment.png'))
  page.locator('[data-room-tab=decor]').click();page.wait_for_timeout(100);page.screenshot(path=str(out/f'room-first-{width}-decor.png'))
  page.locator('[data-room-extra]').first.click();page.wait_for_timeout(100);assert page.locator('#placement-bar').is_visible();page.screenshot(path=str(out/f'room-first-{width}-placement.png'));page.locator('#placement-cancel').click();page.locator('#room-gifts').click();page.wait_for_timeout(100);assert page.locator('#gift-layer').bounding_box()['height']==88;page.screenshot(path=str(out/f'room-first-{width}-gifts.png'))
  page.locator('#room-close-panel').click();page.locator('#room-monitor').click();page.wait_for_timeout(100);page.screenshot(path=str(out/f'room-first-{width}-monitor.png'))
  results.append({'width':width,'stageDefault':stage,'stageWithPanel':stageopen,'panel':panel});c.close()
 assert not errors,errors
 report={'results':results,'errors':errors,'noTVBorder':True,'phoneDrawerUnder40svh':True,'placementAndReceiptVisible':True};(out/'room-first-css-observations.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report));b.close()
