"""Exercise unified placement and the independent studio through a production UI.

Only a new isolated browser context receives fixture data. Purchases after load use
real touch input; the production build must not expose mcDebug.
"""

import argparse
import json
import math
import os
from pathlib import Path
import subprocess
import sys
import tempfile

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
SAVE_KEY = "mc-clicker-world-v2"


def fixture():
    code = """
      import {fresh,buy,sites,frontier} from './src/game.js';
      import {ITEMS,ancestors,topological} from './src/catalog.js';
      import {buyEarlyGuidance} from './scripts/early-fixture.mjs';
      const s=fresh(); s.money=1e8; s.reducedMotion=true;
      buyEarlyGuidance(s);
      const wanted=new Set(['V4','M5','L2','X2'].flatMap(id=>[...ancestors(id)]));
      for(const item of topological().filter(i=>wanted.has(i.id))){
        if(s.counts[item.id]) continue;
        while(item.place&&!sites(s,item.realm,null,item.id).length){
          const result=buy(s,'V1',{...frontier(s,item.realm)[0],realm:item.realm});
          if(!result.ok) throw Error(result.reason);
        }
        const result=buy(s,item.id);if(!result.ok) throw Error(item.id+': '+result.reason);
      }
      // Keep a visible choice of available construction sites after this early build.
      for(let i=0;i<2;i++) buy(s,'V1',{...frontier(s)[0],realm:'overworld'});
      s.realm='overworld';s.live.director=false;s.live.shot='L2';s.live.camera='overworld';
      console.log(JSON.stringify({state:s,costs:Object.fromEntries(Object.values(ITEMS).map(i=>[i.id,i.cost]))}));
    """
    result = subprocess.run(
        ["node", "--input-type=module", "--eval", code],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(result.stdout)


def saved(page):
    return page.evaluate("key => JSON.parse(localStorage.getItem(key))", SAVE_KEY)


def progress(s):
    return {key: s[key] for key in ["counts", "placements", "studio", "collection"]}


def wait_count(page, item, count):
    page.wait_for_function(
        "([key,id,count]) => JSON.parse(localStorage.getItem(key)).counts[id] === count",
        arg=[SAVE_KEY, item, count],
    )
    return saved(page)


def assert_paid(before, after, expected):
    # Foreground income continues during touch interaction. Its total increment
    # must be accounted for rather than falsely treating it as a pricing failure.
    actual = before["money"] - after["money"] + after["total"] - before["total"]
    assert math.isclose(actual, expected, abs_tol=0.05), (actual, expected)


def no_overflow(page):
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")


def tap(page, selector):
    target = page.locator(selector).first
    target.wait_for(state="visible")
    target.tap()


def choose_grid(page):
    """Touch visible world coordinates until the game's own legality check accepts."""
    canvas = page.locator("#world canvas")
    bounds = canvas.bounding_box()
    assert bounds
    candidates = [(0.65, 0.6), (0.3, 0.6), (0.55, 0.55), (0.4, 0.65)]
    candidates += [(x / 10, y / 10) for y in range(3, 8) for x in range(1, 10)]
    for fx, fy in candidates:
        x, y = bounds["x"] + bounds["width"] * fx, bounds["y"] + bounds["height"] * fy
        # Do not touch the confirmation tray itself on short mobile viewports.
        tray = page.locator("#placement-bar").bounding_box()
        if tray and tray["y"] <= y <= tray["y"] + tray["height"]:
            continue
        page.touchscreen.tap(x, y)
        page.wait_for_timeout(70)
        if page.locator("#placement-confirm").is_enabled():
            return {"x": round(x, 1), "y": round(y, 1)}
    raise AssertionError("No visible legal placement could be selected with touch")


def assert_pending(page, before):
    page.locator("#placement-bar").wait_for(state="visible")
    assert progress(saved(page)) == progress(before), "preview changed owned items or placement"
    assert not page.locator("#modal").is_visible(), "placement must use the world, not a modal"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default=os.environ.get("MC_RELEASE_URL", "http://127.0.0.1:8891/projects/mc-clicker-2/"))
    args = parser.parse_args()
    payload = fixture()
    state, costs = payload["state"], payload["costs"]
    checks, errors, failed, touched = {}, [], [], {}
    report = {"url": args.url, "viewport": {"width": 390, "height": 844}, "checks": checks, "errors": errors, "failedRequests": failed, "touchPlacements": touched}
    output = ROOT / "docs/qa"
    output.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--use-angle=metal"] if sys.platform == "darwin" else [])
        context = browser.new_context(viewport=report["viewport"], has_touch=True, is_mobile=True, device_scale_factor=1, accept_downloads=True)
        context.add_init_script(
            "if(!sessionStorage.getItem('interiors-release-seeded')){"
            f"localStorage.setItem({json.dumps(SAVE_KEY)},{json.dumps(json.dumps(state))});"
            "sessionStorage.setItem('interiors-release-seeded','1');}"
        )
        page = context.new_page()
        page.set_default_timeout(15000)
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("response", lambda response: failed.append({"url": response.url, "status": response.status}) if response.status >= 400 else None)
        page.on("requestfailed", lambda request: failed.append({"url": request.url, "failure": request.failure}))
        try:
            page.goto(args.url, wait_until="networkidle")
            assert page.evaluate("typeof window.mcDebug") == "undefined"
            page.locator("#world canvas").wait_for(state="visible")
            no_overflow(page)
            checks["isolatedProductionContext"] = True

            tap(page, '[data-nav="village"]')
            tap(page, '[data-village-tab="construction"]')
            before = saved(page)
            tap(page, '[data-equipment-buy="V6"]')
            assert_pending(page, before)
            tap(page, "#placement-cancel")
            assert progress(saved(page)) == progress(before)
            checks["villageWellCancellationPreservesProgress"] = True
            tap(page, '[data-equipment-buy="V6"]')
            assert_pending(page, before)
            touched["well"] = choose_grid(page)
            tap(page, "#placement-confirm")
            after = wait_count(page, "V6", 1)
            assert "V6" in after["placements"]
            assert_paid(before, after, costs["V6"])
            checks["villageWellRequiresSiteThenOnePayment"] = True

            tap(page, '[data-nav="network"]')
            tap(page, '[data-industry-tab="automation"]')
            before = saved(page)
            tap(page, '[data-equipment-buy="M10"]')
            assert_pending(page, before)
            touched["clock"] = choose_grid(page)
            tap(page, "#placement-confirm")
            after = wait_count(page, "M10", 1)
            assert "M10" in after["placements"]
            assert_paid(before, after, costs["M10"])
            checks["industrialClockRequiresSiteThenOnePayment"] = True

            tap(page, '[data-nav="live"]')
            page.locator("#room-tools").wait_for(state="visible")
            page.wait_for_function("!document.querySelector('#game').classList.contains('panel-open')")
            assert not page.locator("#modal").is_visible()
            checks["studioEntryIsASceneWithoutAnOpenPanel"] = True
            page.screenshot(path=output / "interiors-release-room-phone.png")

            for index in range(2):
                tap(page, '[data-room-tab="equipment"]')
                before = saved(page)
                original = dict(before["studio"]["placements"])
                tap(page, '[data-buy="L3"]')
                assert_pending(page, before)
                assert not page.locator("#placement-confirm").is_enabled()
                touched[f"camera{index + 1}"] = choose_grid(page)
                tap(page, "#placement-confirm")
                after = wait_count(page, "L3", index + 1)
                assert_paid(before, after, costs["L3"] * (2 ** index))
                assert f"L3:{index}" in after["studio"]["placements"]
                assert "L3" not in after["placements"]
                for key, position in original.items():
                    assert after["studio"]["placements"][key] == position, key
            checks["firstAndSecondCameraUseDistinctIndoorSites"] = True

            tap(page, '[data-room-tab="arrange"]')
            tap(page, '[data-room-select="L3:0"]')
            tap(page, '[data-room-move="L3:0"]')
            before = saved(page)
            tap(page, "#placement-rotate")
            tap(page, "#placement-confirm")
            after = saved(page)
            assert after["studio"]["placements"]["L3:0"]["rotation"] == (before["studio"]["placements"]["L3:0"]["rotation"] + 1) % 4
            assert after["studio"]["placements"]["L3:1"] == before["studio"]["placements"]["L3:1"]
            assert_paid(before, after, 0)
            checks["freeRoomArrangementPreservesOtherCamera"] = True

            tap(page, '[data-room-tab="decor"]')
            tap(page, '[data-room-decor-slot="studioShelf"]')
            before = saved(page)
            tap(page, '[data-room-extra="studioShelf-0"]')
            assert_pending(page, before)
            tap(page, "#placement-cancel")
            assert progress(saved(page)) == progress(before)
            checks["decorationPlacementCancellationPreservesCollection"] = True
            tap(page, '[data-room-extra="studioShelf-0"]')
            touched["shelf"] = choose_grid(page)
            tap(page, "#placement-confirm")
            after = saved(page)
            assert after["collection"]["owned"]["studioShelf-0"] is True
            assert after["collection"]["equipped"]["studioShelf"] == "studioShelf-0"
            assert_paid(before, after, 2600)
            first_shelf = dict(after["studio"]["placements"]["studioShelf"])

            tap(page, '[data-room-tab="decor"]')
            before = saved(page)
            tap(page, '[data-room-extra="studioShelf-1"]')
            assert_pending(page, before)
            tap(page, "#placement-confirm")
            after = saved(page)
            assert_paid(before, after, 18000)
            assert after["collection"]["equipped"]["studioShelf"] == "studioShelf-1"
            assert after["studio"]["placements"]["studioShelf"] == first_shelf
            for item in ["studioShelf-0", "studioShelf-1"]:
                assert after["collection"]["owned"][item] is True
                assert f"collectible:{item}" in after["studio"]["placements"]
            checks["twoStudioDecorationsRemainVisibleCollectibles"] = True

            tap(page, '[data-room-tab="decor"]')
            before = saved(page)
            tap(page, '[data-room-unequip="studioShelf"]')
            after = saved(page)
            assert "studioShelf" not in after["collection"]["equipped"]
            assert after["collection"]["owned"] == before["collection"]["owned"]
            tap(page, '[data-room-extra="studioShelf-0"]')
            tap(page, "#placement-confirm")
            after = saved(page)
            assert after["collection"]["equipped"]["studioShelf"] == "studioShelf-0"
            assert after["studio"]["placements"]["studioShelf"] == first_shelf
            assert_paid(before, after, 0)
            checks["unloadingAndReequippingStudioDecorationsAreFree"] = True
            no_overflow(page)
            page.screenshot(path=output / "interiors-release-decorated-phone.png")

            tap(page, "#studio-back")
            tap(page, "#collection-open")
            page.locator("#collection-shop").wait_for(state="visible")
            assert page.locator('[data-collection-tab="studio"]').count() == 0
            checks["outdoorWorkshopDoesNotSellStudioDecorations"] = True
            tap(page, "#modal-close")

            # Export through shipped controls, then import that exact current save.
            tap(page, "#settings")
            with page.expect_download() as downloaded:
                tap(page, "#export-save")
            with tempfile.TemporaryDirectory(prefix="mc-interiors-") as tmp:
                save_path = Path(tmp) / "mc-clicker-save.json"
                downloaded.value.save_as(save_path)
                exported = json.loads(save_path.read_text())
                assert exported["version"] == state["version"]
                page.locator("#import-save").set_input_files(str(save_path))
                tap(page, "#confirm-import")
                assert saved(page)["studio"]["placements"] == exported["studio"]["placements"]
            checks["currentVersionExportImportsWithoutLosingRoomLayout"] = True
            before_reload = saved(page)
            page.reload(wait_until="networkidle")
            assert saved(page)["studio"]["placements"] == before_reload["studio"]["placements"]
            checks["roomLayoutSurvivesReload"] = True
            tap(page, '[data-nav="live"]')
            page.locator("#room-tools").wait_for(state="visible")
            no_overflow(page)
            page.screenshot(path=output / "interiors-release-final-phone.png")
            assert not errors, errors
            assert not failed, failed
            checks["noHorizontalOverflowConsoleErrorsOrFailedRequests"] = True
            report["passed"] = True
        except Exception as error:
            report["passed"] = False
            report["failure"] = str(error)
            page.screenshot(path=output / "interiors-release-failure.png")
            raise
        finally:
            (output / "interiors-release-observations.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
            context.close()
            browser.close()


if __name__ == "__main__":
    main()
