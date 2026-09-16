import json
import os
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

base = os.environ.get('MC_RELEASE_URL', 'http://127.0.0.1:8893/projects/mc-clicker-2/')
errors, http_errors = [], []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--use-angle=metal'] if sys.platform == 'darwin' else [])
    context = browser.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, is_mobile=True)
    page = context.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('response', lambda r: http_errors.append(r.url) if r.status >= 400 else None)
    page.goto(base)
    page.wait_for_load_state('networkidle')
    assert page.title() == 'MC Clicker 2.0 · 从一块到万物'
    assert page.evaluate('typeof mcDebug') == 'undefined'
    assert page.locator('#world canvas').count() == 1
    for _ in range(10):
        page.locator('#mine').tap()
    page.locator('[data-nav=build]').tap()
    page.wait_for_function('document.querySelector("[data-icon=T1]")?.naturalWidth === 192')
    page.locator('[data-buy=T1]').tap()
    assert page.locator('#click-value').text_content() != '+1'
    page.locator('#settings').tap()
    assert 'GPT-6 Astra' in page.locator('#modal').text_content()
    assert not page.evaluate('document.documentElement.scrollWidth > innerWidth')
    page.screenshot(path='docs/qa/70-release-phone.png')
    assert not errors, errors
    assert not http_errors, http_errors
    for id in ['L2', 'N4', 'E2']:
        response = context.request.get(base + 'icons/' + id + '.png')
        assert response.ok and response.headers['content-type'].startswith('image/'), id
    result = {'url': base, 'name': True, 'attribution': True, 'mobilePurchase': True, 'relativeAssets': True, 'noDebug': True, 'errors': errors, 'httpErrors': http_errors}
    Path('docs/qa/release-observations.json').write_text(json.dumps(result, indent=2))
    print(json.dumps(result))
    browser.close()
