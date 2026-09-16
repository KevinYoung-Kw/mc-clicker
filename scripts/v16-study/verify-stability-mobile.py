"""Dense V1.6 scene, normal animation and menu/viewport recovery on mobile engines."""
from pathlib import Path
import argparse, json
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:8890/')
parser.add_argument('--out', default='docs/v1.6/qa/stability-fixed/mobile-peak')
parser.add_argument('--engine', choices=['both', 'webkit', 'chromium'], default='both')
args = parser.parse_args()
out = Path(args.out); out.mkdir(parents=True, exist_ok=True)
fixture = json.loads(Path('docs/v1.6/qa/stability-baseline/fixtures/peak.json').read_text())
report = []
with sync_playwright() as p:
    for engine, width in [('webkit', 390), ('chromium', 320)]:
        if args.engine != 'both' and engine != args.engine:
            continue
        browser = getattr(p, engine).launch(headless=True, **({'args': ['--use-angle=metal']} if engine == 'chromium' else {}))
        context = browser.new_context(viewport={'width': width, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=3)
        page = context.new_page(); errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(args.url, wait_until='networkidle')
        page.wait_for_function('window.mcDebug?.world')
        page.evaluate('s=>mcDebug.setState(s)', fixture)
        page.wait_for_timeout(2000)

        def snapshot():
            return page.evaluate('''()=>{const w=mcDebug.world,c=w.renderer.domElement;
            return {buffer:[c.width,c.height],geometries:w.renderer.info.memory.geometries,
              textures:w.renderer.info.memory.textures,programs:w.renderer.info.programs.length,
              visible:!!c.getBoundingClientRect().width,finiteCamera:w.camera.projectionMatrix.elements.every(Number.isFinite),
              stageInert:document.querySelector('#stage').inert}}''')

        before = snapshot()
        page.evaluate('window.__frames=[];window.__last=performance.now();window.__watch=true;requestAnimationFrame(function f(t){if(!__watch)return;__frames.push(t-__last);__last=t;requestAnimationFrame(f)})')
        page.wait_for_timeout(6000)
        frames = page.evaluate('()=>{__watch=false;const a=__frames.sort((a,b)=>a-b);return {count:a.length,p50:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],max:a.at(-1)}}')
        page.screenshot(path=str(out/f'{engine}-{width}-peak.png'))
        for i in range(16):
            button = page.locator('[data-nav="'+['build','village','network','atlas'][i%4]+'"]')
            button.tap(); page.wait_for_timeout(180)
            button.tap(); page.wait_for_timeout(350)
            assert page.locator('#panel').is_hidden()
            assert page.locator('#world canvas').is_visible()
            assert not snapshot()['stageInert']
        page.set_viewport_size({'width': 844, 'height': width}); page.wait_for_timeout(1500)
        landscape = snapshot()
        page.set_viewport_size({'width': width, 'height': 844}); page.wait_for_timeout(1500)
        after = snapshot()
        for state in [before, landscape, after]:
            assert state['visible'] and state['finiteCamera'] and min(state['buffer']) > 0, state
        assert after['geometries'] == before['geometries']
        assert after['textures'] == before['textures']
        page.screenshot(path=str(out/f'{engine}-{width}-restored.png'))
        assert not errors, errors
        report.append({'engine':engine,'width':width,'deviceScaleFactor':3,'normalMotion':True,'residents':24,'workers':22,'gardenObjects':150,
                       'frames':frames,'before':before,'landscape':landscape,'after':after,'menuCycles':16,'errors':errors})
        (out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
        print(engine,width,'PASS',frames,flush=True)
        context.close(); browser.close()
