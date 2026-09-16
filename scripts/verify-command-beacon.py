"""Exercise real building clicks and the shared pixel selectors in isolated saves."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];out=ROOT/'docs/v1.8/qa/command-beacon';out.mkdir(parents=True,exist_ok=True)
seed=json.loads((ROOT/'docs/v1.6/qa/stability-baseline/fixtures/peak.json').read_text());seed.update(reducedMotion=True,dispatch='off',beaconRealm='overworld');seed['guidance']['notices']=False
reports=[]
with sync_playwright() as p:
 for engine,width in [('chromium',1440),('webkit',390),('chromium',320)]:
  b=getattr(p,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}));ctx=b.new_context(viewport={'width':width,'height':844},is_mobile=width<760,has_touch=width<760)
  ctx.add_init_script('if(!localStorage.getItem("mc-clicker-world-v2"))localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(seed))+')')
  page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def click(q):page.locator(q).first.click()
  def choose(label,value):
   page.get_by_role('combobox',name=label,exact=True).click();page.get_by_role('option',name=value,exact=False).click()
  def pic(name):page.screenshot(path=str(out/f'{name}-{engine}-{width}.png'))
  def building(id):
   click('[data-nav="atlas"]');click('[data-detail="'+id+'"]');click('#panel-close')
   # Locate a visible surface belonging to this building, then perform a real click.
   page.evaluate('(id)=>mcDebug.world.focus(id)',id);page.wait_for_timeout(500)
   pt=page.evaluate('''id=>{const w=mcDebug.world,c=w.renderer.domElement,b=c.getBoundingClientRect(),hits=[];for(let y=2;y<48;y++)for(let x=2;x<48;x++){const p={x:b.x+b.width*x/50,y:b.y+b.height*y/50};if(document.elementFromPoint(p.x,p.y)!==c)continue;if(w.pick({clientX:p.x,clientY:p.y})?.userData.item===id)hits.push(p);}return hits[Math.floor(hits.length/2)];}''',id);assert pt,id
   page.touchscreen.tap(pt['x'],pt['y']) if width<760 else page.mouse.click(pt['x'],pt['y'])
  try:
   page.goto('http://127.0.0.1:8932/',wait_until='networkidle');page.wait_for_function('window.mcDebug?.world')
   building('N10');assert page.get_by_role('combobox',name='信标强化世界',exact=True).is_visible()
   colors={}
   for realm,label in [('overworld','主世界'),('nether','下界'),('end','末地')]:
    choose('信标强化世界',label);page.wait_for_function('(r)=>mcDebug.world.roots.N10?.getObjectByName("beacon-light-column")?.userData.realm===r',arg=realm)
    colors[realm]=page.evaluate('mcDebug.world.roots.N10.getObjectByName("beacon-light-column").children[1].material.color.getHexString()');pic('beacon-'+realm)
   assert len(set(colors.values()))==3
   choose('信标模式','物流强化');building('Z1');choose('命令方块策略','跨世界自动调度');assert page.evaluate('mcDebug.state.dispatch')=='auto';pic('command-auto')
   building('N10');assert page.locator('[data-beacon-status]').inner_text().endswith('命令方块调度中');assert page.get_by_role('combobox',name='信标强化世界',exact=True).count()==0;pic('beacon-linked')
   click('[data-detail="Z1"]');choose('命令方块策略','不启用');building('N10');assert page.evaluate('mcDebug.state.beaconRealm')=='end';assert page.evaluate('mcDebug.state.beacon')=='logistics'
   page.reload(wait_until='networkidle');page.wait_for_function('window.mcDebug?.world');assert page.evaluate('mcDebug.state.beaconRealm')=='end';assert not errors,errors;assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   if engine=='chromium' and width<760:
    client=ctx.new_cdp_session(page)
    before=page.evaluate('JSON.stringify(mcDebug.world.captureCamera())')
    for kind,points in [('touchStart',[{'x':150,'y':220}]),('touchMove',[{'x':190,'y':240}]),('touchEnd',[])]:
     client.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':points});page.wait_for_timeout(80)
    assert page.evaluate('JSON.stringify(mcDebug.world.captureCamera())')!=before
    before=page.evaluate('mcDebug.world.zoom')
    for kind,points in [('touchStart',[{'x':110,'y':220},{'x':210,'y':220}]),('touchMove',[{'x':80,'y':220},{'x':240,'y':220}]),('touchEnd',[])]:
     client.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':points});page.wait_for_timeout(80)
    assert page.evaluate('mcDebug.world.zoom')!=before
   reports.append({'engine':engine,'width':width,'directBuildingControls':True,'touchPanPinch':True if engine=='chromium' and width<760 else 'not_run','realmColors':colors,'autoLinkAndManualRestore':True,'saveReload':True,'errors':errors})
  except Exception:pic('failure');print(errors);raise
  finally:b.close()
(out/'report.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2));print(reports)
