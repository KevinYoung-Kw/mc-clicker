"""Isolated browser save transfer checks. Never opens the user's browser profile."""
import argparse
import json
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:8922/')
parser.add_argument('--out', default='docs/v1.7/qa/save-codes/browser')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
release = json.loads((root / 'package.json').read_text())['version']
out = root / args.out
out.mkdir(parents=True, exist_ok=True)
seeds = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', '''
import {fresh,buy} from './src/game.js';import {chooseOpening} from './src/opening-guide.js';import {buyGuidance} from './src/guidance.js';
import {NARRATOR_COPY} from './src/narrator-copy.js';
const start=fresh(42);start.reducedMotion=true;start.sound=false;
const played=structuredClone(start);chooseOpening(played,'returning');played.money=1e6;
for(const id of ['info','counter','nameplate','goals'])buyGuidance(played,id);
for(const id of ['T1','V1','V18','V2','V3','L1'])buy(played,id);
played.money=123456;played.play=1200;played.sound=false;played.audio.narratorVoice=false;
played.narrative.history=Object.entries(NARRATOR_COPY).filter(([,c])=>c.lines.length).slice(0,24).map(([id,c])=>({id,text:c.lines.join(' ')}));
played.narrative.seen=played.narrative.history.map(h=>h.id);
console.log(JSON.stringify({start,played}));
'''], cwd=root, text=True))
def owned(s):
    return {key: value for key, value in s["counts"].items() if value}

reports = []
with sync_playwright() as p:
    shared_code = None
    for engine, width in [('chromium', 1440), ('webkit', 390), ('chromium', 320)]:
        mobile = width < 760
        browser = getattr(p, engine).launch(headless=True, **({'args': ['--use-angle=metal']} if engine == 'chromium' else {}))
        errors = []

        def start(seed, clipboard=False):
            ctx = browser.new_context(viewport={'width': width, 'height': 844}, is_mobile=mobile, has_touch=mobile,
                                      timezone_id='Asia/Shanghai', **({'permissions': ['clipboard-read', 'clipboard-write']} if clipboard else {}))
            ctx.add_init_script('if(!localStorage.getItem("mc-clicker-world-v2")) localStorage.setItem("mc-clicker-world-v2",' + json.dumps(json.dumps(seed)) + ')')
            page = ctx.new_page()
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.goto(args.url, wait_until='networkidle')
            assert 'V' + release in page.title()
            assert page.evaluate('typeof mcDebug') == 'undefined'
            return ctx, page

        def press(selector):
            el = page.locator(selector)
            el.tap() if mobile else el.click()
            if selector == '#load-tab' and not page.locator('#load-code-backup').evaluate('e=>e.open'):
                page.locator('#load-code-backup summary').click()

        def open_save():
            if mobile:
                press('#hud-more')
            press('#settings')
            press('#save-settings')
            page.wait_for_function('document.querySelector("#copy-save") && !document.querySelector("#copy-save").disabled')
            if not page.locator('#save-code-details').evaluate('e=>e.open'):
                page.locator('#save-code-details summary').click()

        def current():
            return page.evaluate('JSON.parse(localStorage.getItem("mc-clicker-world-v2"))')

        def inspect(code):
            press('#load-tab')
            page.locator('#load-code').fill(code)
            press('#inspect-save')
            page.wait_for_selector('#load-preview:not([hidden])')

        context, page = start(seeds['played'], clipboard=engine == 'chromium')
        open_save()
        own_code = page.locator('#save-code').input_value()
        assert own_code.startswith('MCC5.')
        if engine == 'chromium':
            press('#copy-save')
            page.wait_for_function('document.querySelector("#save-feedback").textContent.includes("已复制")')
            assert page.evaluate('navigator.clipboard.readText()') == own_code
        # Real UI fallback after a denied browser permission, in an isolated context.
        page.evaluate('Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:()=>Promise.reject(new Error("denied"))}})')
        press('#copy-save')
        page.wait_for_function('document.querySelector("#save-feedback").textContent.includes("已选中")')
        assert page.locator('#save-code').evaluate('(e)=>e.selectionEnd-e.selectionStart') == len(own_code)
        assert len(own_code) < 3000
        press('#split-save')
        parts = []
        while True:
            fragment = page.locator('#save-code').input_value()
            assert len(fragment) <= 500
            assert fragment.startswith('MCP1.')
            parts.append(fragment)
            if page.locator('#next-part').is_disabled():
                break
            press('#next-part')
        assert len(parts) > 1
        page.screenshot(path=str(out / f'parts-{engine}-{width}.png'))
        press('#split-save')
        assert page.locator('#save-code').input_value() == own_code
        page.screenshot(path=str(out / f'save-{engine}-{width}.png'))
        shared_code = shared_code or own_code
        context.close()

        # Read the desktop's copied text on a different browser/device context.
        context, page = start(seeds['start'])
        assert page.locator('#save-open').count() == 0
        assert not page.locator('#settings').is_visible()
        assert not page.locator('#hud-more').is_visible()
        page.get_by_role('button', name='之前玩过', exact=True).click()
        page.wait_for_function('!document.querySelector("#settings").hidden')
        open_save()
        assert owned(current()) == {}
        press('#load-tab')
        # Out-of-order and duplicate parts must not cause an early import.
        page.locator('#load-code').fill(parts[-1])
        press('#inspect-save')
        assert page.locator('#load-parts-count').inner_text().startswith('已收集 1 /')
        page.locator('#load-code').fill(parts[-1])
        press('#inspect-save')
        assert page.locator('#load-parts-count').inner_text().startswith('已收集 1 /')
        page.locator('#load-code').fill(parts[0][:-1])
        press('#inspect-save')
        page.wait_for_selector('#save-feedback.is-error')
        assert owned(current()) == {}
        assert not page.locator('#load-preview').is_visible()
        for fragment in reversed(parts[:-1]):
            page.locator('#load-code').fill(fragment)
            press('#inspect-save')
        page.wait_for_selector('#load-preview:not([hidden])')
        assert owned(current()) == {}
        press('#cancel-import')
        press('#clear-parts')
        assert not page.locator('#load-preview').is_visible()
        page.locator('#load-code').fill(shared_code[:-1])
        press('#inspect-save')
        page.wait_for_selector('#save-feedback.is-error')
        assert owned(current()) == {}
        assert not page.locator('#load-preview').is_visible()
        inspect('\n' + '\n'.join(shared_code[i:i+80] for i in range(0, len(shared_code), 80)) + '\n')
        assert owned(current()) == {}
        page.screenshot(path=str(out / f'load-{engine}-{width}.png'))
        press('#cancel-import')
        assert owned(current()) == {}
        inspect(shared_code)
        press('#confirm-import')
        page.wait_for_function('!document.querySelector("#modal").open')
        assert owned(current()) == owned(seeds['played'])
        assert current()['guidance']['counter']
        assert current()['audio']['narratorVoice'] is False
        assert current()['money'] < 124000  # No offline catch-up from epoch-time savedAt.
        assert page.locator('.hud .wallet').is_visible()
        page.reload(wait_until='networkidle')
        assert owned(current()) == owned(seeds['played'])
        page.screenshot(path=str(out / f'restored-{engine}-{width}.png'))

        # Restore the replacement's automatically saved predecessor.
        open_save()
        press('#restore-save-backup')
        page.wait_for_selector('#load-preview:not([hidden])')
        press('#confirm-import')
        page.wait_for_function('!document.querySelector("#modal").open')
        assert owned(current()) == {}

        # A newly selected invalid file must invalidate the preceding preview.
        open_save()
        inspect(shared_code)
        page.locator('#import-save').set_input_files({'name': 'too-large.json', 'mimeType': 'application/json', 'buffer': b' ' * (8 * 1024 * 1024 + 1)})
        page.wait_for_selector('#save-feedback.is-error')
        assert not page.locator('#load-preview').is_visible()
        assert owned(current()) == {}
        # JSON files use the same preview and confirmation flow.
        page.locator('#import-save').set_input_files({'name': 'old-save.json', 'mimeType': 'application/json', 'buffer': json.dumps(seeds['played']).encode()})
        page.wait_for_selector('#load-preview:not([hidden])')
        press('#confirm-import')
        page.wait_for_function('!document.querySelector("#modal").open')
        assert owned(current()) == owned(seeds['played'])
        open_save()
        with page.expect_download() as download:
            press('#export-save')
        assert owned(json.loads(Path(download.value.path()).read_text())) == owned(seeds['played'])

        # Storage/quota rejection must not change the active world.
        page.evaluate('''()=>{window.originalSetItem=Storage.prototype.setItem;
          Storage.prototype.setItem=function(k,v){if(k==='mc-clicker-world-before-import')throw new Error('quota');return window.originalSetItem.call(this,k,v)}}''')
        page.locator('#import-save').set_input_files({'name': 'fresh.json', 'mimeType': 'application/json', 'buffer': json.dumps(seeds['start']).encode()})
        page.wait_for_selector('#load-preview:not([hidden])')
        press('#confirm-import')
        page.wait_for_selector('#save-feedback.is-error')
        assert owned(current()) == owned(seeds['played'])
        assert page.locator('#modal').is_visible()
        page.evaluate('()=>{Storage.prototype.setItem=window.originalSetItem}')
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        assert page.locator('.save-panel').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
        context.close()
        browser.close()
        assert not errors, errors
        report = {'engine': engine, 'width': width, 'codeLength': len(own_code), 'crossDeviceImport': True, 'settingsOnlyEntry': True, 'returningPlayerCanLoad': True,
                  'corruptionRejected': True, 'cancelPreservesWorld': True, 'backupRestore': True,
                  'clipboardDeniedFallback': True, 'jsonRoundTrip': True, 'storageFailurePreservesWorld': True,
                  'reload': True, 'newFileInvalidatesPreview': True, 'noOverflow': True, 'errors': errors}
        reports.append(report)
        print(json.dumps(report), flush=True)
(out / 'report.json').write_text(json.dumps(reports, ensure_ascii=False, indent=2) + '\n')
