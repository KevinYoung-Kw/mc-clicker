"""Capture real controls in an isolated teaching save. No player save is changed."""
import argparse,json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
a=argparse.ArgumentParser();a.add_argument('--url',default='http://127.0.0.1:8917/');args=a.parse_args()
out=ROOT/'docs/v1.7/qa/tutorials/source';out.mkdir(parents=True,exist_ok=True)
s=json.loads((ROOT/'docs/v1.6/qa/stability-baseline/fixtures/peak.json').read_text())
keep='T1 T2 T3 T4 T7 V1 V2 V3 V4 V6 V7 V18 V19 V20 M1 M2 M4 M5 M6 M7 M9 M10 M16 L1 L2 L3 L4 X1'.split()
s['counts']={k:1 for k in keep};s['counts'].update(V1=9,V2=4,M9=2)
s['chunks']={'overworld':s['chunks']['overworld'][:9],'nether':[],'end':[]}
s['placements']={k:v for k,v in s['placements'].items() if k in keep}
s['housing']['homes']=s['housing']['homes'][:2]
s['housing']['assignments']={}
s.update(money=18000,play=900,realm='overworld',reducedMotion=True,skipPurchaseConfirmation=True,completed=False,victory=False,rate=0,energy=120)
s['community']['residents']=s['community']['residents'][:4]
for r in s['community']['residents']:r.update(job='idle',previousJob='idle',status='闲逛',activity='idle',reserve=False,cargo=None,progress=0,handover=0,path=[],destination=None,workplaceId=None,workSpot=None)
s['upgrades']['levels']={};s['grid'].update(autoConnect=False,learnedConnection=True,links={k:k in ['M6','M7'] for k in keep},disabled=[],last={})
s['guidance'].update(notices=False,counter=True);s['narrative'].update(intro='released',companionsShown=True,legacy=True)
s['webAppearance']['equipped']={};s['environment'].update(weather='clear');s['events']=[]
manifest={}
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--use-angle=metal'])
 context=browser.new_context(viewport={'width':1100,'height':900},device_scale_factor=4)
 # Asset generation must not reload this isolated capture via Vite HMR.
 context.route_web_socket('**', lambda ws: None)
 context.add_init_script('localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(s))+')')
 page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def press(q):page.locator(q).first.click();page.wait_for_timeout(160)
 def item(i):press('[data-nav="atlas"]');press(f'[data-detail="{i}"]')
 def capture(name,q,target=None,maxh=360):
  el=page.locator(q).first;el.scroll_into_view_if_needed();page.wait_for_timeout(100)
  b=el.bounding_box();b={k:round(v,2) for k,v in b.items()}
  b['height']=min(b['height'],maxh,900-b['y']);b['width']=min(b['width'],1100-b['x'])
  page.screenshot(path=str(out/f'{name}.png'),clip=b)
  t=page.locator(target).first.bounding_box() if target else None
  manifest[name]={'file':f'{name}.png','width':b['width'],'height':b['height'],'target':({'x':t['x']-b['x'],'y':t['y']-b['y'],'width':t['width'],'height':t['height']} if t else None)}
  print(name,manifest[name],flush=True)
 def choose():
  page.wait_for_timeout(350)
  pt=page.evaluate('''async()=>{const w=mcDebug.world,{Vector3}=await import('/node_modules/three/build/three.module.js'),{canPlace}=await import('/src/layout.js');const c=w.renderer.domElement,b=c.getBoundingClientRect();for(const s of w.placementSites){const v=new Vector3(s.x,.19,s.z).project(w.camera),p={x:b.x+(v.x+1)*b.width/2,y:b.y+(1-v.y)*b.height/2};if(p.y<b.top+100||p.y>b.bottom-70||document.elementFromPoint(p.x,p.y)!==c)continue;const site=w.outdoorSiteAt({clientX:p.x,clientY:p.y});if(site&&canPlace(mcDebug.state,w.mode.id,site,w.mode.id))return p;} }''')
  assert pt,'no site';page.mouse.click(pt['x'],pt['y']);page.wait_for_timeout(500)
  return pt
 page.goto(args.url,wait_until='networkidle');page.wait_for_function('!!window.mcDebug?.world')
 capture('harvest','#mine')
 # World capture retains actual rendering, without an invented map.
 capture('world','#world',maxh=800)
 capture('income','#income-open')
 # Pause through the same blur event used by the browser.
 page.evaluate('window.dispatchEvent(new Event("blur"))');page.wait_for_timeout(150)
 capture('paused','#notification-shell')
 page.evaluate('window.dispatchEvent(new Event("focus"))')
 item('V5');capture('buy','[data-card="V5"]','[data-buy="V5"]',maxh=340)
 capture('buy-button','[data-buy="V5"]')
 press('[data-buy="V5"]');choose();capture('placement','#world',maxh=800);capture('confirm','#placement-bar','#placement-confirm',maxh=220)
 manifest['placement']['focus']=page.evaluate('''async()=>{const w=mcDebug.world,b=w.renderer.domElement.getBoundingClientRect(),{Vector3}=await import('/node_modules/three/build/three.module.js'),s=w.mode.site,v=new Vector3(s.x,.4,s.z).project(w.camera);return {x:(v.x+1)*b.width/2,y:(1-v.y)*b.height/2}}''')
 press('#placement-cancel')
 item('M9');capture('facility-tools','.item-toolbar','[data-move="M9"]',maxh=140)
 press('[data-move="M9"]');press('#placement-rotate');capture('rotation','#placement-bar','#placement-rotate',maxh=220);press('#placement-cancel')
 press('[data-mod-select="drill-steel"]');capture('upgrade','[data-mod-card="drill-steel"]','[data-mod-buy="drill-steel"]',maxh=330)
 press('[data-nav="village"]');press('[data-village-tab="residents"]');press('[data-roster-view="jobs"]')
 capture('workplace','[data-workplace-card="farmer"]','[data-workplace="farmer"]',maxh=260)
 press('[data-workplace="farmer"]');capture('person','[data-workplace-picker] [data-job-assign]','[data-job-assign]',maxh=140)
 press('[data-job-assign]');capture('assigned','[data-workplace-card="farmer"]',maxh=300)
 capture('hauler','[data-workplace-card="hauler"]','[data-workplace="hauler"]',maxh=250)
 press('[data-nav="network"]');press('[data-industry-tab="power"]')
 capture('connect','[data-equipment-card="M9"]','[data-connection-actions="M9"] [data-connection-primary]',maxh=200)
 page.evaluate('for (const r of Object.values(mcDebug.state.buffers)) {r.raw=0;r.goods=0;}')
 press('[data-connection-actions="M9"] [data-connection-primary]');page.wait_for_timeout(1600);capture('power-state','[data-equipment-card="M9"]',maxh=240)
 capture('power-meters','.electricity-dashboard',maxh=400)
 item('L2');page.wait_for_timeout(2600);capture('studio','#world',maxh=800);capture('studio-menu','#room-tools','[data-room-tab="equipment"]',maxh=120)
 assert not errors,errors
 (out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
 browser.close()
