"""Built/public V1.3.2: interact only through UI, with isolated fixture saves."""
from pathlib import Path
import json, sys
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'docs/qa'/sys.argv[2];OUT.mkdir(parents=True,exist_ok=True)
seed=json.loads((ROOT/'docs/qa/v13/fixture.json').read_text());seed['reducedMotion']=True
url=sys.argv[1];results=[]
with sync_playwright() as p:
 for engine,width in [('chromium',1440),('webkit',390),('chromium',320)]:
  browser=getattr(p,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}))
  ctx=browser.new_context(viewport={'width':width,'height':960 if width>760 else 844},is_mobile=width<760,has_touch=width<760)
  page=ctx.new_page(); errors=[];failed=[]
  page.on('pageerror',lambda e:errors.append(str(e)));page.on('response',lambda r:failed.append(r.url) if r.status>=400 else None)
  page.add_init_script('if(!localStorage.getItem("mc-clicker-world-v2"))localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(seed))+');')
  page.goto(url,wait_until='networkidle');page.wait_for_selector('#mine');assert page.evaluate('typeof mcDebug')=='undefined'
  def click(loc):loc.tap() if width<760 else loc.click()
  def choose(selector,text):
   click(page.locator(selector).locator('..').get_by_role('combobox'))
   click(page.get_by_role('option').filter(has_text=text).first)
  def saved():return page.evaluate('JSON.parse(localStorage.getItem("mc-clicker-world-v2"))')
  click(page.locator('[data-nav="village"]'));click(page.locator('.management-tabs [data-village-tab="residents"]'))
  assert '招募' in page.locator('.roster-top').inner_text()
  click(page.locator('[data-person="resident-1"]'));page.locator('.resident-name').scroll_into_view_if_needed()
  assert page.locator('.resident-name [data-person-focus]').is_visible()
  page.screenshot(path=OUT/f'{engine}-{width}-resident.png')
  choose('[data-assign]','农民');assert saved()['community']['residents'][0]['job']=='farmer'
  name='麦田守望者';page.locator('[data-rename-input]').fill(name);click(page.locator('[data-rename]'))
  assert page.locator('.resident-locate').get_attribute('aria-label')=='定位'+name
  choose('[data-study]','物流');assert page.locator('[data-train]').get_attribute('data-skill')=='hauling'
  # Background panel rebuilds must not erase the open selector.
  click(page.locator('[data-assign]').locator('..').get_by_role('combobox'))
  page.screenshot(path=OUT/f'{engine}-{width}-menu.png');page.locator('[data-assign]').locator('..').get_by_role('combobox').press('Escape')
  click(page.locator('.resident-locate'));assert page.locator('#panel').is_hidden() or not page.locator('#game').evaluate('e=>e.classList.contains("panel-open")')
  page.reload(wait_until='networkidle');click(page.locator('[data-nav="village"]'));click(page.locator('.management-tabs [data-village-tab="residents"]'));click(page.locator('[data-person="resident-1"]'))
  assert page.locator('.resident-name h3').inner_text()==name
  assert page.locator('[data-assign]').input_value()=='farmer'
  click(page.locator('[data-village-tab="helpers"]'));click(page.locator('[data-person="golem-1"]'));choose('[data-golem-mode]','只搬货物');click(page.locator('[data-route-save]'))
  assert saved()['community']['golems'][0]['mode']=='cargo'
  click(page.locator('[data-nav="network"]'));click(page.locator('[data-industry-tab="logistics"]'));choose('[data-option="priority"]','优先运输');assert saved()['priority']=='logistics'
  choose('[data-option="dispatch"]','清理积压');assert saved()['dispatch']=='clear'
  if width<760:click(page.locator('#hud-more'))
  click(page.locator('#settings'));assert 'V1.3.2' in page.locator('#modal-content').inner_text();click(page.locator('#basic-help'));page.screenshot(path=OUT/f'{engine}-{width}-help.png')
  # Mail copy and claim controls remain visible in the expanded mobile reader.
  click(page.locator('#info-mailbox'));click(page.locator('[data-mail-open]').first)
  assert '领取时每秒收入' in page.locator('[data-mail-reward-formula]').inner_text()
  assert page.locator('[data-mail-claim]').is_visible()
  page.locator('.mail-letter img').first.evaluate('(img) => img.decode()')
  page.screenshot(path=OUT/f'{engine}-{width}-mail.png')
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  assert not errors,errors;assert not failed,failed
  results.append(dict(engine=engine,width=width,version='1.3.2',noDebug=True,assignmentAndRenamePersist=True,golemAndNetwork=True,mailAndHelp=True,errors=errors,failed=failed));print(engine,width,'passed',flush=True)
  ctx.close();browser.close()
(OUT/'resident-browser-report.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
