"""Verify the integrated indoor scene, camera input and bounded renderer resources."""

import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "qa"
URL = os.environ.get("MC_DEV_URL", "http://127.0.0.1:8890/")
fixture = json.loads((ROOT / "tests" / "fixtures" / "layout-v2.json").read_text())
fixture["realm"] = "overworld"
fixture["money"] = 1e18
fixture["reducedMotion"] = False
fixture["counts"].update({"L2": 3, "L3": 3})
fixture["collection"] = {"version": 2, "owned": {}, "equipped": {}, "disabled": {}}
for slot in ["studioDesk", "studioWall", "studioSign", "studioShelf"]:
    for variant in range(2):
        fixture["collection"]["owned"][f"{slot}-{variant}"] = True
    fixture["collection"]["equipped"][slot] = f"{slot}-1"
errors = []
results = {}
OUT.mkdir(exist_ok=True)


def open_room(page):
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(URL, wait_until="networkidle")
    page.wait_for_function("window.mcDebug && mcDebug.world")
    page.evaluate("state => mcDebug.setState(state)", fixture)
    page.locator('[data-nav="live"]').click()
    page.wait_for_function('mcDebug.world.renderedView === "studio"')
    page.wait_for_timeout(650)
    page.evaluate("mcDebug.world.home();mcDebug.world.update(true)")
    assert not page.evaluate('document.querySelector("#game").classList.contains("panel-open")')


def bounds(page):
    return page.evaluate("""async () => {
      const T=await import('/node_modules/.vite/deps/three.js'),w=mcDebug.world,
        box=new T.Box3().setFromObject(w.roots.L2), points=[];
      for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])
        points.push(new T.Vector3(x,y,z).project(w.camera).toArray());
      return {points,pixelRatio:w.renderer.getPixelRatio(),shadowMap:w.sun.shadow.mapSize.toArray(),
        shadowType:w.renderer.shadowMap.type,renderedView:w.renderedView,shot:w.shot,
        overflow:document.documentElement.scrollWidth>innerWidth,
        memory:{...w.renderer.info.memory},canvas:w.renderer.domElement.getBoundingClientRect().toJSON()};
    }""")


def frame_observation(page):
    return page.evaluate("""() => new Promise(resolve => {
      let last=performance.now();const values=[];
      function sample(now){values.push(now-last);last=now;
        if(values.length<150)requestAnimationFrame(sample);
        else{values.shift();values.sort((a,b)=>a-b);resolve({sampleFrames:values.length,median:values[Math.floor(values.length*.5)],p95:values[Math.floor(values.length*.95)],max:values.at(-1)})}}
      requestAnimationFrame(sample);
    })""")


def no_clip(data):
    assert not data["overflow"], data
    assert all(abs(p[0]) <= 1 and abs(p[1]) <= 1 for p in data["points"]), data
    assert data["shadowMap"] == [1024, 1024]


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, args=["--use-angle=metal"])
    context = browser.new_context(viewport={"width": 1360, "height": 900}, device_scale_factor=2)
    page = context.new_page()
    open_room(page)
    results["desktop"] = bounds(page)
    no_clip(results["desktop"])
    assert results["desktop"]["pixelRatio"] == 1.7
    page.screenshot(path=str(OUT / "interiors-world-desktop.png"))
    point = page.evaluate("""async () => {
      const T=await import('/node_modules/.vite/deps/three.js'),w=mcDebug.world,
        center=new T.Box3().setFromObject(w.roots['L3:0']).getCenter(new T.Vector3()).project(w.camera),r=w.renderer.domElement.getBoundingClientRect();
      return{x:r.x+(center.x+1)*r.width/2,y:r.y+(1-center.y)*r.height/2};
    }""")
    page.mouse.click(point["x"], point["y"])
    page.locator('[data-room-move="L3:0"]').wait_for(state="visible")
    results["physicalSelection"] = "L3:0"
    page.locator("#room-close-panel").click()
    results["director"] = page.evaluate("""async () => {
      const {emit}=await import('/src/game.js');mcDebug.state.live.director=true;
      emit(mcDebug.state,'harvest','农民与麦田丰收','overworld');mcDebug.advance(0);
      return {programShot:mcDebug.state.live.shot,worldShot:mcDebug.world.shot,scene:mcDebug.world.renderedView};
    }""")
    assert results["director"]["programShot"] != "L2", results["director"]
    assert results["director"]["worldShot"] == "L2", results["director"]
    page.locator("#room-monitor").click()
    page.wait_for_function("mcDebug.world.shot === mcDebug.state.live.shot && mcDebug.world.renderedView !== 'studio'")
    page.locator("#room-monitor").click()
    page.wait_for_function("mcDebug.world.renderedView === 'studio'")
    # Warm both cached scenes before comparing renderer resource counts.
    page.evaluate("mcDebug.go('world')")
    page.locator('[data-nav="live"]').click()
    page.wait_for_function("mcDebug.world.renderedView === 'studio'")
    warm = page.evaluate("({...mcDebug.world.renderer.info.memory})")
    samples = []
    for _ in range(8):
        page.evaluate("mcDebug.go('world')")
        page.locator('[data-nav="live"]').click()
        page.wait_for_function("mcDebug.world.renderedView === 'studio'")
        samples.append(page.evaluate("({...mcDebug.world.renderer.info.memory})"))
    assert all(item == warm for item in samples), (warm, samples)
    results["sceneCache"] = {"warm": warm, "eightReturns": samples}
    results["desktopFrameMs"] = frame_observation(page)
    context.close()

    for width in [320, 390]:
        context = browser.new_context(viewport={"width": width, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        page = context.new_page()
        open_room(page)
        data = bounds(page)
        no_clip(data)
        assert data["pixelRatio"] == 1.4
        results[f"phone{width}"] = data
        page.screenshot(path=str(OUT / f"interiors-world-phone-{width}.png"))
        client = context.new_cdp_session(page)
        y = 420
        client.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": width/2-50, "y": y, "id": 1}, {"x": width/2+50, "y": y, "id": 2}]})
        for step in range(1, 6):
            client.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": width/2-50-step*5, "y": y-step*4, "id": 1}, {"x": width/2+50+step*5, "y": y+step*4, "id": 2}]})
        client.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
        gesture = page.evaluate('({zoom:mcDebug.world.zoom,yaw:mcDebug.world.yaw,panel:document.querySelector("#game").classList.contains("panel-open")})')
        assert gesture["zoom"] < .9 and abs(gesture["yaw"]) > .1 and not gesture["panel"], gesture
        results[f"phone{width}Gesture"] = gesture
        page.evaluate("mcDebug.world.home()")
        page.wait_for_timeout(300)
        if width == 390:
            results["phone390FrameMs"] = frame_observation(page)
        context.close()
    browser.close()

results["errors"] = errors
results["notes"] = "Integrated development build; M4 / Chromium Metal, one renderer at a time. Frame times are a short observation, not a before/after benchmark. Rendering pixel ratio and 1024-square PCF soft shadows are unchanged."
assert not errors, errors
(OUT / "interiors-world-observations.json").write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n")
print(json.dumps(results, ensure_ascii=False, indent=2))
