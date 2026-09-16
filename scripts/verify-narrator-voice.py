"""Real voice/caption controls in three browsers, using isolated saves."""
import argparse, json, subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
a=argparse.ArgumentParser();a.add_argument('--url',default='http://127.0.0.1:8918/');args=a.parse_args()
out=ROOT/'docs/v1.7/qa/narrator-voice';out.mkdir(parents=True,exist_ok=True)
seed=json.loads(subprocess.check_output(['node','--input-type=module','-e',"""
import {fresh} from './src/game.js';import {NARRATION,IDLE_LINES} from './src/narrative.js';
const s=fresh(42);Object.assign(s.counts,{T1:1,V1:1,V18:1,V2:1,L1:1,M5:1});
s.money=1000;s.play=600;s.records.playing=false;s.audio.musicVolume=0;s.audio.sfxVolume=0;
s.guidance.info=true;s.narrative.intro='rescued';s.narrative.companionsShown=true;
s.narrative.seen=[...NARRATION,...IDLE_LINES].filter(r=>r.id!=='power-use').map(r=>r.id);
s.narrative.current={id:'power-use',index:0,elapsed:0,startedAt:600};s.reducedMotion=true;
console.log(JSON.stringify(s));
"""],cwd=ROOT))
report=[]
with sync_playwright() as p:
 for engine,width in [('chromium',1440),('webkit',390),('chromium',320)]:
  b=getattr(p,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}))
  c=b.new_context(viewport={'width':width,'height':844},is_mobile=width<760,has_touch=width<760)
  c.add_init_script('if(!localStorage.getItem("mc-clicker-world-v2"))localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(seed))+')')
  c.add_init_script("""{
    window.voiceAudit={starts:[],stops:0};
    const C=window.AudioContext||window.webkitAudioContext;
    const make=C.prototype.createBufferSource;
    C.prototype.createBufferSource=function(...args){
      const s=make.apply(this,args),start=s.start,stop=s.stop;
      s.start=function(...args){if(Math.abs((s.buffer?.duration||0)-.128)<.0001)voiceAudit.starts.push(performance.now());return start.apply(s,args);};
      s.stop=function(...args){if(Math.abs((s.buffer?.duration||0)-.128)<.0001)voiceAudit.stops++;return stop.apply(s,args);};return s;
    };
  }""")
  page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(args.url,wait_until='networkidle');assert '1.7.0-alpha.7' in page.title()
  assert page.evaluate('typeof mcDebug')=='undefined'
  page.wait_for_selector('#narrator:not([hidden])')
  assert page.evaluate('voiceAudit.starts.length')==0,'no audio without a gesture'
  def press(selector):
   node=page.locator(selector).first
   node.tap() if width<760 else node.click()
  def tool(selector):
   if not page.locator(selector).is_visible():press('#hud-more')
   press(selector)
  press('#mine');page.wait_for_function('voiceAudit.starts.length>=3',timeout=10000)
  page.screenshot(path=str(out/f'speaking-{engine}-{width}.png'))
  tool('#settings');page.wait_for_timeout(150)
  stopped=page.evaluate('voiceAudit.starts.length');page.wait_for_timeout(500)
  assert page.evaluate('voiceAudit.starts.length')==stopped,'modal silences the narrator'
  assert page.locator('[data-audio-volume=narratorVolume]').count()==1
  press('[data-narrator-voice]');assert page.locator('[data-narrator-voice]').get_attribute('aria-pressed')=='true'
  assert page.locator('#toast').inner_text().startswith('行，那我写下来。')
  saved=page.evaluate('JSON.parse(localStorage.getItem("mc-clicker-world-v2"))')
  assert saved['audio']['narratorVoice']==False and saved['guidance']['notices']==True
  assert saved['audio']['musicVolume']==0 and saved['audio']['sfxVolume']==0
  assert page.locator('#modal').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
  page.screenshot(path=str(out/f'settings-{engine}-{width}.png'))
  press('#modal-close');page.wait_for_timeout(3200)
  assert page.evaluate('voiceAudit.starts.length')==stopped
  assert page.locator('#narrator:not([hidden])').count()==1,'captions continue while voice is muted'
  page.reload(wait_until='networkidle');press('#mine');page.wait_for_timeout(400)
  assert page.evaluate('voiceAudit.starts.length')==0
  tool('#info-open');assert page.locator('[data-narrator-state]').inner_text()=='只看字幕'
  assert page.locator('#info-panel .notice-gag').count()==0,'voice-only mute leaves the mouth free to speak'
  press('#guidance-notices')
  assert page.locator('[data-narrator-state]').inner_text()=='旁白已暂停'
  assert page.locator('#info-panel .notice-gag').count()==1
  saved=page.evaluate('JSON.parse(localStorage.getItem("mc-clicker-world-v2"))')
  assert saved['guidance']['notices']==False and saved['audio']['narratorVoice']==False
  page.screenshot(path=str(out/f'paused-{engine}-{width}.png'))
  press('#guidance-voice')
  assert page.locator('[data-narrator-state]').inner_text()=='旁白已暂停','voice on must not resume the text'
  saved=page.evaluate('JSON.parse(localStorage.getItem("mc-clicker-world-v2"))')
  assert saved['guidance']['notices']==False and saved['audio']['narratorVoice']==True
  press('#guidance-voice');press('#guidance-notices')
  assert page.locator('[data-narrator-state]').inner_text()=='只看字幕','resume must preserve voice mute'
  assert page.locator('#info-panel .notice-gag').count()==0
  page.wait_for_timeout(2000)
  press('#guidance-voice');assert page.locator('#guidance-voice').get_attribute('aria-pressed')=='false'
  press('#guidance-voice');assert page.locator('#guidance-voice').get_attribute('aria-pressed')=='true'
  assert not page.locator('#toast').is_visible(),'second mute has no repeated joke'
  assert page.locator('#modal').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
  page.screenshot(path=str(out/f'info-{engine}-{width}.png'))
  assert not errors,errors
  report.append({'engine':engine,'width':width,'gestureVoice':True,'modalSilence':True,'textWhileMuted':True,'savedMute':True,'fourIndependentStates':True,'distinctExpressions':True,'oneTimeReaction':True,'noOverflow':True,'errors':errors})
  b.close()
(out/'browser-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(report)
