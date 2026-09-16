from pathlib import Path
import json,sys
from playwright.sync_api import sync_playwright
label=sys.argv[1] if len(sys.argv)>1 else 'before'
with sync_playwright() as p:
 b=p.chromium.launch(headless=True);page=b.new_page(viewport={'width':1440,'height':960},device_scale_factor=1)
 page.goto('http://127.0.0.1:'+ (sys.argv[2] if len(sys.argv)>2 else '8890'));page.wait_for_load_state('networkidle')
 page.evaluate("async()=>{const {completeFixture}=await import('/scripts/fixtures.mjs');mcDebug.setState(completeFixture());}")
 page.wait_for_timeout(500)
 result=page.evaluate('''async()=>{
 const w=mcDebug.world, samples={sync:[],update:[],buildInstances:[],resize:[]};
 for(const key in samples){const fn=w[key];w[key]=function(...args){const t=performance.now();const r=fn.apply(this,args);samples[key].push(performance.now()-t);return r;};}
 const press=q=>document.querySelector(q).click();
 for(let i=0;i<8;i++){press('[data-nav=build]');await new Promise(r=>setTimeout(r,100));press('[data-nav=world]');await new Promise(r=>setTimeout(r,100));}
 const actions={};for(const [key,values]of Object.entries(samples)){values.sort((a,b)=>a-b);actions[key]={calls:values.length,p50:values[Math.floor(values.length*.5)]||0,p95:values[Math.floor(values.length*.95)]||0,total:values.reduce((a,b)=>a+b,0)};}
 const frames=[];let previous=performance.now();await new Promise(resolve=>{const step=now=>{frames.push(now-previous);previous=now;if(frames.length<90)requestAnimationFrame(step);else resolve();};requestAnimationFrame(step);});frames.sort((a,b)=>a-b);
 return {actions,frameMedian:frames[45],frameP95:frames[85],drawCalls:w.renderer.info.render.calls,triangles:w.renderer.info.render.triangles,instances:w.batch.reduce((s,b)=>s+b.objects.length,0),dynamicInstances:w.batch.reduce((s,b)=>s+(b.dynamicObjects?.length??b.objects.length),0)};
}''')
 Path('docs/qa').mkdir(exist_ok=True);Path(f'docs/qa/performance-{label}.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2));b.close()
