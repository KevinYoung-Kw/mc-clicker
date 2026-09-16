"""Production-only UI smoke: real staff assignment and natural arrival.

No mcDebug calls, source-module imports, injected game functions or artificial
simulation time. The Node-built fixture is installed once in an isolated save.
"""
import argparse
import json
from pathlib import Path
import subprocess
import sys
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/qa'
SAVE_KEY = 'mc-clicker-world-v2'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:8891/projects/mc-clicker-2/')
parser.add_argument('--label', default='local')
args = parser.parse_args()
assert args.label.replace('-', '').isalnum()
prefix = f'living-staff-{args.label}'
fixture = json.loads(subprocess.run(['node','scripts/resident-fixture.mjs'],cwd=ROOT,text=True,capture_output=True,check=True).stdout)
report = {'url':args.url,'checks':{},'states':{},'errors':[],'failedRequests':[],'mechanism':'production UI + native long press + natural foreground time'}

def tap(page, selector, touch):
    el = page.locator(selector).first
    el.wait_for(state='visible')
    el.tap() if touch else el.click()

def snapshot(page):
    # Exercise the normal focus-loss save hook. Resume immediately; no game
    # values, private APIs or simulation clocks are modified by the harness.
    return page.evaluate("""key=>{
      window.dispatchEvent(new Event('blur'));
      const s=JSON.parse(localStorage.getItem(key));
      window.dispatchEvent(new Event('focus'));
      return s;
    }""",SAVE_KEY)

def program(page,touch):
    if not page.locator('[data-room-tab="program"]').is_visible():
        tap(page,'[data-nav="live"]',touch)
    tap(page,'[data-room-tab="program"]',touch)
    page.locator('[data-staff-job="host"]').wait_for(state='attached')

def assign(page,person,job,touch):
    program(page,touch)
    tap(page,'[data-staff-job="host"] [data-village-staff]',touch)
    tap(page,f'[data-person="{person}"]',touch)
    page.locator(f'[data-assign="{person}"]').select_option(job)

