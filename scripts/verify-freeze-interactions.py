"""Opening flights and repeated keepsake scene rebuilds after performance changes."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/v1.8/qa/performance/interactions';OUT.mkdir(parents=True,exist_ok=True)
reports=[]
with sync_playwright() as p:
 for engine,width in [('chromium',1440),('webkit',390)]:
  b=getattr(p,engine).launch(headless=True);c=b.new_context(viewport={'width':width,'height':844},is_mobile=width<760,has_touch=width<760)
  page=c.new_page();page.set_default_timeout(30000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  try:
   page.goto('http://127.0.0.1:8932/',wait_until='networkidle')
   page.get_by_role('button',name='第一次玩',exact=True).click()
   page.evaluate('''()=>{
    window.__flights=[];new MutationObserver(records=>{for(const r of records)for(const node of r.addedNodes)if(node.nodeType===1&&node.matches('.narrator-capture,.narrator-companion')){const b=node.getBoundingClientRect();window.__flights.push({kind:node.className,x:b.x,y:b.y,w:b.width,h:b.height});}}).observe(document.body,{childList:true});
    mcDebug.state.money=100;mcDebug.advance(0);
   }''')
   page.wait_for_function('mcDebug.state.narrative.intro==="calling"')
   page.locator('[data-nav=build]').click()
   page.wait_for_function('__flights.some(f=>f.kind.includes("narrator-capture"))')
   page.wait_for_timeout(1200)
   page.locator('[data-buy-guidance=info]').click();page.locator('#placement-confirm').click()
   page.wait_for_function('mcDebug.state.narrative.companionsShown',timeout=60000)
   page.wait_for_function('__flights.filter(f=>f.kind.includes("narrator-companion")).length===3',timeout=60000)
   page.wait_for_timeout(1800)
   flights=page.evaluate('__flights')
   assert all(f['w']>0 and f['h']>0 and 0<=f['x']<width and 0<=f['y']<844 for f in flights),flights
   assert page.locator('[data-companion-arriving]').count()==0
   page.screenshot(path=str(OUT/f'opening-{engine}.png'))
   seed=json.loads((ROOT/'docs/v1.8/qa/community-keepsakes/seed.json').read_text())
   page.evaluate('s=>mcDebug.setState(s)',seed)
   page.evaluate('''async()=>{
    const {claimCommunitySouvenir}=await import('/src/community-stories.js');
    const {gardenSites,gardenPlacementReason,plantGarden}=await import('/src/garden.js');
    const s=mcDebug.state;
    for(const id of ['request-pond','cash-counter','village-stage']){claimCommunitySouvenir(s,id);const site=gardenSites(s,id,1).find(p=>!gardenPlacementReason(s,id,p));if(!site)throw Error('no site');plantGarden(s,id,site);}
    mcDebug.world.sync(s);
   }''')
   memory=page.evaluate('''async()=>{
    const w=mcDebug.world,s=mcDebug.state,cycles=[];
    for(let i=0;i<16;i++){s.garden.revision++;w.sync(s);w.update(true);await new Promise(r=>requestAnimationFrame(r));cycles.push({...w.renderer.info.memory});}
    return cycles;
   }''')
   assert memory[-1]==memory[2],memory
   page.screenshot(path=str(OUT/f'keepsakes-{engine}.png'))
   assert not errors,errors
   reports.append({'engine':engine,'width':width,'flights':flights,'rebuildCycles':memory,'stableGpuResources':True,'errors':errors});print(engine,'PASS',flush=True)
  except Exception:
   page.screenshot(path=str(OUT/f'failure-{engine}.png'));raise
  finally:b.close()
(OUT/'report.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2))
