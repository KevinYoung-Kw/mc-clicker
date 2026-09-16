import json
from pathlib import Path
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1];out=R/'docs/v1.8/qa/live-1.8.1/browser';out.mkdir(parents=True,exist_ok=True)
seed=json.loads((R/'docs/v1.6/qa/stability-baseline/fixtures/peak.json').read_text());seed.update(money=1e8,reducedMotion=True,energy=0)
seed['guidance']['notices']=False;seed['narrative'].update(companionsShown=True,intro='released')
for r in seed['community']['residents']:r.update(job='idle',prioritySource=None,cargo=None)
for g in seed['community']['golems']:g.update(stops=[],cargo=None)
seed['community'].update(batches=[],tasks={})
for k in seed['grid']['automation']:seed['grid']['automation'][k]=0
for b in seed['buffers'].values():b.update(raw=0,goods=0)
seed['live']['gifts']=[];seed['harvest'].update(piston=0,treasure=0)
seed['dimensions'].update(heat=0,trips={},awaiting={'endRaw':0,'endGoods':0})
reports=[]
with sync_playwright() as p:
 for engine,width in [('chromium',1440),('webkit',390),('chromium',320)]:
  browser=getattr(p,engine).launch(headless=True);ctx=browser.new_context(viewport={'width':width,'height':844},is_mobile=width<760,has_touch=width<760)
  ctx.add_init_script('if(!localStorage.getItem("mc-clicker-world-v2"))localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(seed))+')')
  page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def click(s):page.locator(s).first.click()
  page.goto('https://www.kw-aigc.cn/projects/mc-clicker-2/',wait_until='networkidle');page.evaluate('window.dispatchEvent(new Event("blur"))')
  assert 'V1.8.1' in page.title();assert page.evaluate('typeof mcDebug')=='undefined'
  click('[data-nav="atlas"]');click('[data-detail="V18"]');click('[data-mail-store]');click('#store-cancel');assert page.locator('[data-mail-store]').is_visible()
  click('[data-mail-store]');click('#store-confirm');assert page.locator('[data-buy="V18"]').inner_text().strip()=='免费摆回'
  page.reload(wait_until='networkidle');page.evaluate('window.dispatchEvent(new Event("blur"))')
  click('[data-nav="atlas"]');click('[data-detail="V18"]');assert page.locator('[data-buy="V18"]').inner_text().strip()=='免费摆回'
  click('[data-buy="V18"]');assert page.locator('#placement-confirm').is_visible();click('#placement-cancel')
  click('[data-nav="village"]');click('[data-village-tab="housing"]');click('[data-home-tab="build"]')
  for kind in ['cottage','oak','hearth']:assert page.locator('[data-home-product="'+kind+'"]').count()==1
  page.wait_for_function('document.querySelector("[data-home-product=cottage] img")?.naturalWidth>0')
  page.locator('[data-home-product="cottage"]').scroll_into_view_if_needed();page.screenshot(path=str(out/f'housing-{engine}-{width}.png'))
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  if not page.locator('#info-open').is_visible():click('#hud-more')
  click('#info-open');click('#info-tab-versions');assert 'V1.8.1' in page.locator('#info-versions').inner_text()
  assert not errors,errors
  reports.append({'engine':engine,'width':width,'version':'1.8.1','noDebug':True,'mailStoreCancelReload':True,'freePlacementEntry':True,'threeBasicHomes':True,'versionHistory':True,'noOverflow':True,'errors':errors});browser.close()
(out/'report.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2));print(reports)
