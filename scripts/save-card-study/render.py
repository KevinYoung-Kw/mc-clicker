"""Render the real world and the study card, without opening or modifying a player save."""
import base64,json
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2]
out=root/'docs/v1.7/qa/save-card-design'
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--use-angle=metal'])
    page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://127.0.0.1:8932/scripts/save-card-study/capture.html',wait_until='networkidle')
    page.wait_for_function('typeof captureSaveWorld==="function"')
    for name in ['village','advanced']:
        snapshot=json.loads(Path(f'/tmp/mcc-save-card-design/{name}.json').read_text())
        shot=page.evaluate('(s)=>captureSaveWorld(s)',snapshot)
        (out/f'{name}-world.png').write_bytes(base64.b64decode(shot['url'].split(',')[1]))
        data=json.loads((out/f'{name}.data.json').read_text())
        image=page.evaluate('''async({data,shot})=>{
          const {paintSaveCard}=await import('/scripts/save-card-study/painter.js');
          return (await paintSaveCard(data,shot)).toDataURL('image/png');
        }''',{'data':data,'shot':shot})
        (out/f'{name}.png').write_bytes(base64.b64decode(image.split(',')[1]))
        print(name,(out/f'{name}.png').stat().st_size,flush=True)
    assert not errors,errors
    browser.close()
