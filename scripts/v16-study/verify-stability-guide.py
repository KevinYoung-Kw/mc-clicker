"""Release-build help copy and small-screen layout through existing menu controls."""
from pathlib import Path
import argparse,json
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://127.0.0.1:8894/');parser.add_argument('--out',default='docs/v1.6/qa/stability-fixed/guide');args=parser.parse_args();out=Path(args.out);out.mkdir(parents=True,exist_ok=True);fixture=json.loads(Path('docs/v1.6/qa/stability-baseline/fixtures/peak.json').read_text());fixture['narrative'].update({'intro':'released','companionsShown':True,'legacy':True});fixture['guidance']['notices']=False;report=[]
with sync_playwright() as p:
 for engine,width in [('chromium',1440),('webkit',390),('chromium',320)]:
  browser=getattr(p,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}));mobile=width<760;context=browser.new_context(viewport={'width':width,'height':844},is_mobile=mobile,has_touch=mobile);context.add_init_script('localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(fixture))+')');page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def press(q):
   loc=page.locator(q).first;loc.tap() if mobile else loc.click()
  page.goto(args.url,wait_until='networkidle');assert '1.6.0-alpha.5' in page.title();assert page.evaluate('typeof window.mcDebug')=='undefined'
  if mobile:press('#hud-more');press('#quick-help')
  else:press('#settings');press('#basic-help')
  text=page.locator('#info-panel').inner_text()
  for phrase in ['搬动与转向','搬运与成交','新设备需要接入电网','储电升级只增加容量']:assert phrase in text,phrase
  assert '直播间建成后会自动接电' not in text
  assert page.locator('#modal').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
  page.screenshot(path=str(out/f'guide-{engine}-{width}.png'));press('#info-return');assert not page.locator('#modal').evaluate('e=>e.open');assert not errors,errors;report.append({'engine':engine,'width':width,'version':'1.6.0-alpha.5','noDebug':True,'existingGuideEntry':True,'newCopy':True,'overflow':False,'errors':errors});context.close();browser.close()
(out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print('3 guide layouts passed',flush=True)
