"""Production room placement: layout setting, automatic purchases and one music deck."""
import argparse,json,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
a=argparse.ArgumentParser();a.add_argument('--url',default='http://127.0.0.1:8918/');a.add_argument('--out',default='docs/v1.7/qa/alpha7');args=a.parse_args()
out=ROOT/args.out;out.mkdir(parents=True,exist_ok=True)
s=json.loads(subprocess.check_output(['node','--input-type=module','-e','''
import {fresh} from './src/game.js';const s=fresh(42);s.money=1e8;s.play=1800;s.reducedMotion=true;s.skipPurchaseConfirmation=false;s.skipBuildConfirmation=true;
Object.assign(s.counts,{T1:1,T2:1,T3:1,T4:1,T5:1,X1:1,V1:1,V2:1,V3:2,L1:1,L2:1,M5:1,M6:1});s.guidance.info=true;s.guidance.goals=true;s.guidance.notices=false;s.narrative.intro='rescued';s.narrative.companionsShown=true;s.sound=true;s.records.playing=true;console.log(JSON.stringify(s));'''],cwd=ROOT))
reports=[]
with sync_playwright() as p:
 for engine,width in [('chromium',1440),('webkit',390),('chromium',320)]:
  mobile=width<760;b=getattr(p,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}));c=b.new_context(viewport={'width':width,'height':844},has_touch=mobile,is_mobile=mobile)
  c.add_init_script('localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(s))+')')
  c.add_init_script('window.musicPlayers=[];window.Audio=class extends Audio{constructor(...a){super(...a);musicPlayers.push(this)}};')
  page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def press(q):
   node=page.locator(q).first;node.tap() if mobile else node.click()
  def saved():return page.evaluate('JSON.parse(localStorage.getItem("mc-clicker-world-v2"))')
  try:
   page.goto(args.url,wait_until='networkidle');press('[data-nav=atlas]');press('[data-detail=L2]');press('[data-room-tab=equipment]')
   page.wait_for_function('musicPlayers.some(a=>!a.paused&&a.readyState>=2)');players=page.evaluate('musicPlayers.length')
   press('[data-buy=L3]');assert page.locator('#placement-confirm').is_hidden();assert '◆ / 次' in page.locator('#placement-detail').inner_text();press('#placement-rotate')
   page.wait_for_timeout(300);box=page.locator('#world canvas').bounding_box();count=saved()['counts'].get('L3',0)
   for y in range(7,27):
    for x in range(1,24):
     pt={'x':box['x']+box['width']*x/24,'y':box['y']+box['height']*y/28}
     if not page.evaluate('p=>document.elementFromPoint(p.x,p.y)===document.querySelector("#world canvas")',pt):continue
     page.touchscreen.tap(**pt) if mobile else page.mouse.click(**pt)
     if saved()['counts'].get('L3',0)>count:break
    if saved()['counts'].get('L3',0)>count:break
   assert saved()['counts']['L3']==count+1
   assert saved()['studio']['placements']['L3:0']['rotation']==1
   assert page.locator('#placement-bar').is_hidden()
   assert page.evaluate('musicPlayers.filter(a=>!a.paused).length')==1
   assert page.evaluate('musicPlayers.length')==players,'room placement does not recreate BGM'
   press('[data-room-tab=arrange]');press('[data-room-select=L1]');assert page.locator('.record-library').is_visible()
   assert page.locator('[data-record-mode]').count()==1
   page.screenshot(path=str(out/f'studio-{engine}-{width}.png'));assert not errors,errors
   reports.append({'engine':engine,'width':width,'indoorClickCommitsOne':True,'rotation':90,'purchaseConfirmationStillOn':True,'sameMusicDeck':True,'sameLibrary':True,'errors':errors})
   print(engine,width,'PASS',flush=True)
  except Exception:
   page.screenshot(path=str(out/f'studio-failure-{engine}-{width}.png'));print(errors,flush=True);raise
  finally:b.close()
(out/'studio-report.json').write_text(json.dumps(reports,indent=2)+'\n')
