"""Achievement collection flows on compiled builds; never use the player's save."""
import argparse,json
from pathlib import Path
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1]
ap=argparse.ArgumentParser();ap.add_argument('--url',default='http://127.0.0.1:8983/');ap.add_argument('--xhs',action='store_true');a=ap.parse_args()
out=R/'docs/v2.0.0/qa/alpha8-achievements';out.mkdir(parents=True,exist_ok=True)
seed=json.loads((R/'docs/v2.0.0/qa/alpha7-ui/fixture.json').read_text());reports=[]
with sync_playwright() as pw:
 for engine,w,theme in [('chromium',1440,''),('chromium',390,''),('chromium',320,'web-theme-macintosh'),('webkit',390,'web-theme-end')]:
  s=json.loads(json.dumps(seed));s['achievements']=['small-homes'];s['clicks']=0;s['webAppearance']['owned'][theme]=True;s['webAppearance']['equipped']['theme']=theme
  b=getattr(pw,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}));c=b.new_context(viewport={'width':w,'height':900 if w>760 else 844},is_mobile=w<760,has_touch=w<760)
  c.add_init_script('if(!sessionStorage.getItem("alpha8qa")){localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(s))+');sessionStorage.setItem("alpha8qa","1")}');p=c.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
  def click(q):p.locator(q).first.click()
  def atlas():
   if a.xhs:click('#hud-more');click('#atlas-open')
   else:click('[data-nav="atlas"]')
   click('[data-atlas-tab="achievements"]')
   if w<760 and p.locator('#panel-expand').get_attribute('aria-expanded')=='false':click('#panel-expand')
  def shot(name):
   assert p.evaluate('document.documentElement.scrollWidth<=innerWidth')
   assert p.locator('#panel-content').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
   p.screenshot(path=str(out/f'{name}-{engine}-{w}.png'))
  try:
   p.goto(a.url,wait_until='networkidle')
   if a.xhs:click('#xhs-start button')
   atlas();assert p.locator('[data-achievement]').count()==30
   assert p.locator('[data-achievement="small-homes"]').get_attribute('class').endswith('earned')
   assert p.locator('[data-achievement="first"] [data-achievement-status]').inner_text()=='0 / 1'
   shot('all')
   click('[data-achievement-group="challenge"]');assert p.locator('[data-achievement]').count()==4;shot('challenges')
   click('[data-achievement-pending]');assert p.locator('[data-achievement="small-homes"]').count()==0
   click('[data-achievement-pending]');click('[data-achievement="three-farms"] [data-detail]')
   assert p.locator('[data-item-back]').inner_text()=='← 返回图鉴';click('[data-item-back]')
   assert p.locator('[data-achievement-group="challenge"]').get_attribute('aria-pressed')=='true'
   click('[data-achievement-group="collection"]');shot('collections')
   click('[data-achievement="all-buildings"] [data-achievement-buildings]');assert p.locator('.atlas-node').count()==104
   click('[data-atlas-tab="achievements"]');click('[data-achievement-group="work"]');shot('work')
   # Stable live progress does not replace controls or scroll the list.
   p.locator('[data-achievement-group="work"]').focus();p.evaluate('window.qaFocus=document.activeElement;window.qaScroll=document.querySelector("#panel-content").scrollTop');p.wait_for_timeout(1000)
   assert p.evaluate('qaFocus.isConnected && document.activeElement===qaFocus')
   assert p.evaluate('Math.abs(qaScroll-document.querySelector("#panel-content").scrollTop)<3')
   # Complete a real action, return to its badge, persist and reload.
   click('#panel-close');click('#mine');p.evaluate('(ev)=>window.dispatchEvent(new Event(ev))','pagehide' if a.xhs else 'blur')
   saved=p.evaluate('JSON.parse(localStorage.getItem("mc-clicker-world-v2"))');assert 'first' in saved['achievements'];assert 'small-homes' in saved['achievements']
   p.evaluate('(ev)=>window.dispatchEvent(new Event(ev))','pageshow' if a.xhs else 'focus')
   p.reload(wait_until='networkidle')
   if a.xhs:click('#xhs-start button')
   atlas();click('[data-achievement-group="all"]');assert p.locator('[data-achievement="first"] [data-achievement-status]').inner_text()=='已达成';shot('earned')
   click('[data-atlas-tab="achievements"]');p.keyboard.press('ArrowLeft');assert p.locator('[data-atlas-tab="features"]').get_attribute('aria-selected')=='true'
   assert not errors,errors
   result={'engine':engine,'width':w,'theme':theme or 'default','all30Visible':True,'conditionsAndProgress':True,'filters':True,'relatedFacilityAndReturn':True,'collectionEntry':True,'stableRefresh':True,'realMiningUnlock':True,'layoutAchievementSurvivesReload':True,'keyboard':True,'noOverflow':True,'errors':errors};reports.append(result);print(result,flush=True)
  except:
   p.screenshot(path=str(out/f'failure-{engine}-{w}.png'));raise
  finally:b.close()
(out/'report.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2))
