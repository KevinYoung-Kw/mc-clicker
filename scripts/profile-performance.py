"""Profile one dev checkout with unchanged prebuilt fixtures; requires mcDebug.

Use --output with a separate directory per checkout. Fixture directory must
contain crowd-fixture.json and complete-fixture.json generated with the real
purchase rules. Run both versions on the same browser/GPU, without concurrent
GPU tests. CPU profiles are sampling evidence, not deterministic wall timings.
"""

import json, time, argparse
from pathlib import Path
from collections import defaultdict
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--url", required=True)
parser.add_argument("--fixtures", required=True)
parser.add_argument("--output", required=True)
parser.add_argument("--label", default="checkout")
parser.add_argument("--reference-head", default="unspecified")
parser.add_argument("--sample-ms", type=int, default=5000)
options = parser.parse_args()
OUT = Path(options.output)
OUT.mkdir(parents=True, exist_ok=True)
FIXTURES = Path(options.fixtures)
BASE = options.url


def summarize_cpu(profile):
    nodes = {n["id"]: n for n in profile["nodes"]}
    parents = {c: n["id"] for n in profile["nodes"] for c in n.get("children", [])}
    direct = defaultdict(float)
    cumulative = defaultdict(float)

    def key(n):
        f = nodes[n]["callFrame"]
        return f"{f['functionName'] or '(anonymous)'} {f['url'].split('/')[-1]}:{f['lineNumber'] + 1}"

    for ident, delta in zip(profile.get("samples", []), profile.get("timeDeltas", [])):
        direct[key(ident)] += delta / 1000
        seen = set()
        while ident in nodes:
            k = key(ident)
            if k not in seen:
                cumulative[k] += delta / 1000
                seen.add(k)
            ident = parents.get(ident)
    return {
        "selfMs": sorted(direct.items(), key=lambda x: -x[1])[:35],
        "inclusiveMs": sorted(cumulative.items(), key=lambda x: -x[1])[:35],
    }


