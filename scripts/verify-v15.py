from pathlib import Path
from playwright.sync_api import sync_playwright
import json
out=Path(__file__).resolve().parents[1]/'docs/v1.5/qa';out.mkdir(parents=True,exist_ok=True)
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
  assert not page.locator('#income-open').is_visible()
  assert not page.locator('.hud .site-link').is_visible()
  assert not page.locator('#info-open').is_visible()
  assert page.evaluate('!document.querySelector("#share-open").hidden')
  page.screenshot(path=str(out/f'v15-opening-{engine}-{width}.png'))
  for _ in range(10):press('#mine')
  page.wait_for_selector('#narrator:not([hidden])')
  assert page.locator('#narrator p').inner_text().startswith('救命')
  before=page.evaluate('mcDebug.state.money');press('#mine');assert page.evaluate('mcDebug.state.money')>before
  # A sentence keeps its place when the page is blurred, even if several seconds elapse.
  page.evaluate('window.dispatchEvent(new Event("blur"))')
  frozen=page.evaluate('JSON.stringify([mcDebug.state.narrative.current?.id,mcDebug.state.narrative.current?.index,mcDebug.state.narrative.current?.elapsed])')
  page.wait_for_timeout(1200);assert frozen==page.evaluate('JSON.stringify([mcDebug.state.narrative.current?.id,mcDebug.state.narrative.current?.index,mcDebug.state.narrative.current?.elapsed])')
  page.evaluate('window.dispatchEvent(new Event("focus"))')
  page.screenshot(path=str(out/f'v15-narration-{engine}-{width}.png'))
  press('[data-nav=build]');page.wait_for_selector('[data-buy-guidance=info]')
  assert page.locator('[data-shop-balance]').inner_text()
  before=page.evaluate('mcDebug.state.money');press('[data-buy-guidance=info]');press('#placement-cancel')
  assert page.evaluate('mcDebug.state.money')==before
  press('[data-nav=build]') if not page.locator('[data-buy-guidance=info]').is_visible() else None
  press('[data-buy-guidance=info]');press('#placement-confirm')
  assert page.evaluate('mcDebug.state.guidance.info')
  assert page.evaluate('mcDebug.state.narrative.confirmations')==1
  assert page.evaluate('mcDebug.state.money')==before-10
  assert not page.locator('#income-open').is_visible()
  assert not page.evaluate('!!mcDebug.audio.ctx')
  # Refresh after a successful purchase preserves it and never sells it twice.
  page.reload(wait_until='networkidle');page.wait_for_function('mcDebug.state.guidance.info')
  press('[data-nav=build]')
  assert page.locator('[data-buy-guidance=info]').count()==0
  # Fund only the target item; keep the real purchase/confirmation UI.
  page.evaluate('mcDebug.state.money=20;mcDebug.advance(0)')
  press('[data-buy-guidance=goals]');press('#placement-confirm')
  assert page.evaluate('mcDebug.state.guidance.goals')
  assert page.locator('#mission').is_visible()
  assert page.evaluate('mcDebug.state.money')==0
  # Use existing production APIs to construct a saved village, then test the new UI on it.
  page.evaluate('''async()=>{const {buy}=await import('/src/game.js');const s=mcDebug.state;s.money=100000;for(const id of ['T1','V1','V18','V2','T7']){const r=buy(s,id);if(!r.ok)throw Error(id+JSON.stringify(r));}s.narrative.current=null;s.narrative.seen=['egg:private-stash','rescued','friend','goals','pick','land','mail','resident','bench'];s.narrative.gap=0;mcDebug.advance(0);}''')
  press('[data-family=features]')
  press('[data-buy-guidance=counter]');press('#placement-confirm');assert page.locator('#income-open').is_visible()
  press('[data-buy-guidance=nameplate]');press('#placement-confirm');assert page.evaluate('!document.querySelector(".hud .site-link").hidden')
  press('[data-nav=build]')
  page.wait_for_function('!document.querySelector("#toast").classList.contains("visible")')
  # Seed midgame eligibility and the random clock; choice and collection use real pointer input.
  page.evaluate('''async()=>{const {advanceEasterEggs}=await import('/src/easter-eggs.js');const s=mcDebug.state;s.play=1080;s.counts.M5=1;s.narrative.quiet=60;s.narrative.gap=100;s.easterEggs.attemptIn=0;advanceEasterEggs(s,1,{quiet:true,random:()=>0});mcDebug.advance(0);}''')
  page.get_by_role('button',name='找找看',exact=True).wait_for(state='visible')
  page.screenshot(path=str(out/f'v15-activity-{engine}-{width}.png'))
  page.get_by_role('button',name='找找看',exact=True).tap() if width<760 else page.get_by_role('button',name='找找看',exact=True).click()
  page.wait_for_function('mcDebug.world.easterEggView.targets.length===1')
  page.evaluate('mcDebug.save()');page.reload(wait_until='networkidle');page.wait_for_function('mcDebug.world.easterEggView.targets.length===1')
  # Focus the world using the actual hint action inside information, without collecting through a debug API.
  if width<760:press('#hud-more')
  press('#info-open');press('[data-egg-hint=private-stash]')
  page.wait_for_timeout(900)
  page.screenshot(path=str(out/f'v15-stash-{engine}-{width}.png'))
  point=page.evaluate('''async()=>{const T=await import('/node_modules/three/build/three.module.js');const w=mcDebug.world;const g=w.easterEggView.targets[0];const p=g.getWorldPosition(new T.Vector3());p.y+=.22;p.project(w.camera);const r=w.renderer.domElement.getBoundingClientRect();return {x:r.x+(p.x+1)/2*r.width,y:r.y+(1-p.y)/2*r.height};}''')
  page.touchscreen.tap(point['x'],point['y']) if width<760 else page.mouse.click(point['x'],point['y'])
  page.wait_for_function('mcDebug.state.easterEggs.entries["private-stash"].status==="claimed"')
  assert page.evaluate('mcDebug.state.easterEggIncome')==30
  page.reload(wait_until='networkidle');page.wait_for_function('mcDebug.state.easterEggIncome===30')
  assert page.evaluate('mcDebug.world.easterEggView.targets.length')==0
  # Every existing theme: the reviewed settings sentence fits without overflow or focus loss.
  for theme in ['','web-theme-backpack','web-theme-oak','web-theme-redstone','web-theme-end']:
   page.evaluate('''theme=>{if(theme)document.body.dataset.theme=theme;else delete document.body.dataset.theme;const n=mcDebug.state.narrative;n.current={id:'confirmations',index:1,elapsed:0};n.confirmations=10;n.seen=n.seen.filter(x=>x!=='confirmations');n.gap=0;mcDebug.state.skipPurchaseConfirmation=false;mcDebug.state.guidance.notices=true;}''',theme)
   page.wait_for_selector('#narrator:not([hidden])');page.wait_for_timeout(100)
   sizes=page.locator('#narrator').evaluate('(e)=>({h:e.offsetHeight,w:e.offsetWidth,sw:e.scrollWidth,font:parseFloat(getComputedStyle(e.querySelector("p")).fontSize)})')
   assert sizes['sw']<=sizes['w']+1 and sizes['font']>=14,sizes
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
   if theme=='web-theme-end':page.screenshot(path=str(out/f'v15-theme-{engine}-{width}.png'))
  if width<760:
   page.evaluate("mcDebug.state.narrative.current={id:'idle-shop',index:0,elapsed:0};mcDebug.state.narrative.seen=mcDebug.state.narrative.seen.filter(id=>id!=='idle-shop')")
   press('[data-nav=build]');press('#panel-expand');page.wait_for_timeout(500)
   assert page.locator('#game').evaluate('e=>e.classList.contains("sheet-expanded")')
   assert not page.locator('#narrator').is_visible()
   frozen=page.evaluate('JSON.stringify([mcDebug.state.narrative.current?.id,mcDebug.state.narrative.current?.index,mcDebug.state.narrative.current?.elapsed])')
   page.wait_for_timeout(1200);assert frozen==page.evaluate('JSON.stringify([mcDebug.state.narrative.current?.id,mcDebug.state.narrative.current?.index,mcDebug.state.narrative.current?.elapsed])')
   press('#panel-close');page.wait_for_selector('#narrator:not([hidden])')
  # Bought notification shells decorate the same narrator, keeping readable semantics.
  for skin in ['paper','stone','signal','crystal']:
   page.evaluate('skin=>document.body.dataset.notice="web-notice-"+skin',skin)
   assert page.locator('#narrator p').evaluate('e=>parseFloat(getComputedStyle(e).fontSize)')>=14
  assert not errors,errors
  reports.append({'browser':engine,'width':width,'checks':['minimal opening and free share','real purchase and cancellation','foreground-only sentence progress','ownership persists after reload','counter and nameplate appear after purchase','random event offer and opt-in','real 3D stash click and reload-safe single reward','five theme widths and 14px subtitles',*(['phone full-screen management suspends narration'] if width<760 else []),'four purchased notification skins'],'errors':errors})
  context.close();browser.close()
(out/'browser.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2))
print(json.dumps(reports,ensure_ascii=False,indent=2))
