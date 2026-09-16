"""Verify real ownership controls and optional development-only movement telemetry."""
import argparse
import json
from pathlib import Path
import subprocess
import sys
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
KEY = 'mc-clicker-world-v2'
SEED = '''
import {residentFixture} from './scripts/resident-fixture.mjs';
import {buy,sites,frontier} from './src/game.js';
import {ancestors,topological} from './src/catalog.js';
const s=residentFixture();
const wanted=new Set(['N3','N5','V16'].flatMap(id=>[...ancestors(id)]));
for(const item of topological().filter(i=>wanted.has(i.id))){
 if(s.counts[item.id])continue;
 while(item.place&&!sites(s,item.realm,null,item.id).length){
  const edge=frontier(s,item.realm).sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z))[0];
  const result=buy(s,'V1',{...edge,realm:item.realm});if(!result.ok)throw Error(result.reason);
 }
 const result=buy(s,item.id);if(!result.ok)throw Error(item.id+result.reason);
}
s.realm='overworld';s.reducedMotion=false;s.harvest.farm=1;s.grid.links.V4='legacy';s.grid.links.L1='legacy';
console.log(JSON.stringify(s));
'''

def click(page, selector):
    page.locator(selector).first.click()

def wait_label(page, selector, prefix):
    page.wait_for_function('([selector,prefix]) => document.querySelector(selector)?.textContent.startsWith(prefix)', arg=[selector,prefix])

def capture_control(page, selector, path):
    page.wait_for_function('()=>!document.querySelector("#toast")?.classList.contains("visible")')
    page.locator(selector).evaluate('(el)=>el.scrollIntoView({block:"center"})')
    page.wait_for_timeout(650)
    page.screenshot(path=path)

def village(page, tab):
    click(page, '[data-nav="village"]')
    click(page, f'[data-village-tab="{tab}"]')

def industry(page, tab):
    click(page, '[data-nav="network"]')
    click(page, f'[data-industry-tab="{tab}"]')