INSTRUMENT = """() => {
const w=mcDebug.world,samples={};
window.__perf={samples,frames:[],long:[],collect:false};
new PerformanceObserver(list=>{for(const e of list.getEntries())if(__perf.collect&&e.startTime>=__perf.startedAt)__perf.long.push({start:e.startTime,duration:e.duration});}).observe({entryTypes:['longtask']});
for(const [object,method,name] of [[w,'update','worldUpdate'],[w,'sync','worldSync'],[w,'updateWalkers','walkers'],[w,'buildInstances','buildInstances'],[w,'resize','resize'],[w.renderer,'render','renderCPU'],[w.atmosphereView,'update','atmosphere']]){
 const original=object[method];object[method]=function(...args){const start=performance.now();const result=original.apply(this,args);if(__perf.collect)(samples[name]||=[]).push(performance.now()-start);return result;};
}
let last;function frame(t){if(__perf.collect&&last)__perf.frames.push(t-last);last=t;requestAnimationFrame(frame)}requestAnimationFrame(frame);
window.__startSample=()=>{for(const k in samples) samples[k]=[];__perf.frames=[];__perf.long=[];__perf.startedAt=performance.now();__perf.collect=true;};
window.__endSample=()=>{__perf.collect=false;const stats=a=>{a=[...a].sort((a,b)=>a-b);return{count:a.length,total:a.reduce((a,b)=>a+b,0),p50:a[Math.floor(a.length*.5)]||0,p95:a[Math.floor(a.length*.95)]||0,p99:a[Math.floor(a.length*.99)]||0,max:a.at(-1)||0};};return{methods:Object.fromEntries(Object.entries(samples).map(([k,a])=>[k,stats(a)])),frames:stats(__perf.frames),longTasks:__perf.long,render:{...w.renderer.info.render},memory:{...w.renderer.info.memory},programs:w.renderer.info.programs.length,instances:w.batch.reduce((n,b)=>n+b.objects.length,0),dynamicInstances:w.batch.reduce((n,b)=>n+b.dynamicObjects.length,0),dynamicRoots:w.dynamicRoots.length,walkers:w.walkers.length,caches:w.caches.size};};
}"""
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=["--use-angle=metal"])
    context = browser.new_context(
        viewport={"width": 1440, "height": 960}, device_scale_factor=1
    )
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.add_init_script(
        """window.__firstDraw=null;for(const C of [window.WebGLRenderingContext,window.WebGL2RenderingContext])if(C)for(const k of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){const f=C.prototype[k];if(!f)continue;C.prototype[k]=function(...a){window.__firstDraw??=performance.now();C.prototype[k]=f;return f.apply(this,a);};}"""
    )
    cdp = context.new_cdp_session(page)
    cdp.send("Profiler.enable")
    cdp.send("Profiler.setSamplingInterval", {"interval": 1000})
    started = time.perf_counter()
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_function("window.mcDebug?.world")
    wall = (time.perf_counter() - started) * 1000
    result = {
        "label": options.label,
        "referenceHead": options.reference_head,
        "viewport": "1440x960",
        "coldLoad": page.evaluate(
            """()=>({firstDraw:__firstDraw,nav:performance.getEntriesByType('navigation')[0].toJSON(),resources:performance.getEntriesByType('resource').map(r=>({name:r.name,duration:r.duration,encoded:r.encodedBodySize,decoded:r.decodedBodySize})),heap:performance.memory?{used:performance.memory.usedJSHeapSize,total:performance.memory.totalJSHeapSize}:null})"""
        ),
        "gotoNetworkIdleMs": wall,
    }
    result["renderer"] = page.evaluate(
        """()=>{const gl=mcDebug.world.renderer.getContext(),e=gl.getExtension('WEBGL_debug_renderer_info');return e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):'unknown'}"""
    )
    page.evaluate(INSTRUMENT)

    def sample(label, setup=None):
        if setup:
            page.evaluate(
                "fixture=>mcDebug.setState(fixture)",
                json.loads((FIXTURES / setup).read_text()),
            )
        page.wait_for_timeout(1000)
        cdp.send("HeapProfiler.collectGarbage")
        before = cdp.send("Runtime.getHeapUsage")
        page.evaluate("__startSample()")
        cdp.send("Profiler.start")
        page.wait_for_timeout(options.sample_ms)
        profile = cdp.send("Profiler.stop")["profile"]
        metrics = page.evaluate("__endSample()")
        cdp.send("HeapProfiler.collectGarbage")
        metrics["heapBefore"] = before
        metrics["heapAfter"] = cdp.send("Runtime.getHeapUsage")
        metrics["cpu"] = summarize_cpu(profile)
        (OUT / f"{label}.cpuprofile").write_text(json.dumps(profile))
        result[label] = metrics
        (OUT / "baseline.json").write_text(json.dumps(result, indent=2))
        print(
            label,
            json.dumps(
                {k: v for k, v in metrics.items() if k not in ["cpu", "longTasks"]}
            ),
            flush=True,
        )

    sample("starter")
    sample("crowd", "crowd-fixture.json")
    sample("complete", "complete-fixture.json")
    # Native button switches include UI handlers and model construction.
    page.evaluate("__startSample()")
    cdp.send("Profiler.start")
    actions = page.evaluate(
        """async()=>{const out=[];for(let n=0;n<5;n++)for(const realm of ['nether','end','overworld']){const t=performance.now();document.querySelector('[data-realm='+realm+']').click();out.push({realm,ms:performance.now()-t});await new Promise(r=>setTimeout(r,150));}return out;}"""
    )
    profile = cdp.send("Profiler.stop")["profile"]
    switches = page.evaluate("__endSample()")
    switches["actions"] = actions
    switches["cpu"] = summarize_cpu(profile)
    result["switches"] = switches
    (OUT / "switches.cpuprofile").write_text(json.dumps(profile))
    # Measure retained scene resources after repeated genuine structural rebuilds.
    cdp.send("HeapProfiler.collectGarbage")
    before = cdp.send("Runtime.getHeapUsage")
    mem = page.evaluate(
        """async()=>{const out=[];for(let n=0;n<8;n++){mcDebug.openCompanion(n%2?'resident-1':'resident-2');await new Promise(r=>setTimeout(r,100));out.push({n,memory:{...mcDebug.world.renderer.info.memory},programs:mcDebug.world.renderer.info.programs.length,caches:mcDebug.world.caches.size});}return out}"""
    )
    cdp.send("HeapProfiler.collectGarbage")
    result["rebuildMemory"] = {
        "before": before,
        "after": cdp.send("Runtime.getHeapUsage"),
        "cycles": mem,
    }
    result["errors"] = errors
    (OUT / "baseline.json").write_text(json.dumps(result, indent=2))
    browser.close()
print("RESULT", str(OUT / "baseline.json"), flush=True)
