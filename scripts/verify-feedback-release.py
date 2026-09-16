"""Mining projection, compact dimension picker and working villagers in real WebGL."""
import argparse,json,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
KEY='mc-clicker-world-v2'
SEED='''
import {residentFixture} from './scripts/resident-fixture.mjs';
import {assignJob} from './src/residents.js';
import {advance} from './src/game.js';
const s=residentFixture();
s.counts.N1=1;s.counts.E2=1;s.endEyes=12;
s.chunks.nether=[{x:0,z:0}];s.chunks.end=[{x:0,z:0}];
for(const [i,job] of ['farmer','rancher','miner','crafter','engineer'].entries())assignJob(s,`resident-${i+1}`,job);
advance(s,35);s.reducedMotion=false;s.skipPurchaseConfirmation=true;
console.log(JSON.stringify(s));
'''
def main():
 p=argparse.ArgumentParser();p.add_argument('--url',required=True);p.add_argument('--label',required=True);p.add_argument('--development',action='store_true');args=p.parse_args()
 out=ROOT/'docs/qa'/('feedback-'+args.label);out.mkdir(parents=True,exist_ok=True)
 seed=json.loads(subprocess.check_output(['node','--input-type=module','-e',SEED],cwd=ROOT,text=True))
 report={'url':args.url,'checks':[],'errors':[]}
 with sync_playwright() as pw:
  browser=pw.chromium.launch(args=['--use-angle=metal'])
  try:
   for width,height in [(390,844),(320,768),(1440,1000)]:
    ctx=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1,has_touch=width<760,is_mobile=width<760)
    ctx.add_init_script('(s=>localStorage.setItem('+json.dumps(KEY)+',JSON.stringify(s)))('+json.dumps(seed)+')')
    page=ctx.new_page();page.on('pageerror',lambda e:report['errors'].append(str(e)))
    page.goto(args.url,wait_until='networkidle');page.wait_for_timeout(750)
    if page.locator('#panel-close').is_visible():page.locator('#panel-close').click()
    page.wait_for_timeout(600)
    if width<760:
     picker=page.locator('#realm-toggle');assert picker.is_visible()
     assert page.locator('#realm-options').is_hidden()
     assert abs(picker.bounding_box()['y']-page.locator('#mission').bounding_box()['y'])<2
     assert page.locator('#mission').bounding_box()['height']<=46
     picker.tap();assert page.locator('#realm-options').is_visible()
     page.screenshot(path=out/f'{width}-realm-menu.png')
     page.keyboard.press('Escape');assert page.locator('#realm-options').is_hidden()
     picker.tap();page.locator('[data-realm="nether"]').click()
     assert picker.inner_text().startswith('下界');assert page.locator('#realm-options').is_hidden()
     picker.tap();page.locator('[data-realm="end"]').click()
     assert picker.inner_text().startswith('末地')
     picker.tap();page.locator('[data-realm="overworld"]').click();page.wait_for_timeout(700)
     page.locator('#mission-toggle').click()
     assert page.locator('#mission-content').is_hidden()
     css=page.locator('#mission').evaluate('(e)=>({bg:getComputedStyle(e).backgroundColor,shadow:getComputedStyle(e).boxShadow})')
     assert css=={'bg':'rgba(0, 0, 0, 0)','shadow':'none'},css
     assert page.locator('#mission-toggle').bounding_box()['width']>=44
     page.screenshot(path=out/f'{width}-collapsed.png')
     page.locator('#mission-toggle').click()
     picker.tap();page.locator('#mine').click();assert page.locator('#realm-options').is_hidden()
     report['checks'].append(f'{width}: one-row tools, three dimensions, Escape/outside dismissal and quiet 44px collapse')
    else:assert page.locator('#realm-toggle').is_hidden() and page.locator('#realm-options').is_visible()
    dev=page.evaluate('!!window.mcDebug');assert dev==args.development, 'unexpected production debug access'
    if dev:
     # Move camera away from its default center. This catches the old 45–55% anchor.
     page.evaluate('()=>{const w=mcDebug.world;w.pan.set(1.3,0,-1.2);w.yaw+=.65;w.zoom=.7;}')
     page.wait_for_timeout(850)
    page.locator('#mine').click();page.wait_for_timeout(70)
    def gain_point():
     return page.locator('#gains .gain').last.evaluate('(e)=>({x:parseFloat(e.style.left)+e.parentElement.getBoundingClientRect().left,y:parseFloat(e.style.top)+e.parentElement.getBoundingClientRect().top})')
    anchor=gain_point()
    if dev:
     expected=page.evaluate('mcDebug.world.miningPoint()')
     assert abs(anchor['x']-expected['x'])<2 and abs(anchor['y']-expected['y'])<2,(anchor,expected)
     page.evaluate('mcDebug.world.pan.x+=1')
     page.wait_for_timeout(150)
     anchor=gain_point();expected=page.evaluate('mcDebug.world.miningPoint()')
     assert abs(anchor['x']-expected['x'])<5 and abs(anchor['y']-expected['y'])<5,(anchor,expected)
     report['checks'].append(f'{width}: live CSS anchor follows actual block during rotated/zoomed/panning camera')
    page.screenshot(path=out/f'{width}-mining.png')
    page.wait_for_timeout(1100);assert page.locator('#gains .gain').count()==0
    page.locator('#mine').focus();page.keyboard.down('Space');page.wait_for_timeout(1350)
    count=page.locator('#gains .gain').count();assert 2<=count<=10,count
    page.keyboard.up('Space');page.wait_for_timeout(1100);assert page.locator('#gains .gain').count()==0
    report['checks'].append(f'{width}: click and held Space generate bounded, expiring mining gains')
    if width==1440:
     # Actual renderer follows simulation worker positions, rather than static poses.
     if dev:page.evaluate('()=>{const w=mcDebug.world;w.focus("V4");w.zoom=.75;}')
     state_source='mcDebug.state' if dev else 'JSON.parse(localStorage.getItem('+json.dumps(KEY)+'))'
     page.wait_for_timeout(700);page.screenshot(path=out/'farm-before.png')
     initial=page.evaluate(state_source+'.community.residents.slice(0,5).map(r=>({id:r.id,x:r.x,z:r.z}))')
     page.wait_for_timeout(11000)
     final=page.evaluate(state_source+'.community.residents.slice(0,5).map(r=>({id:r.id,x:r.x,z:r.z,status:r.status}))')
     assert any(abs(a['x']-b['x'])+abs(a['z']-b['z'])>.4 for a,b in zip(initial,final))
     page.screenshot(path=out/'farm-after.png');report['workers']={'before':initial,'after':final}
     report['checks'].append('living WebGL world: work positions change over actual foreground time')
    ctx.close()
   assert not report['errors'],report['errors'];report['passed']=True
  except Exception as e:
   report['passed']=False;report['failure']=str(e)
   page.screenshot(path=out/'failure.png');raise
  finally:
   (out/'observations.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');browser.close()
 print(json.dumps({'passed':True,'checks':len(report['checks']),'report':str(out/'observations.json')},ensure_ascii=False))
if __name__=='__main__':main()
