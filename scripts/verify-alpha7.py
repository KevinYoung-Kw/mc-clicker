"""Alpha 7: independent confirmation settings, real site taps and music transport.
Uses isolated saves in production browsers. Never accesses a player's profile.
"""
import argparse,json,subprocess,time
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
ap=argparse.ArgumentParser();ap.add_argument('--url',default='http://127.0.0.1:8918/');ap.add_argument('--out',default='docs/v1.7/qa/alpha7');ap.add_argument('--engines',default='chromium:1440,webkit:390,chromium:320');args=ap.parse_args()
out=ROOT/args.out;out.mkdir(parents=True,exist_ok=True)
seed=json.loads(subprocess.check_output(['node','--input-type=module','-e','''
import {fresh,buy} from './src/game.js';import {buyEarlyGuidance} from './scripts/early-fixture.mjs';import {worldScenery} from './src/layout.js';
const s=fresh(42);s.money=1e8;s.play=1800;s.counts.T1=1;
for(const [x,z] of [[0,0],[1,0],[0,1],[-1,0],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]])buy(s,'V1',{x,z,realm:'overworld'});
buyEarlyGuidance(s);Object.assign(s.counts,{T2:1,T3:1,T4:1,T5:1,V2:1,V20:3,V4:1,M16:1,X1:1,L1:1});
s.placements.V20={x:-5,z:-5,realm:'overworld'};s.placements.V4={x:4,z:-4,realm:'overworld'};s.placements.M16={x:0,z:-5,realm:'overworld'};s.placements.L1={x:4,z:3,realm:'overworld'};
s.garden.cleared=worldScenery(s).filter(p=>p.native).map(p=>p.id);
s.guidance.notices=false;s.guidance.counter=true;s.narrative.companionsShown=true;s.narrative.intro='rescued';s.narrative.legacy=true;s.reducedMotion=true;s.sound=true;s.records.playing=false;
console.log(JSON.stringify(s));'''],cwd=ROOT))
reports=[]
with sync_playwright() as p:
 for spec in args.engines.split(','):
  engine,width=spec.split(':');width=int(width);mobile=width<760
  b=getattr(p,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}))
  c=b.new_context(viewport={'width':width,'height':844},is_mobile=mobile,has_touch=mobile)
  c.add_init_script('if(!localStorage.getItem("mc-clicker-world-v2"))localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(seed))+')')
  c.add_init_script('window.musicPlayers=[];window.Audio=class extends Audio{constructor(...a){super(...a);musicPlayers.push(this)}};')
  page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def press(q):
   loc=page.locator(q).first
   loc.tap() if mobile else loc.click()
  def saved():return page.evaluate('JSON.parse(localStorage.getItem("mc-clicker-world-v2"))')
  def settings():
   if not page.locator('#settings').is_visible():press('#hud-more')
   press('#settings')
  def open_shop():
   if not page.locator('[data-expand-land]').is_visible():press('[data-nav=build]')
   if page.locator('#first-shop-all').count():press('#first-shop-all')
  def facility(id):
   press('[data-nav=atlas]');press(f'[data-detail="{id}"]')
  def shot(name):page.screenshot(path=str(out/f'{name}-{engine}-{width}.png'))
  def choose(done):
   page.wait_for_timeout(250);box=page.locator('#world canvas').bounding_box()
   points=[(box['x']+box['width']*x/20,box['y']+box['height']*y/28) for y in range(2,27) for x in range(1,20)]
   points.sort(key=lambda q:(q[0]-box['x']-box['width']/2)**2+(q[1]-box['y']-box['height']/2)**2)
   for x,y in points:
    if not page.evaluate('p=>document.elementFromPoint(p.x,p.y)===document.querySelector("#world canvas")',{'x':x,'y':y}):continue
    page.touchscreen.tap(x,y) if mobile else page.mouse.click(x,y)
    if done():return
   shot('failed-choice');raise AssertionError('No valid visible site')
  try:
   page.goto(args.url,wait_until='networkidle');assert 'alpha.7' in page.title();assert page.evaluate('typeof mcDebug')=='undefined'
   settings();assert page.locator('#purchase-confirmation-setting').is_checked();assert page.locator('#build-confirmation-setting').is_checked()
   press('#purchase-confirmation-setting');shot('settings');press('#modal-close')
   # Existing skip-purchase players still confirm land. Cancel never commits.
   open_shop();press('[data-expand-land]');before=saved()['counts']['V1'];choose(lambda:page.locator('#placement-confirm').is_enabled())
   assert page.locator('#placement-confirm').is_visible();assert saved()['counts']['V1']==before
   press('#placement-cancel');settings();press('#build-confirmation-setting');press('#modal-close')
   assert saved()['skipBuildConfirmation'] and saved()['skipPurchaseConfirmation']
   open_shop();press('[data-expand-land]');assert page.locator('#placement-confirm').is_hidden();assert '◆ / 次' in page.locator('#placement-detail').inner_text()
   press('#placement-repeat');assert page.locator('#placement-repeat').get_attribute('aria-pressed')=='true';shot('direct-land')
   for i in range(2):
    before=saved()['counts']['V1'];choose(lambda:saved()['counts']['V1']>before)
    assert saved()['counts']['V1']==before+1;assert page.locator('#placement-bar').is_visible()
   press('#placement-cancel')
   # Purchase confirmation can be on while layout confirmation stays off.
   settings();press('#purchase-confirmation-setting');press('#modal-close')
   facility('L1');press('[data-record-buy=cavern]');assert page.locator('#placement-confirm').is_visible();press('#placement-cancel')
   settings();press('#purchase-confirmation-setting');press('#modal-close');facility('L1');press('[data-record-buy=cavern]')
   assert 'cavern' in saved()['records']['owned'];assert page.locator('#placement-bar').is_hidden()
   # A paid garden placement and free starter house use the layout setting.
   facility('V20');press('[data-garden-level=trees]');press('[data-garden-plant=hedge]');press('#placement-rotate')
   before=len(saved()['garden']['plants']);assert page.locator('#placement-confirm').is_hidden();choose(lambda:len(saved()['garden']['plants'])>before)
   assert saved()['garden']['plants'][-1]['rotation']==1
   press('[data-nav=village]');press('[data-housing-open]');press('[data-home-claim]');assert page.locator('#placement-confirm').is_hidden()
   choose(lambda:len(saved()['housing']['homes'])==1)
   # Reload retains both preferences. Switch layout confirmation back on for moving.
   page.reload(wait_until='networkidle');assert saved()['skipPurchaseConfirmation'] and saved()['skipBuildConfirmation']
   settings();press('#build-confirmation-setting');press('#modal-close');facility('M16');press('[data-move=M16]')
   old=saved()['placements']['M16'];press('#placement-rotate');assert page.locator('#placement-confirm').is_visible();press('#placement-cancel');assert saved()['placements']['M16']==old
   # Real MP3 media: natural end, silent gap, next song; no simulated onended.
   facility('L1');press('[data-record-play=meadow]')
   page.wait_for_function('musicPlayers.some(a=>a.src.endsWith("meadow.mp3")&&!a.paused&&a.readyState>=2)')
   page.wait_for_function('musicPlayers.find(a=>!a.paused)?.duration>60')
   page.evaluate('musicPlayers.find(a=>!a.paused).currentTime=musicPlayers.find(a=>!a.paused).duration-.1')
   page.wait_for_function('document.querySelector("[data-record-playback]").textContent==="曲间休息"')
   assert page.evaluate('musicPlayers.filter(a=>!a.paused).length')==0
   page.wait_for_function('document.querySelector("[data-record-name]").textContent==="深岩回声"',timeout=7000)
   page.wait_for_function('musicPlayers.some(a=>a.src.endsWith("cavern.mp3")&&!a.paused)')
   assert page.evaluate('musicPlayers.filter(a=>!a.paused).length')==1
   press('.record-transport .game-select-trigger');page.get_by_role('option',name='随机播放',exact=True).click();press('[data-record-next]')
   page.wait_for_function('document.querySelector("[data-record-name]").textContent==="田埂来风"')
   press('.record-transport .game-select-trigger');page.get_by_role('option',name='单曲循环',exact=True).click()
   page.wait_for_function('musicPlayers.some(a=>!a.paused&&a.loop)')
   press('[data-record-toggle]');page.wait_for_function('musicPlayers.every(a=>a.paused)')
   page.locator('.record-library [data-audio-volume=musicVolume]').fill('27');page.locator('.record-library [data-audio-volume=musicVolume]').dispatch_event('change')
   page.locator('.record-library').scroll_into_view_if_needed();shot('music');page.reload(wait_until='networkidle')
   state=saved();assert state['records']['mode']=='single';assert not state['records']['playing'];assert state['audio']['musicVolume']==.27
   assert state['skipPurchaseConfirmation'] and not state['skipBuildConfirmation'];assert not errors,errors
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
   reports.append({'engine':engine,'width':width,'independentConfirmations':True,'directContinuousLand':2,'directGardenAndFreeHome':True,'rotationBeforePlacement':True,'cancelMoveKeepsPosition':True,'realMp3AutoAdvance':True,'shuffleAndSingle':True,'preferencesReload':True,'errors':errors})
   print(engine,width,'PASS',flush=True)
  except Exception:
   shot('failure');print('ERRORS',errors,flush=True);raise
  finally:b.close()
(out/'report.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2)+'\n')
