import json
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1];out=root/'docs/qa';errors=[];result=[]
s=json.loads((root/'tests/fixtures/layout-v2.json').read_text());s['realm']='overworld';s['money']=1e7;s['reducedMotion']=True;s['guidance']={'version':1,'goals':True,'info':True,'collapsed':False,'notices':True};s.setdefault('live',{})['director']=False;s['sharing']={'unlocked':True,'unlockedAt':0}
def box(page,sel):return page.locator(sel).bounding_box() if page.locator(sel).is_visible() else None
def overlap(a,b):return bool(a and b and a['x']<b['x']+b['width'] and a['x']+a['width']>b['x'] and a['y']<b['y']+b['height'] and a['y']+a['height']>b['y'])
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--use-angle=metal'])
 c=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:8890/');page.wait_for_load_state('networkidle');page.bring_to_front();page.locator('[data-nav=world]').click();assert not page.locator('#mission').is_visible();assert not page.locator('#info-open').is_visible();page.screenshot(path=str(out/'guidance-new-390.png'))
 for _ in range(10):page.locator('#mine').tap()
 page.locator('[data-nav=build]').tap();page.locator('[data-buy=T1]').tap();page.locator('#placement-confirm').tap();page.locator('[data-nav=world]').tap()
 for _ in range(3):page.locator('#mine').tap()
 page.locator('[data-nav=build]').tap();page.wait_for_timeout(350);page.screenshot(path=str(out/'guidance-card-390.png'));page.locator('[data-buy-guidance=goals]').tap();page.locator('#placement-confirm').tap();page.locator('[data-nav=world]').tap();page.wait_for_timeout(100);assert page.locator('#mission').is_visible();assert not page.locator('#info-open').is_visible();page.screenshot(path=str(out/'guidance-earned-390.png'));result.append({'realStartingPurchase':page.evaluate('mcDebug.state.guidance')});c.close()
 for width,height in [(1360,900),(1180,900),(900,900),(800,900),(390,844),(320,720)]:
  c=b.new_context(viewport={'width':width,'height':height},is_mobile=width<760,has_touch=width<760);page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:8890/');page.wait_for_load_state('networkidle');page.bring_to_front();page.evaluate('s=>mcDebug.setState(s)',s);page.locator('[data-nav=world]').click();page.wait_for_timeout(200)
  for state in ['expanded','collapsed','drawer']:
   if state=='collapsed':page.locator('#mission-toggle').click()
   if state=='drawer':page.locator('#mission-toggle').click();page.locator('[data-nav=build]').click()
   page.wait_for_timeout(100);mission=box(page,'#mission');stage=box(page,'#stage');realm=box(page,'#realm-switch');home=box(page,'#home-view');row={'width':width,'mode':state,'mission':mission,'stage':stage,'realm':realm,'home':home,'realmOverlap':overlap(mission,realm),'homeOverlap':overlap(mission,home),'horizontalOverflow':page.evaluate('document.documentElement.scrollWidth>innerWidth')};result.append(row);page.screenshot(path=str(out/f'guidance-{width}-{state}.png'))
   assert mission and abs(mission['x']+mission['width']/2-(stage['x']+stage['width']/2))<1,row
   assert page.locator('#mission-toggle').bounding_box()['height']>=44
   assert not row['horizontalOverflow'],row
   assert not row['realmOverlap'] and not row['homeOverlap'],row
  page.locator('#info-open').click();page.locator('#info-panel').wait_for();page.screenshot(path=str(out/f'guidance-{width}-info.png'));page.locator('#info-return').scroll_into_view_if_needed();assert page.locator('#info-return').bounding_box()['y']<height;assert not page.locator('#modal').evaluate('(e)=>e.scrollWidth>e.clientWidth');c.close()
 b.close()
report={'results':result,'errors':errors};(out/'guidance-css-observations.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report));assert not errors
