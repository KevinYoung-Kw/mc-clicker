"""Verify real engineering navigation, automatic layers and ending in isolated saves."""
import argparse
import json
from pathlib import Path
import subprocess
import sys
from importlib.util import spec_from_file_location, module_from_spec
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
spec=spec_from_file_location('interiors',ROOT/'scripts/verify-interiors-release.py')
base=module_from_spec(spec);spec.loader.exec_module(base)
KEY=base.SAVE_KEY

def click(page,selector): page.locator(selector).first.click()
def engineering(page):
    click(page,'[data-nav="build"]')
    click(page,'[data-open="owned"]')
    click(page,'[data-family="Z"]')
    assert '1 级' not in page.locator('[data-card="Z2"]').inner_text()
    assert '一次建成' not in page.locator('[data-card="Z2"]').inner_text()
    click(page,'[data-card="Z2"] [data-detail="Z2"]')
    page.locator('[data-engineering]').wait_for(state='visible')
    assert page.locator('[data-layer]').count()==3
    assert page.locator('[data-engineering-realm]').count()==3
    assert page.locator('[data-buy="Z2"]').count()==0

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--url',default='http://127.0.0.1:8890/');ap.add_argument('--label',default='dev');args=ap.parse_args()
    output=ROOT/'docs/qa'/f'engineering-{args.label}';output.mkdir(parents=True,exist_ok=True)
    seed=json.loads(subprocess.run(['node','--input-type=module','--eval',"import {engineeringFixture} from './scripts/engineering-fixture.mjs';import {ITEMS} from './src/catalog.js';console.log(JSON.stringify({state:engineeringFixture(),endingPrice:ITEMS.Z3.cost}));"],cwd=ROOT,text=True,check=True,capture_output=True).stdout)
    report={'url':args.url,'checks':[],'errors':[],'failedRequests':[],'boundarySeeded':True}
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=['--use-angle=metal'] if sys.platform=='darwin' else [])
        try:
            for mode,width,height in [('desktop',1440,1000),('phone',390,844),('small',320,768)]:
                context=browser.new_context(viewport={'width':width,'height':height},has_touch=True,is_mobile=width<760,device_scale_factor=1)
                context.add_init_script(f'''{{const once=sessionStorage.getItem('engineering-once');if(once){{localStorage.setItem({json.dumps(KEY)},once);sessionStorage.removeItem('engineering-once');}}else if(!localStorage.getItem({json.dumps(KEY)}))localStorage.setItem({json.dumps(KEY)},{json.dumps(json.dumps(seed['state']))});}}''')
                page=context.new_page();page.set_default_timeout(30000)
                page.on('pageerror',lambda e:report['errors'].append(str(e)))
                page.on('requestfailed',lambda r:report['failedRequests'].append(r.url))
                page.on('response',lambda r:report['failedRequests'].append(r.url) if r.status>=400 else None)
                page.goto(args.url,wait_until='networkidle');engineering(page)
                assert '第 1 层施工中' in page.locator('[data-engineering-title]').inner_text()
                assert page.locator('[data-engineering-ending]').is_hidden()
                page.screenshot(path=output/f'{mode}-layer-one.png')
                report['checks'].append(mode+': one purchased site shows three construction layers and realm deliveries, no misleading level-one completion')
                click(page,'[data-engineering-logistics]')
                assert page.locator('[data-industry-tab="logistics"]').get_attribute('class')=='active'
                assert page.locator('[data-engineering]').is_visible()
                click(page,'#power-top')
                assert page.locator('[data-industry-tab="power"]').get_attribute('class')=='active'
                assert page.locator('[data-energy]').is_visible()
                engineering(page)
                first=page.locator('[data-project-improve]').first
                target=first.get_attribute('data-project-improve');first.click()
                assert page.locator('[data-industry-tab="power"]').is_visible() if target=='power' else page.locator(f'[data-card="{target}"]').is_visible()
                report['checks'].append(mode+': engineering links reach logistics, visible power dashboard and actual bottleneck facility')
                for values,expected in [([59999,0,0],2),([60000,59999,0],3),([60000,60000,59999],4)]:
                    state=json.loads(json.dumps(seed['state']))
                    state['projectByRealm']=dict(zip(['overworld','nether','end'],values));state['project']=sum(values)
                    page.evaluate('(s)=>sessionStorage.setItem("engineering-once",JSON.stringify(s))',state)
                    page.reload(wait_until='networkidle')
                    # No simulation hook: the page's normal foreground tick must
                    # deliver the final points across this seeded boundary.
                    page.evaluate('window.dispatchEvent(new Event("focus"))')
                    engineering(page)
                    text='三层全部落成' if expected==4 else f'第 {expected} 层施工中'
                    page.wait_for_function('(text)=>document.querySelector("[data-engineering-title]").textContent===text',arg=text)
                    assert base.saved(page)['counts']['Z2']==1
                    if expected<4: assert page.locator('[data-engineering-ending]').is_hidden()
                    page.screenshot(path=output/f'{mode}-stage-{expected}.png')
                report['checks'].append(mode+': normal page ticks cross second and third layer boundaries and complete without repurchasing')
                assert page.locator('[data-layer].finished').count()==3
                assert page.locator('[data-project-improve]:visible').count()==0
                click(page,'[data-engineering-ending]')
                assert page.locator('[data-buy="Z3"]').is_enabled()
                before=base.saved(page)
                click(page,'[data-buy="Z3"]');click(page,'#placement-confirm')
                page.locator('#share-panel').wait_for(state='visible')
                after=base.wait_count(page,'Z3',1);base.assert_paid(before,after,seed['endingPrice'])
                assert after['completed'] and after['counts']['Z2']==1
                click(page,'#modal-close')
                engineering(page)
                assert '三层全部落成' in page.locator('[data-engineering-title]').inner_text()
                base.no_overflow(page)
                report['checks'].append(mode+': completed engineering opens payable ending once and preserves the completed site')
                context.close()
            assert not report['errors'],report['errors'];assert not report['failedRequests'],report['failedRequests']
            report['passed']=True;(output/'failure.png').unlink(missing_ok=True)
        except Exception as e:
            report['passed']=False;report['failure']=str(e);page.screenshot(path=output/'failure.png');raise
        finally:
            (output/'observations.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');browser.close()
    print(json.dumps({'passed':True,'checks':len(report['checks'])}))

if __name__=='__main__':main()
