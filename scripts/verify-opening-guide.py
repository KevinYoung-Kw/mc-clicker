"""Opening branches and the real tutorial entry, with isolated production saves."""
import argparse, json, subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
ap=argparse.ArgumentParser();ap.add_argument('--url',default='http://127.0.0.1:8918/');ap.add_argument('--engines',default='chromium:1440,webkit:390,chromium:320');ap.add_argument('--out');args=ap.parse_args()
out=Path(args.out) if args.out else ROOT/'docs/v1.7/qa/opening-guide';out.mkdir(parents=True,exist_ok=True)
seeds=json.loads(subprocess.check_output(['node','--input-type=module','-e','''
import {fresh,buy} from './src/game.js';import {buyGuidance} from './src/guidance.js';
import {chooseOpening} from './src/opening-guide.js';import {NARRATION,IDLE_LINES} from './src/narrative.js';
import {assignJob} from './src/residents.js';
const opening=fresh(42);opening.money=10;
const village=fresh(42);chooseOpening(village,'first');village.money=10000;
buyGuidance(village,'info');for(const id of ['T1','V1','V18','V2','T7','L1'])buy(village,id);
assignJob(village,village.community.residents[0].id,'musician');
village.narrative.companionsShown=true;village.narrative.intro='rescued';village.play=200;
village.narrative.seen=[...NARRATION,...IDLE_LINES].filter(r=>r.id!=='manual').map(r=>r.id);
village.sound=false;village.reducedMotion=true;
const legacy=structuredClone(village);delete legacy.narrative.openingChoice;
delete legacy.narrative.manualVisited;delete legacy.narrative.manualPrompted;
console.log(JSON.stringify({opening,village,legacy}));'''],cwd=ROOT))
reports=[]
with sync_playwright() as p:
 for spec in args.engines.split(','):
  engine,width=spec.split(':');width=int(width);mobile=width<760
  b=getattr(p,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}))
  errors=[];row={'engine':engine,'width':width,'gameURL':args.url}
  def start(seed):
   c=b.new_context(viewport={'width':width,'height':844},is_mobile=mobile,has_touch=mobile)
   c.add_init_script('if(!localStorage.getItem("mc-clicker-world-v2"))localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(seed))+')')
   page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(args.url,wait_until='networkidle');assert 'alpha.8' in page.title()
   assert page.evaluate('typeof mcDebug')=='undefined'
   return c,page
  def press(q):
   loc=page.locator(q).first
   loc.tap() if mobile else loc.click()
  def saved():return page.evaluate('JSON.parse(localStorage.getItem("mc-clicker-world-v2"))')
  def shot(name):page.screenshot(path=str(out/f'{name}-{engine}-{width}.png'))
  def tool(q):
   if not page.locator(q).is_visible():press('#hud-more')
   press(q)
  try:
   # First-time branch: reload the undecided question, then let capture run normally.
   c,page=start(seeds['opening']);page.wait_for_selector('#narrator .narrator-actions button')
   assert page.locator('#narrator').inner_text().startswith('第一次玩这个游戏吗？');shot('choice')
   page.reload(wait_until='networkidle');press('#narrator button:has-text("第一次玩")')
   assert saved()['narrative']['openingChoice']=='first'
   page.wait_for_selector('#first-shop-hint:not([hidden])',timeout=25000);shot('capture')
   press('#first-shop-hint');assert page.locator('.opening-captive').is_visible()
   press('[data-buy-guidance=info]');press('#placement-confirm')
   page.wait_for_function('!document.querySelector("#info-open").hidden',timeout=25000)
   assert saved()['guidance']['info'] and saved()['money']==0
   page.reload(wait_until='networkidle');assert page.locator('#narrator button:has-text("第一次玩")').count()==0
   row['firstChoiceAndCapture']=True;c.close()

   # Returning branch: no captive product or rescue, with the same paid purchase.
   c,page=start(seeds['opening']);press('#narrator button:has-text("之前玩过")')
   assert saved()['narrative']['openingChoice']=='returning'
   press('[data-nav=build]');assert page.locator('.opening-captive').count()==0
   assert '被商城抓' not in page.locator('[data-guidance-card=info]').inner_text();shot('returning-shop')
   press('[data-buy-guidance=info]');press('#placement-confirm')
   assert saved()['guidance']['info'] and saved()['money']==0
   page.wait_for_timeout(5000)
   assert not page.locator('#narrator').is_visible()
   tool('#settings');assert page.locator('#purchase-confirmation-setting').is_checked()
   press('#modal-close');page.reload(wait_until='networkidle')
   assert saved()['narrative']['intro']=='skipped';assert page.locator('#narrator button:has-text("第一次玩")').count()==0
   row['returningPaidPurchaseAndNoStory']=True;c.close()

   # Already working: required reminder still arrives; user can continue playing.
   c,page=start(seeds['village']);page.wait_for_selector('#narrator button:has-text("打开操作指南")')
   page.wait_for_selector('.tutorial-entry-highlight');shot('reminder')
   before=saved()['money'];press('#mine')
   page.wait_for_timeout(600)
   assert saved()['narrative']['manualVisited']==False
   assert not page.locator('#modal').evaluate('e=>e.open')
   press('#narrator button:has-text("打开操作指南")')
   assert page.locator('#info-tab-guide').get_attribute('aria-selected')=='true'
   assert page.locator('.manual-page:not([hidden])').get_attribute('aria-label')=='村庄与岗位'
   assert saved()['narrative']['manualVisited']==True
   assert page.locator('#modal').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
   assert page.locator('#info-tab-guide').bounding_box()['y']>=0
   shot('guide');press('#modal-close')
   page.reload(wait_until='networkidle');page.wait_for_timeout(1500)
   assert not page.locator('#manual-entry-hint').is_visible()
   assert page.locator('#narrator button:has-text("打开操作指南")').count()==0
   row['assignedVillagerStillReminded']=True;row['openWithoutReadingCompletes']=True;c.close()

   # Ignoring the subtitle keeps a small real entry cue; mobile menu points to Info.
   c,page=start(seeds['village']);page.wait_for_selector('#manual-entry-hint:not([hidden])',timeout=20000)
   cue=page.locator('#manual-entry-hint').bounding_box();assert cue['x']>=0 and cue['x']+cue['width']<=width
   shot('entry-cue')
   if mobile:
    assert 'tutorial-entry-highlight' in page.locator('#hud-more').get_attribute('class')
    press('#hud-more');page.wait_for_selector('#info-open.tutorial-entry-highlight')
    shot('menu-cue')
   press('#info-open')
   assert page.locator('#info-tab-guide').get_attribute('aria-selected')=='true'
   assert saved()['narrative']['manualVisited']==True
   row['realEntryAndMobileMenu']=True;c.close()

   c,page=start(seeds['legacy']);page.wait_for_timeout(1800)
   assert saved()['narrative']['openingChoice']=='legacy'
   assert page.locator('#narrator .narrator-actions button').count()==0
   row['legacyNoReplay']=True;c.close()
   assert not errors,errors;row['errors']=errors;reports.append(row)
   print(row,flush=True)
  except Exception:
   shot('failure');raise
  finally:b.close()
(out/'browser-report.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2)+'\n')
