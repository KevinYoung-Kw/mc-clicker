"""Tutorial overlay preserves the current village panel; keyboard choice works."""
import json,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];out=ROOT/'docs/v1.7/qa/opening-guide'
seed=json.loads(subprocess.check_output(['node','--input-type=module','-e','''
import {fresh,buy} from './src/game.js';import {chooseOpening} from './src/opening-guide.js';
import {buyGuidance} from './src/guidance.js';import {NARRATION,IDLE_LINES} from './src/narrative.js';
const s=fresh(42);chooseOpening(s,'first');s.money=10000;
buyGuidance(s,'info');for(const id of ['T1','V1','V18','V2','T7'])buy(s,id);
s.narrative.companionsShown=true;s.narrative.intro='rescued';s.play=200;s.reducedMotion=true;
s.narrative.seen=[...NARRATION,...IDLE_LINES].filter(r=>r.id!=='manual').map(r=>r.id);
console.log(JSON.stringify(s));'''],cwd=ROOT))
report=[]
with sync_playwright() as p:
 for engine,width in [('chromium',1440),('webkit',390),('chromium',320)]:
  mobile=width<760;b=getattr(p,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}))
  try:
   c=b.new_context(viewport={'width':width,'height':844},is_mobile=mobile,has_touch=mobile)
   page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto('http://127.0.0.1:8918/',wait_until='networkidle')
   question=page.locator('#narrator button:has-text("之前玩过")');question.focus();page.keyboard.press('Enter')
   assert page.evaluate('JSON.parse(localStorage.getItem("mc-clicker-world-v2")).narrative.openingChoice')=='returning'
   c.close()
   c=b.new_context(viewport={'width':width,'height':844},is_mobile=mobile,has_touch=mobile)
   c.add_init_script('localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(seed))+')')
   page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto('http://127.0.0.1:8918/',wait_until='networkidle')
   def press(q):
    node=page.locator(q).first
    node.tap() if mobile else node.click()
   press('[data-nav=village]')
   if mobile and page.locator('#panel-expand').get_attribute('aria-expanded')!='true':press('#panel-expand')
   page.wait_for_selector('#narrator button:has-text("打开操作指南")')
   page.screenshot(path=str(out/f'village-reminder-{engine}-{width}.png'))
   before=page.locator('#panel-content').evaluate('e=>e.scrollTop')
   press('#narrator button:has-text("打开操作指南")')
   assert page.locator('#info-tab-guide').get_attribute('aria-selected')=='true'
   press('#modal-close')
   assert page.locator('#panel-title').inner_text()=='村庄'
   assert page.locator('#panel').is_visible()
   if mobile:assert page.locator('#panel-expand').get_attribute('aria-expanded')=='true'
   assert abs(page.locator('#panel-content').evaluate('e=>e.scrollTop')-before)<2
   # Existing subtitle lanes keep a 700 ms sentence gap before collapsing.
   page.wait_for_selector('#panel-notice-slot',state='hidden',timeout=4000)
   page.screenshot(path=str(out/f'village-return-{engine}-{width}.png'))
   assert not errors,errors
   report.append({'engine':engine,'width':width,'keyboardChoice':True,'panelRestored':True,'noBlankNoticeLane':True,'errors':errors})
  finally:b.close()
(out/'panel-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(report)
