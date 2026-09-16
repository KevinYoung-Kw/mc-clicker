"""Atlas categories and facility-local services; isolated saves, real UI commands."""
import argparse,json
from pathlib import Path
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1];ap=argparse.ArgumentParser();ap.add_argument('--url',default='http://127.0.0.1:8975/');ap.add_argument('--xhs',action='store_true');ap.add_argument('--production',action='store_true');ap.add_argument('--engine',default='');opt=ap.parse_args();out=R/'docs/v2.0.0/qa/alpha7-ui';out.mkdir(parents=True,exist_ok=True)
seed=json.loads((out/'fixture.json').read_text());reports=[]
with sync_playwright() as pw:
 for engine,w,theme in [('chromium',1440,''),('chromium',390,''),('chromium',320,'web-theme-macintosh'),('webkit',390,'web-theme-end')]:
  if opt.engine and engine!=opt.engine:continue
  s=json.loads(json.dumps(seed));s['webAppearance']['owned'][theme]=True;s['webAppearance']['equipped']['theme']=theme
  browser=getattr(pw,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}));c=browser.new_context(viewport={'width':w,'height':960 if w>760 else 844},is_mobile=w<760,has_touch=w<760)
  c.add_init_script('if(!sessionStorage.getItem("alpha7qa")){localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(s))+');sessionStorage.setItem("alpha7qa","1")}');p=c.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
  def click(sel):p.locator(sel).first.click()
  def saved():return p.evaluate('JSON.parse(localStorage.getItem("mc-clicker-world-v2"))')
  def shot(name):
   p.wait_for_timeout(120)
   assert p.evaluate('document.documentElement.scrollWidth<=innerWidth'),'page overflow'
   assert p.locator('#panel-content').evaluate('e=>e.scrollWidth<=e.clientWidth+1'),'panel overflow'
   p.screenshot(path=str(out/f'{name}-{engine}-{w}{"-build" if opt.production else ""}.png'))
  def atlas():
   if opt.xhs:
    click('#hud-more');click('#atlas-open')
   else:click('[data-nav="atlas"]')
  def overview():
   click('[data-nav="village"]');click('[data-life-open]')
  try:
   p.goto(opt.url,wait_until='networkidle')
   if opt.xhs:click('#xhs-start button')
   atlas()
   if w<760 and p.locator('#panel-expand').get_attribute('aria-expanded')=='false':click('#panel-expand')
   assert p.locator('#atlas-content .guidance-card').count()==0
   assert p.locator('.atlas-node').count()==104
   before=p.locator('.atlas-summary strong').inner_text();shot('atlas-buildings')
   # Each tab has its own scroll; changing a tab does not replay panel entrance.
   p.locator('#panel-content').evaluate('e=>e.scrollTop=400');pos=p.locator('#panel-content').evaluate('e=>e.scrollTop')
   click('[data-atlas-tab="features"]');assert p.locator('.guidance-card').count()==4;assert p.locator('.atlas-node').count()==0;assert p.locator('.achievement-grid').count()==0;shot('atlas-features')
   click('[data-buy-guidance="counter"]');click('#placement-cancel');assert not saved()['guidance']['counter']
   click('[data-buy-guidance="counter"]');click('#placement-confirm');assert saved()['guidance']['counter'];assert p.locator('[data-atlas-tab="features"]').get_attribute('aria-selected')=='true'
   click('[data-atlas-tab="buildings"]');assert abs(p.locator('#panel-content').evaluate('e=>e.scrollTop')-pos)<3
   assert p.locator('.atlas-summary strong').inner_text()==before
   click('[data-atlas-tab="features"]');p.keyboard.press('ArrowRight');assert p.locator('[data-atlas-tab="achievements"]').get_attribute('aria-selected')=='true';assert p.locator('.atlas-node').count()==0;shot('atlas-achievements')
   p.keyboard.press('Home');click('[data-family="V"]');click('.atlas-node[data-detail="V25"]')
   assert p.locator('[data-life-menu="meal"]').count()==3
   assert p.locator('[data-item-back]').inner_text()=='← 返回图鉴'
   click('[data-item-back]');assert p.locator('[data-family="V"]').get_attribute('aria-selected')=='true'
   # All three settings are operated in their owning facility, not in Happiness.
   for owner,kind,option in [('V25','meal','roast'),('V22','drink','ale'),('V23','activity','dance')]:
    overview();assert p.locator('[data-life-menu]').count()==0
    click(f'.life-service [data-detail="{owner}"]');assert p.locator('[data-item-back]').inner_text()=='← 返回全村生活'
    assert p.locator('[data-life-menu]').count()==3
    assert p.locator(f'[data-life-menu="{kind}"][data-life-option="{option}"]').is_disabled()
    click(f'[data-buy="{owner}"]');click('#placement-cancel');assert saved()['counts'][owner]==1
    click(f'[data-buy="{owner}"]');click('#placement-confirm');assert saved()['counts'][owner]==2
    target=p.locator(f'[data-life-menu="{kind}"][data-life-option="{option}"]');assert target.is_enabled()
    target.focus();target.evaluate('e=>{window.qaNode=e;window.qaScroll=document.querySelector("#panel-content").scrollTop}')
    target.click();p.wait_for_timeout(1000)
    assert saved()['life']['menuState']['selected'][kind]==option
    assert target.get_attribute('aria-pressed')=='true'
    assert p.evaluate('qaNode.isConnected && qaNode===document.activeElement'),p.evaluate('({connected:qaNode.isConnected,focused:qaNode===document.activeElement,active:document.activeElement.outerHTML})')
    assert p.evaluate('Math.abs(qaScroll-document.querySelector("#panel-content").scrollTop)<3'),'selection moved scroll'
    p.locator('#panel-content').evaluate('e=>e.scrollTop=0');shot(owner)
    click('[data-item-back]');assert option in ['roast','ale','dance'];assert p.locator(f'[data-life-selection="{kind}"]').inner_text() in ['麦香烤肉','麦芽酒','广场舞会']
   p.locator('#panel-content').evaluate('e=>e.scrollTop=0');shot('life-overview')
   chosen=saved()['life']['menuState']['selected'];p.reload(wait_until='networkidle')
   if opt.xhs:click('#xhs-start button')
   assert saved()['life']['menuState']['selected']==chosen
   overview();click('.life-service [data-detail="V25"]');assert p.locator('[data-life-option="roast"]').get_attribute('aria-pressed')=='true'
   # Extra facility placement preserves the configured menu when cancelled.
   click('[data-civic-build="V25"]');click('#placement-cancel');assert p.locator('[data-life-option="roast"]').get_attribute('aria-pressed')=='true'
   click('[data-buy="V25"]');click('#placement-confirm');assert saved()['counts']['V25']==3;assert p.locator('[data-buy="V25"]').is_disabled();assert p.locator('.life-facility-heading [data-purchase-reason]').is_hidden()
   if not opt.production:
    # No implicit adoption/charge on an old welfare save just by opening a facility.
    p.evaluate('()=>{const s=mcDebug.state;s.life.serviceMode="legacy";s.life.welfare="off";mcDebug.setState(s);mcDebug.save()}')
    assert p.locator('[data-life-menu]').count()==0;assert p.locator('[data-life-enable]').count()==1;assert saved()['life']['serviceMode']=='legacy'
    click('[data-life-enable]');assert saved()['life']['serviceMode']=='current';assert p.locator('[data-life-menu="meal"]').count()==3
   assert not errors,errors
   reports.append({'engine':engine,'width':w,'theme':theme or 'default','atlasPartitions':True,'atlasCountsUnchanged':True,'keyboardTabs':True,'tabScrollMemory':True,'allFacilitySettings':True,'upgradeCancelAndUnlock':True,'menuFocusScrollStable':True,'overviewReflectsSelection':True,'refreshAndPlacementCancel':True,'legacyOptIn':not opt.production,'noOverflow':True,'errors':errors})
   print(reports[-1],flush=True)
  except:
   p.screenshot(path=str(out/f'failure-{engine}-{w}.png'));print(p.locator('#panel-content').inner_text());raise
  finally:browser.close()
(out/f'report{"-build" if opt.production else ""}.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2))
