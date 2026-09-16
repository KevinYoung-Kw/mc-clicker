"""Verify the scene HUD, free QR sharing, features and room entry using real UI."""
import argparse
import json
from pathlib import Path
import subprocess
import sys
from importlib.util import spec_from_file_location, module_from_spec
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
spec = spec_from_file_location('interiors', ROOT/'scripts/verify-interiors-release.py')
base = module_from_spec(spec)
spec.loader.exec_module(base)
KEY = 'mc-clicker-world-v2'
SEED = '''
import {residentFixture} from './scripts/resident-fixture.mjs';
import {fresh,buy,sites,frontier} from './src/game.js';
import {ancestors,topological} from './src/catalog.js';
const s=residentFixture();
const wanted=ancestors('N1');
for(const item of topological().filter(i=>wanted.has(i.id))){
 if(s.counts[item.id])continue;
 while(item.place&&!sites(s,item.realm,null,item.id).length){
  const edge=frontier(s,item.realm).sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z))[0];
  const result=buy(s,'V1',{...edge,realm:item.realm});if(!result.ok)throw Error(result.reason);
 }
 const result=buy(s,item.id);if(!result.ok)throw Error(item.id+result.reason);
}
s.realm='overworld';s.reducedMotion=false;s.skipPurchaseConfirmation=true;
console.log(JSON.stringify({new:fresh(),grown:s}));
'''

def click(page, selector):
    target = page.locator(selector).first
    if selector in ['#settings','#info-open','#share-open','#collection-open','#sound'] and not target.is_visible() and page.locator('#hud-more').is_visible():
        page.locator('#hud-more').click()
    target.click()

def overlap(a,b):
    return a['x'] < b['x']+b['width']-1 and a['x']+a['width'] > b['x']+1 and a['y'] < b['y']+b['height']-1 and a['y']+a['height'] > b['y']+1

