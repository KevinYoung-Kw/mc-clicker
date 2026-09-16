"""Rail visual smoke test in isolated browser profiles; never reads player saves."""
import argparse
import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--url', default='http://127.0.0.1:8890/')
    ap.add_argument('--seed', default='/tmp/mc-rail-v121-fixture.json')
    ap.add_argument('--label', default='dev')
    ap.add_argument('--browser', choices=['chromium', 'webkit'], default='chromium')
    ap.add_argument('--dev', action='store_true')
    ap.add_argument('--release', default='V1.2.2')
    args = ap.parse_args()
    root = Path(__file__).resolve().parents[1]
    output = root / 'docs/qa' / f'rail-{args.release.lower()}-{args.label}'
    output.mkdir(parents=True, exist_ok=True)
    seed = json.loads(Path(args.seed).read_text())
    report = {'url': args.url, 'browser': args.browser, 'isolatedFixture': True, 'checks': [], 'errors': [], 'httpErrors': []}
    with sync_playwright() as p:
        browser = getattr(p, args.browser).launch(headless=True, args=['--use-angle=metal'] if args.browser == 'chromium' and sys.platform == 'darwin' else [])
        try:
            for mode, width, height in [('desktop', 1440, 1000), ('phone', 390, 844)]:
                context = browser.new_context(viewport={'width': width, 'height': height}, is_mobile=mode=='phone', has_touch=mode=='phone')
                context.add_init_script('localStorage.setItem("mc-clicker-world-v2",' + json.dumps(json.dumps(seed)) + ')')
                page = context.new_page()
                page.on('pageerror', lambda e: report['errors'].append(str(e)))
                page.on('response', lambda r: report['httpErrors'].append(r.url) if r.status >= 400 else None)
                page.goto(args.url, wait_until='networkidle')
                page.locator('#mine').wait_for(state='visible')
                assert args.release in page.locator('meta[name="description"]').get_attribute('content')
                if not args.dev:
                    assert page.evaluate('typeof window.mcDebug') == 'undefined'
                for realm in ['overworld', 'nether', 'end']:
                    if page.locator('#realm-toggle').is_visible():
                        page.locator('#realm-toggle').click()
                    page.locator(f'[data-realm="{realm}"]').click()
                    page.wait_for_timeout(700)
                    if args.dev:
                        counts = page.evaluate('''async()=>{
                          const w=mcDebug.world;
                          const {transportTopology,routeGrid}=await import('/src/routing.js');
                          const {createRailPath,railPoint}=await import('/src/rail-path.js');
                          const grid=routeGrid(mcDebug.state,w.view);
                          const clear=p=>!grid.boxes.some(b=>p.x>b.minX&&p.x<b.maxX&&p.z>b.minZ&&p.z<b.maxZ);
                          const candidates=transportTopology(mcDebug.state,w.view).edges.flatMap(edge=>{
                            const path=createRailPath(edge,clear);
                            return path.parts.filter(p=>p.kind==='arc').map(bend=>{
                              const p=railPoint(path,bend.start+bend.length/2);
                              const room=Math.min(...grid.boxes.map(b=>Math.hypot(Math.max(b.minX-p.x,0,p.x-b.maxX),Math.max(b.minZ-p.z,0,p.z-b.maxZ))));
                              return {edge,path,bend,room};
                            });
                          }).sort((a,b)=>b.room-a.room);
                          const {edge,path,bend}=candidates[0];
                          const at=bend.start+bend.length/2;
                          const {upgradeMultiplier}=await import('/src/upgrades.js');
                          mcDebug.state.transport.edges[edge.id]={total:at/path.length*24*upgradeMultiplier(mcDebug.state,'M16','cargo'),quantity:1,at:mcDebug.state.play};
                          w.cameraOffset.set(7,20,9);
                          w.inspectPoint(railPoint(path,at),2.2);w.update(true);
                          const bends=w.batch.reduce((sum,b)=>sum+b.objects.filter(o=>o.name==='rail-bend').length,0);
                          return {bends,parts:path.parts.length};
                        }''')
                        assert counts['bends'] > 0
                        report['checks'].append({'mode': mode, 'realm': realm, **counts})
                        page.wait_for_timeout(400)
                    page.screenshot(path=output/f'{mode}-{realm}.png')
                    assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
                report['checks'].append(mode + ': all three realms render without errors or overflow')
                context.close()
            if args.dev:
                page=browser.new_page(viewport={'width':1440,'height':1000})
                page.goto(args.url.rstrip('/')+'/scripts/rail-review.html',wait_until='networkidle')
                page.wait_for_function('window.railReviewReady')
                page.screenshot(path=output/'corner-gallery.png')
                page.close()
            assert not report['errors'], report['errors']
            assert not report['httpErrors'], report['httpErrors']
            report['passed']=True
        except Exception:
            if not page.is_closed():
                page.screenshot(path=output/'failure.png')
            raise
        finally:
            browser.close()
            (output/'observations.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(report,ensure_ascii=False))


if __name__ == '__main__':
    main()
