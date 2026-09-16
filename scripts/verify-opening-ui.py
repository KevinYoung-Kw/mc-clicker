"""Isolated saves only: capture, storefront, centering and pixel animation QA."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json

out=Path(__file__).resolve().parents[1]/'docs/v1.5/qa/opening-ui'
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
  def shot(name):page.screenshot(path=str(out/f'{name}-{engine}-{width}.png'))
  def center_check():
   hint=page.locator('#first-shop-hint').bounding_box();button=page.locator('[data-nav=build]').bounding_box()
   assert abs(hint['x']+hint['width']/2-button['x']-button['width']/2)<2,(hint,button)
   assert hint['y']+hint['height']<button['y'] and hint['x']>=0
  page.goto('http://127.0.0.1:8890/',wait_until='networkidle');page.wait_for_function('!!window.mcDebug')
  page.evaluate('mcDebug.state.money=10;mcDebug.advance(0)')
  page.wait_for_selector('#narrator:not([hidden])');shot('calling')
  # Let the real final-line completion run, without waiting through the reading time.
  page.evaluate("mcDebug.state.narrative.current={id:'rescue',index:1,elapsed:9}")
  page.wait_for_selector('.narrator-capture');page.wait_for_timeout(140);shot('capture')
  page.wait_for_selector('.narrator-capture',state='detached')
  page.wait_for_selector('#first-shop-hint:not([hidden])');center_check();shot('hint')
  assert page.locator('.shop-captive-token').is_visible()
  page.evaluate('mcDebug.save()');page.reload(wait_until='networkidle')
  page.wait_for_selector('#first-shop-hint:not([hidden])');center_check()
  assert page.locator('.narrator-capture').count()==0
  # Test safe repositioning when the viewport changes (including landscape).
  page.set_viewport_size({'width':max(320,width-35),'height':740});page.wait_for_timeout(150);center_check()
  page.set_viewport_size({'width':width,'height':844});page.wait_for_timeout(150)
  press('#first-shop-hint');page.wait_for_selector('.opening-captive');page.wait_for_timeout(450)
  assert page.locator('.opening-product').count()==1
  assert page.locator('.construction-tabs').count()==0
  assert page.locator('#first-shop-hint').is_hidden();shot('captive-shop')
  press('#first-shop-all');page.wait_for_selector('.construction-tabs')
  press('[data-family=features]');press('#first-shop-back');page.wait_for_selector('.opening-captive')
  press('[data-buy-guidance=info]');press('#placement-confirm');page.wait_for_timeout(150)
  assert page.evaluate('mcDebug.state.money')==0
  assert page.locator('.opening-captive').count()==0
  assert page.locator('.opening-product').count()==2
  assert page.locator('[data-buy-guidance=goals]').get_attribute('data-purchase-state')=='short'
  assert page.locator('[data-guidance-card=goals] [data-purchase-reason]').is_visible()
  assert page.locator('.shop-captive-token').is_hidden()
  assert page.locator('.narrator-capture').count()==0
  face=page.locator('#notification-shell .notification-avatar').bounding_box()
  body=page.locator('#notification-shell .notification-content').bounding_box()
  assert abs(face['y']+face['height']/2-body['y']-body['height']/2)<2
  shot('rescued-shop')
  # Pixel blink closes briefly, opens again, and respects reduced motion.
  blink=page.evaluate('''()=>{
   const f=document.querySelector('#notification-shell .notice-face'),a=f.querySelector('.notice-eyes-open'),b=f.querySelector('.notice-eyes-closed');
   for(const n of [a,b])for(const anim of n.getAnimations()){anim.pause();anim.currentTime=2850;}
   const closed=[getComputedStyle(a).opacity,getComputedStyle(b).opacity];
   for(const n of [a,b])for(const anim of n.getAnimations())anim.currentTime=3100;
   const open=[getComputedStyle(a).opacity,getComputedStyle(b).opacity];
   document.body.classList.add('reduce-motion');const reduced=[getComputedStyle(a).animationName,getComputedStyle(a).opacity,getComputedStyle(b).opacity];
   document.body.classList.remove('reduce-motion');return {closed,open,reduced};}''')
  assert blink=={'closed':['0','1'],'open':['1','0'],'reduced':['none','1','0']},blink
  page.evaluate('mcDebug.state.money=100;mcDebug.advance(0)')
  for theme in ['','web-theme-backpack','web-theme-oak','web-theme-redstone','web-theme-end']:
   page.evaluate('theme=>document.body.dataset.theme=theme',theme)
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
   assert page.locator('.opening-stock').evaluate('e=>e.scrollWidth<=e.clientWidth')
   for button in page.locator('.opening-buy').all():assert button.bounding_box()['height']>=44
  page.evaluate("document.body.dataset.theme=''");shot('available-shop')
  # Close and return to the same flat shop. No auto close after buying the next feature.
  press('#panel-close');press('[data-nav=build]');press('[data-buy-guidance=goals]');press('#placement-confirm')
  assert page.locator('.opening-store').is_visible()
  assert page.evaluate('mcDebug.state.guidance.goals')
  if width<760:
   press('#panel-expand');page.wait_for_timeout(350)
   assert page.locator('#panel-close').is_visible();shot('full-shop')
  # A fresh introduction interrupted by a purchase or backgrounding leaves no sprite behind.
  page.reload(wait_until='networkidle')
  page.evaluate("const s=mcDebug.state;s.guidance.info=false;s.narrative.intro='calling';s.narrative.current={id:'rescue',index:1,elapsed:9};mcDebug.advance(0)")
  page.wait_for_selector('.narrator-capture');page.evaluate('window.dispatchEvent(new Event("blur"))')
  page.wait_for_selector('.narrator-capture',state='detached')
  page.wait_for_timeout(1200);assert page.locator('.narrator-capture').count()==0
  page.evaluate('window.dispatchEvent(new Event("focus"))')
  assert not errors,errors
  reports.append({'engine':engine,'width':width,'checks':['actual intro capture','centered persistent hint and resize','refresh does not replay capture','full catalogue and back','real purchase costs and deficit','flat store stays open','aligned face and text','pixel blink and reduced motion','five themes and 44px targets','background cancels capture'],'errors':errors})
  context.close();browser.close()
(out/'results.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2))
print(json.dumps(reports,ensure_ascii=False))
