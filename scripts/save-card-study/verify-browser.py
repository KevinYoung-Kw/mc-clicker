"""Round-trip the designed PNG through the real browser save decoder in both engines."""
import json,io
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2];out=root/'docs/v1.7/qa/save-card-design';report=[]
with sync_playwright() as p:
 for engine,width in [('chromium',1440),('chromium',320),('webkit',390)]:
  browser=getattr(p,engine).launch(headless=True)
  context=browser.new_context(viewport={'width':width,'height':900},is_mobile=width<800,has_touch=width<800)
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:8932/docs/v1.7/qa/save-card-design/',wait_until='networkidle')
  before=page.evaluate('JSON.stringify(localStorage)')
  for name in ['village','advanced']:
   page.locator(f'[data-sample={name}]').click()
   page.locator('#verify').click()
   page.wait_for_function('document.querySelector("#status").textContent.includes("读取成功")',timeout=60000)
   result=page.evaluate('window.__verifiedSaveCard')
   assert result['code']==Path(f'/tmp/mcc-save-card-design/{name}.code.txt').read_text()
   assert result['envelope']==json.loads(Path(f'/tmp/mcc-save-card-design/{name}.expected.json').read_text())
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   assert page.locator('#card').evaluate('e=>e.dispatchEvent(new MouseEvent("contextmenu",{bubbles:true,cancelable:true}))')
   with page.expect_download() as download:page.locator('#download').click()
   assert Path(download.value.path()).read_bytes()==(out/f'{name}.png').read_bytes()
   # Saving the same pixels into a new PNG drops metadata but must still be readable.
   image=Image.open(out/f'{name}.png').convert('RGB');buf=io.BytesIO();image.save(buf,format='PNG')
   reencoded=page.evaluate('''async b=>{
    const {readSaveCard}=await import('/scripts/save-card-study/reader.js');
    return (await readSaveCard(new Blob([new Uint8Array(b)],{type:'image/png'}))).code;
   }''',list(buf.getvalue()))
   assert reencoded==result['code']
   assert page.evaluate('JSON.stringify(localStorage)')==before
   report.append({'engine':engine,'width':width,'sample':name,'exactCode':True,'exactSave':True,'reencodedPNG':True,'downloadOriginalBytes':True,'overflow':False,'contextMenuNotCancelled':True,'gameSaveUnchanged':True})
  page.screenshot(path=str(out/f'{engine}-{width}.png'),full_page=True)
  # Corruption must produce a readable error, never a partial imported world.
  for label,img in [('jpeg',Image.open(out/'advanced.png')),('cropped',Image.open(out/'advanced.png').crop((0,0,720,1693)))]:
   buf=io.BytesIO();img.save(buf,format='JPEG' if label=='jpeg' else 'PNG',**({'quality':85} if label=='jpeg' else {}))
   result=page.evaluate('''async b=>{try{const {readSaveCard}=await import('/scripts/save-card-study/reader.js');await readSaveCard(new Blob([new Uint8Array(b)]));return 'unexpected success'}catch(e){return e.message}}''',list(buf.getvalue()))
   assert result!='unexpected success'
   report.append({'engine':engine,'width':width,'case':label,'rejected':True,'message':result})
  assert not errors,errors
  browser.close()
(out/'browser-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False),flush=True)
