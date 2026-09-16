"""Compact purchase layout and independent touch camera gestures in isolated saves."""
import argparse, json, subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]; KEY='mc-clicker-world-v2'
p=argparse.ArgumentParser();p.add_argument('--url',required=True);p.add_argument('--label',required=True);p.add_argument('--development',action='store_true');args=p.parse_args()
out=ROOT/'docs/qa'/('mobile-polish-'+args.label);out.mkdir(parents=True,exist_ok=True)
seed=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {residentFixture}from'./scripts/resident-fixture.mjs';const s=residentFixture();s.reducedMotion=false;console.log(JSON.stringify(s));"],cwd=ROOT,text=True))
report={'url':args.url,'checks':[],'errors':[],'failedRequests':[],'gestures':{}}
def cam(page):return page.evaluate('mcDebug.world.captureCamera()')
def press(page,selector,touch):
 loc=page.locator(selector).first
 if selector in ['#info-open','#settings','#share-open'] and loc.is_hidden() and page.locator('#hud-more').is_visible():page.locator('#hud-more').tap()
 (loc.tap if touch else loc.click)()
def gesture(page,client,kind):
 r=page.locator('#world').bounding_box();x=r['x']+r['width']/2;y=r['y']+min(110,r['height']*.32)
 def send(t,points):client.send('Input.dispatchTouchEvent',{'type':t,'touchPoints':[{'x':a,'y':b,'id':i,'radiusX':3,'radiusY':3}for i,(a,b)in enumerate(points)]})
 send('touchStart',[(x-38,y),(x+38,y)])
 for i in range(1,13):
  if kind=='orbit':pts=[(x-38+i*5,y),(x+38+i*5,y)]
  elif kind=='zoom':pts=[(x-38-i*3,y),(x+38+i*3,y)]
  else:pts=[(x-38+i*.5,y-i*2),(x+38-i*.5,y+i*2)]
  send('touchMove',pts);page.wait_for_timeout(25)
 send('touchEnd',[]);page.wait_for_timeout(550)
def camera_checks(page,client,key):
 before=cam(page) if args.development else None
 gesture(page,client,'orbit');orbit=cam(page) if args.development else None
 if args.development:
  assert abs(orbit['yaw']-before['yaw'])>.4,(before,orbit)
  assert abs(orbit['zoom']-before['zoom'])<.00001,(before,orbit)
  assert orbit['pan']==before['pan']
 gesture(page,client,'zoom');zoom=cam(page) if args.development else None
 if args.development:
  assert zoom['zoom']<orbit['zoom']*.7,(orbit,zoom)
  assert abs(zoom['yaw']-orbit['yaw'])<.00001 and zoom['pan']==orbit['pan']
  report['gestures'][key]={'before':before,'orbit':orbit,'zoom':zoom}
 report['checks'].append(key+': parallel two-finger rotation and pinch do not interfere')
def cards(page,selector,title,buy):
 measurements=[]
 for item in page.locator(selector).all():
  b=item.locator(buy).first;t=item.locator(title).first
  if b.count()==0 or not b.is_visible():continue
  a=t.bounding_box();v=b.bounding_box();box=item.bounding_box()
  assert v['height']>=44 and a['x']+a['width']<=v['x']+1,(a,v)
  assert abs(a['y']+a['height']/2-v['y']-v['height']/2)<20,(a,v)
  assert v['x']+v['width']<=page.viewport_size['width'],v
  assert box['height']<190,box
  measurements.append({'height':round(box['height'],1),'titleY':round(a['y'],1),'priceY':round(v['y'],1)})
 assert measurements,selector
 return measurements
