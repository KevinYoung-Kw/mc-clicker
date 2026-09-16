"""Tap real world meshes (camera framed for the test) to open local settings."""
import json,subprocess,argparse
from pathlib import Path
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1];out=R/'docs/v2.0.0/qa/alpha7-ui';ap=argparse.ArgumentParser();ap.add_argument('--url',default='http://127.0.0.1:8975/');ap.add_argument('--xhs',action='store_true');opt=ap.parse_args()
code="""import fs from 'node:fs';import {restore,buy,frontier} from './src/game.js';import {civicSites,buildCivic} from './src/civic-sites.js';const s=restore(JSON.parse(fs.readFileSync('docs/v2.0.0/qa/alpha7-ui/fixture.json')));while(!civicSites(s,'V25').length)buy(s,'V1',frontier(s)[0]);const r=buildCivic(s,'V25',civicSites(s,'V25')[0]);if(!r.ok)throw Error(r.reason);console.log(JSON.stringify(s));"""
s=json.loads(subprocess.check_output(['node','--input-type=module','-e',code],cwd=R,text=True));reports=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(args=['--use-angle=metal']);c=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);c.add_init_script('localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(s))+')');p=c.new_page();p.goto(opt.url,wait_until='networkidle')
 if opt.xhs:p.locator('#xhs-start button').click()
 for owner,branch in [('V25',False),('V22',False),('V23',False),('V25',True)]:
  if p.locator('#panel-close').is_visible():p.locator('#panel-close').click()
  p.evaluate('([id,branch])=>{const w=mcDebug.world;const target=branch?mcDebug.state.life.sites.find(p=>p.type===id):mcDebug.state.placements[id];w.inspectPoint(target,4)}',[owner,branch]);p.wait_for_timeout(500)
  point=p.evaluate('([id,branch])=>{const w=mcDebug.world;const site=branch?mcDebug.state.life.sites.find(p=>p.type===id):null;const shot=w.itemCamera(site?site.id:id);const v=shot.point.clone().project(w.camera),r=w.renderer.domElement.getBoundingClientRect();return {x:r.x+(v.x+1)*r.width/2,y:r.y+(1-v.y)*r.height/2}}',[owner,branch]);p.touchscreen.tap(point['x'],point['y']);p.wait_for_selector('[data-life-facility="'+owner+'"]')
  assert p.locator('[data-life-menu]').count()==3
  reports.append({'owner':owner,'branch':branch,'worldTapOpensSettings':True,'input':'touch'})
 p.screenshot(path=str(out/'world-tap-390.png'));b.close()
(out/'world-report.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2));print(reports)
