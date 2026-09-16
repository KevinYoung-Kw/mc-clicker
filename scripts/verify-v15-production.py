"""Exercise the release bundle through real controls, without development helpers."""
from pathlib import Path
import argparse, json
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:8891/')
parser.add_argument('--out', default='docs/v1.5/qa/production')
parser.add_argument('--version', default='1.5.0')
args = parser.parse_args()
# Later releases keep the V1.5.6 opening and migration contract.
rules_version = '1.5.6' if tuple(map(int, args.version.split('-')[0].split('.'))) >= (1, 6, 0) else args.version
out = ROOT / args.out
out.mkdir(parents=True, exist_ok=True)
seed = json.loads((ROOT / 'docs/qa/v13/fixture.json').read_text())
seed['grid']['links']['M9'] = False
seed['grid']['disabled'] = []
seed['money'] = 1000000
seed['savedAt'] = 1
reports = []
with sync_playwright() as p:
    for engine, width in [('chromium', 1440), ('webkit', 390), ('chromium', 320)]:
        browser = getattr(p, engine).launch(headless=True, **({'args': ['--use-angle=metal']} if engine == 'chromium' else {}))
        for legacy in [False, True]:
            context = browser.new_context(viewport={'width': width, 'height': 844}, is_mobile=width<760, has_touch=width<760)
            # Seed only once; subsequent reload must read the game's own persisted save.
            if legacy:
                context.add_init_script('if(!localStorage.getItem("mc-clicker-world-v2"))localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(seed))+')')
            page = context.new_page()
            errors, http_errors = [], []
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.on('response', lambda r: http_errors.append(r.url) if r.status >= 400 else None)
            def press(selector):
                loc = page.locator(selector).first
                loc.tap() if width<760 else loc.click()
            def saved():
                return page.evaluate('JSON.parse(localStorage.getItem("mc-clicker-world-v2"))')
            page.goto(args.url, wait_until='networkidle')
            page.wait_for_selector('#world canvas')
            assert page.evaluate('typeof window.mcDebug') == 'undefined'
            assert args.version in page.title()
            if not legacy:
                assert not page.locator('#income-open').is_visible()
                assert not page.locator('#info-open').is_visible()
                if rules_version in ['1.5.2','1.5.3','1.5.4','1.5.5','1.5.6']:
                    for selector in ['#settings','#share-open','#info-open','#hud-more']: assert page.locator(selector).is_hidden()
                    page.evaluate('''()=>{window.__arrivals=[];new MutationObserver(records=>{for(const r of records)if(r.oldValue==='true'&&!r.target.hasAttribute('data-companion-arriving')&&['settings','share-open','info-open'].includes(r.target.id))window.__arrivals.push(r.target.id);}).observe(document.querySelector('.hud'),{subtree:true,attributes:true,attributeOldValue:true,attributeFilter:['data-companion-arriving']});}''')
                else: assert page.evaluate('!document.querySelector("#share-open").hidden')
                for _ in range(10): press('#mine')
                page.evaluate('window.dispatchEvent(new Event("blur"));window.dispatchEvent(new Event("focus"))')
                before = saved()['money']
                press('[data-nav=build]')
                press('[data-buy-guidance=info]')
                press('#placement-cancel')
                press('[data-buy-guidance=info]')
                press('#placement-confirm')
                assert saved()['guidance']['info'] and abs(saved()['money'] - (before-10)) < 0.0001
                assert page.locator('#panel-close').is_visible()
                if width<760: press('#panel-expand')
                page.wait_for_function('(phrase)=>!document.querySelector("#narrator").hidden && document.querySelector("#narrator p").textContent.includes(phrase)', arg="重见天日" if rules_version in ["1.5.5","1.5.6"] else "出来了", timeout=15000)
                page.screenshot(path=str(out/f'opening-{engine}-{width}.png'))
                if rules_version in ['1.5.1','1.5.2','1.5.3','1.5.4','1.5.5','1.5.6']:
                    phrase='介绍两个朋友' if rules_version in ['1.5.5','1.5.6'] else '设置和分享' if rules_version in ['1.5.3','1.5.4'] else '设置、分享' if rules_version=='1.5.2' else '分享、设置'
                    page.wait_for_function('(phrase)=>!document.querySelector("#narrator").hidden && document.querySelector("#narrator p").textContent.includes(phrase)',arg=phrase,timeout=15000)
                    if rules_version in ['1.5.2','1.5.3','1.5.4','1.5.5','1.5.6']:
                        for selector in ['#settings','#share-open','#info-open','#hud-more']:assert page.locator(selector).is_hidden()
                    if rules_version == '1.5.6':
                        caption=page.locator('#narrator p')
                        assert all(word in caption.inner_text() for word in ['设置','声音','分享','链接','纪念卡'])
                        assert caption.evaluate('e=>e.scrollHeight<=e.clientHeight+1 && e.scrollWidth<=e.clientWidth+1')
                        page.wait_for_timeout(250)  # let the existing subtitle fade-in finish
                        page.screenshot(path=str(out/f'friends-{engine}-{width}.png'))
                    page.wait_for_selector('.narrator-companion')
                    page.wait_for_function('JSON.parse(localStorage.getItem("mc-clicker-world-v2")).narrative.companionsShown && !document.querySelector(".narrator-companion,.companion-arrival")')
                if rules_version in ['1.5.2','1.5.3','1.5.4','1.5.5','1.5.6']: assert page.evaluate('window.__arrivals')==['settings','share-open','info-open']
                press('#panel-close')
                for _ in range(20): press('#mine')
                page.evaluate('window.dispatchEvent(new Event("blur"));window.dispatchEvent(new Event("focus"))')
                before = saved()['money']
                press('[data-nav=build]')
                press('[data-buy-guidance=goals]')
                press('#placement-confirm')
                assert saved()['guidance']['goals'] and abs(saved()['money'] - (before-20)) < 0.0001
                page.reload(wait_until='networkidle')
                assert page.locator('#mission').is_visible()
                assert saved()['guidance']['info'] and saved()['guidance']['goals']
                if rules_version in ['1.5.1','1.5.2','1.5.3','1.5.4','1.5.5','1.5.6']:
                    if not page.locator('#info-open').is_visible(): press('#hud-more')
                    press('#info-open');press('#info-tab-guide');press('#guidance-notices')
                    page.wait_for_selector('#notification-shell[data-expression=muffled]')
                    assert saved()['narrative']['muteReactionSeen'] and not saved()['guidance']['notices']
                    press('#modal-close')
                    if not page.locator('#settings').is_visible(): press('#hud-more')
                    press('#settings');assert not page.locator('#narration-setting').is_checked()
                    press('#modal-close');page.reload(wait_until='networkidle')
                    assert saved()['narrative']['companionsShown'] and saved()['narrative']['muteReactionSeen']
                    assert not saved()['guidance']['notices']
                    page.screenshot(path=str(out/f'muted-{engine}-{width}.png'))
                checks = ['minimal opening', 'free share', 'purchase cancellation', 'notification purchase and immediate narration', 'shop remains open', 'tracker purchase', 'collection and preference persistence']
            else:
                assert page.locator('#income-open').is_visible()
                press('[data-nav=network]')
                press('[data-industry-tab=power]')
                press('[data-network-action=connect][data-network-id=M9]')
                assert saved()['grid']['links']['M9'] is True
                press('[data-network-action=toggle][data-network-id=M9]:visible')
                assert 'M9' in saved()['grid']['disabled']
                page.reload(wait_until='networkidle')
                assert saved()['grid']['links']['M9'] and 'M9' in saved()['grid']['disabled']
                page.evaluate('window.dispatchEvent(new Event("blur"))')
                page.wait_for_selector('#foreground-status:not([hidden])')
                balance = page.locator('#money').inner_text()
                page.wait_for_timeout(3100)
                assert page.locator('#money').inner_text() == balance
                page.screenshot(path=str(out/f'legacy-{engine}-{width}.png'))
                checks = ['legacy migration', 'existing HUD retained', 'connect device', 'pause device', 'persist grid changes across reload', 'foreground-only income']
            if rules_version in ['1.5.1','1.5.2','1.5.3','1.5.4','1.5.5','1.5.6'] and not legacy: checks += ['one-line friends introduction and flight', 'information tabs', 'first mute pixel face', 'shared settings toggle', 'no replay after reload']
            if rules_version in ['1.5.2','1.5.3','1.5.4','1.5.5','1.5.6'] and not legacy:checks+=['empty top bar before purchase', 'entries stay hidden during speech', 'settings/share/narrator arrival order']
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1')
            assert not errors, errors
            assert not http_errors, http_errors
            reports.append(dict(engine=engine, width=width, legacy=legacy, checks=checks, noDebug=True, errors=errors, httpErrors=http_errors))
            context.close()
        browser.close()
(out/'production-report.json').write_text(json.dumps(reports, ensure_ascii=False, indent=2)+'\n')
print('Production: 6 new/legacy scenarios passed')
