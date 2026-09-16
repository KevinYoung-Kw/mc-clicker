"""Actual owned inventory UI, isolated fixtures; no balance claims."""
import argparse,json,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--url',required=True);p.add_argument('--xhs',action='store_true');p.add_argument('--out',required=True);a=p.parse_args()
root=Path(__file__).resolve().parents[1];out=Path(a.out).resolve();out.mkdir(parents=True,exist_ok=True)
data=json.loads(subprocess.check_output(['node','--input-type=module','-e', '''
import {residentFixture} from './scripts/resident-fixture.mjs';
import {restore} from './src/game.js';import {shoppingUpgrades} from './src/shopping-options.js';
const s=residentFixture();s.money=1e9;s.guidance.notices=false;s.guidance.goals=true;s.narrative.companionsShown=true;s.narrative.openingChoice='new';s.reducedMotion=true;s.sound=false;
Object.assign(s.counts,{M9:3,T5:1,V12:2,V13:1,M11:1});s.upgrades.levels['drill-steel']=1;s.upgrades.revision++;
const loaded=restore(s,0);console.log(JSON.stringify({save:loaded,offers:shoppingUpgrades(loaded,'all',{all:true}).map(r=>r.mod||r.id)}));
'''],cwd=root,text=True))
rows=[]
with sync_playwright() as pw:
 for engine,w,h in [('chromium',1440,900),('chromium',320,740),('webkit',390,844)]:
  browser=getattr(pw,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}))
  ctx=browser.new_context(viewport={'width':w,'height':h},is_mobile=w<760,has_touch=w<760)
  ctx.add_init_script('if(!sessionStorage.getItem("owned-qa-seed")){localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(data['save']))+');sessionStorage.setItem("owned-qa-seed","1")}')
  page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(a.url,wait_until='networkidle')
  if a.xhs:page.locator('#xhs-start button').click()
  page.locator('[data-nav="build"]').click();assert page.locator('[data-shopping-upgrade]').count()==0
  page.locator('[data-open="owned"]').click();page.wait_for_selector('[data-shopping-upgrade]')
  actual=page.locator('[data-shopping-upgrade]').evaluate_all('(es)=>es.map(e=>e.querySelector("[data-shop-mod]")?.dataset.shopMod||e.dataset.shoppingUpgrade)')
  assert sorted(actual)==sorted(data['offers']),(actual,data['offers'])
  assert page.locator('[data-shopping-upgrade="V12"]').count()==1
  assert page.locator('[data-shopping-upgrade="M9"]').count()>1
  assert page.locator('#panel-content').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
  page.screenshot(path=str(out/f'{engine}-{w}-owned.png'))
  page.locator('[data-shop-mod="drill-cooling"]').first.click()
  card=page.locator('[data-mod-card="drill-cooling"]');assert card.get_attribute('data-expanded')=='true'
  card.locator('[data-mod-buy]').click();page.locator('#placement-confirm').click()
  page.locator('[data-nav="build"]').click();page.locator('[data-open="owned"]').click()
  assert page.locator('[data-shop-mod="drill-cooling"]').count()==0
  assert page.locator('[data-shop-mod="drill-buffer"]').count()>0
  page.reload(wait_until='networkidle')
  if a.xhs:page.locator('#xhs-start button').click()
  page.locator('[data-nav="build"]').click();page.locator('[data-open="owned"]').click()
  assert page.locator('[data-shop-mod="drill-cooling"]').count()==0
  assert page.locator('[data-shop-mod="drill-buffer"]').count()>0
  assert not errors,errors
  rows.append({'engine':engine,'width':w,'offers':len(actual),'allVisible':True,'purchaseAndReload':True,'noOverflow':True,'errors':errors});print(rows[-1],flush=True)
  (out/'report.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n');browser.close()
