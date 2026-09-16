"""Phone information gating, header, camera stack and long-press touch regression."""
import argparse,json,subprocess,math
from pathlib import Path
from importlib.util import spec_from_file_location,module_from_spec
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];KEY='mc-clicker-world-v2'
spec=spec_from_file_location('base',ROOT/'scripts/verify-interiors-release.py');base=module_from_spec(spec);spec.loader.exec_module(base)
SEED='''import {residentFixture} from './scripts/resident-fixture.mjs';const s=residentFixture();s.guidance.info=false;s.reducedMotion=false;s.skipPurchaseConfirmation=true;console.log(JSON.stringify(s));'''
def camera(page):return page.evaluate('mcDebug.world.captureCamera()')
def close(a,b):
 for k in ['zoom','yaw']:assert abs(a[k]-b[k])<.00001,(k,a,b)
 for k in ['x','y','z']:assert abs(a['pan'][k]-b['pan'][k])<.00001,(k,a,b)
 assert a['focusId']==b['focusId'] and a['focusPoint']==b['focusPoint'],(a,b)
def tap(page,sel):
 if sel in ['#settings','#info-open','#share-open','#collection-open'] and not page.locator(sel).is_visible():page.locator('#hud-more').tap()
 page.locator(sel).first.tap()
def pinch(page,client):
 r=page.locator('#world').bounding_box();x=r['width']/2;y=r['y']+min(140,r['height']*.3)
 def send(kind,points):client.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[{'x':a,'y':b,'id':i,'radiusX':3,'radiusY':3} for i,(a,b) in enumerate(points)]})
 send('touchStart',[(x-45,y),(x+45,y)])
 for i in range(1,9):
  send('touchMove',[(x-45-i*6,y-i*2),(x+45+i*6,y+i*2)]);page.wait_for_timeout(30)
 send('touchEnd',[])
 send('touchStart',[(x-40,y),(x+40,y)])
 for i in range(1,7):send('touchMove',[(x-40+i*6,y),(x+40+i*6,y)]);page.wait_for_timeout(30)
 send('touchEnd',[])
 send('touchStart',[(x,y)])
 for i in range(1,7):send('touchMove',[(x+i*4,y+i*2)]);page.wait_for_timeout(25)
 send('touchEnd',[]);page.wait_for_timeout(650)
