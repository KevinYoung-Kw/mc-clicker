"""Production smoke checks, using isolated browser saves and public UI only."""
import argparse
import json
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ap = argparse.ArgumentParser()
ap.add_argument('--url', required=True)
ap.add_argument('--label', default='production')
args = ap.parse_args()
root = Path(__file__).resolve().parents[1]
out = root / 'docs/qa' / ('launch-' + args.label)
out.mkdir(parents=True, exist_ok=True)
seed = json.loads(subprocess.check_output(['node', '--input-type=module', '-e',
    'import {engineeringFixture} from "./scripts/engineering-fixture.mjs"; console.log(JSON.stringify(engineeringFixture()));'], cwd=root, text=True))
seed['sound'] = True
seed['counts'].pop('L2', None)
seed['placements']['L1'] = {**seed['placements'].pop('L2'), 'realm': 'overworld'}
seed.pop('records', None)
seed.pop('audio', None)
report = {'url': args.url, 'checks': [], 'errors': [], 'httpErrors': []}

with sync_playwright() as pw:
    browser = pw.webkit.launch(headless=True)
    try:
        for width, height in [(390, 844), (1440, 900)]:
            ctx = browser.new_context(viewport={'width': width, 'height': height}, is_mobile=width < 760, has_touch=width < 760)
            page = ctx.new_page()
            page.on('pageerror', lambda e: report['errors'].append(str(e)))
            page.on('response', lambda r: report['httpErrors'].append({'url': r.url, 'status': r.status}) if r.status >= 400 else None)
            page.goto(args.url, wait_until='networkidle')
            assert page.evaluate('typeof window.mcDebug') == 'undefined'
            page.locator('#mine').wait_for(state='visible')
            for _ in range(6):
                page.locator('#mine').click()
            expect(page.locator('#first-shop-hint')).to_be_visible()
            page.locator('#first-shop-hint').click()
            assert page.locator('[data-buy="T1"]').count() == 0
            page.locator('[data-buy-guidance="goals"]').click()
            page.locator('#placement-confirm').click()
            expect(page.locator('#mission-name')).to_have_text('木镐')
            expect(page.locator('#first-shop-hint')).to_be_hidden()
            page.reload(wait_until='networkidle')
            expect(page.locator('#mission-name')).to_have_text('木镐')
            page.locator('#mission-link').click()
            expect(page.locator('.item-effect')).to_contain_text('每次手动采集')
            expect(page.locator('.purchase-reason').first).to_contain_text('还差')
            page.screenshot(path=out / f'{width}-first-purchase.png')
            page.locator('#panel-close').click()
            if width < 760:
                page.locator('#hud-more').click()
                page.locator('#quick-help').click()
            else:
                page.locator('#settings').click()
                page.locator('#basic-help').click()
            expect(page.locator('#info-panel h2')).to_have_text('操作指南')
            page.locator('#info-return').click()
            ctx.close()
            ctx = browser.new_context(viewport={'width': width, 'height': height}, is_mobile=width < 760, has_touch=width < 760)
            page = ctx.new_page()
            page.on('pageerror', lambda e: report['errors'].append(str(e)))
            page.on('response', lambda r: report['httpErrors'].append({'url': r.url, 'status': r.status}) if r.status >= 400 else None)
            # Seed once before app startup; beforeunload saves must not overwrite it.
            page.add_init_script('if(!sessionStorage.getItem("qa-seeded")){localStorage.setItem("mc-clicker-world-v2",'+json.dumps(json.dumps(seed))+');sessionStorage.setItem("qa-seeded","1")}')
            page.goto(args.url, wait_until='networkidle')
            page.locator('[data-nav="village"]').click()
            page.locator('[data-manage-item="L1"]').click()
            if width < 760:
                page.locator('#panel-expand').click()
            expect(page.locator('[data-record]')).to_have_count(6)
            expect(page.locator('[data-record-playback]')).to_have_text('播放中', timeout=15000)
            page.locator('[data-record-preview="rain"]').click()
            expect(page.locator('[data-record-playback]')).to_have_text('试听中 · 10 秒')
            page.locator('[data-preview-stop]').click()
            expect(page.locator('[data-record-name]')).to_have_text('田埂来风')
            page.locator('[data-record-buy="cavern"]').click()
            page.locator('#placement-confirm').click()
            expect(page.locator('[data-record="cavern"] [data-record-state]')).to_have_text('已收藏')
            page.locator('[data-record-play="cavern"]').click()
            expect(page.locator('[data-record-name]')).to_have_text('深岩回声')
            expect(page.locator('[data-record-playback]')).to_have_text('播放中', timeout=15000)
            page.locator('[data-record-toggle]').click()
            expect(page.locator('[data-record-playback]')).to_have_text('已暂停')
            page.locator('[data-audio-volume="musicVolume"]').fill('27')
            page.locator('[data-audio-volume="musicVolume"]').dispatch_event('change')
            page.screenshot(path=out / f'{width}-records.png')
            page.reload(wait_until='networkidle')
            saved = page.evaluate('JSON.parse(localStorage.getItem("mc-clicker-world-v2"))')
            assert 'cavern' in saved['records']['owned']
            assert saved['records']['selected'] == 'cavern'
            assert saved['records']['playing'] is False
            assert saved['audio']['musicVolume'] == .27
            assert not page.evaluate('document.documentElement.scrollWidth > innerWidth')
            report['checks'].append({'width': width, 'goalsFirst': True, 'goalSaved': True, 'help': True, 'noDebug': True, 'sixRecords': True, 'previewRestores': True, 'recordPurchased': True, 'playPause': True, 'audioPreferencesSaved': True, 'noOverflow': True})
            ctx.close()
        assert not report['errors'], report['errors']
        assert not report['httpErrors'], report['httpErrors']
        report['passed'] = True
    finally:
        (out / 'results.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
        browser.close()
print(json.dumps(report, ensure_ascii=False))
