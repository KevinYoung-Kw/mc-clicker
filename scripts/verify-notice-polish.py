from pathlib import Path
from playwright.sync_api import sync_playwright
import json
out=Path(__file__).resolve().parents[1]/'docs/v1.5/qa/notice-polish'
out.mkdir(parents=True,exist_ok=True)
reports=[]
with sync_playwright() as p:
 for engine,width in [('chromium',1440),('webkit',390),('chromium',320)]:
  browser=getattr(p,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}))
  context=browser.new_context(viewport={'width':width,'height':844},is_mobile=width<760,has_touch=width<760)
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def press(selector):
   loc=page.locator(selector).first
   loc.tap() if width<760 else loc.click()
  page.goto('http://127.0.0.1:8890/',wait_until='networkidle');page.wait_for_function('!!window.mcDebug')
  page.evaluate('mcDebug.state.money=100;mcDebug.advance(0)')
  press('[data-nav=build]');page.wait_for_selector('[data-buy-guidance=info]')
  assert page.locator('[data-guidance-card=info]').evaluate('e=>getComputedStyle(e,"::after").content') in ['none','normal']
  page.screenshot(path=str(out/f'shop-{engine}-{width}.png'))
  press('[data-buy-guidance=info]');press('#placement-confirm')
  page.wait_for_selector('#toast:not([hidden])')
  assert page.locator('#toast').inner_text()=='消息通知 · 已解锁\n−10 ◆'
  assert page.evaluate('mcDebug.state.money')==90
  assert page.locator('#notification-shell').get_attribute('data-expression')=='smile'
  assert page.locator('#toast,#narrator,#foreground-status').evaluate_all('nodes=>nodes.filter(n=>!n.hidden).length')==1
  page.screenshot(path=str(out/f'receipt-{engine}-{width}.png'))
  # Buying the tracker remains in the same shop and uses the same receipt.
  press('[data-buy-guidance=goals]');press('#placement-confirm')
  assert page.locator('#toast').inner_text()=='目标追踪 · 已解锁\n−20 ◆'
  assert page.locator('#panel').is_visible()
  if width<760:
   press('#panel-expand');page.wait_for_timeout(200)
   assert page.locator('#game').evaluate('e=>e.classList.contains("sheet-expanded")')
   assert page.locator('#toast').is_visible()
   notice=page.locator('#notification-shell').bounding_box();close=page.locator('#panel-close').bounding_box()
   assert notice['y']>=close['y']+close['height'],(notice,close)
   page.screenshot(path=str(out/f'fullscreen-{engine}-{width}.png'))
   press('#panel-close')
  # A queued recommendation becomes invalid during a menu, and stays invalid on reload.
  page.evaluate('''async()=>{const {buy}=await import('/src/game.js');const s=mcDebug.state;s.money=10000;for(const id of ['T1','V1','V18','V2'])buy(s,id);s.narrative.current={id:'land',index:0,elapsed:1};mcDebug.save();}''')
  page.reload(wait_until='networkidle');page.wait_for_function('mcDebug.state.narrative.seen.includes("land")')
  assert page.evaluate('mcDebug.state.narrative.current?.id!=="land"')
  # Display a real narrator sentence, then interrupt it with the real foreground state.
  page.evaluate('''async()=>{const {buy}=await import('/src/game.js');const s=mcDebug.state;buy(s,'L1');s.guidance.notices=true;s.community.residents[0].job='musician';mcDebug.advance(0);s.narrative.current={id:'work',index:0,elapsed:0};}''')
  page.wait_for_selector('#narrator:not([hidden])')
  assert page.locator('#notification-shell').get_attribute('data-expression')=='thinking'
  page.evaluate('window.dispatchEvent(new Event("blur"))')
  page.wait_for_selector('#foreground-status:not([hidden])')
  assert page.locator('#notification-shell').get_attribute('data-expression')=='pause'
  assert page.locator('#toast,#narrator,#foreground-status').evaluate_all('nodes=>nodes.filter(n=>!n.hidden).length')==1
  frozen=page.evaluate('mcDebug.state.money');page.wait_for_timeout(350);assert page.evaluate('mcDebug.state.money')==frozen
  page.screenshot(path=str(out/f'pause-{engine}-{width}.png'))
  page.evaluate('window.dispatchEvent(new Event("focus"))');page.wait_for_selector('#narrator:not([hidden])')
  for theme in ['','web-theme-backpack','web-theme-oak','web-theme-redstone','web-theme-end']:
   page.evaluate('''theme=>{if(theme)document.body.dataset.theme=theme;else delete document.body.dataset.theme;mcDebug.state.narrative.current={id:'work',index:0,elapsed:0};}''',theme)
   page.wait_for_timeout(100)
   assert page.locator('#notification-shell').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
   assert page.locator('#narrator p').evaluate('e=>parseFloat(getComputedStyle(e).fontSize)')>=14
  page.screenshot(path=str(out/f'theme-{engine}-{width}.png'))
  # The shared renderer in isolation: direct feedback works without ownership,
  # ambient events are gated, a receipt preempts narration, pause clears the queue.
  result=page.evaluate('''async()=>{
   const {createNotifications}=await import('/src/notifications.js');
   const host=document.createElement('div');host.setAttribute('popover','manual');document.body.append(host);host.innerHTML='<div id="toast" hidden></div><div id="foreground-status" hidden></div>';
   const notices=createNotifications(host,{enabled:false});const n=document.createElement('div');notices.mountNarrator(n);notices.narrate(true,'thinking');
   notices.show('后台事件',{kind:'event'});const gated=!notices.busy;
   notices.show('还差 5 绿宝石',{kind:'error'});const direct=notices.busy&&n.hidden;
   notices.setEnabled(true);notices.show('邮箱落成',{kind:'success',amount:'−20 ◆'});notices.show('等待中的消息',{kind:'event'});
   notices.pause(true);notices.pause(false);const flushed=!notices.busy;
   notices.clear();host.remove();return {gated,direct,flushed};}''')
  assert all(result.values()),result
  assert not errors,errors
  reports.append({'engine':engine,'width':width,'checks':['shop stripe removed','actual info/goal receipts and cost','shop stays open','stale mailbox prompt on reload discarded','single visible notification','pause freezes income and resumes narrator','five themes no overflow','free error feedback and paid event gating','pause drops queue'],'errors':errors})
  context.close();browser.close()
(out/'results.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2))
print(json.dumps(reports,ensure_ascii=False))
