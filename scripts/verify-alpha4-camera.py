"""Normal-motion menu transitions sampled on every animation frame, isolated seed."""
import argparse,json
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1];a=argparse.ArgumentParser();a.add_argument('--url',default='http://127.0.0.1:8971/');a.add_argument('--seed',default=str(root/'docs/v2.0.0/qa/alpha4-camera/fixture.json'));a.add_argument('--out',default='docs/v2.0.0/qa/alpha4-camera');args=a.parse_args();out=root/args.out;out.mkdir(parents=True,exist_ok=True)
seed=json.loads(Path(args.seed).read_text());seed['reducedMotion']=False;results=[]
with sync_playwright() as pw:
 for engine,w in [('chromium',1440),('chromium',390),('webkit',390)]:
  b=getattr(pw,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}));c=b.new_context(viewport={'width':w,'height':844},is_mobile=w<760,has_touch=w<760);c.add_init_script('localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(seed))+')');p=c.new_page();errs=[];p.on('pageerror',lambda e:errs.append(str(e)));p.goto(args.url,wait_until='networkidle');p.wait_for_timeout(700)
  if w>760:p.mouse.move(w*.4,300);p.mouse.wheel(0,-180);p.wait_for_timeout(500)
  frames=[]
  def monitor():p.evaluate('''()=>{window.qaRects=[];const start=performance.now();function step(){const r=document.querySelector('#world canvas').getBoundingClientRect();qaRects.push([r.x,r.y,r.width,r.height]);if(performance.now()-start<450)requestAnimationFrame(step);}step();}''')
  def verify():
   p.wait_for_timeout(480);r=p.evaluate('qaRects');assert len(r)>3;assert all(max(abs(a-b) for a,b in zip(row,r[0]))<.5 for row in r);frames.append(len(r))
  for i in range(3):
   monitor();p.locator('[data-nav="build"]').click();verify()
   if w<760:
    monitor();p.locator('#panel-expand').click();verify()
    monitor();p.locator('#panel-expand').click();verify()
    grip=p.locator('.drawer-handle').bounding_box();monitor()
    if engine=='chromium':
     dev=c.new_cdp_session(p);x=grip['x']+grip['width']/2;y=grip['y']+grip['height']/2
     dev.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
     for dy in [12,30,50,80]:dev.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x,'y':y+dy}]})
     dev.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});dev.detach()
    else:
     x=grip['x']+grip['width']/2;y=grip['y']+grip['height']/2;p.mouse.move(x,y);p.mouse.down();p.mouse.move(x,y+80,steps=6);p.mouse.up()
    verify();assert not p.locator('#game').evaluate('e=>e.classList.contains("panel-open")')
   else:monitor();p.locator('#panel-close').click();verify()
  assert not errs;results.append({'engine':engine,'width':w,'reducedMotion':False,'frameSamples':sum(frames),'maxCanvasDisplacementPx':'<0.5','touchDragClose':engine=='chromium' and w<760,'noErrors':True});print(results[-1],flush=True);(out/'report.json').write_text(json.dumps(results,indent=2)+'\n');b.close()
