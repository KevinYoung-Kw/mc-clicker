"""Exercise live character rigs, GPU instance uploads and synchronous resize repaint.

Runs an isolated development browser. The fixture uses the game's own purchase,
assignment, travel and studio handover rules. GPU readbacks are QA instrumentation,
not a frame-rate benchmark, and no instrumentation is included in production.
"""
import json
import os
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs/qa"
URL = os.environ.get("MC_DEV_URL", "http://127.0.0.1:8890/")
SEED_JS = """
import {residentFixture} from './scripts/resident-fixture.mjs';
import {assignJob,studioResidents} from './src/residents.js';
import {advance} from './src/game.js';
const s=residentFixture();s.reducedMotion=false;
const jobs=['farmer','miner','rancher','crafter','hauler','engineer','stagehand','host','musician'];
for(let i=0;i<jobs.length;i++){
 const r=assignJob(s,s.community.residents[i].id,jobs[i]);if(!r.ok)throw Error(r.reason);
}
for(let i=0;i<480;i++)advance(s,.25);
if(studioResidents(s).length!==2)throw Error('Real studio entry did not complete');
s.live.director=false;s.live.host=0;s.realm='overworld';
console.log(JSON.stringify(s));
"""
state = json.loads(subprocess.run(["node", "--input-type=module", "--eval", SEED_JS], cwd=ROOT, capture_output=True, text=True, check=True).stdout)
errors = []
report = {"url": URL, "checks": {}, "errors": errors, "viewports": {}}

PROBE_JS = r"""(()=>{
  const probe=window.livingResizeProbe={armed:false,records:[]};
  const snapshot=()=>{const w=window.mcDebug?.world,s=window.mcDebug?.state;return {money:s?.money,time:w?.time,play:s?.play,target:w?.target?.toArray(),displayYaw:w?.displayYaw,displaySize:w?.displaySize};};
  const states=new WeakMap();
  const record=c=>{if(!states.has(c))states.set(c,{draws:0,lastDraw:0,lastWidth:0,lastHeight:0,pending:null,gl:null});return states.get(c);};
  for(const name of ['width','height']){
    const native=Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype,name);
    Object.defineProperty(HTMLCanvasElement.prototype,name,{...native,set(value){
      const p=record(this),track=probe.armed&&this.matches('#world canvas');
      if(track&&!p.pending){
        const task=p.pending={before:snapshot(),firstResize:performance.now(),drawsBefore:p.draws};
        queueMicrotask(()=>{
          const after=snapshot(),gl=p.gl,pixels=new Uint8Array(this.width*this.height*4),colors=new Set();
          if(gl){gl.readPixels(0,0,this.width,this.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
            const stride=Math.max(1,Math.floor(this.width*this.height/512));
            for(let i=0;i<this.width*this.height;i+=stride)colors.add([...pixels.slice(i*4,i*4+4)].join(','));}
          probe.records.push({...task,after,width:this.width,height:this.height,lastDraw:p.lastDraw,
            draws:p.draws-task.drawsBefore,sameTaskDraw:p.lastDraw>=task.lastResize&&p.lastWidth===this.width&&p.lastHeight===this.height,
            colors:colors.size,unchanged:JSON.stringify(task.before)===JSON.stringify(after),glError:gl?.getError()??0});
          p.pending=null;
        });
      }
      native.set.call(this,value);
      if(track){p.pending.lastResize=performance.now();p.pending.lastAttribute=name;}
    }});
  }
  for(const Proto of [window.WebGLRenderingContext?.prototype,window.WebGL2RenderingContext?.prototype].filter(Boolean)){
    const bind=Proto.bindFramebuffer;
    Proto.bindFramebuffer=function(target,buffer){if(target===this.FRAMEBUFFER||target===this.DRAW_FRAMEBUFFER)this.__livingTarget=buffer;return bind.apply(this,arguments)};
    for(const name of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']){
      const draw=Proto[name];if(!draw)continue;
      Proto[name]=function(){const result=draw.apply(this,arguments);if(!this.__livingTarget){const p=record(this.canvas);p.gl=this;p.draws++;p.lastDraw=performance.now();p.lastWidth=this.canvas.width;p.lastHeight=this.canvas.height;}return result};
    }
  }
})();"""

