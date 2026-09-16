"""Measure production loading and unchanged-quality renderer resource retention.

Uses a read-only archive of the already built 92f1f00 public site. Production
checks never use mcDebug. A separately labelled current DEV phase reads the
existing renderer diagnostics while exercising the same real UI controls.
Run serially, without another GPU/browser benchmark, using the project uv env.
"""

import gzip
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import urlopen

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
URL = os.environ.get("MC_RELEASE_URL", "http://127.0.0.1:8891/projects/mc-clicker-2/")
DEV_URL = os.environ.get("MC_DEV_URL", "http://127.0.0.1:8890/")
BASELINE = "92f1f00"
SAVE_KEY = "mc-clicker-world-v2"
OUT = ROOT / "docs/qa/polish-loading-observations.json"
PARTS = ["studioDesk", "studioWall", "studioSign", "studioShelf"]
FIRST_DRAW = """window.__qaFirstDraw=null;
for(const C of [window.WebGLRenderingContext,window.WebGL2RenderingContext])
if(C)for(const k of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){
const f=C.prototype[k];if(!f)continue;
C.prototype[k]=function(...args){window.__qaFirstDraw??=performance.now();C.prototype[k]=f;return f.apply(this,args);};}
"""
FRAME_SAMPLE = """count=>new Promise(resolve=>{
const values=[];let last;function frame(t){if(last!==undefined)values.push(t-last);last=t;
if(values.length<count)return requestAnimationFrame(frame);
values.sort((a,b)=>a-b);resolve({count:values.length,p50Ms:values[Math.floor(count*.5)],
p95Ms:values[Math.floor(count*.95)],p99Ms:values[Math.floor(count*.99)],maxMs:values.at(-1)});}
requestAnimationFrame(frame);})"""


