"""Smoke the built bundle without development helpers; isolated old saves."""
from pathlib import Path
import json, argparse
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:8891/')
parser.add_argument('--out', default='docs/v1.4/qa')
args=parser.parse_args();OUT=ROOT/args.out;OUT.mkdir(parents=True,exist_ok=True)
seed=json.loads((ROOT/'docs/qa/v13/fixture.json').read_text());seed['grid']['links']['M9']=False
seed['grid']['disabled']=[];seed['money']=1000000;seed['savedAt']=1
results=[]
with sync_playwright() as p:
 for engine,width in [('chromium',1440),('webkit',390)]:
  b=getattr(p,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}))
  for legacy in [False,True]:
   c=b.new_context(viewport={'width':width,'height':900 if width>760 else 844},is_mobile=width<760,has_touch=width<760)
   if legacy:c.add_init_script('localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(seed))+')')
   page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(args.url,wait_until='networkidle');page.wait_for_selector('#world canvas')
   assert page.evaluate('typeof window.mcDebug')=='undefined'
   if not legacy:
    assert json.loads((ROOT/'package.json').read_text())['version'] in page.title();assert page.locator('#money').inner_text()=='0'
    page.locator('#mine').tap() if width<760 else page.locator('#mine').click()
    assert page.locator('#money').inner_text()!='0'
   else:
    page.locator('[data-nav="network"]').click();page.locator('[data-industry-tab="power"]').click()
    page.locator('[data-network-action="connect"][data-network-id="M9"]').click()
    assert page.evaluate('JSON.parse(localStorage.getItem("mc-clicker-world-v2")).grid.links.M9') is True
    page.locator('[data-network-action="toggle"][data-network-id="M9"]:visible').click()
    assert page.evaluate('JSON.parse(localStorage.getItem("mc-clicker-world-v2")).grid.disabled.includes("M9")')
    page.evaluate('window.dispatchEvent(new Event("blur"))')
    assert page.locator('#foreground-status').is_visible()
    money=page.locator('#money').inner_text();page.wait_for_timeout(3100)
    assert page.locator('#money').inner_text()==money,'background income paused'
   page.screenshot(path=OUT/f'production-{engine}-{width}-{"legacy" if legacy else "fresh"}.png')
   assert not errors,errors
   results.append(dict(engine=engine,width=width,legacy=legacy,noDebug=True,errors=errors));c.close()
  b.close()
(OUT/'production-report.json').write_text(json.dumps(results,indent=2)+'\n');print('Production: 4 fresh/legacy scenarios passed')
