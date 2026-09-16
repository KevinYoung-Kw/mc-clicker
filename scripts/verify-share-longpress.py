"""PNG previews in isolated Chromium/WebKit; native OS save menus require a real phone."""
import argparse
import base64
import importlib.util
import json
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:8932/')
parser.add_argument('--out', default='docs/v1.7/qa/share-longpress')
args = parser.parse_args()
out = root / args.out
out.mkdir(parents=True, exist_ok=True)
spec = importlib.util.spec_from_file_location('sharing_qa', root/'scripts/verify-sharing-release.py')
qa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qa)
seed = json.loads(subprocess.check_output(['node','--input-type=module','-e','''
import {fresh,buy,sites,frontier} from './src/game.js';
import {ITEMS} from './src/catalog.js';
import {chooseOpening} from './src/opening-guide.js';
import {buyGuidance} from './src/guidance.js';
const s=fresh(42);chooseOpening(s,'returning');s.money=1e6;
for(const id of ['info','counter','nameplate','goals'])buyGuidance(s,id);
for(const id of ['T1','V1','V18','V2','V3','L1']) {
  const item=ITEMS[id];
  for(let tries=0;item.place&&id!=='V1'&&!sites(s,item.realm,null,id).length&&tries<8;tries++) {
    const land=buy(s,'V1',{...frontier(s,item.realm)[0],realm:item.realm});
    if(!land.ok)throw Error(land.reason);
  }
  const result=buy(s,id);if(!result.ok)throw Error(id+': '+result.reason);
}
console.log(JSON.stringify(s));
'''],cwd=root,text=True))
seed['reducedMotion'] = True
seed['sound'] = False
seed['audio']['narratorVoice'] = False
styles = ['', 'web-card-worklog', 'web-card-oak', 'web-card-redstone', 'web-card-end']
for style in styles[1:]:
    seed['webAppearance']['owned'][style] = True

report = []
with sync_playwright() as p:
    for engine, width in [('chromium',1440),('chromium',320),('webkit',390)]:
        mobile = width < 760
        browser = getattr(p, engine).launch(headless=True, **({'args':['--use-angle=metal']} if engine=='chromium' else {}))
        context = browser.new_context(viewport={'width':width,'height':844},is_mobile=mobile,has_touch=mobile)
        context.add_init_script('localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(seed))+')')
        context.add_init_script(qa.STUB+'window.__shareQA.supportFiles=false;')
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(args.url,wait_until='networkidle')
        # Reconnaissance before acting on the rendered sharing surface.
        assert page.locator('#share-open').count()==1
        qa.open_share(page,mobile)
        assert page.locator('#image-save-hint').is_hidden()
        assert page.locator('#share-card-style').count()==1
        for style in styles:
            if style:
                name = page.locator(f'#share-card-style option[value="{style}"]').inner_text()
                page.get_by_role('combobox', name='纪念卡样式').click()
                page.get_by_role('option').filter(has_text=name).click()
            else:
                qa.click(page,'#generate-card',mobile)
            page.wait_for_function('document.querySelector(".share-card-image")?.complete && !document.querySelector("#generate-card").disabled')
            img = page.locator('.share-card-image')
            assert page.locator('#share-card-preview canvas').count()==0
            assert img.evaluate('(e)=>[e.naturalWidth,e.naturalHeight]')==[1440,1500]
            assert img.get_attribute('src').startswith('data:image/png;base64,')
            assert page.locator('#image-save-hint').is_visible()
            assert img.evaluate('e=>e.dispatchEvent(new MouseEvent("contextmenu",{bubbles:true,cancelable:true}))')
            assert img.evaluate('e=>getComputedStyle(e).pointerEvents')!='none'
            if page.evaluate('CSS.supports("-webkit-touch-callout", "default")'):
                assert img.evaluate('e=>getComputedStyle(e).getPropertyValue("-webkit-touch-callout")')=='default'
            with page.expect_download() as download:
                qa.click(page,'#download-card',mobile)
            downloaded = Path(download.value.path()).read_bytes()
            rendered = base64.b64decode(img.get_attribute('src').split(',')[1])
            assert rendered==downloaded, 'Long-press image must contain the original full-resolution PNG'
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
            if mobile:
                assert abs(page.locator('#generate-card').bounding_box()['y']-page.locator('#download-card').bounding_box()['y'])<1
            img.screenshot(path=str(out/f'{engine}-{width}-{style or "default"}.png'))
            report.append({'engine':engine,'width':width,'style':style or 'default','fullResolutionPNG':True,'originalBytes':True,'contextMenuAllowed':True,'noOverflow':True})
        # Native share failures leave the same long-press image available.
        page.evaluate('window.__shareQA.supportFiles=true')
        qa.click(page,'#generate-card',mobile)
        page.wait_for_function('!document.querySelector("#generate-card").disabled')
        assert page.locator('#native-share-image').is_enabled()
        page.evaluate('window.__shareQA.abortNext=true')
        qa.click(page,'#native-share-image',mobile)
        page.wait_for_function('!document.querySelector("#native-share-image").disabled')
        assert page.locator('.share-card-image').is_visible()
        page.screenshot(path=str(out/f'panel-{engine}-{width}.png'),full_page=True)
        qa.click(page,'#share-return',mobile)
        qa.open_share(page,mobile)
        assert page.locator('.share-card-image').count()==0
        assert page.locator('#image-save-hint').is_hidden()
        assert not errors, errors
        context.close()
        browser.close()
        print(f'{engine} {width}: five card styles passed',flush=True)
(out/'report.json').write_text(json.dumps({'cases':report,'nativePhoneSaveMenu':'not automated; device acceptance pending','errors':[]},indent=2)+'\n')
