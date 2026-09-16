import json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
fixture=json.loads(Path('/tmp/mc-crowd-fixture.json').read_text())
errors=[]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--use-angle=metal'])
    page=browser.new_page(viewport={'width':1360,'height':900})
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://127.0.0.1:8890/',wait_until='networkidle')
    page.evaluate('(s)=>mcDebug.setState(s)',fixture)
    page.locator('[data-nav="village"]').click()
    page.locator('.management-tabs [data-village-tab="residents"]').click()
    assert page.locator('[data-person]').count()==12
    assert not page.locator('[data-equipment-buy="V2"]').count()
    assert '12 / 12' in page.locator('.roster-top').inner_text()
    assert '33' in page.locator('[data-reserve-toggle]').inner_text()
    assert page.evaluate('mcDebug.state.community.residents.find(r=>r.id==="resident-45").skills.farming')==4
    page.screenshot(path=str(ROOT/'docs/qa/90-compact-residents-desktop.png'))
    page.locator('[data-reserve-toggle]').click()
    page.locator('[data-person="resident-44"]').click()
    page.locator('[data-recall-outgoing]').select_option('resident-1')
    page.locator('[data-recall="resident-44"]').click()
    assert page.locator('[data-person]').count()==12
    assert page.evaluate('mcDebug.state.community.residents.find(r=>r.id==="resident-44").reserve')==False
    page.evaluate('mcDebug.save()')
    page.reload(wait_until='networkidle')
    assert page.evaluate('mcDebug.state.community.residents.filter(r=>!r.reserve).length')==12
    assert page.evaluate('mcDebug.state.community.residents.find(r=>r.id==="resident-44").reserve')==False
    metrics=page.evaluate('''async()=>{
      const {advance}=await import('/src/game.js');
      const {companionActors,visibleCompanions}=await import('/src/operations.js');
      let minDistance=Infinity, maxVisible=0, mismatches=0;
      for(let i=0;i<600;i++){
        advance(mcDebug.state,.2);
        const people=companionActors(mcDebug.state);
        for(let a=0;a<people.length;a++)for(let b=a+1;b<people.length;b++) minDistance=Math.min(minDistance,Math.hypot(people[a].x-people[b].x,people[a].z-people[b].z));
        if(i%10===0){mcDebug.world.update(true);maxVisible=Math.max(maxVisible,mcDebug.world.walkers.filter(w=>w.person&&w.root.visible).length);}
      }
      mcDebug.advance(0);mcDebug.world.update(true);
      for(const w of mcDebug.world.walkers.filter(w=>w.person)) if(Math.hypot(w.x-w.person.x,w.z-w.person.z)>.01)mismatches++;
      return {minDistance,maxVisible,mismatches,reserveCount:mcDebug.state.community.residents.filter(r=>r.reserve).length,workers:mcDebug.state.community.residents.filter(r=>!r.reserve).map(r=>({id:r.id,job:r.job,completed:r.jobsDone,status:r.status})),golems:mcDebug.state.community.golems.map(g=>({id:g.id,trips:g.trips,status:g.status})),budget:visibleCompanions(mcDebug.state).length};
    }''')
    assert metrics['minDistance']>=.53,metrics
    assert metrics['maxVisible']<=metrics['budget']<=12,metrics
    assert metrics['mismatches']==0,metrics
    assert any(g['trips']>0 for g in metrics['golems']),metrics
    page.screenshot(path=str(ROOT/'docs/qa/91-uncrowded-world.png'))
    page.set_viewport_size({'width':390,'height':844})
    page.locator('[data-nav="village"]').click()
    page.locator('.management-tabs [data-village-tab="residents"]').click()
    assert page.locator('[data-person]').count()==12
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.screenshot(path=str(ROOT/'docs/qa/92-compact-residents-phone.png'))
    metrics['errors']=errors
    assert not errors,errors
    (ROOT/'docs/qa/population-observations.json').write_text(json.dumps(metrics,ensure_ascii=False,indent=2))
    browser.close()
print(json.dumps(metrics,ensure_ascii=False))
