"""Production UI checks in isolated browser profiles, including legacy delivery."""
from pathlib import Path
import argparse, hashlib, json, math, subprocess
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:8891/?v=1.4.2')
parser.add_argument('--out', default='docs/v1.4.2/qa/group-mail')
args = parser.parse_args()
out = ROOT / args.out
out.mkdir(parents=True, exist_ok=True)
key = 'mc-clicker-world-v2'
letter = 'community-wechat-group'
source = ROOT / 'public/mail/mc-clicker-group-20260907.png'
seed = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', '''
import {fresh,buy,redeemMail} from './src/game.js';
import {buyGuidance} from './src/guidance.js';
import {readMail} from './src/mail.js';
const s=fresh();s.money=1000;
buyGuidance(s,'goals');
for(const id of ['T1','V1','V18']) {const r=buy(s,id);if(!r.ok)throw Error(r.reason);}
s.rate=4;readMail(s,'welcome-wechat');redeemMail(s,'welcome-wechat');
console.log(JSON.stringify(s));
'''], cwd=ROOT, text=True))
reports = []
with sync_playwright() as p:
    for engine, width, legacy in [('chromium',1440,False), ('webkit',390,True), ('webkit',320,True)]:
        fixture = json.loads(json.dumps(seed))
        if legacy:
            del fixture['mail']['letters'][letter]
            fixture['mail']['catalogVersion'] = 1
        browser = getattr(p,engine).launch(headless=True)
        context = browser.new_context(viewport={'width':width,'height':900 if width>760 else 844},is_mobile=width<760,has_touch=width<760,accept_downloads=True)
        context.add_init_script('if(!sessionStorage.getItem("mail-qa")){localStorage.setItem('+json.dumps(key)+','+json.dumps(json.dumps(fixture))+');sessionStorage.setItem("mail-qa","1")}')
        page = context.new_page(); errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        def press(selector):
            loc=page.locator(selector).first
            loc.tap() if width<760 else loc.click()
        def open_mail():
            press('[data-nav="build"]')
            press('.construction-tabs [data-open="owned"]')
            press('[data-detail="V18"]')
            page.wait_for_selector('#mail-panel')
        def saved():
            return page.evaluate('k=>JSON.parse(localStorage.getItem(k))',key)
        page.goto(args.url,wait_until='networkidle')
        assert '1.4.2' in page.title()
        assert page.evaluate('typeof mcDebug') == 'undefined'
        open_mail()
        assert page.locator('[data-mail-open]').count()==3
        row=page.locator(f'[data-mail-open="{letter}"]')
        assert '微信交流群' in row.inner_text() and '未读' in row.inner_text()
        press(f'[data-mail-open="{letter}"]')
        assert saved()['mail']['letters'][letter]['reward'] is None
        assert saved()['mail']['letters']['welcome-wechat']['reward']==20
        assert saved()['mail']['catalogVersion']==2
        qr=page.locator('.mail-qr-focus');qr.scroll_into_view_if_needed()
        page.wait_for_function('document.querySelector(".mail-qr-focus img")?.naturalWidth===1070')
        qr.screenshot(path=out/f'qr-{width}.png')
        assert '2026 年 9 月 14 日前' in page.locator('figcaption').inner_text()
        with page.expect_download() as download:
            press('.mail-image-actions a[download]')
        downloaded = download.value
        assert downloaded.suggested_filename=='MC-Clicker-交流群.png'
        assert hashlib.sha256(Path(downloaded.path()).read_bytes()).digest()==hashlib.sha256(source.read_bytes()).digest()
        for selector in ['#mail-panel','.mail-letter','.mail-reward-slot']:
            assert page.locator(selector).evaluate('e=>e.scrollWidth<=e.clientWidth+1'),selector
        dock=page.locator('[data-mail-claim]').bounding_box()
        assert dock and 0<=dock['y'] and dock['y']+dock['height']<=page.viewport_size['height']
        page.screenshot(path=out/f'mail-{engine}-{width}.png')
        # Reading does not freeze the reward; raise the real postal rate in its UI.
        press('[data-mail-dock] [data-mail-back]')
        press('[data-mail-tab="postal"]');press('[data-mail-upgrade]')
        page.wait_for_function('document.querySelector("#rate").textContent==="2"')
        press('[data-mail-tab="letters"]');press(f'[data-mail-open="{letter}"]')
        press('[data-mail-claim]')
        receipt=saved()['mail']['letters'][letter]
        assert math.isclose(receipt['claimedRate'],2,abs_tol=1e-6) and math.isclose(receipt['reward'],10,abs_tol=1e-6),receipt
        assert page.locator('[data-mail-claim]').is_disabled()
        page.reload(wait_until='networkidle');open_mail();press(f'[data-mail-open="{letter}"]')
        assert page.locator('[data-mail-claim]').is_disabled()
        assert saved()['mail']['letters'][letter]['reward']==receipt['reward']
        assert saved()['mail']['letters']['welcome-wechat']['reward']==20
        assert not errors,errors
        reports.append(dict(engine=engine,width=width,legacy=legacy,reward=10,originalDownload=True,errors=errors))
        context.close();browser.close();print(engine,width,'group mail passed',flush=True)
(out/'results.json').write_text(json.dumps(reports,indent=2)+'\n')