MOTION_JS = r"""async()=>{
  const w=mcDebug.world,s=mcDebug.state;
  cancelAnimationFrame(w.raf);window.dispatchEvent(new Event('blur'));
  const residents=[];w.graph.traverse(o=>{if(o.userData.resident)residents.push(o)});
  const gl=w.renderer.getContext(),arrays=new Set(w.batch.map(b=>b.mesh.instanceMatrix.array)),original=gl.bufferSubData;
  let uploads=0,gpuValues=0,gpuMismatches=0,cpuMismatches=0;
  let sampledFrames=0,resourceStart;const drawSamples={regular:[],shadowRefresh:[]};
  const resources=()=>{
    const meshes=new Set(),geometries=new Set(),materials=new Set();
    for(const root of [w.scene,w.graph])root.traverse(o=>{if(o.isMesh){meshes.add(o.uuid);geometries.add(o.geometry.uuid);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m.uuid);}});
    return {meshes:meshes.size,geometries:geometries.size,materials:materials.size,batches:w.batch.length,
      instances:w.batch.reduce((n,b)=>n+b.mesh.count,0),gpuGeometries:w.renderer.info.memory.geometries,
      gpuTextures:w.renderer.info.memory.textures,shaderPrograms:w.renderer.info.programs.length};
  };
  const verify=()=>{for(const b of w.batch)for(let j=0;j<b.dynamicObjects.length;j++){
    const {o,parents}=b.dynamicObjects[j],expected=parents.every(p=>p.visible)?o.matrixWorld.elements:w.zeroMatrix.elements;
    for(let k=0;k<16;k++)if(b.mesh.instanceMatrix.array[(b.firstDynamic+j)*16+k]!==Math.fround(expected[k]))cpuMismatches++;
  }};
  gl.bufferSubData=function(target,offset,data,from=0,length){const result=original.apply(this,arguments);
    if(target===gl.ARRAY_BUFFER&&arrays.has(data)){const n=length??data.length-from,out=new Float32Array(n);gl.getBufferSubData(target,offset,out);uploads++;gpuValues+=n;for(let i=0;i<n;i++)if(out[i]!==data[from+i])gpuMismatches++;}return result};
  const originalRows=s.community.residents.map(r=>({r,activity:r.activity,cargo:r.cargo,path:r.path})),modes={};
  const wallet=s.money,play=s.play,stamp=o=>{
    let head,body;o.traverse(p=>{if(p.userData.mobPart==='head')head=p;if(p.userData.mobPart==='body')body=p});
    return {head:head?.matrix.toArray(),body:body?.matrix.toArray(),pose:o.userData.residentMotion};
  };
  try{
    for(const activity of ['idle','working','travel']){
      const samples=Object.fromEntries(residents.map(o=>[o.userData.resident,{head:new Set(),body:new Set(),actions:new Set()}]));
      for(const {r} of originalRows){r.activity=activity;r.path=[];r.cargo=null;}
      for(let frame=0;frame<80;frame++){
        const shadowBefore=w.shadowAt;
        w.time=20+frame*.06;w.update(false,true);verify();sampledFrames++;
        if(sampledFrames===21)resourceStart=resources();
        if(sampledFrames>21)drawSamples[w.shadowAt===shadowBefore?'regular':'shadowRefresh'].push(w.renderer.info.render.calls);
        for(const o of residents){const p=stamp(o),row=samples[o.userData.resident];row.head.add(JSON.stringify(p.head));row.body.add(JSON.stringify(p.body));row.actions.add(p.pose?.action);}
      }
      modes[activity]=Object.fromEntries(Object.entries(samples).map(([id,p])=>[id,{headFrames:p.head.size,bodyFrames:p.body.size,actions:[...p.actions]}]));
    }
    const resourceEnd=resources(),resourceStability={frames:sampledFrames-21,before:resourceStart,after:resourceEnd,
      stable:JSON.stringify(resourceStart)===JSON.stringify(resourceEnd),
      drawCalls:Object.fromEntries(Object.entries(drawSamples).map(([kind,samples])=>[kind,{frames:samples.length,min:samples.length?Math.min(...samples):null,max:samples.length?Math.max(...samples):null,distinct:[...new Set(samples)].sort((a,b)=>a-b)}]))};
    if(residents.length){residents[0].visible=false;w.time+=.06;w.update(false,true);verify();residents[0].visible=true;w.time+=.06;w.update(false,true);verify();}
    for(const row of originalRows){row.r.activity=row.activity;row.r.cargo=row.cargo;row.r.path=row.path;}
    s.reducedMotion=true;w.update(false,true);const before=residents.map(stamp);
    for(let i=0;i<15;i++){w.time+=.2;w.update(false,true);verify();}
    const reducedStatic=JSON.stringify(before)===JSON.stringify(residents.map(stamp));
    s.reducedMotion=false;
    return {residents:residents.map(o=>({id:o.userData.resident,room:o.userData.room||'overworld',job:s.community.residents.find(r=>r.id===o.userData.resident)?.job})),modes,reducedStatic,
      uploads,gpuValues,gpuMismatches,cpuMismatches,resourceStability,economyUnchanged:s.money===wallet&&s.play===play,glError:gl.getError()};
  }finally{gl.bufferSubData=original;for(const row of originalRows){row.r.activity=row.activity;row.r.cargo=row.cargo;row.r.path=row.path;}s.reducedMotion=false;}
}"""

