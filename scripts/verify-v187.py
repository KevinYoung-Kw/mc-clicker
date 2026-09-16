"""V1.8.7 production UI: collection credit, repaired rooms, XHS bottom menu."""
import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--web', default='http://127.0.0.1:8942/')
parser.add_argument('--xhs', default='http://127.0.0.1:8941/')
parser.add_argument('--edition', choices=['web','xhs'])
parser.add_argument('--out', default='docs/qa/v187/ui')
args = parser.parse_args()
out = ROOT / args.out
out.mkdir(parents=True, exist_ok=True)
seed = json.loads((ROOT / 'docs/qa/v187/legacy-full-room.json').read_text())
key = 'mc-clicker-world-v2'
reports = []
owned = lambda s: {k:v for k,v in s['counts'].items() if v}

def saved(page):
    page.evaluate('window.dispatchEvent(new Event("blur"))')
    data = page.evaluate(f'JSON.parse(localStorage.getItem("{key}"))')
    page.evaluate('window.dispatchEvent(new Event("focus"))')
    return data

def clickable(page, selector):
    assert page.locator(selector).is_visible(), selector
    assert page.locator(selector).evaluate('e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}'), selector+' covered'

def atlas(page, xhs):
    if xhs:
        page.locator('#hud-more').click()
        page.locator('#atlas-open').click()
    else:
        page.locator('[data-nav="atlas"]').click()
    page.wait_for_selector('.atlas-summary')

with sync_playwright() as p:
    for edition, url in [('web',args.web),('xhs',args.xhs)]:
        if args.edition and edition!=args.edition: continue
        for engine,width,height,theme in [('chromium',1440,900,''),('chromium',320,740,''),('webkit',390,844,'web-theme-end')]:
            browser = getattr(p,engine).launch(headless=True,**({'args':['--use-angle=metal']} if engine=='chromium' else {}))
            context = browser.new_context(viewport={'width':width,'height':height},is_mobile=width<760,has_touch=width<760)
            raw=json.loads(json.dumps(seed))
            if theme: raw['webAppearance']['equipped']['theme']=theme
            context.add_init_script('if(!localStorage.getItem('+json.dumps(key)+'))localStorage.setItem('+json.dumps(key)+','+json.dumps(json.dumps(raw))+')')
            page=context.new_page();page.set_default_timeout(15000)
            errors=[];page.on('pageerror',lambda e: errors.append(str(e)))
            name=f'{edition}-{engine}-{width}'
            try:
                print(name,'load',flush=True)
                page.goto(url,wait_until='networkidle')
                if edition=='xhs':page.locator('#xhs-start button').click()
                assert page.evaluate('typeof mcDebug')=='undefined'
                first=saved(page)
                assert owned(first)==owned(raw)
                assert first['scenery']['owned']==raw['scenery']['owned']
                assert first['studio']['placements']['L11']!=first['studio']['placements']['L8']
                assert len(first['studio']['placements'])==31
                if edition=='xhs':
                    assert page.locator('.hud #hud-more').count()==0
                    # Identical computed button styling, not just a similar color.
                    props=['height','width','minWidth','maxWidth','fontSize','color','backgroundColor','border','boxShadow','padding','gap','flexDirection']
                    styles=page.locator('.hotbar > button:not([hidden])').evaluate_all('(es,props)=>es.map(e=>Object.fromEntries(props.map(p=>[p,getComputedStyle(e)[p]])))',props)
                    assert all(s==styles[0] for s in styles[1:]), styles
                    clickable(page,'#hud-more');page.locator('#hud-more').click()
                    assert page.locator('#hud-tools').is_visible()
                    page.screenshot(path=str(out/(name+'-menu.png')))
                    page.locator('#hud-more').click();assert not page.locator('#hud-tools').is_visible()
                print(name,'atlas',flush=True)
                atlas(page,edition=='xhs')
                assert page.locator('.atlas-summary strong').inner_text().replace(' ','')=='99/99'
                for bundle in ['X3','X4','X5','X6','X8']:
                    assert '合集已收集' in page.locator(f'[data-detail="{bundle}"]').inner_text()
                    assert 'done' in page.locator(f'[data-detail="{bundle}"]').get_attribute('class')
                page.locator('[data-family="X"]').click()
                page.screenshot(path=str(out/(name+'-atlas.png')))
                if edition=='xhs' and width<760:
                    page.locator('#panel-expand').click();clickable(page,'#hud-more')
                    page.locator('#hud-more').click();clickable(page,'#settings')
                    page.locator('#hud-more').click()
                print(name,'studio',flush=True)
                page.locator('[data-family="L"]').click()
                page.locator('[data-detail="L2"]').click()
                page.wait_for_function('document.body.classList.contains("live-page")')
                page.locator('[data-room-tab="arrange"]').click()
                page.wait_for_selector('[data-room-select="L8"]')
                assert page.locator('[data-room-select]').count()==20
                assert '待摆放' not in page.locator('.room-inventory').inner_text()
                page.screenshot(path=str(out/(name+'-studio.png')))
                if edition=='xhs':
                    assert page.locator('#room-tools #hud-more').count()==1
                    clickable(page,'#hud-more');page.locator('#hud-more').click();clickable(page,'#settings')
                    page.screenshot(path=str(out/(name+'-studio-menu.png')))
                    page.locator('#hud-more').click()
                page.locator('[data-room-select="L3:0"]').click()
                page.locator('[data-room-move="L3:0"]').click()
                page.wait_for_selector('#placement-confirm')
                if edition=='xhs':
                    clickable(page,'#hud-more');page.locator('#hud-more').click();clickable(page,'#atlas-open');page.locator('#hud-more').click()
                page.locator('#placement-rotate').click()
                page.locator('#placement-cancel').click()
                assert saved(page)['studio']['placements']==first['studio']['placements'],'cancel must retain placement'
                page.locator('[data-room-move="L3:0"]').click()
                page.locator('#placement-confirm').click()
                again=saved(page)
                assert again['studio']['placements']==first['studio']['placements']
                page.reload(wait_until='networkidle')
                if edition=='xhs':page.locator('#xhs-start button').click()
                reloaded=saved(page)
                assert reloaded['studio']['placements']==first['studio']['placements'],'repair must not repeat'
                assert owned(reloaded)==owned(raw)
                assert not errors,errors
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                reports.append({'edition':edition,'engine':engine,'width':width,'atlas':'99/99','roomEntities':31,'repairStable':True,'moveCancelAndConfirm':True,'bottomMenu':edition=='xhs','matchingHotbarStyle':edition=='xhs','errors':errors})
                (out/('report-'+(args.edition or 'both')+'.json')).write_text(json.dumps(reports,ensure_ascii=False,indent=2))
                print(name,'PASS',flush=True)
            except Exception:
                page.screenshot(path=str(out/(name+'-failure.png')))
                raise
            finally: browser.close()
