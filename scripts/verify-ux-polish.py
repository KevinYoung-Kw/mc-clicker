"""Verify rotation hint layout and the 50-emerald sharing unlock through real UI.

Accepts either Vite or a production URL. Fixture storage lives only in isolated
browser contexts. Foreground income is paused for exact wallet assertions;
actual rotation gestures are separately exercised with the page active.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import subprocess
import sys
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs' / 'qa'
SAVE_KEY = 'mc-clicker-world-v2'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:8890/')
parser.add_argument('--label', default='dev')
args = parser.parse_args()
assert args.label.replace('-', '').isalnum()
prefix = f'ux-polish-{args.label}'
OUT.mkdir(exist_ok=True)

code = """
import {fresh,buy,sites,frontier} from './src/game.js';
import {buyEarlyGuidance} from './scripts/early-fixture.mjs';
const s=fresh(0);s.money=1e6;s.reducedMotion=true;
buyEarlyGuidance(s);
for(const id of ['V2','V3']){
 let choice=sites(s,'overworld',null,id)[0];
 while(!choice){const r=buy(s,'V1',{...frontier(s)[0],realm:'overworld'});if(!r.ok)throw Error(r.reason);choice=sites(s,'overworld',null,id)[0]}
 const r=buy(s,id,choice);if(!r.ok)throw Error(r.reason);
}
const empty=fresh(0);empty.reducedMotion=true;
console.log(JSON.stringify({market:s,empty}));
"""
payload = json.loads(subprocess.run(['node','--input-type=module','--eval',code],cwd=ROOT,check=True,text=True,capture_output=True).stdout)
report = {'url':args.url,'checks':{},'layouts':{},'gestures':{},'wallets':{},'errors':[],'failedRequests':[]}
PAUSE = """window.__uxPause=true;
const uxNativeFocus=document.hasFocus.bind(document);
Object.defineProperty(document,'hasFocus',{configurable:true,value:()=>!window.__uxPause&&uxNativeFocus()});
"""

def saved(page):
    page.evaluate("window.dispatchEvent(new Event('blur'))")
    return page.evaluate('key=>JSON.parse(localStorage.getItem(key))',SAVE_KEY)

def tap(page, selector):
    node=page.locator(selector).first
    node.wait_for(state='visible')
    if page.evaluate('navigator.maxTouchPoints>0'):
        node.tap()
    else:
        node.click()

def market(page):
    tap(page,'[data-nav="village"]')
    tap(page,'[data-village-tab="market"]')

def price(text):
    assert '50' in text and '1,200' not in text and '1200' not in text,text

def progress(s):
    return {key:s[key] for key in ['counts','placements','studio','collection']}

def screenshot(page,name):
    # Pausing before load protects boundary-wallet tests, but also prevents the
    # world's first frame. Draw only after monetary assertions are complete.
    page.evaluate('''async()=>{
      if(window.mcDebug?.world){mcDebug.world.update(true);return}
      window.__uxPause=false;window.dispatchEvent(new Event('focus'));
      await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
      window.__uxPause=true;window.dispatchEvent(new Event('blur'));
    }''')
    page.screenshot(path=str(OUT/f'{prefix}-{name}.png'))

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--use-angle=metal'] if sys.platform=='darwin' else [])
    contexts=[]
    def context(state,width=390,height=844,touch=True):
        ctx=browser.new_context(viewport={'width':width,'height':height},has_touch=touch,is_mobile=touch,device_scale_factor=1)
        contexts.append(ctx)
        ctx.add_init_script(PAUSE)
        ctx.add_init_script("if(!sessionStorage.getItem('ux-polish-seeded')){"+f"localStorage.setItem({json.dumps(SAVE_KEY)},{json.dumps(json.dumps(state))});"+"sessionStorage.setItem('ux-polish-seeded','1');}")
        page=ctx.new_page()
        page.on('pageerror',lambda e:report['errors'].append(str(e)))
        page.on('response',lambda r:report['failedRequests'].append({'url':r.url,'status':r.status}) if r.status>=400 else None)
        page.goto(args.url,wait_until='networkidle')
        page.locator('#mine').wait_for()
        tap(page,'[data-nav="world"]')
        page.wait_for_timeout(350)
        return ctx,page

    try:
        # One existing bottom line, still gated by the purchased info ability.
        ctx,page=context(payload['empty'])
        assert not page.locator('.gesture-hint').is_visible()
        assert not page.locator('#info-open').is_visible()
        report['checks']['unboughtInfoKeepsHintAndInfoEntryHidden']=True
        ctx.close()

        for name,w,h,touch in [('desktop',1440,960,False),('phone',390,844,True),('small-phone',320,720,True),('short-desktop',1100,480,False)]:
            s=json.loads(json.dumps(payload['market']));s['money']=50
            ctx,page=context(s,w,h,touch)
            hint=page.locator('.gesture-hint')
            assert hint.is_visible(),name+' rotation hint hidden'
            assert '双指 / 右键拖动旋转视角' in hint.inner_text()
            layout=page.evaluate('''()=>{
              const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}};
              const hint=rect('.gesture-hint'),mine=rect('#mine'),nav=rect('.hotbar');
              const overlap=(a,b)=>a.x<b.right&&a.right>b.x&&a.y<b.bottom&&a.bottom>b.y;
              return {hint,mine,nav,text:document.querySelector('.gesture-hint').textContent,
                clauses:[...document.querySelectorAll('.gesture-hint > span')].map(s=>({text:s.textContent,lines:s.getClientRects().length,whiteSpace:getComputedStyle(s).whiteSpace})),
                overflow:document.documentElement.scrollWidth>innerWidth,
                inViewport:hint.x>=0&&hint.right<=innerWidth&&hint.y>=0&&hint.bottom<=innerHeight,
                overlapsMine:overlap(hint,mine),overlapsNavigation:overlap(hint,nav)};
            }''')
            assert not layout['overflow'] and layout['inViewport'] and not layout['overlapsMine'] and not layout['overlapsNavigation'],(name,layout)
            assert len(layout['clauses'])==4 and all(c['whiteSpace']=='nowrap' and c['lines']==1 for c in layout['clauses']),layout
            report['layouts'][name]=layout
            screenshot(page,f'{name}-hint')
            # The original notification preference still controls this line.
            tap(page,'#info-open')
            page.locator('#guidance-notices').uncheck()
            tap(page,'#info-return')
            assert not hint.is_visible()
            tap(page,'#info-open')
            page.locator('#guidance-notices').check()
            tap(page,'#info-return')
            assert hint.is_visible()
            ctx.close()
        report['checks']['hintWrapsAt320And390WithoutCoveringMineOrNavigation']=True
        report['checks']['paidInfoPreferenceStillHidesAndRestoresHint']=True

        # Price boundary is verified while production is paused, using touch.
        for amount in [49,50]:
            s=json.loads(json.dumps(payload['market']));s['money']=amount
            ctx,page=context(s)
            assert not page.locator('#share-open').is_visible()
            market(page)
            offer=page.locator('[data-unlock-sharing]')
            price(offer.inner_text())
            if amount==49:
                assert offer.is_disabled()
                assert saved(page)['money']==49
                report['checks']['49EmeraldsCannotUnlockSharing']=True
                screenshot(page,'share-49')
                ctx.close()
                continue
            assert offer.is_enabled()
            before=saved(page)
            tap(page,'[data-unlock-sharing]')
            page.locator('#placement-bar').wait_for(state='visible')
            price(page.locator('#placement-confirm').inner_text())
            assert saved(page)['money']==50 and not saved(page)['sharing']['unlocked']
            tap(page,'#placement-cancel')
            cancelled=saved(page)
            assert cancelled['money']==50 and cancelled['sharing']==before['sharing']
            assert progress(cancelled)==progress(before)
            tap(page,'[data-unlock-sharing]')
            tap(page,'#placement-confirm')
            page.locator('#share-panel').wait_for(state='visible')
            paid=saved(page)
            assert paid['money']==0 and paid['sharing']['unlocked'] is True
            assert progress(paid)==progress(before)
            assert page.locator('#share-open').is_visible()
            assert page.locator('#share-card-preview canvas').count()==0
            tap(page,'#modal-close')
            market(page)
            assert page.locator('[data-unlock-sharing]').count()==0
            tap(page,'[data-open-share]')
            page.locator('#share-panel').wait_for(state='visible')
            assert saved(page)['money']==0
            tap(page,'#modal-close')
            page.reload(wait_until='networkidle')
            assert saved(page)['money']==0 and saved(page)['sharing']==paid['sharing']
            assert page.locator('#share-open').is_visible()
            report['wallets']['firstUnlock']={'before':before['money'],'cancelled':cancelled['money'],'after':paid['money'],'afterReload':saved(page)['money']}
            report['checks']['50EnablesConfirmationCancelIsFreeAndPurchaseDebitsExactly50Once']=True
            report['checks']['shareOwnershipPersistsWithoutRepeatOffer']=True
            screenshot(page,'share-unlocked')
            ctx.close()

        s=json.loads(json.dumps(payload['market']));s['money']=700;s['sharing']={'unlocked':True,'unlockedAt':100}
        ctx,page=context(s,1440,960,False)
        assert page.locator('#share-open').is_visible()
        market(page)
        assert page.locator('[data-unlock-sharing]').count()==0
        tap(page,'[data-open-share]')
        page.locator('#share-panel').wait_for(state='visible')
        assert saved(page)['money']==700 and saved(page)['sharing']['unlockedAt']==100
        report['checks']['OldPurchasedShareRemainsUsableWithoutAnotherCharge']=True
        ctx.close()

        # The ending can reach the locked share panel directly: its offer must
        # also show 50, not a stale hard-coded price.
        ending=json.loads((ROOT/'tests/fixtures/layout-v2.json').read_text())
        ending['money']=50;ending['sharing']={'unlocked':False,'unlockedAt':0}
        ending['guidance']={'version':1,'goals':True,'info':True,'collapsed':False,'notices':True}
        ctx,page=context(ending,1440,960,False)
        # Goal notch intentionally appears only while the game is foreground.
        page.evaluate("window.__uxPause=false;window.dispatchEvent(new Event('focus'))")
        tap(page,'#mission-link')
        page.locator('#share-panel').wait_for(state='visible')
        price(page.locator('#unlock-sharing').inner_text())
        assert page.locator('#unlock-sharing').is_enabled()
        report['checks']['EndingSharePanelAlsoOffers50']=True
        ctx.close()

        for kind,touch in [('right-mouse',False),('two-finger',True)]:
            ctx,page=context(payload['market'],390 if touch else 1440,844 if touch else 960,touch)
            page.evaluate("window.__uxPause=false;window.dispatchEvent(new Event('focus'))")
            page.wait_for_timeout(200)
            canvas=page.locator('#world canvas')
            bounds=canvas.bounding_box()
            before=page.evaluate('window.mcDebug?.world?.yaw ?? null')
            image_before=hashlib.sha256(canvas.screenshot()).hexdigest()
            cx=bounds['x']+bounds['width']*.5;cy=bounds['y']+bounds['height']*.3
            if not touch:
                page.mouse.move(cx-70,cy)
                page.mouse.down(button='right')
                page.mouse.move(cx+70,cy+15,steps=12)
                page.mouse.up(button='right')
            else:
                cdp=ctx.new_cdp_session(page)
                points=lambda angle:[{'id':1,'x':cx-50*math.cos(angle),'y':cy-50*math.sin(angle),'radiusX':4,'radiusY':4},{'id':2,'x':cx+50*math.cos(angle),'y':cy+50*math.sin(angle),'radiusX':4,'radiusY':4}]
                cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':points(0)})
                for step in range(1,13):
                    cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':points(step*.065)})
                cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
                cdp.detach()
            page.wait_for_timeout(300)
            after=page.evaluate('window.mcDebug?.world?.yaw ?? null')
            image_after=hashlib.sha256(canvas.screenshot()).hexdigest()
            assert image_before!=image_after,kind+' did not change world image'
            if before is not None:
                assert abs(after-before)>.3,(kind,before,after)
            report['gestures'][kind]={'nativeInput':True,'yawBefore':before,'yawAfter':after,'worldImageChanged':image_before!=image_after}
            page.screenshot(path=str(OUT/f'{prefix}-{kind}.png'))
            ctx.close()
        report['checks']['NativeRightMouseAndTwoFingerRotateWorld']=True
        assert not report['errors'] and not report['failedRequests'],report
    finally:
        for ctx in contexts:
            try:ctx.close()
            except Exception:pass
        browser.close()
        (OUT/f'{prefix}-observations.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
