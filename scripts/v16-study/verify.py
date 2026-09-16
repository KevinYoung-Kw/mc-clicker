from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'docs/v1.6/qa/feasibility'
OUT.mkdir(parents=True,exist_ok=True)
reports=[]
with sync_playwright() as p:
    for engine,width in [('chromium',1440),('webkit',390),('chromium',320)]:
        browser=getattr(p,engine).launch(headless=True)
        context=browser.new_context(viewport={'width':width,'height':1000},is_mobile=width<760,has_touch=width<760)
        page=context.new_page();errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('http://127.0.0.1:8890/scripts/v16-study/index.html',wait_until='networkidle')
        page.wait_for_function('window.studyReady===true')
        assert page.locator('article').count()==11
        for mode in ['day','night','uniform','silhouette','reverse']:
            if mode=='night':page.get_by_role('button',name='夜间',exact=True).click()
            if mode=='uniform':
                page.get_by_role('button',name='白昼',exact=True).click()
                page.get_by_role('button',name='统一比例尺',exact=True).click()
            if mode=='silhouette':page.get_by_role('button',name='轮廓检查',exact=True).click()
            if mode=='reverse':
                page.get_by_role('button',name='白昼',exact=True).click()
                page.get_by_role('button',name='转一面',exact=True).click()
                page.get_by_role('button',name='转一面',exact=True).click()
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'), 'horizontal overflow'
            stats=page.evaluate('window.studyStats')
            assert all(m['fits'] for m in stats),stats
            page.screenshot(path=str(OUT/f'models-{engine}-{width}-{mode}.png'),full_page=True)
        assert not errors,errors
        reports.append({'engine':engine,'width':width,'models':stats,'errors':errors,'scope':'Isolated unbatched art study, not live-world FPS or completed migration'})
        context.close();browser.close()
(OUT/'model-browser-report.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2)+'\n')
print('11 model footprints and day/night/scale/silhouette/view controls verified on 3 viewports')
