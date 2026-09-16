"""Verify upgrade ordering and its purchase/navigation flows using isolated saves."""
import argparse
import json
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:8918/')
args = parser.parse_args()
out = ROOT / 'docs/v1.7/qa/owned-upgrades'
out.mkdir(parents=True, exist_ok=True)
fixture = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', """
import {fresh,buy,frontier,restore} from './src/game.js';
import {buyEarlyGuidance} from './scripts/early-fixture.mjs';
import {CATALOG} from './src/catalog.js';
import {inConstruction,ownedGroups,ownedUpgrade} from './src/facility-shops.js';
const s=fresh(42);s.money=1e12;buyEarlyGuidance(s);
while(s.chunks.overworld.length<8){
 const site=frontier(s).sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z))[0];
 const result=buy(s,'V1',site);if(!result.ok)throw Error(result.reason);
}
Object.assign(s.counts,{T2:1,T3:1,T4:1,T5:1,V2:3,V3:1,V4:1,V5:1,M1:1,M2:1,M4:1,M5:1,M6:1,M7:3,M8:1,M9:20,M10:1,M11:1});
s.upgrades.levels['wind-blades']=1;s.upgrades.revision=1;
s.mail.postalLevel=2;s.play=1800;s.reducedMotion=true;
s.guidance.notices=false;s.narrative.intro='rescued';s.narrative.companionsShown=true;
const state=restore(s);
const expected=ownedGroups(state,CATALOG.filter(inConstruction)).upgradable.map(i=>({...ownedUpgrade(state,i),id:i.id}));
console.log(JSON.stringify({state,expected}));
"""], cwd=ROOT))
reports = []
with sync_playwright() as p:
    for engine, width in [('chromium', 1440), ('webkit', 390), ('chromium', 320)]:
        browser = getattr(p, engine).launch(headless=True, **({'args': ['--use-angle=metal']} if engine == 'chromium' else {}))
        context = browser.new_context(viewport={'width': width, 'height': 900 if width > 760 else 844}, is_mobile=width < 760, has_touch=width < 760)
        context.add_init_script('if(!localStorage.getItem("mc-clicker-world-v2"))localStorage.setItem("mc-clicker-world-v2",' + json.dumps(json.dumps(fixture['state'])) + ')')
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(args.url, wait_until='networkidle')
        page.wait_for_selector('[data-nav="build"]')
        assert page.evaluate('typeof mcDebug') == 'undefined', 'verify the production build'

        def press(selector):
            node = page.locator(selector).first
            node.tap() if width < 760 else node.click()

        def owned():
            if not page.locator('.construction-tabs').is_visible():
                press('[data-nav="build"]')
            press('.construction-tabs [data-open="owned"]')

        def list_ids():
            return page.locator('.owned-section').first.locator('[data-card]').evaluate_all('es=>es.map(e=>e.dataset.card)')

        owned()
        assert list_ids() == [row['id'] for row in fixture['expected']], {'actual': list_ids(), 'expected': fixture['expected']}
        assert page.locator('#panel-content [data-card="V1"]').count() == 0
        assert page.locator('[data-expand-land]').count() == 1
        assert page.locator('[data-card="V18"] [data-open-postal]').inner_text().strip() == '100'
        assert page.locator('.shop-upgrade-count').inner_text() == '可升级 ' + str(len(fixture['expected']))
        first = page.locator('.owned-section [data-card]').first
        first.evaluate('e=>window.ownedFirst=e')
        before_order = list_ids()
        page.wait_for_timeout(1800)
        assert first.evaluate('e=>window.ownedFirst===e'), 'income refresh must not replace the cards'
        assert list_ids() == before_order
        assert page.locator('#panel-content').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
        page.screenshot(path=str(out / f'owned-{engine}-{width}.png'))

        # Expansion is still a separate placement flow, with its original quote.
        press('[data-expand-land]')
        assert page.locator('#placement-bar').is_visible()
        assert page.locator('#placement-confirm').is_disabled()
        assert '升级' not in page.locator('#placement-bar').inner_text()
        press('#placement-cancel')
        owned()

        # The displayed postal price goes to the real postal upgrade interface.
        press('[data-card="V18"] [data-open-postal]')
        assert page.locator('[data-mail-upgrade]').is_visible()
        assert '100' in page.locator('[data-mail-upgrade]').inner_text()
        press('[data-nav="build"]')
        owned()

        # A max-level machine with unbought parts must open modifications, not say complete.
        mod = page.locator('[data-card="M9"] .buy[data-detail="M9"]')
        assert '4,000' in mod.inner_text() and '改造' in mod.inner_text()
        press('[data-card="M9"] .buy[data-detail="M9"]')
        assert page.locator('[data-mod-owner="M9"]').count() == 1
        assert page.locator('[data-mod-buy="drill-steel"]').count() == 1
        press('[data-nav="build"]')
        owned()

        # Subsequent rank prices can reverse the original catalogue order.
        press('[data-card="M7"] .card-main')
        mods = page.locator('[data-mod-owner="M7"]')
        get_order = lambda: mods.locator(':scope > [data-mod-card]').evaluate_all('es=>es.map(e=>e.dataset.modCard)')
        assert get_order() == ['wind-gears', 'wind-blades', 'wind-coils'], get_order()
        press('[data-mod-select="wind-blades"]')
        buy = page.locator('[data-mod-buy="wind-blades"]')
        buy.scroll_into_view_if_needed()
        assert '15,600' in buy.inner_text()
        page.screenshot(path=str(out / f'modifications-{engine}-{width}.png'))
        press('[data-mod-buy="wind-blades"]')
        assert page.locator('#placement-confirm').is_visible()
        assert '15,600' in page.locator('#placement-confirm').inner_text()
        press('#placement-confirm')
        page.wait_for_function('JSON.parse(localStorage.getItem("mc-clicker-world-v2")).upgrades.levels["wind-blades"]===2')
        assert get_order() == ['wind-gears', 'wind-coils', 'wind-blades']
        assert page.locator('[data-mod-card="wind-blades"]').get_attribute('data-expanded') == 'true'
        if width > 760:
            assert buy.evaluate('e=>document.activeElement===e'), 'restore keyboard/mouse purchase focus'
        assert buy.evaluate('e=>{const b=e.getBoundingClientRect(),r=document.querySelector("#panel-content").getBoundingClientRect();return b.top>=r.top&&b.bottom<=r.bottom}'), 'selected upgrade must remain in view'
        assert page.locator('#panel-content').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
        page.reload(wait_until='networkidle')
        owned()
        assert page.locator('#panel-content [data-card="V1"]').count() == 0
        press('[data-card="M7"] .card-main')
        assert get_order() == ['wind-gears', 'wind-coils', 'wind-blades']
        assert not errors, errors
        reports.append({'engine': engine, 'width': width, 'landSeparate': True, 'sortedCurrentPrices': True, 'postalPrice': True, 'maxOwnerModAccess': True, 'noIncomeReorder': True, 'confirmationPreserved': True, 'postPurchaseAnchor': True, 'keyboardFocus': True if width > 760 else 'touch does not require button focus', 'reload': True, 'noOverflow': True, 'errors': errors})
        browser.close()
(out / 'report.json').write_text(json.dumps(reports, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(reports, ensure_ascii=False, indent=2))
