"""Status → targeted improvements → original purchase confirmation, with isolated saves."""
import argparse,json
from pathlib import Path
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1];ap=argparse.ArgumentParser();ap.add_argument('--url',default='http://127.0.0.1:8975/');ap.add_argument('--xhs',action='store_true');ap.add_argument('--production',action='store_true');opt=ap.parse_args();out=R/'docs/v2.0.0/qa/alpha5-operations';out.mkdir(parents=True,exist_ok=True)
seed=json.loads((R/'docs/v2.0.0/qa/alpha5/fixture.json').read_text());seed['guidance']['notices']=False;seed['sound']=False;seed['money']=10000000;seed['skipPurchaseConfirmation']=False;seed['reducedMotion']=True;seed['counts']['V3']=2;seed['counts']['M4']=2;seed['upgrades']['levels']['market-pack']=0;seed['grid']['disabled']=[];seed['grid']['links']['M9']=True;reports=[]
with sync_playwright() as pw:
 for engine,w,theme in [('chromium',1440,''),('chromium',320,'web-theme-macintosh'),('webkit',390,'web-theme-end')]:
  s=json.loads(json.dumps(seed));s['webAppearance']['owned'][theme]=True;s['webAppearance']['equipped']['theme']=theme
  browser=getattr(pw,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}));c=browser.new_context(viewport={'width':w,'height':960 if w>760 else 844},is_mobile=w<760,has_touch=w<760)
  c.add_init_script('if(!sessionStorage.getItem("guideqa")){localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(s))+');sessionStorage.setItem("guideqa","1")}');p=c.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
  def click(sel):p.locator(sel).first.click()
  def shot(name):
   assert p.evaluate('document.documentElement.scrollWidth<=innerWidth'),'page overflow'
   assert p.locator('#panel-content').evaluate('e=>e.scrollWidth<=e.clientWidth+1'),'panel overflow'
   p.screenshot(path=str(out/f'guide-{name}-{engine}-{w}{"-build" if opt.production else ""}.png'))
  def state():return p.evaluate('JSON.parse(localStorage.getItem("mc-clicker-world-v2"))') if opt.production else p.evaluate('mcDebug.state')
  try:
   p.goto(opt.url,wait_until='networkidle')
   if opt.xhs:click('#xhs-start button')
   click('[data-nav="network"]');p.wait_for_selector('[data-guide-stage="haul"][data-signal]')
   if w<760 and p.locator('#panel-expand').get_attribute('aria-expanded')=='false':click('#panel-expand')
   assert p.locator('.flow-chain [data-signal="warning"]').count()>0
   click('[data-guide-realm="overworld"][data-guide-stage="haul"]');assert p.locator('[data-guide-shelf="overworld"][data-guide-key="haul"]').count()==1
   assert p.locator('[data-guide-offer="M8"]').count()==1;assert p.locator('[data-guide-offer="V15"]').count()==0
   p.locator('.production-solutions').scroll_into_view_if_needed();shot('haul')
   click('[data-guide-realm="overworld"][data-guide-stage="trade"]');assert p.locator('[data-guide-key="trade"]').count()==1;assert p.locator('[data-guide-key="haul"]').count()==0
   p.locator('.production-solutions').scroll_into_view_if_needed();shot('trade')
   # An improvement is paid only through the existing confirm controls. Cancel is free.
   click('[data-guide-buy="market-pack"]');assert p.locator('#placement-confirm').is_visible();click('#placement-cancel');assert state()['upgrades']['levels'].get('market-pack',0)==0
   assert p.locator('[data-guide-key="trade"]').is_visible();click('[data-guide-buy="market-pack"]');click('#placement-confirm');p.wait_for_timeout(300)
   assert state()['upgrades']['levels']['market-pack']==1
   assert p.locator('[data-guide-key="trade"]').count()==1
   # Tick updates must keep focus on a selected action and avoid shifting the shelf.
   button=p.locator('[data-guide-buy="market-pack"]');button.focus();p.evaluate('window.qaFocus=document.activeElement;window.qaTop=document.querySelector("#panel-content").scrollTop');p.wait_for_timeout(1200)
   assert p.evaluate('qaFocus===document.activeElement && qaFocus.isConnected');assert p.evaluate('Math.abs(qaTop-document.querySelector("#panel-content").scrollTop)<3')
   p.keyboard.press('Escape');assert p.locator('[data-guide-shelf]').count()==0
   assert p.evaluate('document.activeElement.dataset.guideStage')=='trade'
   # An explicitly paused source gets a repair action, not just a catalogue.
   if not opt.production:
    p.evaluate('()=>{const s=mcDebug.state;s.grid.disabled=["M9"];s.grid.revision++;mcDebug.setState(s);}')
    p.wait_for_selector('[data-guide-stage="raw"][data-signal="blocked"]');click('[data-guide-realm="overworld"][data-guide-stage="raw"]')
    assert p.locator('[data-guide-free="M9"]').is_visible();p.locator('.production-solutions').scroll_into_view_if_needed();shot('paused')
    click('[data-guide-free="M9"]');assert p.locator('[data-card="M9"]').count()>0
   # Reload keeps the completed real upgrade in both source and compiled editions.
   p.reload(wait_until='networkidle')
   if opt.xhs:click('#xhs-start button')
   assert state()['upgrades']['levels']['market-pack']==1
   assert not errors,errors
   reports.append({'engine':engine,'width':w,'theme':theme,'warningVisible':True,'targetedOffers':True,'cancelFree':True,'realUpgrade':True,'focusAndScrollStable':True,'freeRepair':not opt.production,'reloadRetainsPurchase':True,'noOverflow':True,'errors':errors})
  except:
   p.screenshot(path=str(out/f'guide-failure-{engine}-{w}.png'));raise
  finally:browser.close()
(out/f'guide-report{"-build" if opt.production else ""}.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2));print(json.dumps(reports,ensure_ascii=False))
