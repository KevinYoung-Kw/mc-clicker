"""Compare the candidate with per-material references using identical live matrices.
Target viewport is in physical pixels; never apply renderer DPR to it twice.
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / os.environ.get("MC_BATCH_OUT", "docs/qa/color-batching-v185.json")
URL = os.environ.get("MC_DEV_URL", "http://127.0.0.1:8890/")
fixture = json.loads((ROOT / "tests/fixtures/layout-v2.json").read_text())
fixture["reducedMotion"] = True
errors = []
results = {}

COMPARE = r"""async (preserveOrder = false) => {
  const T = await import('/node_modules/.vite/deps/three.js');
  const w=mcDebug.world, r=w.renderer;
  cancelAnimationFrame(w.raf);
  w.update(true);
  const {colorBatchMaterial}=await import('/src/models.js');
  if(!colorBatchMaterial)throw Error('Color batching is not installed in this checkout.');
  const batches=w.batch.filter(b=>colorBatchMaterial(b.objects[0].material)===b.mesh.material);
  if(!batches.length) throw Error('No color-instanced block batches in this scene');
  const old={target:r.getRenderTarget(),viewport:r.getViewport(new T.Vector4()),
    scissor:r.getScissor(new T.Vector4()),scissorTest:r.getScissorTest(),
    shadowAuto:r.shadowMap.autoUpdate,shadowUpdate:r.shadowMap.needsUpdate,
    dpr:r.getPixelRatio(),shadowEnabled:r.shadowMap.enabled,shadowType:r.shadowMap.type,
    canvas:[r.domElement.width,r.domElement.height], children:w.scene.children.slice(),
    toneMapping:r.toneMapping,toneMappingExposure:r.toneMappingExposure,output:r.outputColorSpace};
  const size=new T.Vector2();r.getDrawingBufferSize(size);
  const width=Math.round(size.x),height=Math.round(size.y);
  const target=new T.WebGLRenderTarget(width,height,{format:T.RGBAFormat,type:T.UnsignedByteType,
    colorSpace:T.SRGBColorSpace,depthBuffer:true,samples:4});
  const reference=[], originals=[], savedOrders=[], mat=new T.Matrix4();
  const a=new Uint8Array(width*height*4),b=new Uint8Array(a.length),c=new Uint8Array(a.length);
  const resourceBefore={...r.info.memory,programs:r.info.programs.length};
  let result;
  const render=(pixels)=>{
    r.info.reset();target.viewport.set(0,0,width,height);target.scissor.set(0,0,width,height);target.scissorTest=false;
    r.setRenderTarget(null);r.setRenderTarget(target);
    r.clear();r.render(w.scene,w.camera);r.readRenderTargetPixels(target,0,0,width,height,pixels);
    return {calls:r.info.render.calls,triangles:r.info.render.triangles};
  };
  try {
    // First establish shadows using the production instances. Reuse the same
    // static shadow maps for both outputs so only material batching changes.
    r.shadowMap.autoUpdate=false;r.shadowMap.needsUpdate=true;render(c);
    r.shadowMap.needsUpdate=false;
    if(preserveOrder){
      // Keep the production opaque primitive order while removing instance
      // tinting. This isolates shader colors from coplanar draw-order seams.
      const opaque=r.renderLists.get(w.scene,0).opaque;
      opaque.forEach(({object},i)=>{
        savedOrders.push({object,order:object.renderOrder});object.renderOrder=i+1;
      });
    }
    const actual=render(a);
    const productionOrderPixelMismatches=preserveOrder?c.reduce((n,v,i)=>n+(v!==a[i]),0):0;
    for(const batch of batches){
      const groups=new Map(),runs=[];
      batch.objects.forEach((o,i)=>{
        const key=o.material.uuid;
        if(!groups.has(key))groups.set(key,{material:o.material,indices:[]});
        groups.get(key).indices.push(i);
        if(runs.at(-1)?.material!==o.material)runs.push({material:o.material,indices:[]});
        runs.at(-1).indices.push(i);
      });
      originals.push({mesh:batch.mesh,visible:batch.mesh.visible});
      for(const {material,indices} of preserveOrder?runs:groups.values()){
        const ref=new T.InstancedMesh(batch.mesh.geometry,material,indices.length);
        ref.castShadow=batch.mesh.castShadow;ref.receiveShadow=batch.mesh.receiveShadow;
        ref.frustumCulled=batch.mesh.frustumCulled;ref.renderOrder=batch.mesh.renderOrder;
        if(preserveOrder)ref.renderOrder+=indices[0]/(batch.objects.length+1);
        ref.matrix.copy(batch.mesh.matrix);ref.matrixAutoUpdate=false;
        ref.visible=batch.mesh.visible;
        for(let j=0;j<indices.length;j++){batch.mesh.getMatrixAt(indices[j],mat);ref.setMatrixAt(j,mat);}
        ref.instanceMatrix.needsUpdate=true;
        w.scene.add(ref);reference.push(ref);
      }
      batch.mesh.visible=false;
    }
    const unbatched=render(b);
    let maxDifference=0,overOnePixels=0,changedPixels=0,sum=0,alphaMismatches=0;
    const samples=[];
    for(let i=0;i<a.length;i+=4){
      let delta=0;
      for(let k=0;k<3;k++){const d=Math.abs(a[i+k]-b[i+k]);delta=Math.max(delta,d);sum+=d;}
      maxDifference=Math.max(maxDifference,delta);
      if(delta)changedPixels++;
      if(delta>1){overOnePixels++;if(samples.length<12)samples.push({x:(i/4)%width,y:Math.floor(i/4/width),actual:[...a.slice(i,i+4)],reference:[...b.slice(i,i+4)]});}
      if(a[i+3]!==b[i+3])alphaMismatches++;
    }
    result={width,height,comparedPixels:width*height,colorBatches:batches.length,
      productionOrderPixelMismatches,
      referenceBatches:reference.length,instances:batches.reduce((n,b)=>n+b.objects.length,0),
      actual,reference:unbatched,maxDifference,changedPixels,overOnePixels,alphaMismatches,
      meanChannelDifference:sum/(width*height*3),withinOneRgb:overOnePixels===0&&alphaMismatches===0,samples};
  } finally {
    for(const ref of reference){w.scene.remove(ref);ref.dispose();}
    for(const {mesh,visible} of originals)mesh.visible=visible;
    // Compare the restored production graph with its initial pixels as well.
    r.shadowMap.needsUpdate=false;render(c);
    if(result)result.restoredPixelMismatches=c.reduce((n,v,i)=>n+(v!==a[i]),0);
    for(const {object,order} of savedOrders)object.renderOrder=order;
    r.setRenderTarget(old.target);r.setViewport(old.viewport);r.setScissor(old.scissor);
    r.setScissorTest(old.scissorTest);r.shadowMap.autoUpdate=old.shadowAuto;
    r.shadowMap.needsUpdate=old.shadowUpdate;target.dispose();
  }
  result.stateRestored=r.getPixelRatio()===old.dpr&&r.shadowMap.enabled===old.shadowEnabled&&
    r.shadowMap.type===old.shadowType&&r.domElement.width===old.canvas[0]&&r.domElement.height===old.canvas[1]&&
    r.toneMapping===old.toneMapping&&r.toneMappingExposure===old.toneMappingExposure&&r.outputColorSpace===old.output&&
    r.getRenderTarget()===old.target&&r.getViewport(new T.Vector4()).equals(old.viewport)&&
    r.getScissor(new T.Vector4()).equals(old.scissor)&&r.getScissorTest()===old.scissorTest&&
    w.scene.children.length===old.children.length&&w.scene.children.every((o,i)=>o===old.children[i]);
  result.quality={dpr:old.dpr,shadowEnabled:old.shadowEnabled,shadowType:old.shadowType,
    toneMapping:old.toneMapping,exposure:old.toneMappingExposure,outputColorSpace:old.output};
  result.resources={before:resourceBefore,after:{...r.info.memory,programs:r.info.programs.length}};
  result.glError=r.getContext().getError();
  result.preservedPrimitiveOrder=!!preserveOrder;
  return result;
}"""

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=["--use-angle=metal"])
    page = browser.new_page(viewport={"width": int(os.environ.get("MC_WIDTH",1280)), "height": int(os.environ.get("MC_HEIGHT",900))}, device_scale_factor=float(os.environ.get("MC_DPR",1)))
    page.on("pageerror", lambda e: errors.append(str(e)))
    try:
        page.goto(URL, wait_until="networkidle")
        page.wait_for_function("window.mcDebug && mcDebug.world")
        for name in ["mature", "nether", "end", "studio"]:
            raw = dict(fixture)
            raw["realm"] = name if name in ["nether", "end"] else "overworld"
            page.evaluate("s=>mcDebug.setState(s)", raw)
            page.evaluate("mcDebug.go('world')")
            if name == "studio":
                page.evaluate("mcDebug.go('live')")
                page.wait_for_function("mcDebug.world.interior")
            page.wait_for_timeout(120)
            page.evaluate("window.dispatchEvent(new Event('blur'))")
            results[name] = page.evaluate(COMPARE)
            results[name]["orderedReference"] = page.evaluate(COMPARE, True)
            print(name, json.dumps(results[name], ensure_ascii=False), flush=True)
    finally:
        browser.close()
results["errors"] = errors
OUT.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n")
assert not errors, errors
for name, result in results.items():
    if name == "errors":
        continue
    # Keeping primitive order proves the color shader itself is equivalent.
    # User permits up to 5% affected pixels; record amplitude separately.
    # Preserve geometric and renderer invariants independently of that threshold.
    ordered = result["orderedReference"]
    assert ordered["withinOneRgb"], f"{name}: tint shader changed colors {ordered}"
    assert ordered["productionOrderPixelMismatches"] == 0, name
    assert ordered["restoredPixelMismatches"] == 0 and ordered["stateRestored"], name
    assert result["changedPixels"] / result["comparedPixels"] <= 0.05, name
    assert result["meanChannelDifference"] / 255 <= 0.05, name
    assert result["stateRestored"] and result["restoredPixelMismatches"] == 0, name
    assert result["glError"] == 0, name
    assert result["actual"]["calls"] < result["reference"]["calls"], name
