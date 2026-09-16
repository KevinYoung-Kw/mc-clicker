from pathlib import Path
import sys,json,hashlib
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--use-angle=metal'] if sys.platform=='darwin' else [])
 page=b.new_page();page.goto('http://127.0.0.1:8890/scripts/icon-studio.html');page.wait_for_function('window.iconIds')
 checks=page.evaluate('''async()=>{const result=[];for(const id of iconIds){const img=new Image();img.src='/icons/'+id+'.png';await img.decode();const c=document.createElement('canvas');c.width=c.height=192;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);const data=ctx.getImageData(0,0,192,192).data;let minX=192,maxX=0,minY=192,maxY=0,count=0;for(let y=0;y<192;y++)for(let x=0;x<192;x++)if(data[(y*192+x)*4+3]>8){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);count++;}result.push({id,centreOffset:Math.max(Math.abs((minX+maxX)/2-95.5),Math.abs((minY+maxY)/2-95.5)),minX,maxX,minY,maxY,count});}return result}''')
 assert len(checks)==96 and all(c['count']>400 for c in checks),checks
 worst=max(checks,key=lambda c:c['centreOffset']);assert worst['centreOffset']<=2.5,worst
 hashes={hashlib.sha256(f.read_bytes()).hexdigest() for f in Path('public/icons').glob('*.png')};assert len(hashes)==96
 Path('docs/qa/icon-centering.json').write_text(json.dumps({'count':96,'unique':96,'maxOffsetPx':worst['centreOffset'],'checks':checks},indent=2));print(json.dumps({'icons':96,'unique':96,'worst':worst}));b.close()
