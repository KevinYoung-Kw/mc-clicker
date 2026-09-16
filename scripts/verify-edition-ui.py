"""Production UI checks; uses isolated saves, never the player's browser profile.
MC_UI_URL selects a running production server. Run from either game root.
"""
import json
import os
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
URL = os.environ.get('MC_UI_URL', 'http://127.0.0.1:8918/')
OUT = ROOT / 'docs/qa/edition-ui'
OUT.mkdir(parents=True, exist_ok=True)
script = """
import {fresh,buy} from './src/game.js';
import {chooseOpening} from './src/opening-guide.js';
import {buyGuidance} from './src/guidance.js';
const s=fresh();chooseOpening(s,'first');s.money=10000;s.reducedMotion=true;
buyGuidance(s,'info');s.narrative.companionsShown=true;s.narrative.intro='done';
s.audio.musicVolume=.31;s.audio.sfxVolume=.72;
const opening=structuredClone(s);
buyGuidance(s,'goals');for(const id of ['T1','V1','V18','V2']){const r=buy(s,id);if(!r.ok)throw Error(id+JSON.stringify(r));}
const locked=structuredClone(s);const purchase=buy(s,'L1');if(!purchase.ok)throw Error(JSON.stringify(purchase));
console.log(JSON.stringify({opening,locked,unlocked:s}));
"""
seeds = json.loads(subprocess.check_output(['node','--input-type=module','-e',script], cwd=ROOT))
results = []
with sync_playwright() as p:
    for engine,width in [('chromium',1440),('chromium',390),('webkit',390)]:
        browser = getattr(p,engine).launch(headless=True)
        for stage in ['opening','locked','unlocked']:
            context = browser.new_context(viewport={'width':width,'height':900 if width>760 else 844})
            context.add_init_script('if(!localStorage.getItem("mc-clicker-world-v2"))localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(seeds[stage]))+');')
            page=context.new_page();errors=[];failed=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.on('response',lambda r:failed.append(r.url) if r.status>=400 else None)
            page.goto(URL,wait_until='networkidle')
            if page.locator('#xhs-start').count():page.locator('#xhs-start button').click()
            page.wait_for_selector('#world canvas')
            if stage=='opening':
                page.locator('[data-nav="build"]').click()
                expect(page.locator('.opening-stock [data-buy-guidance="goals"]')).to_be_visible()
                assert page.locator('.opening-stock [data-buy-guidance="counter"],.opening-stock [data-buy-guidance="nameplate"]').count()==0
                page.locator('[data-buy-guidance="goals"]').click()
                page.locator('#placement-confirm').click()
                expect(page.locator('.opening-stock [data-buy-guidance="goals"]')).to_have_count(0)
                assert page.locator('.opening-stock [data-buy-guidance="counter"],.opening-stock [data-buy-guidance="nameplate"]').count()==0
                page.screenshot(path=str(OUT/f'{engine}-{width}-goals.png'))
            else:
                if page.locator('#hud-more').is_visible():page.locator('#hud-more').click()
                page.locator('#settings').click()
                controls=page.locator('#sound-setting,[data-audio-volume],[data-narrator-voice]')
                for control in controls.all():
                    if stage=='locked':expect(control).to_be_disabled()
                    else:expect(control).to_be_enabled()
                if stage=='locked':
                    expect(page.locator('#audio-unlock-note')).to_contain_text('购买唱片机（音乐盒）')
                    expect(page.locator('#sound-setting')).not_to_be_checked()
                else:
                    expect(page.locator('#sound-setting')).to_be_checked()
                    page.locator('[data-audio-volume="musicVolume"]').fill('37')
                    page.locator('#sound-setting').uncheck()
                page.screenshot(path=str(OUT/f'{engine}-{width}-{stage}.png'))
            page.evaluate('window.dispatchEvent(new Event("pagehide"))')
            saved=page.evaluate('JSON.parse(localStorage.getItem("mc-clicker-world-v2"))')
            if stage=='locked':
                assert saved['audio']['musicVolume']==.31 and saved['audio']['sfxVolume']==.72
                assert saved['sound']==seeds[stage]['sound']
            if stage=='unlocked':assert saved['sound']==False and saved['audio']['musicVolume']==.37
            page.reload(wait_until='networkidle')
            page.evaluate('window.dispatchEvent(new Event("pagehide"))')
            restored=page.evaluate('JSON.parse(localStorage.getItem("mc-clicker-world-v2"))')
            for key in ['counts','guidance','placements','upgrades','mail','audio','sound']:
                assert restored[key]==saved[key],(stage,key)
            assert not page.evaluate('document.documentElement.scrollWidth>innerWidth+2')
            assert not errors and not failed,(errors,failed)
            results.append({'engine':engine,'width':width,'stage':stage,'reloadPreservesState':True,'errors':errors,'failedAssets':failed})
            print(results[-1],flush=True)
            context.close()
        browser.close()
(OUT/'results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
