from pathlib import Path
from playwright.sync_api import sync_playwright
import json
out=Path(__file__).resolve().parents[1]/'docs/v1.5/qa/narrator-outing';out.mkdir(parents=True,exist_ok=True)
reports=[]
with sync_playwright() as p:
 for engine,width in [('chromium',1440),('webkit',390),('chromium',320)]:
  browser=getattr(p,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}))
  context=browser.new_context(viewport={'width':width,'height':844},is_mobile=width<760,has_touch=width<760)
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def press(selector):
   loc=page.locator(selector).first
   loc.tap() if width<760 else loc.click()
  def shot(name):
   page.wait_for_timeout(300)
   page.screenshot(path=str(out/f'{name}-{engine}-{width}.png'))
  def info():
   if width<760:press('#hud-more')
   press('#info-open')
  page.goto('http://127.0.0.1:8890/',wait_until='networkidle');page.wait_for_function('!!window.mcDebug')
  press('[data-nav=build]')
  assert '被商城抓来的消息通知' in page.locator('[data-guidance-card=info]').inner_text()
  press('#panel-close')
  page.evaluate('''async()=>{
   const {NARRATION,IDLE_LINES}=await import('/src/narrative.js'),{advanceEasterEggs}=await import('/src/easter-eggs.js');
   const s=mcDebug.state;s.money=600;s.guidance.info=true;s.counts.M5=1;s.counts.M16=1;s.play=1680;
   s.narrative.intro='rescued';s.narrative.current=null;s.narrative.quiet=60;s.narrative.gap=0;
   s.narrative.seen=[...NARRATION,...IDLE_LINES].filter(r=>r.id!=='egg:after-hours').map(r=>r.id);
   s.easterEggs.entries['private-stash']={status:'claimed',reward:30};s.easterEggs.attemptIn=0;
   advanceEasterEggs(s,1,{quiet:true,random:()=>0});mcDebug.advance(0);
  }''')
  page.get_by_role('button',name='给 520 ◆',exact=True).wait_for();shot('offer')
  assert page.locator('#narrator p').inner_text().startswith('商量个事')
  page.get_by_role('button',name='改天再说',exact=True).click()
  assert page.evaluate('mcDebug.state.money')==600
  info();press('[data-dialogue-start=after-hours]')
  page.wait_for_function('mcDebug.state.easterEggs.entries["after-hours"].status==="away"')
  assert page.evaluate('mcDebug.state.money')==80
  assert page.locator('#narrator').is_hidden()
  info();page.wait_for_selector('[data-narrator-remaining]');shot('away')
  assert page.locator('#info-open').get_attribute('aria-label')=='通知外出中，查看归来倒计时'
  assert '私房钱' not in page.locator('.narrator-trip-dialog').inner_text()
  before=page.locator('[data-narrator-remaining]').inner_text();page.wait_for_timeout(1200)
  assert page.locator('[data-narrator-remaining]').inner_text()!=before
  frozen=page.locator('[data-narrator-remaining]').inner_text()
  page.evaluate('window.dispatchEvent(new Event("blur"))');page.wait_for_timeout(1200)
  assert page.locator('[data-narrator-remaining]').inner_text()==frozen
  assert page.locator('#notification-shell').get_attribute('data-character')=='away'
  assert page.locator('#notification-shell .notice-face').count()==0
  page.evaluate('window.dispatchEvent(new Event("focus"));mcDebug.save()')
  page.reload(wait_until='networkidle');page.wait_for_function('!!window.mcDebug')
  assert page.evaluate('mcDebug.state.money')==80
  info();page.wait_for_selector('[data-narrator-remaining]')
  page.evaluate('mcDebug.state.guidance.notices=false;mcDebug.advance(60)')
  page.wait_for_selector('[data-narrator-outfit]');shot('reward')
  assert page.evaluate('mcDebug.state.easterEggs.wardrobe.owned')==['date-bow']
  assert page.locator('.narrator-outfit [data-accessory=date-bow]').count()==1
  assert page.locator('#narrator').is_hidden()
  press('[data-narrator-outfit]');assert page.locator('[data-narrator-outfit]').inner_text()=='戴上领结'
  assert page.evaluate('mcDebug.state.easterEggs.wardrobe.equipped') is None
  press('[data-narrator-outfit]');assert page.evaluate('mcDebug.state.easterEggs.wardrobe.equipped')=='date-bow'
  press('#modal-close')
  page.evaluate('mcDebug.state.guidance.notices=true;mcDebug.state.narrative.gap=0')
  page.wait_for_selector('#narrator:not([hidden])');assert page.locator('#narrator p').inner_text().startswith('回来了')
  assert page.locator('#notification-shell [data-accessory=date-bow]').count()==1;shot('returned')
  for theme in ['','web-theme-backpack','web-theme-oak','web-theme-redstone','web-theme-end']:
   page.evaluate('theme=>document.body.dataset.theme=theme',theme)
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
   assert page.locator('#notification-shell').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
  page.evaluate('mcDebug.save()');page.reload(wait_until='networkidle');page.wait_for_function('!!window.mcDebug')
  assert page.evaluate('mcDebug.state.easterEggs.wardrobe.equipped')=='date-bow'
  assert page.evaluate('mcDebug.state.money')==80
  assert not errors,errors
  reports.append({'browser':engine,'width':width,'checks':['reviewed opening copy live','optional decline and revisit','one-time 520 charge','absence hides character but retains action feedback','existing header/menu entry','stable ticking modal','background pause and reload','completion while muted and inside modal','pixel accessory and toggle','return dialogue and five themes'],'errors':errors})
  context.close();browser.close()
(out/'results.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2))
print(json.dumps(reports,ensure_ascii=False))
