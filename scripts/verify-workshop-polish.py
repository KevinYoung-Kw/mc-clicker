"""Workshop interaction QA. Run against a dev server with MC_QA_URL (default :8890)."""
import json
import os
import subprocess
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "qa"
OUT.mkdir(parents=True, exist_ok=True)
BASE = os.environ.get("MC_QA_URL", "http://127.0.0.1:8890/")
fixture = json.loads(subprocess.run(
    ["node", "scripts/resident-fixture.mjs"], cwd=ROOT,
    capture_output=True, text=True, check=True,
).stdout)
# This is component interaction QA: the existing funds-only village fixture
# gets an open decoration stall; real purchase/placement is covered separately.
fixture["counts"]["X2"] = 1
fixture["money"] = 10_000_000
errors = []


def open_fixture(context):
    page = context.new_page()
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(BASE)
    page.wait_for_load_state("networkidle")
    page.evaluate("s => mcDebug.setState(s)", fixture)
    return page


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        headless=True,
        args=["--use-angle=metal"] if sys.platform == "darwin" else [],
    )
    context = browser.new_context(viewport={"width": 1360, "height": 900})
    page = open_fixture(context)
    page.locator("#collection-open").click()
    page.locator("#collection-shop").wait_for()
    page.screenshot(path=str(OUT / "100-workshop-desktop.png"))
    before = page.evaluate("JSON.stringify(mcDebug.state.collection)")
    page.locator("[data-preview=title-1]").click()
    assert page.evaluate("JSON.stringify(mcDebug.state.collection)") == before
    page.locator("[data-extra-buy=title-1]").click()
    assert page.title() == "红石工厂正在开播 · MC Clicker 2.0"
    page.locator(".cs-actions [data-extra-default=title]").click()
    assert page.locator("[data-preview-status]").inner_text() == "默认外观 · 已还原"
    assert page.locator(".cs-title-sign").count() == 0
    assert page.evaluate("mcDebug.state.collection.owned['title-1'] && !mcDebug.state.collection.equipped.title")
    page.locator("[data-preview=title-1]").click()
    page.locator("[data-extra-equip=title-1]").click()
    page.locator("[data-collection-tab=studio]").click()
    page.locator("[data-studio-part=studioWall]").click()
    page.locator("[data-preview=studioWall-1]").click()
    page.screenshot(path=str(OUT / "103-workshop-studio.png"))
    page.locator("[data-extra-buy=studioWall-1]").click()
    page.locator("[data-collection-tab=world]").click()
    for item in ["world-day", "world-weather", "world-rain"]:
        page.locator(f"[data-preview={item}]").click()
        page.locator(f"[data-extra-buy={item}]").click()
    page.locator("[data-extra-toggle=world-rain]").click()
    assert page.evaluate("mcDebug.state.collection.disabled['world-rain'] === true")
    # Simulate an existing upgradable garden to check both actions remain visible.
    page.evaluate("mcDebug.state.counts.X7 = 1")
    page.locator("[data-preview=garden]").click()
    assert page.locator("[data-extra-toggle=garden]").count() == 1
    assert page.locator("[data-extra-buy=garden]").count() == 1
    page.locator("[data-extra-toggle=garden]").click()
    assert page.evaluate("mcDebug.state.collection.disabled.garden === true")
    page.locator("[data-extra-reset-all]").click()
    assert page.evaluate("Object.keys(mcDebug.state.collection.equipped).length === 0")
    assert page.locator("[data-preview-status]").inner_text() == "默认外观 · 已还原"
    page.locator("[data-collection-tab=cursor]").focus()
    page.keyboard.press("ArrowRight")
    assert page.locator("[data-collection-tab=frame]").get_attribute("aria-selected") == "true"
    page.locator("[data-collection-tab=cursor]").click()
    page.locator("[data-preview=cursor-2]").click()
    page.locator("[data-preview-test=cursor-2]").click()
    page.evaluate("mcDebug.save()")
    page.reload()
    page.wait_for_load_state("networkidle")
    assert page.evaluate("Object.keys(mcDebug.state.collection.equipped).length === 0")
    assert page.evaluate("mcDebug.state.collection.owned['title-1'] && mcDebug.state.collection.owned['studioWall-1']")
    assert page.evaluate("mcDebug.state.collection.disabled['world-day'] && mcDebug.state.collection.disabled['world-rain']")
    context.close()

    context = browser.new_context(
        viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True,
    )
    page = open_fixture(context)
    page.locator("#collection-open").tap()
    page.locator("#collection-shop").wait_for()
    page.screenshot(path=str(OUT / "101-workshop-phone.png"))
    for category in ["title", "icon", "cursor", "frame", "share", "flag", "sky", "studio", "world"]:
        page.locator(f"[data-collection-tab={category}]").tap()
        if category == "cursor":
            page.locator("[data-preview=cursor-2]").tap()
            page.locator("[data-preview-test=cursor-2]").tap()
            assert "叮！" in page.locator("[data-preview-feedback]").inner_text()
        assert page.evaluate("document.querySelector('#collection-shop').scrollWidth <= document.querySelector('#collection-shop').clientWidth + 1"), category
    page.locator("[data-collection-tab=studio]").tap()
    page.locator("[data-studio-part=studioShelf]").tap()
    page.locator("[data-preview=studioShelf-1]").tap()
    page.locator("[data-extra-buy=studioShelf-1]").tap()
    page.screenshot(path=str(OUT / "104-workshop-studio-phone.png"))
    page.locator("[data-collection-tab=share]").tap()
    page.locator("[data-preview=share-2]").tap()
    page.locator("[data-preview-test=share-2]").tap()
    page.locator("[data-extra-buy=share-2]").tap()
    page.locator(".cs-actions [data-extra-default=share]").tap()
    assert page.locator(".cs-default-preview").count() == 1
    page.locator("[data-extra-reset-all]").tap()
    page.screenshot(path=str(OUT / "102-workshop-default.png"))
    page.set_viewport_size({"width": 320, "height": 720})
    page.locator("[data-collection-tab=title]").tap()
    assert page.evaluate("document.querySelector('#collection-shop').scrollWidth <= document.querySelector('#collection-shop').clientWidth + 1")
    assert page.locator(".cs-primary").bounding_box()["width"] > 270
    assert not errors, errors
    result = {
        "url": BASE, "desktop": "1360x900", "touch": ["390x844", "320x720"],
        "fixture": "residentFixture + open stall; garden count injected for upgrade/toggle UI",
        "previewDoesNotEquip": True, "purchaseThenUnequipThenEquip": True,
        "defaultSceneVisible": True, "resetPreservesCollectionAfterReload": True,
        "worldEffectsIndividuallyToggle": True, "gardenUpgradeAndToggleCoexist": True,
        "keyboardCategoryNavigation": True, "touchCursorAndSharePreview": True,
        "nineCategoriesWithoutOverflow": True, "fixedPhoneActions": True,
        "errors": errors,
    }
    (OUT / "workshop-polish-observations.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(result, ensure_ascii=False))
    browser.close()
