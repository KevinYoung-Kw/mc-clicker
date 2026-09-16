"""Image-first Settings flow: real PNG download, cross-browser load, cancel, backup."""
import argparse,base64,io,json,subprocess
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--url',default='http://127.0.0.1:8934/');p.add_argument('--out',default='docs/v1.7/qa/save-images/ui');p.add_argument('--xhs', action='store_true');p.add_argument('--v2',action='store_true');p.add_argument('--farm-sites',action='store_true');p.add_argument('--achievements',action='store_true');args=p.parse_args()
OUT=ROOT/args.out;OUT.mkdir(parents=True,exist_ok=True)
seeds=json.loads(subprocess.check_output(['node','--input-type=module','-e','''
import {fresh,buy} from './src/game.js';import {chooseOpening} from './src/opening-guide.js';import {buyGuidance} from './src/guidance.js';
const start=fresh(42),played=fresh(123);chooseOpening(played,'returning');played.money=1e6;
for(const id of ['info','counter','nameplate','goals'])buyGuidance(played,id);
for(const id of ['T1','V1','V18','V2','V3','L1'])buy(played,id);
played.money=123456;played.play=1260;played.reducedMotion=true;played.sound=false;played.audio.narratorVoice=false;played.guidance.notices=false;
console.log(JSON.stringify({start,played}));
'''],cwd=ROOT,text=True))
if args.v2:
 seeds['played']=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {residentFixture} from './scripts/resident-fixture.mjs';import {prepareResearchFor} from './scripts/research-fixture.mjs';import {buy,advance,sites,frontier} from './src/game.js';import {buildCivic,civicSites} from './src/civic-sites.js';import {startResearch,pauseResearch} from './src/research.js';import {setWelfare} from './src/villager-life.js';const s=residentFixture();prepareResearchFor(s,'V22');buy(s,'V22');while(!sites(s,'overworld',null,'V25').length)buy(s,'V1',frontier(s)[0]);buy(s,'V25');while(!civicSites(s,'V25',1).length)buy(s,'V1',frontier(s)[0]);buildCivic(s,'V25',civicSites(s,'V25',1)[0]);startResearch(s,'cargo-tools');advance(s,4);pauseResearch(s);setWelfare(s,'simple');s.narrative.openingChoice='returning';s.narrative.companionsShown=true;s.guidance.notices=false;s.reducedMotion=true;s.sound=false;console.log(JSON.stringify(s))"],cwd=ROOT,text=True))
owned=lambda s:{k:v for k,v in s['counts'].items() if v}
if args.v2:
 seeds['played']=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {restore,buy,sites,frontier,advance} from './src/game.js';import {setLifeMenu} from './src/life-menu.js';let input='';for await(const c of process.stdin)input+=c;const s=restore(JSON.parse(input),0);for(const id of ['V25','V22','V23']){while(!sites(s,'overworld',null,id).length&&!s.counts[id])buy(s,'V1',frontier(s)[0]);while((s.counts[id]||0)<2){const r=buy(s,id);if(!r.ok)throw Error(r.reason);}}for(const [k,v] of [['meal','mushroom'],['drink','ale'],['activity','dance']]){const r=setLifeMenu(s,k,v);if(!r.ok)throw Error(r.reason);}advance(s,2);s.guidance.notices=false;console.log(JSON.stringify(s))"],input=json.dumps(seeds['played']),cwd=ROOT,text=True))
if args.farm_sites:
 seeds['played']=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {restore,buy,frontier} from './src/game.js';import {buildCivic,civicSites} from './src/civic-sites.js';let text='';for await(const c of process.stdin)text+=c;const s=restore(JSON.parse(text),0);while(s.counts.V4<3)buy(s,'V4');while(!civicSites(s,'V4').length)buy(s,'V1',frontier(s)[0]);const result=buildCivic(s,'V4',civicSites(s,'V4')[0]);if(!result.ok)throw Error(result.reason);s.life.sites.find(p=>p.id===result.id).production.harvest.farm=1;console.log(JSON.stringify(s))"],input=json.dumps(seeds['played']),cwd=ROOT,text=True))
rows=[];shared=None
if args.achievements:
 seeds['played']['achievements']=list(dict.fromkeys(seeds['played'].get('achievements',[])+['small-homes','three-world-garden']))
