"""Same browser/GPU, same purchased fixture, same switch sequence on two checkouts."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
results=[]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--use-angle=metal'])
    page=browser.new_page(viewport={'width':1440,'height':960},device_scale_factor=1)
    page.route('https://fonts.googleapis.com/**',lambda route:route.abort())
    page.route('https://fonts.gstatic.com/**',lambda route:route.abort())
    for label,port in [('before',8892),('after',8890)]:
        page.goto(f'http://127.0.0.1:{port}/');page.wait_for_load_state('networkidle')
        page.evaluate("async()=>{const {completeFixture}=await import('/scripts/fixtures.mjs');mcDebug.setState(completeFixture());}")
        page.wait_for_timeout(1500)
        result=page.evaluate('''async()=>{
          const w=mcDebug.world,gl=w.renderer.getContext(),extension=gl.getExtension('WEBGL_debug_renderer_info');
          let rebuilds=0,resizes=0,syncMs=0;const build=w.buildInstances,resize=w.renderer.setSize,sync=w.sync;
          w.buildInstances=function(...a){rebuilds++;return build.apply(this,a)};
          w.renderer.setSize=function(...a){resizes++;return resize.apply(this,a)};
          w.sync=function(...a){const t=performance.now();const r=sync.apply(this,a);syncMs+=performance.now()-t;return r;};
          const durations=[];for(let i=0;i<8;i++)for(const tab of ['build','world']){const t=performance.now();document.querySelector('[data-nav='+tab+']').click();durations.push(performance.now()-t);await new Promise(r=>setTimeout(r,150));}
          const frames=[];let last;await new Promise(resolve=>{function f(t){if(last)frames.push(t-last);last=t;if(frames.length<90)requestAnimationFrame(f);else resolve();}requestAnimationFrame(f);});
          durations.sort((a,b)=>a-b);frames.sort((a,b)=>a-b);w.update(true);
          return {renderer:extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):'unavailable',panelSwitches:16,rebuilds,drawingBufferResizes:resizes,syncMs,clickP50:durations[8],clickP95:durations[15],frameMedian:frames[45],frameP95:frames[85],trianglesWithShadows:w.renderer.info.render.triangles,instances:w.batch.reduce((s,b)=>s+b.objects.length,0),uploadedInstancesPerFrame:w.batch.reduce((s,b)=>s+(b.dynamicObjects?.length??b.objects.length),0)};
        }''')
        results.append({'version':label,**result})
    browser.close()
Path('docs/qa/performance-comparison.json').write_text(json.dumps(results,indent=2));print(json.dumps(results,indent=2))
