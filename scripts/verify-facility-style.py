"""Capture actual outdoor/indoor model coverage and world rendering at two sizes.

Use --label before --url http://127.0.0.1:8892/ against a clean baseline,
then --label after against the working Vite server. Only isolated contexts get
fixture data; the script never touches a player's save or deploys files.
"""
import argparse
import json
from pathlib import Path
from urllib.parse import urljoin
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs' / 'qa'
parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:8890/')
parser.add_argument('--label', default='after')
args = parser.parse_args()
assert args.label.replace('-', '').isalnum()
OUT.mkdir(exist_ok=True)
prefix = f'facility-style-{args.label}'
report, errors = {}, []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--use-angle=metal'])
    page = browser.new_page(viewport={'width':1440,'height':1000}, device_scale_factor=1)
    page.on('pageerror', lambda e: errors.append(str(e)))
    # Serve the same harness in baseline and current trees without editing either
    # model implementation. Imports remain relative to each selected server.
    page.route('**/scripts/facility-model-study.html', lambda route: route.fulfill(path=str(ROOT / 'scripts/facility-model-study.html'), content_type='text/html'))
    page.goto(urljoin(args.url, 'scripts/facility-model-study.html'), wait_until='networkidle')
    page.wait_for_function('window.studyReady')
    for kind in ['outdoor', 'studio']:
        rows = page.evaluate('kind=>window.renderStudy(kind)', kind)
        assert rows and all(r['meshes'] > 0 and r['nonFinite'] == 0 for r in rows), rows
        await_images = 'Promise.all([...document.images].map(i=>i.decode()))'
        page.evaluate(await_images)
        page.screenshot(path=str(OUT / f'{prefix}-{kind}-models.png'), full_page=True)
        report[kind] = rows
    # Render all 96 current shop entries independently of the facility sheets;
    # this also catches an icon path that accidentally uses a missing export.
    page.goto(urljoin(args.url,'scripts/icon-studio.html'), wait_until='networkidle')
    page.wait_for_function('window.renderIcon && window.iconIds')
    icon_ids = page.evaluate('window.iconIds')
    icon_results = page.evaluate('''()=>window.iconIds.map(id=>{
      const url=renderIcon(id);return {id,bytes:url.length};})''')
    assert len(icon_ids) == 96 and all(x['bytes'] > 500 for x in icon_results)
    report['catalogIcons'] = {'count':len(icon_ids),'results':icon_results}
    page.close()
    fixture = json.loads((ROOT / 'tests' / 'fixtures' / 'layout-v2.json').read_text())
    fixture['reducedMotion'] = True
    # Include all devices at their real defaults; populated old saves may not
    # include the newer scene ownership metadata until restore has run.
    fixture['counts']['L3'] = 3
    for key in [f'L{i}' for i in range(1,15)]:
        fixture['counts'][key] = max(1,fixture['counts'].get(key,0))
    fixture['live'].update({'director':False,'shot':'L2','camera':'overworld'})
    fixture['live']['gifts'] = [{'id':i+1,'value':100,'life':35,'expression':False,'x':15+i*7,'y':35} for i in range(8)]
    fixture['live']['giftSerial'] = 8
    report['scenes'] = {}
    for name, width, height, touch in [('desktop',1440,960,False),('mobile',390,844,True)]:
        context = browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1,is_mobile=touch,has_touch=touch)
        page = context.new_page()
        page.on('pageerror',lambda e: errors.append(str(e)))
        page.goto(args.url,wait_until='networkidle')
        page.wait_for_function('window.mcDebug && mcDebug.world')
        page.evaluate("window.dispatchEvent(new Event('blur'))")
        report['scenes'][name] = {}
        for scene in ['world','nether','end','studio']:
            raw = dict(fixture)
            raw['realm'] = scene if scene in ['nether','end'] else 'overworld'
            page.evaluate('s=>mcDebug.setState(s)',raw)
            page.evaluate("mcDebug.go('world')")
            if scene == 'studio':
                page.locator('[data-nav="live"]').click()
                page.wait_for_function('mcDebug.world.interior')
            page.wait_for_timeout(900)
            page.evaluate("window.dispatchEvent(new Event('blur'));cancelAnimationFrame(mcDebug.world.raf);mcDebug.world.update(true)")
            state = page.evaluate('''()=>{const w=mcDebug.world,r=w.renderer;return {
              interior:w.interior,realm:w.view,meshes:r.info.render.calls,triangles:r.info.render.triangles,
              memory:{...r.info.memory},programs:r.info.programs.length,shadow:r.shadowMap.enabled,
              pixelRatio:r.getPixelRatio(),canvas:[r.domElement.width,r.domElement.height],
              overflow:document.documentElement.scrollWidth>innerWidth,
              devices:Object.keys(w.roots).filter(k=>k==='L1'||/^L(3:|[4-9]$|1[0-4]$)/.test(k))}}''')
            assert not state['overflow']
            if scene in ['nether','end']:
                assert state['realm'] == scene and not state['interior'], state
            if scene == 'studio':
                expected = ['L1','L3:0','L3:1','L3:2']+[f'L{i}' for i in range(4,15)]
                assert set(expected).issubset(state['devices']), state
            page.screenshot(path=str(OUT / f'{prefix}-{name}-{scene}.png'))
            report['scenes'][name][scene] = state
            if scene == 'world' and args.label == 'after':
                lamp = page.evaluate('''async()=>{
                  const T=await import('/node_modules/.vite/deps/three.js');
                  const w=mcDebug.world,anchor=w.roots.M19,lights=w.statusLights;
                  if(!anchor||!lights.length)return {registered:false};
                  const light=lights[0],within=(p)=>{let q=p;while(q){if(q===anchor)return true;q=q.parent}return false};
                  let body;anchor.traverse(o=>{if(o.userData.facilityPart==='lamp-block')body=o});
                  const result={registered:!!body,onPart:light.on.userData.facilityPart,offPart:light.off.userData.facilityPart,
                    inLamp:within(light.on)&&within(light.off),noDetachedStatusDots:anchor.children.length===1};
                  if(body){const a=new T.Box3().setFromObject(body),b=new T.Box3().setFromObject(light.on),margin=.08*anchor.scale.x;
                    a.expandByScalar(margin);result.faceInsideBodyEnvelope=a.containsBox(b)}
                  const original=w.current.power[light.realm];
                  try{for(const value of [0,1]){w.current.power[light.realm]=value;w.rateAt=performance.now();w.update(true);result[value?'powered':'unpowered']={on:light.on.visible,off:light.off.visible}}}
                  finally{w.current.power[light.realm]=original;w.rateAt=performance.now();w.update(true)}
                  return result;
                }''')
                assert lamp['registered'] and lamp['inLamp'] and lamp['noDetachedStatusDots'] and lamp['faceInsideBodyEnvelope'],lamp
                assert lamp['onPart'] == 'lamp-on' and lamp['offPart'] == 'lamp-off',lamp
                assert lamp['powered'] == {'on':True,'off':False} and lamp['unpowered'] == {'on':False,'off':True},lamp
                report['scenes'][name]['lampStatus'] = lamp
        context.close()
    browser.close()
report['errors'] = errors
assert not errors, errors
if args.label == 'after':
    before = json.loads((OUT / 'facility-style-before-observations.json').read_text())
    report['comparison'], report['warnings'] = {}, []
    for screen in ['desktop','mobile']:
        report['comparison'][screen] = {}
        for scene in ['world','nether','end','studio']:
            a,b = before['scenes'][screen][scene],report['scenes'][screen][scene]
            assert a['shadow'] == b['shadow'] == True and a['pixelRatio'] == b['pixelRatio'],(a,b)
            diff = {'callsPercent':round((b['meshes']/a['meshes']-1)*100,1),'trianglesPercent':round((b['triangles']/a['triangles']-1)*100,1)}
            report['comparison'][screen][scene] = diff
            if diff['callsPercent'] > 20:
                report['warnings'].append(f"{screen}/{scene}: draw calls +{diff['callsPercent']}%; profile before release")
(OUT / f'{prefix}-observations.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'label':args.label,'outdoor':len(report['outdoor']),'studio':len(report['studio']),'catalog':report['catalogIcons']['count'],'scenes':report['scenes'],'comparison':report.get('comparison'),'warnings':report.get('warnings'),'errors':errors},ensure_ascii=False,indent=2))
