"""Fresh-player discovery, real UI purchases, site preview and income feedback."""
import argparse,json
from pathlib import Path
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--browser',default='webkit',choices=['webkit','chromium']);p.add_argument('--url',default='http://127.0.0.1:8890/');p.add_argument('--out');a=p.parse_args()
out=Path(__file__).resolve().parents[1]/(a.out or ('docs/qa/first-purchase-'+a.browser));out.mkdir(parents=True,exist_ok=True)
report={'checks':[],'errors':[]}
with sync_playwright() as pw:
 b=getattr(pw,a.browser).launch(headless=True,args=['--use-angle=metal'] if a.browser=='chromium' else [])
 try:
  for width,height in [(390,844),(320,640),(1440,900)]:
   ctx=b.new_context(viewport={'width':width,'height':height},is_mobile=width<760,has_touch=width<760)
   page=ctx.new_page();page.on('pageerror',lambda e:report['errors'].append(e.stack or str(e)));page.goto(a.url,wait_until='networkidle');page.wait_for_function('!!window.mcDebug')
   def click(q):page.locator(q).first.click()
   def close():
    if page.locator('#panel').is_visible():click('#panel-close')
   def money():return page.evaluate('mcDebug.state.money')
   def fund(n):
    close()
    while money()<n:click('#mine')
   def shop():
    close();click('[data-nav="build"]')
   def shot(name):
    page.wait_for_timeout(400);assert not page.evaluate('document.documentElement.scrollWidth>innerWidth');page.screenshot(path=out/f'{width}-{name}.png')
   def site():
    page.wait_for_timeout(700)
    result=page.evaluate('''()=>{const w=mcDebug.world,m=w.placementSites[0],r=w.renderer.domElement.getBoundingClientRect(),p=w.center.clone().set(m.x,.19,m.z).project(w.camera);return{x:r.x+(p.x+1)*r.width/2,y:r.y+(1-p.y)*r.height/2,bounds:w.mode.kind==='expand'?{width:5,depth:5,center:{x:m.x,z:m.z}}:null}}''')
    page.mouse.click(result['x'],result['y']);page.wait_for_timeout(450)
    assert page.locator('#placement-confirm').is_enabled()
    return result
   if width<760:
    assert page.locator('#hud-more').inner_text()=='菜单';click('#hud-more')
    one=page.locator('#settings').bounding_box();two=page.locator('#quick-help').bounding_box();assert abs(one['y']-two['y'])<1
    click('#quick-help')
   else:
    assert page.locator('#settings').inner_text()=='设置';click('#settings');click('#basic-help')
   assert page.locator('#info-panel h2').inner_text()=='操作指南';click('#info-return')
   shop();assert page.locator('[data-buy="T1"]').count()==0;assert page.locator('[data-buy-guidance="goals"]').is_visible()
   assert '还差 6' in page.locator('[data-guidance-card="goals"] [data-purchase-reason]').inner_text();shot('first-item')
   fund(6);page.wait_for_selector('#first-shop-hint',state='visible');page.wait_for_timeout(7000)
   assert page.locator('#first-shop-hint').is_visible();assert 'first-shop-highlight' not in page.locator('[data-nav="build"]').get_attribute('class')
   click('#first-shop-hint');click('[data-buy-guidance="goals"]');before=money();click('#placement-cancel');assert money()==before
   close();page.reload(wait_until='networkidle');page.wait_for_selector('#first-shop-hint',state='visible')
   click('#first-shop-hint');click('[data-buy-guidance="goals"]');before=money();click('#placement-confirm')
   assert abs(money()-(before-6))<.001;assert page.evaluate('mcDebug.state.guidance.goals')
   assert page.locator('#first-shop-hint').is_hidden();assert page.locator('#mission-name').inner_text()=='木镐'
   close();click('#mission-link');page.wait_for_timeout(400)
   if width<760:
    visible=page.evaluate('''()=>{const view=document.querySelector('#panel-content').getBoundingClientRect();return ['[data-buy="T1"]','.item-effect','.purchase-reason'].every(q=>{const r=document.querySelector(q).getBoundingClientRect();return r.top>=view.top&&r.bottom<=view.bottom})}''')
    assert visible,'price, effect and shortage should fit without scrolling'
    shot('detail-priority')
   for id,cost in [('T1',10),('V1',25),('V18',20),('V2',50),('T7',35)]:
    fund(cost);shop();assert page.locator('.cards [data-card]').first.get_attribute('data-card')==id
    click(f'[data-buy="{id}"]')
    page.wait_for_timeout(450)
    if id in ['V1','V18','T7']:
     assert page.locator('#placement-confirm').inner_text()=='先选择位置'
     if width<760:
      assert not page.locator('#panel-content').is_visible()
      rect=page.locator('#placement-bar').bounding_box();assert rect['y']>=0 and rect['y']+rect['height']<=height+1,rect
     chosen=site()
     if id=='V1':
      assert chosen['bounds']=={'width':5,'depth':5,'center':{'x':0,'z':0}}
      shot('land-preview');click('#placement-cancel');assert not page.evaluate('mcDebug.state.counts.V1')
      assert page.locator('#panel-content').is_visible();click('[data-buy="V1"]');site()
     assert ('在这里扩地' if id=='V1' else '在这里建造') in page.locator('#placement-confirm').inner_text()
    click('#placement-confirm');page.wait_for_timeout(1100)
    assert page.evaluate(f'mcDebug.state.counts.{id}')==1
    if id=='V18':
     assert page.locator('#first-income').is_visible();shot('first-income');start=money();online=page.evaluate('mcDebug.state.play');page.wait_for_timeout(10000);gain=money()-start;assert abs(gain-10)<.5,{'gain':gain,'onlineSeconds':page.evaluate('mcDebug.state.play')-online}
    if id in ['V18','V2','T7']:
     expected={'V18':1,'V2':2,'T7':4}[id]
     assert abs(page.evaluate('mcDebug.state.rate')-expected)<.001
     click('#income-open');assert page.locator('[data-income-total]').inner_text()==f'{expected} /秒'
     if id=='T7':assert page.locator('[data-income-source="base"] dd').inner_text()=='3 /秒'
     shot(id+'-income');click('#modal-close')
   shop();click('[data-open="atlas"]');assert page.locator('.development-route').is_visible();shot('blueprint')
   page.reload(wait_until='networkidle');assert page.locator('#first-shop-hint').is_hidden()
   report['checks'].append({'width':width,'goalsFirst':True,'persistentHint':True,'realLandArea':True,'cancelRestoresShop':True,'firstIncome':True,'actualIncome':[1,2,4],'helpTwoClicks':True})
   ctx.close()
  assert not report['errors'],report['errors'];report['passed']=True
 except Exception:
  if not page.is_closed():page.screenshot(path=out/'failure.png')
  raise
 finally:
  (out/'results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));b.close()
print(json.dumps(report,ensure_ascii=False))
