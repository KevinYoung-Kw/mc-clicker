"""Production-build regression using only real controls and local save storage."""
import argparse
import json
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:8933/')
parser.add_argument('--out', default='docs/v1.8/qa/performance/production')
parser.add_argument('--xhs', action='store_true')
args = parser.parse_args()
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / args.out
OUT.mkdir(parents=True, exist_ok=True)
KEY = 'mc-clicker-world-v2'
fixtures = {
    'early': 'docs/v1.8/qa/shopping-recommendations/seed.json',
    'middle': 'docs/v1.6/qa/stability-baseline/fixtures/dense-0.json',
    'late': 'docs/v1.8/qa/performance/fixtures/crowd-fixture.json',
}
reports = []

def load(page):
    page.evaluate('window.dispatchEvent(new Event("blur"))')
    return page.evaluate(f'JSON.parse(localStorage.getItem("{KEY}"))')

def assets(s):
    return {k: s.get(k) for k in ['counts', 'placements', 'chunks', 'facilityStorage', 'guidance', 'housing', 'garden', 'upgrades']}

with sync_playwright() as p:
    for engine, width in [('chromium', 1440), ('webkit', 390)]:
        for stage, path in fixtures.items():
            raw = json.loads((ROOT / path).read_text())
            # Keep genuine historical state, mute only sound in the isolated browser.
            raw['sound'] = False
            expected = json.loads(subprocess.check_output(['node', '--input-type=module', '-e',
                "import {restore} from './src/game.js';let t='';for await(const c of process.stdin)t+=c;console.log(JSON.stringify(restore(JSON.parse(t),0)));"], input=json.dumps(raw), text=True, cwd=ROOT))
            browser = getattr(p, engine).launch(headless=True)
            context = browser.new_context(viewport={'width': width, 'height': 844}, is_mobile=width<760, has_touch=width<760)
            context.add_init_script(f'if(!localStorage.getItem("{KEY}"))localStorage.setItem("{KEY}",'+json.dumps(json.dumps(raw))+')')
            page = context.new_page()
            errors, http_errors = [], []
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.on('response', lambda r: http_errors.append(r.url) if r.status>=400 else None)
            try:
                page.goto(args.url, wait_until='networkidle')
                if args.xhs: page.locator('#xhs-start button').click()
                assert page.evaluate('typeof mcDebug') == 'undefined'
                first = load(page)
                assert assets(first) == assets(expected), f'{engine}/{stage}: ownership changed on restore'
                page.bring_to_front()
                page.evaluate('window.dispatchEvent(new Event("focus"))')
                page.wait_for_timeout(4000)
                running = load(page)
                assert running['play'] > first['play'], f'{stage}: simulation stopped'
                assert assets(running) == assets(first)
                menus = []
                for nav in ['build', 'village', 'network', 'atlas']:
                    if args.xhs and nav=='atlas':
                        if not page.locator('#hud-more').is_visible(): continue
                        page.locator('#hud-more').click()
                        button=page.locator('#atlas-open')
                    else: button = page.locator(f'[data-nav="{nav}"]')
                    if not button.is_visible():
                        continue
                    button.click()
                    assert page.locator('#panel').is_visible(), f'{nav}: panel did not open'
                    menus.append(nav)
                    page.locator('#panel-close').click()
                    canvas = page.locator('#world canvas')
                    bounds = canvas.bounding_box()
                    assert bounds and bounds['width']>100 and bounds['height']>100
                paused = load(page)
                page.wait_for_timeout(1000)
                assert load(page)['play'] == paused['play'], 'background should not earn'
                page.reload(wait_until='networkidle')
                if args.xhs: page.locator('#xhs-start button').click()
                restored = load(page)
                assert assets(restored) == assets(paused)
                assert restored['play'] >= paused['play']
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                page.screenshot(path=str(OUT / f'{engine}-{stage}.png'))
                assert not errors, errors
                assert not http_errors, http_errors
                reports.append({'engine':engine,'width':width,'stage':stage,'oldSavePreserved':True,'continuedProduction':True,'backgroundPaused':True,'menusAndReload':True,'menusActuallyOpened':menus,'noDebug':True,'errors':errors,'httpErrors':http_errors})
                print(engine, stage, 'PASS', flush=True)
            finally:
                browser.close()
(OUT/'report.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2))