def fixtures():
    generated = subprocess.run(
        [
            "node",
            "--input-type=module",
            "--eval",
            (
                "import {fresh} from './src/game.js';"
                "import {completeFixture} from './scripts/fixtures.mjs';"
                "const full=completeFixture();full.money=1e8;"
                "for(const s of [full]){s.collection={version:1,owned:{},equipped:{}};"
                "s.atmosphere.weather='clear';s.atmosphere.auto=false;"
                "s.atmosphere.cycle=false;s.live.director=false;s.reducedMotion=false;}"
                "console.log(JSON.stringify({fresh:fresh(),full}));"
            ),
        ],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(generated.stdout)


def seed(context, state):
    context.add_init_script(
        "if(!sessionStorage.getItem('polish-loading-seeded')){"
        f"localStorage.setItem({json.dumps(SAVE_KEY)},{json.dumps(json.dumps(state))});"
        "sessionStorage.setItem('polish-loading-seeded','1');}"
    )


def context_for(browser, state):
    context = browser.new_context(
        viewport={"width": 1440, "height": 960}, device_scale_factor=1
    )
    seed(context, state)
    return context


def observe_errors(page, errors, failures):
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on(
        "requestfailed",
        lambda request: failures.append(
            {"url": request.url, "failure": request.failure}
        ),
    )
    page.on(
        "response",
        lambda response: (
            failures.append({"url": response.url, "status": response.status})
            if response.status >= 400
            else None
        ),
    )


def static_boot(browser, url, state, required):
    # A separate routed context deliberately holds all JS requests. It must
    # never be reused for cache measurements: Playwright routing disables cache.
    context = context_for(browser, state)
    page = context.new_page()
    pending = []
    holding = True

    def gate(route):
        if holding and (
            route.request.resource_type == "script"
            or urlparse(route.request.url).path.endswith(".js")
        ):
            pending.append(route)
        else:
            route.continue_()

    page.route("**/*", gate)
    page.goto(url, wait_until="commit")
    page.wait_for_timeout(350)
    visible = page.locator(".boot-world").is_visible()
    result = {
        "scriptRequestsHeld": len(pending),
        "staticLoadingVisibleBeforeJS": visible,
        "staticText": page.locator("#app").inner_text(),
        "canvasBeforeJS": page.locator("canvas").count(),
    }
    assert pending, "Slow-loading test failed to hold the application script"
    assert not result["canvasBeforeJS"]
    if required:
        assert visible and "小世界" in result["staticText"]
    holding = False
    for route in pending:
        route.continue_()
    page.wait_for_selector("canvas", state="visible")
    assert page.evaluate("typeof window.mcDebug") == "undefined"
    context.close()
    return result


def production_loads(browser, url, state):
    context = context_for(browser, state)
    context.add_init_script(FIRST_DRAW)
    page = context.new_page()
    errors, failures, requests, responses = [], [], [], []
    observe_errors(page, errors, failures)
    page.on("request", lambda request: requests.append(request.url))
    page.on("response", lambda response: responses.append(response))
    cdp = context.new_cdp_session(page)
    cdp.send("Network.enable")
    cached_ids = set()
    cdp.on(
        "Network.requestServedFromCache",
        lambda event: cached_ids.add(event["requestId"]),
    )
    result = {}
    for temperature in ["cold", "warm"]:
        requests.clear()
        responses.clear()
        cached_ids.clear()
        start = time.perf_counter()
        if temperature == "cold":
            page.goto(url, wait_until="networkidle")
        else:
            page.reload(wait_until="networkidle")
        page.wait_for_function("window.__qaFirstDraw !== null")
        wall = (time.perf_counter() - start) * 1000
        assert page.evaluate("typeof window.mcDebug") == "undefined"
        timings = page.evaluate("""()=>({firstDrawMs:__qaFirstDraw,
          navigation:performance.getEntriesByType('navigation')[0].toJSON(),
          resources:performance.getEntriesByType('resource').map(r=>({
          name:r.name,initiatorType:r.initiatorType,durationMs:r.duration,
          transferSize:r.transferSize,encodedBodySize:r.encodedBodySize,decodedBodySize:r.decodedBodySize}))})""")
        assets = []
        for response in responses:
            if response.request.resource_type not in [
                "document",
                "script",
                "stylesheet",
            ]:
                continue
            body = response.body()
            assets.append(
                {
                    "name": Path(urlparse(response.url).path).name or "index.html",
                    "type": response.request.resource_type,
                    "rawBytes": len(body),
                    "computedGzipBytes": len(
                        gzip.compress(body, compresslevel=9, mtime=0)
                    ),
                    "contentEncoding": response.headers.get(
                        "content-encoding", "identity"
                    ),
                    "cacheControl": response.headers.get("cache-control"),
                }
            )
        result[temperature] = {
            **timings,
            "requestCount": len(requests),
            "servedFromCacheCount": len(cached_ids),
            "gotoNetworkIdleWallMs": round(wall, 2),
            "codeAndDocumentAssets": assets,
            "computedCodeAndDocumentGzipBytes": sum(
                asset["computedGzipBytes"] for asset in assets
            ),
        }
    result["errors"], result["failedRequests"] = errors, failures
    assert not errors and not failures, (errors, failures)
    context.close()
    return result


def lazy_workshop(browser, url, state):
    context = context_for(browser, state)
    page = context.new_page()
    errors, failures, responses = [], [], []
    observe_errors(page, errors, failures)
    page.on("response", lambda response: responses.append(response))
    page.goto(url, wait_until="networkidle")
    assert page.evaluate("typeof window.mcDebug") == "undefined"
    before = [
        response.url
        for response in responses
        if "collection-ui" in Path(urlparse(response.url).path).name
    ]
    assert not before, before
    count_before = len(responses)
    page.locator("#collection-open").click()
    page.locator("#collection-shop").wait_for(state="visible")
    page.wait_for_load_state("networkidle")
    modules = []
    for response in responses[count_before:]:
        if "collection-ui" not in Path(urlparse(response.url).path).name:
            continue
        body = response.body()
        modules.append(
            {
                "url": response.url,
                "type": response.request.resource_type,
                "rawBytes": len(body),
                "computedGzipBytes": len(gzip.compress(body, mtime=0)),
            }
        )
    assert any(module["url"].endswith(".js") for module in modules)
    assert any(module["url"].endswith(".css") for module in modules)
    assert not errors and not failures, (errors, failures)
    context.close()
    return {
        "beforeOpening": before,
        "onOpening": modules,
        "errors": errors,
        "failedRequests": failures,
    }


def renderer_snapshot(page):
    return page.evaluate("""()=>{const w=mcDebug.world,r=w.renderer;
      return {memory:{...r.info.memory},programs:r.info.programs.length,
      caches:w.caches.size,triangles:r.info.render.triangles,
      instances:w.batch.reduce((n,b)=>n+b.objects.length,0),
      studio:w.studio,shot:w.shot,realm:w.view,
      quality:{pixelRatio:r.getPixelRatio(),shadowMap:r.shadowMap.enabled,
      shadowType:r.shadowMap.type,toneMapping:r.toneMapping,
      toneMappingExposure:r.toneMappingExposure,reducedMotion:mcDebug.state.reducedMotion}};}""")


def dev_retention(browser, state):
    context = context_for(browser, state)
    page = context.new_page()
    errors, failures = [], []
    observe_errors(page, errors, failures)
    page.goto(DEV_URL, wait_until="networkidle")
    page.wait_for_function("window.mcDebug?.world")
    cdp = context.new_cdp_session(page)
    renderer = page.evaluate(
        """()=>{const gl=mcDebug.world.renderer.getContext(),e=gl.getExtension('WEBGL_debug_renderer_info');return e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):'unknown'}"""
    )

    def studio_shop():
        page.locator("#collection-open").click()
        page.locator("#collection-shop").wait_for(state="visible")
        page.locator('[data-collection-tab="studio"]').click()

    def choose(part):
        page.locator(f'[data-studio-part="{part}"]').click()
        page.locator(f'[data-preview="{part}-0"]').click()

    def enter():
        page.locator('[data-nav="live"]').click()
        page.locator("body.live-page").wait_for()
        page.wait_for_timeout(900)
        assert page.evaluate("mcDebug.world.shot === 'L2' && mcDebug.world.studio")

    def leave():
        page.locator("#studio-back").click()
        page.wait_for_function("!document.body.classList.contains('live-page')")
        page.wait_for_timeout(400)

    def visit_realms():
        for realm in ["nether", "end", "overworld"]:
            page.locator(f'[data-realm="{realm}"]').click()
            page.wait_for_timeout(450)

    studio_shop()
    for part in PARTS:
        choose(part)
        page.locator(f'.cs-actions [data-extra-buy="{part}-0"]').click()
    page.locator("#modal-close").click()
    visit_realms()
    enter()
    initial_quality = renderer_snapshot(page)["quality"]
    assert initial_quality["shadowMap"] and not initial_quality["reducedMotion"]
    leave()
    cdp.send("HeapProfiler.collectGarbage")
    heap_before = cdp.send("Runtime.getHeapUsage")
    cycles = []
    # First cycle warms all default/decorated room resources. Later cycles must
    # retain a bounded, stable set; measurements do not alter quality settings.
    for cycle in range(5):
        studio_shop()
        for part in PARTS:
            choose(part)
            page.locator(f'.cs-actions [data-extra-default="{part}"]').click()
        page.locator("#modal-close").click()
        visit_realms()
        enter()
        disabled = renderer_snapshot(page)
        leave()
        studio_shop()
        for part in PARTS:
            choose(part)
            page.locator(f'.cs-actions [data-extra-equip="{part}-0"]').click()
        page.locator("#modal-close").click()
        visit_realms()
        enter()
        enabled = renderer_snapshot(page)
        assert enabled["quality"] == initial_quality == disabled["quality"]
        leave()
        cycles.append(
            {
                "cycle": cycle,
                "default": disabled,
                "decorated": enabled,
                "world": renderer_snapshot(page),
            }
        )
        print(
            "renderer cycle", cycle, enabled["memory"], enabled["programs"], flush=True
        )
    world_frames = page.evaluate(FRAME_SAMPLE, 180)
    enter()
    studio_frames = page.evaluate(FRAME_SAMPLE, 180)
    cdp.send("HeapProfiler.collectGarbage")
    heap_after = cdp.send("Runtime.getHeapUsage")
    stable = {}
    for phase in ["default", "decorated", "world"]:
        retained = [
            (entry[phase]["memory"], entry[phase]["programs"], entry[phase]["caches"])
            for entry in cycles[-3:]
        ]
        stable[phase] = all(value == retained[0] for value in retained)
    result = {
        "mode": "current DEV only; existing mcDebug reads renderer.info, production never exposes it",
        "url": DEV_URL,
        "renderer": renderer,
        "qualityUnchanged": initial_quality,
        "fourPartsToggledByActualUI": PARTS,
        "cycles": cycles,
        "lastThreeCyclesStable": stable,
        "heapBefore": heap_before,
        "heapAfter": heap_after,
        "worldFrames": world_frames,
        "studioFrames": studio_frames,
        "errors": errors,
        "failedRequests": failures,
    }
    context.close()
    return result


def main():
    states = fixtures()
    result = {
        "baselineCommit": BASELINE,
        "currentProductionURL": URL,
        "conditions": {
            "browser": "Chromium headless",
            "angle": "Metal on macOS",
            "viewport": "1440x960",
            "DPR": 1,
            "loadFixture": "same fresh save; no construction/assets removed",
            "lazyAndMemoryFixture": "full world purchased through completeFixture; extra collection initially empty",
            "timingScope": "one cold and one reload per version on this local machine; not a network-speed or statistical FPS claim",
            "coldScope": "fresh isolated HTTP/browser cache context in an existing Chromium process; static-boot probes ran first, so GPU/OS caches are not device-cold",
            "gzipScope": "computed gzip-9 body bytes, separate from actual local HTTP transfers/cache headers",
            "cacheScope": "normal contexts have no request routing; separate slow-JS context tests the static placeholder",
        },
    }
    with tempfile.TemporaryDirectory(prefix="mc-polish-loading-") as directory:
        archive = subprocess.run(
            [
                "git",
                "-C",
                str(REPO),
                "archive",
                BASELINE,
                "public/projects/mc-clicker-2",
            ],
            cwd=ROOT,
            capture_output=True,
            check=True,
        )
        subprocess.run(
            ["tar", "-x", "-C", directory], input=archive.stdout, cwd=ROOT, check=True
        )
        with socket.socket() as reservation:
            reservation.bind(("127.0.0.1", 0))
            port = reservation.getsockname()[1]
        server = subprocess.Popen(
            [
                sys.executable,
                "-m",
                "http.server",
                str(port),
                "--bind",
                "127.0.0.1",
                "--directory",
                str(Path(directory) / "public"),
            ],
            cwd=ROOT,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        baseline_url = f"http://127.0.0.1:{port}/projects/mc-clicker-2/"
        try:
            for attempt in range(50):
                try:
                    with urlopen(baseline_url, timeout=1):
                        break
                except OSError:
                    if attempt == 49:
                        raise
                    time.sleep(0.1)
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(
                    headless=True,
                    args=["--use-angle=metal"] if sys.platform == "darwin" else [],
                )
                for label, url in [("baseline", baseline_url), ("current", URL)]:
                    result[label] = {
                        "staticBoot": static_boot(
                            browser, url, states["fresh"], label == "current"
                        ),
                        "loads": production_loads(browser, url, states["fresh"]),
                    }
                    print(
                        "production",
                        label,
                        json.dumps(
                            {
                                phase: result[label]["loads"][phase]["firstDrawMs"]
                                for phase in ["cold", "warm"]
                            }
                        ),
                        flush=True,
                    )
                result["current"]["lazyWorkshop"] = lazy_workshop(
                    browser, URL, states["full"]
                )
                result["currentDevRenderer"] = dev_retention(browser, states["full"])
                browser.close()
            OUT.parent.mkdir(parents=True, exist_ok=True)
            OUT.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
            retention = result["currentDevRenderer"]
            assert all(retention["lastThreeCyclesStable"].values()), retention[
                "lastThreeCyclesStable"
            ]
            assert not retention["errors"] and not retention["failedRequests"], (
                retention
            )
            print("RESULT", OUT, flush=True)
        finally:
            server.terminate()
            server.wait(timeout=10)


if __name__ == "__main__":
    main()
