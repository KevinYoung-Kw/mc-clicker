"""Verify the production collection workshop and studio through a mobile UI."""

import json
import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
URL = os.environ.get("MC_RELEASE_URL", "http://127.0.0.1:8891/projects/mc-clicker-2/")
SAVE_KEY = "mc-clicker-world-v2"
DEFAULT_TITLE = "MC Clicker 2.0 · 从一块到万物"
TITLE = "橡木小镇 · MC Clicker 2.0"

# Only the isolated QA browser receives this save. Catalog purchases and land
# placement use the real fixture rules. Collection v1 exercises the old save
# shape, with individual extras still unpurchased and sufficient test funds.
generated = subprocess.run(
    [
        "node",
        "--input-type=module",
        "--eval",
        "import {completeFixture} from './scripts/fixtures.mjs';"
        "const s=completeFixture();s.money=1e8;"
        "s.collection={version:1,owned:{},equipped:{}};"
        "s.atmosphere.weather='clear';s.atmosphere.auto=false;"
        "s.atmosphere.cycle=false;s.live.director=false;"
        "console.log(JSON.stringify(s));",
    ],
    cwd=ROOT,
    capture_output=True,
    text=True,
    check=True,
)
fixture = json.loads(generated.stdout)
errors = []
failed = []
responses = []
checks = {}


def saved_state(page):
    return page.evaluate("key => JSON.parse(localStorage.getItem(key))", SAVE_KEY)


def no_overflow(page):
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")


def open_workshop(page, category="title"):
    page.locator("#collection-open").tap()
    page.locator("#collection-shop").wait_for(state="visible")
    page.locator(f'[data-collection-tab="{category}"]').tap()
    no_overflow(page)


def choose(page, item):
    page.locator(f'[data-preview="{item}"]').tap()
    assert (
        page.locator(f'[data-preview="{item}"]').get_attribute("aria-pressed") == "true"
    )


def purchase(page, item):
    choose(page, item)
    page.locator(f'.cs-actions [data-extra-buy="{item}"]').tap()
    assert saved_state(page)["collection"]["owned"][item] is True
    no_overflow(page)


