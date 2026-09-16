"""Exercise paid early guidance and Space holds in isolated mobile/desktop browsers.

Production state is inspected through the game's real export-save control. No
debug state is required; lifecycle errors are injected only in the QA context.
"""

import argparse
import importlib.util
import json
import os
from pathlib import Path
import sys
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright


spec = importlib.util.spec_from_file_location("interiors_qa", Path(__file__).with_name("verify-interiors-release.py"))
qa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qa)
ROOT, SAVE_KEY = qa.ROOT, qa.SAVE_KEY


def click(page, selector, mobile=False):
    element = page.locator(selector).first
    element.wait_for(state="visible")
    element.tap() if mobile else element.click()


def snapshot(page, mobile=False):
    if page.evaluate("!!window.mcDebug"):
        return page.evaluate("structuredClone(mcDebug.state)")
    click(page, "#settings", mobile)
    with page.expect_download() as saved:
        click(page, "#export-save", mobile)
    data = json.loads(Path(saved.value.path()).read_text())
    click(page, "#modal-close", mobile)
    return data


def unfocus(page):
    page.evaluate("document.activeElement?.blur()")


def close_panel(page, mobile=False):
    click(page, '[data-nav="world"]', mobile)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default=os.environ.get("MC_RELEASE_URL", "http://127.0.0.1:8890/"))
    args = parser.parse_args()
    output = ROOT / "docs/qa"
    report = {
        "url": args.url, "checks": {}, "errors": [], "keyboard": {}, "isolatedContexts": True,
        "lifecycleSimulation": "QA dispatches blur/focus and overrides visibilityState inside an isolated context; physical OS lock-screen behavior is not exercised.",
        "stateInspection": "development mcDebug" if urlparse(args.url).port == 8890 else "production real export-save download",
    }
    checks, contexts = report["checks"], []
    page = None
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--use-angle=metal"] if sys.platform == "darwin" else [])

        def new_page(mobile=False, state=None):
            context = browser.new_context(viewport={"width": 390, "height": 844} if mobile else {"width": 1360, "height": 900}, is_mobile=mobile, has_touch=mobile, accept_downloads=True)
            contexts.append(context)
            if state:
                context.add_init_script("if(!sessionStorage.getItem('guidance-qa-seeded')){"
                    f"localStorage.setItem({json.dumps(SAVE_KEY)}, {json.dumps(json.dumps(state))});"
                    "sessionStorage.setItem('guidance-qa-seeded','1');}")
            result = context.new_page()
            result.set_default_timeout(15000)
            result.on("pageerror", lambda error: report["errors"].append(str(error)))
            result.goto(args.url, wait_until="networkidle")
            if urlparse(args.url).port != 8890:
                assert result.evaluate("typeof window.mcDebug") == "undefined"
            return result

        try:
            page = new_page(True)
            assert not page.locator("#mission").is_visible()
            assert not page.locator("#info-open").is_visible()
            for _ in range(12):
                click(page, "#mine", True)
            click(page, '[data-nav="build"]', True)
            click(page, '[data-buy="T1"]', True)
            click(page, "#placement-confirm", True)
            close_panel(page, True)
            for _ in range(55):
                click(page, "#mine", True)
            click(page, '[data-nav="build"]', True)
            assert page.locator('[data-buy="V1"]').is_disabled()
            before = snapshot(page, True)
            click(page, '[data-buy-guidance="goals"]', True)
            assert page.locator("#placement-confirm").is_enabled()
            assert "6" in page.locator("#placement-confirm").inner_text()
            assert qa.saved(page)["guidance"]["goals"] is False
            click(page, "#placement-cancel", True)
            assert snapshot(page, True)["money"] == before["money"]
            click(page, '[data-buy-guidance="goals"]', True)
            click(page, "#placement-confirm", True)
            after = snapshot(page, True)
            qa.assert_paid(before, after, 6)
            assert after["guidance"]["goals"] is True
            assert after["counts"].get("V1", 0) == 0
            checks["freshWoodPickaxeThenSixEmeraldGoalsRequiresConfirmationAndPrecedesLand"] = True

            click(page, '[data-nav="build"]', True)
            click(page, '[data-buy="V1"]', True)
            # The very first plot is a single small diamond below the starter
            # block. Wait for the drawer and camera animation to finish before
            # tapping that visible diamond; its early projection moves ~188px.
            page.wait_for_timeout(900)
            page.wait_for_function("document.elementFromPoint(213,547)?.tagName === 'CANVAS'")
            page.touchscreen.tap(213, 547)
            if not page.locator("#placement-confirm").is_enabled():
                qa.choose_grid(page)
            click(page, "#placement-confirm", True)
            assert qa.saved(page)["counts"]["V1"] == 1
            click(page, '[data-nav="build"]', True)
            for item in ["V2", "T7"]:
                offer = page.locator(f'[data-buy="{item}"]')
                assert offer.count() == 0 or offer.is_disabled()
            before = snapshot(page, True)
            click(page, '[data-buy-guidance="info"]', True)
            click(page, "#placement-cancel", True)
            assert snapshot(page, True)["money"] == before["money"]
            click(page, '[data-buy-guidance="info"]', True)
            click(page, "#placement-confirm", True)
            page.locator("#info-panel").wait_for(state="visible")
            click(page, "#modal-close", True)
            after = snapshot(page, True)
            qa.assert_paid(before, after, 12)
            assert page.locator("#info-open").is_visible()
            checks["twelveEmeraldInfoRequiresConfirmationAndUnlocksBothFirstWorkerAndWorkbench"] = True

            click(page, '[data-nav="build"]', True)
            click(page, '[data-buy="V2"]', True)
            click(page, "#placement-confirm", True)
            before = snapshot(page, True)
            page.wait_for_timeout(1100)
            after = snapshot(page, True)
            assert after["money"] > before["money"]
            assert after["productionIncome"] > before["productionIncome"]
            checks["firstVillagerStillProducesRealAutomaticIncome"] = True
            close_panel(page, True)
            click(page, "#mission-toggle", True)
            assert page.locator("#mission-toggle").get_attribute("aria-expanded") == "false"
            page.reload(wait_until="networkidle")
            assert qa.saved(page)["guidance"]["collapsed"] is True
            assert page.locator("#mission-toggle").get_attribute("aria-expanded") == "false"
            click(page, "#mission-toggle", True)
            click(page, "#info-open", True)
            page.locator("#guidance-notices").uncheck()
            click(page, "#modal-close", True)
            page.reload(wait_until="networkidle")
            assert qa.saved(page)["guidance"]["collapsed"] is False
            assert qa.saved(page)["guidance"]["notices"] is False
            assert not page.locator(".gesture-hint").is_visible()
            click(page, "#info-open", True)
            assert not page.locator("#guidance-notices").is_checked()
            page.locator("#guidance-notices").check()
            click(page, "#modal-close", True)
            page.reload(wait_until="networkidle")
            assert qa.saved(page)["guidance"]["notices"] is True
            close_panel(page, True)
            qa.no_overflow(page)
            page.screenshot(path=output / "guidance-mobile-world.png")
            checks["goalCollapseAndShowAndNotificationOffAndOnPersistAcrossReloads"] = True

            legacy = snapshot(page, True)
            del legacy["guidance"]
            legacy["version"] = 3
            page = new_page(True, legacy)
            assert page.locator("#mission").is_visible()
            assert page.locator("#info-open").is_visible()
            migrated = snapshot(page, True)
            assert migrated["guidance"]["goals"] and migrated["guidance"]["info"]
            checks["legacyAlreadyBuiltTechnologyRestoresGuidanceWithoutCharging"] = migrated["money"] >= legacy["money"]

            page = new_page()
            close_panel(page)
            before = snapshot(page)["clicks"]
            unfocus(page)
            page.keyboard.down("Space")
            page.keyboard.up("Space")
            after = snapshot(page)["clicks"]
            assert after - before == 1
            checks["spaceKeydownImmediatelyMinesExactlyOnce"] = True

            def hold(repeats=False, mine_focus=False):
                before = snapshot(page)["clicks"]
                page.locator("#mine").focus() if mine_focus else unfocus(page)
                page.keyboard.down("Space")
                if repeats:
                    for _ in range(15):
                        page.wait_for_timeout(100)
                        page.keyboard.down("Space")
                else:
                    page.wait_for_timeout(1500)
                page.keyboard.up("Space")
                # Do not open the export modal until after this stop check:
                # opening a modal would itself stop a broken lingering hold.
                stopped_money = page.locator("#money").get_attribute("title")
                page.wait_for_timeout(700)
                assert page.locator("#money").get_attribute("title") == stopped_money
                finished = snapshot(page)["clicks"]
                delta = finished - before
                assert 5 <= delta <= 8, delta
                return delta

            report["keyboard"]["normal1500ms"] = hold()
            report["keyboard"]["repeatedKeydown1500ms"] = hold(True)
            report["keyboard"]["focusedMine1500ms"] = hold(mine_focus=True)
            before = snapshot(page)["clicks"]
            page.locator("#mine").focus()
            page.keyboard.down("Space")
            page.keyboard.up("Space")
            assert snapshot(page)["clicks"] - before == 1
            checks["spaceHoldRepeatsAtOneClockStopsOnKeyupAndDoesNotDoubleClickFocusedMine"] = True

            for event in ["blur", "hidden"]:
                before = snapshot(page)["clicks"]
                unfocus(page)
                page.keyboard.down("Space")
                page.wait_for_timeout(650)
                if event == "blur":
                    page.evaluate("window.dispatchEvent(new Event('blur'))")
                else:
                    page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,value:true});Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'))")
                frozen = qa.saved(page)["clicks"]
                assert frozen > before
                page.wait_for_timeout(800)
                if event == "blur":
                    page.evaluate("window.dispatchEvent(new Event('focus'))")
                else:
                    page.evaluate("delete document.hidden;delete document.visibilityState;document.dispatchEvent(new Event('visibilitychange'))")
                page.keyboard.up("Space")
                page.wait_for_timeout(700)
                assert snapshot(page)["clicks"] == frozen
                report["keyboard"][event] = {"before": before, "paused": frozen, "after": frozen}
            checks["blurAndHiddenStopHoldingAndReturningDoesNotCatchUp"] = True

            page.evaluate("""() => {
              const wrapper=document.createElement('section');wrapper.id='qa-editable-controls';
              wrapper.style='position:fixed;top:90px;left:20px;z-index:9999;background:white;padding:6px';
              wrapper.innerHTML='<input id="qa-input"><div id="qa-editable" contenteditable="true" tabindex="0">edit here</div><button id="qa-button">ordinary action</button>';
              document.body.append(wrapper);
            }""")
            for selector in ["#qa-input", "#qa-editable", "#qa-button"]:
                before = snapshot(page)["clicks"]
                page.locator(selector).focus()
                page.keyboard.down("Space")
                page.wait_for_timeout(700)
                page.keyboard.up("Space")
                assert snapshot(page)["clicks"] == before, selector
            before = snapshot(page)["clicks"]
            unfocus(page)
            page.keyboard.down("Space")
            page.locator("#qa-input").focus()
            page.wait_for_timeout(700)
            page.keyboard.up("Space")
            assert snapshot(page)["clicks"] == before + 1
            page.locator("#qa-editable-controls").evaluate("e=>e.remove()")
            checks["inputsContenteditableOtherButtonsNeverMineAndMovingFocusStopsAnActiveHold"] = True
            qa.no_overflow(page)
            page.screenshot(path=output / "guidance-desktop-keyboard.png")
            assert not report["errors"], report["errors"]
            assert all(checks.values()), checks
            report["passed"] = True
            (output / "guidance-release-failed.png").unlink(missing_ok=True)
        except Exception as error:
            report["passed"] = False
            report["failure"] = str(error)
            if page and not page.is_closed():
                page.screenshot(path=output / "guidance-release-failed.png")
            raise
        finally:
            (output / "guidance-release-observations.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
            for context in contexts:
                context.close()
            browser.close()


if __name__ == "__main__":
    main()
