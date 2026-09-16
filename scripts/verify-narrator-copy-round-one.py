"""Local, isolated browser checks for the first numbered copy revision."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parents[1] / 'docs/v1.5.5/qa/copy-round-one'
OUT.mkdir(parents=True, exist_ok=True)
results = []
with sync_playwright() as p:
    for engine, width in [('chromium', 1440), ('webkit', 390), ('chromium', 320)]:
        browser = getattr(p, engine).launch(headless=True, **({'args': ['--use-angle=metal']} if engine == 'chromium' else {}))
        context = browser.new_context(viewport={'width': width, 'height': 844}, is_mobile=width < 760, has_touch=width < 760)
        page = context.new_page()
        page.set_default_timeout(25000)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto('http://127.0.0.1:8890/', wait_until='networkidle')
        page.wait_for_function('!!window.mcDebug')
        def press(selector):
            b = page.locator(selector).first
            b.tap() if width < 760 else b.click()
        def expand():
            if width < 760 and page.locator('#panel-expand').get_attribute('aria-expanded') != 'true':
                press('#panel-expand')
        def caption(id, index=0):
            page.wait_for_function('([id,index])=>mcDebug.state.narrative.current?.id===id && mcDebug.state.narrative.current.index===index', arg=[id,index])
            page.locator('#narrator').wait_for(state='visible')
            page.wait_for_timeout(220)
            text = page.locator('#narrator p').inner_text()
            box = page.locator('#narrator p').bounding_box()
            assert box and box['x'] >= 0 and box['x']+box['width'] <= width+1
            assert box['y'] >= 0 and box['y']+box['height'] < 844
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
            page.screenshot(path=str(OUT/f'{id}-{index}-{engine}-{width}.png'))
            return text
        # Actual first purchase: collect, enter the shop, confirm the feature.
        page.evaluate('''() => {
            window.copyLog=[];
            new MutationObserver(()=>{
                const e=document.querySelector('#narrator p');
                if(e?.textContent && copyLog.at(-1)!==e.textContent)copyLog.push(e.textContent);
            }).observe(document.querySelector('#narrator'),{subtree:true,childList:true,characterData:true});
        }''')
        while page.evaluate('mcDebug.state.money < 10'):
            press('#mine')
        first = caption('rescue')
        assert first == '救命，商城来抓我了！'
        press('[data-nav=build]')
        expand()
        press('[data-buy-guidance=info]')
        press('#placement-confirm')
        intro = caption('companions')
        assert intro == '谢谢你救我，我来给你介绍两个朋友。'
        friend = caption('friend')
        assert '目标追踪' in friend
        assert page.evaluate('copyLog.includes("哈哈，重见天日了。")')
        assert page.evaluate('mcDebug.state.narrative.companionsShown')
        assert not page.evaluate('mcDebug.audio.canPlay()'), 'audio must stay gated by the jukebox'
        press('#panel-close')
        # Fixture only skips purchasing land/facilities; the UI and narrator run normally.
        page.evaluate('''async () => {
            const {fresh,buy}=await import('/src/game.js');
            const {NARRATION,IDLE_LINES}=await import('/src/narrative.js');
            const s=fresh();s.money=1000;s.guidance.info=true;s.narrative.companionsShown=true;
            s.narrative.seen=[...NARRATION,...IDLE_LINES].filter(r=>r.id!=='facility-upgrade').map(r=>r.id);
            for(const id of ['T1','V1','V18','V2']){const r=buy(s,id);if(!r.ok)throw Error(r.reason);}
            mcDebug.setState(s);
        }''')
        press('[data-nav=village]')
        press('[data-village-tab=construction]')
        press('[data-manage-item=V18]')
        expand()
        mailbox = caption('facility-upgrade', 1)
        assert '不少设施也能升级' in mailbox
        assert page.locator('[data-mail-tab]').count() > 0
        press('#panel-close')
        page.evaluate('''async () => {
            const {fresh,buy}=await import('/src/game.js');
            const {NARRATION,IDLE_LINES}=await import('/src/narrative.js');
            const s=fresh();s.money=1e5;s.guidance.info=true;s.narrative.companionsShown=true;s.play=200;
            s.narrative.seen=[...NARRATION,...IDLE_LINES].filter(r=>r.id!=='vacancy:farmer').map(r=>r.id);
            for(const id of ['T1','V1','V1','V18','V2','V4']){const r=buy(s,id);if(!r.ok)throw Error(r.reason);}
            mcDebug.setState(s);
        }''')
        press('[data-nav=village]')
        press('[data-village-tab=residents]')
        press('[data-roster-view=jobs]')
        expand()
        vacancy = caption('vacancy:farmer')
        assert '麦田' in vacancy and '农民' in vacancy
        press('[data-workplace-card=farmer] .workplace-entry [data-workplace]')
        press('[data-workplace-card=farmer] [data-job-assign]')
        page.wait_for_function('mcDebug.state.community.residents[0].job==="farmer" && mcDebug.state.narrative.current?.id!=="vacancy:farmer"')
        assert page.locator('[data-workplace-card=farmer] .workplace-entry [data-workplace]').is_hidden()
        page.evaluate('mcDebug.save()')
        page.reload(wait_until='networkidle')
        page.wait_for_function('!!window.mcDebug')
        assert page.evaluate('mcDebug.state.narrative.seen.includes("vacancy:farmer")')
        assert page.evaluate('mcDebug.state.community.residents[0].job==="farmer"')
        assert not errors, errors
        results.append({'engine': engine, 'width': width, 'opening': [first,intro,friend], 'mailbox': mailbox, 'vacancy': vacancy, 'actualAssignmentCancelledHint': True, 'reloadPreserved': True, 'noOverflow': True, 'errors': errors})
        (OUT/'results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
        print(json.dumps(results[-1],ensure_ascii=False),flush=True)
        context.close()
        browser.close()
