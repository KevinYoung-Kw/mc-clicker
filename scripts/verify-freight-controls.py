"""Freight controls and stable status rows, using isolated synthetic browser saves.

uv run --with playwright scripts/verify-freight-controls.py
"""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs/v1.7/qa/freight-controls"
OUT.mkdir(parents=True, exist_ok=True)
seed = json.loads((ROOT / "docs/v1.6/qa/stability-baseline/fixtures/peak.json").read_text())
seed.update(money=1e9, savedAt=1, reducedMotion=True)
seed["guidance"]["notices"] = False
reports = []

with sync_playwright() as p:
    for engine, width, height in [("chromium", 1440, 960), ("webkit", 390, 844), ("chromium", 320, 740)]:
        mobile = width < 760
        browser = getattr(p, engine).launch(headless=True, **({"args": ["--use-angle=metal"]} if engine == "chromium" else {}))
        context = browser.new_context(viewport={"width": width, "height": height}, is_mobile=mobile, has_touch=mobile)
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto("http://127.0.0.1:8890/", wait_until="networkidle")
        page.wait_for_function("!!window.mcDebug?.world")
        report = {"engine": engine, "width": width, "carriers": [], "errors": errors}

        def press(locator):
            locator.tap() if mobile else locator.click()

        for carrier, realm in [("N6", "nether"), ("E3", "end")]:
            current = json.loads(json.dumps(seed))
            current["realm"] = realm
            current["grid"]["disabled"] = [carrier]
            current["grid"]["links"][carrier] = False
            page.evaluate("s => mcDebug.setState(s)", current)
            page.evaluate("id => mcDebug.world.onAction({type:'select', id})", carrier)
            if mobile and page.locator("#panel-expand").get_attribute("aria-expanded") != "true":
                press(page.locator("#panel-expand"))
            controls = page.locator(f'[data-connection-actions="{carrier}"]')
            button = controls.locator("[data-connection-primary]")
            button.wait_for(state="visible")
            button.scroll_into_view_if_needed()
            assert button.get_attribute("data-run-state") == "paused"
            assert "恢复运行" in button.get_attribute("aria-label")
            assert controls.locator('[data-network-action="map"], [data-network-action="disconnect"]').count() == 0
            assert button.locator("svg").count() == 1
            page.screenshot(path=str(OUT / f"{engine}-{width}-{carrier}-paused.png"))
            press(button)
            page.wait_for_function("id => !mcDebug.state.grid.disabled.includes(id) && mcDebug.state.grid.links[id] !== false", arg=carrier)
            page.wait_for_function("id => document.querySelector('[data-connection-actions=\"'+id+'\"] [data-connection-primary]').dataset.runState === 'enabled'", arg=carrier)
            if not mobile:
                button.focus()
                page.keyboard.press("Enter")
            else:
                press(button)
            page.wait_for_function("id => mcDebug.state.grid.disabled.includes(id)", arg=carrier)
            page.evaluate("mcDebug.save()")
            page.reload(wait_until="networkidle")
            page.wait_for_function("!!window.mcDebug?.world")
            assert page.evaluate("id => mcDebug.state.grid.disabled.includes(id)", carrier)
            assert page.evaluate("id => mcDebug.state.grid.links[id] !== false", carrier)
            page.evaluate("id => mcDebug.world.onAction({type:'select', id})", carrier)
            if mobile and page.locator("#panel-expand").get_attribute("aria-expanded") != "true":
                press(page.locator("#panel-expand"))
            button = page.locator(f'[data-connection-actions="{carrier}"] [data-connection-primary]')
            button.scroll_into_view_if_needed()
            # Stop simulation while exercising live status refresh from real state.
            page.evaluate("window.dispatchEvent(new Event('blur'))")
            page.evaluate("""id => {
              const s = mcDebug.state;
              s.grid.disabled = s.grid.disabled.filter(x => x !== id);
              delete s.grid.links[id]; delete s.dimensions.trips[id];
              window.qaFreight = {button: document.querySelector(`[data-connection-actions="${id}"] [data-connection-primary]`),
                status: document.querySelector(`[data-facility-status="${id}"]`)};
              qaFreight.rows = [...qaFreight.status.children];
            }""", carrier)
            measurements = []
            seconds = page.evaluate("""async id => {
              const {freightSpec} = await import('/src/dimensional.js');
              const first = Math.floor(Math.min(10, freightSpec(mcDebug.state, id).period));
              return [first, first - 1];
            }""", carrier)
            cases = [("empty", "等待货物"), ("full", "目的仓已满"), ("paused", "已暂停"), ("portal", "等待传送门"), ("first", f"00:{seconds[0]:02}"), ("next", f"00:{seconds[1]:02}"), ("ready", "可发车")]
            for case, expected in cases:
                actual = page.evaluate("""async ([id, testCase]) => {
                  const {freightSpec} = await import('/src/dimensional.js');
                  const {storageCapacity} = await import('/src/upgrades.js');
                  const {createNetworkUI} = await import('/src/network-ui.js');
                  const s = mcDebug.state, spec = freightSpec(s, id);
                  s.grid.disabled = testCase === 'paused' ? [id] : [];
                  s.counts.N1 = testCase === 'portal' ? 0 : 1; s.counts.E2 = 1; s.endEyes = 12;
                  s.buffers[spec.from][spec.source] = testCase === 'empty' ? 0 : 20;
                  const target = spec.target.startsWith('end') ? s.dimensions.awaiting : s.buffers[spec.to];
                  target[spec.target] = testCase === 'full' ? storageCapacity(s, spec.to, 'raw') : 0;
                  const first = Math.floor(Math.min(10, spec.period));
                  s.dimensions.clocks[id] = spec.period - (testCase === 'first' ? first : testCase === 'next' ? first - 1 : 0);
                  createNetworkUI({state: () => s}).refresh(document.querySelector('#panel-content'));
                  return qaFreight.status.querySelector('[data-status-value="time"]').textContent;
                }""", [carrier, case])
                assert actual == expected, (carrier, case, actual)
                assert page.evaluate("qaFreight.button.isConnected && qaFreight.status.isConnected && qaFreight.rows.every((row, i) => row === qaFreight.status.children[i])"), "refresh replaced controls/status rows"
                measurements.append(button.bounding_box())
                assert page.locator("#panel-content").evaluate("e => e.scrollWidth <= e.clientWidth + 1"), "panel overflow"
            assert max(b["y"] for b in measurements) - min(b["y"] for b in measurements) < 1, "status shifted action button"
            page.screenshot(path=str(OUT / f"{engine}-{width}-{carrier}-ready.png"))
            report["carriers"].append({"id": carrier, "resume": True, "reload": True, "stableRows": True, "states": [expected for _, expected in cases]})
        assert not errors, errors
        reports.append(report)
        print(engine, width, "passed", flush=True)
        context.close()
        browser.close()

(OUT / "browser-report.json").write_text(json.dumps(reports, ensure_ascii=False, indent=2) + "\n")
