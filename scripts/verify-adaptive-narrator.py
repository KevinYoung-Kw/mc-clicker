"""Live browser behavior checks. Every scenario uses isolated test storage."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, time
out=Path(__file__).resolve().parents[1]/'docs/v1.5/qa/adaptive-narrator';out.mkdir(parents=True,exist_ok=True)
reports=[]
with sync_playwright() as p:
 for engine,width in [('chromium',1440),('webkit',390),('chromium',320)]:
  browser=getattr(p,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}))
  context=browser.new_context(viewport={'width':width,'height':844},is_mobile=width<760,has_touch=width<760)
  page=context.new_page();page.set_default_timeout(18000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def press(selector):
   loc=page.locator(selector).first
   loc.tap() if width<760 else loc.click()
  def shot(name):
   page.wait_for_timeout(250);page.screenshot(path=str(out/f'{name}-{engine}-{width}.png'))
  def caption(id):
   page.wait_for_function('(id)=>mcDebug.state.narrative.current?.id===id&&!document.querySelector("#narrator").hidden',arg=id)
  page.goto('http://127.0.0.1:8890/',wait_until='networkidle');page.wait_for_function('!!window.mcDebug')
  page.evaluate('mcDebug.state.money=30;mcDebug.advance(0)')
  press('[data-nav=build]')
  if width<760:press('#panel-expand')
  press('[data-buy-guidance=info]');press('#placement-confirm');start=time.monotonic()
  caption('rescued');rescue_at=time.monotonic()-start
  caption('friend');friend_at=time.monotonic()-start;shot('opening-friend')
  assert rescue_at<6 and friend_at<12,(rescue_at,friend_at)
  assert '目标追踪' in page.locator('#narrator').inner_text()
  assert page.locator('[data-buy-guidance=goals]').is_visible()
  if width<760:
   notice=page.locator('#notification-shell').bounding_box();buy=page.locator('[data-buy-guidance=goals]').bounding_box()
   assert notice['y']+notice['height']<=buy['y'],(notice,buy)
  press('[data-buy-guidance=goals]');press('#placement-confirm')
  page.wait_for_timeout(400)
  assert page.evaluate('mcDebug.state.narrative.current?.id!=="friend"')
  if width<760:assert page.locator('#game').evaluate('e=>e.classList.contains("sheet-expanded")')
  # Seed only prerequisites/funds, then purchase three distinct tools through real UI.
  press('#panel-close')
  page.evaluate('''()=>{const s=structuredClone(mcDebug.state);s.money=1e9;s.counts={T1:1,V1:1,V18:1,V2:1,T7:1,M2:1};s.narrative.current=null;s.narrative.seen=['rescued','friend','goals','land','mail','resident','bench'];s.narrative.behavior.purchases=[];mcDebug.setState(s);}''')
  press('[data-nav=build]');press('[data-family=T]')
  if width<760 and not page.locator('#game').evaluate('e=>e.classList.contains("sheet-expanded")'):press('#panel-expand')
  for item in ['T2','T3','T4']:
   press(f'[data-buy={item}]');press('#placement-confirm')
  caption('rush');shot('rush')
  assert '老手' in page.locator('#narrator').inner_text()
  assert page.evaluate('mcDebug.state.narrative.behavior.purchases.filter(p=>/^T[234]$/.test(p.id)).length')==3
  assert page.evaluate('mcDebug.state.counts.T4')==1
  # Inspections produce a different aside, with no purchase/income mutation.
  page.wait_for_function('mcDebug.state.narrative.seen.includes("rush")')
  page.evaluate('''async()=>{const {NARRATION,IDLE_LINES}=await import('/src/narrative.js');const s=mcDebug.state;s.play=100;s.narrative.seen=[...NARRATION,...IDLE_LINES].filter(r=>r.id!=='browse').map(r=>r.id);s.narrative.current=null;s.narrative.silence=10;s.narrative.behavior.rushUntil=0;s.narrative.behavior.inspections=[];}''')
  press('[data-family=all]')
  inspected=[]
  for _ in range(3):
   item=page.locator('#panel-content [data-detail]').evaluate_all('(nodes,seen)=>nodes.map(n=>n.dataset.detail).find(id=>!mcDebug.state.counts[id]&&!seen.includes(id))',inspected)
   assert item is not None
   inspected.append(item);press(f'[data-detail={item}]');press('[data-item-back]')
  caption('browse');shot('browse')
  assert '你慢慢挑' in page.locator('#narrator').inner_text()
  assert page.evaluate('mcDebug.state.narrative.behavior.inspections.length')==3
  assert page.locator('#narrator p').evaluate('e=>parseFloat(getComputedStyle(e).fontSize)')>=14
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  assert not errors,errors
  reports.append({'engine':engine,'width':width,'secondsAfterInfoPurchase':{'rescued':round(rescue_at,2),'friend':round(friend_at,2)},'checks':['real purchases and receipts','opening continues in expanded mobile shop','buying the target cancels its recommendation','real rapid purchases trigger experienced-player response','real inspection clicks trigger browsing response','14px subtitles and no overflow'],'errors':errors})
  context.close();browser.close()
(out/'results.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2))
print(json.dumps(reports,ensure_ascii=False))