with sync_playwright() as p:
 for engine,width,height,theme in [('chromium',1440,900,''),('webkit',390,844,''),('chromium',320,568,''),('chromium',1440,900,'web-theme-end')]:
  browser=getattr(p,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}));errors=[]
  def context(seed):
   ctx=browser.new_context(viewport={'width':width,'height':height},is_mobile=width<760,has_touch=width<760,timezone_id='Asia/Shanghai',accept_downloads=True)
   ctx.add_init_script('if(!localStorage.getItem("mc-clicker-world-v2"))localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(seed))+')')
   if args.xhs:ctx.add_init_script('window.albumQA={};window.xhs={miniTool:{writeTempFile:async ({data})=>{albumQA.data=data;return {filePath:"qa.png"}},saveImageToPhotosAlbum:async ({filePath})=>{albumQA.path=filePath}}}')
   pg=ctx.new_page();pg.on('pageerror',lambda e:errors.append(str(e)));pg.goto(args.url,wait_until='networkidle')
   if args.xhs:pg.locator('#xhs-start button').click()
   return ctx,pg
  def open_save(wait_image=True):
   if args.xhs or width<760:page.locator('#hud-more').click()
   page.locator('#settings').click();page.locator('#save-settings').click();page.wait_for_selector('.save-panel')
   if wait_image:
    page.wait_for_selector('#save-picture img',timeout=45000)
    assert page.locator('#save-image-hint').inner_text()==('已校验 · 可以保存到相册' if args.xhs else '已校验 · 长按图片保存')
  def current():return page.evaluate('JSON.parse(localStorage.getItem("mc-clicker-world-v2"))')
  def upload(data,name='MC-Clicker-save.png',mime='image/png'):
   with page.expect_file_chooser() as chooser:page.locator('#choose-save-image').click()
   chooser.value.set_files({'name':name,'mimeType':mime,'buffer':data})
  value=json.loads(json.dumps(seeds['played']))
  if theme:value['webAppearance']['owned'][theme]=True;value['webAppearance']['equipped']['theme']=theme
  ctx,page=context(value);open_save();assert not page.locator('#save-code-details').evaluate('e=>e.open')
  src=page.locator('#save-picture img').get_attribute('src');assert src.startswith('data:image/png;base64,')
  png=base64.b64decode(src.split(',')[1]);assert Image.open(io.BytesIO(png)).size==(1728,2048)
  assert page.locator('#save-picture img').evaluate('e=>getComputedStyle(e).webkitTouchCallout') in ['default',None,'']
  if args.xhs:
   page.locator('#save-image-download').click();page.wait_for_function('window.albumQA.path==="qa.png"');assert page.evaluate('window.albumQA.data')==src
  else:
   with page.expect_download() as event:page.locator('#save-image-download').click()
   download=event.value;assert download.suggested_filename.endswith('.png');assert Path(download.path()).read_bytes()==png
  shared=shared or png
  label=f'{engine}-{width}'+('-dark' if theme else '')
  page.screenshot(path=str(OUT/f'save-{label}.png'))
  assert page.locator('#modal').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
  # Closing an in-flight export may not reopen or append to another dialog.
  page.locator('#refresh-save').click();page.locator('#modal-close').click();page.wait_for_timeout(400);assert page.locator('#save-picture img').count()==0
  ctx.close();ctx,page=context(seeds['start']);page.get_by_role('button',name='之前玩过',exact=True).click();open_save(False);page.locator('#load-tab').click()
  assert not page.locator('#load-code-backup').evaluate('e=>e.open');before=owned(current());assert before=={}
  upload(shared);page.wait_for_selector('#load-preview:not([hidden])',timeout=30000);assert owned(current())==before
  page.screenshot(path=str(OUT/f'load-{label}.png'));page.locator('#cancel-import').click();assert owned(current())==before
  upload(shared);page.wait_for_selector('#load-preview:not([hidden])')
  # A later bad file must invalidate the earlier valid candidate.
  upload(shared[:20]);page.wait_for_function('document.querySelector("#save-feedback").classList.contains("is-error")');assert not page.locator('#load-preview').is_visible();assert owned(current())==before
  # A compressed desktop export can be read and committed in another browser.
  im=Image.open(io.BytesIO(shared)).convert('RGB').resize((1080,1280),Image.Resampling.LANCZOS);buf=io.BytesIO();im.save(buf,format='JPEG',quality=70)
  upload(buf.getvalue(),'compressed.jpg','image/jpeg');page.wait_for_selector('#load-preview:not([hidden])',timeout=30000)
  page.locator('#confirm-import').click();page.wait_for_function('!document.querySelector("#modal").open');assert owned(current())==owned(value)
  if args.achievements:assert set(value['achievements']).issubset(current()['achievements'])
  if args.v2:
   assert current()['research']['projects']==value['research']['projects'];assert current()['research']['completed']==value['research']['completed'];assert current()['life']['welfare']==value['life']['welfare'];assert current()['life']['sites']==value['life']['sites']
   assert current()['life']['menuState']['selected']==value['life']['menuState']['selected'];assert current()['life']['serviceMode']==value['life']['serviceMode'];assert current()['grid']['powerCompensation']==value['grid']['powerCompensation'];assert current()['trainingBalance']==value['trainingBalance']
  page.reload(wait_until='networkidle')
  if args.xhs:page.locator('#xhs-start button').click()
  assert owned(current())==owned(value)
  if args.achievements:assert set(value['achievements']).issubset(current()['achievements'])
  open_save(False);page.locator('#restore-save-backup').click();page.wait_for_selector('#load-preview:not([hidden])');page.locator('#confirm-import').click();assert owned(current())==before
  assert not errors,errors
  rows.append({'engine':engine,'width':width,'theme':theme or 'default','earnedAchievementsPreserved':args.achievements,'imageFirst':True,'pngDownloadExact':not args.xhs,'albumBridgeExact':args.xhs,'nativeImage':True,'crossBrowserJPEG70Load':True,'previewBeforeCommit':True,'cancelPreservesWorld':True,'badFileInvalidatesCandidate':True,'backupRestore':True,'reload':True,'closeCancelsExport':True,'noOverflow':True,'errors':errors})
  (OUT/'report.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n');print(rows[-1],flush=True);ctx.close();browser.close()
