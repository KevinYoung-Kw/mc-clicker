"""Check actual translucent room placement models with mouse and touch in isolated saves."""
import argparse
import importlib.util
import json
from pathlib import Path
import sys
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('interiors', ROOT / 'scripts/verify-interiors-release.py')
helpers = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helpers)
parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:8890/')
args = parser.parse_args()
state = helpers.fixture()['state']
output = ROOT / 'docs/qa'
report = {'url': args.url, 'checks': {}, 'screens': {}, 'errors': [], 'failedRequests': []}

def inspect(page):
    return page.evaluate('''()=>{const w=mcDebug.world,g=w.studioModelGhost,meshes=[];
      g?.traverse(o=>{if(o.isMesh)meshes.push(o)});
      return {exists:!!g,uuid:g?.uuid,id:g?.userData.previewId,valid:g?.userData.valid,
      site:g?.userData.site,rotation:g?.rotation.y,meshes:meshes.length,
      materials:w.studioPreviewMaterials?.map(m=>m.uuid)||[],
      translucent:meshes.every(o=>o.material.transparent&&o.material.opacity>0&&o.material.opacity<1&&!o.material.depthWrite),
      overflow:document.documentElement.scrollWidth>innerWidth,
      counts:{...mcDebug.state.counts},collection:structuredClone(mcDebug.state.collection)}}''')

def click(page, selector, touch):
    node=page.locator(selector).first
    node.wait_for(state='visible')
    node.tap() if touch else node.click()
    if any(key in selector for key in ['data-buy=', 'data-room-move=', 'data-room-extra=']):
        page.wait_for_timeout(500)  # Finish the panel-to-placement camera transition.

def project(page, x, z):
    return page.evaluate('''async ([x,z])=>{const T=await import('/node_modules/.vite/deps/three.js'),w=mcDebug.world;
      const p=new T.Vector3(x,.205,z).project(w.camera),r=w.renderer.domElement.getBoundingClientRect();
      return {x:r.x+(p.x+1)*r.width/2,y:r.y+(1-p.y)*r.height/2};}''',[x,z])

def click_point(page, point, touch):
    if touch: page.touchscreen.tap(point['x'],point['y'])
    else: page.mouse.click(point['x'],point['y'])
    page.wait_for_timeout(110)

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--use-angle=metal'] if sys.platform=='darwin' else [])
    for name,width,height,touch in [('desktop',1440,960,False),('mobile',390,844,True)]:
        context=browser.new_context(viewport={'width':width,'height':height},is_mobile=touch,has_touch=touch,device_scale_factor=1)
        context.add_init_script(f"localStorage.setItem('mc-clicker-world-v2',{json.dumps(json.dumps(state))})")
        page=context.new_page()
        page.on('pageerror',lambda error:report['errors'].append(str(error)))
        page.on('requestfailed',lambda request:report['failedRequests'].append(request.url))
        page.goto(args.url,wait_until='networkidle')
        page.wait_for_function('window.mcDebug && mcDebug.world')
        click(page,'[data-nav="live"]',touch)
        page.wait_for_function('mcDebug.world.interior')
        checks={}
        click(page,'[data-room-tab="equipment"]',touch)
        before=inspect(page)
        click(page,'[data-buy="L3"]',touch)
        page.wait_for_function('!!mcDebug.world.studioModelGhost')
        initial=inspect(page)
        assert initial['id']=='L3' and initial['meshes']>8 and initial['translucent'],initial
        assert not page.locator('#placement-confirm').is_enabled()
        assert initial['counts']==before['counts'] and initial['collection']==before['collection']
        checks['newCameraShowsRealTranslucentModelBeforeCharge']=True
        # Host work area is occupied, and must show a red invalid preview.
        click_point(page,project(page,0,-.75),touch)
        invalid=inspect(page)
        assert not invalid['valid'] and not page.locator('#placement-confirm').is_enabled(),invalid
        page.screenshot(path=output/f'indoor-preview-{name}-invalid.png')
        checks['occupiedLocationShowsInvalidPreview']=True
        # Use a visible front-row legal floor point through the same pointer path.
        click_point(page,project(page,1.5,1.25),touch)
        valid=inspect(page)
        assert valid['valid'] and page.locator('#placement-confirm').is_enabled(),valid
        click(page,'#placement-rotate',touch)
        rotated=inspect(page)
        assert rotated['uuid']==initial['uuid'] and rotated['materials']==initial['materials']
        assert rotated['rotation']!=valid['rotation']
        page.screenshot(path=output/f'indoor-preview-{name}-camera.png')
        checks['MoveAndRotateReusePreviewGeometryAndMaterials']=True
        click(page,'#placement-cancel',touch)
        cancelled=inspect(page)
        assert not cancelled['exists'] and not cancelled['materials']
        assert cancelled['counts']==before['counts'] and cancelled['collection']==before['collection']
        checks['CancelRemovesPreviewWithoutBuying']=True

        # Confirm one camera, then inspect the same ghost path for free rearranging.
        click(page,'[data-buy="L3"]',touch)
        click_point(page,project(page,1.5,1.25),touch)
        click(page,'#placement-confirm',touch)
        page.wait_for_function('mcDebug.state.counts.L3===1')
        assert not inspect(page)['exists']
        click(page,'[data-room-tab="arrange"]',touch)
        click(page,'[data-room-select="L3:0"]',touch)
        click(page,'[data-room-move="L3:0"]',touch)
        moving=inspect(page)
        assert moving['exists'] and moving['id']=='L3' and moving['translucent']
        click(page,'#placement-cancel',touch)
        checks['ExistingDeviceMoveUsesSameRealModelPreview']=True

        for slot in ['studioShelf','studioDesk','studioWall','studioSign']:
            click(page,'[data-room-tab="decor"]',touch)
            click(page,f'[data-room-decor-slot="{slot}"]',touch)
            before=inspect(page)
            click(page,f'[data-room-extra="{slot}-0"]',touch)
            ghost=inspect(page)
            assert ghost['exists'] and ghost['id']==f'{slot}-0' and ghost['translucent'] and ghost['meshes']>3,ghost
            assert ghost['collection']==before['collection']
            if slot in ['studioDesk','studioWall']:
                assert page.locator('#placement-confirm').is_enabled(),slot
            if slot=='studioShelf':
                click_point(page,project(page,2.25,.75),touch)
            page.screenshot(path=output/f'indoor-preview-{name}-{slot}.png')
            click(page,'#placement-cancel',touch)
            assert not inspect(page)['exists']
            assert inspect(page)['collection']==before['collection']
            checks[f'{slot}PreviewsSelectedDesignWithoutEquipping']=True
        assert not inspect(page)['overflow']
        checks['NoHorizontalOverflow']=True
        report['checks'][name]=checks
        report['screens'][name]={'camera':initial,'invalid':invalid,'placed':valid}
        context.close()
    browser.close()
report['passed']=not report['errors'] and not report['failedRequests'] and all(all(c.values()) for c in report['checks'].values())
(output/'indoor-preview-observations.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
assert report['passed'],report
print(json.dumps({'passed':report['passed'],'checks':report['checks'],'errors':report['errors'],'failedRequests':report['failedRequests']},ensure_ascii=False,indent=2))
