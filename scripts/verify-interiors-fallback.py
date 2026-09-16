"""Smoke-test real first purchase and explicit indoor placement without WebGL."""

import argparse
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys

from playwright.sync_api import sync_playwright

module_spec = importlib.util.spec_from_file_location("interiors_release_qa", Path(__file__).with_name("verify-interiors-release.py"))
qa = importlib.util.module_from_spec(module_spec)
module_spec.loader.exec_module(qa)
ROOT, SAVE_KEY = qa.ROOT, qa.SAVE_KEY
fixture, saved, progress, tap, assert_paid, no_overflow = qa.fixture, qa.saved, qa.progress, qa.tap, qa.assert_paid, qa.no_overflow


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default=os.environ.get("MC_RELEASE_URL", "http://127.0.0.1:8891/projects/mc-clicker-2/"))
    args = parser.parse_args()
    checks, errors, console_errors = {}, [], []
    report = {"url": args.url, "checks": checks, "pageErrors": errors, "expectedWebGLConsoleErrors": console_errors}
    output = ROOT / "docs/qa"
    output.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--use-angle=metal"] if sys.platform == "darwin" else [])
        context = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
        page = context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))
        try:
            page.goto(args.url, wait_until="networkidle")
            assert page.evaluate("typeof mcDebug") == "undefined"
            tap(page, '[data-nav="build"]')
            assert page.locator('[data-buy="T1"]').is_disabled()
            if page.locator("#panel-close").is_visible():
                tap(page, "#panel-close")
            for _ in range(12):
                tap(page, "#mine")
            tap(page, '[data-nav="build"]')
            page.wait_for_function("!document.querySelector('[data-buy=\"T1\"]').disabled")
            before_money = page.locator("#money").get_attribute("title")
            tap(page, '[data-buy="T1"]')
            page.locator("#placement-bar").wait_for(state="visible")
            assert "确认" in page.locator("#placement-confirm").inner_text()
            current = saved(page)
            assert not current or not current["counts"].get("T1")
            assert page.locator("#money").get_attribute("title") == before_money
            tap(page, "#placement-cancel")
            assert page.locator('[data-buy="T1"]').is_enabled()
            current = saved(page)
            assert not current or not current["counts"].get("T1")
            tap(page, '[data-buy="T1"]')
            tap(page, "#placement-confirm")
            owned = saved(page)
            assert owned["counts"]["T1"] == 1
            assert owned["clicks"] >= 12
            assert abs(owned["total"] - owned["money"] - 10) < 1e-6
            checks["newPlayerMinesForFirstToolWithoutDebugState"] = True
            checks["woodPickaxeNeedsConfirmationAndCancelDoesNotCharge"] = True
            no_overflow(page)
            context.close()

            payload = fixture()
            state = payload["state"]
            result = subprocess.run(
                ["node", "--input-type=module", "--eval", "import {readFileSync} from 'node:fs';import {studioSites} from './src/studio-placement.js';const s=JSON.parse(readFileSync(0,'utf8'));console.log(JSON.stringify(studioSites(s,'L3:0')[0]));"],
                cwd=ROOT, input=json.dumps(state), capture_output=True, text=True, check=True,
            )
            expected_site = json.loads(result.stdout)
            report["expectedFallbackSite"] = expected_site
            context = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
            context.add_init_script(
                "const original=HTMLCanvasElement.prototype.getContext;"
                "HTMLCanvasElement.prototype.getContext=function(kind,...options){"
                "return ['webgl','webgl2','experimental-webgl'].includes(kind)?null:original.call(this,kind,...options);};"
                "if(!sessionStorage.getItem('interiors-fallback-seeded')){"
                f"localStorage.setItem({json.dumps(SAVE_KEY)},{json.dumps(json.dumps(state))});"
                "sessionStorage.setItem('interiors-fallback-seeded','1');}"
            )
            page = context.new_page()
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
            page.goto(args.url, wait_until="networkidle")
            assert page.evaluate("typeof mcDebug") == "undefined"
            page.locator("#fallback").wait_for(state="visible")
            assert page.locator("#world canvas").count() == 0
            tap(page, '[data-nav="live"]')
            tap(page, '[data-room-tab="equipment"]')
            before = saved(page)
            tap(page, '[data-buy="L3"]')
            page.locator("#placement-bar").wait_for(state="visible")
            assert "第一个合法空位" in page.locator("#placement-label").inner_text()
            assert page.locator("#placement-confirm").is_enabled()
            assert progress(saved(page)) == progress(before)
            tap(page, "#placement-cancel")
            assert progress(saved(page)) == progress(before)
            checks["noWebGLFallbackSelectsAValidSiteWithoutBuying"] = True
            tap(page, '[data-buy="L3"]')
            tap(page, "#placement-confirm")
            after = saved(page)
            assert after["counts"]["L3"] == 1
            assert after["studio"]["placements"]["L3:0"] == expected_site
            assert "L3" not in after["placements"]
            assert_paid(before, after, payload["costs"]["L3"])
            checks["fallbackCameraCommitsOnlyAfterExplicitConfirmation"] = True
            page.reload(wait_until="networkidle")
            assert saved(page)["studio"]["placements"]["L3:0"] == expected_site
            assert saved(page)["counts"]["L3"] == 1
            checks["fallbackIndoorPurchaseSurvivesReload"] = True
            no_overflow(page)
            page.screenshot(path=output / "interiors-fallback-phone.png")
            assert not errors, errors
            assert all("webgl" in msg.lower() or "context" in msg.lower() for msg in console_errors), console_errors
            report["passed"] = True
            (output / "interiors-fallback-failure.png").unlink(missing_ok=True)
        except Exception as error:
            report["passed"] = False
            report["failure"] = str(error)
            if not page.is_closed():
                page.screenshot(path=output / "interiors-fallback-failure.png")
            raise
        finally:
            (output / "interiors-fallback-observations.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
            context.close()
            browser.close()


if __name__ == "__main__":
    main()
