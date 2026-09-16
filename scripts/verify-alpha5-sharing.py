"""Production share UI and controlled (never real) miniTool note bridge."""
import argparse,json,base64
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1];a=argparse.ArgumentParser();a.add_argument('--url',default='http://127.0.0.1:8971/');a.add_argument('--xhs',action='store_true');a.add_argument('--out',default='docs/v2.0.0/qa/alpha5-sharing');args=a.parse_args();out=root/args.out;out.mkdir(parents=True,exist_ok=True)
seed=json.loads((root/'docs/v2.0.0/qa/alpha5/fixture.json').read_text());results=[]
stories=['receipt','world','passport','profile','moment']
styles=['','web-card-worklog','web-card-oak','web-card-redstone','web-card-end']
with sync_playwright() as pw:
 for engine,w in [('chromium',1440),('chromium',320),('webkit',390)]:
  b=getattr(pw,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}));c=b.new_context(viewport={'width':w,'height':900 if w>760 else 844},is_mobile=w<760,has_touch=w<760,accept_downloads=True);p=c.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
  c.add_init_script('if(!sessionStorage.getItem("qa5")){localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(seed))+');sessionStorage.setItem("qa5","1")}')
  c.add_init_script('''window.noteCalls=[];window.noteMode='ok';window.gpuReads=0;for(const C of [window.WebGLRenderingContext,window.WebGL2RenderingContext])if(C){const fn=C.prototype.readPixels;C.prototype.readPixels=function(...args){gpuReads++;return fn.apply(this,args);};}window.xhs={miniTool:{writeTempFile:async o=>{noteCalls.push({api:'temp',dataPrefix:o.data.slice(0,30)});return {filePath:'/tmp/qa-card.png'};},saveImageToPhotosAlbum:async o=>{noteCalls.push({api:'album',...o});},postNote:async o=>{noteCalls.push({api:'post',...o});if(noteMode==='cancel')throw {errMsg:'postNote:fail cancel'};if(noteMode==='fail')throw {errMsg:'postNote:fail denied'};return {errMsg:'postNote:ok'};}}};''')
  def click(q):p.locator(q).first.click()
  def ready():p.wait_for_function('document.querySelector("#share-card-preview")?.getAttribute("aria-busy")==="false" && !!document.querySelector(".share-card-image")',timeout=60000)
  try:
   p.goto(args.url,wait_until='networkidle')
   if args.xhs:click('#xhs-start button')
   if not p.locator('#share-open').is_visible():click('#hud-more')
   click('#share-open');ready();assert p.locator('[data-card-style]').count()==5
   assert p.evaluate('gpuReads')==0,'data cards must not start a 3D screenshot capture'
   urls=[]
   for kind in stories:
    click('[data-share-story="'+kind+'"]');ready()
    url=p.locator('.share-card-image').get_attribute('src');urls.append(url)
    if w==1440:(out/('story-'+kind+'.png')).write_bytes(base64.b64decode(url.split(',')[1]))
   assert len(set(urls))==5
   click('[data-share-story="world"]');ready();reads=p.evaluate('gpuReads');urls=[]
   click('.share-appearance summary')
   for i,style in enumerate(styles):
    if i:click('[data-card-style="'+style+'"]');ready()
    img=p.locator('.share-card-image');url=img.get_attribute('src');urls.append(url)
    assert img.evaluate('e=>e.naturalWidth===1440&&e.naturalHeight===1920')
    assert p.locator('#share-panel').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
    if w==1440:(out/(str(i)+'-'+('default' if not style else style)+'.png')).write_bytes(base64.b64decode(url.split(',')[1]))
   assert len(set(urls))==5;assert p.evaluate('gpuReads')==reads,'style switch should not re-render the 3D world'
   click('.share-appearance summary');click('[data-share-story="receipt"]');ready()
   p.locator('#share-panel').screenshot(path=str(out/f'panel-{engine}-{w}.png'))
   if args.xhs:
    click('#download-card');p.wait_for_function('noteCalls.some(x=>x.api==="album")')
    click('[data-note-intent="wish"]');click('#post-note');assert p.locator('#note-wish').evaluate('e=>e===document.activeElement');assert not p.evaluate('noteCalls.some(x=>x.api==="post")')
    p.locator('#note-wish').fill('想在村里开面包店');click('#post-note');p.wait_for_function('noteCalls.some(x=>x.api==="post")')
    payload=p.evaluate('noteCalls.find(x=>x.api==="post")');assert payload['tags']=='狂点草方块';assert '面包店' in payload['content'];assert payload['mediaInfo']['image_resources']==[{'url':'/tmp/qa-card.png'}]
    p.evaluate("noteMode='cancel'");click('#post-note');p.wait_for_function('document.querySelector("#image-share-note").textContent.includes("取消")');assert p.locator('#post-note').is_enabled()
    p.evaluate("noteMode='fail'");click('#post-note');p.wait_for_function('document.querySelector("#image-share-note").textContent.includes("没有打开")');assert p.locator('.share-card-image').count()==1
   else:
    with p.expect_download() as d:click('#download-card')
    d.value.save_as(out/f'download-{engine}-{w}.png');assert (out/f'download-{engine}-{w}.png').stat().st_size>10000
    click('.share-invitation summary');assert p.locator('#share-url').input_value()=='https://www.kw-aigc.cn/projects/mc-clicker-2/'
   click('#generate-card');click('#share-close');assert not p.locator('#modal').evaluate('e=>e.open');p.wait_for_timeout(700)
   if not p.locator('#share-open').is_visible():click('#hud-more')
   click('#share-open');ready();assert p.locator('[data-card-style="web-card-end"]').get_attribute('aria-pressed')=='true';assert not errors,errors
   results.append({'engine':engine,'width':w,'fiveDistinctContentCards':True,'fivePurchasedSkins':True,'sameCaptureForStyles':True,'noOverflow':True,'savedPNG':True,'noteBridgeMock':args.xhs,'closeReopen':True,'errors':errors});(out/'report.json').write_text(json.dumps(results,ensure_ascii=False,indent=2));print(results[-1],flush=True)
  except Exception:
   p.screenshot(path=str(out/f'failure-{engine}-{w}.png'));(out/'failure.txt').write_text(p.locator('body').inner_text());print(errors,flush=True);raise
  finally:b.close()
