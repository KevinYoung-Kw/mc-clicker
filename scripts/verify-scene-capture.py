"""Verify scene-only export and success/failure state restoration in real WebGL."""
import base64
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "qa"
URL = os.environ.get("MC_DEV_URL", "http://127.0.0.1:8890/")
fixture = json.loads((ROOT / "tests/fixtures/layout-v2.json").read_text())
fixture["reducedMotion"] = True
results = {}
errors = []
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, args=["--use-angle=metal"])
    page = browser.new_page(viewport={"width":1280,"height":900})
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(URL, wait_until="networkidle")
    try:
        page.wait_for_function("window.mcDebug && mcDebug.world && typeof mcDebug.world.captureCurrentScene === 'function'")
    except Exception:
        print({"errors":errors,"text":page.locator("body").inner_text()[:1800]})
        raise
    page.evaluate("""async () => {
      const T=await import('/node_modules/.vite/deps/three.js');
      window.captureState=()=>{const w=mcDebug.world,r=w.renderer;return JSON.stringify({state:mcDebug.state,
        pan:w.pan.toArray(),zoom:w.zoom,yaw:w.yaw,view:w.view,shot:w.shot,studio:w.studio,
        camera:w.camera.toJSON(),canvas:[r.domElement.width,r.domElement.height],
        mode:w.mode,markers:w.markerGroup.visible,selection:w.selectRing.visible,
        background:w.scene.background?.getHex(),
        caches:[...w.caches.keys()],signature:w.signature,target:r.getRenderTarget()?.uuid||null,
        viewport:r.getViewport(new T.Vector4()).toArray(),
        scissorTest:r.getScissorTest(),shadow:[r.shadowMap.needsUpdate,r.shadowMap.autoUpdate]});};
    }""")
    for name in ["early", "mature", "nether", "end", "studio"]:
        if name == "early":
            page.evaluate("""async () => {const {fresh}=await import('/src/game.js');const s=fresh();s.reducedMotion=true;mcDebug.setState(s);mcDebug.go('world')}""")
        else:
            raw = dict(fixture)
            raw["realm"] = name if name in ("nether", "end") else "overworld"
            page.evaluate("s=>mcDebug.setState(s)", raw)
            page.evaluate("mcDebug.go('world')")
            if name == "studio":
                page.locator('[data-nav="live"]').click()
                page.wait_for_function("mcDebug.world.interior")
        page.wait_for_timeout(200)
        page.evaluate("mcDebug.world.update(true)")
        output = page.evaluate("""() => {
          const w=mcDebug.world;w.selectRing.visible=true;w.markerGroup.visible=true;
          const before=captureState(),time=performance.now(),photo=w.captureCurrentScene(),after=captureState();
          return {photo,unchanged:before===after,milliseconds:performance.now()-time,sceneBackground:w.scene.background.getStyle()};
        }""")
        assert output["unchanged"], name
        photo = output["photo"]
        assert photo["realm"] == (name if name in ("studio", "nether", "end") else "overworld"), photo
        (OUT / f"scene-capture-{name}.png").write_bytes(base64.b64decode(photo.pop("url").split(",")[1]))
        results[name] = output
    results["resourceStability"] = page.evaluate("""() => {
      const w=mcDebug.world;w.captureCurrentScene();
      const snapshot=()=>({...w.renderer.info.memory,programs:w.renderer.info.programs.length});
      const before=snapshot(),samples=[];
      for(let i=0;i<5;i++){w.captureCurrentScene();samples.push(snapshot())}
      const after=snapshot();return {warmupCaptures:1,repeatedCaptures:5,before,after,samples,stable:JSON.stringify(before)===JSON.stringify(after)};
    }""")
    assert results["resourceStability"]["stable"], results["resourceStability"]
    results["failure"] = page.evaluate("""() => {
      const w=mcDebug.world,r=w.renderer,before=captureState(),read=r.readRenderTargetPixels;
      let message='';r.readRenderTargetPixels=()=>{throw Error('injected GPU read failure')};
      try{w.captureCurrentScene()}catch(error){message=error.message}finally{r.readRenderTargetPixels=read}
      return {message,unchanged:captureState()===before};
    }""")
    assert results["failure"]["unchanged"] and "injected" in results["failure"]["message"]
    results["overlayExclusion"] = page.evaluate("""() => {
      const w=mcDebug.world;w.selectRing.visible=true;w.markerGroup.visible=true;
      const a=w.captureCurrentScene({width:720,height:500}).url;
      w.selectRing.visible=false;w.markerGroup.visible=false;
      const b=w.captureCurrentScene({width:720,height:500}).url;return a===b;
    }""")
    assert results["overlayExclusion"]
    assert not errors, errors
    browser.close()
results["errors"] = errors
(OUT / "scene-capture-observations.json").write_text(json.dumps(results,ensure_ascii=False,indent=2)+"\n")
print(json.dumps(results,ensure_ascii=False,indent=2))
