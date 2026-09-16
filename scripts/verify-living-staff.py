"""Check actual staff assignment, room identities and income in the Vite browser.

Uses isolated saves and the existing development clock only to skip waiting.
Job choices, hosting, room arrangement and person selection use the actual UI.
"""
import argparse
import json
from pathlib import Path
import subprocess
import sys
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/qa'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:8890/')
parser.add_argument('--label', default='dev')
args = parser.parse_args()
assert args.label.replace('-', '').isalnum()
prefix = f'living-staff-{args.label}'
fixture = json.loads(subprocess.run(['node', 'scripts/resident-fixture.mjs'], cwd=ROOT, text=True, capture_output=True, check=True).stdout)
report = {'url': args.url, 'checks': {}, 'observations': {}, 'errors': [], 'failedRequests': []}
pause = """window.__livingPause=true;
const realFocus=document.hasFocus.bind(document);
Object.defineProperty(document,'hasFocus',{configurable:true,value:()=>!window.__livingPause&&realFocus()});"""

def tap(page, selector, touch=False):
    el = page.locator(selector).first
    el.wait_for(state='visible')
    el.tap() if touch else el.click()
    page.wait_for_timeout(80)

def shot(page, name):
    page.evaluate('mcDebug.world.update(true)')
    page.screenshot(path=str(OUT / f'{prefix}-{name}.png'))

def observe(page):
    return page.evaluate("""async()=>{
      const {studioResidents,activeHost,residentBase}=await import('/src/residents.js');
      const {companionActors}=await import('/src/operations.js');
      const s=mcDebug.state,w=mcDebug.world,staff=studioResidents(s),models=[];
      w.graph.traverse(o=>{if(o.userData.resident)models.push({id:o.userData.resident,room:o.userData.room,position:o.position.toArray(),rig:o.userData.residentRig,action:o.userData.residentMotion?.action})});
      return {play:s.play,money:s.money,hostId:activeHost(s)?.id||null,rates:mcDebug.rates(),
        staff:staff.map(r=>r.id),outside:companionActors(s).map(r=>r.id),models,
        people:s.community.residents.map(r=>({id:r.id,name:r.name,look:r.look,job:r.job,room:r.room,activity:r.activity,status:r.status,b:residentBase(s,r),baseEarned:r.baseEarned,jobEarned:r.jobEarned})),
        heat:s.live.heat,hostHeat:s.live.hostHeat,host:s.live.host,liveIncome:s.live.income,
        record:s.studio.placements.L1,hudPopulation:document.querySelector('#population').textContent,
        residentCount:s.community.residents.filter(r=>!r.reserve).length,overflow:document.documentElement.scrollWidth>innerWidth,
        interior:w.interior};
    }""")

def program(page, touch):
    if not page.evaluate('mcDebug.world.interior'):
        tap(page, '[data-nav="live"]', touch)
        page.wait_for_function('mcDebug.world.interior')
    tap(page, '[data-room-tab="program"]', touch)

def assign(page, person, job, touch):
    # Follow the program's real staffing link, then the existing village card.
    program(page, touch)
    tap(page, '[data-staff-job="host"] [data-village-staff]', touch)
    tap(page, f'[data-person="{person}"]', touch)
    page.locator(f'[data-assign="{person}"]').select_option(job)
    page.wait_for_timeout(100)

