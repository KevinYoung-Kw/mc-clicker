"""Real purchase controls in isolated desktop/mobile production contexts."""
import argparse
import json
import math
from pathlib import Path
import sys
import tempfile
import subprocess
from playwright.sync_api import sync_playwright
from importlib.util import spec_from_file_location, module_from_spec

ROOT = Path(__file__).resolve().parents[1]
spec = spec_from_file_location("interiors", ROOT / "scripts/verify-interiors-release.py")
base = module_from_spec(spec)
spec.loader.exec_module(base)
KEY = base.SAVE_KEY

def click(page, selector):
    target = page.locator(selector).first
    if selector in ['#settings','#info-open','#share-open','#collection-open','#sound'] and not target.is_visible() and page.locator('#hud-more').is_visible():
        page.locator('#hud-more').click()
    target.click()

def watch_shop(page):
    page.wait_for_timeout(450)
    page.evaluate("""() => {
      window.purchaseObservations = {closed: false, animations: 0};
      const p = document.querySelector('#panel');
      window.purchaseObserver?.disconnect();
      window.purchaseObserver = new MutationObserver(records => {
        if (p.hidden || records.some(r => r.attributeName === 'hidden' && r.oldValue !== null))
          window.purchaseObservations.closed = true;
      });
      window.purchaseObserver.observe(p, {attributes:true, attributeOldValue:true, attributeFilter:['hidden']});
      if (!p.purchaseOriginalAnimate) {
        p.purchaseOriginalAnimate = p.animate;
        p.animate = function(...args) {
          window.purchaseObservations.animations++;
          return this.purchaseOriginalAnimate(...args);
        };
      }
    }""")

def stays_open(page):
    assert page.locator('#panel').is_visible()
    assert page.evaluate('window.purchaseObservations') == {'closed': False, 'animations': 0}
    base.no_overflow(page)

def preference(page, enabled):
    click(page, '#settings')
    page.locator('#skip-purchase-confirmation-setting').set_checked(enabled)
    click(page, '#modal-close')
    assert base.saved(page)['skipPurchaseConfirmation'] is enabled

def pending(page, before):
    base.assert_pending(page, before)
    assert page.locator('#panel > #placement-bar.purchase-dock').is_visible()
    stays_open(page)

def paid_count(page, before, item):
    after = base.wait_count(page, item, before['counts'].get(item, 0) + 1)
    assert not page.locator('#placement-bar').is_visible()
    stays_open(page)
    return after

