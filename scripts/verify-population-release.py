"""Exercise the production population migration with a real mobile touch context."""

import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
URL = os.environ.get(
    "MC_RELEASE_URL", "http://127.0.0.1:8891/projects/mc-clicker-2/"
)
FIXTURE = json.loads(Path("/tmp/mc-crowd-fixture.json").read_text())
SAVE_KEY = "mc-clicker-world-v2"
errors = []
failed = []


def saved_state(page):
    return page.evaluate("key => JSON.parse(localStorage.getItem(key))", SAVE_KEY)


def open_roster(page):
    page.locator('[data-nav="village"]').tap()
    page.locator('.management-tabs [data-village-tab="residents"]').tap()


def check_compact_roster(page):
    assert page.locator("[data-person]").count() == 12
    assert "12 / 12" in page.locator(".roster-top").inner_text()
    toggle = page.locator("[data-reserve-toggle]")
    assert "33" in toggle.inner_text()
    assert toggle.get_attribute("aria-expanded") == "false"
    assert page.locator('[data-equipment-buy="V2"]').count() == 0
    assert page.locator('[data-buy="V2"]').count() == 0
    assert "常驻名额已满" in page.locator(".roster-top").inner_text()
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")


def check_saved_population(state):
    residents = state["community"]["residents"]
    assert len(residents) == 45
    assert sum(not r.get("reserve", False) for r in residents) == 12
    assert sum(bool(r.get("reserve")) for r in residents) == 33
    teacher = next(r for r in residents if r["id"] == "resident-45")
    assert teacher["name"] == "南瓜老师"
    assert teacher["skills"]["farming"] == 4
    return residents


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        headless=True, args=["--use-angle=metal"]
    )
    context = browser.new_context(
        viewport={"width": 390, "height": 844},
        is_mobile=True,
        has_touch=True,
        device_scale_factor=1,
    )
    # This isolated context never touches the player's save. Seeding in an init
    # script, once per session, avoids pagehide overwriting an injected save and
    # allows the later reload to verify the actual persisted swap.
    context.add_init_script(
        "if (!sessionStorage.getItem('population-release-seeded')) {"
        f"localStorage.setItem({json.dumps(SAVE_KEY)}, {json.dumps(json.dumps(FIXTURE))});"
        "sessionStorage.setItem('population-release-seeded', '1');"
        "}"
    )
    page = context.new_page()
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on(
        "response",
        lambda response: failed.append(
            {"url": response.url, "status": response.status}
        )
        if response.status >= 400
        else None,
    )
    page.on(
        "requestfailed",
        lambda request: failed.append(
            {"url": request.url, "failure": request.failure}
        ),
    )
    try:
        page.goto(URL, wait_until="networkidle")
        assert page.evaluate("typeof window.mcDebug") == "undefined"
        open_roster(page)
        check_compact_roster(page)
        # The normal foreground autosave persists the migrated roster; only
        # read storage here, with no production debug API or source imports.
        page.wait_for_function(
            """key => {
                const saved = JSON.parse(localStorage.getItem(key));
                return saved?.community?.residents?.filter(r => r.reserve).length === 33;
            }""",
            arg=SAVE_KEY,
            timeout=15000,
        )
        check_saved_population(saved_state(page))

        page.locator("[data-reserve-toggle]").tap()
        assert page.locator("[data-person]").count() == 45
        page.locator('[data-person="resident-44"]').tap()
        assert "老朋友" in page.locator(".resident-detail h3").inner_text()
        assert "Lv.3" in page.locator(".resident-detail").inner_text()
        outgoing = page.locator("[data-recall-outgoing]")
        # Residents carrying a shipment cannot be selected for a swap. The
        # known farmer is used for the deterministic success path below.
        busy_options = outgoing.locator("option[disabled]").all_text_contents()
        assert all("正在送货" in label for label in busy_options)
        assert not outgoing.locator('option[value="resident-1"]').is_disabled()
        outgoing.select_option("resident-1")
        page.locator('[data-recall="resident-44"]').tap()
        check_compact_roster(page)
        assert page.locator('[data-person="resident-44"]').count() == 1
        assert page.locator('[data-person="resident-1"]').count() == 0
        residents = check_saved_population(saved_state(page))
        incoming = next(r for r in residents if r["id"] == "resident-44")
        outgoing_saved = next(r for r in residents if r["id"] == "resident-1")
        assert incoming["reserve"] is False
        assert incoming["skills"]["crafting"] == 3
        assert outgoing_saved["reserve"] is True

        page.reload(wait_until="networkidle")
        assert page.evaluate("typeof window.mcDebug") == "undefined"
        open_roster(page)
        check_compact_roster(page)
        assert page.locator('[data-person="resident-44"]').count() == 1
        assert page.locator('[data-person="resident-1"]').count() == 0
        page.locator('[data-person="resident-44"]').tap()
        assert "老朋友" in page.locator(".resident-detail h3").inner_text()
        residents = check_saved_population(saved_state(page))
        assert next(r for r in residents if r["id"] == "resident-44")["reserve"] is False
        assert next(r for r in residents if r["id"] == "resident-1")["reserve"] is True
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
        output = ROOT / "docs/qa"
        output.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(output / "93-population-release-phone.png"))
        assert not errors, errors
        assert not failed, failed
        observation = {
            "url": URL,
            "debugAbsent": True,
            "mobileTouchContext": True,
            "legacyResidents": 45,
            "activeResidents": 12,
            "reserves": 33,
            "reserveInitiallyCollapsed": True,
            "recruitmentUnavailableAtCap": True,
            "resident45FarmingLevel": 4,
            "swap": {"incoming": "resident-44", "outgoing": "resident-1"},
            "swapAndPersonalSkillsPersistAfterReload": True,
            "busySwapOptionsObserved": busy_options,
            "mobileOverflow": False,
            "errors": errors,
            "failedRequests": failed,
        }
        (output / "population-release-observations.json").write_text(
            json.dumps(observation, ensure_ascii=False, indent=2) + "\n"
        )
    finally:
        browser.close()

print(json.dumps(observation, ensure_ascii=False))
