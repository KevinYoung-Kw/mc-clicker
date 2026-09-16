"""Early progression and focus regression, isolated saves and UI purchases only."""
import argparse,json,subprocess
from pathlib import Path
from importlib.util import spec_from_file_location,module_from_spec
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];KEY='mc-clicker-world-v2'
spec=spec_from_file_location('base',ROOT/'scripts/verify-interiors-release.py');base=module_from_spec(spec);spec.loader.exec_module(base)

def main():
 p=argparse.ArgumentParser();p.add_argument('--url',required=True);p.add_argument('--label',required=True);p.add_argument('--development',action='store_true');p.add_argument('--webkit',action='store_true');p.add_argument('--width',type=int);a=p.parse_args()
 out=ROOT/'docs/qa'/('early-game-'+a.label);out.mkdir(parents=True,exist_ok=True)
 report={'url':a.url,'checks':[],'errors':[],'httpErrors':[]}
 with sync_playwright() as pw:
  browser=pw.webkit.launch() if a.webkit else pw.chromium.launch(args=['--use-angle=metal'])
  try:
   for width,height in [(390,844),(320,640),(1440,900)]:
    if a.width and width!=a.width:continue
    mobile=width<760
    ctx=browser.new_context(viewport={'width':width,'height':height},has_touch=True,is_mobile=mobile,device_scale_factor=1)
    page=ctx.new_page();page.on('pageerror',lambda e:report['errors'].append(str(e)));page.on('response',lambda r:report['httpErrors'].append(r.url) if r.status>=400 else None);page.set_default_timeout(15000)
    page.goto(a.url,wait_until='networkidle')
    assert page.evaluate('!!window.mcDebug')==a.development
    def click(sel):
     node=page.locator(sel).first
     node.tap() if mobile else node.click()
    def tool(sel):
     if not page.locator(sel).is_visible():click('#hud-more')
     click(sel)
    def shot(label):
     page.wait_for_timeout(350);base.no_overflow(page);page.screenshot(path=out/f'{width}-{label}.png')
    def choose():
     page.wait_for_timeout(650)
     assert page.locator('#placement-bar').is_visible(), 'placement closed before selection'
     return base.choose_grid(page)
    def mine_many(count):
     if page.locator('#panel').is_visible():click('#panel-close')
     for _ in range(count):click('#mine')
     page.wait_for_timeout(260)
    assert page.locator('.gesture-hint').is_visible()
    tool('#settings');click('#basic-help');assert page.locator('#info-panel').is_visible();assert page.locator('.info-events').count()==0
    click('#info-return');click('[data-nav="build"]')
    button=page.locator('[data-buy="T1"]');assert button.get_attribute('data-purchase-state')=='short'
    assert page.locator('[data-card="T1"] [data-purchase-reason]').inner_text()=='还差 10 绿宝石'
    click('[data-buy="T1"]');assert '还差 10' in page.locator('#toast').inner_text()
    # The result must remain onscreen even on a fully expanded short-phone sheet.
    box=page.locator('#toast').bounding_box();assert box['x']>=0 and box['x']+box['width']<=width+1
    shot('shortage')
    click('[data-detail="T1"]');click('[data-detail="V1"]')
    assert page.locator('[data-buy="V1"]').get_attribute('data-purchase-state')=='locked'
    assert '木镐' in page.locator('[data-card="V1"] [data-purchase-reason]').inner_text()
    click('[data-buy="V1"]');click('[data-prerequisite="T1"]')
    assert page.locator('#panel-title').inner_text()=='木镐'
    report['checks'].append(f'{width}: basic help and errors visible without info; locked prerequisites directly navigable')
    mine_many(10)
    assert page.locator('#first-shop-hint').is_visible()
    shot('first-affordability')
    click('#first-shop-hint');assert page.locator('#first-shop-hint').is_hidden()
    assert page.locator('[data-buy="T1"]').get_attribute('data-purchase-state')=='ready'
    click('[data-buy="T1"]');assert page.locator('#placement-confirm').is_visible()
    assert base.saved(page)['counts'].get('T1',0)==0
    click('#placement-confirm');assert base.saved(page)['counts']['T1']==1
    assert page.locator('#panel').is_visible();assert page.locator('.complete-badge').is_visible()
    assert '−10' in page.locator('#toast').inner_text()
    page.reload(wait_until='networkidle');assert page.locator('#first-shop-hint').is_hidden()
    assert base.saved(page)['shopHintSeen']
    report['checks'].append(f'{width}: one-time shop hint, confirmation, expense feedback and no repeat after reload')
    mine_many(18);click('[data-nav="build"]');click('[data-buy="V1"]')
    assert '请选择一片土地' in page.locator('#placement-label').inner_text()
    assert page.locator('#placement-confirm').is_disabled()
    before=base.saved(page);choose()
    assert '在这里建造' in page.locator('#placement-confirm').inner_text()
    shot('land-preview');click('#placement-cancel')
    assert {k:v for k,v in base.saved(page)['counts'].items() if v}=={k:v for k,v in before['counts'].items() if v}
    click('[data-buy="V1"]');choose();click('#placement-confirm')
    if a.development:
     assert page.evaluate('mcDebug.world.graph.children.some(g=>g.userData.land && g.userData.dynamic)'), 'land animation not registered before construction'
    page.wait_for_timeout(1100)
    assert base.saved(page)['counts']['V1']==1
    assert page.locator('#panel').is_visible();shot('land-built')
    for id in ['V18','T7','V2']:
     mine_many(30);click('[data-nav="build"]');click('[data-buy="'+id+'"]');page.wait_for_timeout(400)
     if id!='V2':choose()
     click('#placement-confirm');page.wait_for_timeout(800)
     assert base.saved(page)['counts'][id]==1
    s=base.saved(page)
    assert not s['guidance']['info'] and not s['guidance']['goals']
    assert page.locator('#rate').inner_text()!='0'
    shot('first-village')
    report['checks'].append(f'{width}: cancel is free; land, mailbox, workbench and first resident build without paid guidance; passive rate visible')
    # Select an actual existing workbench from the owned shop and inspect its camera.
    click('#panel-close');page.wait_for_timeout(400)
    if a.development:
     free=page.evaluate('mcDebug.world.captureCamera()')
    click('[data-nav="build"]');click('[data-open="owned"]');click('[data-detail="T7"]');page.wait_for_timeout(800)
    assert page.locator('#home-view').get_attribute('data-inspecting')=='true'
    if a.development:
     result=page.evaluate('()=>{const w=mcDebug.world,p=w.itemCamera("T7").point;return{camera:w.captureCamera(),p:{x:p.x,y:p.y,z:p.z},target:{x:w.target.x,y:w.target.y,z:w.target.z}}}')
     assert result['camera']['focusPoint']==result['p']
     assert abs(result['target']['x']-result['p']['x'])<.03
     assert result['camera']['yaw']==free['yaw']
    shot('facility-focus');click('#panel-close');page.wait_for_timeout(500)
    if a.development:
     assert page.evaluate('mcDebug.world.captureCamera()')==free
    report['checks'].append(f'{width}: selected facility focus; '+('exact camera restoration on close' if a.development else 'close-to-world navigation'))
    ctx.close()
   assert not report['errors'],report['errors'];assert not report['httpErrors'],report['httpErrors'];report['passed']=True
   (out/'failure.png').unlink(missing_ok=True)
  except Exception as e:
   report['passed']=False;report['failure']=str(e);page.screenshot(path=out/'failure.png');raise
  finally:
   (out/'observations.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');browser.close()
 print(json.dumps({'passed':True,'checks':len(report['checks'])}))
if __name__=='__main__':main()