def hud_bounds(page, notices=False):
    selectors=['#mission','#world-label','#realm-switch','#home-view','#world-controls','.hotbar','#panel']
    if notices: selectors.append('#notice-center')
    bounds={}
    for selector in selectors:
        element=page.locator(selector)
        if element.is_visible(): bounds[selector]=element.bounding_box()
    for a,b in [('#world-label','#world-controls'),('#world-label','.hotbar'),('#world-label','#panel'),('#world-label','#mission'),('#mission','#realm-switch'),('#mission','#panel'),('#notice-center','#mission'),('#notice-center','#realm-switch'),('#notice-center','#home-view')]:
        if a in bounds and b in bounds: assert not overlap(bounds[a],bounds[b]),(a,b,bounds[a],bounds[b])
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    if page.locator('.hud-tools').is_visible():
        assert not overlap(page.locator('#money').bounding_box(),page.locator('.hud-tools').bounding_box())
    money=page.locator('#money').bounding_box();hud=page.locator('.hud').bounding_box()
    assert money['y']>=hud['y'] and money['y']+money['height']<=hud['y']+hud['height']
    return bounds

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--url',default='http://127.0.0.1:8890/')
    ap.add_argument('--label',default='dev')
    args=ap.parse_args()
    output=ROOT/'docs/qa'/f'hud-{args.label}'
    output.mkdir(parents=True,exist_ok=True)
    seed=json.loads(subprocess.run(['node','--input-type=module','--eval',SEED],cwd=ROOT,capture_output=True,text=True,check=True).stdout)
    report={'url':args.url,'checks':[],'errors':[],'failedRequests':[],'bounds':{}}
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=['--use-angle=metal'] if sys.platform=='darwin' else [])
        try:
            for mode,width,height in [('desktop',1440,1000),('compact',900,700),('phone',390,844),('small',320,768),('landscape',844,390)]:
                context=browser.new_context(viewport={'width':width,'height':height},has_touch=True,is_mobile=width<760,device_scale_factor=1,accept_downloads=True)
                context.add_init_script(f'''{{const once=sessionStorage.getItem("qa-state-once");
                  if(once){{localStorage.setItem({json.dumps(KEY)},once);sessionStorage.removeItem("qa-state-once");}}
                  else if(!localStorage.getItem({json.dumps(KEY)}))localStorage.setItem({json.dumps(KEY)},{json.dumps(json.dumps(seed["new"]))});}}''')
                page=context.new_page();page.set_default_timeout(20000)
                page.on('pageerror',lambda e:report['errors'].append(str(e)))
                page.on('requestfailed',lambda r:report['failedRequests'].append(r.url))
                page.on('response',lambda r:report['failedRequests'].append(r.url) if r.status>=400 else None)
                page.goto(args.url,wait_until='networkidle')
                page.locator('#world canvas').wait_for(state='visible')
                assert page.locator('[data-nav="build"] span').inner_text()=='商城'
                assert page.locator('[data-nav="live"]').count()==0
                assert page.locator('[data-nav="world"]').count()==0
                assert page.locator('#share-open').evaluate('(e)=>!e.hidden')
                click(page,'#share-open')
                page.locator('.share-qr img').wait_for(state='visible')
                page.locator('.share-qr img').evaluate('(img)=>img.decode()')
                assert page.locator('#unlock-sharing').count()==0
                assert page.locator('#share-url').input_value()=='https://www.kw-aigc.cn/projects/mc-clicker-2/'
                page.locator('.share-qr').screenshot(path=output/f'{mode}-qr.png')
                assert page.evaluate(f'JSON.parse(localStorage.getItem({json.dumps(KEY)})).money')==0
                report['checks'].append(mode+': zero-progress free sharing, canonical link and QR')
                if mode in ['desktop','phone']:
                    click(page,'#generate-card')
                    page.locator('#download-card').wait_for(state='visible')
                    with page.expect_download() as d: click(page,'#download-card')
                    d.value.save_as(output/f'{mode}-card.png')
                    report['checks'].append(mode+': free current-world card generation and PNG download')
                click(page,'#modal-close')
                if mode=='desktop':
                    # Only currency is seeded. Early abilities are bought through
                    # their real prerequisites, confirmation and placement UI.
                    early={**seed['new'],'money':500}
                    page.evaluate('(s)=>sessionStorage.setItem("qa-state-once",JSON.stringify(s))',early)
                    page.reload(wait_until='networkidle')
                    assert page.locator('#mission').is_hidden()
                    click(page,'[data-nav="build"]')
                    click(page,'[data-buy="T1"]');click(page,'#placement-confirm')
                    click(page,'[data-family="features"]')
                    before=base.saved(page)
                    click(page,'[data-buy-guidance="goals"]');click(page,'#placement-confirm')
                    assert base.saved(page)['money']==before['money']-6
                    assert page.locator('#mission').is_visible()
                    assert page.locator('[data-buy-guidance="info"]').is_disabled()
                    report['checks'].append('new player: buys task prompts in features for 6; info prerequisite retained')
                    click(page,'[data-family="all"]')
                    click(page,'[data-buy="V1"]');base.choose_grid(page);click(page,'#placement-confirm')
                    click(page,'[data-family="features"]')
                    before=base.saved(page)
                    click(page,'[data-buy-guidance="info"]');click(page,'#placement-confirm')
                    after=base.saved(page)
                    assert after['money']==before['money']-12
                    assert after['counts']==before['counts']
                    assert page.locator('#info-open').evaluate('(e)=>!e.hidden')
                    assert page.locator('#panel').is_visible()
                    report['checks'].append('new player: buys information after land, without closing features or adding buildings')
                # Reload a funded world created via actual prerequisite purchases.
                page.evaluate('(state)=>sessionStorage.setItem("qa-state-once",JSON.stringify(state))',seed['grown'])
                page.reload(wait_until='networkidle')
                if page.locator('#panel-close').is_visible(): click(page,'#panel-close')
                page.wait_for_timeout(700)
                assert page.locator('#power-top').is_visible()
                assert not overlap(page.locator('#power-top').bounding_box(),page.locator('#money').bounding_box())
                if page.locator('.hud-tools').is_visible():
                    assert not overlap(page.locator('#power-top').bounding_box(),page.locator('.hud-tools').bounding_box())
                if width<760:
                    assert page.locator('.hud').bounding_box()['height']==60
                    assert page.locator('#hud-more').is_visible() and page.locator('.hud-tools').is_hidden()
                assert page.locator('#mission-name').inner_text()
                assert page.locator('#mission-link small').inner_text()=='下一个目标'
                assert page.locator('#mission-count').count()==0
                assert page.locator('#mission-icon img, #mission-icon svg').count()==1
                report['bounds'][mode+'-world']=hud_bounds(page)
                page.screenshot(path=output/f'{mode}-world.png')
                click(page,'#mission-toggle')
                assert page.locator('#mission-content').is_hidden()
                assert page.evaluate(f'JSON.parse(localStorage.getItem({json.dumps(KEY)})).guidance.collapsed')
                click(page,'#mission-toggle')
                report['checks'].append(mode+': compact left goal, saved collapse and unobstructed world caption')
                click(page,'[data-nav="build"]')
                assert page.locator('[data-family="L"]').count()==0
                click(page,'[data-family="features"]')
                assert page.locator('[data-guidance-card]').count()==2
                assert page.locator('[data-card]').count()==0
                page.wait_for_timeout(650)
                report['bounds'][mode+'-shop']=hud_bounds(page)
                page.screenshot(path=output/f'{mode}-features.png')
                click(page,'[data-guidance-open="info"]')
                page.locator('#info-panel').wait_for(state='visible')
                colors=page.evaluate('()=>["#modal","#panel-content"].map(s=>getComputedStyle(document.querySelector(s)).scrollbarColor)')
                assert colors[0]==colors[1]
                page.locator('#info-return').scroll_into_view_if_needed()
                assert page.locator('#modal').evaluate('(el)=>el.scrollHeight<=el.clientHeight+2||el.scrollTop>0')
                click(page,'#info-return')
                report['checks'].append(mode+': features-only abilities and matching world-info scrollbars')
                click(page,'[data-open="owned"]')
                click(page,'[data-family="all"]')
                # Purchase result, then a pause, use exactly the same message slot.
                click(page,'[data-buy="V4"]')
                page.wait_for_function('()=>document.querySelector("#toast").classList.contains("visible")')
                assert page.locator('#notice-center').evaluate('(el)=>el.matches(":popover-open")')
                report['bounds'][mode+'-notice']=hud_bounds(page,True)
                page.screenshot(path=output/f'{mode}-notice.png')
                page.evaluate('window.dispatchEvent(new Event("blur"))')
                page.locator('#foreground-status').wait_for(state='visible')
                assert page.locator('#toast').is_hidden()
                report['bounds'][mode+'-paused']=hud_bounds(page,True)
                page.screenshot(path=output/f'{mode}-paused.png')
                page.evaluate('window.dispatchEvent(new Event("focus"))')
                page.locator('#foreground-status').wait_for(state='hidden')
                report['checks'].append(mode+': purchase notices and pause share one clear top-center slot')
                click(page,'[data-detail="L2"]')
                page.locator('#room-tools').wait_for(state='visible')
                click(page,'[data-room-tab="equipment"]')
                assert page.locator('[data-buy="L3"]').count()>0
                click(page,'#studio-back')
                assert page.locator('#realm-switch').is_visible()
                assert page.locator('[data-realm="nether"]').count()==1
                report['checks'].append(mode+': room access and indoor purchases preserved, dimension buttons retained')
                context.close()
            assert not report['errors'],report['errors']
            assert not report['failedRequests'],report['failedRequests']
            report['passed']=True
        except Exception as e:
            report['passed']=False;report['failure']=str(e)
            page.screenshot(path=output/'failure.png')
            raise
        finally:
            (output/'observations.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
            browser.close()
    print(json.dumps({'passed':True,'checks':len(report['checks']),'report':str(output/'observations.json')},ensure_ascii=False))

if __name__=='__main__':main()
