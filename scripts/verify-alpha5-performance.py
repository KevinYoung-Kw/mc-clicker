import json,base64,statistics
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image,ImageChops
root=Path(__file__).resolve().parents[1];out=root/'docs/v2.0.0/qa/alpha5-performance';out.mkdir(parents=True,exist_ok=True);seed=json.loads((root/'docs/v2.0.0/qa/alpha5/fixture.json').read_text());results=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,args=['--use-angle=metal'])
 for edition,urls in [('web',[8977,8975]),('xhs',[8978,8976])]:
  for width in [1440,390]:
   for n,port in enumerate(urls):
    c=b.new_context(viewport={'width':width,'height':844},device_scale_factor=2 if width<760 else 1,is_mobile=width<760,has_touch=width<760);p=c.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.goto(f'http://127.0.0.1:{port}/scripts/qa-alpha5/probe.html',wait_until='networkidle');p.wait_for_function('!!window.probe');p.evaluate('s=>probe.setup(s)',seed)
    times=p.evaluate('probe.place("M7")');url=p.evaluate('probe.shot()');file=out/f'{edition}-{width}-{n}.png';file.write_bytes(base64.b64decode(url.split(',')[1]));p.evaluate('probe.start()');p.wait_for_timeout(9000)
    data=p.evaluate('''()=>{const f=probe.frames;probe.stop();const start=f[0].at,end=f[f.length-1].at;const tail=f.filter(x=>x.at>end-4000);return {fps:1000*(tail.length-1)/(tail[tail.length-1].at-tail[0].at),costs:tail.map(x=>x.ms),scheduled:probe.world.framePacer?.fps||null};}''')
    costs=sorted(data.pop('costs'));data.update({'edition':edition,'width':width,'revision':['before','after'][n],'placementMedianMs':statistics.median(times),'renderP95Ms':costs[int(len(costs)*.95)],'errors':errors});assert not errors;results.append(data);print(data,flush=True);c.close()
   left=Image.open(out/f'{edition}-{width}-0.png').convert('RGB');right=Image.open(out/f'{edition}-{width}-1.png').convert('RGB');assert left.size==right.size
   diff=ImageChops.difference(left,right);pixels=list(diff.getdata());changed=sum(max(p)>0 for p in pixels)/len(pixels);mean=sum(sum(p) for p in pixels)/(3*len(pixels));assert changed<=.05,(edition,width,changed)
   results[-1].update({'changedPixelFraction':changed,'meanChannelDifference':mean});(out/'report.json').write_text(json.dumps(results,indent=2))
 b.close()
