"""Private player save -> image -> exact envelope, localhost only, no payload artifacts."""
import argparse, base64, io, json, subprocess
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
p = argparse.ArgumentParser()
p.add_argument('--input', required=True)
p.add_argument('--url', default='http://127.0.0.1:8935/')
p.add_argument('--out', required=True)
a = p.parse_args()
if not a.url.startswith(('http://127.0.0.1:', 'http://localhost:')):
    raise ValueError('Private save tests must run on localhost')
fixture = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', '''
import fs from 'node:fs';import {createRequire} from 'node:module';
import {encodePortableSave,decodePortableSave} from './src/save-brotli.js';
const br=createRequire(import.meta.url)('brotli-wasm');
const original=fs.readFileSync(process.argv[1],'utf8').trim();
const old=await decodePortableSave(original,async()=>br);
const code=await encodePortableSave(old.save,old.release,old.savedAt,async()=>br);
const expected=await decodePortableSave(code,async()=>br);
console.log(JSON.stringify({code,save:expected.save,expected,originalCharacters:original.length}));
''', a.input], cwd=ROOT, text=True))
rows = []
with sync_playwright() as pw:
    for engine in ['chromium', 'webkit']:
        browser = getattr(pw, engine).launch(headless=True)
        page = browser.new_page()
        page.route('**/*', lambda route: route.continue_() if route.request.url.startswith((a.url, 'data:', 'blob:')) else route.abort())
        page.goto(a.url, wait_until='networkidle')
        page.wait_for_function('!!window.saveImageQA')
        for theme in page.evaluate('saveImageQA.themes'):
            url = page.evaluate('x=>saveImageQA.generate(x)', {k:fixture[k] for k in ['code','save']} | {'theme':theme})
            png = base64.b64decode(url.split(',')[1])
            im = Image.open(io.BytesIO(png)).convert('RGB').resize((1080,1280), Image.Resampling.LANCZOS)
            for kind in ['original','jpeg','webp']:
                if kind == 'original': data, mime = png, 'png'
                else:
                    buf = io.BytesIO(); im.save(buf, format=kind.upper(), quality=70 if kind=='jpeg' else 75)
                    data, mime = buf.getvalue(), kind
                result = page.evaluate('async url=>{try{return {value:await saveImageQA.read(url)}}catch(e){return {error:e.message}}}', 'data:image/'+mime+';base64,'+base64.b64encode(data).decode())
                actual = result.get('value', {})
                exact = actual.get('code') == fixture['code'] and {k:v for k,v in actual.items() if k!='code'} == fixture['expected']
                if actual: assert exact, 'Incorrect restore'
                row = {'engine':engine,'theme':theme or 'default','case':kind,'completeSaveExact':exact,'error':result.get('error','')}
                rows.append(row); print(json.dumps(row), flush=True)
        browser.close()
Path(a.out).write_text(json.dumps({'originalCharacters':fixture['originalCharacters'],'compressedCharacters':len(fixture['code']),'rows':rows}, indent=2)+'\n')
assert all(r['completeSaveExact'] for r in rows), 'Some private save variants failed'
