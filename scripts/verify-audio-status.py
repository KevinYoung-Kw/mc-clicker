"""Real WebKit/Chromium interaction checks in isolated saves; no player data."""
from pathlib import Path
import argparse
import json
import subprocess
from playwright.sync_api import sync_playwright

ap=argparse.ArgumentParser()
ap.add_argument('--browser',default='webkit',choices=['webkit','chromium'])
ap.add_argument('--url',default='http://127.0.0.1:8890/')
ap.add_argument('--seed',help='Optional isolated save fixture; otherwise generate through real purchase rules')
args=ap.parse_args()
root=Path(__file__).resolve().parents[1]
out=root/'docs/qa'/f'audio-status-{args.browser}'
out.mkdir(parents=True,exist_ok=True)
seed=json.loads(Path(args.seed).read_text()) if args.seed else json.loads(subprocess.check_output([
    'node','--input-type=module','-e',
    'import {engineeringFixture} from "./scripts/engineering-fixture.mjs"; console.log(JSON.stringify(engineeringFixture()));'
],cwd=root,text=True))
seed['sound']=True
seed['counts'].pop('L2',None)
seed['placements']['L1']={**seed['placements'].pop('L2'),'realm':'overworld'}
seed.pop('records',None);seed.pop('audio',None)
report={'browser':args.browser,'checks':[],'errors':[],'httpErrors':[]}

