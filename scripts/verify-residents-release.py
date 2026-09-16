import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
url=os.environ.get('MC_RELEASE_URL','http://127.0.0.1:8891/projects/mc-clicker-2/')
fixture=json.loads(Path('/tmp/mc-resident-fixture.json').read_text())
errors=[]; failed=[]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--use-angle=metal'])
    context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=1)
    page=context.new_page()
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('response',lambda r:failed.append({'url':r.url,'status':r.status}) if r.status>=400 else None)
    page.goto(url,wait_until='networkidle')
    assert page.evaluate('typeof window.mcDebug')=='undefined'
    assert page.locator('[data-nav="village"]').is_hidden()
    # Isolated QA browser storage; the player's browser/save is never touched.
    page.add_init_script('if(!sessionStorage.getItem("resident-qa-seeded")){localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(fixture))+');sessionStorage.setItem("resident-qa-seeded","1");}')
    page.reload(wait_until='networkidle')
    page.locator('[data-nav="village"]').tap()
    page.locator('.management-tabs [data-village-tab="residents"]').tap()
    assert page.locator('[data-person]').count()==9
    page.locator('[data-person="resident-1"]').tap()
    page.locator('[data-assign]').select_option('farmer')
    page.locator('[data-rename-input]').fill('田间的阿木')
    page.locator('[data-rename]').tap()
    page.locator('[data-train]').tap()
    saved=page.evaluate('JSON.parse(localStorage.getItem("mc-clicker-world-v2"))')
    assert saved['community']['residents'][0]['name']=='田间的阿木'
    assert saved['community']['residents'][0]['job']=='farmer'
    assert saved['community']['residents'][0]['skills']['farming']==2
    assert saved['community']['residents'][1]['skills'].get('farming',1)==1
    page.locator('[data-nav="network"]').tap()
    page.locator('[data-industry-tab="power"]').tap()
    page.locator('[data-capacitor]').tap()
    assert page.locator('[data-energy]').is_visible()
    page.screenshot(path=str(ROOT/'docs/qa/88-residents-release-phone.png'))
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.locator('[data-industry-tab="automation"]').tap()
    page.locator('[data-auto="farm"]').select_option('1')
    page.locator('[data-nav="village"]').tap()
    page.locator('[data-village-tab="helpers"]').tap()
    page.locator('[data-person="golem-1"]').tap()
    page.locator('[data-golem-upgrade="basket"]').tap()
    saved=page.evaluate('JSON.parse(localStorage.getItem("mc-clicker-world-v2"))')
    assert saved['grid']['capacitor']==1
    assert saved['grid']['automation']['farm']==1
    assert saved['community']['golems'][0]['upgrades']['basket']==1
    page.reload(wait_until='networkidle')
    page.locator('[data-nav="village"]').tap()
    page.locator('.management-tabs [data-village-tab="residents"]').tap()
    assert page.locator('[data-person="resident-1"]').inner_text().startswith('田间的阿木')
    assert not errors, errors
    assert not failed, failed
    observation={'url':url,'debugAbsent':True,'residentCount':9,'nameJobAndPersonalBookPersist':True,'individualGolemUpgrade':True,'powerAndAutomation':True,'mobileOverflow':False,'errors':errors,'failedRequests':failed}
    (ROOT/'docs/qa/residents-release-observations.json').write_text(json.dumps(observation,ensure_ascii=False,indent=2))
    browser.close()
print(json.dumps(observation,ensure_ascii=False))
