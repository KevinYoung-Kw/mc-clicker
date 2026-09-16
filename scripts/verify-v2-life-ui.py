"""Isolated real-UI research/life flows; never uses a player's local save."""
import argparse,json,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
a=argparse.ArgumentParser();a.add_argument('--url',default='http://127.0.0.1:8944/');a.add_argument('--xhs',action='store_true');a.add_argument('--out',default='docs/v2.0.0/qa/ui');args=a.parse_args()
out=ROOT/args.out;out.mkdir(parents=True,exist_ok=True)
seed=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {residentFixture} from './scripts/resident-fixture.mjs';import {freshResearch} from './src/research.js';const s=residentFixture();s.research=freshResearch();s.research.milestones.villageSale=true;s.guidance.notices=false;s.narrative.companionsShown=true;s.narrative.openingChoice='new';s.reducedMotion=true;console.log(JSON.stringify(s))"],cwd=ROOT,text=True))
rows=[]
with sync_playwright() as pw:
 for engine,width,height,theme in [('chromium',1440,900,''),('chromium',320,568,''),('webkit',390,844,''),('chromium',390,844,'web-theme-end')]:
  b=getattr(pw,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}))
  ctx=b.new_context(viewport={'width':width,'height':height},is_mobile=width<760,has_touch=width<760)
  s=json.loads(json.dumps(seed))
  if theme:s['webAppearance']['owned'][theme]=True;s['webAppearance']['equipped']['theme']=theme
  ctx.add_init_script('if(!localStorage.getItem("mc-clicker-world-v2"))localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(s))+')')
  p=ctx.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.goto(args.url,wait_until='networkidle')
  if args.xhs:p.locator('#xhs-start button').click()
  p.locator('[data-nav="village"]').click();p.locator('[data-life-open]').click()
  assert p.locator('[data-life-welfare]').count()==1
  assert p.locator('[data-life-welfare]').evaluate('e=>!!e.closest(".game-select")')
  p.screenshot(path=str(out/f'life-{engine}-{width}{"-dark" if theme else ""}.png'))
  p.locator('[data-detail="V11"]').click()
  p.screenshot(path=str(out/f'research-route-{engine}-{width}{"-dark" if theme else ""}.png'))
  p.locator('[data-research-action="industrial"]').click();p.locator('#research-confirm').click()
  assert p.locator('[data-research-action="industrial"]').is_disabled()
  p.locator('[data-research-action="cargo-tools"]').click();p.locator('#research-confirm').click()
  row=p.locator('[data-research-row="cargo-tools"]');p.wait_for_timeout(250)
  row.locator('[data-research-action]').click()
  before=p.evaluate('JSON.parse(localStorage.getItem("mc-clicker-world-v2")).research.projects["cargo-tools"].progress')
  assert 0<before<20
  # Ordinary frame updates preserve nodes, focus and scroll. Pause is a real research pause.
  row.evaluate('e=>{window.qaResearchNode=e;e.querySelector("button").focus();window.qaFocus=document.activeElement;window.qaTop=document.querySelector("#panel-content").scrollTop}')
  box=row.locator('[data-research-action]').bounding_box();p.wait_for_timeout(1200)
  assert p.evaluate('window.qaResearchNode===document.querySelector("[data-research-row=cargo-tools]")&&window.qaFocus===document.activeElement')
  afterbox=row.locator('[data-research-action]').bounding_box();assert abs(box['y']-afterbox['y'])<=1
  p.locator('[data-research-action="community-life"]').click();p.locator('#research-confirm').click();p.wait_for_timeout(250);p.locator('[data-research-action="community-life"]').click()
  old=p.evaluate('JSON.parse(localStorage.getItem("mc-clicker-world-v2")).research')
  p.locator('[data-research-action="cargo-tools"]').click();p.wait_for_timeout(250);p.locator('[data-research-action="cargo-tools"]').click()
  saved=p.evaluate('JSON.parse(localStorage.getItem("mc-clicker-world-v2")).research')
  assert saved['projects']['cargo-tools']['progress']>=before
  assert saved['projects']['community-life']['progress']==old['projects']['community-life']['progress']
  assert saved['active'] is None
  assert not p.locator('#modal').evaluate('e=>e.open')
  assert p.locator('#panel-content').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
  row.scroll_into_view_if_needed();p.screenshot(path=str(out/f'research-{engine}-{width}{"-dark" if theme else ""}.png'))
  p.reload(wait_until='networkidle')
  if args.xhs:p.locator('#xhs-start button').click()
  loaded=p.evaluate('JSON.parse(localStorage.getItem("mc-clicker-world-v2")).research')
  assert loaded['completed']==saved['completed'];assert loaded['projects']==saved['projects']
  assert not errors,errors
  rows.append({'engine':engine,'width':width,'theme':theme or 'default','instantMainline':True,'paidPauseSwitchResume':True,'customSelect':True,'stableNodesFocusPosition':True,'reloadPreservesProjects':True,'noOverflow':True,'errors':errors})
  (out/'report.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n');print(rows[-1],flush=True);b.close()
