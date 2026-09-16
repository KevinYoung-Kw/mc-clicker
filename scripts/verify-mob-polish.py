"""Check real instance uploads and render the revised voxel models without changing quality."""
import base64
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs' / 'qa'
URL = os.environ.get('MC_DEV_URL', 'http://127.0.0.1:8890/')
fixture = json.loads((ROOT / 'tests/fixtures/layout-v2.json').read_text())
results = {}
errors = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--use-angle=metal'])
    page = browser.new_page(viewport={'width':1440,'height':960}, device_scale_factor=1)
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(URL, wait_until='networkidle')
    page.wait_for_function('window.mcDebug && mcDebug.world')
    for phase in ['early', 'mature']:
        if phase == 'early':
            page.evaluate("""async()=>{const {fresh}=await import('/src/game.js');mcDebug.setState(fresh())}""")
        else:
            page.evaluate('s=>mcDebug.setState(s)', fixture)
        page.evaluate("""()=>{window.dispatchEvent(new Event('blur'));mcDebug.go('world');cancelAnimationFrame(mcDebug.world.raf)}""")
        results[phase] = page.evaluate("""async()=>{
          const w=mcDebug.world,gl=w.renderer.getContext();w.state.reducedMotion=false;w.update(true);
          const arrays=new Set(w.batch.map(b=>b.mesh.instanceMatrix.array)),original=gl.bufferSubData;
          let uploads=0,gpuComparedValues=0,gpuMismatches=0,cpuMismatches=0;
          gl.bufferSubData=function(target,offset,data,from=0,length){
            const result=original.apply(this,arguments);
            if(target===gl.ARRAY_BUFFER && arrays.has(data)){
              const n=length??data.length-from,out=new Float32Array(n);
              gl.getBufferSubData(target,offset,out);uploads++;gpuComparedValues+=n;
              for(let i=0;i<n;i++)if(out[i]!==data[from+i])gpuMismatches++;
            }return result;
          };
          const verify=()=>{let failures=0;for(const b of w.batch)for(let j=0;j<b.dynamicObjects.length;j++){
            const {o,parents}=b.dynamicObjects[j],expected=parents.every(p=>p.visible)?o.matrixWorld.elements:w.zeroMatrix.elements;
            for(let k=0;k<16;k++)if(b.mesh.instanceMatrix.array[(b.firstDynamic+j)*16+k]!==Math.fround(expected[k]))failures++;
          }return failures;};
          try{
            for(let i=0;i<40;i++){await new Promise(requestAnimationFrame);w.time+=.035;w.yaw+=.002;w.update(true);cpuMismatches+=verify()}
            const root=w.dynamicRoots[0];root.visible=false;w.update(true);cpuMismatches+=verify();root.visible=true;w.update(true);cpuMismatches+=verify();
          }finally{gl.bufferSubData=original}
          return {frames:40,uploads,gpuComparedValues,gpuMismatches,cpuMismatches,glError:gl.getError(),
            dynamicInstances:w.batch.reduce((n,b)=>n+b.dynamicObjects.length,0),
            shadowEnabled:w.renderer.shadowMap.enabled,shadowType:w.renderer.shadowMap.type,
            pixelRatio:w.renderer.getPixelRatio(),memory:{...w.renderer.info.memory}};
        }""")
        assert results[phase]['cpuMismatches'] == results[phase]['gpuMismatches'] == results[phase]['glError'] == 0
        assert results[phase]['uploads'] > 0
        page.screenshot(path=str(OUT / f'mob-polish-{phase}-world.png'))
    # A larger original-code model study keeps each shape and carrying pose inspectable.
    data = page.evaluate("""async()=>{
      const T=await import('/node_modules/.vite/deps/three.js'),{makeActor}=await import('/src/objects.js'),
      {makeCopper,makeResident}=await import('/src/companion-models.js'),{appearance}=await import('/src/residents.js');
      const r=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});r.setSize(1440,820);
      r.setPixelRatio(1);r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=1.12;
      r.shadowMap.enabled=true;r.shadowMap.type=T.PCFSoftShadowMap;
      const s=new T.Scene();s.background=new T.Color('#e5eadc');
      s.add(new T.HemisphereLight('#fff3da','#75856e',2.2));
      const light=new T.DirectionalLight('#fff0d7',3.2);light.position.set(-4,8,6);light.castShadow=true;
      light.shadow.mapSize.set(1024,1024);light.shadow.camera.left=-5;light.shadow.camera.right=5;
      light.shadow.camera.top=5;light.shadow.camera.bottom=-5;s.add(light);
      const fill=new T.DirectionalLight('#daeafa',1);fill.position.set(6,3,-4);s.add(fill);
      const anim=[],roots=[];
      const resident=makeResident(s,{id:'qa-resident',look:appearance(7),job:'farmer',skills:{},path:[]},anim);resident.position.x=-2.6;roots.push(resident);
      const copper=makeCopper(s,{id:'golem-2',upgrades:{basket:1,sorting:1,bell:1},cargo:{amount:1},path:[{}]},anim);copper.position.x=-.9;roots.push(copper);
      const iron=makeActor(s,'V16',anim);iron.position.x=.9;roots.push(iron);
      const flame=makeActor(s,'N3',anim);flame.position.x=2.6;roots.push(flame);
      for(const root of roots)root.rotation.y=-.32;
      for(const f of anim)f(.8);
      for(const x of [-2.6,-.9,.9,2.6]){
        const base=new T.Mesh(new T.BoxGeometry(1.42,.13,1.08),new T.MeshStandardMaterial({color:'#b7c99e',roughness:1}));
        base.position.set(x,-.08,0);base.receiveShadow=true;s.add(base);
      }
      const camera=new T.OrthographicCamera(-3.9,3.9,2.2,-2.2,.01,100);camera.position.set(1.8,3.1,9);camera.lookAt(0,.48,0);r.render(s,camera);
      const url=r.domElement.toDataURL('image/png');r.dispose();return url;
    }""")
    (OUT / 'mob-polish-model-study.png').write_bytes(base64.b64decode(data.split(',')[1]))
    browser.close()
results['errors'] = errors
assert not errors, errors
(OUT / 'mob-polish-observations.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(results,ensure_ascii=False,indent=2))
