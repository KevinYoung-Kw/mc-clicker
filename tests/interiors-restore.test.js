import test from "node:test";
import assert from "node:assert/strict";
import { completeFixture } from "../scripts/fixtures.mjs";
import { restore, VERSION } from "../src/game.js";
import { canPlace } from "../src/layout.js";
import {
  ensureStudio,
  studioSites,
  placeStudio,
  canPlaceStudio,
} from "../src/studio-placement.js";
import { confirmStudioPurchase } from "../src/studio-purchases.js";
import { resetExtra } from "../src/collection.js";

// A late-game world catches restore ordering problems that an empty studio
// cannot: temporary outdoor objects must not displace later catalog entries.
const complete = completeFixture();

function assertSameWorld(before, after) {
  assert.deepEqual(after.placements, before.placements, "outdoor positions");
  assert.deepEqual(after.chunks, before.chunks, "owned land");
  assert.deepEqual(
    after.studio.placements,
    before.studio.placements,
    "indoor positions",
  );
  assert.deepEqual(
    after.collection,
    before.collection,
    "owned and equipped designs",
  );
  assert.deepEqual(after.counts, before.counts, "purchased levels");
  assert.equal(after.money, before.money, "wallet");
  assert.equal(after.placements.L1, undefined, "record player stays inside");
  for (const [id, position] of Object.entries(after.placements))
    assert.ok(canPlace(after, id, position, id), id);
  for (const [key, position] of Object.entries(after.studio.placements))
    assert.ok(canPlaceStudio(after, key, position, { ignoreKey: key }), key);
}

test("a complete saved world reloads without a temporary outdoor record player moving later buildings", () => {
  const s = structuredClone(complete);
  assert.ok(s.placements.X2 && s.placements.X7 && s.placements.Z2);
  ensureStudio(s);
  for (let reload = 0; reload < 3; reload++) {
    const next = restore(JSON.parse(JSON.stringify(s)), 0);
    assertSameWorld(s, next);
    Object.assign(s, next);
  }
});

test("free room edits, multiple collected designs and an unequipped design survive alongside all outdoor facilities", () => {
  const s = structuredClone(complete);
  s.money = 1e8;
  ensureStudio(s);
  const giftSite = studioSites(s, "L6", { rotation: 1 }).find(
    (p) => p.x !== s.studio.placements.L6.x || p.z !== s.studio.placements.L6.z,
  );
  assert.ok(giftSite);
  assert.ok(placeStudio(s, "L6", giftSite).ok);
  for (const id of ["studioShelf-0", "studioShelf-1", "flag-1"]) {
    const slot = id.startsWith("flag") ? "flag" : "studioShelf";
    const site = studioSites(s, slot)[0];
    assert.ok(site, id);
    assert.ok(confirmStudioPurchase(s, id, site, { extra: true }).ok, id);
  }
  assert.ok(resetExtra(s, "flag"));
  const next = restore(JSON.parse(JSON.stringify(s)), 0);
  assertSameWorld(s, next);
  assert.equal(next.scenery.owned["studioShelf-0"], true);
  assert.equal(next.scenery.owned["studioShelf-1"], true);
  assert.equal(next.scenery.owned["flag-1"], true);
  assert.equal(next.scenery.equipped.flag, undefined);
  assert.equal(next.studio.placements.L6.rotation, 1);
  assertSameWorld(next, restore(next, 0));
});

test("legacy exterior record-player data is migrated without reserving its discarded footprint", () => {
  const raw = structuredClone(complete);
  raw.version = 3;
  delete raw.studio;
  // This stale outdoor copy shares a valid garden's position. Since L2 is
  // already owned it must be ignored before reconstructing any outdoor item.
  raw.placements.L1 = { ...raw.placements.X7 };
  const expectedOutdoor = { ...raw.placements };
  delete expectedOutdoor.L1;
  const migrated = restore(raw, 0);
  assert.equal(migrated.version, VERSION);
  assert.deepEqual(migrated.placements, expectedOutdoor);
  assert.deepEqual(migrated.chunks, raw.chunks);
  assert.deepEqual(migrated.counts, raw.counts);
  assert.equal(migrated.money, raw.money);
  assert.ok(migrated.studio.placements.L1);
  assertSameWorld(migrated, restore(migrated, 0));
});
