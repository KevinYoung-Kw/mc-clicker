"""Isolated mobile sheet/reader regression; never uses the player's browser save."""
import argparse
import importlib.util
import json
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
KEY = 'mc-clicker-world-v2'
spec = importlib.util.spec_from_file_location('placement', ROOT/'scripts/verify-interiors-release.py')
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)

def touch_drag(page, client, selector, dy):
    r = page.locator(selector).bounding_box()
    x, y = r['x'] + r['width']/2, r['y'] + r['height']/2
    client.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':[{'x':x,'y':y,'id':0}]})
    for i in range(1,9):
        client.send('Input.dispatchTouchEvent', {'type':'touchMove','touchPoints':[{'x':x,'y':y+dy*i/8,'id':0}]})
        page.wait_for_timeout(20)
    client.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]})
    page.wait_for_timeout(350)

def no_overflow(page):
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    assert page.locator('#panel').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')

def expanded(page, height):
    page.locator("#panel").evaluate("e=>Promise.all(e.getAnimations().map(a=>a.finished.catch(()=>{})))")
    assert page.locator('#game').evaluate('(e)=>e.classList.contains("sheet-expanded")')
    panel = page.locator('#panel').bounding_box()
    hud = page.locator('.hud').bounding_box()
    assert abs(panel['y'] - hud['height']) <= 1, panel
    room = page.locator('body').evaluate('(e)=>e.classList.contains("live-page")')
    nav = page.locator('#room-tools' if room else '.hotbar')
    assert nav.is_visible()
    dock = nav.bounding_box()
    assert abs(panel['height'] + panel['y'] - dock['y']) <= 1, (panel, dock)
    assert abs(dock['y'] + dock['height'] - height) <= 1, dock
    assert dock['height'] >= 56
    assert page.locator('#stage').is_hidden()
    for button in nav.locator('button:visible').all():
        assert button.bounding_box()['height'] >= 44
        assert button.evaluate('''e=>{
          const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
        }'''), 'Expanded navigation is covered'
    assert page.locator('#panel-close').is_visible()

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--url', required=True)
    p.add_argument('--label', required=True)
    p.add_argument('--development', action='store_true')
    p.add_argument('--webkit', action='store_true')
    args = p.parse_args()
    out = ROOT/'docs/qa'/('refinement-'+args.label)
    out.mkdir(parents=True, exist_ok=True)
    seed = json.loads(subprocess.check_output(['node','--input-type=module','-e',
      "import{residentFixture}from'./scripts/resident-fixture.mjs';import{buy}from'./src/game.js';const s=residentFixture();if(!s.counts.V18){const r=buy(s,'V18');if(!r.ok)throw Error(r.reason)}s.reducedMotion=false;console.log(JSON.stringify(s));"], cwd=ROOT, text=True))
    report = {'url':args.url,'engine':'WebKit emulation' if args.webkit else 'Chromium touch','checks':[],'errors':[],'geometry':{}}
    with sync_playwright() as pw:
        browser = pw.webkit.launch() if args.webkit else pw.chromium.launch(args=['--use-angle=metal'])
        try:
            for width,height in [(320,640),(390,760),(390,480),(1440,900)]:
                mobile = width < 760
                context = browser.new_context(viewport={'width':width,'height':height},is_mobile=mobile,has_touch=mobile,device_scale_factor=1)
                context.add_init_script('localStorage.setItem('+json.dumps(KEY)+','+json.dumps(json.dumps(seed))+');')
                page = context.new_page()
                page.set_default_timeout(12000)
                page.on('pageerror',lambda e:report['errors'].append(str(e)))
                page.goto(args.url,wait_until='networkidle')
                page.wait_for_timeout(450)
                assert page.evaluate('!!window.mcDebug') == args.development
                click = lambda selector: page.locator(selector).first.tap() if mobile else page.locator(selector).first.click()
                if args.development:
                    free = page.evaluate('mcDebug.world.captureCamera()')
                click('[data-nav="build"]')
                page.wait_for_timeout(450)
                if mobile:
                    client = None if args.webkit else context.new_cdp_session(page)
                    if height >= 640:
                        assert page.locator('#panel').bounding_box()['y'] > 150
                        if client:
                            touch_drag(page,client,'.drawer-handle',-90)
                        else:
                            click('#panel-expand')
                            page.wait_for_timeout(350)
                    expanded(page,height)
                    no_overflow(page)
                    page.screenshot(path=out/f'{width}-{height}-shop.png')
                    # Content scroll must not collapse a sheet.
                    if client:
                        touch_drag(page,client,'#panel-content',-75)
                        expanded(page,height)
                    if client:
                        touch_drag(page,client,'.drawer-handle',85)
                    else:
                        click('#panel-expand')
                        page.wait_for_timeout(350)
                    assert page.locator('#stage').is_visible()
                    click('#panel-expand')
                    page.wait_for_timeout(350)
                    expanded(page,height)
                    report['checks'].append(f'{width}x{height}: expand, content scroll, collapse and tap re-expansion; compact navigation reserves its own space')
                    # Exercise real navigation, not only the existence of the dock.
                    for menu,title in [('village','村庄'),('network','工业'),('atlas','世界蓝图'),('build','商城')]:
                        click(f'[data-nav="{menu}"]')
                        page.wait_for_timeout(350)
                        expanded(page,height)
                        assert page.locator('#panel-title').inner_text() == title
                        assert page.locator(f'[data-nav="{menu}"]').evaluate('(e)=>e.classList.contains("active")')
                        no_overflow(page)
                    # Tapping the current section keeps it open and expanded.
                    click('[data-nav="build"]')
                    expanded(page,height)
                    report['checks'].append(f'{width}x{height}: switch village / industry / atlas / shop without collapsing or covering the dock')
                    click('[data-family="M"]')
                    click('[data-buy="M9"]')
                    page.wait_for_timeout(350)
                    assert page.locator('#stage').is_visible()
                    assert not page.locator('#game').evaluate('(e)=>e.classList.contains("sheet-expanded")')
                    assert page.locator('#panel-expand').is_disabled()
                    assert page.locator('#placement-cancel').is_visible()
                    assert page.locator('#placement-cancel').evaluate('''e=>{
                      const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
                    }'''), 'Site cancel is covered by navigation'
                    no_overflow(page)
                    page.screenshot(path=out/f'{width}-{height}-placement.png')
                    click('#placement-cancel')
                    assert page.locator('#panel').is_visible()
                    assert page.locator('#panel-expand').is_enabled()
                    click('#panel-close')
                    page.wait_for_timeout(450)
                    if args.development:
                        assert page.evaluate('mcDebug.world.captureCamera()') == free
                    report['checks'].append(f'{width}x{height}: expanded shopping reveals world for placement, cancel preserves shop, close restores free camera')
                    click('[data-nav="build"]')
                else:
                    assert page.locator('#panel-expand').is_hidden()
                    assert page.locator('#stage').is_visible()
                    assert page.locator('.site-link').bounding_box()['x'] < page.locator('.wallet').bounding_box()['x']
                    report['checks'].append('Desktop keeps side panel, camera and left-aligned site logo')
                click('[data-open="owned"]')
                click('[data-family="all"]')
                click('[data-detail="V18"]')
                page.wait_for_timeout(450)
                if mobile: expanded(page,height)
                no_overflow(page)
                click('[data-mail-open="welcome-wechat"]')
                page.wait_for_function('Array.from(document.querySelectorAll(".mail-letter img")).every(i=>i.complete&&i.naturalWidth>0)')
                page.wait_for_timeout(200)
                reader = page.locator('.mail-letter-scroll').bounding_box()
                body = page.locator('.mail-letter-body').bounding_box()
                dock = page.locator('.mail-reward-slot').bounding_box()
                report['geometry'][f'{width}x{height}'] = {'reader':reader,'body':body,'reward':dock}
                if mobile:
                    assert abs(reader['width']-width) < 2
                    assert body['width'] >= width-34
                    assert reader['height'] >= (130 if height<540 else 220), reader
                    assert page.locator('.mail-tabs').is_hidden()
                assert reader['y']+reader['height'] <= dock['y']+1
                assert page.locator('[data-mail-claim]').is_visible()
                if mobile:
                    assert dock['y'] + dock['height'] <= page.locator('.hotbar').bounding_box()['y'] + 1
                    assert page.locator('[data-mail-claim]').evaluate('''e=>{
                      const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
                    }'''), 'Mail reward is covered by navigation'
                    # Leave an unread reward, visit another system, then resume.
                    click('[data-nav="village"]')
                    expanded(page,height)
                    click('[data-nav="build"]')
                    click('[data-open="owned"]')
                    click('[data-family="all"]')
                    click('[data-detail="V18"]')
                    if page.locator('[data-mail-open="welcome-wechat"]').is_visible():
                        click('[data-mail-open="welcome-wechat"]')
                    assert not page.locator('[data-mail-claim]').is_disabled()
                assert page.locator('.mail-reward-actions [data-mail-back]').is_visible()
                page.screenshot(path=out/f'{width}-{height}-letter.png')
                page.locator('.mail-letter-scroll').evaluate('(e)=>e.scrollTop=260')
                page.screenshot(path=out/f'{width}-{height}-qr.png')
                click('.mail-reward-actions [data-mail-back]')
                click('[data-mail-tab="postal"]')
                click('[data-mail-upgrade]')
                assert 'Lv.2' in page.locator('[data-postal-level]').inner_text()
                click('[data-mail-tab="letters"]')
                click('[data-mail-open="welcome-wechat"]')
                click('[data-mail-claim]')
                assert page.locator('[data-mail-claim]').is_disabled()
                page.screenshot(path=out/f'{width}-{height}-claimed.png')
                report['checks'].append(f'{width}x{height}: readable mail, loaded QR, later collection, postal upgrade and one-time reward stay usable')
                if mobile:
                    click('[data-nav="build"]')
                    click('[data-open="owned"]')
                    click('[data-family="all"]')
                    click('[data-detail="L2"]')
                    page.wait_for_timeout(800)
                    click('[data-room-tab="program"]')
                    if not page.locator('#game').evaluate('(e)=>e.classList.contains("sheet-expanded")'):
                        click('#panel-expand')
                    page.wait_for_timeout(350)
                    for tab in ['equipment','arrange','decor','program']:
                        click(f'[data-room-tab="{tab}"]')
                        page.wait_for_timeout(350)
                        expanded(page,height)
                        assert page.locator(f'[data-room-tab="{tab}"]').evaluate('(e)=>e.classList.contains("active")')
                        assert page.locator('#panel-content').inner_text().strip()
                        assert page.locator('.hotbar').is_hidden()
                        assert page.locator('#panel-world-back').is_visible()
                        no_overflow(page)
                    click('#room-gifts')
                    expanded(page,height)
                    assert '收礼台' in page.locator('#panel-content').inner_text()
                    click('[data-room-tab="program"]')
                    expanded(page,height)
                    page.screenshot(path=out/f'{width}-{height}-room-navigation.png')
                    click('#panel-world-back')
                    page.wait_for_timeout(450)
                    assert page.locator('#panel').is_hidden()
                    assert page.locator('#stage').is_visible()
                    assert page.locator('.hotbar').is_visible()
                    assert page.locator('#room-tools').is_hidden()
                    if args.development:
                        assert page.evaluate('mcDebug.world.captureCamera()') == free
                    report['checks'].append(f'{width}x{height}: expanded studio switches all four sections and returns directly to world with camera preserved')
                context.close()
            # Navigation still grows with the save; expansion must not expose locked systems.
            context = browser.new_context(viewport={'width':390,'height':760},is_mobile=True,has_touch=True)
            page = context.new_page()
            page.goto(args.url,wait_until='networkidle')
            page.locator('[data-nav="build"]').tap()
            page.locator('#panel-expand').tap()
            page.wait_for_timeout(350)
            expanded(page,760)
            assert page.locator('[data-nav]:visible').count() == 1
            assert page.locator('#panel-world-back').is_hidden()
            page.screenshot(path=out/'new-game-navigation.png')
            context.close()
            report['checks'].append('Fresh save exposes only unlocked shop; no studio return button outside the room')
            assert not report['errors'],report['errors']
            report['passed'] = True
        except Exception as e:
            report['passed'] = False
            report['failure'] = str(e)
            if 'page' in locals(): page.screenshot(path=out/'failure.png')
            raise
        finally:
            (out/'observations.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
            browser.close()
    print(json.dumps({'passed':True,'checks':len(report['checks'])}))

if __name__ == '__main__': main()
