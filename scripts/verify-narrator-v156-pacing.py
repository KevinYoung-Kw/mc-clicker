"""Verify delayed optional hints on the release bundle in an isolated mobile save."""
from pathlib import Path
import argparse
import json
import subprocess
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:8891/')
args = parser.parse_args()
out = ROOT / 'docs/v1.5.6/qa/pacing'
out.mkdir(parents=True, exist_ok=True)
fixture_js = '''
import {fresh,buy} from './src/game.js';
import {NARRATION,IDLE_LINES} from './src/narrative.js';
const eligible=process.argv[1]==='ready',s=fresh();
s.money=1e9;s.guidance.info=true;s.narrative.companionsShown=true;
for(const id of ['T1','V1','V18','T7','V1','V1','V1','M4','T2','M1','M2','V2','V3','V4',...(eligible?['M5']:[])]){
 const result=buy(s,id);if(!result.ok)throw Error(id+JSON.stringify(result));
}
s.play=200;s.narrative.confirmations=eligible?10:9;
s.narrative.seen=[...NARRATION,...IDLE_LINES].map(r=>r.id).filter(id=>!['camera-controls','confirmations'].includes(id));
s.narrative.quiet=0;s.narrative.silence=0;s.narrative.current=null;
console.log(JSON.stringify(s));
'''
reports = []
with sync_playwright() as p:
    browser = p.webkit.launch(headless=True)
    for mode in ['not-ready', 'ready']:
        raw = subprocess.check_output(['node', '--input-type=module', '-e', fixture_js, mode], cwd=ROOT, text=True)
        context = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        context.add_init_script('if(!localStorage.getItem("mc-clicker-world-v2"))localStorage.setItem("mc-clicker-world-v2",'+json.dumps(raw)+')')
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(args.url, wait_until='networkidle')
        assert page.evaluate('typeof mcDebug') == 'undefined'
        page.wait_for_selector('#world canvas')
        saved = lambda: page.evaluate('JSON.parse(localStorage.getItem("mc-clicker-world-v2"))')
        report = {'mode': mode, 'engine': 'webkit', 'width': 390}
        if mode == 'not-ready':
            page.wait_for_timeout(14000)
            assert page.locator('#narrator').is_hidden()
            assert not any(h['id'] in ['camera-controls', 'confirmations'] for h in saved()['narrative']['history'])
            report['sevenBuildingsNineConfirmationsStayQuiet'] = True
        else:
            page.wait_for_timeout(6000)
            assert page.locator('#narrator').is_hidden(), 'optional guidance interrupted the quiet gap'
            for id in ['camera-controls', 'confirmations']:
                page.wait_for_function('(id)=>JSON.parse(localStorage.getItem("mc-clicker-world-v2")).narrative.current?.id===id && !document.querySelector("#narrator").hidden', arg=id, timeout=45000)
                page.wait_for_timeout(250)
                caption = page.locator('#narrator p')
                assert caption.evaluate('e=>e.scrollHeight<=e.clientHeight+1 && e.scrollWidth<=e.clientWidth+1')
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
                report[id] = {'text': caption.inner_text(), 'startedAt': saved()['narrative']['current']['startedAt']}
                page.screenshot(path=str(out / (id+'.png')))
                if id == 'camera-controls':
                    page.wait_for_function('JSON.parse(localStorage.getItem("mc-clicker-world-v2")).narrative.seen.includes("camera-controls")')
                    report[id]['completedAt'] = saved()['play']
            assert report['camera-controls']['startedAt'] >= 211.8
            assert report['confirmations']['startedAt'] - report['camera-controls']['completedAt'] >= 11.8, report
            page.wait_for_function('JSON.parse(localStorage.getItem("mc-clicker-world-v2")).narrative.seen.includes("confirmations")')
            page.reload(wait_until='networkidle')
            assert all(id in saved()['narrative']['seen'] for id in ['camera-controls', 'confirmations'])
            assert page.locator('#narrator').is_hidden()
            report['noReplayAfterReload'] = True
        assert not errors, errors
        report['errors'] = errors
        reports.append(report)
        context.close()
    browser.close()
(out / 'results.json').write_text(json.dumps(reports, ensure_ascii=False, indent=2)+'\n')
print('Mobile optional-hint thresholds, quiet gaps and reload passed')
