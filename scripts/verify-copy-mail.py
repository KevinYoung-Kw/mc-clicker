"""Copy/visual regression using disposable saves and real UI actions."""
import argparse, json, subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
KEY='mc-clicker-world-v2'

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--url',required=True)
    parser.add_argument('--label',required=True)
    parser.add_argument('--development',action='store_true')
    args=parser.parse_args()
    out=ROOT/'docs/qa'/('copy-mail-'+args.label)
    out.mkdir(parents=True,exist_ok=True)
    seed=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import{residentFixture}from'./scripts/resident-fixture.mjs';import{buy}from'./src/game.js';const s=residentFixture();for(const id of ['V18','X2'])if(!s.counts[id]){const r=buy(s,id);if(!r.ok)throw Error(r.reason)}console.log(JSON.stringify(s));"],cwd=ROOT,text=True))
    report={'url':args.url,'checks':[],'errors':[],'httpErrors':[]}
    with sync_playwright() as pw:
        browser=pw.chromium.launch(args=['--use-angle=metal'])
        try:
            for width,height in [(390,844),(1440,900)]:
                mobile=width<760
                ctx=browser.new_context(viewport={'width':width,'height':height},has_touch=mobile,is_mobile=mobile,device_scale_factor=1)
                ctx.add_init_script('localStorage.setItem('+json.dumps(KEY)+','+json.dumps(json.dumps(seed))+');')
                page=ctx.new_page()
                page.on('pageerror',lambda e:report['errors'].append(str(e)))
                page.on('response',lambda r:report['httpErrors'].append(r.url) if r.status>=400 else None)
                page.set_default_timeout(15000)
                page.goto(args.url,wait_until='networkidle')
                assert page.evaluate('!!window.mcDebug')==args.development
                def click(selector):
                    node=page.locator(selector).first
                    if mobile:node.tap()
                    else:node.click()
                def tool(selector):
                    if not page.locator(selector).is_visible():click('#hud-more')
                    click(selector)
                def shot(name):
                    page.locator('#panel').evaluate('e=>Promise.all(e.getAnimations().map(a=>a.finished.catch(()=>{})))')
                    page.screenshot(path=out/f'{width}-{name}.png')
                    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                    for p in page.locator('#panel:visible, #modal[open]').all():
                        assert p.evaluate('e=>e.scrollWidth<=e.clientWidth+1')
                click('[data-nav="build"]')
                if mobile:click('#panel-expand')
                assert page.locator('.panel-tools').count()==0
                shot('shop')
                click('[data-open="owned"]');click('[data-family="all"]');click('[data-detail="T1"]')
                assert page.locator('#panel-content').inner_text().count('每次采集 ×2。')==1
                click('[data-nav="village"]');shot('village')
                assert '今天，村庄也很忙。' not in page.locator('#panel').inner_text()
                click('[data-village-tab="residents"]');click('[data-person]');shot('resident')
                assert '基础收入' in page.locator('.resident-detail').inner_text()
                click('[data-nav="network"]');shot('industry')
                report['checks'].append(f'{width}: shop, owned details, village/resident and industry remain usable with one copy of descriptions')
                click('[data-nav="build"]');click('[data-open="owned"]');click('[data-family="all"]');click('[data-detail="V18"]')
                assert page.locator('.mail-inbox-note, .mail-inbox-footer').count()==0
                shot('inbox')
                click('[data-mail-tab="postal"]');shot('postal')
                assert page.locator('[data-postal-afford]').is_hidden()
                click('[data-mail-upgrade]');assert 'Lv.2' in page.locator('[data-postal-level]').inner_text()
                click('[data-mail-tab="letters"]');click('[data-mail-open="welcome-xiaohongshu"]')
                assert page.locator('.mail-reward-note').count()==0
                page.locator('.mail-letter-scroll').evaluate('e=>e.scrollTop=e.scrollHeight')
                page.wait_for_function('Array.from(document.querySelectorAll(".mail-letter img")).every(i=>i.complete&&i.naturalWidth)')
                shot('letter')
                click('[data-mail-claim]')
                receipt=page.evaluate('k=>JSON.parse(localStorage.getItem(k)).mail.letters["welcome-xiaohongshu"]',KEY)
                assert abs(receipt['reward']-receipt['claimedRate']*5)<.0001
                assert page.locator('[data-mail-claim]').is_disabled()
                report['checks'].append(f'{width}: clean inbox/postal/reader; upgrade and actual claim-rate × 5 reward work')
                click('#panel-close');tool('#info-open');shot('information')
                assert page.locator('#info-panel .save-note').count()==0
                click('#info-return');tool('#collection-open')
                page.locator('#collection-shop').wait_for()
                shot('collection')
                assert page.locator('.cs-selected-detail > p').first.is_hidden()
                assert page.locator('.cs-action-note').is_hidden()
                for cat in ['icon','cursor','frame','share','sky','world','title']:
                    click(f'[data-collection-tab="{cat}"]')
                    assert page.locator(f'[data-collection-tab="{cat}"]').get_attribute('aria-selected')=='true'
                    assert page.locator('.cs-choices').inner_text().strip()
                click('[data-preview="title-0"]');click('[data-extra-buy="title-0"]')
                assert page.title()=='橡木小镇 · MC Clicker 2.0'
                click('[data-extra-default="title"]')
                assert page.title()!='橡木小镇 · MC Clicker 2.0'
                report['checks'].append(f'{width}: information, seven collection categories, purchase and free reset stay usable without explanatory filler')
                click('#modal-close');tool('#share-open');page.locator('#share-panel').wait_for();shot('share')
                assert page.locator('#image-share-note').is_hidden()
                click('#generate-card');page.locator('#share-card-preview canvas').wait_for()
                with page.expect_download() as download:click('#download-card')
                assert Path(download.value.path()).stat().st_size>10000
                click('#copy-link');page.wait_for_function('document.querySelector("#toast")?.textContent.includes("链接")')
                shot('share-result')
                click('#share-return');assert not page.locator('#modal').is_visible()
                report['checks'].append(f'{width}: share preview, PNG download and link copy work; status feedback survives removal of static filler')
                ctx.close()
            assert not report['errors'],report['errors']
            assert not report['httpErrors'],report['httpErrors']
            report['passed']=True
        except Exception as e:
            report['passed']=False;report['failure']=str(e)
            page.screenshot(path=out/'failure.png')
            raise
        finally:
            (out/'observations.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
            browser.close()
    print(json.dumps({'passed':True,'checks':len(report['checks'])}))
if __name__=='__main__':main()
