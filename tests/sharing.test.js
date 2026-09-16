import test from "node:test";
import assert from "node:assert/strict";
import { CATALOG } from "../src/catalog.js";
import { fresh, restore, advance, rates, VERSION } from "../src/game.js";
import { icon } from "../src/icons.js";
import {
  SHARE_PRICE,
  freshSharing,
  restoreSharing,
  shareUnlocked,
  shareAvailable,
  shareRequirements,
  unlockSharing,
} from "../src/sharing.js";

test("sharing is available for a new empty world without money or prerequisites", () => {
  const s = fresh();
  assert.equal(SHARE_PRICE, 0);
  assert.equal(CATALOG.length, 104);
  assert.equal(s.money, 0);
  assert.equal(shareUnlocked(s), true);
  assert.equal(shareAvailable(s), true);
  assert.deepEqual(shareRequirements(s), []);
});
test("legacy unlock calls are idempotent and never debit or grant money", () => {
  const s = fresh();
  s.money = 49;
  const before = structuredClone(s);
  assert.deepEqual(unlockSharing(s), { ok: true, cost: 0 });
  assert.deepEqual(unlockSharing(s), { ok: true, cost: 0 });
  assert.deepEqual(s, before);
});
test("old locked or missing sharing records become free without altering the wallet", () => {
  for (const version of [2, 3, 4, VERSION]) {
    const old = fresh();
    old.version = version;
    old.money = 1234;
    old.sharing = { unlocked: false };
    const loaded = restore(old);
    assert.equal(loaded.money, 1234);
    assert.equal(shareUnlocked(loaded), true);
    assert.deepEqual(loaded.sharing, freshSharing());
    delete old.sharing;
    assert.deepEqual(restore(old).sharing, freshSharing());
  }
});
test("previous paid unlock receipts survive repeated export and restore", () => {
  const s = fresh();
  s.sharing = { unlocked: true, unlockedAt: 321.75 };
  s.money = 2000;
  const loaded = restore(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(loaded.sharing, s.sharing);
  assert.equal(loaded.money, 2000);
  assert.deepEqual(restore(loaded).sharing, s.sharing);
  for (const value of [
    undefined,
    null,
    { unlocked: false },
    { unlocked: true, unlockedAt: Infinity },
  ])
    assert.deepEqual(restoreSharing(value), freshSharing());
});
test("free sharing never alters production, land, buffers or simulation income", () => {
  const original = fresh();
  Object.assign(original.counts, { V1: 1, V2: 1, V3: 1 });
  original.money = 4000;
  const unlocked = structuredClone(original);
  assert.ok(unlockSharing(unlocked).ok);
  assert.deepEqual(rates(unlocked), rates(original));
  advance(original, 10);
  advance(unlocked, 10);
  assert.equal(unlocked.money, original.money);
  assert.equal(unlocked.total, original.total);
  assert.deepEqual(unlocked.counts, original.counts);
  assert.deepEqual(unlocked.placements, original.placements);
  assert.deepEqual(unlocked.buffers, original.buffers);
});

test("decoration bag, atlas book, camera and share have distinct sharp-edged glyphs", () => {
  const glyphs = ["bag", "book", "camera", "share"].map((name) => icon(name));
  assert.equal(new Set(glyphs).size, 4);
  for (const glyph of glyphs) {
    assert.notEqual(glyph, icon("album"));
    assert.notEqual(glyph, icon("cube"));
    assert.match(glyph, /stroke-linejoin="miter"/);
    assert.match(glyph, /stroke-linecap="square"/);
    assert.doesNotMatch(glyph, /<(circle|ellipse)|rx="[1-9]/);
  }
});
