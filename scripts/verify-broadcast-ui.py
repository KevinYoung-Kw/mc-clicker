"""Actual room → research → cancel/confirm → equipment, in isolated browser saves."""
import argparse,json
from pathlib import Path
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1];a=argparse.ArgumentParser();a.add_argument('--url',default='http://127.0.0.1:8975/');a.add_argument('--xhs',action='store_true');a.add_argument('--production',action='store_true');opt=a.parse_args();out=R/'docs/v2.0.0/qa/alpha6-broadcast';out.mkdir(parents=True,exist_ok=True)
base=json.loads((out/'ui-fixture.json').read_text());reports=[]
with sync_playwright() as pw:
 for engine,width,theme in [('chromium',1440,''),('chromium',320,'web-theme-macintosh'),('webkit',390,'web-theme-end')]:
  s=json.loads(json.dumps(base));s['webAppearance']['owned'][theme]=True;s['webAppearance']['equipped']['theme']=theme
  b=getattr(pw,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}));c=b.new_context(viewport={'width':width,'height':960 if width>760 else 844},is_mobile=width<760,has_touch=width<760)
  c.add_init_script('if(!sessionStorage.getItem("broadcastqa")){localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(s))+');sessionStorage.setItem("broadcastqa","1")}');p=c.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
  def click(sel):p.locator(sel).first.click()
  def room():
   click('[data-nav="build"]');click('[data-open="owned"]');click('[data-detail="L2"]');p.wait_for_selector('body.live-page');click('[data-room-tab="program"]')
   if width<760 and p.locator('#panel-expand').get_attribute('aria-expanded')=='false':click('#panel-expand')
  def snap(stage):
   p.locator('#panel-content').evaluate('e=>e.scrollTop=0');p.wait_for_timeout(200)
   assert p.evaluate('document.documentElement.scrollWidth<=innerWidth'),'page overflow'
   assert p.locator('#panel-content').evaluate('e=>e.scrollWidth<=e.clientWidth+1'),'panel overflow'
   p.screenshot(path=str(out/f'{stage}-{engine}-{width}{"-build" if opt.production else ""}.png'))
  def saved():return p.evaluate('JSON.parse(localStorage.getItem("mc-clicker-world-v2"))')
  try:
   p.goto(opt.url,wait_until='networkidle')
   if opt.xhs:click('#xhs-start button')
   room();p.wait_for_selector('[data-broadcast-stage="radio"]');assert p.locator('#room-monitor').is_hidden();assert p.locator('[data-studio-tab="chat"]').count()==0;snap('radio')
   click('[data-room-tab="equipment"]');assert p.locator('[data-card="L4"]').count()>0;assert p.locator('[data-card="L5"]').count()==0;snap('equipment')
   click('[data-broadcast-research="television"]');p.wait_for_selector('[data-research-row="television"]')
   click('[data-research-action="television"]');click('#research-cancel');assert saved()['research']['completed'].get('television')!=True
   click('[data-research-action="television"]');click('#research-confirm');p.wait_for_function('JSON.parse(localStorage.getItem("mc-clicker-world-v2")).research.completed.television===true')
   # Income runs throughout; the paid project quotes exactly 16,000, not a fabricated wallet delta.
   assert saved()['research']['projects']['television']['paidCost']==16000
   p.reload(wait_until='networkidle')
   if opt.xhs:click('#xhs-start button')
   assert saved()['research']['completed']['television'];assert not saved()['live']['legacyBroadcast'];room();p.wait_for_selector('[data-broadcast-stage="television"]');assert p.locator('#room-monitor').evaluate('e=>!e.hidden');snap('television')
   click('[data-room-tab="equipment"]');assert p.locator('[data-card="L3"] [data-purchase-state="locked"]').count()==0;assert p.locator('[data-card="L6"]').count()>0
   if not opt.production:
    for stage,keys in [('streaming',['automation','streaming']),('modern',['modern'])]:
     p.evaluate('(keys)=>{const s=mcDebug.state;for(const k of keys)s.research.completed[k]=true;mcDebug.setState(s);mcDebug.save()}',keys);click('[data-room-tab="program"]');p.wait_for_selector('[data-broadcast-stage="'+stage+'"]');snap(stage);click('[data-room-tab="equipment"]')
   assert not errors,errors;reports.append({'engine':engine,'width':width,'theme':theme,'roomEntry':True,'stagedEquipment':True,'cancelFree':True,'actualResearchPaid':16000,'reloadKeepsTelevision':True,'noOverflow':True,'errors':errors})
  except:
   p.screenshot(path=str(out/f'failure-{engine}-{width}.png'));raise
  finally:b.close()
(out/f'ui-report{"-build" if opt.production else ""}.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2));print(json.dumps(reports,ensure_ascii=False))
