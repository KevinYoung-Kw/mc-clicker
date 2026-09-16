import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
fixture = json.loads(Path('/tmp/mc-resident-fixture.json').read_text())
out = ROOT / 'docs' / 'qa'
out.mkdir(exist_ok=True)
errors = []
observations = {}
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--use-angle=metal'])
    page = browser.new_page(viewport={'width':1360,'height':900}, device_scale_factor=1)
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://127.0.0.1:8890/', wait_until='networkidle')
    page.wait_for_function('window.mcDebug && window.mcDebug.world')
    page.screenshot(path=str(out/'80-residents-opening.png'))
    assert page.locator('[data-nav="village"]').is_hidden()
    page.evaluate('(s)=>window.mcDebug.setState(s)',fixture)
    page.locator('[data-nav="village"]').click()
    page.locator('.management-tabs [data-village-tab="residents"]').click()
    assert page.locator('[data-person]').count()==9
    page.locator('[data-person="resident-1"]').click()
    page.locator('[data-assign]').select_option('farmer')
    page.locator('[data-rename-input]').fill('阿木·种田能手')
    page.locator('[data-rename]').click()
    page.locator('[data-train]').click()
    page.wait_for_timeout(500)
    assert page.evaluate('mcDebug.state.community.residents[0].skills.farming')==2
    page.screenshot(path=str(out/'81-resident-ledger-desktop.png'))
    page.locator('[data-person="resident-2"]').click()
    page.locator('[data-assign]').select_option('rancher')
    page.locator('[data-person="resident-3"]').click()
    page.locator('[data-assign]').select_option('musician')
    page.locator('[data-nav="network"]').click()
    page.locator('[data-industry-tab="power"]').click()
    page.locator('[data-capacitor]').click()
    assert page.evaluate('mcDebug.state.grid.capacitor')==1
    page.screenshot(path=str(out/'82-industrial-power-desktop.png'))
    page.locator('[data-industry-tab="automation"]').click()
    page.locator('[data-auto="farm"]').select_option('1')
    assert page.evaluate('mcDebug.state.grid.automation.farm')==1
    page.locator('[data-nav="village"]').click()
    page.locator('[data-village-tab="helpers"]').click()
    page.locator('[data-person="golem-1"]').click()
    page.locator('[data-golem-upgrade="basket"]').click()
    assert page.evaluate('mcDebug.state.community.golems[0].upgrades.basket')==1
    page.evaluate('mcDebug.advance(100)')
    observations['residents']=page.evaluate('mcDebug.state.community.residents.map(r=>({id:r.id,name:r.name,job:r.job,status:r.status,base:r.baseEarned,contribution:r.jobEarned}))')
    observations['golems']=page.evaluate('mcDebug.state.community.golems')
    assert all(r['contribution']>0 for r in observations['residents'][:3])
    assert observations['golems'][0]['delivered']>0
    page.screenshot(path=str(out/'83-copper-helper-desktop.png'))
    page.locator('[data-nav="world"]').click()
    page.wait_for_timeout(700)
    page.screenshot(path=str(out/'84-residents-world.png'))
    observations['modelIdentities']=page.evaluate('mcDebug.world.walkers.filter(a=>a.person).map(a=>({id:a.person.id,modelResident:a.root.userData.resident,modelGolem:a.root.userData.golem,visible:a.root.visible,x:a.x,z:a.z,simulationX:a.person.x,simulationZ:a.person.z}))')
    for a in observations['modelIdentities'][:3]:
        assert abs(a['x']-a['simulationX'])<0.01 and abs(a['z']-a['simulationZ'])<0.01
    saved=page.evaluate('mcDebug.state')
    page.close()
    mobile=browser.new_context(viewport={'width':390,'height':844}, device_scale_factor=1, is_mobile=True, has_touch=True)
    page=mobile.new_page()
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://127.0.0.1:8890/',wait_until='networkidle')
    page.evaluate('(s)=>mcDebug.setState(s)',saved)
    page.locator('[data-nav="village"]').click()
    page.locator('.management-tabs [data-village-tab="residents"]').click()
    page.locator('[data-person="resident-1"]').click()
    page.screenshot(path=str(out/'85-resident-phone.png'))
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.locator('[data-nav="network"]').click()
    page.locator('[data-industry-tab="power"]').click()
    page.screenshot(path=str(out/'86-power-phone.png'))
    assert page.locator('[data-generation]').is_visible()
    # Genuine touch pointer holds exercise the same controls as phones.
    page.locator('[data-crank]').scroll_into_view_if_needed()
    box=page.locator('[data-crank]').bounding_box()
    cdp=page.context.new_cdp_session(page)
    page.evaluate('mcDebug.state.grid.spent=0')
    before=page.evaluate('mcDebug.state.grid.generated')
    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':box['x']+20,'y':box['y']+20}]})
    page.wait_for_timeout(550)
    cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    assert page.evaluate('mcDebug.state.grid.generated')>before
    page.wait_for_timeout(300)
    assert page.evaluate('mcDebug.state.grid.crank')==0
    page.evaluate('window.dispatchEvent(new Event("blur"))')
    frozen=page.evaluate('JSON.stringify([mcDebug.state.money,mcDebug.state.energy,mcDebug.state.play,mcDebug.state.community])')
    page.wait_for_timeout(1000)
    assert page.evaluate('JSON.stringify([mcDebug.state.money,mcDebug.state.energy,mcDebug.state.play,mcDebug.state.community])')==frozen
    page.evaluate('window.dispatchEvent(new Event("focus"))')
    page.wait_for_timeout(250)
    assert page.evaluate('mcDebug.state.play')>json.loads(frozen)[2]
    observations['mobileTouchAndBackgroundPause']=True
    page.evaluate('mcDebug.save()')
    name=page.evaluate('mcDebug.state.community.residents[0].name')
    page.reload(wait_until='networkidle')
    assert page.evaluate('mcDebug.state.community.residents[0].name')==name
    assert page.evaluate('mcDebug.state.community.residents[0].job')=='farmer'
    page.locator('[data-nav="village"]').click()
    page.locator('.management-tabs [data-village-tab="residents"]').click()
    page.locator('[data-person="resident-1"]').click()
    page.locator('[data-person-focus="resident-1"]').click()
    page.wait_for_timeout(500)
    assert page.evaluate('mcDebug.world.focusedCompanion')=='resident-1'
    assert page.evaluate('mcDebug.world.zoom')<1
    page.screenshot(path=str(out/'87-find-my-resident-phone.png'))
    observations['errors']=errors
    observations['mobileOverflow']=page.evaluate('document.documentElement.scrollWidth>innerWidth')
    assert not errors, errors
    (out/'residents-observations.json').write_text(json.dumps(observations,ensure_ascii=False,indent=2))
    browser.close()
print(json.dumps({'ok':True,'screenshots':8,'errors':errors},ensure_ascii=False))
