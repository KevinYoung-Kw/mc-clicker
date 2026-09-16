"""Expanded image roundtrip with real PNG, JPEG, resizing and rotated cards."""
import argparse,base64,io,json,time
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--private-code');parser.add_argument('--engine',default='chromium');args=parser.parse_args()
R=Path(__file__).resolve().parents[1];out=R/'docs/v1.8/qa/large-save-images';out.mkdir(parents=True,exist_ok=True)
rows=[]
with sync_playwright() as p:
 browser=getattr(p,args.engine).launch(headless=True);page=browser.new_page();page.goto('http://127.0.0.1:8932/scripts/save-image-large-qa.html',wait_until='networkidle');page.wait_for_function('window.qa')
 cases=[{'length':18000},{'length':50000,'theme':'web-theme-end'},{'length':70000,'theme':'web-theme-oak'}]
 if args.private_code:cases=[{'code':Path(args.private_code).read_text().strip()}]
 for case in cases:
  result=page.evaluate('x=>qa.generate(x)',case);original=base64.b64decode(result.pop('url').split(',')[1]);im=Image.open(io.BytesIO(original)).convert('RGB')
  if not args.private_code:(out/f"{result['size']}-{args.engine}.png").write_bytes(original)
  for kind in ['png','jpeg85','jpeg70','resize75-jpeg85','rotate90','cropped']:
   pic=im.copy();fmt='PNG';quality=85
   if kind.startswith('jpeg'):fmt='JPEG';quality=int(kind[4:])
   if kind=='resize75-jpeg85':pic=pic.resize((round(pic.width*.75),round(pic.height*.75)),Image.Resampling.LANCZOS);fmt='JPEG'
   if kind=='rotate90':pic=pic.transpose(Image.Transpose.ROTATE_90)
   if kind=='cropped':pic=pic.crop((0,0,pic.width,pic.height-200))
   buf=io.BytesIO();pic.save(buf,format=fmt,quality=quality);start=time.monotonic();actual=page.evaluate('s=>qa.read(s)','data:image/'+fmt.lower()+';base64,'+base64.b64encode(buf.getvalue()).decode())
   row={**result,'kind':kind,'originalBytes':len(original),'width':im.width,'height':im.height,'readSeconds':round(time.monotonic()-start,2),**actual};rows.append(row);print(json.dumps(row),flush=True)
  (out/f"{args.engine}{'-private-summary' if args.private_code else ''}.json").write_text(json.dumps(rows,ensure_ascii=False,indent=2))
 browser.close()
assert all(r['ok']==(r['kind']!='cropped') for r in rows),rows
