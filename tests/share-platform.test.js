import test from "node:test";
import assert from "node:assert/strict";
import {
  GAME_SHARE_URL,
  shareLinkData,
  shareImageData,
  supportsShare,
  systemShare,
} from "../src/share-platform.js";

test("invitations always share the public game URL without a save or preview query", () => {
  const data = shareLinkData();
  assert.equal(data.url, GAME_SHARE_URL);
  assert.equal(new URL(data.url).hostname, "www.kw-aigc.cn");
  assert.equal(new URL(data.url).search, "");
  assert.equal(new URL(data.url).hash, "");
  assert.equal(data.files, undefined);
});
test("prepared PNG sharing passes the real file immediately to the native API", async () => {
  const file = new File(["png-test"], "world.png", { type: "image/png" });
  const data = shareImageData(file, "末地");
  let called = false;
  const nav = {
    canShare: (d) => d.files[0] === file,
    share: (d) => {
      called = true;
      assert.strictEqual(d.files[0], file);
      assert.match(d.text, /末地/);
      assert.ok(d.text.includes(GAME_SHARE_URL));
      return Promise.resolve();
    },
  };
  const result = systemShare(nav, data);
  assert.equal(
    called,
    true,
    "must not await blob generation before invoking the sheet",
  );
  assert.equal(await result, "shared");
});
test("unsupported image sharing never silently substitutes a text-only share", async () => {
  const nav = {
    canShare: () => false,
    share: () => assert.fail("unsupported payload sent"),
  };
  assert.equal(
    await systemShare(nav, shareImageData(new File(["x"], "w.png"), "主世界")),
    "unsupported",
  );
  assert.equal(supportsShare({ share() {} }, { files: [] }), false);
  assert.equal(supportsShare({}, shareLinkData()), false);
});
test("link sharing works on platforms without canShare and handles cancellation distinctly", async () => {
  assert.equal(
    await systemShare({ share: () => Promise.resolve() }, shareLinkData()),
    "shared",
  );
  assert.equal(
    await systemShare(
      { share: () => Promise.reject({ name: "AbortError" }) },
      shareLinkData(),
    ),
    "cancelled",
  );
  assert.equal(
    await systemShare(
      {
        share: () => {
          throw new Error("denied");
        },
      },
      shareLinkData(),
    ),
    "failed",
  );
  assert.equal(
    supportsShare(
      {
        share() {},
        canShare() {
          throw new Error("denied");
        },
      },
      shareLinkData(),
    ),
    false,
  );
});
