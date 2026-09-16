"""Check the revised three-line aside in the actual subtitle strip, including reload.

The saved fixture starts after a rail event; event eligibility is covered by the
narrative tests. Each line advances through the normal foreground narrator clock.
"""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parents[1] / 'docs/v1.5.5/qa/copy-round-two'
OUT.mkdir(parents=True, exist_ok=True)
results = []
with sync_playwright() as p:
    for engine, width in [('chromium', 1440), ('webkit', 390), ('chromium', 320)]:
        browser = getattr(p, engine).launch(headless=True, **({'args': ['--use-angle=metal']} if engine == 'chromium' else {}))
        context = browser.new_context(viewport={'width': width, 'height': 844}, is_mobile=width < 760, has_touch=width < 760)
        page = context.new_page()
        page.set_default_timeout(20000)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto('http://127.0.0.1:8890/', wait_until='networkidle')
        page.wait_for_function('!!window.mcDebug')
        expected = page.evaluate('''async () => {
            const {fresh}=await import('/src/game.js');
            const {NARRATION,IDLE_LINES}=await import('/src/narrative.js');
            const {NARRATOR_COPY}=await import('/src/narrator-copy.js');
            const s=fresh();s.play=1200;s.guidance.info=true;s.narrative.companionsShown=true;
            s.narrative.seen=[...NARRATION,...IDLE_LINES].filter(r=>r.id!=='rail-cargo').map(r=>r.id);
            s.narrative.current={id:'rail-cargo',index:0,elapsed:0};
            mcDebug.setState(s);
            return NARRATOR_COPY['rail-cargo'].lines;
        }''')
        spoken = []
        for index, line in enumerate(expected):
            page.wait_for_function('(i)=>mcDebug.state.narrative.current?.id==="rail-cargo" && mcDebug.state.narrative.current.index===i', arg=index)
            if index == 1:
                page.evaluate('mcDebug.save()')
                page.reload(wait_until='networkidle')
                page.wait_for_function('!!window.mcDebug')
                assert page.evaluate('mcDebug.state.narrative.current?.index') == 1
            text = page.locator('#narrator p')
            text.wait_for(state='visible')
            page.wait_for_function('(line)=>document.querySelector("#narrator p")?.textContent===line', arg=line)
            page.wait_for_timeout(250)
            assert text.inner_text() == line
            assert text.evaluate('e=>e.scrollHeight<=e.clientHeight+1 && e.scrollWidth<=e.clientWidth+1'), 'subtitle clipped'
            box = text.bounding_box()
            assert box and box['x'] >= 0 and box['x']+box['width'] <= width+1
            assert box['y'] >= 0 and box['y']+box['height'] < 844
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
            page.screenshot(path=str(OUT/f'rail-{index}-{engine}-{width}.png'))
            spoken.append(line)
        page.wait_for_function('mcDebug.state.narrative.seen.includes("rail-cargo")')
        assert page.evaluate('mcDebug.state.narrative.history.filter(h=>h.id==="rail-cargo").length') == 1
        assert page.evaluate('mcDebug.state.money') == 0, 'speaking must not award money'
        assert not errors, errors
        results.append({'engine': engine, 'width': width, 'spoken': spoken, 'resumedSecondLine': True, 'historyOnce': True, 'noClipping': True, 'errors': errors})
        print(json.dumps(results[-1], ensure_ascii=False), flush=True)
        browser.close()
(OUT/'results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2)+'\n')
