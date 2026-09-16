import json
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
out=root/'docs/qa'
errors=[];results=[]
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--use-angle=metal'])
 for width,height in [(1360,900),(390,844),(320,720)]:
  c=b.new_context(viewport={'width':width,'height':height},is_mobile=width<760,has_touch=width<760);page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:8890/');page.wait_for_load_state('networkidle')
  page.evaluate("async()=>{const{completeFixture}=await import('/scripts/fixtures.mjs');const s=completeFixture();s.sharing={unlocked:true,unlockedAt:0};s.reducedMotion=true;mcDebug.setState(s)}")
  page.locator('#share-open').click();page.locator('#share-panel').wait_for();page.wait_for_timeout(200)
  assert page.locator('#share-card-preview canvas').count()==0
  page.screenshot(path=str(out/f'share-{width}-initial.png'))
  report={'width':width,'initialCanvas':0,'modal':page.locator('#modal').bounding_box(),'initialOverflow':page.locator('#modal').evaluate('(el)=>el.scrollWidth>el.clientWidth')}
  assert not report['initialOverflow'],report
  for selector in ['#generate-card','#copy-link','#native-share-link','#share-return']:
   assert page.locator(selector).bounding_box()['height']>=44,selector
  page.locator('#generate-card').click();page.wait_for_timeout(1100)
  if page.locator('#share-card-preview canvas').count():
   page.locator('#modal').evaluate('(el)=>el.scrollTop=0');page.screenshot(path=str(out/f'share-{width}-generated.png'))
   report['generated']=True
   report['preview']=page.locator('#share-card-preview canvas').bounding_box()
   assert not page.locator('#modal').evaluate('(el)=>el.scrollWidth>el.clientWidth')
  else:report['generated']=False;report['note']=page.locator('#image-share-note').inner_text()
  page.locator('.share-details summary').click();page.locator('#share-return').scroll_into_view_if_needed();page.screenshot(path=str(out/f'share-{width}-lower.png'))
  report['bottomReachable']=page.locator('#share-return').bounding_box()['y']<height
  results.append(report);c.close()
 b.close()
report={'results':results,'errors':errors};(out/'share-css-observations.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report));assert not errors
