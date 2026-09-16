"""Verify the redesigned mailbox through real mouse/touch controls at three widths.

The only seeded state is a funded early village created with the real purchase
and guidance APIs, before owning V18. Every subsequent purchase, read, upgrade,
claim, and download uses the production UI. Save receipts are read, never edited.
No social platform is opened and no external message is sent.
"""

import argparse
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import traceback

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
SAVE_KEY = "mc-clicker-world-v2"
spec = importlib.util.spec_from_file_location(
    "mail_placement_qa", Path(__file__).with_name("verify-interiors-release.py")
)
placement_qa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(placement_qa)

LETTERS = ["welcome-wechat", "welcome-xiaohongshu"]
MEDIA = {
    "welcome-wechat": "wechat-channel-qr.webp",
    "welcome-xiaohongshu": "xiaohongshu-qr.webp",
}
READER = ".mail-letter-scroll"
REWARD_DOCK = ".mail-reward-slot"


def fixture():
    code = """
      import {fresh,buy} from './src/game.js';
      import {ITEMS} from './src/catalog.js';
      import {buyGuidance} from './src/guidance.js';
      import {POSTAL_RATES,POSTAL_UPGRADE_COSTS} from './src/mail.js';
      const state=fresh(); state.money=1000; state.reducedMotion=true;
      for(const id of ['T1','goals','V1','info']) {
        const result=id==='goals'||id==='info' ? buyGuidance(state,id) : buy(state,id);
        if(!result.ok) throw Error(id+': '+result.reason);
      }
      if(state.counts.V18) throw Error('Fixture must not own mailbox');
      if(state.counts.V2||state.counts.T7) throw Error('Fixture must precede workers/workbench');
      console.log(JSON.stringify({state,cost:ITEMS.V18.cost,
        postalRates:POSTAL_RATES,postalCosts:POSTAL_UPGRADE_COSTS}));
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


def click(page, selector, mobile):
    target = page.locator(selector).first
    target.wait_for(state="visible")
    target.tap() if mobile else target.click()


def receipt(page, letter):
    return saved(page)["mail"]["letters"][letter]


def assert_paid(before, after, cost):
    placement_qa.assert_paid(before, after, cost)


def no_overflow(page):
    placement_qa.no_overflow(page)
    for selector in ["#mail-panel", ".mail-letter", ".mail-list"]:
        element = page.locator(selector)
        if element.count() and element.first.is_visible():
            assert element.first.evaluate("e=>e.scrollWidth<=e.clientWidth+1"), selector


def fully_visible(page, selector):
    """Check viewport and all clipping ancestors, without scrolling the control."""
    element = page.locator(selector).first
    element.wait_for(state="visible")
    result = element.evaluate("""e=>{
      const r=e.getBoundingClientRect(),clip={left:0,top:0,right:innerWidth,bottom:innerHeight};
      for(let p=e.parentElement;p;p=p.parentElement){
        const s=getComputedStyle(p),b=p.getBoundingClientRect();
        if(/auto|scroll|hidden|clip/.test(s.overflowX)){
          clip.left=Math.max(clip.left,b.left);clip.right=Math.min(clip.right,b.right);
        }
        if(/auto|scroll|hidden|clip/.test(s.overflowY)){
          clip.top=Math.max(clip.top,b.top);clip.bottom=Math.min(clip.bottom,b.bottom);
        }
      }
      const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
      return {rect:{x:r.x,y:r.y,width:r.width,height:r.height},clip,unobscured:e.contains(hit),
        visible:r.left>=clip.left-1&&r.top>=clip.top-1&&r.right<=clip.right+1&&r.bottom<=clip.bottom+1};
    }""")
    assert result["visible"], {"selector": selector, **result}
    assert result["unobscured"], {"selector": selector, "reason": "control is covered by another UI layer", **result}
    return result["rect"]


def mail_tab(page, name, mobile):
    click(page, f'[data-mail-tab="{name}"]', mobile)


def reader_feedback(page, mobile):
    """Real scroll input leaves both choices visible and the same body mounted."""
    claim_selector = f"{REWARD_DOCK} [data-mail-claim]"
    later_selector = f"{REWARD_DOCK} [data-mail-back]"
    claim_before = fully_visible(page, claim_selector)
    later_before = fully_visible(page, later_selector)
    assert "稍后" in page.locator(later_selector).inner_text()
    body = page.locator(READER)
    page.evaluate("""selector=>{
      window.__mailReaderQA={scroll:document.querySelector(selector),
        article:document.querySelector('[data-mail-letter]'),
        body:document.querySelector('.mail-letter-body')};
    }""", READER)
    bounds = body.bounding_box()
    assert bounds and bounds["height"] > 100
    scrollable = body.evaluate("e=>e.scrollHeight>e.clientHeight+40")
    if mobile:
        assert scrollable, "phone letter should scroll inside its own region"
    if scrollable and mobile:
        session = page.context.new_cdp_session(page)
        x = bounds["x"] + bounds["width"] * 0.65
        start = bounds["y"] + bounds["height"] * 0.82
        end = bounds["y"] + bounds["height"] * 0.2
        session.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": start}]})
        for step in range(1, 9):
            session.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": x, "y": start + (end - start) * step / 8}]})
            page.wait_for_timeout(30)
        session.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
        session.detach()
    elif scrollable:
        page.mouse.move(bounds["x"] + bounds["width"] * 0.6, bounds["y"] + bounds["height"] * 0.6)
        page.mouse.wheel(0, 360)
    if scrollable:
        page.wait_for_function("selector=>document.querySelector(selector).scrollTop>30", arg=READER)
    # Let native touch inertia finish, then observe ordinary income/refresh ticks.
    page.wait_for_timeout(650)
    scroll_before = body.evaluate("e=>e.scrollTop")
    page.wait_for_timeout(1300)
    stable = page.evaluate("""selector=>{
      const q=window.__mailReaderQA,s=document.querySelector(selector);
      return {bodyPresent:!!q.body,sameScroll:s===q.scroll,sameArticle:document.querySelector('[data-mail-letter]')===q.article,
        sameBody:document.querySelector('.mail-letter-body')===q.body,scrollTop:s.scrollTop};
    }""", READER)
    assert stable["bodyPresent"] and stable["sameScroll"] and stable["sameArticle"] and stable["sameBody"], stable
    assert abs(stable["scrollTop"] - scroll_before) < 2, "periodic income refresh moved the reading position"
    claim_after = fully_visible(page, claim_selector)
    later_after = fully_visible(page, later_selector)
    for before, after in [(claim_before, claim_after), (later_before, later_after)]:
        assert abs(before["y"] - after["y"]) < 1, "reading scroll moved the fixed action area"
        assert abs(before["height"] - after["height"]) < 1
    return {"claim": claim_after, "later": later_after, "scrollTop": stable["scrollTop"], "scrollable": scrollable,
        "sameBodyAfterIncomeRefresh": True}


def reader_space_key(page, letter):
    before = saved(page)
    body = page.locator(READER)
    top = body.evaluate("e=>e.scrollTop")
    scrollable = body.evaluate("e=>e.scrollHeight>e.clientHeight+20")
    body.focus()
    page.keyboard.press("Space")
    page.wait_for_timeout(500)
    after_scroll = body.evaluate("e=>e.scrollTop")
    if scrollable:
        assert after_scroll > top + 10, "Space should natively scroll the focused letter"
    # Reopen the same already-read letter via real controls, which saves current
    # state and prevents the eight-second autosave delay hiding an accidental mine.
    click(page, f"{REWARD_DOCK} [data-mail-back]", False)
    click(page, f'[data-mail-open="{letter}"]', False)
    after = saved(page)
    assert after["clicks"] == before["clicks"], "Space in the mailbox must not mine"
    assert after["manualIncome"] == before["manualIncome"]
    assert after["postalIncome"] >= before["postalIncome"]
    assert_unclaimed(after["mail"]["letters"][letter], True)
    return {"scrollable": scrollable, "scrollBefore": top, "scrollAfter": after_scroll,
        "clicksBefore": before["clicks"], "clicksAfter": after["clicks"],
        "manualIncomeBefore": before["manualIncome"], "manualIncomeAfter": after["manualIncome"]}


def open_mail(page, mobile):
    click(page, "#info-open", mobile)
    page.locator("#info-panel").wait_for(state="visible")
    click(page, "#info-mailbox", mobile)
    page.locator("#mail-panel").wait_for(state="visible")
    assert not page.locator("#modal").is_visible(), "mailbox uses the world panel"
    page.wait_for_function("document.querySelector('#panel-content').scrollTop < 2")
    fully_visible(page, '[data-mail-tab="letters"]')
    assert page.locator(".mail-inbox-scroll").evaluate("e=>e.scrollTop<2")


def wait_rate(page, rate):
    page.wait_for_function(
        "rate=>Number(document.querySelector('#rate').textContent.replaceAll(',',''))===rate",
        arg=rate,
    )


def assert_unclaimed(record, read):
    assert (record["readAt"] is not None) == read, record
    assert record["claimedAt"] is None, record
    assert record["claimedRate"] is None, "reading must not snapshot the reward rate"
    assert record["reward"] is None, "reading must not lock the reward amount"


def wait_qr_decoded(page, letter):
    selector = f'#mail-panel img[src*="{MEDIA[letter]}"]'
    page.wait_for_function(
        "selector=>{const e=document.querySelector(selector);return e?.complete&&e.naturalWidth>100}",
        arg=selector,
    )
    page.locator(selector).first.evaluate("e=>e.decode()")
    page.evaluate("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))")


def download_qr(page, mobile, letter):
    media = page.locator(f'#mail-panel img[src*="{MEDIA[letter]}"]').first
    media.wait_for(state="visible")
    # The image is intentionally larger than its cropped QR window. Scroll the
    # window into view rather than scrolling the hidden original-image bounds.
    page.locator("#mail-panel .mail-image-view").first.scroll_into_view_if_needed()
    page.wait_for_function(
        "selector=>{const e=document.querySelector(selector);return e?.complete&&e.naturalWidth>100}",
        arg=f'#mail-panel img[src*="{MEDIA[letter]}"]',
    )
    dimensions = media.evaluate("e=>({width:e.naturalWidth,height:e.naturalHeight})")
    with page.expect_download() as event:
        click(page, '#mail-panel a[download]', mobile)
    original = (ROOT / "public/mail" / MEDIA[letter]).read_bytes()
    with tempfile.TemporaryDirectory(prefix="mc-mail-download-") as tmp:
        destination = Path(tmp) / MEDIA[letter]
        event.value.save_as(destination)
        downloaded = destination.read_bytes()
        assert downloaded == original, "download must keep the complete original image"
    return {
        "filename": event.value.suggested_filename,
        "bytes": len(original),
        "sha256": hashlib.sha256(original).hexdigest(),
        **dimensions,
    }


def exercise(page, payload, viewport, output, prefix, report):
    mobile = viewport["width"] < 600
    checks = report["checks"]
    state = payload["state"]
    page.locator("#world canvas").wait_for(state="visible")
    assert page.evaluate("typeof window.mcDebug") == "undefined"
    assert saved(page)["counts"].get("V18", 0) == 0
    no_overflow(page)
    checks["productionWithoutDebugUsesPaidEarlyFixture"] = True

    click(page, "#info-open", mobile)
    assert page.locator("#info-mailbox").count() == 0
    click(page, "#modal-close", mobile)
    click(page, '[data-nav="build"]', mobile)
    before = saved(page)
    click(page, '[data-buy="V18"]', mobile)
    page.locator("#placement-bar").wait_for(state="visible")
    assert not page.locator("#placement-confirm").is_enabled()
    assert saved(page)["counts"].get("V18", 0) == 0
    assert_paid(before, saved(page), 0)
    click(page, "#placement-cancel", mobile)
    after = saved(page)
    assert after["counts"] == before["counts"]
    assert after["placements"] == before["placements"]
    assert_paid(before, after, 0)
    checks["mailboxPreviewAndCancellationDoNotSpendOrBuild"] = True

    click(page, '[data-buy="V18"]', mobile)
    page.wait_for_timeout(600)
    report["placement"] = placement_qa.choose_grid(page)
    page.screenshot(path=output / f"{prefix}-placement.png")
    click(page, "#placement-confirm", mobile)
    page.wait_for_function(
        "key=>JSON.parse(localStorage.getItem(key)).counts.V18===1", arg=SAVE_KEY
    )
    after = saved(page)
    assert "V18" in after["placements"]
    assert_paid(before, after, payload["cost"])
    assert after["mail"]["postalLevel"] == 1
    assert set(after["mail"]["letters"]) == set(LETTERS)
    for letter in LETTERS:
        assert_unclaimed(after["mail"]["letters"][letter], False)
    assert not page.locator("#mail-panel").is_visible(), "delivery must not force a reading panel"
    checks["confirmedSiteCostsOnceCreatesPostalLevelOneAndTwoUnreadLetters"] = True

    wait_rate(page, payload["postalRates"][1])
    open_mail(page, mobile)
    assert page.locator("[data-mail-open]").count() == 2
    no_overflow(page)
    page.wait_for_function("!document.querySelector('#toast').classList.contains('visible')")
    report["initialCards"] = {
        letter: fully_visible(page, f'[data-mail-open="{letter}"]') for letter in LETTERS
    }
    page.screenshot(path=output / f"{prefix}-inbox.png")
    checks["infoShortcutOpensMailboxWithoutInterruptingWorld"] = True
    checks["bothInitialLettersAreFullyVisibleWithoutScrolling"] = True
    mail_tab(page, "postal", mobile)
    assert page.locator("[data-postal-level]").inner_text() == "Lv.1"
    assert "+1" in page.locator("[data-postal-rate]").inner_text()
    fully_visible(page, "[data-mail-upgrade]")
    page.wait_for_function("(()=>{const i=document.querySelector('.mail-postal-art img');return i?.complete&&i.naturalWidth>0})()")
    page.locator(".mail-postal-art img").evaluate("e=>e.decode()")
    page.screenshot(path=output / f"{prefix}-postal.png")
    mail_tab(page, "letters", mobile)
    checks["postalUsesDedicatedTabWithVisibleUpgrade"] = True

    first = LETTERS[0]
    before_read = saved(page)
    click(page, f'[data-mail-open="{first}"]', mobile)
    record = receipt(page, first)
    assert_unclaimed(record, True)
    assert saved(page)["mailIncome"] == before_read["mailIncome"]
    assert_paid(before_read, saved(page), 0)
    assert_unclaimed(receipt(page, LETTERS[1]), False)
    checks["readingOnlyMarksChosenLetterAndDoesNotPayOrLockRate"] = True
    body = page.locator("#mail-panel").inner_text()
    assert "领取时" in body
    for old_text in ["阅读时锁定", "阅读时的实时速率", "奖励数值锁定"]:
        assert old_text not in body
    if not mobile:
        report["readerSpace"] = reader_space_key(page, first)
        checks["spaceScrollsFocusedLetterWithoutMiningAndPostalIncomeContinues"] = True
    fully_visible(page, f"{REWARD_DOCK} [data-mail-claim]")
    fully_visible(page, f"{REWARD_DOCK} [data-mail-back]")
    wait_qr_decoded(page, first)
    page.screenshot(path=output / f"{prefix}-reader-top.png")
    report["readingFeedback"] = reader_feedback(page, mobile)
    checks["claimAndLaterRemainVisibleWhileOnlyLetterBodyScrolls"] = True
    checks["incomeRefreshPreservesReadingDomAndScrollPosition"] = True
    report["downloads"][first] = download_qr(page, mobile, first)
    no_overflow(page)
    page.screenshot(path=output / f"{prefix}-wechat.png")
    click(page, "[data-mail-back]", mobile)
    assert_unclaimed(receipt(page, first), True)
    assert saved(page)["mailIncome"] == before_read["mailIncome"]
    click(page, '[data-mail-filter="unread"]', mobile)
    assert page.locator("[data-mail-open]").count() == 1
    assert page.locator(f'[data-mail-open="{LETTERS[1]}"]').is_visible()
    click(page, '[data-mail-filter="pending"]', mobile)
    assert page.locator("[data-mail-open]").count() == 1
    assert page.locator(f'[data-mail-open="{first}"]').is_visible()
    click(page, '[data-mail-filter="all"]', mobile)
    checks["returnToInboxKeepsRewardUnclaimedAndQrDownloadsOriginal"] = True
    checks["unreadAndPendingFiltersFollowIndependentReadReceipts"] = True

    mail_tab(page, "postal", mobile)
    before_upgrade = saved(page)
    click(page, "[data-mail-upgrade]", mobile)
    after_upgrade = saved(page)
    assert after_upgrade["mail"]["postalLevel"] == 2
    assert_paid(before_upgrade, after_upgrade, payload["postalCosts"][0])
    wait_rate(page, payload["postalRates"][2])
    mail_tab(page, "letters", mobile)
    click(page, f'[data-mail-open="{first}"]', mobile)
    assert_unclaimed(receipt(page, first), True)
    before_claim = saved(page)
    click(page, f'[data-mail-claim="{first}"]', mobile)
    after_claim = saved(page)
    record = after_claim["mail"]["letters"][first]
    assert record["claimedAt"] is not None
    assert math.isclose(record["claimedRate"], payload["postalRates"][2], abs_tol=1e-6)
    assert record["reward"] == record["claimedRate"] * 5
    assert math.isclose(
        after_claim["mailIncome"] - before_claim["mailIncome"], record["reward"], abs_tol=1e-8
    )
    assert_paid(before_claim, after_claim, 0)
    assert_unclaimed(after_claim["mail"]["letters"][LETTERS[1]], False)
    report["receipts"][first] = record
    checks["upgradingAfterReadingClaimsNewCurrentRateTimesFiveExactlyOnce"] = True
    first_receipt = dict(record)
    page.reload(wait_until="networkidle")
    assert receipt(page, first) == first_receipt
    open_mail(page, mobile)
    click(page, f'[data-mail-open="{first}"]', mobile)
    claim = page.locator(f'[data-mail-claim="{first}"]')
    assert claim.count() == 0 or claim.is_disabled(), "claimed receipt must not reopen on reload"
    assert math.isclose(saved(page)["mailIncome"], after_claim["mailIncome"], abs_tol=1e-8)
    checks["firstClaimSurvivesReloadAndCannotBeClaimedTwice"] = True
    click(page, "[data-mail-back]", mobile)

    second = LETTERS[1]
    click(page, f'[data-mail-open="{second}"]', mobile)
    assert_unclaimed(receipt(page, second), True)
    report["downloads"][second] = download_qr(page, mobile, second)
    no_overflow(page)
    page.screenshot(path=output / f"{prefix}-xiaohongshu.png")
    click(page, "[data-mail-back]", mobile)
    mail_tab(page, "postal", mobile)
    before_upgrade = saved(page)
    click(page, "[data-mail-upgrade]", mobile)
    assert saved(page)["mail"]["postalLevel"] == 3
    assert_paid(before_upgrade, saved(page), payload["postalCosts"][1])
    wait_rate(page, payload["postalRates"][3])
    mail_tab(page, "letters", mobile)
    click(page, f'[data-mail-open="{second}"]', mobile)
    before_claim = saved(page)
    click(page, f'[data-mail-claim="{second}"]', mobile)
    after_claim = saved(page)
    record = after_claim["mail"]["letters"][second]
    assert math.isclose(record["claimedRate"], payload["postalRates"][3], abs_tol=1e-6)
    assert record["reward"] == record["claimedRate"] * 5
    assert math.isclose(
        after_claim["mailIncome"] - before_claim["mailIncome"], record["reward"], abs_tol=1e-8
    )
    assert_paid(before_claim, after_claim, 0)
    assert receipt(page, first) == first_receipt
    report["receipts"][second] = record
    checks["secondLetterHasIndependentReadAndClaimAndUsesLaterHigherRate"] = True
    final_receipts = after_claim["mail"]["letters"]
    page.reload(wait_until="networkidle")
    assert saved(page)["mail"]["letters"] == final_receipts
    assert saved(page)["mail"]["postalLevel"] == 3
    open_mail(page, mobile)
    for letter in LETTERS:
        click(page, f'[data-mail-open="{letter}"]', mobile)
        claim = page.locator(f'[data-mail-claim="{letter}"]')
        assert claim.count() == 0 or claim.is_disabled()
        assert saved(page)["mailIncome"] == after_claim["mailIncome"]
        click(page, "[data-mail-back]", mobile)
    checks["bothClaimedLettersStayReadableWithoutDuplicateRewardsAfterReload"] = True
    no_overflow(page)
    assert saved(page)["postalIncome"] > 0
    assert not report["errors"], report["errors"]
    assert not report["failedRequests"], report["failedRequests"]
    checks["noHorizontalOverflowPageErrorsOrFailedAssets"] = True
    report["passed"] = True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--url", default=os.environ.get("MC_RELEASE_URL", "http://127.0.0.1:8891/projects/mc-clicker-2/")
    )
    parser.add_argument("--label", choices=["local", "public"], default="local")
    args = parser.parse_args()
    payload = fixture()
    output = ROOT / "docs/qa"
    output.mkdir(parents=True, exist_ok=True)
    report = {
        "url": args.url,
        "label": args.label,
        "design": "Pixel post office with separate letters/postal tabs and fixed reader actions",
        "fixture": "Only T1, V1 and paid goals/info; funded before V18; no mcDebug",
        "stateInspection": "Read-only localStorage receipts; all subsequent changes use production UI",
        "rewardRule": "actual earning rate at claim time × 5; reads do not snapshot rewards",
        "nativeInput": "Desktop mouse; phone touchscreen, real canvas placement for all widths",
        "viewports": {},
        "passed": False,
    }
    failures = []
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True, args=["--use-angle=metal"] if sys.platform == "darwin" else []
        )
        for width, height in [(1440, 1000), (390, 844), (320, 740)]:
            viewport = {"width": width, "height": height}
            current = {
                "viewport": viewport, "checks": {}, "errors": [], "failedRequests": [],
                "receipts": {}, "downloads": {}, "passed": False,
            }
            report["viewports"][str(width)] = current
            context = browser.new_context(
                viewport=viewport, has_touch=True, is_mobile=width < 600,
                device_scale_factor=1, accept_downloads=True,
            )
            context.add_init_script(
                "if(!sessionStorage.getItem('mail-release-seeded')){"
                f"localStorage.setItem({json.dumps(SAVE_KEY)},{json.dumps(json.dumps(payload['state']))});"
                "sessionStorage.setItem('mail-release-seeded','1');}"
            )
            page = context.new_page()
            page.set_default_timeout(15000)
            page.on("pageerror", lambda error, record=current: record["errors"].append(str(error)))
            page.on("response", lambda response, record=current: record["failedRequests"].append(
                {"url": response.url, "status": response.status}
            ) if response.status >= 400 else None)
            page.on("requestfailed", lambda request, record=current: record["failedRequests"].append(
                {"url": request.url, "failure": request.failure}
            ))
            prefix = f"mailbox-redesign-{args.label}-{width}"
            try:
                page.goto(args.url, wait_until="networkidle")
                exercise(page, payload, viewport, output, prefix, current)
            except Exception as error:
                current["failure"] = str(error)
                current["traceback"] = traceback.format_exc()
                failures.append(f"{width}px: {error}")
                page.screenshot(path=output / f"{prefix}-failure.png")
            finally:
                print(f"{width}px: {'PASS' if current['passed'] else 'FAIL'} ({len(current['checks'])} checks)")
                context.close()
        browser.close()
    report["passed"] = not failures
    report["passedChecks"] = sum(len(v["checks"]) for v in report["viewports"].values())
    path = output / f"mailbox-redesign-{args.label}-observations.json"
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(path)
    if failures:
        raise AssertionError("\n".join(failures))


if __name__ == "__main__":
    main()
