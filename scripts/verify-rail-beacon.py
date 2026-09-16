"""Dense late-game rail and beacon visual inspection in isolated saves."""
import argparse, json
from pathlib import Path
from playwright.sync_api import sync_playwright

ap=argparse.ArgumentParser()
ap.add_argument('--url',default='http://127.0.0.1:8890/')
ap.add_argument('--label',default='before')
args=ap.parse_args()
root=Path(__file__).resolve().parents[1]
out=root/'docs/qa'/('rail-beacon-'+args.label)
out.mkdir(parents=True,exist_ok=True)
seed=json.loads(Path('/tmp/mc-rail-v121-fixture.json').read_text())
seed['reducedMotion']=False
report={'checks':[],'errors':[]}
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,args=['--use-angle=metal'])
    try:
        for width,height in [(1440,1000),(390,844)]:
            ctx=browser.new_context(viewport={'width':width,'height':height},is_mobile=width<760,has_touch=width<760)
            page=ctx.new_page()
            page.on('pageerror',lambda e:report['errors'].append(str(e)))
            page.add_init_script('localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(seed))+')')
            page.goto(args.url,wait_until='networkidle')
            page.wait_for_function('!!window.mcDebug')
            page.wait_for_timeout(2500)
            data=page.evaluate('''()=>{const w=mcDebug.world;return {roots:Object.keys(w.roots),drawCalls:w.renderer.info.render.calls,triangles:w.renderer.info.render.triangles,railMeshes:w.batch.reduce((s,b)=>s+b.objects.filter(o=>o.name.startsWith('rail-')).length,0),power:w.current.electricity.perDevice.N10}}''')
            page.screenshot(path=out/f'{width}-world.png')
            if page.locator('#realm-toggle').is_visible(): page.locator('#realm-toggle').click()
            page.locator('[data-realm="nether"]').click()
            page.wait_for_timeout(700)
            page.evaluate('''()=>{const w=mcDebug.world;const p=mcDebug.state.placements.N10;w.inspectPoint({x:p.x,y:1.3,z:p.z},3.8);w.update(true)}''')
            page.wait_for_timeout(600)
            page.screenshot(path=out/f'{width}-beacon.png')
            report['checks'].append({'width':width,**data})
            ctx.close()
        assert not report['errors'],report['errors']
    finally:
        (out/'results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
        browser.close()
print(json.dumps(report,ensure_ascii=False))
