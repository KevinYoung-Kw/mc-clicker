"""Progressive opening purchase, three arrivals, settings / information mute, mobile + themes."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
OUT=Path(__file__).resolve().parents[1]/'docs/v1.5.2/qa/companions'
OUT.mkdir(parents=True,exist_ok=True)
results=[]
with sync_playwright() as p:
 for engine,width in [('chromium',1440),('webkit',390),('chromium',320)]:
  browser=getattr(p,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}))
  context=browser.new_context(viewport={'width':width,'height':844},is_mobile=width<760,has_touch=width<760)
  page=context.new_page();page.set_default_timeout(20000);errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:8890/',wait_until='networkidle');page.wait_for_function('!!window.mcDebug')
  assert page.locator('[data-nav=build]').is_visible()
  def press(selector):
   loc=page.locator(selector).first
   loc.tap() if width<760 else loc.click()
  def tool(selector):
   if not page.locator(selector).is_visible():press('#hud-more')
   press(selector)
  def photo(name):
   page.screenshot(path=str(OUT/f'{name}-{engine}-{width}.png'))
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  # New worlds have no top-level tools, including the mobile menu.
  for selector in ['#settings','#share-open','#info-open','#hud-more']: assert page.locator(selector).is_hidden(), selector
  photo('empty-opening')
  page.evaluate('mcDebug.save()');page.reload(wait_until='networkidle');page.wait_for_function('!!window.mcDebug')
  for selector in ['#settings','#share-open','#info-open','#hud-more']: assert page.locator(selector).is_hidden(), selector
  page.evaluate('''()=>{
   window.__arrivals=[];
   new MutationObserver(records=>{for(const record of records){if(record.attributeName==='data-companion-arriving'&&record.oldValue==='true'&&!record.target.hasAttribute('data-companion-arriving'))window.__arrivals.push({id:record.target.id,at:performance.now()});}}).observe(document.querySelector('.hud'),{subtree:true,attributes:true,attributeOldValue:true,attributeFilter:['data-companion-arriving']});
  }''')
  page.evaluate('mcDebug.state.money=100;mcDebug.advance(0)');press('[data-nav=build]')
  if width<760:press('#panel-expand')
  press('[data-buy-guidance=info]');press('#placement-confirm')
  page.wait_for_function('mcDebug.state.narrative.current?.id==="companions" && !document.querySelector("#narrator").hidden')
  for selector in ['#settings','#share-open','#info-open','#hud-more']: assert page.locator(selector).is_hidden(), selector
  photo('introduction')
  page.wait_for_selector('.narrator-companion');page.wait_for_timeout(190);photo('flight-a')
  page.wait_for_timeout(150);photo('flight-b')
  page.wait_for_function('mcDebug.state.narrative.companionsShown && !document.querySelector(".narrator-companion,.companion-arrival")')
  arrivals=page.evaluate('window.__arrivals.filter(x=>["settings","share-open","info-open"].includes(x.id))');assert [x['id'] for x in arrivals]==['settings','share-open','info-open'],arrivals
  assert all(arrivals[i+1]['at']>arrivals[i]['at'] for i in range(2)),arrivals
  assert not page.evaluate('document.querySelector("[data-companion-arriving]")')
  assert not page.evaluate('mcDebug.audio.canPlay() || mcDebug.audio.voices.size || mcDebug.audio.deck'),'no audio before jukebox'
  # Return to world, open the actual paid information page.
  press('#panel-close');tool('#info-open');photo('world-info')
  assert page.locator('#info-news').is_visible()
  press('#info-tab-guide');photo('guide')
  assert page.locator('#info-guide').is_visible() and not page.locator('#info-news').is_visible()
  press('#guidance-notices');page.wait_for_selector('#notification-shell[data-expression=muffled]');page.wait_for_timeout(300);photo('first-mute')
  assert page.locator('#toast .notice-title').inner_text()=='呜——！'
  assert page.locator('[data-narrator-avatar] [data-expression=muffled]').count()==1
  assert page.locator('#guidance-notices').inner_text()=='恢复旁白'
  press('#modal-close');tool('#settings');assert not page.locator('#narration-setting').is_checked()
  press('#narration-setting');press('#narration-setting');page.wait_for_timeout(2000)
  assert page.locator('#notice-center').is_hidden(),'repeated mute stays quiet'
  press('#modal-close');page.evaluate('mcDebug.save()');page.reload(wait_until='networkidle');page.wait_for_function('!!window.mcDebug')
  assert page.evaluate('mcDebug.state.narrative.muteReactionSeen && mcDebug.state.narrative.companionsShown && !mcDebug.state.guidance.notices')
  assert page.locator('.narrator-companion').count()==0
  tool('#info-open');assert page.locator('[data-expression=muffled]').count()>=1
  # Every complete theme is checked at actual screen width, with no new save unlocks.
  for theme in ['web-theme-backpack','web-theme-oak','web-theme-redstone','web-theme-end']:
   page.evaluate('(theme)=>document.body.dataset.theme=theme',theme);photo('info-'+theme)
   assert page.locator('#info-panel').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
  press('#modal-close')
  # An unfinished flight is cancelled on resize and on backgrounding; no DOM leftovers.
  for condition in ['resize','background','reduced']:
   page.evaluate('''async(condition)=>{
    const {fresh}=await import('/src/game.js');const s=fresh();s.guidance.info=true;s.narrative.seen=['rescued'];s.narrative.current={id:'companions',index:0,elapsed:0};s.reducedMotion=condition==='reduced';mcDebug.setState(s);
   }''',condition)
   if condition=='reduced':
    page.wait_for_function('mcDebug.state.narrative.companionsShown');assert page.locator('.narrator-companion').count()==0
   else:
    page.wait_for_selector('.narrator-companion')
    if condition=='resize':page.set_viewport_size({'width':width,'height':820})
    else:page.evaluate('window.dispatchEvent(new Event("blur"))')
    page.wait_for_function('!document.querySelector(".narrator-companion,.companion-arrival")')
    page.evaluate('window.dispatchEvent(new Event("focus"))')
   page.wait_for_timeout(300)
  assert not errors,errors
  results.append({'engine':engine,'width':width,'checks':['fresh and reloaded opening hides all three entries','real info purchase and introduction keep entries hidden','settings then share then narrator arrive and reveal','no early audio','flat guide/news tabs','first mute face and feedback','shared settings preference','reload does not replay','four themes fit','resize/background cleanup','reduced-motion skip'],'arrivals':arrivals,'errors':errors})
  (OUT/'results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n');print(json.dumps(results[-1],ensure_ascii=False),flush=True)
  context.close();browser.close()