with sync_playwright() as p:
    browser=getattr(p,args.browser).launch(headless=True)
    try:
        for name,width,height in [('desktop',1440,1000),('phone',390,844),('small-phone',320,720)]:
            context=browser.new_context(viewport={'width':width,'height':height},is_mobile=width<600,has_touch=width<600)
            page=context.new_page()
            page.on('pageerror',lambda e:report['errors'].append(str(e)))
            page.on('response',lambda r:report['httpErrors'].append(r.url) if r.status>=400 else None)
            page.goto(args.url,wait_until='networkidle')
            page.wait_for_function('!!window.mcDebug')
            page.evaluate('(s)=>mcDebug.setState(s)',seed)
            page.locator('[data-nav="village"]').click()
            page.locator('[data-manage-item="L1"]').click()
            if width<600:
                page.locator('#panel-expand').click()
            page.wait_for_timeout(450)
            assert page.locator('[data-record]').count()==6
            assert page.evaluate('mcDebug.state.records.owned')==['meadow']
            page.wait_for_function('mcDebug.audio.snapshot().playing')
            assert page.locator('[data-record-preview], [data-preview-stop]').count()==0
            page.locator('[data-record-buy="cavern"]').click()
            assert page.locator('#placement-confirm').is_visible()
            assert page.evaluate('mcDebug.state.records.owned')==['meadow']
            page.locator('#placement-confirm').click()
            page.wait_for_function('mcDebug.state.records.owned.includes("cavern")')
            assert page.locator('.record-library').is_visible()
            page.locator('[data-record-play="cavern"]').click()
            page.wait_for_function('mcDebug.audio.snapshot().selected==="cavern" && mcDebug.audio.snapshot().playing')
            page.locator('[data-record-toggle]').click()
            page.wait_for_timeout(400)
            assert not page.evaluate('mcDebug.audio.snapshot().playing')
            assert page.evaluate('mcDebug.audio.snapshot().decks')==0
            # Audio changes save without rebuilding the record shelf or losing slider focus.
            slider=page.locator('[data-audio-volume="musicVolume"]')
            slider.fill('27');slider.dispatch_event('change')
            page.locator('[data-record-loop]').click()
            page.evaluate('mcDebug.save()')
            page.reload(wait_until='networkidle')
            page.wait_for_function('!!window.mcDebug')
            assert page.evaluate('mcDebug.state.records.selected')=='cavern'
            assert page.evaluate('mcDebug.state.audio.musicVolume')==.27
            assert page.evaluate('mcDebug.state.records.playing') is False
            assert page.evaluate('mcDebug.state.records.loop') is False
            page.locator('[data-nav="village"]').click();page.locator('[data-manage-item="L1"]').click()
            if width<600: page.locator('#panel-expand').click()
            page.evaluate('mcDebug.state.skipPurchaseConfirmation=true')
            page.locator('[data-record-buy="copper"]').click()
            page.wait_for_function('mcDebug.state.records.owned.includes("copper")')
            assert not page.locator('#placement-confirm').is_visible()
            page.locator('[data-record-play="copper"]').click()
            page.wait_for_function('mcDebug.audio.snapshot().playing')
            page.wait_for_function('mcDebug.audio.deck?.volume && Math.abs(mcDebug.audio.deck.volume.gain.value-.27)<.02',timeout=10000)
            gain=page.evaluate('({element:mcDebug.audio.deck.media.volume,gain:mcDebug.audio.deck.volume.gain.value,context:mcDebug.audio.ctx.state})')
            assert gain['element']==1 and abs(gain['gain']-.27)<.02 and gain['context']=='running',gain
            page.locator('.record-library').scroll_into_view_if_needed()
            page.screenshot(path=out/f'{name}-record-collection.png')
            # Timers read state, while the actual operation button stays at the same offset.
            layout=page.evaluate('''async()=>{
              const {refreshFacilityStatuses}=await import('/src/facility-status.js');
              const {taskState}=await import('/src/operations.js');
              const root=document.querySelector('#panel-content'), row=root.querySelector('[data-facility-status="L1"]'), button=root.querySelector('[data-action="music"]');
              const task=taskState(mcDebug.state,'music'), values=[];
              const focus=root.querySelector('[data-record-loop]');focus.focus();
              for(const time of [60,59,10,9,1,0]){
                task.cooldown=time;refreshFacilityStatuses(root,mcDebug.state);
                values.push({time,height:row.offsetHeight,button:button.offsetTop,columns:row.querySelector('[data-status-row="time"]').offsetHeight});
              }
              mcDebug.state.community.residents[0].name='名字很长的乐师';mcDebug.state.community.residents[0].job='musician';refreshFacilityStatuses(root,mcDebug.state);
              return {values,after:button.offsetTop,same:row===root.querySelector('[data-facility-status="L1"]'),focus:document.activeElement===focus};
            }''')
            assert layout['same'] and layout['focus']
            assert len({(v['height'],v['button'],v['columns']) for v in layout['values']})==1,layout
            assert layout['after']==layout['values'][0]['button'],layout
            page.locator('[data-facility-status="L1"]').scroll_into_view_if_needed()
            page.screenshot(path=out/f'{name}-facility-status.png')
            # A real L2 purchase migrates the outdoor L1; music continues on the same deck.
            result=page.evaluate('''async()=>{
              const {buy,sites,frontier}=await import('/src/game.js');const s=mcDebug.state;
              for(let i=0;i<6&&!sites(s,'overworld',null,'L2').length;i++)buy(s,'V1',{...frontier(s,'overworld')[0],realm:'overworld'});
              return buy(s,'L2');
            }''')
            assert result['ok'],result
            before=page.evaluate('mcDebug.audio.snapshot().playCount')
            page.evaluate('mcDebug.go("live")')
            page.locator('[data-room-tab="arrange"]').click()
            page.locator('[data-room-select="L1"]').click()
            page.wait_for_timeout(500)
            assert page.locator('[data-record]').count()==6
            assert page.evaluate('mcDebug.audio.snapshot().playCount')==before
            assert not page.evaluate('!!mcDebug.state.placements.L1')
            page.locator('.record-library').scroll_into_view_if_needed()
            page.screenshot(path=out/f'{name}-studio-records.png')
            page.evaluate('mcDebug.go("world")');page.wait_for_timeout(350)
            assert page.evaluate('mcDebug.audio.snapshot().playCount')==before
            page.evaluate('window.dispatchEvent(new Event("blur"))')
            held=page.evaluate('({money:mcDebug.state.money,position:mcDebug.audio.snapshot().position})')
            page.wait_for_timeout(600)
            assert page.evaluate('mcDebug.state.money')==held['money']
            assert not page.evaluate('mcDebug.audio.snapshot().playing')
            page.evaluate('window.dispatchEvent(new Event("focus"))')
            page.wait_for_function('mcDebug.audio.snapshot().playing')
            assert page.evaluate('mcDebug.audio.snapshot().position')<held['position']+1
            # Stable industrial load controls and unified dimensional entries.
            page.locator('[data-nav="network"]').click();page.locator('[data-industry-tab="power"]').click()
            page.wait_for_timeout(350)
            assert page.locator('[data-loads] [data-facility-status]').count()>0
            stable=page.evaluate('''async()=>{const button=document.querySelector('[data-loads] button');button.focus();await new Promise(r=>setTimeout(r,600));return button.isConnected&&document.activeElement===button}''')
            assert stable
            page.locator('[data-industry-tab="logistics"]').click()
            for id in ['N3','N5','N6','E3','E5','E9','E10']:
                assert page.locator(f'.dimension-logistics [data-facility-status="{id}"]').count()==1,id
            assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
            assert page.evaluate('mcDebug.audio.snapshot().decks')<=2
            report['checks'].append({'viewport':name,'collection':True,'auditionRestore':True,'confirmationModes':True,'savedPreferences':True,'musicGain':gain,'studioMigration':True,'singlePlayer':True,'foregroundOnly':True,'layout':layout,'loadFocusPreserved':True,'dimensionPanels':True})
            context.close()
        assert not report['errors'],report['errors']
        assert not report['httpErrors'],report['httpErrors']
        report['passed']=True
    except Exception:
        if not page.is_closed():page.screenshot(path=out/'failure.png')
        raise
    finally:
        (out/'results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
        browser.close()
print(json.dumps({'passed':True,'viewports':len(report['checks']),'output':str(out)},ensure_ascii=False))
