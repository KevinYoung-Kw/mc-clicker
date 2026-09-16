"""Current feedback audit: money units, housing access and mobile panel lifecycle.
Uses isolated saves; browser engines do not certify physical phone performance.
"""
import argparse, json, re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--baseline', action='store_true')
args = parser.parse_args()
OUT = ROOT / 'docs/v1.7/qa/alpha3-feedback' / ('baseline' if args.baseline else 'fixed')
OUT.mkdir(parents=True, exist_ok=True)
seed = json.loads((ROOT / 'docs/v1.6/qa/stability-baseline/fixtures/peak.json').read_text())
seed.update(money=2e12, reducedMotion=True, savedAt=1)
seed['guidance']['notices'] = False
reports = []
with sync_playwright() as p:
    for engine, width in ([('chromium',1440)] if args.baseline else [('chromium',1440),('webkit',390),('chromium',320)]):
        mobile = width < 760
        browser = getattr(p,engine).launch(headless=True, **({'args':['--use-angle=metal']} if engine=='chromium' else {}))
        context = browser.new_context(viewport={'width':width,'height':844}, is_mobile=mobile, has_touch=mobile)
        page = context.new_page(); errors = []; page.on('pageerror',lambda error:errors.append(str(error)))
        page.goto('http://127.0.0.1:8890/',wait_until='networkidle');page.wait_for_function('!!window.mcDebug?.world')
        page.evaluate('s=>mcDebug.setState(s)',seed)
        def press(selector):
            node = page.locator(selector).first
            node.tap() if mobile else node.click()
        def fit():
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1')
            assert page.locator('#panel-content').evaluate('e=>e.scrollWidth <= e.clientWidth+1')
        press('#mine')
        money = {'collect':page.locator('#click-value').inner_text(), 'floating':page.locator('#gains .gain').last.inner_text()}
        press('#income-open')
        # Inject receipts only for rendering; real income conservation has separate tests.
        money.update(page.evaluate('''async()=>{
          const {beginIncome,recordIncome,finishIncome}=await import('/src/income.js');
          const {createGuidanceUI}=await import('/src/guidance-ui.js');
          const s=mcDebug.state;window.dispatchEvent(new Event('blur'));
          beginIncome(s);recordIncome(s,2e9,'production');recordIncome(s,1e9,'base');recordIncome(s,1e9,'mail');finishIncome(s,1,4e9);
          createGuidanceUI({state:()=>s,active:()=>true}).refresh(document.querySelector('#modal'));
          return {total:document.querySelector('[data-income-total]').textContent,
            source:document.querySelector('[data-income-source="production"] dd').textContent,
            bonus:document.querySelector('[data-income-bonus]').textContent};
        }'''))
        page.screenshot(path=str(OUT/f'{engine}-{width}-income.png'))
        if not args.baseline:
            assert all(not re.search('[万亿京]',text) for text in money.values()),money
            assert money['total']=='4.000B /秒' and money['source']=='2.000B /秒' and money['bonus']=='1.000B /秒',money
        press('#modal-close')
        page.evaluate('window.dispatchEvent(new Event("focus"))')
        press('[data-nav="village"]');press('[data-village-tab="housing"]')
        assert page.locator('[data-home-locate]').count()>0
        assert page.locator('[data-home-move]').count()>0
        press('[data-home-move]');assert page.locator('#placement-cancel').is_visible();press('#placement-cancel')
        press('#panel-close')
        # Existing one-click purchase preference is a real persistent setting.
        if not page.locator('#settings').is_visible():press('#hud-more')
        press('#settings');press('#skip-purchase-confirmation-setting')
        enabled=page.locator('#skip-purchase-confirmation-setting').is_checked()
        assert page.evaluate('mcDebug.state.skipPurchaseConfirmation')==enabled
        press('#modal-close');page.evaluate('mcDebug.save()');page.reload(wait_until='networkidle');page.wait_for_function('!!window.mcDebug?.world')
        assert page.evaluate('mcDebug.state.skipPurchaseConfirmation')==enabled
        panels=[]
        if mobile:
            cdp=context.new_cdp_session(page) if engine=='chromium' else None
            def swipe():
                box=page.locator('.drawer-handle').bounding_box();x=box['x']+box['width']/2;y=box['y']+box['height']/2
                if cdp:
                    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
                    for step in range(1,9):
                        cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x,'y':y+step*10}]})
                    cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
                else:
                    page.mouse.move(x,y);page.mouse.down();page.mouse.move(x,y+80,steps=8);page.mouse.up()
                page.wait_for_timeout(150)
            for panel in ['build','village','network']:
                press(f'[data-nav="{panel}"]')
                if page.locator('#panel-expand').get_attribute('aria-expanded')!='true':press('#panel-expand')
                page.evaluate('window.dispatchEvent(new Event("focus"))');page.wait_for_timeout(950)
                assert page.locator('#panel-notice-slot').is_hidden(),panel+' retained empty notice space'
                fit();swipe()
                assert page.locator('#panel').is_visible() and page.locator('#panel-expand').get_attribute('aria-expanded')=='false'
                swipe();assert page.locator('#panel').is_hidden()
                assert not page.locator('#stage').evaluate('e=>e.inert')
                assert page.locator('#world canvas').is_visible()
                panels.append(panel)
        fit()
        assert not errors,errors
        reports.append({'engine':engine,'width':width,'money':money,'housingMove':True,'purchasePreferenceSaved':True,'mobilePanels':panels,'errors':errors})
        print(engine,width,'passed',flush=True)
        context.close();browser.close()
(OUT/'report.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2)+'\n')