def run(page, output, mode, checks):
    check = lambda name: checks.append(mode + ': ' + name)
    assert page.evaluate('typeof window.mcDebug') == 'undefined'
    page.locator('#world canvas').wait_for(state='visible')
    click(page, '#settings')
    assert not page.locator('#skip-purchase-confirmation-setting').is_checked()
    page.screenshot(path=output / f'purchases-{mode}-settings.png')
    click(page, '#modal-close')
    check('confirmation defaults on')

    click(page, '[data-nav="build"]')
    click(page, '[data-open="owned"]')
    click(page, '[data-family="V"]')
    page.locator('[data-buy="V4"]').scroll_into_view_if_needed()
    watch_shop(page)
    before = base.saved(page)
    click(page, '[data-buy="V4"]')
    pending(page, before)
    page.screenshot(path=output / f'purchases-{mode}-confirmation.png')
    click(page, '#placement-cancel')
    stays_open(page)
    assert base.progress(base.saved(page)) == base.progress(before)
    check('cancel never pays or closes shop')
    click(page, '[data-buy="V4"]')
    click(page, '#placement-confirm')
    after = paid_count(page, before, 'V4')
    assert after['placements']['V4'] == before['placements']['V4']
    assert page.locator('[data-family="V"]').get_attribute('aria-selected') == 'true'
    assert page.locator('[data-open="owned"]').get_attribute('aria-selected') == 'true'
    check('confirmed upgrade retains shop, filter, owned tab and position')

    preference(page, True)
    watch_shop(page)
    for _ in range(2):
        before = base.saved(page)
        button = page.locator('[data-buy="V4"]')
        button.scroll_into_view_if_needed()
        scroll = page.locator('#panel-content').evaluate('(e) => e.scrollTop')
        cost = float(button.inner_text().split()[0].replace(',', ''))
        click(page, '[data-buy="V4"]')
        after = paid_count(page, before, 'V4')
        base.assert_paid(before, after, cost)
        assert abs(page.locator('#panel-content').evaluate('(e) => e.scrollTop') - scroll) < 2
    check('two instant upgrades charge once each and retain scroll')

    click(page, '[data-nav="village"]')
    click(page, '[data-village-tab="construction"]')
    watch_shop(page)
    before = base.saved(page)
    click(page, '[data-equipment-buy="V6"]')
    pending(page, before)
    assert not page.locator('#placement-confirm').is_enabled()
    base.choose_grid(page)
    page.screenshot(path=output / f'purchases-{mode}-site.png')
    click(page, '#placement-confirm')
    paid_count(page, before, 'V6')
    assert page.locator('[data-village-tab="construction"]').is_visible()
    check('instant mode still requires choosing a legal outdoor site')

    click(page, '[data-nav="network"]')
    click(page, '[data-industry-tab="automation"]')
    watch_shop(page)
    before = base.saved(page)
    click(page, '[data-equipment-buy="M10"]')
    pending(page, before)
    base.choose_grid(page)
    click(page, '#placement-confirm')
    paid_count(page, before, 'M10')
    check('industry construction retains its management panel')

    click(page, '[data-nav="build"]')
    click(page, '[data-open="owned"]')
    click(page, '[data-family="all"]')
    click(page, '[data-detail="L2"]')
    page.locator('#room-tools').wait_for(state='visible')
    click(page, '[data-room-tab="equipment"]')
    watch_shop(page)
    for index in range(3):
        before = base.saved(page)
        click(page, '[data-buy="L3"]')
        pending(page, before)
        assert not page.locator('#placement-confirm').is_enabled()
        base.choose_grid(page)
        click(page, '#placement-confirm')
        after = paid_count(page, before, 'L3')
        assert f'L3:{index}' in after['studio']['placements']
        assert page.locator('[data-room-tab="equipment"]').get_attribute('class') == 'active'
    check('each new camera requires its own preview; equipment tab stays open')
    assert page.locator('[data-buy="L3"]').count() == 0
    check('maxed cameras no longer offer another purchase')
    before = base.saved(page)
    click(page, '[data-buy="L6"]')
    pending(page, before)
    base.choose_grid(page)
    click(page, '#placement-confirm')
    paid_count(page, before, 'L6')
    before = base.saved(page)
    click(page, '[data-buy="L6"]')
    after = paid_count(page, before, 'L6')
    assert after['studio']['placements'] == before['studio']['placements']
    check('existing gift station upgrades instantly without moving furniture')

    preference(page, False)
    watch_shop(page)
    before = base.saved(page)
    click(page, '[data-buy="L6"]')
    pending(page, before)
    click(page, '#placement-confirm')
    paid_count(page, before, 'L6')
    check('turning setting off restores indoor upgrade confirmation')

    click(page, '[data-room-tab="decor"]')
    click(page, '[data-room-decor-slot="studioShelf"]')
    watch_shop(page)
    before = base.saved(page)
    click(page, '[data-room-extra="studioShelf-0"]')
    pending(page, before)
    base.choose_grid(page)
    click(page, '#placement-confirm')
    stays_open(page)
    assert base.saved(page)['collection']['equipped']['studioShelf'] == 'studioShelf-0'
    assert page.locator('[data-room-tab="decor"]').get_attribute('class') == 'active'
    assert page.locator('[data-room-extra="studioShelf-1"]').is_visible()
    page.screenshot(path=output / f'purchases-{mode}-room.png')
    check('room decoration purchase retains category and next designs')

    preference(page, True)
    watch_shop(page)
    before = base.saved(page)
    click(page, '[data-room-extra="studioShelf-1"]')
    stays_open(page)
    assert not page.locator('#placement-bar').is_visible()
    after = base.saved(page)
    assert after['studio']['placements']['studioShelf'] == before['studio']['placements']['studioShelf']
    base.assert_paid(before, after, 18000)
    check('replacement decoration buys in place without confirmation')

    click(page, '#studio-back')
    click(page, '[data-nav="build"]')
    click(page, '[data-open="owned"]')
    click(page, '[data-detail="V3"]')
    watch_shop(page)
    before = base.saved(page)
    assert page.locator('[data-unlock-sharing]').count() == 0
    click(page, '#share-open')
    page.locator('.share-qr img').wait_for(state='visible')
    assert not page.locator('#placement-bar').is_visible()
    assert base.saved(page)['money'] == before['money']
    click(page, '#modal-close')
    stays_open(page)
    check('free sharing requires no purchase and preserves the underlying market')

    click(page, '#collection-open')
    click(page, '[data-collection-tab="world"]')
    click(page, '[data-preview="garden"]')
    # First lights need a site; their repeat levels stay in this shop.
    click(page, '[data-extra-buy="garden"]')
    base.choose_grid(page)
    click(page, '#placement-confirm')
    page.locator('#collection-shop').wait_for(state='visible')
    before = base.saved(page)
    click(page, '[data-extra-buy="garden"]')
    assert page.locator('#collection-shop').is_visible()
    assert not page.locator('#placement-bar').is_visible()
    assert base.saved(page)['counts']['X7'] == before['counts']['X7'] + 1
    check('catalogue decoration upgrades instantly inside the same shop')
    click(page, '#modal-close')
    preference(page, False)
    click(page, '#collection-open')
    click(page, '[data-collection-tab="world"]')
    click(page, '[data-preview="garden"]')
    before = base.saved(page)
    click(page, '[data-extra-buy="garden"]')
    assert page.locator('#modal-content > #placement-bar').is_visible()
    assert page.locator('#collection-shop').is_visible()
    click(page, '#placement-cancel')
    assert base.saved(page)['counts']['X7'] == before['counts']['X7']
    click(page, '[data-extra-buy="garden"]')
    click(page, '#placement-confirm')
    assert page.locator('#collection-shop').is_visible()
    assert base.saved(page)['counts']['X7'] == before['counts']['X7'] + 1
    check('decoration confirmation and cancellation keep the modal shop open')
    click(page, '#modal-close')
    preference(page, True)
    click(page, '#settings')
    click(page, '#reset-request')
    assert page.locator('#reset-confirm').is_visible()
    click(page, '#reset-cancel')
    check('skip-purchase setting never skips destructive reset confirmation')
    page.reload(wait_until='networkidle')
    click(page, '#settings')
    assert page.locator('#skip-purchase-confirmation-setting').is_checked()
    with page.expect_download() as download:
        click(page, '#export-save')
    with tempfile.TemporaryDirectory(prefix='mc-purchase-save-') as tmp:
        path = Path(tmp) / 'save.json'
        download.value.save_as(path)
        exported = json.loads(path.read_text())
        assert exported['skipPurchaseConfirmation'] is True
        page.locator('#import-save').set_input_files(str(path))
        click(page, '#confirm-import')
        assert base.saved(page)['skipPurchaseConfirmation'] is True
        check('preference survives reload, export and import')
        exported['version'] = 4
        del exported['skipPurchaseConfirmation']
        path.write_text(json.dumps(exported))
        click(page, '#settings')
        page.locator('#import-save').set_input_files(str(path))
        page.locator('#confirm-import').wait_for(state='visible')
        click(page, '#confirm-import')
        assert base.saved(page)['skipPurchaseConfirmation'] is False
        check('version 4 imports remain compatible with default confirmation')

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--url', default='http://127.0.0.1:8891/projects/mc-clicker-2/')
    parser.add_argument('--label', default='local')
    args = parser.parse_args()
    output = ROOT / 'docs/qa' / f'purchases-{args.label}'
    output.mkdir(parents=True, exist_ok=True)
    payload = base.fixture()
    seed = subprocess.run(['node', '--input-type=module', '--eval', '''
      import fs from 'node:fs';
      import {buy,sites,frontier} from './src/game.js';
      const s=JSON.parse(fs.readFileSync(0,'utf8'));
      while(!sites(s,'overworld',null,'M19').length)
        buy(s,'V1',{...frontier(s)[0],realm:'overworld'});
      const result=buy(s,'M19');if(!result.ok) throw Error(result.reason);
      console.log(JSON.stringify(s));
    '''], input=json.dumps(payload['state']), text=True, cwd=ROOT, check=True, capture_output=True)
    payload['state'] = json.loads(seed.stdout)
    payload['state']['reducedMotion'] = False
    checks, errors, failed = [], [], []
    report = {'url': args.url, 'checks': checks, 'errors': errors, 'failedRequests': failed}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=['--use-angle=metal'] if sys.platform == 'darwin' else [])
        try:
            for mode, viewport in [('desktop', {'width': 1440, 'height': 1000}), ('phone', {'width': 390, 'height': 844})]:
                context = browser.new_context(viewport=viewport, has_touch=True, is_mobile=mode == 'phone', device_scale_factor=1)
                context.add_init_script("if(!sessionStorage.getItem('purchase-seeded')){"
                    f"localStorage.setItem({json.dumps(KEY)},{json.dumps(json.dumps(payload['state']))});"
                    "sessionStorage.setItem('purchase-seeded','1');}")
                page = context.new_page()
                page.set_default_timeout(20000)
                page.on('pageerror', lambda e: errors.append(str(e)))
                page.on('requestfailed', lambda r: failed.append({'url': r.url, 'failure': r.failure}))
                page.on('response', lambda r: failed.append({'url': r.url, 'status': r.status}) if r.status >= 400 else None)
                page.goto(args.url, wait_until='networkidle')
                run(page, output, mode, checks)
                context.close()
            assert not errors, errors
            assert not failed, failed
            report['passed'] = True
        except Exception as e:
            report['passed'] = False
            report['failure'] = str(e)
            page.screenshot(path=output / 'failure.png')
            raise
        finally:
            (output / 'observations.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
            browser.close()
    print(json.dumps({'passed': True, 'checks': len(checks), 'report': str(output / 'observations.json')}, ensure_ascii=False))

if __name__ == '__main__':
    main()
