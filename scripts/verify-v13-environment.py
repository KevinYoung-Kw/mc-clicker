# Historical V1.3.0 checks: run at tag mc-clicker-v1.3.0. For current direct-use flows run verify-v131.py.
"""Actual preview-to-purchase and environment control regressions; 8890 dev server."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/qa/v13';seed=json.loads((OUT/'fixture.json').read_text());seed['reducedMotion']=False
report=[]
with sync_playwright() as p:
 for engine,width in [('chromium',1440),('webkit',390)]:
  b=getattr(p,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}));page=b.new_page(viewport={'width':width,'height':1000 if width>760 else 844},is_mobile=width<760,has_touch=width<760);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:8890/',wait_until='networkidle');page.wait_for_function('!!window.mcDebug?.world');page.evaluate('s=>mcDebug.setState(s)',seed);page.bring_to_front();page.evaluate("mcDebug.go('atlas')");page.locator('[data-detail="V19"]').first.click()
  for id in ['env-sundial','env-weather','env-rain','env-snow','env-stars']:
   page.locator('[data-env-preview="'+id+'"]').click();assert page.evaluate('mcDebug.world.environmentPreview?.id')==id,(engine,id,page.evaluate('mcDebug.world.environmentPreview?.id'))
   page.locator('[data-env-buy="'+id+'"]').click();page.locator('#placement-confirm').click();assert page.evaluate('mcDebug.world.environmentPreview===null')
  page.locator('[data-env-preview="env-rain"]').click();page.locator('[data-env-time-input]').evaluate("e=>{e.value='28';e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));}");assert page.evaluate('mcDebug.world.environmentPreview===null')
  for phase,name in [(720,'day'),(317,'dawn'),(1224,'dusk'),(28,'night')]:
   page.locator('[data-env-select]').select_option('clear');page.locator('[data-env-time-input]').evaluate('(e,v)=>{e.value=v;e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}));}',str(phase))
   page.wait_for_function('target=>Math.abs(mcDebug.world.atmosphereView.phase-target)<.006',arg=phase/1440,timeout=15000)
   # Keep room in the world without replacing real foreground rendering with forced ticks.
   page.locator('#panel-close').click();page.wait_for_timeout(700);page.screenshot(path=OUT/f'final-{engine}-{width}-{name}.png')
   if name=='night':
    current=page.evaluate("()=>({phase:mcDebug.world.atmosphereView.phase,background:mcDebug.world.scene.background.getHexString(),stars:mcDebug.world.atmosphereView.stars.visible,active:mcDebug.world.active})");assert current['stars'] and current['active'],current
   page.evaluate("mcDebug.go('atlas')");page.locator('[data-detail="V19"]').first.click()
  page.locator('[data-env-select]').select_option('snow');page.wait_for_function('mcDebug.world.atmosphereView.snow>.96',timeout=20000);page.locator('#panel-close').click();page.screenshot(path=OUT/f'final-{engine}-{width}-snow.png');page.evaluate("mcDebug.go('live')");page.wait_for_timeout(1500);assert page.evaluate('!mcDebug.world.atmosphereView.group.visible');page.screenshot(path=OUT/f'final-{engine}-{width}-window.png')
  report.append({'engine':engine,'width':width,'previewPurchaseAndSlider':True,'night':current,'errors':errors});assert not errors;print(engine,'environment passed',flush=True);b.close()
(OUT/'environment-report.json').write_text(json.dumps(report,indent=2))