def module_responses():
    return [
        url for url in responses if "collection-ui" in Path(urlparse(url).path).name
    ]


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        headless=True,
        args=["--use-angle=metal"] if sys.platform == "darwin" else [],
    )
    context = browser.new_context(
        viewport={"width": 390, "height": 844},
        has_touch=True,
        is_mobile=True,
        device_scale_factor=1,
    )
    # Seed before the application's first load, exactly once. Subsequent
    # reloads must read the actual UI-written save, without pagehide races.
    context.add_init_script(
        "if(!sessionStorage.getItem('polish-release-seeded')){"
        f"localStorage.setItem({json.dumps(SAVE_KEY)}, {json.dumps(json.dumps(fixture))});"
        "sessionStorage.setItem('polish-release-seeded','1');}"
    )
    page = context.new_page()
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("response", lambda response: responses.append(response.url))
    page.on(
        "response",
        lambda response: (
            failed.append({"url": response.url, "status": response.status})
            if response.status >= 400
            else None
        ),
    )
    page.on(
        "requestfailed",
        lambda request: failed.append({"url": request.url, "failure": request.failure}),
    )
    try:
        page.goto(URL, wait_until="networkidle")
        assert page.evaluate("typeof window.mcDebug") == "undefined"
        assert page.title() == DEFAULT_TITLE
        assert not module_responses(), module_responses()
        checks["workshopNotDownloadedBeforeOpening"] = True
        no_overflow(page)

        open_workshop(page)
        assert module_responses(), (
            "Opening the workshop did not request its separate chunk"
        )
        checks["workshopLoadedOnDemand"] = True
        page.wait_for_function(
            "key => JSON.parse(localStorage.getItem(key)).collection.version === 2",
            arg=SAVE_KEY,
            timeout=15000,
        )
        before_preview = saved_state(page)["collection"]
        choose(page, "title-0")
        choose(page, "title-1")
        choose(page, "title-0")
        # Foreground production/autosave may update money and timestamps;
        # preview must leave the persisted ownership/equipment ledger alone.
        assert saved_state(page)["collection"] == before_preview
        assert page.title() == DEFAULT_TITLE
        checks["previewLeavesSavedCollectionAndActualTitleUnchanged"] = True

        purchase(page, "title-0")
        assert page.title() == TITLE
        page.locator('.cs-actions [data-extra-default="title"]').tap()
        assert page.title() == DEFAULT_TITLE
        assert "title" not in saved_state(page)["collection"]["equipped"]
        assert saved_state(page)["collection"]["owned"]["title-0"] is True
        choose(page, "title-0")
        page.locator('.cs-actions [data-extra-equip="title-0"]').tap()
        assert page.title() == TITLE
        page.reload(wait_until="networkidle")
        assert page.title() == TITLE
        assert saved_state(page)["collection"]["equipped"]["title"] == "title-0"
        checks["titlePurchaseUnequipReequipAndReload"] = True

        open_workshop(page, "frame")
        purchase(page, "frame-1")
        assert page.locator("body").get_attribute("data-frame") == "frame-1"
        checks["frameAppliedToActualInterface"] = True
        page.locator('[data-collection-tab="flag"]').tap()
        purchase(page, "flag-0")
        assert saved_state(page)["collection"]["equipped"]["flag"] == "flag-0"
        checks["firstFlagIsAnExplicitEquipmentChoice"] = True

        page.locator('[data-collection-tab="world"]').tap()
        purchase(page, "world-weather")
        page.locator("[data-weather]").select_option("auto")
        assert saved_state(page)["atmosphere"]["auto"] is True
        purchase(page, "world-rain")
        assert saved_state(page)["atmosphere"]["weather"] == "rain"
        page.locator('.cs-actions [data-extra-toggle="world-rain"]').tap()
        weather_save = saved_state(page)
        assert weather_save["collection"]["disabled"]["world-rain"] is True
        assert weather_save["atmosphere"]["weather"] == "clear"
        choose(page, "world-weather")
        page.locator('.cs-actions [data-extra-toggle="world-weather"]').tap()
        weather_save = saved_state(page)
        assert weather_save["collection"]["disabled"]["world-weather"] is True
        assert weather_save["atmosphere"]["auto"] is False
        assert weather_save["atmosphere"]["weather"] == "clear"
        checks["weatherPurchaseControlAndDisableRestoreClearSky"] = True

        page.locator('[data-collection-tab="studio"]').tap()
        studio_parts = ["studioDesk", "studioWall", "studioSign", "studioShelf"]
        assert page.locator("[data-studio-part]").count() == 4
        for part in studio_parts:
            page.locator(f'[data-studio-part="{part}"]').tap()
            purchase(page, f"{part}-0")
            assert saved_state(page)["collection"]["equipped"][part] == f"{part}-0"
        page.locator('.cs-actions [data-view-effect="studioShelf"]').tap()
        page.locator("body.live-page").wait_for()
        page.locator("#studio-header").wait_for(state="visible")
        assert not page.locator("#modal").is_visible()
        page.wait_for_function(
            "key => JSON.parse(localStorage.getItem(key)).live.shot === 'L2'",
            arg=SAVE_KEY,
            timeout=15000,
        )
        assert saved_state(page)["live"]["camera"] == "overworld"
        checks["fourStudioPartsAndViewActualL2"] = True

        page.locator('[data-studio-tab="equipment"]').tap()
        assert page.locator('[data-studio-view="equipment"]').is_visible()
        before_upgrade = saved_state(page)
        page.locator('[data-studio-view="equipment"] [data-buy="L3"]').tap()
        after_upgrade = saved_state(page)
        assert after_upgrade["counts"]["L3"] == before_upgrade["counts"]["L3"] + 1
        assert after_upgrade["placements"] == before_upgrade["placements"]
        checks["studioCameraUpgradeAddsNoOutsidePlacement"] = True
        no_overflow(page)

        page.locator("#studio-back").tap()
        open_workshop(page, "studio")
        owned_before_reset = saved_state(page)["collection"]["owned"]
        page.locator("[data-extra-reset-all]").tap()
        reset = saved_state(page)
        assert reset["collection"]["equipped"] == {}
        assert reset["collection"]["owned"] == owned_before_reset
        assert reset["collection"]["disabled"]["world-weather"] is True
        assert reset["collection"]["disabled"]["world-rain"] is True
        assert reset["atmosphere"]["weather"] == "clear"
        assert reset["atmosphere"]["auto"] is False
        assert page.title() == DEFAULT_TITLE
        assert page.locator("body").get_attribute("data-frame") == ""
        page.reload(wait_until="networkidle")
        assert page.evaluate("typeof window.mcDebug") == "undefined"
        assert page.title() == DEFAULT_TITLE
        assert page.locator("body").get_attribute("data-frame") == ""
        reset = saved_state(page)
        assert reset["collection"]["equipped"] == {}
        assert reset["collection"]["owned"] == owned_before_reset
        assert reset["collection"]["disabled"]["world-weather"] is True
        assert reset["collection"]["disabled"]["world-rain"] is True
        assert reset["atmosphere"]["weather"] == "clear"
        assert reset["counts"]["L3"] == after_upgrade["counts"]["L3"]
        checks["resetDefaultsPreservesCollectionAndProgressAfterReload"] = True
        open_workshop(page, "studio")
        page.locator('[data-studio-part="studioDesk"]').tap()
        choose(page, "studioDesk-0")
        assert page.locator(
            '.cs-actions [data-extra-equip="studioDesk-0"]'
        ).is_visible()
        no_overflow(page)

        output = ROOT / "docs/qa"
        output.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(output / "99-polish-release-phone.png"))
        assert not errors, errors
        assert not failed, failed
        observation = {
            "url": URL,
            "mobileTouchContext": True,
            "noDebug": True,
            "checks": checks,
            "ownedExtrasKept": sorted(owned_before_reset),
            "workshopChunkRequests": module_responses(),
            "mobileOverflow": False,
            "errors": errors,
            "failedRequests": failed,
        }
        (output / "polish-release-observations.json").write_text(
            json.dumps(observation, ensure_ascii=False, indent=2) + "\n"
        )
        print(json.dumps(observation, ensure_ascii=False))
    finally:
        browser.close()