def record_player(page):
    click(page, '[data-nav="live"]')
    page.locator('#room-tools').wait_for(state='visible')
    click(page, '[data-room-tab="arrange"]')
    click(page, '[data-room-select="L1"]')

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--url', default='http://127.0.0.1:8891/projects/mc-clicker-2/')
    ap.add_argument('--label', default='local')
    ap.add_argument('--dev', action='store_true')
    args = ap.parse_args()
    output = ROOT / 'docs/qa' / f'controls-{args.label}'
    output.mkdir(parents=True, exist_ok=True)
    state = json.loads(subprocess.run(['node','--input-type=module','--eval',SEED], cwd=ROOT, capture_output=True, text=True, check=True).stdout)
    checks, errors, failed, telemetry = [], [], [], {}
    report = {'url':args.url,'checks':checks,'errors':errors,'failedRequests':failed,'telemetry':telemetry}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=['--use-angle=metal'] if sys.platform == 'darwin' else [])
        try:
            for mode, viewport in [('desktop',{'width':1440,'height':1000}),('phone',{'width':390,'height':844})]:
                context = browser.new_context(viewport=viewport,has_touch=True,is_mobile=mode=='phone',device_scale_factor=1)
                context.add_init_script(f'localStorage.setItem({json.dumps(KEY)},{json.dumps(json.dumps(state))})')
                page = context.new_page()
                page.set_default_timeout(20000)
                page.on('pageerror',lambda e:errors.append(str(e)))
                page.on('requestfailed',lambda r:failed.append(r.url))
                page.on('response',lambda r:failed.append(r.url) if r.status>=400 else None)
                page.goto(args.url,wait_until='networkidle')
                page.locator('#world canvas').wait_for(state='visible')
                assert page.evaluate('typeof window.mcDebug') == ('object' if args.dev else 'undefined')
                village(page,'production')
                wait_label(page,'[data-task="farm"]','点击采集')
                assert page.locator('[data-task-owner="farm"]').inner_text()
                manual_color=page.locator('[data-task="farm"]').evaluate('(el)=>getComputedStyle(el).backgroundColor')
                checks.append(mode+': manual control and visible readiness')
                village(page,'residents')
                click(page,'[data-person="resident-1"]')
                page.locator('[data-assign="resident-1"]').select_option('farmer')
                village(page,'production')
                wait_label(page,'[data-task="farm"]','村民托管中')
                capture_control(page,'[data-task="farm"]',output/f'{mode}-villager.png')
                villager_color=page.locator('[data-task="farm"]').evaluate('(el)=>getComputedStyle(el).backgroundColor')
                assert villager_color!=manual_color
                checks.append(mode+': assigned worker changes button and appearance')
                click(page,'[data-manage-item="V4"]')
                wait_label(page,'[data-action="farm"]','村民托管中')
                checks.append(mode+': facility detail agrees with village controller')
                industry(page,'automation')
                page.locator('[data-auto="farm"]').select_option('1')
                village(page,'production')
                wait_label(page,'[data-task="farm"]','红石')
                capture_control(page,'[data-task="farm"]',output/f'{mode}-redstone.png')
                redstone_color=page.locator('[data-task="farm"]').evaluate('(el)=>getComputedStyle(el).backgroundColor')
                assert redstone_color not in [villager_color,manual_color]
                checks.append(mode+': redstone assignment takes precedence')
                industry(page,'automation')
                page.locator('[data-auto="farm"]').select_option('0')
                village(page,'production')
                wait_label(page,'[data-task="farm"]','村民托管中')
                village(page,'residents')
                click(page,'[data-person="resident-1"]')
                page.locator('[data-assign="resident-1"]').select_option('idle')
                village(page,'production')
                wait_label(page,'[data-task="farm"]','点击采集')
                checks.append(mode+': disabling automation and reassigning restores manual state')
                industry(page,'automation')
                page.locator('[data-auto="music"]').check()
                record_player(page)
                wait_label(page,'[data-action="music"]','红石')
                assert page.locator('[data-action="music"] + .task-control-detail').inner_text()
                checks.append(mode+': indoor music shows controller and cycle status')
                click(page,'#studio-back')
                industry(page,'power')
                click(page,'[data-device-toggle="M10"]')
                record_player(page)
                wait_label(page,'[data-action="music"]','红石已暂停')
                capture_control(page,'[data-action="music"]',output/f'{mode}-paused-music.png')
                checks.append(mode+': pausing redstone clock changes indoor button')
                click(page,'#studio-back')
                industry(page,'power')
                click(page,'[data-device-toggle="M10"]')
                record_player(page)
                page.wait_for_function('()=>document.querySelector(\'[data-action="music"]\')?.textContent.startsWith("红石")&&!document.querySelector(\'[data-action="music"]\').textContent.includes("暂停")')
                checks.append(mode+': resuming clock restores actual operation status')
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                click(page,'#studio-back')
                if args.dev:
                    click(page,'[data-nav="world"]')
                    for realm in ['overworld','nether']:
                        if realm == 'nether': click(page,'[data-realm="nether"]')
                        page.wait_for_timeout(800)
                        data = page.evaluate('''async () => {
                          const w=mcDebug.world, previous=new Map(), errors=[], ids=new Set();let maximumStep=0;
                          for(let sample=0;sample<120;sample++){
                            await new Promise(r=>setTimeout(r,50));
                            for(const a of w.walkers.filter(a=>a.active&&!a.person)){
                              ids.add(a.id);
                              if(!w.navigation.clear(a.x,a.z,a.radius))errors.push({id:a.id,x:a.x,z:a.z,radius:a.radius});
                              const last=previous.get(a);if(last)maximumStep=Math.max(maximumStep,Math.hypot(a.x-last.x,a.z-last.z));
                              previous.set(a,{x:a.x,z:a.z});
                            }
                          }
                          return {ids:[...ids],samples:120,errors:errors.slice(0,10),maximumStep,radii:w.walkers.filter(a=>!a.person).map(a=>({id:a.id,radius:a.radius}))};
                        }''')
                        telemetry[mode+'-'+realm]=data
                        assert not data['errors'], data
                        assert data['maximumStep']<0.2, data
                        assert ('V16' if realm=='overworld' else 'N3') in data['ids']
                        page.screenshot(path=output/f'{mode}-{realm}-paths.png')
                        checks.append(mode+': '+realm+' creature body clearance and continuous movement')
                context.close()
            assert not errors, errors
            assert not failed, failed
            report['passed']=True
        except Exception as e:
            report['passed']=False;report['failure']=str(e)
            page.screenshot(path=output/'failure.png')
            raise
        finally:
            (output/'observations.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
            browser.close()
    print(json.dumps({'passed':True,'checks':len(checks),'report':str(output/'observations.json')},ensure_ascii=False))

if __name__=='__main__': main()
