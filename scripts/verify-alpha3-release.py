"""Verify the published alpha.3 via real controls and isolated browser saves."""
from pathlib import Path
import argparse,json,re
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
a=argparse.ArgumentParser();a.add_argument('--url',required=True);a.add_argument('--out',required=True);args=a.parse_args()
out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
seed=json.loads((ROOT/'docs/v1.6/qa/stability-baseline/fixtures/peak.json').read_text())
seed.update(money=2e12,savedAt=1,reducedMotion=True)
seed['guidance']['notices']=False
seed['grid']['disabled']=list(set(seed['grid']['disabled'])|{'N6','E3'})
seed['grid']['links'].update(N6=False,E3=False)
reports=[]
with sync_playwright() as p:
 for engine,width in [('chromium',1440),('webkit',390),('chromium',320)]:
  mobile=width<760
  browser=getattr(p,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}))
  context=browser.new_context(viewport={'width':width,'height':844},is_mobile=mobile,has_touch=mobile)
  context.add_init_script('if(!localStorage.getItem("mc-clicker-world-v2"))localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(seed))+')')
  page=context.new_page();errors=[];failed=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('response',lambda r:failed.append(r.url) if r.status>=400 else None)
  def press(q):
   el=page.locator(q).first
   el.tap() if mobile else el.click()
  def saved():return page.evaluate('JSON.parse(localStorage.getItem("mc-clicker-world-v2"))')
  def open_item(id):
   press('[data-nav="atlas"]');press(f'[data-detail="{id}"]')
   if mobile and page.locator('#panel-expand').get_attribute('aria-expanded')!='true':press('#panel-expand')
  page.goto(args.url,wait_until='networkidle');page.wait_for_selector('#world canvas')
  assert 'V1.7.0-alpha.3' in page.title(),page.title()
  assert page.evaluate('typeof window.mcDebug')=='undefined'
  press('#mine');gain=page.locator('#gains .gain').last.inner_text();collect=page.locator('#click-value').inner_text()
  assert not re.search('[万亿京]',gain+collect),(gain,collect)
  assert 'M' in collect or 'B' in collect,collect
  carriers=[]
  for id in ['N6','E3']:
   open_item(id)
   q=f'[data-connection-actions="{id}"] [data-connection-primary]'
   el=page.locator(q);el.scroll_into_view_if_needed()
   assert el.get_attribute('data-run-state')=='paused'
   assert page.locator(f'[data-connection-actions="{id}"] [data-network-action="map"]').count()==0
   press(q)
   page.wait_for_function('id=>{const s=JSON.parse(localStorage.getItem("mc-clicker-world-v2"));return !s.grid.disabled.includes(id)&&s.grid.links[id]!==false}',arg=id)
   page.wait_for_function('id=>document.querySelector(`[data-connection-actions="${id}"] [data-connection-primary]`).dataset.runState==="enabled"',arg=id)
   if mobile:press(q)
   else:el.focus();page.keyboard.press('Enter')
   page.wait_for_function('id=>JSON.parse(localStorage.getItem("mc-clicker-world-v2")).grid.disabled.includes(id)',arg=id)
   page.reload(wait_until='networkidle');page.wait_for_selector('#world canvas')
   assert saved()['grid']['links'].get(id) is not False
   assert id in saved()['grid']['disabled']
   open_item(id);page.locator(q).scroll_into_view_if_needed()
   status=page.locator(f'[data-facility-status="{id}"]').first
   assert status.locator('[data-status-value="time"]').inner_text()=='已暂停'
   page.screenshot(path=str(out/f'{engine}-{width}-{id}.png'))
   press('#panel-close');carriers.append({'id':id,'resume':True,'pause':True,'reload':True,'legacyLinkCleared':True})
  press('[data-nav="village"]');press('[data-village-tab="housing"]');press('[data-home-move]')
  assert page.locator('#placement-cancel').is_visible();press('#placement-cancel');press('#panel-close')
  if not page.locator('#settings').is_visible():press('#hud-more')
  press('#settings');press('#skip-purchase-confirmation-setting')
  preference=page.locator('#skip-purchase-confirmation-setting').is_checked();press('#modal-close')
  page.reload(wait_until='networkidle');page.wait_for_selector('#world canvas')
  assert saved()['skipPurchaseConfirmation']==preference
  panels=[]
  if mobile:
   cdp=context.new_cdp_session(page) if engine=='chromium' else None
   def swipe():
    box=page.locator('.drawer-handle').bounding_box();x=box['x']+box['width']/2;y=box['y']+box['height']/2
    if cdp:
     cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
     for step in range(1,9):cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x,'y':y+step*10}]})
     cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    else:
     page.mouse.move(x,y);page.mouse.down();page.mouse.move(x,y+80,steps=8);page.mouse.up()
    page.wait_for_timeout(200)
   for panel in ['build','village','network']:
    press(f'[data-nav="{panel}"]')
    if page.locator('#panel-expand').get_attribute('aria-expanded')!='true':press('#panel-expand')
    page.wait_for_timeout(1000)
    assert page.locator('#panel-notice-slot').is_hidden()
    swipe();assert page.locator('#panel').is_visible() and page.locator('#panel-expand').get_attribute('aria-expanded')=='false'
    swipe();assert page.locator('#panel').is_hidden() and not page.locator('#stage').evaluate('e=>e.inert')
    assert page.locator('#world canvas').is_visible();panels.append(panel)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  assert not errors and not failed,(errors,failed)
  reports.append({'engine':engine,'width':width,'version':'1.7.0-alpha.3','url':args.url,'money':{'collect':collect,'gain':gain},'carriers':carriers,'housingMove':True,'confirmationPreferenceSaved':True,'mobilePanels':panels,'noDebug':True,'errors':errors,'failedResources':failed})
  context.close();browser.close();print(engine,width,'passed',flush=True)
(out/'report.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2)+'\n')
