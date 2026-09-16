"""Operations overview and real dispatch controls; isolated saves only."""
import argparse,json
from pathlib import Path
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1];a=argparse.ArgumentParser();a.add_argument('--url',default='http://127.0.0.1:8975/');a.add_argument('--xhs',action='store_true');a.add_argument('--out',default='docs/v2.0.0/qa/alpha5-operations');opt=a.parse_args();out=R/opt.out;out.mkdir(parents=True,exist_ok=True)
seed=json.loads((R/'docs/v2.0.0/qa/alpha5/fixture.json').read_text());seed['guidance']['notices']=False;rows=[]
with sync_playwright() as pw:
 for engine,w,theme in [('chromium',1440,''),('chromium',320,'web-theme-macintosh'),('webkit',390,'web-theme-end')]:
  browser=getattr(pw,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}));c=browser.new_context(viewport={'width':w,'height':960 if w>760 else 844},has_touch=w<760,is_mobile=w<760)
  c.add_init_script('if(!sessionStorage.getItem("opqa")){localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(seed))+');sessionStorage.setItem("opqa","1")}')
  p=c.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
  def click(q):p.locator(q).first.click()
  def shot(name):
   assert p.evaluate('document.documentElement.scrollWidth<=innerWidth'), 'document overflow'
   assert p.locator('#panel-content').evaluate('el=>el.scrollWidth<=el.clientWidth+1'), 'panel overflow'
   p.screenshot(path=str(out/f'{name}-{engine}-{w}.png'))
  try:
   p.goto(opt.url,wait_until='networkidle')
   if opt.xhs:click('#xhs-start button')
   p.wait_for_function('!!window.mcDebug')
   p.evaluate('''async theme=>{const {ensureCommunity}=await import('/src/residents.js');const s=mcDebug.state;s.counts.V15=6;s.counts.M4=3;ensureCommunity(s);for(const g of s.community.golems){g.stops=['V4','V7'];g.mode='cargo';g.cargo=null;}for(const r of s.community.residents){r.job='idle';r.prioritySource=null;r.cargo=null;}for(const r of s.community.residents.slice(0,3)){r.job='hauler';r.prioritySource='V4';}s.community.batches=[];s.sound=false;s.reducedMotion=true;s.webAppearance.owned[theme]=true;s.webAppearance.equipped.theme=theme;mcDebug.setState(s);mcDebug.save();}''',theme)
   click('[data-nav="network"]');assert p.locator('[data-industry-tab]').first.get_attribute('data-industry-tab')=='logistics';assert p.locator('[data-industry-tab="logistics"]').get_attribute('aria-pressed')=='true'
   assert p.locator('.regional-overview').is_visible();assert p.locator('.regional-overview').evaluate('el=>!el.closest("details")');shot('industry')
   row=p.locator('[data-dispatch-source="V4"]');row.scroll_into_view_if_needed();assert row.locator('[data-pickup-golem]').count()==0;assert row.locator('[data-clear-priority]').count()==0;shot('dispatch-compact')
   click('[data-haul-choose="V4"]');assert row.locator('[data-pickup-golem]').count()==6;assert row.locator('[data-clear-priority]').count()==3;shot('dispatch-edit')
   # Native checkbox changes only this source, not the rest of the saved route.
   first=row.locator('[data-pickup-golem]').first;gid=first.get_attribute('data-pickup-golem');first.uncheck();assert p.evaluate('id=>mcDebug.state.community.golems.find(g=>g.id===id).stops',gid)==['V7'];assert p.evaluate('document.activeElement?.dataset.pickupGolem')==gid
   # Repeated ticks keep input identity, focus and scroll position.
   p.evaluate('window.qaNode=document.activeElement;window.qaScroll=document.querySelector("#panel-content").scrollTop');p.wait_for_timeout(1300)
   assert p.evaluate('qaNode===document.activeElement&&qaNode.isConnected');assert p.evaluate('Math.abs(qaScroll-document.querySelector("#panel-content").scrollTop)<3')
   p.keyboard.press('Escape');assert not p.locator('.dispatch-editor').count();assert p.evaluate('document.activeElement.dataset.haulChoose')=='V4'
   click('[data-haul-choose="V4"]');rid=row.locator('[data-clear-priority]').first.get_attribute('data-clear-priority');click('[data-clear-priority="'+rid+'"]');assert p.evaluate('id=>mcDebug.state.community.residents.find(r=>r.id===id).prioritySource',rid)==None;assert p.evaluate('id=>mcDebug.state.community.residents.find(r=>r.id===id).job',rid)=='hauler'
   click('[data-haul-recruit]');assert row.locator('[data-haul-assign]:disabled').count()==0;assert row.locator('[data-haul-assign]').count()>=1;click('[data-haul-assign="'+rid+'"]');assert p.evaluate('id=>mcDebug.state.community.residents.find(r=>r.id===id).prioritySource',rid)=='V4'
   p.reload(wait_until='networkidle')
   if opt.xhs:click('#xhs-start button')
   assert p.evaluate('id=>mcDebug.state.community.golems.find(g=>g.id===id).stops',gid)==['V7'];assert p.evaluate('id=>mcDebug.state.community.residents.find(r=>r.id===id).prioritySource',rid)=='V4'
   click('[data-nav="village"]');assert p.locator('[data-village-tab="overview"]').get_attribute('aria-pressed')=='true';shot('village')
   if w<760 and p.locator('#panel-expand').get_attribute('aria-expanded')=='false':click('#panel-expand');shot('village-expanded')
   assert p.locator('[data-overview-job]').count()<=3
   click('[data-overview-job="farmer"]');assert p.locator('[data-workplace-card="farmer"] [data-workplace-picker]').is_visible();person=p.locator('[data-workplace-card="farmer"] [data-job-assign]').first;pid=person.get_attribute('data-job-assign');person.click();assert p.evaluate('id=>mcDebug.state.community.residents.find(r=>r.id===id).job',pid)=='farmer';shot('assignment')
   click('[data-village-tab="overview"]');click('[data-overview-cargo="trading"]');assert p.locator('.market-receipts').is_visible();click('[data-village-tab="overview"]');click('[data-overview-cargo="waiting"]');assert p.locator('.regional-overview').is_visible()
   # Remember intentional tab selection across close/reopen.
   click('[data-industry-tab="power"]');click('#panel-close');click('[data-nav="network"]');assert p.locator('.electricity-dashboard').is_visible()
   assert not errors,errors
   rows.append({'engine':engine,'width':w,'theme':theme,'overviewFirst':True,'compactSixGolems':True,'realRouteChange':True,'realPriorityAssignment':True,'tickFocusStable':True,'reloadRetainsAssignments':True,'vacancyToRealJob':True,'tabMemory':True,'noOverflow':True,'errors':errors})
  except:
   p.screenshot(path=str(out/f'failure-{engine}-{w}.png'));(out/'failure.txt').write_text(str(errors));raise
  finally:browser.close()
(out/'report.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2));print(json.dumps(rows,ensure_ascii=False))
