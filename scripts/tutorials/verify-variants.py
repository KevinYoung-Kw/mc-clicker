"""Production checks: early unlocks, free help, dark theme and theme selector keyboard."""
import argparse,json,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];a=argparse.ArgumentParser();a.add_argument('--url',default='http://127.0.0.1:8918/');a.add_argument('--out',default='docs/v1.7/qa/tutorials/variants');args=a.parse_args();out=ROOT/args.out;out.mkdir(parents=True,exist_ok=True)
early=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {fresh} from './src/game.js';const s=fresh(42);s.counts.T1=1;s.guidance.info=true;s.guidance.notices=false;s.narrative.intro='released';s.narrative.companionsShown=true;s.narrative.legacy=true;s.reducedMotion=true;console.log(JSON.stringify(s))"],cwd=ROOT))
dark=json.loads((ROOT/'docs/v1.6/qa/stability-baseline/fixtures/peak.json').read_text());dark['webAppearance'].update(catalogTier=3,owned={'web-theme-end':True},equipped={'theme':'web-theme-end'});dark['guidance']['notices']=False;dark['narrative'].update(intro='released',companionsShown=True,legacy=True)
report=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--use-angle=metal'])
 for name,seed in [('early',early),('dark',dark),('free',{**early,'guidance':{**early['guidance'],'info':False}})]:
  c=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);c.add_init_script('localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(seed))+')');page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(args.url,wait_until='networkidle');assert page.evaluate('typeof mcDebug')=='undefined';page.locator('#hud-more').tap()
  page.locator('#quick-help' if name=='free' else '#info-open').tap()
  if name!='free':page.locator('#info-tab-guide').tap()
  page.locator('.manual-page:visible img').evaluate('e=>e.decode()')
  if name in ['early','free']:
   assert page.locator('#guide-topic option').count()==3
   assert '铁镐可解锁长按' in page.locator('[data-control-guide]').inner_text()
   assert page.locator('.tutorial-figure img').count()==3
  else:
   assert page.locator('body').get_attribute('data-theme')=='web-theme-end'
  assert page.locator('#modal').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
  page.screenshot(path=str(out/f'{name}-390.png'))
  # Use the shared themed selector's keyboard controls, then cancel an open list.
  trigger=page.locator('.manual-controls .game-select-trigger');trigger.focus();page.keyboard.press('Enter');page.keyboard.press('ArrowDown');page.keyboard.press('Enter');assert page.locator('.manual-page:visible').get_attribute('aria-label')=='购买与建造'
  trigger.focus();page.keyboard.press('Enter');page.keyboard.press('Escape');assert not page.locator('.game-select-menu').count();assert page.locator('#modal').evaluate('e=>e.open')
  page.locator('#modal-close').tap();assert not page.locator('#modal').evaluate('e=>e.open')
  assert not errors,errors;report.append({'case':name,'options':3 if name!='dark' else 11,'keyboard':True,'overflow':False,'errors':errors});c.close()
 browser.close()
(out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(report)
