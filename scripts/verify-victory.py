"""Actual-route worlds in isolated Chromium/WebKit contexts. No player-save access."""
import argparse, json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--url',required=True);p.add_argument('--simulation',default='calibrated');args=p.parse_args()
out=ROOT/'docs/v1.1l/victory-cards';out.mkdir(parents=True,exist_ok=True)
report={'method':'Isolated browser UI on actual automated investment-route saves. These are not human playthroughs.','cases':[],'errors':[]}
with sync_playwright() as pw:
 for engine,width,height,route,legacy in [('chromium',1440,960,'livestream-first',False),('webkit',390,600,'no-livestream',False),('webkit',320,640,'industrial-first',True)]:
  seed=json.loads((ROOT/f'docs/v1.1l/simulation/{args.simulation}/{route}-save.json').read_text());seed['realm']='overworld'
  if legacy: seed.pop('victory',None);seed['version']=5
  browser=getattr(pw,engine).launch(**({'args':['--use-angle=metal']} if engine=='chromium' else {}))
  context=browser.new_context(viewport={'width':width,'height':height},is_mobile=width<700,has_touch=width<700,accept_downloads=True)
  context.add_init_script('if(!localStorage.getItem("mc-clicker-world-v2"))localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(seed))+')')
  context.add_init_script('Object.defineProperty(navigator,"canShare",{value:()=>true});Object.defineProperty(navigator,"share",{value:async data=>{window.lastShare={title:data.title,file:data.files?.[0]?.name,url:data.url};}})')
  page=context.new_page();page.on('pageerror',lambda error:report['errors'].append(str(error)));page.goto(args.url);page.wait_for_function('!!window.mcDebug && !!mcDebug.world')
  page.evaluate('window.dispatchEvent(new Event("blur")); mcDebug.showStats(true)');page.wait_for_selector('#generate-card')
  assert page.locator('[data-card-mode="victory"]').get_attribute('aria-pressed')=='true'
  assert ('当前建设' if legacy else '首次通关') in page.locator('[data-share-scene]').inner_text()
  page.evaluate('document.querySelector("#generate-card").addEventListener("click",()=>{window.captureBefore={state:JSON.stringify(mcDebug.state),camera:JSON.stringify(mcDebug.world.captureCamera()),scene:mcDebug.world.view,store:localStorage.getItem("mc-clicker-world-v2")};},true)')
  if engine=='chromium':
   # Exercise recoverable screenshot failure, not a permanently disabled button.
   page.evaluate('()=>{window.originalCapture=mcDebug.world.constructor.prototype.captureCurrentScene;mcDebug.world.constructor.prototype.captureCurrentScene=function(){throw Error("QA forced failure")};}')
   page.locator('#generate-card').click();page.wait_for_function('document.querySelector("#image-share-note").textContent.includes("暂时无法")');assert page.locator('#generate-card').is_enabled();assert page.locator('[data-victory-renderer]').count()==0
   page.evaluate('()=>{mcDebug.world.constructor.prototype.captureCurrentScene=window.originalCapture;}')
  page.locator('#generate-card').click();page.wait_for_selector('#share-card-preview canvas',timeout=90000)
  check=page.evaluate('''()=>({size:[document.querySelector('#share-card-preview canvas').width,document.querySelector('#share-card-preview canvas').height],stateUnchanged:JSON.stringify(mcDebug.state)===captureBefore.state,cameraUnchanged:JSON.stringify(mcDebug.world.captureCamera())===captureBefore.camera,sceneUnchanged:mcDebug.world.view===captureBefore.scene,storeUnchanged:localStorage.getItem('mc-clicker-world-v2')===captureBefore.store,rendererReleased:!document.querySelector('[data-victory-renderer]'),overflow:document.documentElement.scrollWidth>innerWidth})''')
  assert check['size']==[1440,1920],check
  assert all(check[k] for k in ['stateUnchanged','cameraUnchanged','sceneUnchanged','storeUnchanged','rendererReleased']),check
  assert not check['overflow'],check
  with page.expect_download() as download: page.locator('#download-card').click()
  name=f'{route}{"-legacy" if legacy else ""}.png';download.value.save_as(out/name)
  page.locator('#native-share-image').click();page.wait_for_function('window.lastShare?.file==="MC-Clicker-three-worlds.png"')
  page.locator('#native-share-link').click();assert page.evaluate('lastShare.url')=='https://www.kw-aigc.cn/projects/mc-clicker-2/'
  page.locator('#modal').evaluate('e=>{e.scrollTop=0}');page.locator('#share-panel').evaluate('e=>{e.scrollTop=0}');page.screenshot(path=str(out/f'{engine}-{width}-panel.png'))
  page.locator('[data-card-mode="current"]').click();page.locator('#generate-card').click();page.wait_for_function('document.querySelector("#share-card-preview canvas")?.height===1500')
  report['cases'].append({'engine':engine,'width':width,'height':height,'route':route,'legacy':legacy,'poster':name,**check,'currentCardStillAvailable':True,'nativeFileAndLink':True,'retry':engine=='chromium'})
  browser.close()
assert not report['errors'],report['errors']
(out/'observations.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False))
