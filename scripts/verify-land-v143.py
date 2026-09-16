"""Isolated large-world expansion: real canvas selection, confirmation and reload."""
from pathlib import Path
import json, subprocess
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/v1.4.3/qa/land';OUT.mkdir(parents=True,exist_ok=True)
seed=json.loads(subprocess.run(['node','--input-type=module','-e',"import {fresh} from './src/game.js'; console.log(JSON.stringify(fresh(1)))"],cwd=ROOT,text=True,capture_output=True,check=True).stdout)
seed.update(money=1e15,realm='end',endEyes=12,reducedMotion=True,sound=False)
seed['counts']={'T1':1,'V1':40,'N1':1,'E2':1}
seed['chunks']['overworld']=[{'x':x,'z':z} for x in range(3) for z in range(2)]
seed['chunks']['end']=[{'x':x,'z':z} for x in range(7) for z in range(5)]
reports=[]
with sync_playwright() as pw:
 for engine,width,height in [('chromium',1440,960),('webkit',390,844)]:
  browser=getattr(pw,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}))
  mobile=width<760
  ctx=browser.new_context(viewport={'width':width,'height':height},is_mobile=mobile,has_touch=mobile)
  ctx.add_init_script('if(!sessionStorage.getItem("land-seed")){localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(seed))+');sessionStorage.setItem("land-seed","1")}')
  page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:8890/',wait_until='networkidle')
  def press(sel):
   el=page.locator(sel).first
   el.tap() if mobile else el.click()
   page.wait_for_timeout(120)
  def transaction(sel, cost):
   # Read and click in one task, so ongoing foreground income cannot skew the
   # debit assertion. Plot selection itself uses real pointer/touch events.
   el=page.locator(sel);assert el.is_visible() and el.is_enabled()
   result=el.evaluate('(el,cost)=>{const before=mcDebug.state.money;el.click();return {before,after:mcDebug.state.money,correct:mcDebug.state.money===before-cost}}',cost)
   assert result['correct'],result
   page.wait_for_timeout(120)
   return result
  def choose():
   point=page.evaluate('''()=>{const w=mcDebug.world,r=w.renderer.domElement.getBoundingClientRect();
    for(const site of w.placementSites){const p=w.camera.position.clone().set(site.x,.18,site.z).project(w.camera);
     const x=r.x+(p.x+1)*r.width/2,y=r.y+(1-p.y)*r.height/2;
     if(x>20&&x<innerWidth-20&&y>100&&y<innerHeight-120&&document.elementFromPoint(x,y)===w.renderer.domElement)return{x,y};
    }return null;}''')
   assert point,'no unobstructed expansion plot'
   page.touchscreen.tap(point['x'],point['y']) if mobile else page.mouse.click(point['x'],point['y'])
   page.wait_for_timeout(250)
   assert page.locator('#placement-confirm').is_enabled(),'canvas tap did not choose land'
  before=page.evaluate('({count:mcDebug.state.chunks.end.length,money:mcDebug.state.money,total:mcDebug.state.counts.V1})')
  press('[data-nav="build"]');press('[data-expand-land]');choose()
  assert '末地' in page.locator('#placement-detail').inner_text()
  price=page.evaluate("async()=>{const {price}=await import('/src/game.js');const {ITEMS}=await import('/src/catalog.js');return price(mcDebug.state,ITEMS.V1)}")
  label=page.locator('#placement-confirm').inner_text();assert '在这里扩地' in label
  page.screenshot(path=OUT/f'{engine}-{width}-confirmation.png')
  transaction('#placement-cancel',0)
  assert page.evaluate('mcDebug.state.chunks.end.length')==before['count']
  press('[data-expand-land]');choose();debit=transaction('#placement-confirm',price)
  after=page.evaluate('({count:mcDebug.state.chunks.end.length,money:mcDebug.state.money,total:mcDebug.state.counts.V1})')
  assert after['count']==36 and after['total']==before['total']+1
  assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
  page.reload(wait_until='networkidle')
  assert page.evaluate('mcDebug.state.chunks.end.length')==36
  press('[data-nav="build"]');press('[data-expand-land]');choose()
  next_price=page.evaluate("async()=>{const {price}=await import('/src/game.js');const {ITEMS}=await import('/src/catalog.js');return price(mcDebug.state,ITEMS.V1)}")
  assert next_price>price
  press('#placement-cancel')
  page.screenshot(path=OUT/f'{engine}-{width}-after-reload.png')
  assert not errors,errors
  reports.append({'engine':engine,'viewport':[width,height],'before':before,'after':after,'quote':price,'debit':debit,'nextQuote':next_price,'confirmLabel':label,'errors':errors,'checks':['native canvas plot selection','cancel preserves land and money','confirm beyond old limit with exact charge','reload retains 36 end plots','next expansion still available and more expensive','no horizontal overflow']})
  print(json.dumps(reports[-1],ensure_ascii=False),flush=True)
  ctx.close();browser.close()
(OUT/'report.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2)+'\n')
