import test from "node:test";
import assert from "node:assert/strict";
import { CATALOG, ITEMS } from "../src/catalog.js";
import { fresh, buy, price } from "../src/game.js";
import {
  inConstruction,
  ownerOf,
  spaceOf,
  placementFor,
  relatedFacilities,
  MANAGEMENT_PURCHASES,
} from "../src/facility-shops.js";
import { PURCHASE_SPEC } from "../src/purchase-spec.js";

test("every new outdoor facility is independently discoverable and requests placement", () => {
  const s = fresh();
  for (const item of CATALOG.filter((i) => i.place)) {
    assert.equal(ownerOf(item.id), null, item.id);
    assert.equal(inConstruction(item), true, item.id);
    assert.equal(spaceOf(item.id), "outdoor", item.id);
    assert.equal(placementFor(s, item.id), "outdoor", item.id);
    s.counts[item.id] = 1;
    assert.equal(placementFor(s, item.id), null, `${item.id} upgrade`);
  }
  assert.equal(placementFor(s, "V1"), "outdoor");
  s.counts.V1 = 3;
  assert.equal(
    placementFor(s, "V1"),
    "outdoor",
    "each land purchase needs a location",
  );
});

test("unlock dependencies never make the well, pen or redstone devices farm or crank contents", () => {
  for (const id of [
    "V5",
    "V6",
    "V7",
    "M10",
    "M11",
    "M12",
    "M13",
    "M14",
    "M19",
    "M20",
  ])
    assert.equal(ownerOf(id), null, id);
  assert.deepEqual(relatedFacilities("V4"), ["V5"]);
  assert.equal(relatedFacilities("V4").includes("V6"), false);
  assert.equal(relatedFacilities("V4").includes("V7"), false);
  for (const id of ["V8", "V9", "V10"]) assert.equal(ownerOf(id), "V7");
  for (const id of ["V12", "V13"]) assert.equal(ownerOf(id), "V11");
  for (const id of ["T9", "T10", "T11"]) assert.equal(ownerOf(id), "T8");
});

test("livestream equipment requests its own indoor placement, never nearby outdoor land", () => {
  const s = fresh();
  for (let index = 3; index <= 14; index++) {
    const id = `L${index}`;
    assert.equal(ownerOf(id), "L2", id);
    assert.equal(ITEMS[id].place, false, id);
    assert.equal(inConstruction(ITEMS[id]), false, id);
    assert.equal(placementFor(s, id), "studio", id);
    s.counts[id] = 1;
    assert.equal(placementFor(s, id), null, `${id} upgrade`);
  }
});

test("non-spatial purchases do not invent building footprints or mutate state during routing", () => {
  const s = fresh(),
    before = structuredClone(s);
  for (const id of [
    "T1",
    "T9",
    "V2",
    "V8",
    "V9",
    "V10",
    "V12",
    "V13",
    "V15",
    "X3",
    "X4",
  ])
    assert.equal(placementFor(s, id), null, id);
  assert.equal(
    placementFor(s, "X2"),
    "outdoor",
    "the decor stall is a real building",
  );
  assert.equal(placementFor(s, "X7"), "outdoor", "the garden is a real plot");
  assert.deepEqual(s, before);
});

test("village and industrial management expose every independent facility in the right branch", () => {
  const village = new Set(Object.values(MANAGEMENT_PURCHASES.village).flat()),
    industry = new Set(Object.values(MANAGEMENT_PURCHASES.industry).flat());
  for (const item of CATALOG.filter((i) => i.place && i.family === "V"))
    assert.ok(village.has(item.id), item.id);
  for (const item of CATALOG.filter((i) => i.place && i.family === "M"))
    assert.ok(industry.has(item.id), item.id);
  assert.ok(MANAGEMENT_PURCHASES.village.construction.includes("V6"));
  assert.ok(!MANAGEMENT_PURCHASES.village.production.includes("V6"));
  assert.ok(![...village, ...industry].some((id) => ownerOf(id) === "L2"));
});

test("studio exterior grows through three fixed-price tiers without taking another outdoor plot", () => {
  const s = fresh();
  s.research.completed={industrial:true,modern:true,railway:true,automation:true,broadcasting:true,television:true,streaming:true};
  s.counts = { T1: 1, V1: 1, V2: 1, V3: 2, L1: 1, M5: 1, M6: 1 };
  s.chunks.overworld.push({ x: 1, z: 0 }, { x: 0, z: 1 });
  s.money = 3e6;
  assert.equal(price(s, ITEMS.L2), 24000);
  assert.ok(buy(s, "L2").ok);
  const entrance = structuredClone(s.placements.L2);
  assert.equal(price(s, ITEMS.L2), 192000);
  assert.ok(buy(s, "L2").ok);
  assert.deepEqual(s.placements.L2, entrance);
  assert.equal(price(s, ITEMS.L2), 1536000);
  assert.ok(buy(s, "L2").ok);
  assert.deepEqual(s.placements.L2, entrance);
  assert.equal(s.counts.L2, 3);
  const money = s.money;
  assert.equal(buy(s, "L2").ok, false);
  assert.equal(s.money, money);
});

test("formal purchase specifications distinguish outdoor, indoor and non-spatial confirmation", () => {
  const spec = Object.fromEntries(PURCHASE_SPEC.map((i) => [i.id, i]));
  assert.equal(spec.V6.owner, null);
  assert.equal(spec.V6.space, "outdoor");
  assert.match(spec.V6.purchaseConfirmation, /选址/);
  assert.equal(spec.L3.owner, "L2");
  assert.equal(spec.L3.space, "studio");
  assert.match(spec.L3.purchaseConfirmation, /独立网格/);
  assert.equal(spec.V8.space, "resident");
  assert.equal(spec.V8.footprint, null);
});
