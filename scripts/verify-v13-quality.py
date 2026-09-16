# Historical V1.3.0 checks: run at tag mc-clicker-v1.3.0. For current direct-use flows run verify-v131.py.
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/qa/v13';seed=json.loads((OUT/'fixture.json').read_text())
report=[]
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--use-angle=metal'])
 for width in [1440,390]:
  ctx=b.new_context(viewport={'width':width,'height':1000 if width>760 else 844},has_touch=width<760,is_mobile=width<760,accept_downloads=True)
  page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:8890/',wait_until='networkidle');page.wait_for_function('!!window.mcDebug?.world');page.evaluate('s=>mcDebug.setState(s)',seed)
  page.evaluate("async()=>{const{WEB_ITEMS}=await import('/src/web-catalog.js');const{buyWeb}=await import('/src/presentation.js');for(const i of WEB_ITEMS.filter(i=>i.slot==='theme'||i.slot==='cursor'))buyWeb(mcDebug.state,i.id)}")
  contrasts=[]
  for theme in ['backpack','oak','redstone','end']:
   page.evaluate("async id=>{const{equipWeb}=await import('/src/presentation.js');equipWeb(mcDebug.state,id);mcDebug.setState(mcDebug.state)}",'web-theme-'+theme)
   for panel in ['build','village','network']:
    page.evaluate('x=>mcDebug.go(x)',panel);page.wait_for_timeout(300)
    ratio=page.evaluate('''()=>{const result=[];const rgb=s=>s.match(/[\d.]+/g)?.map(Number)||[255,255,255];const L=c=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);for(const e of document.querySelectorAll('#panel button')){if(!e.getClientRects().length||e.disabled||!e.innerText.trim())continue;let bg,el=e;while(el){let c=rgb(getComputedStyle(el).backgroundColor);if(c.length<4||c[3]>.9){bg=c;break}el=el.parentElement}const fg=rgb(getComputedStyle(e).color),a=L(fg),z=L(bg||[255,255,255]),ratio=(Math.max(a,z)+.05)/(Math.min(a,z)+.05);if(ratio<3)result.push({text:e.innerText.slice(0,40),ratio,fg,bg});}return result}''')
    contrasts.append({'theme':theme,'panel':panel,'below3':ratio});assert not ratio,(theme,panel,ratio)
    if theme in ['end','oak']:page.screenshot(path=OUT/f'quality-{width}-{theme}-{panel}.png')
  # Six actual native cursors: small controls, draggable canvas and an input.
  if width>760:
   for cursor in ['stone','oak','copper','diamond','amethyst','obsidian']:
    page.evaluate("async id=>{const{equipWeb}=await import('/src/presentation.js');equipWeb(mcDebug.state,id);mcDebug.setState(mcDebug.state);mcDebug.go('world')}",'web-cursor-'+cursor)
    page.locator('#home-view').click();page.locator('#settings').click();page.locator('#modal-close').click();page.mouse.move(700,170);page.mouse.down();page.mouse.move(760,195,steps=8)
    assert page.locator('#world canvas').evaluate("e=>getComputedStyle(e).cursor")=='grabbing';page.mouse.up()
    page.locator('#share-open').click();page.wait_for_selector('#share-url');page.locator('#share-url').click();assert page.locator('#share-url').evaluate('e=>getComputedStyle(e).cursor')=='text';page.locator('#share-url').select_text();page.locator('#modal-close').click()
  page.evaluate("mcDebug.go('world');document.querySelector('#collection-open').click()");page.wait_for_selector('[data-collection-tab="share"]');page.locator('[data-collection-tab="share"]').click();page.locator('[data-preview="web-card-worklog"]').click();page.locator('[data-web-trial]').click();page.wait_for_selector('#download-card:not([hidden])')
  page.locator('#download-card').click();assert page.locator('#placement-confirm').is_visible();assert not page.evaluate("!!mcDebug.state.webAppearance.owned['web-card-worklog']")
  page.locator('#placement-cancel').click();assert page.locator('#share-panel').is_visible()
  with page.expect_download() as d:
   page.locator('#download-card').click();page.locator('#placement-confirm').click()
  d.value.save_as(OUT/f'card-paid-trial-{width}.png');assert page.evaluate("mcDebug.state.webAppearance.owned['web-card-worklog']===true");assert page.locator('#share-panel').is_visible();assert page.locator('#appearance-trial').count()==0
  page.locator('#modal-close').click();page.evaluate("mcDebug.go('live')");page.wait_for_timeout(1300)
  for tab in ['equipment','decor','arrange','program']:
   page.locator(f'[data-room-tab="{tab}"]').click();page.wait_for_timeout(500)
   r=page.evaluate('''()=>{const w=mcDebug.world,c=w.camera;return {projection:(c.right-c.left)/(c.top-c.bottom),css:w.renderer.domElement.clientWidth/w.renderer.domElement.clientHeight}}''');assert abs(r['projection']-r['css'])<.01,r
  assert not errors,errors
  report.append({'width':width,'contrastAudit':contrasts,'errors':errors,'cursorFlows':6 if width>760 else 'native touch','paidTrialExport':True,'studioViewport':True})
  (OUT/'quality-report.json').write_text(json.dumps(report,indent=2));print('quality',width,'passed',flush=True);ctx.close()
 b.close()