with sync_playwright() as pw:
 browser=pw.chromium.launch(args=['--use-angle=metal'])
 try:
  for width,height,touch in [(320,768,True),(390,844,True),(1440,1000,False)]:
   ctx=browser.new_context(viewport={'width':width,'height':height},is_mobile=touch,has_touch=touch,device_scale_factor=1)
   ctx.add_init_script('localStorage.setItem('+json.dumps(KEY)+','+json.dumps(json.dumps(seed))+');')
   page=ctx.new_page();page.on('pageerror',lambda e:report['errors'].append(str(e)));page.on('response',lambda r:report['failedRequests'].append({'url':r.url,'status':r.status}) if r.status>=400 else None)
   page.goto(args.url,wait_until='networkidle');page.wait_for_timeout(500)
   assert page.evaluate('!!window.mcDebug')==args.development
   if touch:
    assert page.locator('.hud').bounding_box()['height']==60
    assert page.locator('#power-top').evaluate('(e)=>getComputedStyle(e).borderTopWidth')=='0px'
    assert page.locator('#power-top').evaluate('(e)=>getComputedStyle(e).backgroundColor')=='rgba(0, 0, 0, 0)'
    client=ctx.new_cdp_session(page);camera_checks(page,client,str(width)+' world')
    text=page.locator('.gesture-hint').inner_text();assert '双指左右滑动旋转' in text and not any(x in text for x in ['右键','滚轮','Shift'])
   else:
    canvas=page.locator('#world canvas');r=canvas.bounding_box();page.mouse.move(r['x']+r['width']/2,r['y']+100)
    before=cam(page) if args.development else None
    page.mouse.down(button='right');page.mouse.move(r['x']+r['width']/2+70,r['y']+100,steps=8);page.mouse.up(button='right')
    if args.development:assert abs(cam(page)['yaw']-before['yaw'])>.5
    text=page.locator('.gesture-hint').inner_text();assert '右键 / Shift' in text and '滚轮' in text and '双指' not in text
   report['checks'].append(f'{width}: correct device-specific controls and compact borderless energy display')
   page.screenshot(path=out/f'{width}-world.png')
   if touch:press(page,'#hud-more',True)
   logo=page.locator('.site-link');assert logo.is_visible() and logo.get_attribute('href')=='https://www.kw-aigc.cn/' and logo.get_attribute('target')=='_blank'
   assert logo.locator('svg').count()==1 and page.locator('.site-link').count()==1
   if touch:assert logo.evaluate('(e)=>e.parentElement.id')=='hud-tools'
   else:
    assert logo.evaluate('(e)=>e.parentElement.firstElementChild===e && e.parentElement.classList.contains("hud")')
    a=logo.bounding_box();b=page.locator('.wallet').bounding_box();assert a['x']+a['width']<=b['x']
   page.screenshot(path=out/f'{width}-brand.png')
   if touch:press(page,'#hud-more',True)
   press(page,'#info-open',touch);text=page.locator('[data-control-guide]').inner_text()
   assert ('双指左右滑动旋转' in text) if touch else ('Shift' in text)
   press(page,'#info-return',touch)
   press(page,'[data-nav="build"]',touch);page.wait_for_timeout(450)
   if touch:report.setdefault('layouts',{})[str(width)+' shop']=cards(page,'.build-card','h3','[data-buy]')
   page.screenshot(path=out/f'{width}-shop.png')
   press(page,'[data-family="features"]',touch)
   if touch:cards(page,'.guidance-card','h3','button')
   page.screenshot(path=out/f'{width}-features.png')
   press(page,'[data-nav="village"]',touch);press(page,'[data-village-tab="construction"]',touch)
   if touch:report['layouts'][str(width)+' village']=cards(page,'.management-equipment article','strong','[data-equipment-buy]')
   page.screenshot(path=out/f'{width}-village.png')
   report['checks'].append(f'{width}: title/price alignment, compact features and village purchases remain readable')
   press(page,'[data-nav="build"]',touch);press(page,'[data-open="owned"]',touch);press(page,'[data-family="all"]',touch);press(page,'[data-detail="L2"]',touch);page.wait_for_timeout(650)
   if touch:
    if page.locator('#room-close-panel').is_visible():press(page,'#room-close-panel',touch)
    camera_checks(page,client,str(width)+' studio')
   press(page,'[data-room-tab="equipment"]',touch);page.wait_for_timeout(400)
   if touch:report['layouts'][str(width)+' studio']=cards(page,'.build-card','h3','[data-buy]')
   page.screenshot(path=out/f'{width}-studio.png')
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   report['checks'].append(f'{width}: studio equipment reuses compact shopping controls; no document overflow')
   if not touch:
    with page.expect_popup() as opened:page.locator('.site-link').click()
    target=opened.value;target.wait_for_load_state('domcontentloaded')
    assert target.url.startswith('https://www.kw-aigc.cn/')
    target.locator('.nav-logo').wait_for(state='visible')
    report['mainSite']={'url':target.url,'title':target.title(),'logoVisible':True}
    target.screenshot(path=out/'main-site.png')
    target.close()
    report['checks'].append('kwaigc link opens the real personal homepage in a separate tab')
   ctx.close()
  assert not report['errors'],report['errors'];assert not report['failedRequests'],report['failedRequests'];report['passed']=True
 except Exception as e:
  report['passed']=False;report['failure']=str(e);page.screenshot(path=out/'failure.png');raise
 finally:
  (out/'observations.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');browser.close()
print(json.dumps({'passed':True,'checks':len(report['checks'])}))
