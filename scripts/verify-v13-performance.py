"""Same-GPU environment comparison and ten-minute resource/viewport soak.
Run after simulation finishes, on a local 8890 Vite server.
"""
from pathlib import Path
import json,time
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/qa/v13';seed=json.loads((OUT/'fixture.json').read_text());seed['reducedMotion']=False
rows=[]
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--use-angle=metal'])
 for width in [1440,390]:
  page=b.new_page(viewport={'width':width,'height':960 if width>760 else 844},is_mobile=width<760,has_touch=width<760)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:8890/',wait_until='networkidle');page.wait_for_function('!!window.mcDebug?.world');page.evaluate('s=>mcDebug.setState(s)',seed)
  page.evaluate('''()=>{const w=mcDebug.world;window.measure={updates:[],atmosphere:[],frames:[],sizes:0,enabled:false};for(const [obj,key,out]of [[w,'update','updates'],[w.atmosphereView,'update','atmosphere']]){const old=obj[key];obj[key]=function(...a){const start=performance.now(),v=old.apply(this,a);if(measure.enabled)measure[out].push(performance.now()-start);return v}}const set=w.renderer.setSize;w.renderer.setSize=function(...a){if(measure.enabled)measure.sizes++;return set.apply(this,a)};let last;function frame(t){if(measure.enabled&&last)measure.frames.push(t-last);last=t;requestAnimationFrame(frame)}requestAnimationFrame(frame);
 window.sampleStart=()=>{measure.updates=[];measure.atmosphere=[];measure.frames=[];measure.sizes=0;measure.enabled=true};window.sampleEnd=()=>{measure.enabled=false;const stats=a=>{a.sort((a,b)=>a-b);return {n:a.length,p50:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)]}};return {updates:stats(measure.updates),atmosphere:stats(measure.atmosphere),frames:stats(measure.frames),sizes:measure.sizes,render:{...w.renderer.info.render},memory:{...w.renderer.info.memory},programs:w.renderer.info.programs.length}};
 }''')
  page.wait_for_timeout(1200);page.evaluate('sampleStart()');page.wait_for_timeout(15000);baseline=page.evaluate('sampleEnd()')
  page.evaluate("async()=>{const {buyEnvironment,setEnvironment}=await import('/src/environment.js');for(const id of ['env-sundial','env-weather','env-rain','env-snow','env-stars'])buyEnvironment(mcDebug.state,id);setEnvironment(mcDebug.state,{phase:.02,weather:'rain'});}")
  page.wait_for_timeout(12000);page.evaluate('sampleStart()');page.wait_for_timeout(15000);rain=page.evaluate('sampleEnd()')
  page.evaluate("async()=>{const{setEnvironment}=await import('/src/environment.js');setEnvironment(mcDebug.state,{weather:'snow'});}");page.wait_for_timeout(12000);page.evaluate('sampleStart()');page.wait_for_timeout(15000);snow=page.evaluate('sampleEnd()')
  memories=[]
  for i in range(10):
   page.evaluate("async w=>{const{setEnvironment}=await import('/src/environment.js');setEnvironment(mcDebug.state,{weather:w});}",['clear','rain','snow'][i%3]);page.wait_for_timeout(250)
   if i%2==0:
    page.evaluate("mcDebug.go('live')");page.wait_for_timeout(850);page.evaluate("mcDebug.go('world')");page.wait_for_timeout(600)
   memories.append(page.evaluate('({memory:{...mcDebug.world.renderer.info.memory},programs:mcDebug.world.renderer.info.programs.length,cache:mcDebug.world.caches.size})'))
  assert memories[-1]['memory']==memories[-3]['memory'],memories
  assert max(rain['updates']['p95'],snow['updates']['p95'])-baseline['updates']['p95']<=3, [baseline,rain,snow]
  assert baseline['sizes']==rain['sizes']==snow['sizes']==0
  # Draw-call counts on a shadow-refresh frame are not comparable. Measure only atmosphere batches.
  effect_calls=page.evaluate('mcDebug.world.atmosphereView.meshes.filter(m=>m.visible).length')
  assert effect_calls<=(12 if width>760 else 8)
  row={'width':width,'baseline':baseline,'rain':rain,'snow':snow,'memoryCycles':memories,'effectDrawCalls':effect_calls,'errors':errors}
  if width==390:
   page.evaluate('sampleStart()');soak=[]
   for minute in range(10):
    page.wait_for_timeout(60000);soak.append(page.evaluate('({memory:{...mcDebug.world.renderer.info.memory},programs:mcDebug.world.renderer.info.programs.length,css:[document.querySelector("#world canvas").clientWidth,document.querySelector("#world canvas").clientHeight],drawing:[mcDebug.world.renderer.domElement.width,mcDebug.world.renderer.domElement.height]})'));print('soak minute',minute+1,flush=True)
   row['soak']=soak;row['soakTiming']=page.evaluate('sampleEnd()');assert soak[0]['memory']==soak[-1]['memory'];assert row['soakTiming']['sizes']==0
  rows.append(row);assert not errors;print('performance',width,'passed',flush=True);(OUT/'performance.json').write_text(json.dumps(rows,indent=2));page.close()
 b.close()
