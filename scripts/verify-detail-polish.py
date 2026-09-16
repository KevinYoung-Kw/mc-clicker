"""V1.5.3: development fixtures, real collection, shop and workplace controls."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
OUT=Path(__file__).resolve().parents[1]/'docs/v1.5.3/qa';OUT.mkdir(parents=True,exist_ok=True)
results=[]
with sync_playwright() as p:
 for engine,width in [('chromium',1440),('webkit',390),('chromium',320)]:
  browser=getattr(p,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}))
  context=browser.new_context(viewport={'width':width,'height':900 if width>760 else 844},is_mobile=width<760,has_touch=width<760)
  page=context.new_page();page.set_default_timeout(20000);errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:8890/',wait_until='networkidle');page.wait_for_function('!!window.mcDebug')
  def press(sel):
   l=page.locator(sel).first
   l.tap() if width<760 else l.click()
  def photo(name):
   page.screenshot(path=str(OUT/f'{name}-{engine}-{width}.png'))
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),name
  def seed(iron=False,full=False):
   page.evaluate('''async opts=>{const {fresh}=await import('/src/game.js');const s=fresh();s.money=1e7;s.guidance.info=true;s.guidance.notices=false;s.narrative.companionsShown=true;s.counts={T1:1,T2:1,T7:1};if(opts.iron)s.counts.T3=1;if(opts.full){Object.assign(s.counts,{V1:4,V2:3,V3:1,V18:1,X2:1,M1:1,M2:1});s.chunks.overworld=[{x:0,z:0},{x:1,z:0},{x:0,z:1},{x:1,z:1}];}mcDebug.setState(s);}''',{'iron':iron,'full':full});page.wait_for_timeout(350)
  def hold(ms):
   box=page.locator('#mine').bounding_box();x=box['x']+box['width']/2;y=box['y']+box['height']/2
   # Mouse press exercises shared pointer hold even in mobile emulation; real taps use touch above.
   page.mouse.move(x,y);page.mouse.down();page.wait_for_timeout(ms);page.mouse.up()
  seed();before=page.evaluate('mcDebug.state.clicks');hold(1600);assert page.evaluate('mcDebug.state.clicks')==before+1,'pre-iron hold repeated'
  page.keyboard.down('Space');page.wait_for_timeout(1300);page.keyboard.up('Space');assert page.evaluate('mcDebug.state.clicks')==before+2,'pre-iron space repeated'
  seed(iron=True);hold(5000);assert page.evaluate('mcDebug.state.clicks')>15
  peak=float(page.locator('#mine').get_attribute('aria-label').split('×')[-1]);assert peak>1.55,peak
  photo('combo-full');page.wait_for_timeout(1100);mid=float(page.locator('#mine').get_attribute('aria-label').split('×')[-1]);assert 1<mid<peak,mid
  page.wait_for_timeout(2500);assert float(page.locator('#mine').get_attribute('aria-label').split('×')[-1])==1
  seed(iron=True,full=True)
  if not page.locator('#collection-open').is_visible():press('#hud-more')
  press('#collection-open');assert '12 件可选' in page.locator('#collection-shop').inner_text();photo('stall-level1')
  press('[data-collection-tab=theme]');assert page.locator('.stock-locked').count()==4
  before=page.evaluate('mcDebug.state.money');press('[data-stall-upgrade]');assert page.locator('#placement-confirm').is_visible();press('#placement-cancel')
  assert page.evaluate('mcDebug.state.counts.X2')==1;assert page.locator('#collection-shop').is_visible()
  press('[data-stall-upgrade]');press('#placement-confirm');assert page.evaluate('mcDebug.state.counts.X2')==2;assert page.locator('#collection-shop').is_visible();assert '27 件可选' in page.locator('#collection-shop').inner_text()
  press('[data-web-select=web-theme-backpack]');press('[data-extra-buy=web-theme-backpack]');press('#placement-confirm');assert page.evaluate('!!mcDebug.state.webAppearance.owned["web-theme-backpack"]')
  if page.locator('[data-web-equip=web-theme-backpack]').inner_text()=='应用':press('[data-web-equip=web-theme-backpack]')
  assert page.evaluate('mcDebug.state.webAppearance.equipped.theme')=='web-theme-backpack';photo('stall-level2')
  press('[data-web-equip=web-theme-backpack]');assert not page.evaluate('mcDebug.state.webAppearance.equipped.theme')
  page.evaluate('mcDebug.state.skipPurchaseConfirmation=true');press('[data-stall-upgrade]');assert page.evaluate('mcDebug.state.counts.X2')==3;assert '40 件可选' in page.locator('#collection-shop').inner_text()
  for theme in ['backpack','oak','redstone','end']:
   # Theme ownership already has independent purchase checks; fixture supplies the other test skins.
   page.evaluate('''id=>{mcDebug.state.webAppearance.owned[id]=true}''','web-theme-'+theme)
   press('[data-web-select=web-theme-'+theme+']');press('[data-web-equip=web-theme-'+theme+']');photo('shop-theme-'+theme)
  press('[data-web-reset]');page.evaluate('mcDebug.save()');page.reload(wait_until='networkidle');page.wait_for_function('!!window.mcDebug');assert page.evaluate('mcDebug.state.counts.X2')==3
  press('[data-nav=village]');press('[data-village-tab=market]');press('[data-market-staff]');assert page.locator('[data-workplace-card=merchant] [data-job-assign]').count()>0
  press('[data-workplace-card=merchant] [data-job-assign]');assert page.evaluate('mcDebug.state.community.residents.some(r=>r.job==="merchant")')
  assert page.locator('[data-workplace-card=merchant] .workplace-entry button').is_hidden(),'full workplace still offers assignment'
  page.evaluate('mcDebug.advance(25)');photo('merchant-assigned')
  press('[data-village-tab=market]');photo('market-status');press('#panel-close');photo('world-models')
  assert not errors,errors
  results.append({'engine':engine,'width':width,'comboPeak':peak,'decaySample':mid,'merchant':page.evaluate('mcDebug.state.community.residents.filter(r=>r.job==="merchant").map(r=>({job:r.job,status:r.status,workplace:r.workplaceId,earned:r.jobEarned}))'),'errors':errors})
  print(json.dumps(results[-1],ensure_ascii=False),flush=True);browser.close()
(OUT/'browser-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
