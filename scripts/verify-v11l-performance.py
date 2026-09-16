"""Short browser profiling on actual final-route worlds. No concurrent browser/CPU jobs."""
import argparse,json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--url',required=True);p.add_argument('--simulation',default='calibrated');args=p.parse_args()
out=ROOT/'docs/v1.1l/performance';out.mkdir(parents=True,exist_ok=True)
seed=json.loads((ROOT/f'docs/v1.1l/simulation/{args.simulation}/livestream-first-save.json').read_text());seed['realm']='overworld'
report={'method':'Five-second visible-window samples after warmup; local Mac browser/GPU, mobile viewports are not physical phones. Runtime frames include production and world animation.','cases':[],'errors':[]}
def stats(a):
 a=sorted(a);return {'count':len(a),'medianMs':a[len(a)//2] if a else 0,'p95Ms':a[min(len(a)-1,int(len(a)*.95))] if a else 0,'maxMs':max(a,default=0)}
with sync_playwright() as pw:
 for engine,width,height in [('chromium',1440,960),('webkit',390,600)]:
  browser=getattr(pw,engine).launch(**({'args':['--use-angle=metal']} if engine=='chromium' else {}));context=browser.new_context(viewport={'width':width,'height':height},has_touch=width<700,is_mobile=width<700)
  context.add_init_script('localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(seed))+')');page=context.new_page();page.on('pageerror',lambda e:report['errors'].append(str(e)));page.goto(args.url,wait_until='networkidle');page.wait_for_function('!!window.mcDebug?.world');page.wait_for_timeout(1500)
  page.evaluate('''()=>{window.profiling={frames:[],updates:[],allocations:0,enabled:false};const w=mcDebug.world,update=w.update.bind(w),resize=w.renderer.setSize.bind(w.renderer);w.update=(...args)=>{const t=performance.now();const result=update(...args);if(profiling.enabled)profiling.updates.push(performance.now()-t);return result;};w.renderer.setSize=(...args)=>{if(profiling.enabled)profiling.allocations++;return resize(...args);};let last;function frame(t){if(last&&profiling.enabled)profiling.frames.push(t-last);last=t;requestAnimationFrame(frame)}requestAnimationFrame(frame);}''')
  route_before=page.evaluate('async()=>{const {routingStats}=await import("/src/routing.js");return routingStats(mcDebug.state)}')
  cdp=context.new_cdp_session(page) if engine=='chromium' else None
  if cdp:cdp.send('HeapProfiler.collectGarbage')
  heap_before=cdp.send('Runtime.getHeapUsage') if cdp else None
  page.evaluate('profiling.enabled=true');page.wait_for_timeout(5000)
  sample=page.evaluate('()=>{profiling.enabled=false;return {...profiling,render:{...mcDebug.world.renderer.info.render},resources:{...mcDebug.world.renderer.info.memory},programs:mcDebug.world.renderer.info.programs.length,play:mcDebug.state.play}}')
  route_after=page.evaluate('async()=>{const {routingStats}=await import("/src/routing.js");return routingStats(mcDebug.state)}')
  if cdp:cdp.send('HeapProfiler.collectGarbage')
  heap_after=cdp.send('Runtime.getHeapUsage') if cdp else None
  assert sample['allocations']==0,sample['allocations'];assert route_before['builds']==route_after['builds'];assert len(sample['frames'])>20
  page.screenshot(path=str(out/f'{engine}-{width}-world.png'))
  report['cases'].append({'engine':engine,'viewport':[width,height],'frames':stats(sample['frames']),'worldUpdate':stats(sample['updates']),'stableBufferAllocations':sample['allocations'],'routeBuildsBefore':route_before,'routeBuildsAfter':route_after,'resources':sample['resources'],'render':sample['render'],'programs':sample['programs'],'heapBefore':heap_before,'heapAfter':heap_after})
  browser.close()
assert not report['errors'],report['errors'];(out/'observations.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False))
