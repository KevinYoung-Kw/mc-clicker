"""Release smoke through visible controls, using isolated saves and no mcDebug."""
import argparse, json, subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--url', default='https://www.kw-aigc.cn/projects/mc-clicker-2/')
parser.add_argument('--out', default='docs/v1.6/qa/alpha4-live/mobile')
parser.add_argument('--version',default=json.loads((ROOT/'package.json').read_text())['version'])
args = parser.parse_args()
out = ROOT / args.out
out.mkdir(parents=True, exist_ok=True)
fixture = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', '''
import {fresh} from './src/game.js';
const s=fresh(42);s.money=1e13;s.play=1800;
Object.assign(s.counts,{T1:1,V1:4,V2:2,V18:1,V20:2,M1:1,M4:1,M5:1,L1:1,L2:1,X1:1,E8:1,E2:1});
s.endEyes=12;s.chunks.overworld=[{x:0,z:0},{x:1,z:0},{x:0,z:1},{x:1,z:1}];
s.placements={V18:{x:3,z:0,realm:'overworld'},L2:{x:5,z:5,realm:'overworld'}};
Object.assign(s.guidance,{info:true,goals:true,counter:true,notices:false});
Object.assign(s.narrative,{intro:'released',companionsShown:true,legacy:true});s.savedAt=1;
console.log(JSON.stringify(s));'''], cwd=ROOT))
reports = []
with sync_playwright() as p:
    for engine, width in [('chromium',320),('webkit',390),('chromium',1440)]:
        browser = getattr(p,engine).launch(headless=True, **({'args':['--use-angle=metal']} if engine=='chromium' else {}))
        mobile = width < 760
        context = browser.new_context(viewport={'width':width,'height':844}, is_mobile=mobile, has_touch=mobile)
        context.add_init_script('if(!localStorage.getItem("mc-clicker-world-v2"))localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(fixture))+')')
        page = context.new_page()
        errors, failed, checks = [], [], []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('response', lambda r: failed.append(r.url) if r.status>=400 else None)
        cdp = context.new_cdp_session(page) if mobile and engine=='chromium' else None
        def press(q):
            loc = page.locator(q).first
            loc.tap() if mobile else loc.click()
        def full():
            return page.locator('#game').evaluate('e=>e.classList.contains("sheet-expanded")')
        def swipe(q,dx=0,dy=80):
            box=page.locator(q).bounding_box();x=box['x']+box['width']/2;y=box['y']+box['height']/2
            if cdp:
                cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
                for step in range(1,9):
                    cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+dx*step/8,'y':y+dy*step/8}]})
                    page.wait_for_timeout(16)
                cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
            else:
                page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+dx,y+dy,steps=8);page.mouse.up()
            page.wait_for_timeout(350)
        page.goto(args.url,wait_until='networkidle')
        page.wait_for_selector('#world canvas')
        assert args.version in page.title()
        assert page.evaluate('typeof window.mcDebug')=='undefined'
        if mobile:
            for name in ['build','village','network','atlas','mail','live']:
                press('[data-nav="'+('atlas' if name in ['mail','live'] else name)+'"]')
                page.wait_for_timeout(350)
                if name in ['mail','live']:
                    press('[data-detail="'+('V18' if name=='mail' else 'L2')+'"]')
                    page.wait_for_timeout(600)
                if name=='live':press('[data-room-tab]')
                if not full():press('#panel-expand');page.wait_for_timeout(350)
                assert full(),name
                if name=='village':
                    page.evaluate('window.dispatchEvent(new Event("blur"))');page.wait_for_timeout(200)
                    assert page.locator('#panel-notice-slot').is_visible()
                    page.screenshot(path=str(out/f'{engine}-{width}-notice.png'))
                    page.evaluate('window.dispatchEvent(new Event("focus"))');page.wait_for_timeout(950)
                    assert page.locator('#panel-notice-slot').is_hidden()
                    page.screenshot(path=str(out/f'{engine}-{width}-clear.png'))
                swipe('#panel-content',dy=-70);assert full(),name+' body scroll'
                swipe('.drawer-handle',dx=70,dy=5);assert full(),name+' horizontal gesture'
                swipe('.drawer-handle');assert not full() and page.locator('#panel').is_visible(),name+' half'
                swipe('.drawer-handle');assert page.locator('#panel').is_hidden(),name+' closed'
                assert not page.locator('#stage').evaluate('e=>e.inert')
                assert page.locator('#world canvas').is_visible()
                checks.append(name+': body scroll; ignore horizontal drag; full → half → close; scene restored')
                print(engine,width,name,'PASS',flush=True)
                if name=='live':press('#studio-back');page.wait_for_timeout(400)
        press('[data-nav="atlas"]');press('[data-detail="E9"]')
        assert '3.600B' in page.locator('[data-buy="E9"]').inner_text()
        checks.append('shop dragon price 3.600B; no development helper; '+args.version+' title')
        page.screenshot(path=str(out/f'{engine}-{width}-price.png'))
        assert not errors,errors
        assert not failed,failed
        reports.append({'engine':engine,'width':width,'url':args.url,'checks':checks,'errors':errors,'failedResources':failed})
        context.close();browser.close()
(out/'report.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(reports,ensure_ascii=False,indent=2))
