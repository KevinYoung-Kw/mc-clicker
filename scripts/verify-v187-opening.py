import argparse,json,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description='XHS real purchase and companion flight destination checks')
parser.add_argument('--url',default='http://127.0.0.1:8941/')
parser.add_argument('--out',default='docs/qa/v187/opening')
a=parser.parse_args();O=R/a.out;O.mkdir(parents=True,exist_ok=True)
s=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {fresh} from './tests/helpers/first-time-game.js';let s=fresh(42);s.money=10000;s.counts.T1=1;s.sound=false;console.log(JSON.stringify(s))"],cwd=R,text=True))
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--use-angle=metal']);c=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
 c.add_init_script('if(!localStorage.getItem("mc-clicker-world-v2"))localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(s))+')')
 c.add_init_script('''window.flightQA=[];const realAnimate=Element.prototype.animate;Element.prototype.animate=function(frames,options){if(this.classList.contains('narrator-companion')&&frames.length>2){const menu=document.querySelector('#hud-more').getBoundingClientRect();window.flightQA.push({id:this.dataset.companion,left:parseFloat(this.style.left),top:parseFloat(this.style.top),frame:frames.at(-1).transform,target:{x:menu.x+menu.width/2,y:menu.y+menu.height/2}});}return realAnimate.call(this,frames,options)}''')
 q=c.new_page();q.set_default_timeout(15000);errs=[];q.on('pageerror',lambda e:errs.append(str(e)))
 q.goto(a.url,wait_until='networkidle');q.locator('#xhs-start button').click();assert not q.locator('#hud-more').is_visible()
 q.locator('[data-nav="build"]').click();q.locator('[data-buy-guidance="info"]').click();q.locator('#placement-confirm').click();print('info purchased',flush=True)
 q.wait_for_function('window.flightQA.length===3',timeout=30000);q.wait_for_timeout(1600)
 flights=q.evaluate('window.flightQA');print(flights,flush=True)
 for f in flights:
  import re
  dx,dy=map(float,re.search(r'translate\(([-.\d]+)px,([-.\d]+)px\)',f['frame']).groups());assert abs(f['left']+20+dx-f['target']['x'])<1;assert abs(f['top']+20+dy-f['target']['y'])<1
 q.locator('#hud-more').click();assert q.locator('#settings').is_visible();assert not q.locator('#atlas-open').is_visible();q.screenshot(path=str(O/'friends-menu.png'));q.locator('#hud-more').click()
 q.locator('[data-buy="X1"]').click();q.locator('#placement-confirm').click();print('atlas bought',flush=True)
 q.wait_for_function('document.querySelector("#notice-center").innerText.includes("菜单")');q.screenshot(path=str(O/'atlas-receipt.png'))
 q.locator('#hud-more').click();q.locator('#atlas-open').click();q.wait_for_selector('.atlas-summary');q.reload(wait_until='networkidle');q.locator('#xhs-start button').click();q.wait_for_timeout(2000);assert q.evaluate('window.flightQA.length')==0
 assert not errs,errs
 (O/'report.json').write_text(json.dumps({'flights':flights,'atlasReceipt':True,'atlasPurchaseUnlock':True,'refreshNoReplay':True,'errors':errs},ensure_ascii=False,indent=2));b.close()
