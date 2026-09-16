"""Verify exact dynamic matrices, GPU upload volume and an unchanged scene shot.

Run against the same complete fixture and each dev checkout; mcDebug is required.
The isolated browser freezes the economy while exercising the original animations.
"""

import json, argparse
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--url", required=True)
parser.add_argument("--fixture", required=True)
parser.add_argument("--output", required=True)
options = parser.parse_args()
OUT = Path(options.output)
OUT.mkdir(parents=True, exist_ok=True)
fixture = json.loads(Path(options.fixture).read_text())
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=["--use-angle=metal"])
    page = browser.new_page(
        viewport={"width": 1440, "height": 960}, device_scale_factor=1
    )
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(options.url, wait_until="networkidle")
    page.evaluate(
        's=>{window.dispatchEvent(new Event("blur"));mcDebug.setState(s);cancelAnimationFrame(mcDebug.world.raf)}',
        fixture,
    )
    result = page.evaluate("""async()=>{
      const w=mcDebug.world,gl=w.renderer.getContext();
      w.update(true);
      const arrays=new Set(w.batch.map(b=>b.mesh.instanceMatrix.array)),original=gl.bufferSubData;
      let bytes=0,calls=0;
      gl.bufferSubData=function(target,offset,data,from,length){
        if(arrays.has(data)){bytes+=(length??data.length)*data.BYTES_PER_ELEMENT;calls++;}
        return original.apply(this,arguments);
      };
      const phases=[];
      const verify=()=>{let mismatches=0;for(const b of w.batch)for(let j=0;j<b.dynamicObjects.length;j++){
        const {o,parents}=b.dynamicObjects[j],e=parents.every(p=>p.visible)?o.matrixWorld.elements:w.zeroMatrix.elements;
        for(let k=0;k<16;k++)if(b.mesh.instanceMatrix.array[(b.firstDynamic+j)*16+k]!==Math.fround(e[k]))mismatches++;
      }return mismatches;};
      for(const reduced of [false,true]){
        w.state.reducedMotion=reduced;w.update(true);bytes=0;calls=0;
        let mismatch=0;
        for(let i=0;i<60;i++){await new Promise(requestAnimationFrame);w.time+=.05;w.update(true);mismatch+=verify();}
        phases.push({reducedMotion:reduced,frames:60,matrixBytes:bytes,matrixUploadCalls:calls,matricesPerFrame:bytes/64/60,mismatches:mismatch});
      }
      const root=w.dynamicRoots[0];root.visible=false;w.update(true);const hiddenMismatch=verify();root.visible=true;w.update(true);const shownMismatch=verify();
      gl.bufferSubData=original;
      return {phases,hiddenMismatch,shownMismatch,instances:w.batch.reduce((sum,b)=>sum+b.objects.length,0),dynamicInstances:w.batch.reduce((sum,b)=>sum+b.dynamicObjects.length,0),memory:{...w.renderer.info.memory},trianglesWithShadows:w.renderer.info.render.triangles};
    }""")
    page.evaluate(
        "s=>{s.reducedMotion=true;mcDebug.setState(s);mcDebug.world.update(true)}",
        fixture,
    )
    page.locator("#world canvas").screenshot(
        path=str(OUT / "same-quality.png")
    ) if page.locator("#world canvas").count() else page.locator(
        "canvas"
    ).first.screenshot(path=str(OUT / "same-quality.png"))
    result["errors"] = errors
    assert not errors, errors
    assert all(p["mismatches"] == 0 for p in result["phases"]), result
    assert result["hiddenMismatch"] == result["shownMismatch"] == 0, result
    (OUT / "uploads.json").write_text(json.dumps(result, indent=2))
    print(json.dumps(result))
    browser.close()
