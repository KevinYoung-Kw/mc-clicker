"""Visual QA with an isolated funded all-facility fixture, not a human playthrough."""
import argparse,json,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--url',required=True);args=p.parse_args()
out=ROOT/'docs/v1.1l/dimensional-scenes';out.mkdir(parents=True,exist_ok=True)
seed=json.loads(subprocess.check_output(['node','--input-type=module','-e','import {completeFixture} from "./scripts/fixtures.mjs";console.log(JSON.stringify(completeFixture()));'],cwd=ROOT,text=True));seed['realm']='nether';seed['money']=1e20;seed['reducedMotion']=False
report={'method':'Funded test fixture; purchases use buyUpgrade(), transitions use actual advance(). Not a balance run or human play.','errors':[],'scenes':[]}
with sync_playwright() as pw:
 browser=pw.chromium.launch(args=['--use-angle=metal']);context=browser.new_context(viewport={'width':1440,'height':960})
 context.add_init_script('localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(seed))+')');page=context.new_page();page.on('pageerror',lambda err:report['errors'].append(str(err)))
 page.goto(args.url);page.wait_for_function('!!window.mcDebug');page.evaluate('''async()=>{const {UPGRADE_CATALOG,buyUpgrade}=await import('/src/upgrades.js');for(let i=0;i<3;i++)for(const row of UPGRADE_CATALOG)while(buyUpgrade(mcDebug.state,row.id).ok){};mcDebug.setState(mcDebug.state);}''')
 for realm in ['nether','end']:
  page.evaluate('(realm)=>{const s=structuredClone(mcDebug.state);s.realm=realm;mcDebug.setState(s);mcDebug.world.home();}',realm);page.wait_for_timeout(650)
  path=out/f'{realm}-upgraded.png';page.screenshot(path=str(path));report['scenes'].append({'realm':realm,'image':path.name,'drawCalls':page.evaluate('mcDebug.world.renderer.info.render.calls')})
 page.evaluate('mcDebug.go("network")');page.locator('[data-industry-tab="logistics"]').click();page.locator('.dimension-logistics').scroll_into_view_if_needed();page.screenshot(path=str(out/'logistics-status.png'))
 assert page.locator('[data-facility-work="N3"]').inner_text().startswith('蓄热')
 assert '份' in page.locator('[data-facility-work="E9"]').inner_text()
 report['management']={'heat':page.locator('[data-facility-work="N3"]').inner_text(),'dragon':page.locator('[data-facility-work="E9"]').inner_text()}
 browser.close()
assert not report['errors'],report['errors']
(out/'observations.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False))
