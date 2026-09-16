import test from "node:test";
import assert from "node:assert/strict";
import {
  fresh,
  buy,
  price,
  restore,
  sites,
  frontier,
  VERSION,
} from "../src/game.js";
import { ITEMS } from "../src/catalog.js";
import { COLLECTION_BY_ID } from "../src/collection.js";
import { confirmStudioPurchase } from "../src/studio-purchases.js";
import { buyEarlyGuidance } from "../scripts/early-fixture.mjs";
import {
  ensureStudio,
  entityForPurchase,
  studioSites,
  canPlaceStudio,
  placeStudio,
  studioEntities,
} from "../src/studio-placement.js";

function studio() {
  const s = fresh();
  // These layout transactions take place after modern technology.
  s.research.completed={"basic-power":true,industrial:true,modern:true,railway:true,automation:true,broadcasting:true,television:true,streaming:true};
  s.money = 1e8;
  buyEarlyGuidance(s);
  for (const id of [
    "T1",
    "V1",
    "V2",
    "V3",
    "T7",
    "M4",
    "M5",
    "M6",
    "L1",
    "L2",
    "X2",
  ]) {
    if (s.counts[id]) continue;
    if (id === 'L2') assert.ok(buy(s, 'V3').ok, 'upgrade market for studio');
    while (ITEMS[id].place && !sites(s, "overworld", null, id).length)
      assert.ok(buy(s, "V1", { ...frontier(s)[0], realm: "overworld" }).ok);
    assert.ok(buy(s, id).ok, `fixture purchase ${id}`);
  }
  ensureStudio(s);
  return s;
}
const different = (a, b) =>
  a.x !== b.x || a.z !== b.z || a.rotation !== b.rotation;
function siteFor(s, key, awayFrom) {
  const site = studioSites(s, key).find(
    (p) => !awayFrom || different(p, awayFrom),
  );
  assert.ok(site, `space available for ${key}`);
  return site;
}

test("a rejected indoor purchase leaves money, counts, events and the entire live save untouched", () => {
  const s = studio(),
    before = structuredClone(s);
  const occupied = s.studio.placements.L1;
  for (const site of [
    null,
    { x: 100, z: 100 },
    { x: NaN, z: 0 },
    { x: 0.13, z: 1.11 },
    occupied,
  ]) {
    assert.equal(confirmStudioPurchase(s, "L3", site).ok, false);
    assert.deepEqual(s, before);
  }
  assert.equal(s.counts.L3 || 0, 0);
  assert.equal(s.studio.placements["L3:0"], undefined);
});

test("confirming a second camera charges once and places only the new camera", () => {
  const s = studio();
  const first = siteFor(s, entityForPurchase(s, "L3"));
  assert.ok(confirmStudioPurchase(s, "L3", first).ok);
  const existing = structuredClone(s.studio.placements),
    money = s.money;
  const second = siteFor(s, entityForPurchase(s, "L3"));
  const cost = price(s, ITEMS.L3);
  assert.equal(
    confirmStudioPurchase(s, "L3", first).ok,
    false,
    "overlap cannot spend the second camera's price",
  );
  assert.equal(s.money, money);
  assert.equal(s.counts.L3, 1);
  const result = confirmStudioPurchase(s, "L3", second);
  assert.equal(result.ok, true);
  assert.equal(result.key, "L3:1");
  assert.equal(s.counts.L3, 2);
  assert.equal(s.money, money - cost);
  for (const [key, position] of Object.entries(existing))
    assert.deepEqual(s.studio.placements[key], position, key);
  assert.deepEqual(s.studio.placements["L3:1"], {
    ...second,
    rotation: second.rotation || 0,
  });
  assert.equal(s.placements.L3, undefined);
});

