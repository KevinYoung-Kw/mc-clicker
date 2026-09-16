"""Emotional narrator audio: isolated game saves plus the old/new audition player."""
import argparse, json, subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
ap=argparse.ArgumentParser();ap.add_argument('--game',default='http://127.0.0.1:8918/');ap.add_argument('--demo',default='http://127.0.0.1:8917/docs/v1.7/qa/narrator-prosody/');ap.add_argument('--out');args=ap.parse_args()
out=Path(args.out) if args.out else ROOT/'docs/v1.7/qa/narrator-prosody';out.mkdir(parents=True,exist_ok=True)
seed=json.loads(subprocess.check_output(['node','--input-type=module','-e','''
import {fresh,buy} from './src/game.js';import {buyGuidance} from './src/guidance.js';
import {chooseOpening} from './src/opening-guide.js';import {NARRATION,IDLE_LINES} from './src/narrative.js';
const s=fresh(42);chooseOpening(s,'first');s.money=10000;buyGuidance(s,'info');
for(const id of ['T1','V1','V18','V2','T7','L1'])buy(s,id);
s.play=200;s.narrative.intro='rescued';s.narrative.companionsShown=true;
s.narrative.seen=[...NARRATION,...IDLE_LINES].filter(r=>r.id!=='manual').map(r=>r.id);
s.narrative.current={id:'manual',index:0,elapsed:0,startedAt:200};s.narrative.manualPrompted=true;
s.sound=true;s.records.playing=false;s.audio.musicVolume=0;s.audio.sfxVolume=0;s.reducedMotion=true;
console.log(JSON.stringify(s));'''],cwd=ROOT))
reports=[]
with sync_playwright() as p:
 for engine,width in [('chromium',1440),('webkit',390),('chromium',320)]:
  browser=getattr(p,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}))
  context=browser.new_context(viewport={'width':width,'height':900},is_mobile=width<760,has_touch=width<760)
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def press(selector):
   loc=page.locator(selector).first
   loc.tap() if width<760 else loc.click()
  def player():return page.evaluate('({paused:player.paused,time:player.currentTime,duration:player.duration,source:player.currentSrc})')
  try:
   page.goto(args.demo,wait_until='networkidle')
   page.wait_for_function('Number.isFinite(player.duration)')
   assert player()['paused'];assert '家传秘诀' in page.locator('#caption').inner_text()
   press('#play');page.wait_for_function('player.currentTime>.4&&!player.paused')
   first=player()['time'];press('[data-mode=old]');page.wait_for_function('player.currentSrc.includes("manual-old")&&!player.paused')
   assert player()['time']>=first-.15
   press('#play');assert player()['paused']
   press('[data-mode=new]');page.wait_for_function('player.readyState>=2&&player.currentSrc.includes("manual-new")')
   assert player()['paused'],'switching while paused does not autoplay'
   page.screenshot(path=str(out/f'audition-{engine}-{width}.png'),full_page=True)
   for sample in range(5):
    press(f'[data-sample="{sample}"]')
    for mode in ['old','new']:
     press(f'[data-mode={mode}]');page.wait_for_function('(mode)=>player.readyState>=2&&player.currentSrc.includes("-"+mode+".mp3")',arg=mode)
     assert player()['duration']>3
   press('#sequence');page.wait_for_function('!player.paused&&player.currentSrc.includes("manual-new")')
   page.evaluate('player.currentTime=player.duration-.15')
   page.wait_for_function('!player.paused&&player.currentSrc.includes("rescued-new")')
   # Simulate the browser visibility event; no catch-up or automatic resume.
   page.evaluate('Object.defineProperty(document,"hidden",{configurable:true,value:true});document.dispatchEvent(new Event("visibilitychange"))')
   assert player()['paused']
   page.evaluate('Object.defineProperty(document,"hidden",{configurable:true,value:false});document.dispatchEvent(new Event("visibilitychange"))')
   assert player()['paused']
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   row={'engine':engine,'width':width,'gameURL':args.game,'auditionDecodeAllTen':True,'samePositionAB':True,'noAutoplay':True,'continuousNext':True,'hiddenPauses':True}
   context.close()

   context=browser.new_context(viewport={'width':width,'height':844},is_mobile=width<760,has_touch=width<760)
   context.add_init_script('if(!localStorage.getItem("mc-clicker-world-v2"))localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(seed))+')')
   context.add_init_script('''{
     window.voiceAudit={starts:[],buffers:[],durations:[]};const C=window.AudioContext||window.webkitAudioContext;
     const make=C.prototype.createBufferSource;
     C.prototype.createBufferSource=function(...args){const source=make.apply(this,args),start=source.start;
       source.start=function(...params){if(source.buffer?.duration>=.06&&source.buffer.duration<=.401){
         const data=source.buffer.getChannelData(0);let signature='';
         for(let i=50;i<700;i+=31)signature+=Math.round(data[i]*10000)+',';
         voiceAudit.starts.push(performance.now());voiceAudit.buffers.push(signature);voiceAudit.durations.push(source.buffer.duration);
       }return start.apply(source,params);};return source;
     };
   }''')
   page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(args.game,wait_until='networkidle');assert 'alpha.8' in page.title()
   assert page.evaluate('typeof mcDebug')=='undefined'
   page.wait_for_selector('#narrator button:has-text("打开操作指南")')
   assert page.locator('#narrator p').inner_text()=='如果你还想知道更多内容，我这里还有一本操作指南，这可是家传秘诀。你要想看的话，可以去那里了解一下。'
   assert page.evaluate('voiceAudit.starts.length')==0
   mouth=page.locator('#notification-shell .notice-face').inner_html()
   press('#mine');page.wait_for_function('new Set(voiceAudit.buffers).size>=10',timeout=10000)
   assert page.evaluate('voiceAudit.durations.some(d=>d>.2)&&voiceAudit.durations.some(d=>d<.09)'),'live connected and softened sounds'
   assert page.locator('#notification-shell .notice-face').inner_html()==mouth
   assert page.locator('#narrator').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
   assert page.locator('#narrator p').evaluate('e=>e.scrollHeight<=e.clientHeight+1')
   box=page.locator('#notice-center').bounding_box();assert box['x']>=0 and box['x']+box['width']<=width+1
   page.screenshot(path=str(out/f'game-{engine}-{width}.png'))
   # Actual tutorial button still completes the guide and silences hidden speech.
   press('#narrator button:has-text("打开操作指南")')
   assert page.locator('#info-tab-guide').get_attribute('aria-selected')=='true'
   assert page.evaluate('JSON.parse(localStorage.getItem("mc-clicker-world-v2")).narrative.manualVisited')
   count=page.evaluate('voiceAudit.starts.length');page.wait_for_timeout(600);assert page.evaluate('voiceAudit.starts.length')==count
   page.reload(wait_until='networkidle');assert page.evaluate('voiceAudit.starts.length')==0
   assert not errors,errors
   row.update({'newCopyInGame':True,'emotionalBuffersInGame':True,'connectedAndLightSounds':True,'staticMouth':True,'guideActionPreserved':True,'modalSilent':True,'noOverflow':True,'errors':errors})
   reports.append(row);print(row,flush=True)
  except Exception:
   page.screenshot(path=str(out/f'failure-{engine}-{width}.png'));raise
  finally:browser.close()

 # file:// is used in the user's review flow too.
 browser=p.chromium.launch(headless=True);page=browser.new_page()
 page.goto((ROOT/'docs/v1.7/qa/narrator-prosody/index.html').as_uri(),wait_until='networkidle');page.wait_for_function('player.readyState>=2')
 page.locator('#play').click();page.wait_for_function('player.currentTime>.1')
 assert '家传秘诀' in page.locator('#caption').inner_text()
 reports.append({'fileProtocol':True,'audioAndCaptions':True});browser.close()
(out/'browser-report.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2)+'\n')
