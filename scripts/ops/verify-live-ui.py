"""Review storage intent, safe blockers, shared tools, and mobile layout."""

import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--url", required=True)
parser.add_argument("--version", required=True)
parser.add_argument("--out", type=Path, required=True)
args = parser.parse_args()
R = Path(__file__).resolve().parents[2]
out = args.out
out.mkdir(parents=True, exist_ok=True)
seed = json.loads(
    (R / "docs/v1.6/qa/stability-baseline/fixtures/peak.json").read_text()
)
seed.update(money=1e8, reducedMotion=True, energy=120, sound=False)
seed["guidance"]["notices"] = False
seed["narrative"].update(companionsShown=True, intro="released")
for r in seed["community"]["residents"]:
    r.update(job="idle", prioritySource=None, cargo=None)
for g in seed["community"]["golems"]:
    g.update(stops=[], cargo=None)
seed["community"].update(batches=[], tasks={})
for k in seed["grid"]["automation"]:
    seed["grid"]["automation"][k] = 0
for b in seed["buffers"].values():
    b.update(raw=0, goods=0)
seed["live"]["gifts"] = []
seed["harvest"].update(piston=0, treasure=0)
seed["dimensions"].update(heat=0, trips={}, awaiting={"endRaw": 0, "endGoods": 0})
rows = []
with sync_playwright() as p:
    for engine, width in [("chromium", 1440), ("webkit", 390), ("chromium", 320)]:
        browser = getattr(p, engine).launch(headless=True)
        c = browser.new_context(
            viewport={"width": width, "height": 844},
            is_mobile=width < 760,
            has_touch=width < 760,
        )
        c.add_init_script(
            'if(!localStorage.getItem("mc-clicker-world-v2"))localStorage.setItem("mc-clicker-world-v2",'
            + json.dumps(json.dumps(seed))
            + ")"
        )
        page = c.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))

        def click(q):
            page.locator(q).first.click()

        def pause():
            page.evaluate('window.dispatchEvent(new Event("blur"))')

        def shot(name):
            assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
            page.screenshot(path=str(out / f"{name}-{engine}-{width}.png"))

        try:
            page.goto(args.url, wait_until="networkidle")
            pause()
            assert args.version in page.title()
            assert page.evaluate("typeof mcDebug") == "undefined"
            click('[data-nav="network"]')
            shot("industry")
            assert (
                page.locator(".building-management-toolbar").bounding_box()["height"]
                < 75
            )
            assert (
                page.locator(
                    ".building-management-toolbar [data-facility-store]"
                ).count()
                == 0
            )
            click('[data-building-details="M5"]')
            click('[data-facility-store="M5"]')
            shot("blocked")
            assert "暂时不能收纳" in page.locator(".storage-review").inner_text()
            assert "免费摆回" in page.locator(".storage-review").inner_text()
            assert page.locator("#store-confirm").count() == 0
            before = page.evaluate(
                '({energy:JSON.parse(localStorage.getItem("mc-clicker-world-v2")).energy,placement:JSON.parse(localStorage.getItem("mc-clicker-world-v2")).placements.M5})'
            )
            click("#store-help")
            assert page.locator(".electricity-dashboard").is_visible()
            click('[data-building-details="M5"]')
            click('[data-facility-store="M5"]')
            click("#store-move")
            assert page.locator("#placement-confirm").is_visible()
            click("#placement-cancel")
            assert (
                page.evaluate(
                    '({energy:JSON.parse(localStorage.getItem("mc-clicker-world-v2")).energy,placement:JSON.parse(localStorage.getItem("mc-clicker-world-v2")).placements.M5})'
                )
                == before
            )
            click('[data-nav="village"]')
            click('[data-village-tab="production"]')
            shot("village")
            click('[data-village-tab="housing"]')
            click('[data-home-tab="homes"]')
            page.locator(".housing-address").first.scroll_into_view_if_needed()
            shot("housing")
            if page.locator("[data-home-store]").count():
                click("[data-home-store]")
                assert page.locator(".storage-review").is_visible()
                shot("home-review")
                click("#store-cancel")
            click('[data-nav="atlas"]')
            click('[data-detail="V18"]')
            assert page.locator(".mail-tabs").evaluate(
                "e=>e.scrollWidth<=e.clientWidth+1"
            )
            level = page.locator("[data-mail-nav-level]")
            assert level.bounding_box()["height"] < 22
            for tool in ["[data-mail-locate]", "[data-mail-move]", "[data-mail-store]"]:
                box = page.locator(tool).bounding_box()
                assert box["width"] >= 43 and box["height"] >= 43
            shot("mail-tabs")
            click("[data-mail-store]")
            assert page.locator("#store-confirm").is_visible()
            shot("ready")
            click("#store-cancel")
            click("#panel-close")
            if not page.locator("#collection-open").is_visible():
                click("#hud-more")
            click("#collection-open")
            page.locator("#collection-shop").wait_for()
            tool = page.locator("[data-stall-store]")
            box = tool.bounding_box()
            assert abs(box["width"] - 44) < 1 and abs(box["height"] - 44) < 1
            shot("appearance")
            page.locator("#modal-close").click()
            click('[data-nav="village"]')
            if width < 760 and not page.locator("#game").evaluate(
                'e=>e.classList.contains("sheet-expanded")'
            ):
                click("#panel-expand")
            page.wait_for_timeout(500)
            pause()
            page.locator('#notice-center[data-mode="pause"]').wait_for()
            assert page.locator("#panel-notice-slot").evaluate("e=>e.hidden")
            box = page.locator("#notice-center").bounding_box()
            assert (
                abs(box["x"] + box["width"] / 2 - width / 2) < 2
                and abs(box["y"] + box["height"] / 2 - 422) < 2
            )
            shot("pause")
            page.evaluate('window.dispatchEvent(new Event("focus"))')
            click("#panel-close")
            if not page.locator("#info-open").is_visible():
                click("#hud-more")
            click("#info-open")
            click("#info-tab-versions")
            assert "大存档" in page.locator("#info-versions").inner_text()
            assert args.version in page.locator("#info-versions").inner_text()
            assert not errors, errors
            rows.append(
                {
                    "engine": engine,
                    "width": width,
                    "blockedExplained": True,
                    "powerJump": True,
                    "moveCancelPreservesEnergyAndPlacement": True,
                    "homeAndFacilityReview": True,
                    "noOverflow": True,
                    "mailToolsReadable": True,
                    "appearanceToolSquare": True,
                    "pauseCenteredWithoutNoticeGap": True,
                    "errors": errors,
                }
            )
        except:
            page.screenshot(path=str(out / f"failure-{engine}-{width}.png"))
            raise
        finally:
            browser.close()
(out / "report.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2))
print(rows)
