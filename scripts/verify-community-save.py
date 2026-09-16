import json,subprocess,os
from pathlib import Path
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1]
out=R/os.environ.get('MC_SAVE_QA_OUT','docs/v1.8/qa/community-keepsakes');out.mkdir(parents=True,exist_ok=True)
BASE=os.environ.get('MC_SAVE_QA_URL','http://127.0.0.1:8932/')
STATE='JSON.parse(localStorage.getItem("mc-clicker-world-v2"))' if os.environ.get('MC_SAVE_QA_PRODUCTION') else 'mcDebug.state'
seed=json.loads(subprocess.check_output(['node','--input-type=module','-e','''
import process from 'node:process';import fs from 'node:fs';import {restore}from './src/game.js';import {claimCommunitySouvenir}from './src/community-stories.js';import {gardenSites,gardenPlacementReason,plantGarden}from './src/garden.js';
const s=restore(JSON.parse(fs.readFileSync('docs/v1.8/qa/community-keepsakes/seed.json')),0);s.money=777777;
for(const id of ['request-pond','village-stage'])claimCommunitySouvenir(s,id);
const p=gardenSites(s,'request-pond',1).find(p=>!gardenPlacementReason(s,'request-pond',p));plantGarden(s,'request-pond',p);if(process.env.MC_SAVE_QA_LARGE){let n=42;s.narrative.history=Array.from({length:32},()=>({id:'rescued',text:Array.from({length:400},()=>{n^=n<<13;n^=n>>>17;n^=n<<5;return String.fromCharCode(0x4e00+(n>>>0)%12000)}).join('')}));}console.log(JSON.stringify(s));'''],cwd=R,text=True))
report={}
with sync_playwright() as p:
 b=p.chromium.launch(headless=True);c=b.new_context(viewport={'width':1440,'height':900},accept_downloads=True);c.add_init_script('localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(seed))+')');page=c.new_page();page.goto(BASE,wait_until='networkidle');page.evaluate('window.dispatchEvent(new Event("blur"))');page.locator('#settings').click();page.locator('#save-settings').click();page.wait_for_function('document.querySelector("#save-picture img")&&document.querySelector("#save-image-hint").textContent.includes("已校验")',timeout=90000)
 if os.environ.get('MC_SAVE_QA_LARGE'):
  assert len(page.locator('#save-code').input_value())>8000
  assert page.locator('#save-picture img').evaluate('(img)=>img.naturalWidth')>1728
 with page.expect_download() as dl:page.locator('#save-image-download').click()
 dl.value.save_as(str(out/'cross-browser-save.png'));b.close();report['chromiumValidatedImageExport']=True
 b=p.webkit.launch(headless=True);c=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
 other=json.loads(json.dumps(seed));other['money']=123;other['communityStories'].update(unlocked=[],claimed=[],rolled=[],triggers={});other['garden']['plants']=[];other['garden']['stored']={}
 c.add_init_script('if(!localStorage.getItem("mc-clicker-world-v2"))localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(other))+')');page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(BASE,wait_until='networkidle');page.evaluate('window.dispatchEvent(new Event("blur"))');page.locator('#hud-more').click();page.locator('#settings').click();page.locator('#save-settings').click();page.locator('#load-tab').click();page.locator('#import-save-image').set_input_files(str(out/'cross-browser-save.png'));page.locator('#confirm-import').wait_for(state='visible',timeout=90000)
 page.locator('#cancel-import').click();assert 123<=page.evaluate(STATE+'.money')<1000;assert page.evaluate(STATE+'.communityStories.claimed')==[];report['cancelPreservesWorld']=True
 page.locator('#import-save-image').set_input_files({'name':'broken.png','mimeType':'image/png','buffer':b'not a png'});page.wait_for_timeout(1500);assert 123<=page.evaluate(STATE+'.money')<1000;assert page.evaluate(STATE+'.communityStories.claimed')==[];assert not page.locator('#confirm-import').is_visible();report['badImagePreservesWorld']=True
 page.locator('#import-save-image').set_input_files(str(out/'cross-browser-save.png'));page.locator('#confirm-import').wait_for(state='visible',timeout=90000);page.locator('#confirm-import').click();page.wait_for_function('!document.querySelector("#modal").open');page.evaluate('window.dispatchEvent(new Event("blur"))')
 assert page.evaluate(STATE+'.communityStories')==seed['communityStories'];assert page.evaluate(STATE+'.garden.plants')==seed['garden']['plants'];assert page.evaluate(STATE+'.garden.stored')=={k:v for k,v in seed['garden']['stored'].items() if v>0};assert seed['money']<=page.evaluate(STATE+'.money')<seed['money']+1000;report['webkitImageRestoresAllKeepsakes']=True
 assert page.evaluate('JSON.parse(localStorage.getItem("mc-clicker-world-before-import")).money<1000');report['importBackupExists']=True
 page.evaluate('window.dispatchEvent(new Event("blur"))');page.reload(wait_until='networkidle');page.evaluate('window.dispatchEvent(new Event("blur"))');assert page.evaluate(STATE+'.communityStories')==seed['communityStories'];assert page.evaluate(STATE+'.garden.plants')==seed['garden']['plants'];assert not errors,errors
 report['reloadRetainsClaims']=True
 page.locator('#hud-more').click();page.locator('#settings').click();page.locator('#save-settings').click();page.locator('#restore-save-backup').click();page.locator('#confirm-import').wait_for(state='visible',timeout=90000);page.locator('#confirm-import').click();page.wait_for_function('!document.querySelector("#modal").open');page.evaluate('window.dispatchEvent(new Event("blur"))')
 assert 123<=page.evaluate(STATE+'.money')<1000;assert page.evaluate(STATE+'.communityStories.claimed')==[];assert not errors,errors
 report.update(backupRestoresPreviousWorld=True,errors=errors);b.close()
(out/'save-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(report)
