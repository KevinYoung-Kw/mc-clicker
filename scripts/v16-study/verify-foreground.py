"""Real tab visibility and history return, without Playwright's focus emulation."""
import argparse,json,subprocess,tempfile,time
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2];parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://127.0.0.1:8890/');parser.add_argument('--out',required=True);args=parser.parse_args();out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
fixture=json.loads(subprocess.check_output(['node','--input-type=module','-e','''import{fresh,buy}from'./src/game.js';const s=fresh(42);s.money=1000;for(const id of ['T1','V1','V18'])buy(s,id);s.guidance.notices=false;s.savedAt=1;console.log(JSON.stringify(s));'''],cwd=root))
report={'method':'Standalone Chromium; CDP no_defaults=True; native visibilitychange, blur/focus and pagehide/pageshow','errors':[],'limitation':'Not a physical OS lock-screen or WeChat test.'}
def persist(): (out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
with sync_playwright() as p,tempfile.TemporaryDirectory(prefix='mc-foreground-') as temp:
 proc=subprocess.Popen([p.chromium.executable_path,'--headless=new','--use-angle=metal','--remote-debugging-port=0','--user-data-dir='+temp,'--no-first-run','--no-default-browser-check','about:blank'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  portfile=Path(temp)/'DevToolsActivePort'
  for _ in range(100):
   if portfile.exists():break
   time.sleep(.1)
  browser=p.chromium.connect_over_cdp('http://127.0.0.1:'+portfile.read_text().splitlines()[0],no_defaults=True);context=browser.contexts[0];page=context.pages[0];page.set_viewport_size({'width':390,'height':844});page.on('pageerror',lambda e:report['errors'].append(str(e)))
  page.goto(args.url,wait_until='networkidle');page.wait_for_function('window.mcDebug');page.evaluate('s=>mcDebug.setState(s)',fixture);page.bring_to_front();page.locator('#mine').click();page.wait_for_timeout(300)
  page.evaluate('window.__lifecycle=[];for(const name of ["visibilitychange","pagehide","pageshow","blur","focus"])window.addEventListener(name,()=>__lifecycle.push({name,hidden:document.hidden,time:performance.now(),money:mcDebug.state.money}))')
  def snapshot(label):
   result=page.evaluate('()=>({money:mcDebug.state.money,play:mcDebug.state.play,hidden:document.hidden,focused:document.hasFocus(),active:mcDebug.world.active,camera:mcDebug.world.captureCamera()})');report[label]=result;persist();return result
  before=snapshot('before');page.wait_for_timeout(5000);active=snapshot('active');assert 4.4<active['money']-before['money']<5.6
  other=context.new_page();other.goto('about:blank');other.bring_to_front();hidden=snapshot('hidden');assert hidden['hidden'] and not hidden['active']
  other.wait_for_timeout(15000);waiting=snapshot('after15SecondsAway');assert waiting['money']==hidden['money'];assert waiting['play']==hidden['play']
  page.bring_to_front();page.wait_for_timeout(150);resumed=snapshot('resumed');assert not resumed['hidden'] and resumed['active'];assert resumed['money']-waiting['money']<.5
  page.wait_for_timeout(5000);after=snapshot('after5SecondsActive');assert 4.4<after['money']-resumed['money']<5.6
  report['events']=page.evaluate('window.__lifecycle');page.goto('about:blank');page.go_back(wait_until='networkidle');page.wait_for_function('window.mcDebug');page.bring_to_front();page.locator('#mine').click();start=snapshot('historyReturn');page.wait_for_timeout(2000);returned=snapshot('historyResumed');assert returned['money']>start['money']+1.5
  assert page.locator('#world canvas').is_visible();assert not report['errors'],report['errors'];report['passed']=True;persist();print('real background pause / resume / history return passed',flush=True)
  context.new_cdp_session(page).send('Browser.close')
 finally:
  persist()
  try:proc.wait(timeout=3)
  except subprocess.TimeoutExpired:
   proc.terminate()
   try:proc.wait(timeout=3)
   except subprocess.TimeoutExpired:proc.kill();proc.wait(timeout=3)