def project(page, x, z):
    return page.evaluate("""async ([x,z])=>{const T=await import('/node_modules/.vite/deps/three.js'),w=mcDebug.world;
      const p=new T.Vector3(x,.205,z).project(w.camera),r=w.renderer.domElement.getBoundingClientRect();
      return {x:r.x+(p.x+1)*r.width/2,y:r.y+(1-p.y)*r.height/2};}""",[x,z])

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--use-angle=metal'] if sys.platform == 'darwin' else [])
    try:
        for name, width, height, touch in [('desktop',1440,960,False),('phone',390,844,True),('small-phone',320,720,True)]:
            context = browser.new_context(viewport={'width':width,'height':height},has_touch=touch,is_mobile=touch,device_scale_factor=1)
            context.add_init_script(pause)
            context.add_init_script("if(!sessionStorage.getItem('living-seeded')){"+f"localStorage.setItem('mc-clicker-world-v2',{json.dumps(json.dumps(fixture))});"+"sessionStorage.setItem('living-seeded','1')}")
            page = context.new_page()
            page.on('pageerror',lambda e:report['errors'].append(str(e)))
            page.on('response',lambda r:report['failedRequests'].append({'url':r.url,'status':r.status}) if r.status>=400 else None)
            checks = report['checks'][name] = {}
            observations = report['observations'][name] = {}
            page.goto(args.url,wait_until='networkidle')
            page.wait_for_function('window.mcDebug?.world')
            program(page,touch)
            empty = observe(page)
            assert empty['hostId'] is None and not empty['staff'] and not empty['models'],empty
            assert empty['rates']['hostIncome']==0
            assert '主持人空缺' in page.locator('[data-staff-job="host"]').inner_text()
            assert page.locator('[data-hold="host"]').is_disabled()
            checks['PurchasedSeatHasNoAnonymousHostOrBoost']=True
            shot(page,f'{name}-empty-seat')

            assign(page,'resident-1','host',touch)
            page.evaluate('mcDebug.advance(.1)')
            program(page,touch)
            traveling = observe(page)
            assert traveling['hostId'] is None and traveling['rates']['hostIncome']==0
            assert traveling['people'][0]['job']=='host' and traveling['people'][0]['room'] is None
            assert '赶来中' in page.locator('[data-staff-job="host"]').inner_text()
            assert page.locator('[data-hold="host"]').is_disabled()
            checks['VillageAssignmentShowsTravelingWithoutEarlyBonus']=True
            shot(page,f'{name}-traveling')

            assign(page,'resident-2','musician',touch)
            before = observe(page)
            page.evaluate('mcDebug.advance(45)')
            program(page,touch)
            active = observe(page)
            assert active['hostId']=='resident-1' and set(active['staff'])=={'resident-1','resident-2'},active
            assert {m['id'] for m in active['models']}==set(active['staff'])
            assert all(m['room']=='studio' and m['rig']=='hinged-v1' for m in active['models'])
            assert not set(active['staff']).intersection(active['outside'])
            assert active['hudPopulation'].startswith(f"驻村 {active['residentCount']} /"),active['hudPopulation']
            assert active['people'][0]['look']==before['people'][0]['look']
            for i in [0,1]:
                actual=active['people'][i]['baseEarned']-before['people'][i]['baseEarned']
                assert abs(actual-45*before['people'][i]['b'])<1e-5
            assert active['rates']['hostIncome']>0 and active['people'][0]['jobEarned']>0
            assert active['people'][1]['jobEarned']>0
            assert page.locator('[data-hold="host"]').is_enabled()
            assert '阿木 · 在岗' in page.locator('[data-staff-job="host"]').inner_text()
            assert '小石 · 在岗' in page.locator('[data-staff-job="musician"]').inner_text()
            checks['RealSameIdentityHostAndMusicianArriveWithFullBAndActualJobIncome']=True
            checks['IndoorStaffDoNotConsumeOutdoorCollisionOrVisibleSlots']=True
            checks['HudResidentCountIncludesTheActualIndoorStaff']=True
            assert not active['overflow']
            checks['StaffPanelHasNoHorizontalOverflow']=True
            page.locator('[data-staff-job="host"]').scroll_into_view_if_needed()
            shot(page,f'{name}-staff-panel')
            page.locator('[data-staff-job="musician"]').scroll_into_view_if_needed()
            shot(page,f'{name}-musician-card')
            tap(page,'#room-close-panel',touch)
            shot(page,f'{name}-room')

            # Native long press activates a real host segment. Pause afterward
            # to check attribution without the wall-clock changing the ledger.
            program(page,touch)
            page.evaluate("window.__livingPause=false;window.dispatchEvent(new Event('focus'))")
            target=page.locator('[data-hold="host"]')
            target.scroll_into_view_if_needed()
            bounds=target.bounding_box();x=bounds['x']+bounds['width']/2;y=bounds['y']+bounds['height']/2
            if touch:
                cdp=context.new_cdp_session(page)
                cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'id':1,'x':x,'y':y}]})
                page.wait_for_timeout(1350)
                cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
                cdp.detach()
            else:
                page.mouse.move(x,y);page.mouse.down();page.wait_for_timeout(1350);page.mouse.up()
            page.evaluate("window.__livingPause=true;window.dispatchEvent(new Event('blur'))")
            hosted=observe(page)
            assert hosted['host']>0 and hosted['hostHeat']>0,hosted
            before=observe(page);page.evaluate('mcDebug.advance(.25)');after=observe(page)
            assert abs((after['people'][0]['jobEarned']-before['people'][0]['jobEarned'])-before['rates']['hostIncome']*.25)<1e-5
            assert abs((after['liveIncome']-before['liveIncome'])-before['rates']['live']*.25)<1e-5
            checks['NativeLongPressHostsAndAttributesTheActualLiveUpliftOnce']=True

            # Move the real record player through its own room arrangement UI.
            tap(page,'[data-room-tab="arrange"]',touch)
            tap(page,'[data-room-select="L1"]',touch)
            tap(page,'[data-room-move="L1"]',touch)
            page.wait_for_timeout(400)
            point=page.evaluate("""async()=>{const {studioSites}=await import('/src/studio-placement.js');const s=mcDebug.state,o=s.studio.placements.L1;
              return studioSites(s,'L1',{ignoreKey:'L1'}).filter(p=>p.z>.5&&p.z<1.5&&Math.hypot(p.x-o.x,p.z-o.z)>1).sort((a,b)=>a.x-b.x)[0]}""")
            assert point
            screen=project(page,point['x'],point['z'])
            page.touchscreen.tap(screen['x'],screen['y']) if touch else page.mouse.click(screen['x'],screen['y'])
            assert page.locator('#placement-confirm').is_enabled()
            tap(page,'#placement-confirm',touch)
            moved=observe(page)
            musician=next(m for m in moved['models'] if m['id']=='resident-2')
            assert moved['record']!=active['record'] and musician['position']!=next(m for m in active['models'] if m['id']=='resident-2')['position']
            geometry=page.evaluate("""async()=>{const {studioEntities}=await import('/src/studio-placement.js'),w=mcDebug.world,s=mcDebug.state,r=w.roots['resident-2'],p=r.position;
              return {clearance:.36,distance:Math.hypot(p.x-s.studio.placements.L1.x,p.z-s.studio.placements.L1.z),collides:studioEntities(s).filter(e=>e.layer==='floor').some(e=>{let a=e.position;let sw=a.rotation%2?e.d:e.w,sd=a.rotation%2?e.w:e.d;return Math.abs(p.x-a.x)<sw/2+.36&&Math.abs(p.z-a.z)<sd/2+.36})}}""")
            assert not geometry['collides'] and geometry['distance']<1.8,geometry
            checks['MovingRecordPlayerRelocatesSameMusicianBesideItWithoutCollision']=True
            if page.locator('#room-close-panel').is_visible():
                tap(page,'#room-close-panel',touch)
            shot(page,f'{name}-record-moved')

            # Clicking the actual 3D resident routes back to that villager's card.
            point=page.evaluate("""async()=>{const T=await import('/node_modules/.vite/deps/three.js'),w=mcDebug.world,o=w.roots['resident-1'];let head;
              o.traverse(p=>{if(p.userData.mobPart==='head')head=p});w.scene.updateMatrixWorld(true);const v=head.getWorldPosition(new T.Vector3()).project(w.camera),r=w.renderer.domElement.getBoundingClientRect();
              return {x:r.x+(v.x+1)*r.width/2,y:r.y+(1-v.y)*r.height/2}}""")
            page.touchscreen.tap(point['x'],point['y']) if touch else page.mouse.click(point['x'],point['y'])
            page.locator('[data-assign="resident-1"]').wait_for(state='visible')
            assert page.locator('[data-rename-input]').input_value()=='阿木'
            checks['ClickingActualHostOpensTheSameVillageIdentity']=True
            page.locator('[data-assign="resident-1"]').select_option('idle')
            page.evaluate('mcDebug.advance(.1)')
            program(page,touch)
            revoked=observe(page)
            assert revoked['hostId'] is None and revoked['rates']['hostIncome']==0
            assert revoked['hostHeat']==0 and revoked['host']==0
            assert revoked['staff']==['resident-2'] and 'resident-1' in revoked['outside']
            assert page.locator('[data-hold="host"]').is_disabled()
            checks['RevokingHostRemovesModelAndBonusButKeepsMusicianAndBaseIncome']=True
            shot(page,f'{name}-revoked')
            observations.update({'empty':empty,'traveling':traveling,'active':active,'recordMoved':moved,'recordGeometry':geometry,'revoked':revoked})
            page.evaluate('mcDebug.save()')
            page.reload(wait_until='networkidle')
            program(page,touch)
            loaded=observe(page)
            assert loaded['staff']==['resident-2'] and loaded['hostId'] is None
            assert len(loaded['people'])==len(active['people'])
            assert [m['id'] for m in loaded['models']]==['resident-2']
            checks['ReloadPreservesOneActualMusicianWithoutRecreatingHost']=True
            context.close()
    except Exception as e:
        report['failure']=str(e)
        try: shot(page,'failure')
        except Exception: pass
        raise
    finally:
        report['passed']=not report.get('failure') and not report['errors'] and not report['failedRequests'] and len(report['checks'])==3 and all(all(c.values()) and len(c)>=10 for c in report['checks'].values())
        (OUT/f'{prefix}-observations.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
        if report['passed']:
            (OUT/f'{prefix}-failure.png').unlink(missing_ok=True)
        browser.close()
print(json.dumps({'passed':report['passed'],'checks':report['checks'],'errors':report['errors']},ensure_ascii=False,indent=2))
