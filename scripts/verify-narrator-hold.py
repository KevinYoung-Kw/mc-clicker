from pathlib import Path
from playwright.sync_api import sync_playwright
import json
out=Path(__file__).resolve().parents[1]/'docs/v1.5/qa/adaptive-narrator';out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--use-angle=metal']);ctx=browser.new_context(viewport={'width':1440,'height':900});page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8890/',wait_until='networkidle');page.wait_for_function('!!window.mcDebug')
 page.evaluate("mcDebug.state.guidance.info=true;mcDebug.state.money=20;mcDebug.state.narrative.seen=['rescued'];mcDebug.state.narrative.intro='rescued';mcDebug.advance(0)")
 page.wait_for_selector('#narrator:not([hidden])')
 point=page.evaluate('''async()=>{const T=await import('/node_modules/three/build/three.module.js');const w=mcDebug.world;const p=w.hero.getWorldPosition(new T.Vector3());p.y+=.25;p.project(w.camera);const r=w.renderer.domElement.getBoundingClientRect();return {x:r.x+(p.x+1)*r.width/2,y:r.y+(1-p.y)*r.height/2};}''')
 page.mouse.move(point['x'],point['y']);page.mouse.down()
 page.wait_for_function('mcDebug.world.start?.hit?.userData.action==="mine"')
 elapsed=page.evaluate('mcDebug.state.narrative.current.elapsed');clicks=page.evaluate('mcDebug.state.clicks')
 page.wait_for_timeout(1200)
 assert page.locator('#narrator').is_visible();assert page.evaluate('mcDebug.state.narrative.current.elapsed')>elapsed
 assert page.evaluate('mcDebug.state.clicks')>clicks
 page.mouse.move(point['x']+80,point['y']+20,steps=5)
 page.wait_for_function('mcDebug.world.start?.moved===true')
 page.wait_for_selector('#narrator',state='hidden');paused=page.evaluate('mcDebug.state.narrative.current.elapsed')
 page.wait_for_timeout(600);assert page.evaluate('mcDebug.state.narrative.current.elapsed')==paused
 page.mouse.up();page.wait_for_selector('#narrator:not([hidden])')
 assert not errors,errors
 result={'checks':['real pointer-held mining increases emerald clicks while caption continues','camera drag suspends reading','pointer release resumes without losing sentence'],'errors':errors}
 (out/'hold-results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result));ctx.close();browser.close()
