from pathlib import Path
import json
from playwright.sync_api import sync_playwright
out=[]
with sync_playwright() as p:
 b=p.chromium.launch(headless=True);page=b.new_page(viewport={'width':1440,'height':960},device_scale_factor=1)
 for label,port in [('before',8892),('after',8890)]:
  page.goto(f'http://127.0.0.1:{port}/');page.wait_for_load_state('networkidle');page.evaluate("async()=>{const {completeFixture}=await import('/scripts/fixtures.mjs');mcDebug.setState(completeFixture());}");page.wait_for_timeout(700)
  data=page.evaluate('''()=>{const w=mcDebug.world,gl=w.renderer.getContext(),timings=[];for(let j=0;j<24;j++){const t=performance.now();w.update();gl.finish();timings.push(performance.now()-t);}timings.sort((a,b)=>a-b);const extension=gl.getExtension('WEBGL_debug_renderer_info');return{renderer:extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):'unavailable',p50:timings[12],p95:timings[22],triangles:w.renderer.info.render.triangles};}''')
  out.append({'version':label,**data})
 print(json.dumps(out,indent=2));Path('docs/qa/rendering-comparison.json').write_text(json.dumps(out,indent=2));b.close()
