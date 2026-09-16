"""Real village housing controls on desktop Chromium and mobile Chromium/WebKit."""
from pathlib import Path
import argparse,json,subprocess
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://127.0.0.1:8890/');parser.add_argument('--out',default='docs/v1.6/qa/housing');parser.add_argument('--version',default='1.6.0-alpha.2');args=parser.parse_args();out=ROOT/args.out;out.mkdir(parents=True,exist_ok=True)
def fixture(legacy=False):
 code='''import {fresh,buy} from './src/game.js';import {buyGuidance} from './src/guidance.js';const s=fresh();s.money=5000;for(const id of ['T1','V1','V18'])buy(s,id);buyGuidance(s,'info');'''
 if legacy:code="import {residentFixture} from './scripts/resident-fixture.mjs';const s=residentFixture();delete s.housing;s.money=1e8;"
 code+="s.narrative.companionsShown=true;s.narrative.intro='released';s.guidance.notices=false;s.savedAt=1;console.log(JSON.stringify(s));"
 return json.loads(subprocess.check_output(['node','--input-type=module','-e',code],cwd=ROOT))
reports=[]
with sync_playwright() as p:
 for engine,width in [('chromium',1440),('webkit',390),('chromium',320)]:
  browser=getattr(p,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}))
  for legacy in [False,True]:
   context=browser.new_context(viewport={'width':width,'height':900 if width>700 else 844},is_mobile=width<760,has_touch=width<760)
   seed=fixture(legacy);context.add_init_script('if(!localStorage.getItem("mc-clicker-world-v2"))localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(seed))+')')
   page=context.new_page();errors=[];failed=[];page.on('pageerror',lambda e:errors.append(e.stack));page.on('response',lambda r:failed.append(r.url) if r.status>=400 else None)
   def press(selector):
    loc=page.locator(selector).first
    loc.tap() if width<760 else loc.click()
   def save():return page.evaluate('JSON.parse(localStorage.getItem("mc-clicker-world-v2"))')
   def wait_saved(expr):page.wait_for_function('(s)=>'+expr,arg=None)
   def place_visible():
    page.wait_for_timeout(450);box=page.locator('#world canvas').bounding_box();pts=[]
    for y in range(2,24):
     for x in range(1,24):pts.append((box['x']+box['width']*x/24,box['y']+box['height']*y/24))
    pts.sort(key=lambda pt:(pt[0]-box['x']-box['width']/2)**2+(pt[1]-box['y']-box['height']/2)**2)
    for x,y in pts:
     if not page.evaluate('p=>document.elementFromPoint(p.x,p.y)===document.querySelector("#world canvas")',{'x':x,'y':y}):continue
     page.touchscreen.tap(x,y) if width<760 else page.mouse.click(x,y)
     if page.locator('#placement-confirm').is_enabled():return
    raise AssertionError('No valid visible home position')
   try:
    page.goto(args.url,wait_until='networkidle');page.wait_for_selector('#world canvas');assert not page.locator('#fallback').is_visible()
    if not legacy:
     press('[data-nav="build"]');press('[data-buy="V2"]');press('#placement-confirm');assert save()['counts']['V2']==1;assert not save()['housing']['starterClaimed']
    press('[data-nav="village"]');press('[data-village-tab="housing"]')
    page.locator('.housing-gift img').wait_for();page.wait_for_function('document.querySelector(".housing-gift img").naturalWidth>0')
    before_count=len(save()['housing']['homes']);before_names=[r['name'] for r in save()['community']['residents']]
    assert page.locator('[data-home-claim]').inner_text()=='0 ◆ 领取'
    page.screenshot(path=str(out/f'gift-{engine}-{width}-{"legacy" if legacy else "new"}.png'))
    press('[data-home-claim]');assert save()['housing']['starterClaimed'];assert save()['housing']['stored']['oak']==1;assert page.locator('#placement-confirm').is_disabled()
    # Painting may update affordances but must never rotate the preview itself.
    initial=page.locator('#placement-detail').inner_text();page.wait_for_timeout(1100);assert page.locator('#placement-detail').inner_text()==initial
    press('#placement-cancel');assert len(save()['housing']['homes'])==before_count
    page.reload(wait_until='networkidle');press('[data-nav="village"]');press('[data-village-tab="housing"]');assert page.locator('[data-home-claim]').count()==0
    press('[data-home-build="oak"]');place_visible();page.screenshot(path=str(out/f'preview-{engine}-{width}-{"legacy" if legacy else "new"}.png'));press('#placement-confirm')
    page.wait_for_function('n=>JSON.parse(localStorage.getItem("mc-clicker-world-v2")).housing.homes.length===n',arg=before_count+1)
    placed=save()['housing'];new_home=placed['homes'][-1];assert placed['stored']['oak']==0;assert new_home['type']=='oak';assert placed['assignments']
    page.wait_for_timeout(600);page.screenshot(path=str(out/f'built-{engine}-{width}-{"legacy" if legacy else "new"}.png'))
    press('[data-home-tab="build"]');assert page.locator('[data-home-product]').count()==8
    for im in page.locator('.housing-catalog img').all():im.scroll_into_view_if_needed()
    page.wait_for_function('[...document.querySelectorAll(".housing-catalog img")].every(e=>e.naturalWidth===192)')
    if not legacy:
     assert page.locator('[data-home-product="porch"] [data-home-reason]').inner_text()=='需要水井'
     assert page.locator('[data-home-product="moss"] [data-home-reason]').inner_text()=='需要麦田 Lv.2'
     assert page.locator('[data-home-product="tower"] button').is_disabled()
    else:
     assert page.locator('[data-home-product="tower"] button').is_enabled()
     press('[data-home-build="tower"]');place_visible();press('#placement-confirm');assert save()['housing']['homes'][-1]['type']=='tower'
    press('[data-home-tab="homes"]');press('[data-home-move="'+new_home['id']+'"]');press('#placement-rotate');place_visible();press('#placement-confirm')
    after=save()['housing'];moved=next(h for h in after['homes'] if h['id']==new_home['id']);assert moved['rotation']==1
    assert [r['name'] for r in save()['community']['residents']]==before_names
    assert after['assignments']==placed['assignments'] or legacy
    press('[data-nav="build"]');page.reload(wait_until='networkidle');press('[data-nav="village"]');press('[data-village-tab="housing"]')
    final=save()['housing'];assert [(h['id'],h['type'],h['x'],h['z'],h['rotation']) for h in final['homes']]==[(h['id'],h['type'],h['x'],h['z'],h['rotation']) for h in after['homes']]
    assert not page.locator('#fallback').is_visible();assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
    assert not errors,errors;assert not failed,failed
    reports.append({'engine':engine,'width':width,'legacy':legacy,'version':args.version,'homes':len(final['homes']),'errors':errors,'failedResources':failed,'checks':['free claim','cancel','reload entitlement','manual placement preview','build','occupancy','eight type catalogue','facility gates','move and rotate','menu switching','persisted addresses','no horizontal overflow']})
    print(engine,width,'legacy' if legacy else 'new','passed',flush=True)
   except Exception:
    print('PAGE ERRORS',errors,flush=True);page.screenshot(path=str(out/f'failure-{engine}-{width}-{legacy}.png'));(out/'failure.txt').write_text(page.locator('body').inner_text());raise
   finally:context.close()
  browser.close()
(out/'report.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2)+'\n')
