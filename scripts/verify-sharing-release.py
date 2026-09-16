"""Verify free sharing on mobile and desktop without sending anything externally.

Native share and clipboard APIs are replaced only inside isolated QA contexts.
All gameplay and share-button actions use actual mouse or touch input.
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
CANONICAL_URL = "https://www.kw-aigc.cn/projects/mc-clicker-2/"

STUB = r"""
window.__shareQA = {
  calls: [], clipboard: [], supportFiles: true, supportLinks: true,
  rejectClipboard: false, abortNext: false, failNext: false, clickSequence: 0, currentClick: null
};
document.addEventListener('click', event => {
  if (!event.target.closest('#native-share-link, #native-share-image')) return;
  const q = window.__shareQA;
  q.currentClick = ++q.clickSequence;
  setTimeout(() => { q.currentClick = null; }, 0);
}, true);
Object.defineProperty(navigator, 'canShare', { configurable:true, value(data) {
  return data.files ? window.__shareQA.supportFiles : window.__shareQA.supportLinks;
}});
Object.defineProperty(navigator, 'share', { configurable:true, value(data) {
  const q=window.__shareQA, call={title:data.title,text:data.text,url:data.url,
    active:navigator.userActivation.isActive, click:q.currentClick, eventType:window.event?.type,
    files:(data.files||[]).map(f=>({name:f.name,type:f.type,size:f.size,isFile:f instanceof File}))};
  q.calls.push(call);
  if (data.files) data.files.forEach((file,index) => file.arrayBuffer().then(buffer => {
    const bytes=new Uint8Array(buffer), view=new DataView(buffer);
    Object.assign(call.files[index],{signature:Array.from(bytes.slice(0,8)),
      width:buffer.byteLength>=24?view.getUint32(16):0,
      height:buffer.byteLength>=24?view.getUint32(20):0});
  }));
  if(q.abortNext){q.abortNext=false;call.aborted=true;return Promise.reject(new DOMException('QA cancelled','AbortError'));}
  if(q.failNext){q.failNext=false;call.failed=true;return Promise.reject(new DOMException('QA blocked','NotAllowedError'));}
  return Promise.resolve();
}});
Object.defineProperty(navigator, 'clipboard', { configurable:true, value:{writeText(text) {
  window.__shareQA.clipboard.push(text);
  return window.__shareQA.rejectClipboard
    ? Promise.reject(new DOMException('QA clipboard denied','NotAllowedError'))
    : Promise.resolve();
}}});
"""


def click(page, selector, mobile):
    target = page.locator(selector).first
    if selector == "#share-open" and not target.is_visible() and page.locator("#hud-more").is_visible():
        page.locator("#hud-more").tap()
    target.wait_for(state="visible")
    target.tap() if mobile else target.click()


def open_share(page, mobile):
    click(page, "#share-open", mobile)
    page.locator("#share-panel").wait_for(state="visible")
    assert page.locator("#share-card-preview img").count() == 0
    assert not page.locator("#download-card").is_visible()
    assert not page.locator("#native-share-image").is_visible()


def generate(page, mobile, expected_scene):
    assert expected_scene in page.locator("[data-share-scene]").inner_text()
    click(page, "#generate-card", mobile)
    canvas = page.locator("#share-card-preview img")
    canvas.wait_for(state="visible")
    assert canvas.evaluate("e => e.naturalWidth") == 1440
    assert canvas.evaluate("e => e.naturalHeight") == 1500
    assert expected_scene in page.locator("[data-share-scene]").inner_text()
    assert expected_scene in canvas.get_attribute("alt")
    page.wait_for_function("!document.querySelector('#generate-card').disabled")
    return canvas


def png_download(page, mobile, destination):
    with page.expect_download() as info:
        click(page, "#download-card", mobile)
    info.value.save_as(destination)
    data = destination.read_bytes()
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    assert int.from_bytes(data[16:20], "big") == 1440
    assert int.from_bytes(data[20:24], "big") == 1500
    assert len(data) > 10000
    return {"name": info.value.suggested_filename, "bytes": len(data), "width": 1440, "height": 1500}


def assert_file_call(call):
    assert call["active"] is True
    assert call["click"] and call["eventType"] == "click", "navigator.share must be called from the original click event"
    assert len(call["files"]) == 1
    file = call["files"][0]
    assert file["isFile"] is True
    assert file["type"] == "image/png"
    assert file["size"] > 10000
    assert file["signature"] == [137, 80, 78, 71, 13, 10, 26, 10]
    assert (file["width"], file["height"]) == (1440, 1500)


def check_clipboard_fallback(page):
    page.wait_for_function("document.querySelector('#toast').textContent.includes('链接已选中')")
    assert page.locator("#share-url").input_value() == CANONICAL_URL
    selection = page.locator("#share-url").evaluate("e=>[e.selectionStart,e.selectionEnd]")
    assert selection == [0, len(CANONICAL_URL)]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default=os.environ.get("MC_RELEASE_URL", "http://127.0.0.1:8890/"))
    parser.add_argument("--label", default="local")
    args = parser.parse_args()
    output = ROOT / "docs/qa" / f"sharing-{args.label}"
    output.mkdir(parents=True, exist_ok=True)
    payload = qa.fixture()
    seed = payload["state"]
    seed["money"] = 5000
    report = {"url": args.url, "checks": {}, "errors": [], "failedRequests": [], "downloads": {}, "nativeShareIsStubbed": True}
    checks = report["checks"]
    contexts = []
    current_page = None
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--use-angle=metal"] if sys.platform == "darwin" else [])

        def context_for(state, mobile, settings=""):
            nonlocal current_page
            context = browser.new_context(viewport={"width": 390, "height": 844} if mobile else {"width": 1440, "height": 1000}, has_touch=mobile, is_mobile=mobile, device_scale_factor=1, accept_downloads=True)
            contexts.append(context)
            context.add_init_script(STUB + settings)
            context.add_init_script(
                "if(!sessionStorage.getItem('sharing-release-seeded')){"
                f"localStorage.setItem({json.dumps(SAVE_KEY)},{json.dumps(json.dumps(state))});"
                "sessionStorage.setItem('sharing-release-seeded','1');}"
            )
            page = context.new_page()
            current_page = page
            page.set_default_timeout(15000)
            page.on("pageerror", lambda error: report["errors"].append(str(error)))
            page.on("response", lambda r: report["failedRequests"].append({"url": r.url, "status": r.status}) if r.status >= 400 else None)
            page.on("requestfailed", lambda r: report["failedRequests"].append({"url": r.url, "failure": r.failure}))
            page.goto(args.url, wait_until="networkidle")
            if urlparse(args.url).port != 8890:
                assert page.evaluate("typeof window.mcDebug") == "undefined"
            qa.no_overflow(page)
            return page

        try:
            page = context_for(seed, True)
            assert page.locator("#share-open").evaluate("e => !e.hidden")
            glyphs = [page.locator(selector + " svg").first.inner_html() for selector in ["#share-open", "#collection-open", '[data-nav="atlas"]', '[data-room-tab="program"]']]
            assert len(set(glyphs)) == 4
            checks["fourDistinctShareDecorationAtlasCameraIcons"] = True
            checks["shareEntryFreeByDefault"] = True
            click(page, '[data-nav="village"]', True)
            click(page, '[data-village-tab="market"]', True)
            before = qa.saved(page)
            assert page.locator("[data-unlock-sharing]").count()==0
            open_share(page, True)
            unlocked = qa.saved(page)
            assert unlocked["sharing"]["unlocked"] is True
            qa.assert_paid(before, unlocked, 0)
            assert qa.progress(unlocked) == qa.progress(before), "sharing must not place buildings or change collection ownership"
            assert page.locator("#share-open").evaluate("e => !e.hidden")
            assert page.locator("#share-card-preview img").count() == 0
            checks["freeSharingDoesNotDebitMoneyOrPlaceBuildings"] = True
            click(page, "#modal-close", True)
            page.reload(wait_until="networkidle")
            assert qa.saved(page)["sharing"] == unlocked["sharing"]
            assert page.locator("#share-open").evaluate("e => !e.hidden")
            click(page, '[data-nav="village"]', True)
            click(page, '[data-village-tab="market"]', True)
            assert page.locator("[data-unlock-sharing]").count() == 0
            checks["freeSharePersistsAndHasNoRepeatPurchase"] = True

            open_share(page, True)
            checks["openingSharePanelDoesNotGenerateAnImage"] = True
            assert page.locator("#share-url").input_value() == CANONICAL_URL
            click(page, "#copy-link", True)
            page.wait_for_function("window.__shareQA.clipboard.length === 1")
            assert page.evaluate("window.__shareQA.clipboard[0]") == CANONICAL_URL
            click(page, "#native-share-link", True)
            page.wait_for_function("window.__shareQA.calls.length === 1")
            link = page.evaluate("window.__shareQA.calls[0]")
            assert link["url"] == CANONICAL_URL
            assert not link["files"]
            assert link["active"] is True and link["click"] and link["eventType"] == "click"
            checks["canonicalLinkCopiedAndHandedToStubInOriginalClick"] = True

            generate(page, True, "主世界")
            report["downloads"]["mobileWorld"] = png_download(page, True, output / "sharing-card-mobile-world.png")
            click(page, "#native-share-image", True)
            page.wait_for_function("window.__shareQA.calls.at(-1).files[0]?.signature?.length === 8")
            assert_file_call(page.evaluate("window.__shareQA.calls.at(-1)"))
            checks["mobileWorldGenerates1440x1500PngAndSharesARealFileSynchronously"] = True
            page.evaluate("window.__shareQA.abortNext=true")
            click(page, "#native-share-image", True)
            page.wait_for_function("document.querySelector('#toast').textContent.includes('已取消')")
            assert page.locator("#share-card-preview img").count() == 1
            assert page.locator("#download-card").is_enabled()
            assert page.locator("#native-share-image").is_enabled()
            checks["nativeAbortKeepsPreparedCardAndActionsUsable"] = True
            page.evaluate("window.__shareQA.failNext=true")
            click(page, "#native-share-image", True)
            page.wait_for_function("document.querySelector('#toast').textContent.includes('长按上方图片保存')")
            assert page.locator("#native-share-image").is_enabled()
            assert page.locator("#download-card").is_enabled()
            page.evaluate("window.__shareQA.failNext=true")
            click(page, "#native-share-link", True)
            page.wait_for_function("document.querySelector('#toast').textContent.includes('可以复制链接')")
            assert page.locator("#native-share-link").is_enabled()
            assert page.locator("#copy-link").is_enabled()
            checks["nativeFailuresRetainImageDownloadAndLinkCopyFallbacks"] = True
            page.evaluate("window.__shareQA.rejectClipboard=true")
            click(page, "#copy-link", True)
            check_clipboard_fallback(page)
            checks["clipboardDenialSelectsTheCanonicalLink"] = True
            qa.no_overflow(page)
            page.screenshot(path=output / "sharing-mobile-panel.png")

            click(page, "#modal-close", True)
            click(page, '[data-nav="build"]', True)
            click(page, '[data-open="owned"]', True)
            click(page, '[data-family="all"]', True)
            click(page, '[data-detail="L2"]', True)
            page.locator("#room-tools").wait_for(state="visible")
            open_share(page, True)
            generate(page, True, "直播")
            report["downloads"]["mobileRoom"] = png_download(page, True, output / "sharing-card-mobile-room.png")
            checks["indoorCardUsesRoomSceneAndLabel"] = True
            report["mobileCalls"] = page.evaluate("window.__shareQA.calls")
            unlocked_seed = qa.saved(page)
            contexts[-1].close()

            page = context_for(unlocked_seed, False, "window.__shareQA.supportFiles=false;window.__shareQA.rejectClipboard=true;")
            open_share(page, False)
            generate(page, False, "主世界")
            assert page.locator("#native-share-image").is_disabled()
            assert page.locator("#native-share-link").is_enabled()
            assert page.locator("#download-card").is_enabled()
            report["downloads"]["desktopWorld"] = png_download(page, False, output / "sharing-card-desktop-world.png")
            click(page, "#native-share-link", False)
            page.wait_for_function("window.__shareQA.calls.length === 1")
            desktop_link = page.evaluate("window.__shareQA.calls[0]")
            assert desktop_link["url"] == CANONICAL_URL
            assert desktop_link["active"] is True and desktop_link["click"] and desktop_link["eventType"] == "click"
            click(page, "#copy-link", False)
            check_clipboard_fallback(page)
            checks["desktopFileUnsupportedStillAllowsDownloadLinkShareAndClipboardFallback"] = True
            qa.no_overflow(page)
            page.screenshot(path=output / "sharing-desktop-panel.png")
            report["desktopCalls"] = page.evaluate("window.__shareQA.calls")
            assert not report["errors"], report["errors"]
            assert not report["failedRequests"], report["failedRequests"]
            checks["noOverflowConsoleErrorsOrFailedRequests"] = True
            report["passed"] = True
            (output / "sharing-release-failure.png").unlink(missing_ok=True)
        except Exception as error:
            report["passed"] = False
            report["failure"] = str(error)
            if current_page and not current_page.is_closed():
                current_page.screenshot(path=output / "sharing-release-failure.png")
            raise
        finally:
            (output / "sharing-release-observations.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
            for context in contexts:
                context.close()
            browser.close()


if __name__ == "__main__":
    main()
