"""Audition page: local files and HTTP, mobile and desktop; no user saves touched."""
import json, wave, math
from pathlib import Path
from array import array
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/v1.7/qa/narrator-voice'
report=[]
with sync_playwright() as p:
 for engine,width,source in [('chromium',1100,'http'),('chromium',320,'http'),('webkit',390,'http'),('chromium',900,'file')]:
  browser=getattr(p,engine).launch(headless=True)
  ctx=browser.new_context(viewport={'width':width,'height':900},is_mobile=width<760,has_touch=width<760)
  page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  url=(OUT/'index.html').as_uri() if source=='file' else 'http://127.0.0.1:8917/docs/v1.7/qa/narrator-voice/index.html'
  page.goto(url,wait_until='networkidle')
  page.wait_for_function('document.querySelector("#player").readyState>=1')
  assert page.locator('#player').evaluate('a=>a.paused')
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  page.locator('[data-style=pixel]').click()
  page.wait_for_function('document.querySelector("#player").readyState>=1')
  assert page.locator('#player').evaluate('a=>a.paused'),'selection must not autoplay'
  page.locator('#play').click();page.wait_for_function('document.querySelector("#player").currentTime>.6')
  for style in ['murmur','reed','pixel']:
   before=page.locator('#player').evaluate('a=>a.currentTime')
   page.locator(f'[data-style={style}]').click()
   page.wait_for_function('document.querySelector("#player").readyState>=2 && !document.querySelector("#player").paused')
   after=page.locator('#player').evaluate('a=>a.currentTime')
   assert abs(after-before)<.7,(before,after)
   assert page.locator(f'[data-style={style}]').get_attribute('aria-pressed')=='true'
  for style in ['murmur','pixel','reed']:
   page.locator('[data-mix=true]').click()
   page.locator(f'[data-style={style}]').click()
   page.wait_for_function('document.querySelector("#player").readyState>=2 && !document.querySelector("#player").paused')
   assert '-mix.wav' in page.locator('#player').get_attribute('src')
  page.locator('#play').click();assert page.locator('#player').evaluate('a=>a.paused')
  assert page.locator('#caption').inner_text().strip()
  assert not page.locator('.face').evaluate("e=>e.classList.contains('talking')")
  page.locator('summary').first.click()
  page.locator('#previous').evaluate('a=>a.play()')
  assert page.locator('#player').evaluate('a=>a.paused')
  page.locator('#play').click();assert page.locator('#previous').evaluate('a=>a.paused')
  page.locator('#play').click();page.locator('summary').first.click()
  page.locator('[data-style=murmur]').click();page.locator('[data-mix=false]').click()
  durations={}
  for song in ['meadow','cavern','copper','rain','nether','end']:
   page.locator(f'[data-song={song}]').click()
   page.wait_for_function('document.querySelector("#record-player").readyState>=2 && !document.querySelector("#record-player").paused')
   duration=page.locator('#record-player').evaluate('a=>a.duration')
   assert 60<duration<110,(song,duration)
   durations[song]=duration
   assert page.locator('#player').evaluate('a=>a.paused')
  page.locator('#play').click()
  assert page.locator('#record-player').evaluate('a=>a.paused'),'narrator audition stops the full record'
  page.locator('#play').click()
  page.screenshot(path=str(OUT/f'sketches-{engine}-{width}-{source}.png'),full_page=True)
  assert not errors,errors
  report.append({'engine':engine,'width':width,'source':source,'sixFilesPlayable':True,'fullRecordDurations':durations,'switchKeepsPosition':True,'selectionDoesNotAutoplay':True,'mutuallyExclusive':True,'noOverflow':True,'errors':errors})
  browser.close()
for path in OUT.glob('voice-*-mix.wav'):
 with wave.open(str(path)) as f:
  values=array('h',f.readframes(f.getnframes()))
  peak=max(map(abs,values))/32768
  assert peak<.98,(path.name,peak)
  report.append({'file':path.name,'mixPeak':peak,'noClipping':True})
(OUT/'sketches-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
