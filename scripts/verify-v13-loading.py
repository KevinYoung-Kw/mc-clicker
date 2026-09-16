from pathlib import Path
import json,statistics
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/qa/v13';runs=[]
instrument="""window.__firstDraw=null;for(const C of [window.WebGLRenderingContext,window.WebGL2RenderingContext])if(C)for(const k of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){const f=C.prototype[k];if(!f)continue;C.prototype[k]=function(...a){window.__firstDraw??=performance.now();C.prototype[k]=f;return f.apply(this,a);};}"""
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--use-angle=metal'])
 for repeat in range(5):
  for version,base,theme in [('1.2.2','http://127.0.0.1:8891/',''),('1.3','http://127.0.0.1:8892/',''),*[('1.3','http://127.0.0.1:8892/','web-theme-'+x) for x in ['backpack','oak','redstone','end']]]:
   context=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);page=context.new_page();page.add_init_script(instrument)
   if theme:
    raw={'version':7,'money':0,'counts':{},'webAppearance':{'version':1,'owned':{theme:True},'equipped':{'theme':theme},'legacyAliases':{}}}
    page.add_init_script('localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(raw))+')')
   page.goto(base,wait_until='domcontentloaded');page.wait_for_function('window.__firstDraw!==null');page.wait_for_selector('#mine');page.locator('#mine').click();assert int(page.locator('#money').inner_text().replace(',',''))>=1
   cold=page.evaluate("()=>({draw:__firstDraw,theme:document.body.dataset.theme||'',bytes:performance.getEntriesByType('resource').filter(r=>/\\.(js|css)(\\?|$)/.test(r.name)).reduce((a,r)=>a+r.encodedBodySize,0),debug:typeof window.mcDebug})")
   page.reload(wait_until='domcontentloaded');page.wait_for_function('window.__firstDraw!==null');warm=page.evaluate('window.__firstDraw');runs.append({'repeat':repeat,'version':version,'theme':theme,'cold':cold,'warm':warm});assert cold['debug']=='undefined'
   if theme:assert cold['theme']==theme
   context.close()
 b.close()
def summary(key):
 data=[r['cold']['draw'] for r in runs if r['version']==key and not r['theme']];data.sort();return {'median':statistics.median(data),'p95':data[-1],'samples':data}
result={'browser':'Chromium / Metal, 390×844, loopback production builds; five fresh contexts per theme and default, followed by warm reload. Not cellular or physical-phone latency.','runs':runs,'baseline':summary('1.2.2'),'current':summary('1.3')};result['ratioP95']=result['current']['p95']/result['baseline']['p95'];(OUT/'loading.json').write_text(json.dumps(result,indent=2));print(json.dumps({k:v for k,v in result.items() if k!='runs'},indent=2))
