"""Inspect the expanded studio in an isolated development browser and touch context."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "qa"
fixture = json.loads((ROOT / "tests" / "fixtures" / "layout-v2.json").read_text())
fixture["realm"] = "overworld"
fixture["money"] = 1e18
fixture["reducedMotion"] = True
fixture.setdefault("live", {})["director"] = False
errors = []
metrics = {}


def load(page, state):
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto("http://127.0.0.1:8890/", wait_until="networkidle")
    page.wait_for_function("window.mcDebug && mcDebug.world")
    page.evaluate("s => mcDebug.setState(s)", state)
    page.evaluate("mcDebug.state.live.director = false")


def room_state(page):
    return page.evaluate("""async () => {
      const T = await import('/node_modules/.vite/deps/three.js');
      const w=mcDebug.world, devices=[], decor=[], lamps=[];
      w.roots.L2.traverse(o=>{
        if(o.userData.studioEquipment)devices.push(o.userData.studioEquipment);
        if(o.userData.studioDecoration)decor.push(o.userData.studioDecoration);
        if(o.userData.studioLamp)lamps.push({visible:o.visible,width:o.scale.x});
      });
      const b=new T.Box3().setFromObject(w.roots.L2), projected=[];
      for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])projected.push(new T.Vector3(x,y,z).project(w.camera).toArray());
      return {devices,decor,lamps,bounds:{min:b.min.toArray(),max:b.max.toArray()},projected,power:mcDebug.rates().electricity.perDevice.L12,drawCalls:w.renderer.info.render.calls,triangles:w.renderer.info.render.triangles};
    }""")


def clear_transient_rewards(page):
    # Show the room between reward events; keep all purchased reward equipment.
    page.evaluate('mcDebug.state.live.gifts=[]; mcDebug.state.live.rainCooldown=0; mcDebug.advance(0); mcDebug.world.update(true)')


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=["--use-angle=metal"])
    page = browser.new_page(viewport={"width": 1360, "height": 900})
    load(page, fixture)
    page.locator('[data-nav="live"]').click()
    page.wait_for_function('mcDebug.world.renderedView === "studio"')
    page.wait_for_timeout(200)
    clear_transient_rewards(page)
    metrics["desktopBefore"] = room_state(page)
    assert len(metrics["desktopBefore"]["devices"]) == 12, metrics
    page.screenshot(path=str(OUT / "96-studio-expanded-desktop.png"))
    page.locator('[data-studio-tab="equipment"]').click()
    count = page.evaluate('mcDebug.state.counts.L3')
    page.locator('[data-buy="L3"]').click()
    assert page.evaluate('mcDebug.state.counts.L3') == count + 1
    assert page.evaluate('mcDebug.state.placements.L3 === undefined')
    page.locator('#studio-decor').click()
    for slot in ["studioDesk", "studioWall", "studioSign", "studioShelf"]:
        page.locator(f'[data-studio-part="{slot}"]').click()
        page.locator(f'[data-preview="{slot}-1"]').click()
        page.locator(f'[data-extra-buy="{slot}-1"]').click()
    page.keyboard.press('Escape')
    page.locator('[data-studio-tab="program"]').click()
    page.wait_for_timeout(150)
    clear_transient_rewards(page)
    metrics["desktopDecorated"] = room_state(page)
    assert len(metrics["desktopDecorated"]["decor"]) == 4
    assert all(abs(p[0]) < 1 and abs(p[1]) < 1 for p in metrics["desktopDecorated"]["projected"]), metrics["desktopDecorated"]["projected"]
    page.screenshot(path=str(OUT / "97-studio-copper-desktop.png"))
    metrics["blackout"] = page.evaluate("""async()=>{
      const {toggleDevice}=await import('/src/power.js');
      toggleDevice(mcDebug.state,'L12');mcDebug.advance(.25);mcDebug.world.update(true);
      const lamps=[];mcDebug.world.roots.L2.traverse(o=>{if(o.userData.studioLamp)lamps.push(o.visible)});
      return {fraction:mcDebug.rates().electricity.perDevice.L12,lamps};
    }""")
    assert metrics["blackout"]["fraction"] == 0
    assert not any(metrics["blackout"]["lamps"])
    page.evaluate("""async()=>{const {toggleDevice}=await import('/src/power.js');toggleDevice(mcDebug.state,'L12');mcDebug.advance(.25);mcDebug.world.update(true)}""")
    saved = page.evaluate('mcDebug.state')
    page.close()

    context = browser.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True,device_scale_factor=1)
    phone = context.new_page()
    load(phone, saved)
    phone.locator('[data-nav="live"]').tap()
    phone.wait_for_function('mcDebug.world.renderedView === "studio"')
    phone.wait_for_timeout(150)
    clear_transient_rewards(phone)
    metrics["phone"] = room_state(phone)
    assert all(abs(p[0]) < 1 and abs(p[1]) < 1 for p in metrics["phone"]["projected"]), metrics["phone"]["projected"]
    assert phone.evaluate('document.documentElement.scrollWidth <= innerWidth')
    phone.screenshot(path=str(OUT / "98-studio-expanded-phone.png"))
    phone.locator('[data-studio-tab="equipment"]').tap()
    count = phone.evaluate('mcDebug.state.counts.L3')
    phone.locator('[data-buy="L3"]').tap()
    assert phone.evaluate('mcDebug.state.counts.L3') == count + 1 == 3
    phone.screenshot(path=str(OUT / "105-studio-equipment-phone.png"))
    phone.locator('[data-studio-tab="program"]').tap()
    phone.locator('#studio-back').tap()
    phone.locator('[data-nav="live"]').tap()
    phone.wait_for_function('mcDebug.world.renderedView === "studio"')
    phone.locator('#studio-host').scroll_into_view_if_needed()
    point = phone.locator('#studio-host').bounding_box()
    client = context.new_cdp_session(phone)
    client.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':[{'x':point['x']+point['width']/2,'y':point['y']+point['height']/2}]})
    phone.wait_for_timeout(1450)
    client.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]})
    assert phone.evaluate('mcDebug.state.live.host > 0')
    # Route companions away from gifts so pointer consumption has a stable baseline.
    phone.evaluate('''async()=>{const {assignJob,setGolemRoute}=await import('/src/residents.js');
      for(const r of mcDebug.state.community.residents)if(!r.reserve)assignJob(mcDebug.state,r.id,'idle');
      for(const g of mcDebug.state.community.golems)setGolemRoute(mcDebug.state,g.id,['V4'],'cargo');
      window.giftPointerEvents=[];const layer=document.querySelector('#gift-layer');
      for(const type of ['pointerdown','pointermove','pointerup','click'])layer.addEventListener(type,e=>giftPointerEvents.push({type,pointerType:e.pointerType,detail:e.detail,id:e.target.closest('[data-gift]')?.dataset.gift,ids:mcDebug.state.live.gifts.map(g=>g.id)}),true);
    }''')
    phone.locator('[data-action="festival"]').tap()
    phone.locator('#studio-header').scroll_into_view_if_needed()
    phone.wait_for_function('mcDebug.state.live.gifts.length === 12')
    metrics['gifts'] = phone.evaluate('''()=>{
      const r=document.querySelector('#stage').getBoundingClientRect(), x=r.x+r.width/2, y=r.y+r.height/2;
      const gifts=[...document.querySelectorAll('#gift-layer [data-gift]')].map(e=>{
        const b=e.getBoundingClientRect();return{id:Number(e.dataset.gift),x:b.x,y:b.y,width:b.width,height:b.height,coversCenter:b.left<=x&&b.right>=x&&b.top<=y&&b.bottom>=y};
      });
      const tray=document.querySelector('#gift-layer').getBoundingClientRect();
      return{count:mcDebug.state.live.gifts.length,gifts,centerCovered:gifts.some(g=>g.coversCenter),tray:{height:tray.height,top:tray.top},stageBottom:r.bottom,label:document.querySelector('[data-gift-count]').textContent};
    }''')
    assert not metrics['gifts']['centerCovered'], metrics['gifts']
    assert len(metrics['gifts']['gifts']) == 4
    assert metrics['gifts']['tray']['height'] == 88
    assert metrics['gifts']['tray']['top'] >= metrics['gifts']['stageBottom']
    assert all(g['height'] == 44 and g['width'] >= 44 for g in metrics['gifts']['gifts'])
    assert '12' in metrics['gifts']['label']
    # Retain the real full queue, but let the transient touch highlight settle.
    phone.wait_for_timeout(650)
    phone.screenshot(path=str(OUT / '106-studio-gifts-phone.png'))
    gift = phone.locator('#gift-layer [data-gift]').first
    gift_id = int(gift.get_attribute('data-gift'))
    metrics['gifts']['beforeTapIds'] = phone.evaluate('mcDebug.state.live.gifts.map(g=>g.id)')
    gift.tap()
    assert phone.evaluate('(id)=>!mcDebug.state.live.gifts.some(g=>g.id===id)', gift_id)
    metrics['gifts']['tapCollected'] = True
    metrics['gifts']['remainingAfterTap'] = phone.evaluate('mcDebug.state.live.gifts.length')
    assert metrics['gifts']['remainingAfterTap'] == len(metrics['gifts']['beforeTapIds']) - 1
    phone.wait_for_timeout(100)
    sweep = phone.locator('#gift-layer [data-gift]').evaluate_all('els=>els.map(e=>{const b=e.getBoundingClientRect();return{id:Number(e.dataset.gift),x:b.x+b.width/2,y:b.y+b.height/2}}).sort((a,b)=>a.x-b.x)')
    assert len(sweep) == 4
    client.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':[{'x':sweep[0]['x'],'y':sweep[0]['y']}]})
    for point in sweep[1:]:
        client.send('Input.dispatchTouchEvent', {'type':'touchMove','touchPoints':[{'x':point['x'],'y':point['y']}]})
    client.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]})
    assert phone.evaluate('(ids)=>ids.every(id=>!mcDebug.state.live.gifts.some(g=>g.id===id))', [g['id'] for g in sweep])
    metrics['gifts']['sweepCollected'] = len(sweep)
    metrics['gifts']['remainingAfterSweep'] = phone.evaluate('mcDebug.state.live.gifts.length')
    assert metrics['gifts']['remainingAfterSweep'] == metrics['gifts']['remainingAfterTap'] - 4
    metrics['gifts']['pointerEvents'] = phone.evaluate('giftPointerEvents')
    assert phone.locator('#gift-layer [data-gift]').count() == 4
    assert '已收 +' in phone.locator('[data-gift-feedback]').text_content()
    phone.evaluate('mcDebug.save()')
    phone.reload(wait_until='networkidle')
    assert phone.evaluate('mcDebug.state.counts.L3') == 3
    assert phone.evaluate('mcDebug.state.collection.equipped.studioDesk') == 'studioDesk-1'
    metrics['touch'] = {'buyCamera':True,'host':True,'reload':True,'horizontalOverflow':False}
    metrics['errors'] = errors
    assert not errors, errors
    (OUT / 'studio-polish-observations.json').write_text(json.dumps(metrics,ensure_ascii=False,indent=2))
    browser.close()
print(json.dumps(metrics,ensure_ascii=False))
