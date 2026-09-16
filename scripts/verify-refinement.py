import sys,json
from pathlib import Path
from playwright.sync_api import sync_playwright
out=Path('docs/qa');errors=[]
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,args=['--use-angle=metal'] if sys.platform=='darwin' else []);page=b.new_page(viewport={'width':1440,'height':960});page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8890');page.wait_for_load_state('networkidle');assert not errors,errors
 assert page.locator('.brand').count()==0
 for i in range(10):page.locator('#mine').click()
 page.locator('[data-nav=build]').click();page.locator('[data-buy=T1]').click();page.locator('[data-nav=world]').click();page.wait_for_timeout(700);page.screenshot(path=str(out/'50-pick-ground.png'))
 contact=page.evaluate('''async()=>{const T=await import('/node_modules/three/build/three.module.js');const {PICK_TIP,PICK_CONTACT}=await import("/src/pickaxe.js");const w=mcDebug.world;w.queuedHit=false;w.hitAt=w.time-PICK_CONTACT;w.last=performance.now();w.update(true);w.graph.updateMatrixWorld(true);const tip=w.pickTool.localToWorld(PICK_TIP.clone()),top=w.hero.localToWorld(new T.Vector3(0,1.26,.3));return{error:Math.abs(tip.y-top.y),tip:tip.toArray(),top:top.toArray()};}''')
 assert contact['error']<.001,contact
 page.evaluate('mcDebug.state.money=15023');page.wait_for_timeout(900);assert page.locator('#money').text_content()=='15,023'
 page.evaluate("async()=>{const {completeFixture}=await import('/scripts/fixtures.mjs');const s=completeFixture();s.money=15023;mcDebug.setState(s);}")
 page.locator('[data-nav=world]').click();page.wait_for_timeout(700);page.screenshot(path=str(out/'51-voxel-village.png'))
 floors=page.evaluate('''async()=>{const T=await import('/node_modules/three/build/three.module.js');return Object.fromEntries(Object.entries(mcDebug.world.roots).filter(([id])=>!['Z2'].includes(id)).map(([id,o])=>[id,new T.Box3().setFromObject(o).min.y]));}''')
 assert all(abs(y-.16)<.03 for y in floors.values()),floors
 performance=page.evaluate('''async()=>{const w=mcDebug.world;let rebuilds=0,resizes=0;const build=w.buildInstances,resize=w.renderer.setSize;w.buildInstances=function(...a){rebuilds++;return build.apply(this,a)};w.renderer.setSize=function(...a){resizes++;return resize.apply(this,a)};const durations=[];for(let i=0;i<6;i++)for(const tab of ['build','world']){const start=window.performance.now();document.querySelector('[data-nav='+tab+']').click();durations.push(window.performance.now()-start);await new Promise(r=>setTimeout(r,450));}const frames=[];let last;await new Promise(resolve=>{function tick(t){if(last)frames.push(t-last);last=t;if(frames.length<60)requestAnimationFrame(tick);else resolve()}requestAnimationFrame(tick)});durations.sort((a,b)=>a-b);frames.sort((a,b)=>a-b);w.buildInstances=build;w.renderer.setSize=resize;const gl=w.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return{switches:12,rebuilds,resizes,clickP95:durations[11],frameMedian:frames[30],frameP95:frames[57],renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,trianglesWithShadows:w.renderer.info.render.triangles};}''')
 assert performance['rebuilds']==0 and performance['resizes']<=12,performance
 point=page.evaluate('''()=>{const w=mcDebug.world,r=w.renderer.domElement.getBoundingClientRect(),meshes=[];w.roots.L2.traverse(o=>{if(o.isMesh)meshes.push(o)});for(const m of meshes){const p=m.getWorldPosition(w.pointer3??=w.camera.position.clone()).clone().project(w.camera),x=r.x+(p.x+1)*r.width/2,y=r.y+(1-p.y)*r.height/2;if(w.pick({clientX:x,clientY:y})?.userData.item==='L2')return{x,y};}throw Error('No visible studio surface');}''')
 page.mouse.click(point['x'],point['y']);page.wait_for_selector('.entering-studio');page.wait_for_selector('.live-page');page.wait_for_timeout(700);assert page.evaluate('mcDebug.world.renderedView')=='studio';page.screenshot(path=str(out/'52-control-room.png'))
 page.locator('[data-studio-tab=chat]').click();assert page.locator('#chat').is_visible()
 page.locator('[data-studio-tab=program]').click();page.locator('#studio-next').click();page.locator('#studio-back').click();page.wait_for_timeout(600)
 page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(500);page.screenshot(path=str(out/'53-compact-world-phone.png'))
 page.locator('[data-nav=live]').click();page.wait_for_selector('.live-page');page.wait_for_timeout(700);page.screenshot(path=str(out/'54-control-room-phone.png'))
 for width,height in [(360,800),(768,1024),(1024,768),(844,390)]:
  page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(500)
  assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
  for id in ['studio-header','studio-console','panel','stage']:
   box=page.locator('#'+id).bounding_box();assert box['width']>150 and box['height']>35 and box['x']>=0 and box['x']+box['width']<=width+1 and box['y']+box['height']<=height+1,(width,height,id,box)
  assert page.locator('#studio-console').evaluate('e=>e.scrollWidth<=e.clientWidth+1'),(width,height,'console overflow')
 page.screenshot(path=str(out/'55-studio-landscape.png'))
 page.locator('#studio-back').click();page.evaluate('mcDebug.state.reducedMotion=true');page.locator('[data-nav=live]').click();page.wait_for_selector('.live-page');assert not page.locator('.entering-studio').count();page.keyboard.press('Escape');assert page.locator('.live-page').count()==0
 assert not errors,errors
 result={'errors':errors,'studio':True,'actualBuildingClick':True,'groundHeights':floors,'miningContact':contact,'transitionPerformance':performance};(out/'refinement-observations.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result));b.close()
