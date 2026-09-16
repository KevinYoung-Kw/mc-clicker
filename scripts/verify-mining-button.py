"""V1.5.4: collection-button fill in place, using the actual input/simulation path."""
from pathlib import Path
import argparse,json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://127.0.0.1:8890/');parser.add_argument('--out',default='docs/v1.5.4/qa');parser.add_argument('--fixture');args=parser.parse_args()
OUT=ROOT/args.out;OUT.mkdir(parents=True,exist_ok=True);results=[]
with sync_playwright() as p:
 for engine,width in [('chromium',1440),('webkit',390),('chromium',320)]:
  browser=getattr(p,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}))
  context=browser.new_context(viewport={'width':width,'height':844},is_mobile=width<760,has_touch=width<760)
  if args.fixture:context.add_init_script('localStorage.setItem("mc-clicker-world-v2",'+json.dumps(Path(args.fixture).read_text())+')')
  page=context.new_page();page.set_default_timeout(15000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(args.url,wait_until='networkidle');page.wait_for_selector('#mine');page.wait_for_timeout(500)
  if not args.fixture:
   page.evaluate('''async()=>{const {fresh}=await import('/src/game.js');const s=fresh();s.counts={T1:1,T2:1,T3:1};s.guidance.info=true;s.guidance.notices=false;s.narrative.companionsShown=true;mcDebug.setState(s)}''')
  else:assert page.evaluate('typeof mcDebug')=='undefined'
  assert page.locator('#mining-combo,.mining-combo').count()==0
  assert page.locator('#mine [role=progressbar]').count()==0
  assert page.locator('#mine').evaluate("el=>getComputedStyle(el).webkitUserSelect")=='none'
  def value():return float(page.locator('#mine').evaluate("el=>el.style.getPropertyValue('--mining-progress')"))
  def scale():return page.locator('#mine').evaluate("el=>Number(getComputedStyle(el,'::after').transform.split('(')[1].split(',')[0])")
  def photo(name):
   page.screenshot(path=str(OUT/f'{name}-{engine}-{width}.png'));assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  before=page.locator('#mine').bounding_box();assert value()==0;photo('empty')
  if engine=='chromium' and width<760:
   client=context.new_cdp_session(page);client.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':before['x']+before['width']/2,'y':before['y']+before['height']/2}]})
  else:
   page.mouse.move(before['x']+before['width']/2,before['y']+before['height']/2);page.mouse.down()
  page.wait_for_timeout(4000);assert value()==1;assert scale()>.98;photo('full')
  assert page.locator('#mine').get_attribute('aria-label').endswith('×1.60')
  assert page.locator('#mine').evaluate("el=>getComputedStyle(el,'::after').animationName")=='none'
  if engine=='chromium' and width<760:client.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
  else:page.mouse.up()
  page.wait_for_timeout(1300);mid=value();assert 0<mid<1;assert .01<scale()<.99;photo('decaying')
  page.wait_for_timeout(2400);assert value()==0;assert scale()<.001
  after=page.locator('#mine').bounding_box();assert abs(before['height']-after['height'])<1;assert abs(before['y']-after['y'])<1
  assert page.locator('#mine').get_attribute('aria-label').endswith('×1.00')
  if not args.fixture:
   for theme in ['backpack','oak','redstone','end']:
    page.evaluate('''theme=>{const s=mcDebug.state,id='web-theme-'+theme;s.webAppearance.owned[id]=true;s.webAppearance.equipped.theme=id;mcDebug.setState(s);mcDebug.state.combo=15;mcDebug.state.lastClick=mcDebug.state.play;mcDebug.advance(0)}''',theme)
    page.wait_for_timeout(200);photo('theme-'+theme)
   page.evaluate('mcDebug.setState({...mcDebug.state,reducedMotion:true})');assert page.locator('#mine').evaluate("el=>getComputedStyle(el,'::after').transitionDuration")=='0s'
  assert not errors,errors;results.append({'engine':engine,'width':width,'fillAtPeak':1,'releasedFill':mid,'fillAtRest':0,'buttonBoundsStable':True,'separateMeter':False,'errors':errors});print(json.dumps(results[-1]),flush=True);browser.close()
(OUT/'button-report.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
