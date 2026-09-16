"""V1.5.1: isolated browser saves, real UI purchases and foreground event handlers."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
import time

OUT = Path(__file__).resolve().parents[1] / 'docs/v1.5.1/qa/browser'
OUT.mkdir(parents=True, exist_ok=True)
reports = []
with sync_playwright() as p:
    for engine, width in [('chromium', 1440), ('webkit', 390), ('chromium', 320)]:
        browser = getattr(p, engine).launch(headless=True, **({'args': ['--use-angle=metal']} if engine == 'chromium' else {}))
        context = browser.new_context(viewport={'width': width, 'height': 844}, is_mobile=width<760, has_touch=width<760)
        page = context.new_page()
        page.set_default_timeout(22000)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto('http://127.0.0.1:8890/', wait_until='networkidle')
        page.wait_for_function('!!window.mcDebug')
        # Inspect first, so this runner also detects missing/renamed entry points.
        assert page.locator('[data-nav=build]').is_visible()

        def press(selector):
            loc = page.locator(selector).first
            loc.tap() if width<760 else loc.click()

        def expand():
            if width<760 and not page.locator('#game').evaluate('e=>e.classList.contains("sheet-expanded")'):
                press('#panel-expand')

        def caption(id):
            page.wait_for_function('(id)=>mcDebug.state.narrative.current?.id===id && !document.querySelector("#narrator").hidden', arg=id)

        def shot(name):
            # The sheet animates independently of the caption. Measure its
            # settled layout, rather than two different animation frames.
            page.wait_for_timeout(450)
            page.screenshot(path=str(OUT / f'{name}-{engine}-{width}.png'))
            text = page.locator('#narrator p')
            assert text.evaluate('e=>parseFloat(getComputedStyle(e).fontSize)') >= 14
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
            if width<760 and page.locator('#game').evaluate('e=>e.classList.contains("sheet-expanded")'):
                notice = page.locator('#notification-shell').bounding_box()
                content = page.locator('#panel-content').bounding_box()
                assert notice['y'] + notice['height'] <= content['y'] + 1, (notice, content)

        page.evaluate('mcDebug.state.money=100;mcDebug.advance(0)')
        press('[data-nav=build]'); expand()
        press('[data-buy-guidance=info]'); press('#placement-confirm')
        start = time.monotonic()
        caption('rescued'); rescued = time.monotonic()-start
        caption('friend'); friend = time.monotonic()-start
        assert rescued<6 and friend<12, (rescued, friend)
        press('[data-buy-guidance=goals]'); press('#placement-confirm')
        page.wait_for_timeout(300)
        assert page.evaluate('mcDebug.state.narrative.current?.id!=="friend"')
        press('[data-buy=T1]'); press('#placement-confirm')
        caption('pick-use'); shot('wooden-pick')
        assert '按住' in page.locator('#narrator').inner_text()

        # Real rapid purchases of three tools no longer produce an old-hand comment.
        press('#panel-close')
        page.evaluate('''async()=>{
          const {fresh,buy}=await import('/src/game.js');
          const {NARRATION,IDLE_LINES}=await import('/src/narrative.js');
          const s=fresh();s.money=1e6;s.guidance.info=true;s.guidance.goals=true;
          for(const id of ['T1','V1','V18','V2','T7'])buy(s,id);
          s.counts.M2=1;s.narrative.seen=[...NARRATION,...IDLE_LINES].filter(r=>r.id!=='rush').map(r=>r.id);
          mcDebug.setState(s);
        }''')
        press('[data-nav=build]'); expand(); press('[data-family=T]')
        for item in ['T2','T3','T4']:
            press(f'[data-buy={item}]'); press('#placement-confirm')
        assert page.evaluate('mcDebug.state.narrative.behavior.purchases.filter(r=>r.first).length') == 3
        assert page.evaluate('mcDebug.state.narrative.behavior.rushUntil===0')
        press('#panel-close')

        def seed(keep):
            page.evaluate('''async(keep)=>{
              const {fresh,buy}=await import('/src/game.js');
              const {NARRATION,IDLE_LINES}=await import('/src/narrative.js');
              const s=fresh();s.money=1e6;s.guidance.info=true;s.guidance.goals=true;
              for(const id of ['T1','V1','V18','V2','T7','T2','V1','V1','M4','M1','M5','V4']){
                const result=buy(s,id);if(!result.ok)throw new Error(`${id}: ${result.reason}`);
              }
              s.narrative.seen=[...NARRATION,...IDLE_LINES].filter(r=>!keep.includes(r.id)).map(r=>r.id);
              mcDebug.setState(s);
            }''', keep)

        seed(['power-use'])
        press('[data-nav=network]'); expand(); press('[data-industry-tab=power]')
        caption('power-use'); shot('power-help')
        assert '控制台' in page.locator('#narrator').inner_text()
        page.wait_for_function('mcDebug.state.narrative.current?.id==="power-use" && mcDebug.state.narrative.current.index===1')
        shot('power-connect')
        press('#panel-close')

        seed(['haul-use'])
        press('[data-nav=network]'); expand(); press('[data-industry-tab=logistics]')
        caption('haul-use'); shot('logistics-help')
        page.wait_for_function('mcDebug.state.narrative.current?.id==="haul-use" && mcDebug.state.narrative.current.index===1')
        shot('logistics-action')
        assert '安排搬运' in page.locator('#panel-content').inner_text()
        press('#panel-close')

        seed(['farm-work'])
        press('[data-nav=village]'); expand()
        caption('farm-work'); shot('village-help')
        press('#panel-close')

        seed(['foreground-return'])
        page.wait_for_function('mcDebug.state.rate>0')
        page.evaluate('window.dispatchEvent(new Event("blur"))')
        before = page.evaluate('({money:mcDebug.state.money,play:mcDebug.state.play,total:mcDebug.state.total})')
        page.wait_for_timeout(13000)
        after = page.evaluate('({money:mcDebug.state.money,play:mcDebug.state.play,total:mcDebug.state.total})')
        assert before == after, (before, after)
        assert page.locator('#notification-shell').get_attribute('data-kind') == 'pause'
        page.evaluate('window.dispatchEvent(new Event("focus"))')
        caption('foreground-return'); shot('return')
        page.wait_for_function('mcDebug.state.narrative.current?.id==="foreground-return" && mcDebug.state.narrative.current.index===2')
        shot('foreground-rule')
        assert '后台就暂停赚钱' in page.locator('#narrator').inner_text()
        page.wait_for_function('mcDebug.state.narrative.seen.includes("foreground-return")')
        page.evaluate('mcDebug.save()')
        page.reload(wait_until='networkidle'); page.wait_for_function('!!window.mcDebug')
        assert page.evaluate('mcDebug.state.narrative.seen.includes("foreground-return") && mcDebug.state.narrative.returnAt===null')
        assert not errors, errors
        result={'engine':engine,'width':width,'openingSeconds':{'rescued':round(rescued,2),'friend':round(friend,2)},
                'checks':['real info/goals/pick purchases','three tool purchases do not imply experience','industrial and village help in expanded sheets','14px subtitles fit reserved space','13s blur keeps money/total/play unchanged','foreground return explains once and persists across reload'], 'errors':errors}
        reports.append(result)
        (OUT/'results.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2)+'\n')
        print(json.dumps(result,ensure_ascii=False),flush=True)
        context.close(); browser.close()
