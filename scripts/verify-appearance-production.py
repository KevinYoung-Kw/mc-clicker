"""Verify the built preview on port 8897, with no DEV hook or shared user save."""
import json,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1];out=root/'docs/v1.7/qa/appearance-polish/production';out.mkdir(exist_ok=True)
items=json.loads(subprocess.check_output(['node','--input-type=module','-e','import {WEB_ITEMS} from "./src/web-catalog.js";console.log(JSON.stringify(WEB_ITEMS))'],cwd=root));f=json.loads((root/'docs/v1.6/qa/stability-baseline/fixtures/peak.json').read_text());f['guidance']['notices']=False;f['counts']['X2']=3;f['money']=1e9;f['skipPurchaseConfirmation']=False
results=[]
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--use-angle=metal'])
 for width,height in [(1440,960),(390,844)]:
  for theme in [i['id'] for i in items if i['slot']=='theme']:
   f['webAppearance']={'version':2,'catalogTier':0,'owned':{i['id']:True for i in items if i['id']!='web-notice-paper'},'equipped':{'theme':theme,'title':'web-title-obsidian','cursor':'web-cursor-glove'},'legacyAliases':{}}
   ctx=b.new_context(viewport={'width':width,'height':height},is_mobile=width<760,has_touch=width<760);page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.add_init_script('if(!sessionStorage.getItem("appearance-seeded")){localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(f))+');sessionStorage.setItem("appearance-seeded","1")}');page.goto('http://127.0.0.1:8897/',wait_until='networkidle')
   assert not page.evaluate('!!window.mcDebug')
   if width<760:page.locator('#hud-more').click()
   page.locator('#collection-open').click();page.locator('[data-collection-tab=notice]').click();page.locator('[data-web-select=web-notice-paper]').click();page.locator('[data-extra-buy]').click();page.locator('#placement-confirm').wait_for();page.locator('#placement-cancel').click();assert page.locator('[data-extra-buy]').count()==1
   page.locator('[data-extra-buy]').click();page.locator('#placement-confirm').click();page.wait_for_function('document.body.dataset.notice==="web-notice-paper"');page.locator('#modal-close').click();page.wait_for_selector('#notice-center:not([hidden]) .notice-receipt b')
   assert page.locator('#notification-shell .notice-receipt b').evaluate('e=>getComputedStyle(e).color')=='rgb(65, 56, 36)'
   assert page.locator('#world-label .eyebrow').evaluate('e=>{const r=document.createRange();r.selectNodeContents(e);const a=r.getBoundingClientRect(),b=e.getBoundingClientRect();return a.left>b.left+8&&a.right<b.right-8&&a.bottom<=b.bottom}')
   page.screenshot(path=str(out/(str(width)+'-'+theme+'.jpg')),type='jpeg',quality=84,animations='disabled');page.reload(wait_until='networkidle');assert page.evaluate('document.body.dataset.theme')==theme;assert page.evaluate('document.body.dataset.notice')=='web-notice-paper';assert not errors,errors
   results.append({'width':width,'theme':theme,'purchaseConfirmation':'cancel and confirm passed','reload':True,'errors':errors});ctx.close();print(width,theme,flush=True)
 b.close()
(out/'report.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