def screenshot(page,name):
    page.screenshot(path=str(OUT/f'{prefix}-{name}.png'))

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True,args=['--use-angle=metal'] if sys.platform=='darwin' else [])
    try:
        for name,width,height,touch in [('desktop',1440,960,False),('phone',390,844,True)]:
            context=browser.new_context(viewport={'width':width,'height':height},has_touch=touch,is_mobile=touch,device_scale_factor=1)
            context.add_init_script("if(!sessionStorage.getItem('living-release-seeded')){"+f"localStorage.setItem({json.dumps(SAVE_KEY)},{json.dumps(json.dumps(fixture))});"+"sessionStorage.setItem('living-release-seeded','1')}")
            page=context.new_page()
            page.set_default_timeout(15000)
            page.on('pageerror',lambda e:report['errors'].append(str(e)))
            page.on('response',lambda r:report['failedRequests'].append({'url':r.url,'status':r.status}) if r.status>=400 else None)
            page.on('requestfailed',lambda r:report['failedRequests'].append({'url':r.url,'error':r.failure}))
            checks=report['checks'][name]={}
            states=report['states'][name]={}
            page.goto(args.url,wait_until='networkidle')
            assert page.evaluate("typeof window.mcDebug")=='undefined'
            checks['ProductionHasNoDebugInterface']=True
            program(page,touch)
            assert '主持人空缺' in page.locator('[data-staff-job="host"]').inner_text()
            assert page.locator('[data-hold="host"]').is_disabled()
            empty=snapshot(page)
            assert not any(r['job']=='host' or r.get('room')=='studio' for r in empty['community']['residents'])
            checks['PurchasedSeatStillRequiresARealAssignedHost']=True
            page.locator('[data-staff-job="host"]').scroll_into_view_if_needed()
            screenshot(page,f'{name}-empty-seat')

            assign(page,'resident-1','host',touch)
            traveling=snapshot(page)
            r=traveling['community']['residents'][0]
            assert r['job']=='host' and r.get('room') is None
            checks['RealVillageSelectionReservesASeatBeforeArrival']=True
            assign(page,'resident-2','musician',touch)
            program(page,touch)
            page.wait_for_function("""()=>['host','musician'].every(job=>document.querySelector(`[data-staff-job="${job}"] [data-staff-name]`)?.textContent.includes('在岗'))""",timeout=45000,polling=250)
            active=snapshot(page)
            staff=[r for r in active['community']['residents'] if r.get('room')=='studio']
            assert {r['id'] for r in staff}=={'resident-1','resident-2'}
            assert all(not r['reserve'] and not r['handover'] for r in staff)
            assert active['community']['residents'][0]['look']==empty['community']['residents'][0]['look']
            assert active['community']['residents'][1]['look']==empty['community']['residents'][1]['look']
            assert page.locator('[data-hold="host"]').is_enabled()
            assert '阿木 · 在岗' in page.locator('[data-staff-job="host"]').inner_text()
            assert '小石 · 在岗' in page.locator('[data-staff-job="musician"]').inner_text()
            assert len(active['community']['residents'])==len(empty['community']['residents'])
            assert all(active['community']['residents'][i]['baseEarned']>empty['community']['residents'][i]['baseEarned'] for i in [0,1])
            assert page.locator('#population').inner_text().startswith('驻村 9 /')
            checks['NaturalTravelBringsBothNamedResidentsInsideWithoutDuplication']=True
            checks['IndoorStaffRetainBaseIncomeAndCountTowardNineResidents']=True
            page.locator('[data-staff-job="host"]').scroll_into_view_if_needed()
            screenshot(page,f'{name}-staff')
            tap(page,'#room-close-panel',touch)
            screenshot(page,f'{name}-room')

            program(page,touch)
            button=page.locator('[data-hold="host"]')
            button.scroll_into_view_if_needed()
            box=button.bounding_box();x=box['x']+box['width']/2;y=box['y']+box['height']/2
            if touch:
                cdp=context.new_cdp_session(page)
                cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'id':1,'x':x,'y':y}]})
                page.wait_for_timeout(1400)
                cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
                cdp.detach()
            else:
                page.mouse.move(x,y);page.mouse.down();page.wait_for_timeout(1400);page.mouse.up()
            page.wait_for_function("document.querySelector('[data-hold=host]')?.textContent.includes('主持中')")
            hosted=snapshot(page)
            assert hosted['live']['host']>0 and hosted['live']['hostHeat']>0
            assert hosted['community']['residents'][0]['jobEarned']>0
            assert hosted['community']['residents'][1]['jobEarned']>0
            checks['NativeLongPressStartsHostingAfterArrivalWithActualJobEarnings']=True
            screenshot(page,f'{name}-hosting')

            # Inspect and revoke through the same named village management card.
            assign(page,'resident-1','idle',touch)
            assert page.locator('[data-rename-input]').input_value()=='阿木'
            revoked=snapshot(page)
            assert revoked['community']['residents'][0]['job']=='idle'
            assert revoked['community']['residents'][0].get('room') is None
            assert revoked['live']['host']==0 and revoked['live']['hostHeat']==0
            assert revoked['community']['residents'][1].get('room')=='studio'
            program(page,touch)
            assert page.locator('[data-hold="host"]').is_disabled()
            assert '主持人空缺' in page.locator('[data-staff-job="host"]').inner_text()
            assert '小石 · 在岗' in page.locator('[data-staff-job="musician"]').inner_text()
            checks['RevocationClearsOnlyTheHostAndLeavesTheMusicianWorking']=True
            page.locator('[data-staff-job="host"]').scroll_into_view_if_needed()
            screenshot(page,f'{name}-revoked')
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            checks['StaffManagementHasNoHorizontalOverflow']=True
            page.reload(wait_until='networkidle')
            program(page,touch)
            loaded=snapshot(page)
            assert loaded['community']['residents'][0]['job']=='idle'
            assert loaded['community']['residents'][0].get('room') is None
            assert [r['id'] for r in loaded['community']['residents'] if r.get('room')=='studio']==['resident-2']
            assert len(loaded['community']['residents'])==len(empty['community']['residents'])
            assert page.locator('[data-hold="host"]').is_disabled()
            checks['ReloadKeepsOneMusicianAndDoesNotRecreateTheHost']=True
            states.update({'empty':empty,'traveling':traveling,'active':active,'hosted':hosted,'revoked':revoked,'loaded':loaded})
            context.close()
    except Exception as e:
        report['failure']=repr(e)
        try: screenshot(page,'failure')
        except Exception: pass
        raise
    finally:
        report['passed']=not report.get('failure') and not report['errors'] and not report['failedRequests'] and len(report['checks'])==2 and all(len(c)==9 and all(c.values()) for c in report['checks'].values())
        (OUT/f'{prefix}-observations.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
        if report['passed']:(OUT/f'{prefix}-failure.png').unlink(missing_ok=True)
        browser.close()
print(json.dumps({'passed':report['passed'],'checks':report['checks'],'errors':report['errors'],'failedRequests':report['failedRequests']},ensure_ascii=False,indent=2))