test("decoration purchase and positioning commit together, and failed changes retain the equipped design", () => {
  const s = studio(),
    item = COLLECTION_BY_ID["studioShelf-0"];
  const before = structuredClone(s);
  assert.equal(
    confirmStudioPurchase(s, item.id, { x: 20, z: 20 }, { extra: true }).ok,
    false,
  );
  assert.deepEqual(s, before);
  const firstSite = siteFor(s, item.slot),
    money = s.money;
  assert.ok(confirmStudioPurchase(s, item.id, firstSite, { extra: true }).ok);
  assert.equal(s.money, money - item.cost);
  assert.equal(s.scenery.owned[item.id], true);
  assert.equal(s.scenery.equipped[item.slot], item.id);
  const equipped = structuredClone(s);
  assert.equal(
    confirmStudioPurchase(s, "studioShelf-1", { x: 20, z: 20 }, { extra: true })
      .ok,
    false,
  );
  assert.deepEqual(s, equipped);
  assert.ok(
    studioEntities(s).some((e) => e.key === `collectible:${item.id}`),
    "owned design remains physically visible in the collection cabinet",
  );
});

test("owned decoration designs can be freely re-equipped without losing either collectible or unrelated positions", () => {
  const s = studio(),
    slot = "studioShelf";
  for (const id of ["studioShelf-0", "studioShelf-1"])
    assert.ok(
      confirmStudioPurchase(s, id, siteFor(s, slot), { extra: true }).ok,
    );
  const money = s.money,
    positions = structuredClone(s.studio.placements);
  const second = siteFor(s, slot, positions[slot]);
  assert.ok(
    confirmStudioPurchase(s, "studioShelf-0", second, {
      extra: true,
      equip: true,
    }).ok,
  );
  assert.equal(s.money, money);
  assert.equal(s.scenery.equipped[slot], "studioShelf-0");
  assert.equal(s.scenery.owned["studioShelf-0"], true);
  assert.equal(s.scenery.owned["studioShelf-1"], true);
  for (const [key, position] of Object.entries(positions))
    if (key !== slot) assert.deepEqual(s.studio.placements[key], position, key);
  const before = structuredClone(s);
  assert.equal(
    confirmStudioPurchase(
      s,
      "studioShelf-1",
      { x: 40, z: 40 },
      { extra: true, equip: true },
    ).ok,
    false,
  );
  assert.deepEqual(s, before);
  assert.equal(
    confirmStudioPurchase(s, "studioSign-1", siteFor(s, "studioSign"), {
      extra: true,
      equip: true,
    }).ok,
    false,
    "unowned designs cannot be equipped for free",
  );
  assert.deepEqual(s, before);
});

test("moving and rotating furniture survives a JSON export and reload without moving other pieces", () => {
  const s = studio();
  assert.ok(confirmStudioPurchase(s, "L3", siteFor(s, "L3:0")).ok);
  assert.ok(confirmStudioPurchase(s, "L6", siteFor(s, "L6")).ok);
  const prior = structuredClone(s.studio.placements);
  const rotated = studioSites(s, "L6", { rotation: 1 }).find((p) =>
    different(p, prior.L6),
  );
  assert.ok(rotated);
  const money = s.money;
  assert.ok(placeStudio(s, "L6", rotated).ok);
  assert.equal(s.money, money);
  assert.equal(s.studio.placements.L6.rotation, 1);
  assert.deepEqual(s.studio.placements["L3:0"], prior["L3:0"]);
  const exported = JSON.parse(JSON.stringify(s));
  assert.equal(exported.version, VERSION);
  const reloaded = restore(exported);
  assert.deepEqual(reloaded.studio.placements, s.studio.placements);
  assert.equal(reloaded.money, money);
  for (const [key, position] of Object.entries(reloaded.studio.placements))
    assert.ok(canPlaceStudio(reloaded, key, position, { ignoreKey: key }), key);
  assert.deepEqual(
    restore(reloaded).studio.placements,
    reloaded.studio.placements,
  );
});

test("old saves acquire indoor positions once, while valid version 4 choices remain intact", () => {
  const s = studio();
  assert.ok(confirmStudioPurchase(s, "L3", siteFor(s, "L3:0")).ok);
  for (const version of [2, 3, VERSION]) {
    const old = structuredClone(s);
    old.version = version;
    delete old.studio;
    const migrated = restore(old);
    assert.equal(migrated.version, VERSION);
    assert.equal(migrated.money, s.money);
    assert.equal(migrated.counts.L3, 1);
    assert.ok(migrated.studio.placements["L3:0"]);
    assert.deepEqual(
      restore(migrated).studio.placements,
      migrated.studio.placements,
    );
  }
});
