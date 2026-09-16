"""Isolated midgame fixtures; actual management controls and shared narrator UI."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parents[1] / 'docs/v1.5.5/qa/browser'
OUT.mkdir(parents=True, exist_ok=True)
results = []
with sync_playwright() as p:
    for engine, width in [('chromium', 1440), ('webkit', 390), ('chromium', 320)]:
        browser = getattr(p, engine).launch(headless=True, **({'args': ['--use-angle=metal']} if engine == 'chromium' else {}))
        context = browser.new_context(viewport={'width': width, 'height': 900 if width > 760 else 844}, is_mobile=width < 760, has_touch=width < 760)
        page = context.new_page()
        page.set_default_timeout(25000)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto('http://127.0.0.1:8890/', wait_until='networkidle')
        page.wait_for_function('!!window.mcDebug')
        def press(selector):
            button = page.locator(selector).first
            button.tap() if width < 760 else button.click()
        def seed(keep):
            page.evaluate('''async keep => {
                const {fresh} = await import('/src/game.js');
                const {NARRATION,IDLE_LINES} = await import('/src/narrative.js');
                const s = fresh(); s.money=1e7; s.play=1100;
                s.guidance.info=true; s.guidance.goals=true; s.narrative.companionsShown=true;
                s.narrative.seen=[...NARRATION,...IDLE_LINES].map(r=>r.id).filter(id=>id!==keep);
                Object.assign(s.counts,{T1:1,T2:1,T3:1,T7:1,V1:4,V2:2,V3:1,V18:1,V4:1,M1:1,M2:1,M3:1,M4:1,M5:1,M6:1,M8:1,M10:1,M14:1,L1:1,L2:1,L4:1});
                s.chunks.overworld=[{x:0,z:0},{x:1,z:0},{x:0,z:1},{x:1,z:1}];
                mcDebug.setState(s);
            }''', keep)
        def expand():
            if width < 760 and page.locator('#panel-expand').is_visible() and page.locator('#panel-expand').get_attribute('aria-expanded') != 'true':
                press('#panel-expand')
        def caption(id, index=0):
            page.wait_for_function('([id,index])=>mcDebug.state.narrative.current?.id===id && mcDebug.state.narrative.current.index===index', arg=[id,index])
            page.locator('#narrator').wait_for(state='visible')
            page.wait_for_timeout(250)  # Let the existing caption fade-in finish.
            box = page.locator('#narrator p').bounding_box()
            assert box and box['x'] >= 0 and box['x']+box['width'] <= width+1
            assert box['y'] >= 0 and box['y']+box['height'] < page.viewport_size['height']
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
            page.screenshot(path=str(OUT / f'{id}-{engine}-{width}.png'))
            return page.locator('#narrator p').inner_text()

        seed('actuator-job')
        press('[data-nav=network]'); press('[data-industry-tab=automation]'); expand()
        target='[data-actuator=farm][data-delta="1"]'
        page.locator(target).focus()
        first=caption('actuator-job', 1)
        assert '自动化' in first
        assert page.locator(target).evaluate('el=>el===document.activeElement'), 'narration stole focus'
        press(target)
        page.wait_for_function('mcDebug.state.grid.automation.farm===1 && mcDebug.state.narrative.current?.id!=="actuator-job"')
        assert page.locator('#panel').is_visible()
        press('#panel-close')

        seed('studio-vacancy')
        page.evaluate('mcDebug.go("live")')
        expand()
        second=caption('studio-vacancy')
        assert '主持席' in second
        # Switch to the same workplace assignment used by the room's staff link.
        page.evaluate('mcDebug.go("village")')
        press('[data-village-tab=residents]')
        # The paid equipment and available job are real; assign through the model,
        # since selecting candidates is independently covered by workplace tests.
        page.evaluate('''async()=>{
            const {assignJob}=await import('/src/residents.js');
            const result=assignJob(mcDebug.state,mcDebug.state.community.residents[0].id,'host');
            if(!result.ok)throw Error(result.reason);
        }''')
        page.wait_for_function('mcDebug.state.narrative.current?.id!=="studio-vacancy"')
        page.evaluate('mcDebug.save()')
        page.reload(wait_until='networkidle'); page.wait_for_function('!!window.mcDebug')
        assert page.evaluate('mcDebug.state.narrative.seen.includes("studio-vacancy")')
        assert page.evaluate('mcDebug.state.counts.V18===1 && Object.keys(mcDebug.state.mail.letters).length===3')
        assert not errors, errors
        results.append({'engine': engine, 'width': width, 'actuator': first, 'host': second, 'focusPreserved': True, 'assignmentCancelledAdvice': True, 'mailRetained': True, 'errors': errors})
        print(json.dumps(results[-1], ensure_ascii=False), flush=True)
        browser.close()
(OUT / 'results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2)+'\n')
