"""Discovery and existing-facility recommendations using actual UI controls."""
from pathlib import Path
import argparse,json,subprocess
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://127.0.0.1:8894/');parser.add_argument('--cases',default='stock,job,level,power,opening');parser.add_argument('--out',default='docs/v1.6/qa/alpha3');args=parser.parse_args()
fixtures={kind:json.loads(subprocess.check_output(['node','scripts/discovery-fixture.mjs',kind],cwd=ROOT)) for kind in args.cases.split(',')}
out=ROOT/args.out;out.mkdir(parents=True,exist_ok=True)
reports=[]
with sync_playwright() as p:
 for engine,width in [('chromium',1440),('webkit',390),('chromium',320)]:
  browser=getattr(p,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}))
  for kind,fixture in fixtures.items():
   context=browser.new_context(viewport={'width':width,'height':900 if width>760 else 844},is_mobile=width<760,has_touch=width<760)
   context.add_init_script('if(!localStorage.getItem("mc-clicker-world-v2"))localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(fixture['state']))+')')
   page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   def press(selector):
    b=page.locator(selector).first;b.tap() if width<760 else b.click()
   def state():return page.evaluate('JSON.parse(localStorage.getItem("mc-clicker-world-v2"))')
   page.goto(args.url,wait_until='networkidle')
   press('[data-nav="build"]');page.wait_for_timeout(500)
   if width<760:
    press('#panel-expand');page.wait_for_timeout(500)
   expected=fixture['expected']
   if kind=='opening':
    assert len(expected)>2
    found=page.locator('.opening-stock [data-card]').evaluate_all('(els)=>els.map(e=>e.dataset.card)')
    assert sorted(found)==sorted(expected)
    press('#first-shop-all')
   found=page.locator('.cards [data-card]:not([data-purchase-state="locked"])').evaluate_all('(els)=>els.map(e=>e.dataset.card)')
   assert sorted(found)==sorted(expected),(kind,found,expected)
   assert page.locator('[data-open="owned"] .shop-upgrade-count').is_visible()
   page.locator(f'[data-card="{expected[-1]}"]').scroll_into_view_if_needed()
   panel=page.locator('#panel-content');scroll=panel.evaluate('e=>e.scrollTop')
   page.evaluate('window.stockNode=document.querySelector(".cards");window.stockFocus=document.querySelector(".cards [data-detail]")')
   page.wait_for_timeout(1200)
   assert page.evaluate('window.stockNode===document.querySelector(".cards")')
   assert abs(panel.evaluate('e=>e.scrollTop')-scroll)<2
   panel.evaluate('e=>e.scrollTop=0')
   if kind=='stock':
    assert len(expected)>5
    page.screenshot(path=str(out/f'discovery-{engine}-{width}.png'))
    press('[data-buy="T3"]');assert not state()['counts'].get('T3')
    press('#placement-cancel');assert not state()['counts'].get('T3')
    press('[data-open="owned"]')
    assert not page.locator('#panel').evaluate('e=>e.getAnimations().some(a=>a.playState==="running")')
    assert page.locator('.owned-section').first.locator('[data-card="V18"]').count()==1
    press('[data-open-postal]');assert page.locator('[data-postal-payback]').is_visible()
    assert page.locator('[data-mail-tab="postal"]').get_attribute('aria-pressed')=='true'
    press('[data-mail-upgrade]');assert state()['mail']['postalLevel']==2
   elif kind=='job':
    assert fixture['step']['job']=='farmer'
    press('[data-development]')
    candidate=page.locator('[data-workplace-card="farmer"] [data-job-assign]').first
    assert candidate.is_visible();person=candidate.get_attribute('data-job-assign')
    page.screenshot(path=str(out/f'discovery-job-{engine}-{width}.png'))
    press(f'[data-job-assign="{person}"][data-job="farmer"]')
    assert next(r for r in state()['community']['residents'] if r['id']==person)['job']=='farmer'
    press('[data-nav="build"]');assert page.locator('.development-suggestion').count()==0
    assert page.locator('[data-buy="T3"]').count()==1
   elif kind=='level':
    assert fixture['step']['id']=='M2'
    press('[data-development]');button=page.locator('[data-buy="M2"]').first
    assert button.get_attribute('title')=='升级熔炉'
    assert button.locator('.buy-action svg').is_visible()
    press('[data-buy="M2"]');assert state()['counts']['M2']==1
    press('#placement-confirm');assert state()['counts']['M2']==2
    press('[data-nav="build"]');assert page.locator('[data-buy="M3"]').get_attribute('data-purchase-state')=='ready'
   elif kind=='power':
    assert fixture['step']['kind']=='power',fixture['step']
    press('[data-development]');assert page.locator('[data-industry-tab="power"]').get_attribute('aria-pressed')=='true'
    press('[data-network-action="connect"][data-network-id="M2"]')
    assert state()['grid']['links']['M2'] is True
    assert state()['grid']['learnedConnection'] is True
   if kind in ['stock','opening']:
    press('[data-nav="build"]') if kind=='stock' else None
    for theme in ['', 'web-theme-backpack','web-theme-oak','web-theme-redstone','web-theme-end']:
     page.evaluate('(theme)=>document.body.dataset.theme=theme',theme)
     assert panel.evaluate('e=>e.scrollWidth<=e.clientWidth+1'),theme
     buttons=page.locator('.opening-buy').evaluate_all('(els)=>els.map(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}))')
     assert all(b['width']>=44 and b['height']>=44 for b in buttons),buttons
    if kind=='stock':
     panel.evaluate('e=>e.scrollTop=0');page.wait_for_timeout(500)
     page.screenshot(path=str(out/f'discovery-theme-{engine}-{width}.png'))
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
   assert panel.evaluate('e=>e.scrollWidth<=e.clientWidth+1')
   assert not errors,errors
   reports.append({'engine':engine,'width':width,'scenario':kind,'visibleGoods':len(expected),'stableList':True,'controls':True,'errors':errors})
   print(json.dumps(reports[-1],ensure_ascii=False),flush=True)
   context.close()
  browser.close()
target=out/'discovery-browser.json'
previous=json.loads(target.read_text()) if target.exists() else []
merged={(r['engine'],r['width'],r['scenario']):r for r in previous}
merged.update({(r['engine'],r['width'],r['scenario']):r for r in reports})
target.write_text(json.dumps(list(merged.values()),ensure_ascii=False,indent=2)+'\n')
