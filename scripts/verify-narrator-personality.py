"""Real checkout/cancel controls, subtitle layout and saved choices on three viewports.

Offer fixtures start at a valid already-triggered line. Eligibility, cadence and
purchase observation are also covered in narrative-personality.test.js.
"""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parents[1] / 'docs/v1.5.5/qa/personality'
OUT.mkdir(parents=True, exist_ok=True)
results = []
with sync_playwright() as p:
    for engine, width in [('chromium', 1440), ('webkit', 390), ('chromium', 320)]:
        browser = getattr(p, engine).launch(headless=True, **({'args': ['--use-angle=metal']} if engine == 'chromium' else {}))
        context = browser.new_context(viewport={'width': width, 'height': 844}, is_mobile=width < 760, has_touch=width < 760)
        page = context.new_page(); page.set_default_timeout(20000)
        errors = []; page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto('http://127.0.0.1:8890/', wait_until='networkidle')
        page.wait_for_function('!!window.mcDebug')
        def press(selector):
            button = page.locator(selector).first
            button.tap() if width < 760 else button.click()
        def seed(id, offer=False, skip=False):
            page.evaluate('''async ({id,offer,skip}) => {
                document.querySelector('#modal').close(); mcDebug.go('world');
                const {fresh}=await import('/src/game.js');
                const {NARRATION,IDLE_LINES}=await import('/src/narrative.js');
                const s=fresh();s.play=1100;s.money=100000;s.counts.X2=3;
                s.guidance.info=true;s.narrative.companionsShown=true;s.skipPurchaseConfirmation=skip;
                s.narrative.seen=[...NARRATION,...IDLE_LINES].map(r=>r.id).filter(k=>k!==id);
                if(offer){s.narrative.current={id,index:0,elapsed:0,startedAt:s.play};s.narrative.lastSuggestionAt=s.play;s.narrative.lastCosmeticAt=800;}
                if(id==='suggest-cooling'){s.counts.M9=2;s.counts.M7=1;}
                mcDebug.setState(s);
            }''', {'id': id, 'offer': offer, 'skip': skip})
        def check_caption(name):
            page.locator('#narrator').wait_for(state='visible')
            page.wait_for_timeout(250)
            for selector in ['#narrator p', '#narrator .narrator-actions button']:
                for el in page.locator(selector).all():
                    if not el.is_visible(): continue
                    box = el.bounding_box()
                    assert box and box['x'] >= 0 and box['x']+box['width'] <= width+1, (name, box)
                    assert box['y'] >= 0 and box['y']+box['height'] <= 844, (name, box)
                    assert el.evaluate('e=>e.scrollHeight<=e.clientHeight+1 && e.scrollWidth<=e.clientWidth+1'), name
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
            page.screenshot(path=str(OUT/f'{name}-{engine}-{width}.png'))

        seed('decoration:title')
        if width < 760: press('#hud-more')
        press('#collection-open')
        press('[data-web-select="web-title-first-block"]')
        before = page.evaluate('mcDebug.state.money')
        press('[data-extra-buy="web-title-first-block"]')
        assert page.evaluate('mcDebug.state.money') == before
        press('#placement-confirm')
        page.wait_for_function('mcDebug.state.webAppearance.owned["web-title-first-block"]')
        assert page.evaluate('mcDebug.state.money') == before - 40
        page.locator('[data-web-equip="web-title-first-block"]').focus()
        page.wait_for_function('mcDebug.state.narrative.current?.id==="decoration:title"')
        check_caption('purchase-reaction')
        assert page.locator('#modal').evaluate('e=>e.open')
        assert page.locator('[data-web-equip="web-title-first-block"]').evaluate('e=>e===document.activeElement'), 'caption stole focus'

        seed('suggest-notice', offer=True)
        check_caption('clothes-offer')
        before = page.evaluate('mcDebug.state.money')
        press('#narrator button:has-text("先不换")')
        assert page.evaluate('mcDebug.state.money') == before
        page.evaluate('mcDebug.save()'); page.reload(wait_until='networkidle'); page.wait_for_function('!!window.mcDebug')
        assert page.evaluate('mcDebug.state.narrative.seen.includes("suggest-notice")')

        seed('suggest-notice', offer=True)
        press('#narrator button:has-text("换这件")')
        page.locator('#placement-confirm').wait_for(state='visible')
        assert page.locator('.appearance-caption h3').inner_text() == '纸条通知'
        assert page.evaluate('mcDebug.state.money') == 100000
        press('#placement-cancel')
        assert page.evaluate('mcDebug.state.money') == 100000
        assert not page.evaluate('!!mcDebug.state.webAppearance.owned["web-notice-paper"]')
        press('[data-extra-buy="web-notice-paper"]'); press('#placement-confirm')
        assert page.evaluate('mcDebug.state.money') == 99840
        assert page.evaluate('mcDebug.state.webAppearance.equipped.notice==="web-notice-paper"')

        seed('suggest-notice', offer=True, skip=True)
        press('#narrator button:has-text("换这件")')
        page.wait_for_function('mcDebug.state.webAppearance.owned["web-notice-paper"]')
        assert page.evaluate('mcDebug.state.money') == 99840
        assert page.locator('#placement-bar').is_hidden(), 'skip confirmation preference ignored'

        seed('suggest-cooling', offer=True)
        check_caption('cooling-offer')
        before = page.evaluate('mcDebug.state.money')
        press('#narrator button:has-text("装上")')
        page.locator('#placement-confirm').wait_for(state='visible')
        assert page.evaluate('mcDebug.state.money') == before
        press('#placement-cancel')
        assert not page.evaluate('!!mcDebug.state.upgrades.levels["drill-cooling"]')
        assert page.evaluate('mcDebug.state.money') == before
        seed('suggest-cooling', offer=True)
        press('#narrator button:has-text("装上")'); press('#placement-confirm')
        assert page.evaluate('mcDebug.state.upgrades.levels["drill-cooling"]') == 1
        assert page.evaluate('mcDebug.state.money') == 88000
        assert not errors, errors
        results.append({'engine': engine, 'width': width, 'reactionInShop': True, 'focusPreserved': True, 'declinePersists': True, 'cancelDoesNotSpend': True, 'bothExistingCheckouts': True, 'skipConfirmationRespected': True, 'noClipping': True, 'errors': errors})
        print(json.dumps(results[-1], ensure_ascii=False), flush=True)
        browser.close()
(OUT/'results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2)+'\n')
