"""Production UI checks in isolated browsers; no developer game hooks."""
import argparse,json,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--url',required=True);p.add_argument('--xhs',action='store_true');p.add_argument('--out',required=True);a=p.parse_args();out=Path(a.out).resolve();out.mkdir(parents=True,exist_ok=True)
seed=json.loads(subprocess.check_output(['node','--input-type=module','-e','''
import {residentFixture} from './scripts/resident-fixture.mjs';import {prepareResearchFor} from './scripts/research-fixture.mjs';import {prepareRecruitHousing} from './scripts/housing-fixture.mjs';import {buy,sites,frontier} from './src/game.js';import {freshResearch} from './src/research.js';
const s=residentFixture();for(const id of ['V21','V25','V22','V23']){prepareResearchFor(s,id);while(!sites(s,'overworld',null,id).length)buy(s,'V1',frontier(s)[0]);if(!s.counts[id]){const r=buy(s,id);if(!r.ok)throw Error(r.reason);}if(s.counts[id]<2)buy(s,id);}
prepareRecruitHousing(s,10);s.money=1e8;s.research=freshResearch();s.research.milestones={villageSale:true,industrialSale:true};s.guidance.notices=false;s.guidance.counter=true;s.narrative.companionsShown=true;s.narrative.openingChoice='returning';s.reducedMotion=true;s.sound=false;console.log(JSON.stringify(s));
'''],cwd=root,text=True))
rows=[]
with sync_playwright() as pw:
 for engine,w,h in [('chromium',1440,900),('chromium',320,740),('webkit',390,844)]:
  b=getattr(pw,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}));ctx=b.new_context(viewport={'width':w,'height':h},has_touch=w<760,is_mobile=w<760)
  ctx.add_init_script('if(!sessionStorage.getItem("alpha3-seed")){localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(seed))+');sessionStorage.setItem("alpha3-seed","1")}')
  page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def press(q):page.locator(q).first.click()
  def saved():return page.evaluate('JSON.parse(localStorage.getItem("mc-clicker-world-v2"))')
  def shot(name):page.screenshot(path=str(out/f'{name}-{engine}-{w}.png'))
  try:
   page.goto(a.url,wait_until='networkidle')
   if a.xhs:press('#xhs-start button')
   press('[data-nav="build"]');assert page.locator('.recruitment-entry').count()==0
   press('[data-open="owned"]');row=page.locator('.resident-shop-row');assert row.count()==1;assert row.locator('[data-buy="V2"]').count()==1
   assert page.locator('#panel-content').evaluate('e=>e.scrollWidth<=e.clientWidth+1');shot('owned')
   press('[data-nav="village"]');press('[data-life-open]');assert page.locator('[data-life-menu]').count()==9
   assert page.locator('[data-service-status="V23"]').inner_text().find('全村共享')>=0
   press('[data-life-option="mushroom"]');press('[data-life-option="ale"]');press('[data-life-option="dance"]')
   selected=saved()['life']['menuState']['selected'];assert selected=={'meal':'mushroom','drink':'ale','activity':'dance'},selected
   page.locator('.life-menu').first.scroll_into_view_if_needed();shot('choices')
   page.locator('[data-life-option="ale"]').evaluate('e=>{window.qaNode=e;e.focus();window.qaFocus=document.activeElement;}');page.wait_for_timeout(1100)
   assert page.evaluate('window.qaNode===document.querySelector("[data-life-option=ale]")&&window.qaFocus===document.activeElement')
   assert page.locator('#panel-content').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
   press('[data-detail="V11"]');shot('research-before');press('[data-research-action="industrial"]');press('#research-confirm')
   assert page.locator('[data-research-action="industrial"]').is_disabled();assert page.locator('[data-research-row="railway"]').count()==1
   press('[data-research-action="cargo-tools"]');press('#research-confirm');page.wait_for_timeout(300);press('[data-research-action="cargo-tools"]');before=saved()['research']['projects']['cargo-tools']['progress'];assert 0<before<20
   press('[data-research-action="community-life"]');press('#research-confirm');page.wait_for_timeout(300);press('[data-research-action="community-life"]')
   press('[data-research-action="cargo-tools"]');page.wait_for_timeout(300);press('[data-research-action="cargo-tools"]');assert saved()['research']['projects']['cargo-tools']['progress']>=before
   shot('research');saved_research=saved()['research'];page.reload(wait_until='networkidle')
   if a.xhs:press('#xhs-start button')
   assert saved()['life']['menuState']['selected']==selected;assert saved()['research']['projects']==saved_research['projects']
   assert not errors,errors
   rows.append({'engine':engine,'width':w,'nineChoices':True,'globalRecreation':True,'ownedResidentRow':True,'researchPaidSwitchReload':True,'stableFocus':True,'noOverflow':True,'errors':errors});print(rows[-1],flush=True)
   (out/'report.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
  except Exception:
   shot('failure');(out/'failure.txt').write_text(page.locator('body').inner_text());print(errors,flush=True);raise
  finally:b.close()