def main():
 p=argparse.ArgumentParser();p.add_argument('--url',required=True);p.add_argument('--label',required=True);p.add_argument('--development',action='store_true');args=p.parse_args()
 out=ROOT/'docs/qa'/('mobile-flow-'+args.label);out.mkdir(parents=True,exist_ok=True)
 seed=json.loads(subprocess.check_output(['node','--input-type=module','-e',SEED],cwd=ROOT,text=True));report={'url':args.url,'checks':[],'errors':[],'cameras':{}}
 with sync_playwright() as pw:
  browser=pw.chromium.launch(args=['--use-angle=metal'])
  try:
   for width,height in [(390,844),(320,768)]:
    ctx=browser.new_context(viewport={'width':width,'height':height},has_touch=True,is_mobile=True,device_scale_factor=1)
    ctx.add_init_script('if(!localStorage.getItem('+json.dumps(KEY)+'))localStorage.setItem('+json.dumps(KEY)+','+json.dumps(json.dumps(seed))+');')
    page=ctx.new_page();page.on('pageerror',lambda e:report['errors'].append(str(e)));page.set_default_timeout(15000)
    page.goto(args.url,wait_until='networkidle');page.wait_for_timeout(600)
    assert page.evaluate('!!window.mcDebug')==args.development
    assert page.locator('.hud').bounding_box()['height']==60
    assert page.locator('#power-top').is_visible() and page.locator('#hud-tools').is_hidden()
    tap(page,'#hud-more');assert page.locator('#info-open').is_hidden();tap(page,'#hud-more')
    page.evaluate('window.dispatchEvent(new Event("blur"))');page.wait_for_timeout(150)
    assert page.locator('#foreground-status').is_visible()
    page.evaluate('window.dispatchEvent(new Event("focus"))')
    tap(page,'[data-nav="build"]');tap(page,'[data-family="features"]');tap(page,'[data-buy-guidance="info"]')
    if page.locator('#placement-confirm').is_visible():tap(page,'#placement-confirm')
    assert base.saved(page)['guidance']['info'];assert page.locator('#toast').is_visible()
    page.evaluate('window.dispatchEvent(new Event("blur"))');assert page.locator('#foreground-status').is_visible()
    page.evaluate('window.dispatchEvent(new Event("focus"))');tap(page,'#panel-close')
    report['checks'].append(f'{width}: compact 60px header, power visible, unpaid event entry hidden, basic pause feedback visible, purchased events enabled')
    tap(page,'#info-open');page.locator('#guidance-notices').uncheck();tap(page,'#info-return')
    page.evaluate('window.dispatchEvent(new Event("blur"))');assert page.locator('#foreground-status').is_visible()
    page.evaluate('window.dispatchEvent(new Event("focus"))')
    tap(page,'#info-open');page.locator('#guidance-notices').check();tap(page,'#info-return')
    report['checks'].append(f'{width}: event preference leaves basic pause feedback available')
    client=ctx.new_cdp_session(page);pinch(page,client)
    if args.development:
     free=camera(page);assert free['zoom']<.9;assert abs(free['yaw'])>.01
    page.screenshot(path=out/f'{width}-free.png')
    tap(page,'[data-nav="build"]');page.wait_for_timeout(650)
    if args.development:
     overview=camera(page);assert overview['zoom']==1 and overview['pan']['x']==0 and overview['pan']['z']==0
    page.screenshot(path=out/f'{width}-shop.png')
    tap(page,'[data-family="M"]')
    tap(page,'[data-buy="M9"]');page.wait_for_timeout(400);base.choose_grid(page);page.wait_for_timeout(750)
    assert page.locator('#home-view').inner_text()=='⌖'
    if args.development:
     preview=camera(page);assert preview['focusPoint'] is not None
     point=page.evaluate('()=>{const w=mcDebug.world;const p=w.mode.site;return {x:p.x,z:p.z}}')
     assert abs(preview['focusPoint']['x']-point['x'])<1e-6 and abs(preview['focusPoint']['z']-point['z'])<1e-6
    page.screenshot(path=out/f'{width}-preview.png')
    before=base.saved(page);tap(page,'#placement-cancel');page.wait_for_timeout(500)
    assert base.saved(page)['counts']==before['counts']
    if args.development:close(camera(page),overview)
    tap(page,'[data-buy="M9"]');page.wait_for_timeout(300);base.choose_grid(page);tap(page,'#placement-confirm');page.wait_for_timeout(800)
    assert base.saved(page)['counts']['M9']==1 and page.locator('#panel').is_visible()
    assert page.locator('#home-view').inner_text()=='⌖'
    if args.development:
     built=camera(page);site=base.saved(page)['placements']['M9'];assert abs(built['focusPoint']['x']-site['x'])<1e-6 and abs(built['focusPoint']['z']-site['z'])<1e-6
    page.screenshot(path=out/f'{width}-built.png')
    tap(page,'#home-view');page.wait_for_timeout(500)
    if args.development:close(camera(page),overview)
    tap(page,'#panel-close');page.wait_for_timeout(700)
    if args.development:
     close(camera(page),free);report['cameras'][str(width)]={'free':free,'overview':overview,'preview':preview,'restored':camera(page)}
    page.screenshot(path=out/f'{width}-restored.png')
    # Repeated opens and closes must not slowly overwrite the original zoom.
    for _ in range(3):tap(page,'[data-nav="build"]');tap(page,'#panel-close')
    if args.development:close(camera(page),free)
    report['checks'].append(f'{width}: pinch/rotate/pan -> shop overview -> selected-site focus -> cancel/purchase -> overview -> original free camera')
    button=page.locator('#mine');r=button.bounding_box();x=r['x']+r['width']/2;y=r['y']+r['height']/2
    assert button.evaluate('(e)=>getComputedStyle(e).userSelect')=='none'
    if page.evaluate("CSS.supports('-webkit-touch-callout','none')"):
     assert button.locator('span').evaluate('(e)=>getComputedStyle(e).webkitTouchCallout')=='none'
    for event in ['contextmenu','selectstart','copy']:
     assert button.evaluate('(e,t)=>!e.dispatchEvent(new Event(t,{bubbles:true,cancelable:true}))',event)
    before=page.evaluate('mcDebug.state.clicks') if args.development else None
    client.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y,'id':0}]});page.wait_for_timeout(1750)
    assert page.evaluate('String(window.getSelection())')==''
    assert button.evaluate('(e)=>e.classList.contains("holding")')
    if args.development:assert page.evaluate('mcDebug.state.clicks')>=before+5
    client.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});page.wait_for_timeout(250)
    assert not button.evaluate('(e)=>e.classList.contains("holding")')
    if args.development:
     clicks=page.evaluate('mcDebug.state.clicks');page.wait_for_timeout(500);assert page.evaluate('mcDebug.state.clicks')==clicks
    report['checks'].append(f'{width}: genuine touch hold mines continuously with no selection/callout/copy and stops on release')
    # The room uses its own camera bookmark and the same placement flow.
    tap(page,'[data-nav="build"]');tap(page,'[data-open="owned"]');tap(page,'[data-family="all"]');tap(page,'[data-detail="L2"]');page.wait_for_timeout(700)
    if page.locator('#room-close-panel').is_visible():tap(page,'#room-close-panel')
    pinch(page,client)
    if args.development:room_free=camera(page)
    tap(page,'[data-room-tab="equipment"]');page.wait_for_timeout(500)
    if args.development:room_overview=camera(page)
    tap(page,'[data-buy="L3"]');page.wait_for_timeout(350);base.choose_grid(page);page.wait_for_timeout(700)
    assert page.locator('#home-view').is_visible()
    if args.development:assert camera(page)['focusPoint'] is not None
    page.screenshot(path=out/f'{width}-indoor-preview.png')
    tap(page,'#placement-cancel');page.wait_for_timeout(500)
    if args.development:close(camera(page),room_overview)
    tap(page,'[data-buy="L3"]');page.wait_for_timeout(300);base.choose_grid(page);tap(page,'#placement-confirm');page.wait_for_timeout(700)
    assert base.saved(page)['counts']['L3']==1
    assert page.locator('#home-view').is_visible()
    tap(page,'#home-view');page.wait_for_timeout(450)
    if args.development:close(camera(page),room_overview)
    tap(page,'#room-close-panel');page.wait_for_timeout(600)
    if args.development:close(camera(page),room_free)
    page.screenshot(path=out/f'{width}-indoor-restored.png')
    report['checks'].append(f'{width}: indoor touch zoom, equipment preview/cancel/build/overview and room camera restoration')
    ctx.close()
   assert not report['errors'],report['errors'];report['passed']=True
  except Exception as e:
   report['passed']=False;report['failure']=str(e);page.screenshot(path=out/'failure.png');raise
  finally:
   (out/'observations.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');browser.close()
 print(json.dumps({'passed':True,'checks':len(report['checks']),'report':str(out/'observations.json')},ensure_ascii=False))
if __name__=='__main__':main()
