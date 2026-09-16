"""Garden release verification: real controls, persisted saves, no debug API."""
from pathlib import Path
import argparse, json, subprocess
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:8893/projects/mc-clicker-2/')
parser.add_argument('--out', default='docs/v1.6/qa/garden-production')
parser.add_argument('--version', default=json.loads((ROOT/'package.json').read_text())['version'])
args = parser.parse_args()
out = ROOT / args.out
out.mkdir(parents=True, exist_ok=True)
fixture = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', '''
import {residentFixture} from './scripts/resident-fixture.mjs';
import {buy,sites,frontier} from './src/game.js';
const s=residentFixture();s.play=1200;s.money=1e8;
while(!sites(s,'overworld',null,'V20').length)buy(s,'V1',frontier(s)[0]);
const r=buy(s,'V20',sites(s,'overworld',null,'V20')[0]);if(!r.ok)throw Error(r.reason);
s.guidance.notices=false;s.guidance.counter=true;s.narrative.companionsShown=true;
s.narrative.intro='released';s.savedAt=1;console.log(JSON.stringify(s));
'''], cwd=ROOT))
reports = []
with sync_playwright() as p:
    for engine, width in [('chromium', 1440), ('webkit', 390), ('chromium', 320)]:
        browser = getattr(p, engine).launch(headless=True, **({'args':['--use-angle=metal']} if engine=='chromium' else {}))
        context = browser.new_context(viewport={'width':width,'height':844}, is_mobile=width<760, has_touch=width<760)
        context.add_init_script('if(!localStorage.getItem("mc-clicker-world-v2"))localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(fixture))+')')
        page = context.new_page()
        errors, failed = [], []
        def record_error(error):
            errors.append({'message': str(error), 'stack': error.stack, 'action': current_action})
            (out/f'errors-{engine}-{width}.json').write_text(json.dumps(errors,ensure_ascii=False,indent=2)+'\n')
        current_action='load'
        page.on('pageerror', record_error)
        page.on('response', lambda r: failed.append(r.url) if r.status>=400 else None)
        def press(selector):
            global current_action
            current_action=selector
            loc=page.locator(selector).first
            loc.tap() if width<760 else loc.click()
        def saved():
            return page.evaluate('JSON.parse(localStorage.getItem("mc-clicker-world-v2"))')
        def expect_count(n):
            page.wait_for_function('n=>JSON.parse(localStorage.getItem("mc-clicker-world-v2")).garden.plants.length===n',arg=n)
        def place_on_visible_land():
            # Explore actual visible map positions, never set hidden game state.
            page.wait_for_timeout(350)
            box=page.locator('#world canvas').bounding_box()
            points=[]
            for y in range(2,30):
                for x in range(1,32):
                    points.append((box['x']+box['width']*x/32,box['y']+box['height']*y/32))
            points.sort(key=lambda p:(p[0]-box['x']-box['width']/2)**2+(p[1]-box['y']-box['height']/2)**2)
            for x,y in points:
                if not page.evaluate('p=>document.elementFromPoint(p.x,p.y)===document.querySelector("#world canvas")',{'x':x,'y':y}):continue
                page.touchscreen.tap(x,y) if width<760 else page.mouse.click(x,y)
                if page.locator('#placement-confirm').is_enabled():return
            page.screenshot(path=str(out/f'failed-placement-{engine}-{width}.png'))
            raise AssertionError('No valid visible planting position')
        page.goto(args.url,wait_until='networkidle')
        page.wait_for_selector('#world canvas')
        assert page.evaluate('typeof window.mcDebug')=='undefined'
        assert args.version in page.title()
        press('[data-nav="atlas"]');press('[data-detail="V20"]')
        assert page.locator('.garden-panel').is_visible()
        if width<760:press('#panel-expand')
        press('[data-garden-plant="turf"]');place_on_visible_land()
        page.screenshot(path=str(out/f'placement-{engine}-{width}.png'))
        press('#placement-cancel');expect_count(0)
        press('[data-garden-plant="turf"]');place_on_visible_land();press('#placement-confirm');expect_count(1)
        press('[data-garden-level="flowers"]');press('[data-garden-plant="wildflowers"]');place_on_visible_land();press('#placement-confirm');expect_count(2)
        old=saved()['placements']['V20']
        press('[data-buy="V20"]');press('#placement-confirm')
        page.wait_for_function('JSON.parse(localStorage.getItem("mc-clicker-world-v2")).counts.V20===2')
        assert saved()['placements']['V20']==old
        press('[data-garden-level="trees"]');assert page.locator('[data-garden-plant="bamboo"]').is_enabled()
        # A rectangular hedge makes a spurious quarter turn observable in the
        # shared guide, and persisted rotation verifies the final world object.
        press('[data-garden-plant="hedge"]')
        initial=page.locator('#placement-detail').inner_text()
        for _ in range(17):
            page.wait_for_timeout(143)
            assert page.locator('#placement-detail').inner_text()==initial,'Preview rotated without input'
        press('#placement-rotate')
        rotated=page.locator('#placement-detail').inner_text();assert rotated!=initial
        for _ in range(17):
            page.wait_for_timeout(143)
            assert page.locator('#placement-detail').inner_text()==rotated,'Preview kept rotating after one click'
        place_on_visible_land();page.screenshot(path=str(out/f'fixed-rotation-{engine}-{width}.png'))
        press('#placement-confirm');expect_count(3)
        assert saved()['garden']['plants'][-1]['rotation']==1
        press('[data-garden-tab="arrange"]')
        ident=saved()['garden']['plants'][1]['id']
        while not page.locator(f'[data-garden-object="{ident}"]').count():press('[data-garden-more]')
        press(f'[data-garden-object="{ident}"]');press('[data-garden-clear]');expect_count(2)
        assert saved()['garden']['stored']['wildflowers']==1
        press('[data-garden-undo]');expect_count(3)
        assert saved()['garden']['stored']['wildflowers']==0
        page.screenshot(path=str(out/f'arrange-{engine}-{width}.png'))
        press('[data-nav="build"]')
        state=saved()['garden']
        page.reload(wait_until='networkidle');page.wait_for_selector('#world canvas')
        assert saved()['garden']['plants']==state['plants']
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
        assert not errors,errors
        assert not failed,failed
        reports.append({'engine':engine,'width':width,'version':args.version,'noDebug':True,'errors':errors,'failedResources':failed,'flows':['restore pre-garden save with workyard','expanded menu','cancel planting','ground planting','flower planting','in-place upgrade','level unlock','stationary preview for 2.4 seconds','one explicit 90-degree rotation','stationary rotated preview for 2.4 seconds','confirmed rotation persists','return to storage','undo','exit','reload persistence']})
        print(engine,width,'passed',flush=True)
        context.close();browser.close()
(out/'report.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2)+'\n')