def take(page, name):
    page.evaluate("mcDebug.world.update(false,true)")
    page.screenshot(path=str(OUT / f"living-motion-{name}.png"))

def make_study(browser):
    """Render the same resident rigs at three activities with a fixed sample clock."""
    context = browser.new_context(viewport={"width": 1280, "height": 900})
    try:
        page = context.new_page()
        page.goto(URL + "scripts/icon-studio.html", wait_until="networkidle")
        cards = page.evaluate(r"""async()=>{
          const T=await import('/node_modules/.vite/deps/three.js'),{makeResident}=await import('/src/companion-models.js'),{appearance}=await import('/src/residents.js');
          const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(198,218);renderer.setPixelRatio(1);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
          const scene=new T.Scene();scene.background=new T.Color('#e6eadc');scene.add(new T.HemisphereLight('#fff3da','#75856e',2.2));const key=new T.DirectionalLight('#fff0d7',3.2);key.position.set(-4,8,6);scene.add(key);
          const camera=new T.OrthographicCamera(-.68,.68,.85,-.65,.01,100);camera.position.set(3,2.1,5);camera.lookAt(0,.52,0);
          const cards=[];
          for(const [i,job] of ['idle','farmer','miner','rancher','crafter','hauler','musician','engineer','stagehand','host'].entries()){
            const poses=[];
            for(const activity of ['idle','working','travel']){
              const r={id:'resident-'+(i+1),look:appearance(i),job,activity,skills:{}},animations=[],g=makeResident(scene,r,animations,{scale:.85,indoor:job==='host',speaking:()=>true});
              for(let t=0;t<5;t+=.02)animations.forEach(fn=>fn(t));renderer.render(scene,camera);
              poses.push({activity,action:g.userData.residentMotion.action,image:renderer.domElement.toDataURL()});scene.remove(g);
            }
            cards.push({job,poses});
          }
          renderer.dispose();return cards;
        }""")
        report["modelStudy"] = [{"job": card["job"], "poses": [{k: pose[k] for k in ["activity", "action"]} for pose in card["poses"]]} for card in cards]
        page.set_content('<body style="margin:0;padding:22px;background:#f6f2e6;color:#315347;font:14px sans-serif"><h1 style="margin:0 0 6px">Living residents · the same rig across activities</h1><p style="margin:0 0 20px">Deterministic sample at 5 s · idle / working / travel · game models and materials</p><main style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px">' + ''.join(
            '<section style="background:#e6eadc;padding:10px"><h2 style="margin:0 0 6px;font-size:19px">' + card["job"] + '</h2><div style="display:flex">' + ''.join(
                '<figure style="margin:0;width:33.3%;text-align:center"><img style="width:100%" src="' + pose["image"] + '"><figcaption>' + pose["activity"] + '<br><small>' + pose["action"] + '</small></figcaption></figure>' for pose in card["poses"]
            ) + '</div></section>' for card in cards
        ) + '</main></body>')
        page.screenshot(path=str(OUT / "living-motion-resident-model-study.png"), full_page=True)
    finally:
        context.close()

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=["--use-angle=metal"])
    try:
        for name, width, height in [("desktop", 1280, 900), ("mobile", 390, 844)]:
            context = browser.new_context(viewport={"width": width, "height": height}, has_touch=name=="mobile", is_mobile=name=="mobile", device_scale_factor=1)
            context.add_init_script(PROBE_JS)
            page=context.new_page();page.on("pageerror",lambda e:errors.append(str(e)))
            page.goto(URL,wait_until="networkidle");page.wait_for_function("window.mcDebug && mcDebug.world")
            page.evaluate("s=>mcDebug.setState(s)",state);page.evaluate("mcDebug.go('world')")
            page.wait_for_timeout(150)
            row=report["viewports"][name]={}
            row["outdoorMotion"]=page.evaluate(MOTION_JS)
            take(page,f"{name}-village")
            page.locator('[data-nav="live"]').click();page.wait_for_function("mcDebug.world.interior")
            row["indoorMotion"]=page.evaluate(MOTION_JS)
            ids=row["indoorMotion"]["residents"]
            assert {r["job"] for r in ids}=={"host","musician"},ids
            assert len(ids)==2 and len({r["id"] for r in ids})==2,ids
            take(page,f"{name}-studio")
            # Blur suspends economics but repaint remains available. Native size
            # setters queue a microtask: its readback must see the fresh frame.
            page.evaluate("livingResizeProbe.armed=true;livingResizeProbe.records=[]")
            for _ in range(2):
                page.locator('[data-room-tab="equipment"]').click();page.wait_for_timeout(140)
                page.locator('#room-close-panel').click();page.wait_for_timeout(180)
            row["resize"]=page.evaluate("livingResizeProbe.records")
            page.evaluate("livingResizeProbe.armed=false")
            assert row["resize"],f"{name} no native resize observed"
            for sample in row["resize"]:
                assert sample["sameTaskDraw"] and sample["draws"]>0,sample
                assert sample["colors"]>4 and sample["glError"]==0,sample
                assert sample["unchanged"],sample
            take(page,f"{name}-studio-panel-closed")
            # Exercise the actual foreground event handlers while leaving the
            # WebGL page alive; no private game-clock method is replaced.
            page.evaluate("window.dispatchEvent(new Event('focus'))")
            page.wait_for_timeout(120)
            before=page.evaluate("window.dispatchEvent(new Event('blur'));({money:mcDebug.state.money,play:mcDebug.state.play,time:mcDebug.world.time,active:mcDebug.world.active})")
            page.wait_for_timeout(700)
            after=page.evaluate("({money:mcDebug.state.money,play:mcDebug.state.play,time:mcDebug.world.time,active:mcDebug.world.active})")
            row["background"]={"before":before,"after":after,"event":"window blur"}
            assert before==after and not after["active"],row["background"]
            row["noOverflow"]=page.evaluate("document.documentElement.scrollWidth<=innerWidth")
            context.close()
        make_study(browser)
    finally:
        browser.close()

