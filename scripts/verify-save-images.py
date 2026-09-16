"""Whole-card, real browser codec checks using public synthetic saves only."""
import argparse,base64,io,json,subprocess,time
from pathlib import Path
from PIL import Image,ImageFilter
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--url',default='http://127.0.0.1:8935/');p.add_argument('--engine',default='chromium',choices=['chromium','webkit']);p.add_argument('--quick',action='store_true');p.add_argument('--themes');p.add_argument('--fixture');args=p.parse_args()
OUT=ROOT/'docs/v1.7/qa/save-images';OUT.mkdir(parents=True,exist_ok=True)
fixtures=json.loads(subprocess.check_output(['node','--input-type=module','-e','''
import fs from 'node:fs';import {createRequire} from 'node:module';import {fresh} from './src/game.js';import {encodePortableSave,decodePortableSave} from './src/save-brotli.js';
const br=createRequire(import.meta.url)('brotli-wasm'),now=Date.parse('2026-09-10T09:30:00+08:00'),items=[];
for(const name of ['opening','village','advanced']) {const s=name==='opening'?fresh(42):JSON.parse(fs.readFileSync('/tmp/mcc-save-card-design/'+name+'.json'));s.savedAt=now;const code=await encodePortableSave(s,'QA',now,async()=>br);const expected=await decodePortableSave(code,async()=>br);items.push({name,code,save:s,expected})}console.log(JSON.stringify(items));
'''],cwd=ROOT,text=True))
def variant(im,kind):
 im=im.copy();fmt='PNG';quality=85
 if kind.startswith('jpeg'):
  _,width,q=kind.split('-');width=int(width);quality=int(q);im=im.resize((width,round(im.height*width/im.width)),Image.Resampling.LANCZOS);fmt='JPEG'
 elif kind=='webp-1080':im=im.resize((1080,1280),Image.Resampling.LANCZOS);fmt='WEBP';quality=75
 elif kind=='double-jpeg':
  im=im.resize((1080,1280),Image.Resampling.LANCZOS);first=io.BytesIO();im.save(first,format='JPEG',quality=85);first.seek(0);im=Image.open(first).copy();fmt='JPEG';quality=75
 elif kind=='gray':im=im.convert('L').convert('RGB');fmt='JPEG';quality=85
 elif kind=='rotate90':im=im.transpose(Image.Transpose.ROTATE_90)
 elif kind=='rotate180':im=im.transpose(Image.Transpose.ROTATE_180)
 elif kind=='blur':im=im.filter(ImageFilter.GaussianBlur(.3));fmt='JPEG';quality=85
 elif kind=='cropped':im=im.crop((0,0,im.width,im.height-130))
 elif kind=='damaged':
  from PIL import ImageDraw
  ImageDraw.Draw(im).rectangle((96,700,1300,1400),fill='white')
 buf=io.BytesIO();im.save(buf,format=fmt,**({'quality':quality} if fmt!='PNG' else {}));return buf.getvalue(),fmt.lower()
rows=[]
with sync_playwright() as p:
 browser=getattr(p,args.engine).launch(headless=True);page=browser.new_page();page.goto(args.url,wait_until='networkidle');page.wait_for_function('!!window.saveImageQA')
 themes=page.evaluate('saveImageQA.themes')
 if args.quick:fixtures=[fixtures[-1]];themes=['']
 if args.themes:themes=args.themes.split(',')
 if args.fixture:fixtures=[f for f in fixtures if f['name']==args.fixture]
 for f in fixtures:
  for theme in themes:
   start=time.monotonic();url=page.evaluate('x=>saveImageQA.generate(x)',{'code':f['code'],'save':f['save'],'theme':theme});png=base64.b64decode(url.split(',')[1]);im=Image.open(io.BytesIO(png)).convert('RGB')
   if f['name']=='advanced':(OUT/((theme or 'default')+'.png')).write_bytes(png)
   cases=['original','jpeg-1440-70','jpeg-1080-85','jpeg-1080-70','double-jpeg','webp-1080','rotate90','gray'] if f['name']=='advanced' else ['original','jpeg-1080-70']
   if theme=='':cases+=['rotate180','blur','jpeg-1080-50','jpeg-720-85','cropped','damaged']
   for case in cases:
    data,fmt=variant(im,case);dataurl='data:image/'+fmt+';base64,'+base64.b64encode(data).decode();t=time.monotonic()
    result=page.evaluate('async url=>{try{return {ok:true,result:await saveImageQA.read(url)}}catch(e){return {ok:false,error:e.message}}}',dataurl)
    exact=result['ok'] and result['result']['code']==f['code'] and {k:v for k,v in result['result'].items() if k!='code'}==f['expected']
    if result['ok']:assert exact,(f['name'],theme,case,'PARTIAL OR INCORRECT RESTORE')
    rows.append({'fixture':f['name'],'theme':theme or 'default','case':case,'completeSaveExact':bool(exact),'error':result.get('error',''),'ms':round((time.monotonic()-t)*1000)})
    print(args.engine,f['name'],theme or 'default',case,exact,flush=True)
   suffix='-focused' if args.themes or args.fixture or args.quick else ''
   (OUT/f'{args.engine}{suffix}-matrix.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
 browser.close()
required=[r for r in rows if r['case'] in ['original','jpeg-1440-70','jpeg-1080-85','jpeg-1080-70','double-jpeg','webp-1080','rotate90','rotate180','gray','blur']]
failures=[r for r in required if not r['completeSaveExact']]
print('REQUIRED FAILURES',json.dumps(failures,ensure_ascii=False))
if failures:raise SystemExit(1)
