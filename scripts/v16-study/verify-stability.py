"""V1.6 scene soak on isolated fixtures. Dev diagnostics do not ship in production."""
from pathlib import Path
import argparse,json,time
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://127.0.0.1:8890/');parser.add_argument('--out',required=True);parser.add_argument('--soak',type=int,default=0);parser.add_argument('--fixtures',default='docs/v1.6/qa/stability-baseline/fixtures');args=parser.parse_args()
out=Path(args.out);out.mkdir(parents=True,exist_ok=True);fixtures=Path(args.fixtures);report={'errors':[],'density':{},'scenes':[]}
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--use-angle=metal']);context=browser.new_context(viewport={'width':1440,'height':960});page=context.new_page();page.on('pageerror',lambda e:report['errors'].append({'message':str(e),'stack':e.stack}));page.goto(args.url,wait_until='networkidle');page.wait_for_function('window.mcDebug?.world');cdp=context.new_cdp_session(page)
 def persist(): (out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 def memory():
  cdp.send('HeapProfiler.collectGarbage');return {'heap':cdp.send('Runtime.getHeapUsage')['usedSize'],**page.evaluate('()=>({geometries:mcDebug.world.renderer.info.memory.geometries,textures:mcDebug.world.renderer.info.memory.textures,programs:mcDebug.world.renderer.info.programs.length,drawCalls:mcDebug.world.renderer.info.render.calls,walkers:mcDebug.world.walkers.length,meshes:mcDebug.world.batch.reduce((n,b)=>n+b.objects.length,0)})')}
 def sample(ms=6000):
  page.evaluate('window.__frames=[];window.__last=performance.now();window.__watch=true;requestAnimationFrame(function f(t){if(!__watch)return;__frames.push(t-__last);__last=t;requestAnimationFrame(f)})');page.wait_for_timeout(ms)
  return page.evaluate('()=>{__watch=false;const a=__frames.sort((a,b)=>a-b);return {count:a.length,p50:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],max:a.at(-1)}}')
 def fixture(name):
  page.evaluate('s=>mcDebug.setState(s)',json.loads((fixtures/(name+'.json')).read_text()));page.wait_for_timeout(1500)
 fixture('new');page.screenshot(path=str(out/'starter.png'))
 for n in [0,50,150]:
  fixture('dense-'+str(n));report['density'][str(n)]={'frames':sample(),'memory':memory()};page.screenshot(path=str(out/f'dense-{n}.png'));persist();print('density',n,report['density'][str(n)],flush=True)
 # Real scene switches, including the independent studio room and weather.
 for realm in ['nether','end','overworld']:
  page.locator('[data-realm="'+realm+'"]').click();page.wait_for_timeout(1000);report['scenes'].append({'realm':realm,**memory()});page.screenshot(path=str(out/f'{realm}.png'));assert page.locator('#world canvas').is_visible()
 for weather,phase in [('clear',.05),('rain',.55),('snow',.55)]:
  page.evaluate('v=>{const s=mcDebug.state;Object.assign(s.environment,{weather:v.weather,phase:v.phase,cycle:false,auto:false});for(const id of ["env-weather","env-rain","env-snow","env-sundial","env-stars"])s.environment.modules[id]=true;mcDebug.world.sync(s)}',{'weather':weather,'phase':phase});page.wait_for_timeout(3500);report['scenes'].append({'weather':weather,'phase':phase,**memory()});page.screenshot(path=str(out/f'{weather}-{phase}.png'))
 page.locator('[data-nav="atlas"]').click();page.locator('[data-detail="L2"]').click();page.wait_for_timeout(2000);assert page.locator('#studio-back').is_visible();page.screenshot(path=str(out/'studio.png'));page.locator('#studio-back').click();page.wait_for_timeout(1200)
 # Keep the same scenario/camera and exercise 30 actual open/close paths.
 fixture('dense-150');report['menuBefore']=memory()
 for i in range(30):
  target=['build','village','network','atlas'][i%4];page.locator('[data-nav="'+target+'"]').click();page.wait_for_timeout(100);page.locator('[data-nav="'+target+'"]').click();page.wait_for_timeout(150)
  assert page.locator('#panel').is_hidden();assert page.locator('#world canvas').is_visible();assert not page.locator('#stage').evaluate('e=>e.inert')
 page.wait_for_timeout(1500);report['menuAfter']=memory();report['menuCycles']=30;persist();print('menus passed',flush=True)
 # The stress run uses every currently supported workplace (22 workers + the
 # game's two spare residents), full animation, and the same 150 planted items.
 fixture('peak');report['normalMotionPeak']={'frames':sample(),'memory':memory()};page.screenshot(path=str(out/'normal-motion-peak.png'));persist()
 report['soak']=[];start=time.monotonic()
 while time.monotonic()-start<args.soak:
  page.wait_for_timeout(min(30000,int((args.soak-(time.monotonic()-start))*1000)));report['soak'].append({'seconds':round(time.monotonic()-start),**memory()});persist();print('soak',report['soak'][-1],flush=True)
 assert not report['errors'],report['errors'];persist();context.close();browser.close()
