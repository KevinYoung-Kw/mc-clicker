"""Steady dense-world frame sampling without CPU profiler or forced GC."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/v1.8/qa/performance'
seed=json.loads((OUT/'fixtures/crowd-fixture.json').read_text())
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--use-angle=metal']);c=b.new_context(viewport={'width':1440,'height':960});page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 c.add_init_script('localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(seed))+')')
 page.goto('http://127.0.0.1:8933/',wait_until='networkidle');page.wait_for_timeout(2000)
 page.evaluate('''()=>{
 const start=performance.now();window.__dense={start,frames:[],longTasks:[],running:true};
 new PerformanceObserver(list=>{for(const e of list.getEntries())if(__dense.running&&e.startTime>=start)__dense.longTasks.push({start:e.startTime-start,duration:e.duration});}).observe({entryTypes:['longtask']});
 let last;function frame(t){if(!__dense.running)return;if(last)__dense.frames.push(t-last);last=t;requestAnimationFrame(frame)}requestAnimationFrame(frame);
 }''')
 page.wait_for_timeout(30000)
 result=page.evaluate('''()=>{__dense.running=false;const a=__dense.frames.sort((a,b)=>a-b);return {sampleMs:performance.now()-__dense.start,frames:a.length,p50:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],max:a.at(-1),longTasks:__dense.longTasks,noDebug:typeof mcDebug==='undefined'};}''')
 assert not errors,errors;result['errors']=errors
 (OUT/'dense-production-30s.json').write_text(json.dumps(result,indent=2));print(result);b.close()
