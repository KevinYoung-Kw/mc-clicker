"""V1.7 appearance audit: real purchases, all themes/plaques, cursor operations.
Run against Vite (isolated browser saves): uv run --with playwright scripts/verify-appearance-polish.py
"""
import argparse, base64, json, subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
a=argparse.ArgumentParser();a.add_argument('--url',default='http://127.0.0.1:8890/');a.add_argument('--out',default=str(ROOT/'docs/v1.7/qa/appearance-polish'));a.add_argument('--device',choices=['desktop','mobile','small'],default='desktop');args=a.parse_args()
OUT=Path(args.out)/args.device;OUT.mkdir(parents=True,exist_ok=True)
ITEMS=json.loads(subprocess.check_output(['node','--input-type=module','-e','import {WEB_ITEMS} from "./src/web-catalog.js";console.log(JSON.stringify(WEB_ITEMS))'],cwd=ROOT,text=True))
fixture=json.loads((ROOT/'docs/v1.6/qa/stability-baseline/fixtures/peak.json').read_text());fixture['counts']['X2']=3;fixture['guidance']['notices']=False;fixture['skipPurchaseConfirmation']=True;fixture['money']=1e9
fixture['webAppearance']={'version':2,'catalogTier':0,'owned':{},'equipped':{},'legacyAliases':{}}
report={'device':args.device,'purchases':[],'titles':[],'notices':[],'panels':[],'cursors':[],'errors':[]}
with sync_playwright() as p:
 mobile=args.device!='desktop';size={'desktop':(1440,960),'mobile':(390,844),'small':(320,568)}[args.device]
 browser=(p.webkit if args.device=='mobile' else p.chromium).launch(headless=True,**({"args":["--use-angle=metal"]} if args.device!="mobile" else {}))
 ctx=browser.new_context(viewport=dict(zip(['width','height'],size)),is_mobile=mobile,has_touch=mobile,accept_downloads=True)
 if args.device=='desktop':ctx.grant_permissions(['clipboard-read','clipboard-write'])
 page=ctx.new_page();page.on('pageerror',lambda e:report['errors'].append(str(e)));page.goto(args.url,wait_until='networkidle');page.wait_for_function('!!window.mcDebug?.world');page.evaluate('s=>mcDebug.setState(s)',fixture)
 def close():
  if page.locator('#modal').evaluate('e=>e.open'):page.locator('#modal-close').click()
 def tool(selector):
  close()
  if not page.locator(selector).is_visible():page.locator('#hud-more').click()
  page.locator(selector).click()
 def shot(name,selector=None):
  page.wait_for_timeout(80)
  ext='.png' if selector else '.jpg'
  (page.locator(selector) if selector else page).screenshot(path=str(OUT/(name+ext)),animations='disabled',**({'type':'jpeg','quality':84} if not selector else {}))
  if not selector and (OUT/(name+'.png')).exists():(OUT/(name+'.png')).unlink()
 def shop(item):
  if not page.locator('#modal').evaluate('e=>e.open'):tool('#collection-open')
  page.locator('[data-collection-tab="'+item['category']+'"]').click();page.locator('[data-web-select="'+item['id']+'"]').click()
 def apply(equipped):
  page.evaluate('async e=>{const {applyWebAppearance}=await import("/src/appearance-view.js");Object.assign(mcDebug.state.webAppearance.equipped,e);applyWebAppearance(mcDebug.state)}',equipped)
 for i in ITEMS:
  shop(i);page.locator('[data-extra-buy="'+i['id']+'"]').click();page.wait_for_function('id=>!!mcDebug.state.webAppearance.owned[id]',arg=i['id'])
  assert page.locator('#collection-shop').evaluate('e=>e.scrollWidth<=e.clientWidth+1'),i['id']
  if i['slot']=='cursor':assert page.locator('.cursor-specimens').count()==1
  shot(i['id']+'-shop')
  page.locator('[data-web-equip]').click();assert page.evaluate('s=>!mcDebug.state.webAppearance.equipped[s]',i['slot'])
  page.locator('[data-web-equip]').click();assert page.evaluate('i=>mcDebug.state.webAppearance.equipped[i.slot]===i.id',i)
  report['purchases'].append(i['id']);close()
  if i['slot'] in ['title','theme','notice']:shot(i['id']+'-world')
  print(args.device,i['id'],flush=True)
 page.evaluate('mcDebug.save()');page.reload(wait_until='networkidle');page.wait_for_function('!!window.mcDebug?.world')
 assert page.evaluate('Object.keys(mcDebug.state.webAppearance.owned).length')==46
 report['reload']=page.evaluate('mcDebug.state.webAppearance.equipped')
 # Every title in every theme: measure text against the actual plaque, including mobile.
 for theme in ['']+[i['id'] for i in ITEMS if i['slot']=='theme']:
  for title in [i['id'] for i in ITEMS if i['slot']=='title']:
   apply({'theme':theme,'title':title})
   metric=page.locator('#world-label .eyebrow').evaluate('''e=>{const r=document.createRange();r.selectNodeContents(e);const t=r.getBoundingClientRect(),b=e.getBoundingClientRect();return {text:e.textContent,w:b.width,h:b.height,inside:t.left>=b.left+8&&t.right<=b.right-8&&t.top>=b.top&&t.bottom<=b.bottom,color:getComputedStyle(e).color}}''')
   assert metric['inside'],(theme,title,metric)
   report['titles'].append({'theme':theme,'title':title,**metric});shot((theme or 'default')+'-'+title,'#world-label')
 # All six themes on actual shop, facility, mailbox, settings, world info and share entry.
 for theme in [i['id'] for i in ITEMS if i['slot']=='theme']:
  close();apply({'theme':theme});page.locator('[data-nav=build]').click();shot(theme+'-commerce');page.locator('#panel-close').click()
  page.locator('[data-nav=village]').click();page.locator('[data-village-tab=construction]').click();page.locator('[data-manage-item=V18]').click();shot(theme+'-mail');page.locator('#panel-close').click()
  page.locator('[data-nav=network]').click();shot(theme+'-industry');page.locator('#panel-close').click()
  for name,selector in [('settings','#settings'),('info','#info-open'),('share','#share-open')]:
   tool(selector);page.wait_for_timeout(100)
   if name=='share':page.wait_for_selector('#share-panel')
   assert page.locator('#modal').evaluate('e=>e.scrollWidth<=e.clientWidth+1'),(theme,name)
   if name=='info':assert page.locator('[data-narrator-avatar] [data-mouth=x]').count()>0
   shot(theme+'-'+name);close();report['panels'].append([theme,name])
 # Actual notice purchase receipts over each theme (not synthetic empty boxes).
 for theme in [i['id'] for i in ITEMS if i['slot']=='theme']:
  for i in [i for i in ITEMS if i['slot']=='notice']:
   page.evaluate('id=>{delete mcDebug.state.webAppearance.owned[id];delete mcDebug.state.webAppearance.equipped.notice}',i['id']);apply({'theme':theme})
   shop(i);page.locator('[data-extra-buy]').click();close();page.wait_for_selector('#notification-shell .notice-receipt b')
   contrast=page.locator('#notification-shell').evaluate('''e=>{const rgb=c=>(c.match(/[\\d.]+/g)||[]).slice(0,3).map(Number),lum=c=>rgb(c).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4}).reduce((a,x,i)=>a+x*[.2126,.7152,.0722][i],0),bg=lum(getComputedStyle(e).backgroundColor),els=[...e.querySelectorAll('.notice-title,.notice-receipt b')];return els.map(t=>{const fg=lum(getComputedStyle(t).color);return (Math.max(bg,fg)+.05)/(Math.min(bg,fg)+.05)})}''')
   assert all(c>=4.5 for c in contrast),(theme,i['id'],contrast)
   shot(theme+'-'+i['id'],'#notification-shell');report['notices'].append({'theme':theme,'notice':i['id'],'contrast':contrast})
 # Cursor UI operations: exact native hotspot, compact close button, text editing, camera drag.
 if not mobile:
  for i in [i for i in ITEMS if i['slot']=='cursor']:
   apply({'cursor':i['id']});tool('#settings')
   computed=page.locator('#modal-close').evaluate('e=>getComputedStyle(e).cursor');assert '9 0' in computed
   page.locator('#modal-close').click();page.locator('[data-nav=village]').click();page.locator('[data-village-tab=residents]').click();page.locator('[data-person]').first.click()
   entry=page.locator('[data-rename-input]');entry.fill('指针验收');assert entry.evaluate('e=>getComputedStyle(e).cursor')=='text';page.locator('[data-rename]').click();assert page.locator('.resident-name h3').inner_text()=='指针验收'
   page.locator('#panel-close').click();before=page.evaluate('mcDebug.world.pan.toArray()');page.mouse.move(740,160);page.mouse.down();page.mouse.move(840,200,steps=12);page.mouse.up();assert before!=page.evaluate('mcDebug.world.pan.toArray()')
   report['cursors'].append(i['id'])
  # Export actual rendered cards and execute both sharing effects without sending anything.
  for i in [i for i in ITEMS if i['slot']=='shareCard']:
   tool('#share-open');page.get_by_role('combobox',name='纪念卡样式').wait_for();
   if page.locator('#share-card-style').input_value()==i['id']:page.locator('#generate-card').click()
   else:
    page.get_by_role('combobox',name='纪念卡样式').click();page.get_by_role('option',name=i['name'],exact=True).click()
   page.wait_for_selector('#share-card-preview canvas',timeout=30000)
   data=page.locator('#share-card-preview canvas').evaluate('e=>e.toDataURL("image/png").split(",")[1]');(OUT/(i['id']+'-export.png')).write_bytes(base64.b64decode(data));close()
  for i in [i for i in ITEMS if i['slot']=='shareFx']:
   apply({'shareFx':i['id']});tool('#share-open');page.wait_for_selector('#copy-link');page.locator('#copy-link').click();page.wait_for_selector('.web-share-effect');shot(i['id']+'-action');close()
 tool('#collection-open');page.locator('[data-web-reset]').click();assert page.evaluate('Object.keys(mcDebug.state.webAppearance.equipped).length')==0
 assert page.evaluate('document.body.style.getPropertyValue("--web-grab")')==''
 report['reset']=True;assert not report['errors'],report['errors'];(OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));browser.close()
