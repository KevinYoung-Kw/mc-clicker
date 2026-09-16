"""Inject recoverable share-capture errors in an isolated development browser."""

import argparse
import importlib.util
import json
from pathlib import Path
import sys

from playwright.sync_api import sync_playwright


spec = importlib.util.spec_from_file_location("share_release_qa", Path(__file__).with_name("verify-sharing-release.py"))
qa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qa)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8890/")
    args = parser.parse_args()
    seed = qa.qa.fixture()["state"]
    seed["sharing"] = {"unlocked": True, "unlockedAt": 0}
    report = {"url": args.url, "developmentFaultInjection": True, "checks": {}, "errors": []}
    output = qa.ROOT / "docs/qa"
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--use-angle=metal"] if sys.platform == "darwin" else [])
        context = browser.new_context(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True, device_scale_factor=1)
        context.add_init_script(qa.STUB + f"localStorage.setItem({json.dumps(qa.SAVE_KEY)},{json.dumps(json.dumps(seed))});")
        page = context.new_page()
        page.set_default_timeout(15000)
        page.on("pageerror", lambda error: report["errors"].append(str(error)))
        try:
            page.goto(args.url, wait_until="networkidle")
            assert page.evaluate("!!window.mcDebug?.world"), "fault injection requires a development build"
            qa.open_share(page, True)
            page.evaluate("""() => {
              const w=window.mcDebug.world;
              window.__captureQA={world:w,original:w.captureCurrentScene};
              w.captureCurrentScene=()=>{throw new Error('QA capture failed');};
            }""")
            qa.click(page, "#generate-card", True)
            page.wait_for_function("document.querySelector('#image-share-note').textContent.includes('暂时无法生成')")
            assert page.locator("#generate-card").is_enabled()
            assert not page.locator("#download-card").is_visible()
            assert page.locator("#share-card-preview canvas").count() == 0
            qa.click(page, "#copy-link", True)
            assert page.evaluate("window.__shareQA.clipboard.at(-1)") == qa.CANONICAL_URL
            qa.click(page, "#native-share-link", True)
            page.wait_for_function("window.__shareQA.calls.length === 1")
            call = page.evaluate("window.__shareQA.calls[0]")
            assert call["url"] == qa.CANONICAL_URL and call["active"] and call["eventType"] == "click"
            report["checks"]["captureFailureKeepsGenerateRetryCopyAndNativeLinkAvailable"] = True
            page.evaluate("() => { window.__captureQA.world.captureCurrentScene=window.__captureQA.original; }")
            qa.generate(page, True, "主世界")
            report["checks"]["captureWorksAgainAfterTransientFailure"] = True
            qa.click(page, "#modal-close", True)
            qa.open_share(page, True)
            page.evaluate("""() => {
              const originalDecode=HTMLImageElement.prototype.decode;
              const originalBlob=HTMLCanvasElement.prototype.toBlob;
              window.__asyncShareQA={originalDecode,originalBlob,pending:[],blobDone:0};
              HTMLImageElement.prototype.decode=function() {
                const result=originalDecode.call(this);
                return this.src.startsWith('data:image/')
                  ? result.then(()=>new Promise(resolve=>window.__asyncShareQA.pending.push(resolve)))
                  : result;
              };
              HTMLCanvasElement.prototype.toBlob=function(callback,...args) {
                const isCard=this.width===1440&&this.height===1500;
                return originalBlob.call(this,blob=>{
                  callback(blob);
                  if(isCard)window.__asyncShareQA.blobDone++;
                },...args);
              };
            }""")
            qa.click(page, "#generate-card", True)
            page.wait_for_function("window.__asyncShareQA.pending.length === 1")
            assert page.locator("#generate-card").is_disabled()
            qa.click(page, "#modal-close", True)
            qa.open_share(page, True)
            new_panel = page.locator("#share-panel").element_handle()
            page.evaluate("""() => {
              HTMLImageElement.prototype.decode=window.__asyncShareQA.originalDecode;
              window.__asyncShareQA.pending.splice(0).forEach(resolve=>resolve());
            }""")
            page.wait_for_function("window.__asyncShareQA.blobDone === 1")
            assert new_panel.evaluate("el=>el===document.querySelector('#share-panel')")
            assert page.locator("#share-card-preview canvas").count() == 0
            assert page.locator("#generate-card").is_enabled()
            assert page.locator("#generate-card").inner_text().strip().endswith("生成纪念卡")
            assert not page.locator("#download-card").is_visible()
            assert not page.locator("#native-share-image").is_visible()
            assert page.locator("#share-status").inner_text() == ""
            report["checks"]["lateImageCompletionCannotReplaceOrChangeTheNewSharePanel"] = True
            page.evaluate("() => { HTMLCanvasElement.prototype.toBlob=window.__asyncShareQA.originalBlob; }")
            qa.generate(page, True, "主世界")
            report["checks"]["newPanelCanGenerateAfterTheOldRequestFinishes"] = True
            qa.qa.no_overflow(page)
            page.screenshot(path=output / "sharing-failures-recovered-phone.png")
            assert not report["errors"], report["errors"]
            report["passed"] = True
            (output / "sharing-failures-failed.png").unlink(missing_ok=True)
        except Exception as error:
            report["passed"] = False
            report["failure"] = str(error)
            page.screenshot(path=output / "sharing-failures-failed.png")
            raise
        finally:
            page.evaluate("""() => {
              if(window.__captureQA)window.__captureQA.world.captureCurrentScene=window.__captureQA.original;
              if(window.__asyncShareQA){
                HTMLImageElement.prototype.decode=window.__asyncShareQA.originalDecode;
                HTMLCanvasElement.prototype.toBlob=window.__asyncShareQA.originalBlob;
                window.__asyncShareQA.pending.splice(0).forEach(resolve=>resolve());
              }
            }""")
            (output / "sharing-failures-observations.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
            context.close()
            browser.close()


if __name__ == "__main__":
    main()
