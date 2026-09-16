"""Studio equipment placement must preserve model proportions across drawer layouts.

Uses an isolated save and real UI purchases. Development checks every rendered
projection; production checks the canvas/CSS ratio at each settled interaction.
"""
import argparse
import json
import subprocess
from pathlib import Path
from importlib.util import spec_from_file_location, module_from_spec
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
KEY = 'mc-clicker-world-v2'
spec = spec_from_file_location('base', ROOT / 'scripts/verify-interiors-release.py')
base = module_from_spec(spec)
spec.loader.exec_module(base)


def close_panel(page):
    for selector in ['#panel-close', '#room-close-panel']:
        if page.locator(selector).is_visible():
            page.locator(selector).click()
            return
    assert page.locator('#panel').is_hidden()


def choose_room_site(page):
    # An invalid floor candidate still moves the game's preview camera. Return
    # to overview before trying another screen point, rather than chasing a
    # camera that is moving outside the room after each unsuccessful tap.
    candidates = [(0.5, 0.65), (0.55, 0.55), (0.4, 0.6), (0.6, 0.6)]
    candidates += [(x / 20, y / 20) for y in range(9, 16) for x in range(6, 15)]
    for fx, fy in candidates:
        bounds = page.locator('#world canvas').bounding_box()
        page.touchscreen.tap(bounds['x'] + bounds['width'] * fx, bounds['y'] + bounds['height'] * fy)
        page.wait_for_timeout(100)
        if page.locator('#placement-confirm').is_enabled():
            return
        if page.locator('#home-view').is_visible():
            page.locator('#home-view').click()
        page.wait_for_timeout(650)
    raise AssertionError('No legal room site could be selected from overview')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', required=True)
    parser.add_argument('--label', required=True)
    parser.add_argument('--development', action='store_true')
    parser.add_argument('--engine', choices=['all', 'chromium', 'webkit'], default='all')
    parser.add_argument('--short', action='store_true')
    parser.add_argument('--width', type=int)
    args = parser.parse_args()
    out = ROOT / 'docs/qa' / ('studio-viewport-' + args.label)
    out.mkdir(parents=True, exist_ok=True)
    seed = subprocess.check_output(['node', '--input-type=module', '-e', """
        import { residentFixture } from './scripts/resident-fixture.mjs';
        const s = residentFixture(); s.reducedMotion = false;
        s.skipPurchaseConfirmation = true;
        console.log(JSON.stringify(s));
    """], cwd=ROOT, text=True)
    report = {'url': args.url, 'development': args.development, 'checks': [], 'errors': [], 'cases': []}
    with sync_playwright() as pw:
        for engine in (['chromium', 'webkit'] if args.engine == 'all' else [args.engine]):
            browser = getattr(pw, engine).launch(**({'args': ['--use-angle=metal']} if engine == 'chromium' else {}))
            try:
                for width, height in ([(390, 480), (390, 600)] if args.short else [(1440, 900), (390, 844), (320, 640), (390, 480)]):
                    if args.width and width != args.width: continue
                    case = {'engine': engine, 'viewport': [width, height], 'samples': []}
                    report['cases'].append(case)
                    context = browser.new_context(viewport={'width': width, 'height': height}, has_touch=True, is_mobile=width < 760, device_scale_factor=1)
                    context.add_init_script(f'localStorage.setItem({json.dumps(KEY)}, {json.dumps(seed)})')
                    page = context.new_page()
                    page.set_default_timeout(15000)
                    page.on('pageerror', lambda error: report['errors'].append(str(error)))

                    def check(step):
                        page.wait_for_timeout(650)
                        sample = page.evaluate('''() => {
                          const c = document.querySelector('#world canvas'), r = c.getBoundingClientRect();
                          return {css: [r.width, r.height], buffer: [c.width, c.height], hidden: getComputedStyle(c).visibility,
                            overflow: document.documentElement.scrollWidth > innerWidth};
                        }''')
                        sample['step'] = step
                        case['samples'].append(sample)
                        assert not sample['overflow'], sample
                        assert min(sample['css']) > 0, sample
                        if width < 760 and height <= 600 and step in ['equipment', 'built', 'canceled', 'collapsed', 'choose-position', 'preview']:
                            assert sample['css'][1] >= (200 if step in ['choose-position', 'preview'] else 140), sample
                        error = abs((sample['buffer'][0] / sample['buffer'][1]) / (sample['css'][0] / sample['css'][1]) - 1)
                        assert error < .015, sample
                        if args.development:
                            data = page.evaluate('''() => {
                              const w=mcDebug.world;
                              return {aspect:w.aspect, projection:(w.camera.right-w.camera.left)/(w.camera.top-w.camera.bottom),
                                scale:w.roots.L2?.scale.toArray(), camera:w.captureCamera()};
                            }''')
                            sample.update(data)
                            assert abs(data['projection'] / (sample['css'][0]/sample['css'][1])-1) < .001, sample
                            assert data['scale'] == [1, 1, 1], sample

                    try:
                        page.goto(args.url, wait_until='networkidle')
                        assert page.evaluate('!!window.mcDebug') == args.development
                        for selector in ['[data-nav="build"]', '[data-open="owned"]', '[data-family="all"]', '[data-detail="L2"]']:
                            page.locator(selector).click()
                        page.wait_for_timeout(800)
                        close_panel(page)
                        if args.development:
                            page.evaluate('''() => {
                              const w=mcDebug.world, render=w.renderer.render.bind(w.renderer);
                              window.viewportFrames={count:0,bad:[],allocations:0};
                              const setSize=w.renderer.setSize.bind(w.renderer);
                              w.renderer.setSize=(...args)=>{viewportFrames.allocations++;return setSize(...args)};
                              w.renderer.render=(scene,camera)=>{
                                if(camera===w.camera){
                                  const r=w.renderer.domElement.getBoundingClientRect(), a=(camera.right-camera.left)/(camera.top-camera.bottom);
                                  viewportFrames.count++;
                                  if(r.height>0 && Math.abs(a/(r.width/r.height)-1)>.001)
                                    viewportFrames.bad.push({css:[r.width,r.height],aspect:a,mode:w.mode?.kind});
                                }
                                return render(scene,camera);
                              };
                            }''')
                        check('room')
                        original = page.evaluate('mcDebug.world.captureCamera()') if args.development else None
                        for attempt in range(2):
                            page.locator('[data-room-tab="equipment"]').click()
                            if page.locator('#game').evaluate('e=>e.classList.contains("sheet-expanded")'):
                                page.locator('#panel-expand').click()
                            check('equipment')
                            page.locator('[data-buy="L3"]').click()
                            page.wait_for_function('document.body.classList.contains("room-placing")')
                            check('choose-position')
                            choose_room_site(page)
                            check('preview')
                            before = base.saved(page)['counts'].copy()
                            page.locator('#placement-confirm' if attempt == 0 else '#placement-cancel').click()
                            check('built' if attempt == 0 else 'canceled')
                            after = base.saved(page)['counts']
                            assert after['L3'] == 1
                            if attempt: assert before == after
                            page.screenshot(path=out/f'{engine}-{width}-{height}-{"built" if attempt == 0 else "canceled"}.png')
                            if page.locator('#home-view').is_visible():
                                page.locator('#home-view').click()
                                check('overview')
                            for tab in ['arrange', 'decor', 'equipment']:
                                page.locator(f'[data-room-tab="{tab}"]').click()
                            if page.locator('#panel-expand').is_visible():
                                page.locator('#panel-expand').click()
                                check('expanded')
                                page.locator('#panel-expand').click()
                                check('collapsed')
                            close_panel(page)
                            check('closed')
                            if args.development:
                                assert page.evaluate('mcDebug.world.captureCamera()') == original
                        if width < 760:
                            page.set_viewport_size({'width': 844, 'height': 390})
                            check('landscape')
                            page.set_viewport_size({'width': width, 'height': height})
                            check('portrait')
                        page.evaluate('window.dispatchEvent(new Event("blur"))')
                        page.set_viewport_size({'width': width, 'height': height + 24})
                        check('paused-resize')
                        page.evaluate('window.dispatchEvent(new Event("focus"))')
                        check('resumed')
                        if args.development:
                            case['frames'] = page.evaluate('viewportFrames')
                            assert not case['frames']['bad'], case['frames']
                            allocations = case['frames']['allocations']
                            page.wait_for_timeout(700)
                            assert page.evaluate('viewportFrames.allocations') == allocations
                        report['checks'].append(f'{engine} {width}×{height}: buy/cancel, tabs, drawer, camera restore, viewport changes and resume retain proportions')
                        print(f'PASS {engine} {width}×{height}', flush=True)
                    except Exception as error:
                        report['failure'] = str(error)
                        page.screenshot(path=out/'failure.png')
                        raise
                    finally:
                        context.close()
            finally:
                browser.close()
                (out/'observations.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    assert not report['errors'], report['errors']
    report['passed'] = True
    (out/'observations.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({'passed': True, 'checks':len(report['checks']), 'report':str(out/'observations.json')}, ensure_ascii=False))

if __name__ == '__main__':
    main()