for name,row in report["viewports"].items():
    assert row["noOverflow"],name
    for mode in ["outdoorMotion","indoorMotion"]:
        data=row[mode]
        assert data["economyUnchanged"] and data["reducedStatic"],(name,mode,data)
        assert data["uploads"]>0 and data["gpuValues"]>0,(name,mode)
        assert data["gpuMismatches"]==data["cpuMismatches"]==data["glError"]==0,(name,mode,data)
        stability=data["resourceStability"]
        assert stability["frames"]>=200 and stability["stable"],(name,mode,stability)
        assert len(stability["drawCalls"]["regular"]["distinct"])==1,(name,mode,stability)
        for activity,people in data["modes"].items():
            assert all(p["headFrames"]>2 and p["bodyFrames"]>2 for p in people.values()),(name,mode,activity,people)
report["checks"]={"differentProfessionAndActivityPoses":True,"realHostAndMusicianIdentities":True,"actualGpuUploadsMatchSourceMatrices":True,"resourcesAndRegularDrawCallsStableOver200Frames":True,"reducedMotionStatic":True,"sameTaskResizeDrawWithNonblankPixels":True,"resizePreservesMoneyClockAndCameraTransition":True,"backgroundPausesIncomeAndAnimationTime":True,"desktopAnd390pxNoOverflow":True}
report["passed"]=not errors
(OUT/"living-motion-observations.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n")
assert not errors,errors
print(json.dumps({"passed":report["passed"],"checks":report["checks"],"resizeTasks":{k:len(v["resize"]) for k,v in report["viewports"].items()}},ensure_ascii=False,indent=2))
