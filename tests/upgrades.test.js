import test from "node:test";
import assert from "node:assert/strict";
import { fresh, rates, advance, restore } from "../src/game.js";
import { powerSnapshot, gridCapacity } from "../src/power.js";
import { ITEMS } from "../src/catalog.js";
import {
  UPGRADE_CATALOG,
  UPGRADE_BY_ID,
  buyUpgrade,
  upgradeStatus,
  upgradePrice,
  upgradeLevel,
  upgradeMultiplier,
  upgradeWork,
  restoreUpgrades,
} from "../src/upgrades.js";
test("52 dedicated nodes have a real owner, finite fixed prices, effects, energy and actual model instructions", () => {
  assert.equal(UPGRADE_CATALOG.length, 52);
  const seen = new Set(),
    stack = new Set();
  function visit(id) {
    if (!UPGRADE_BY_ID[id]) {
      assert.ok(ITEMS[id], id);
      return;
    }
    if (seen.has(id)) return;
    assert.ok(!stack.has(id), id);
    stack.add(id);
    for (const dep of UPGRADE_BY_ID[id].dependencies) visit(dep);
    stack.delete(id);
    seen.add(id);
  }
  for (const row of UPGRADE_CATALOG) {
    assert.ok(ITEMS[row.owner]);
    assert.ok(row.dependencies.includes(row.owner));
    assert.ok(row.basePrice > 0 && Number.isFinite(row.basePrice));
    assert.ok(Object.keys(row.effects).length);
    assert.ok(row.model.length > 5);
    assert.ok(row.energy);
    visit(row.id);
  }
});
test("diamond head follows steel head and diamond pick without adding a reverse dependency", () => {
  const s = fresh();
  s.money = 1e12;
  s.counts = { M9: 1, T3: 1 };
  assert.equal(buyUpgrade(s, "drill-diamond").ok, false);
  assert.ok(buyUpgrade(s, "drill-steel").ok);
  assert.deepEqual(upgradeStatus(s, "drill-diamond").missing.map(x => x.id), ["M9", "T5"]);
  s.counts.M9 = 3;
  s.counts.T5 = 1;
  assert.ok(buyUpgrade(s, "drill-diamond").ok);
});
test("upgrade price depends only on its level; success charges once and never expands land", () => {
  const s = fresh();
  s.money = 1e12;
  s.counts = { M7: 1 };
  const before = structuredClone(s.chunks),
    cost = upgradePrice(s, "wind-blades");
  s.rate = 1e25;
  assert.equal(upgradePrice(s, "wind-blades"), cost);
  const money = s.money;
  assert.ok(buyUpgrade(s, "wind-blades").ok);
  assert.equal(s.money, money - cost);
  assert.deepEqual(s.chunks, before);
  assert.equal(upgradePrice(s, "wind-blades"), Math.ceil(cost * 2.4));
  assert.equal(buyUpgrade(s, "wind-blades").ok, false);
  s.research.completed={industrial:true,modern:true};s.counts.M7 = 2;
  assert.ok(buyUpgrade(s, "wind-blades").ok);
  s.counts.M7 = 3;
  assert.ok(buyUpgrade(s, "wind-blades").ok);
  const final = s.money;
  assert.equal(buyUpgrade(s, "wind-blades").ok, false);
  assert.equal(s.money, final);
  assert.equal(upgradeStatus(s, "wind-blades").kind, "complete");
});
test("dedicated effects compound on their owner; cooling changes work power, not generic money", () => {
  const s = fresh();
  s.money = 1e10;
  s.counts = { M9: 2, M7: 1, T3: 1 };
  buyUpgrade(s, "drill-steel");
  buyUpgrade(s, "drill-cooling");
  assert.equal(upgradeMultiplier(s, "M9", "raw"), 1.25 * 1.15);
  assert.equal(upgradeWork(s, "M9"), 1.1 * 0.78);
  assert.equal(upgradeMultiplier(s, "V4", "raw"), 1);
  assert.equal(s.total, 0);
});
test("restore retains paid levels, clamps malformed fields and does not grant upgrades to missing owners", () => {
  const s = fresh();
  s.counts.M7 = 1;
  restoreUpgrades(s, {
    upgrades: {
      levels: { "wind-blades": 100, "wind-gears": 1, "drill-steel": 1, bad: 1 },
    },
  });
  assert.equal(upgradeLevel(s, "wind-blades"), 3);
  assert.equal(upgradeLevel(s, "wind-gears"), 1);
  assert.equal(upgradeLevel(s, "drill-steel"), 0);
  assert.equal(upgradeLevel(s, "bad"), 0);
});
test("actual network applies generation, power, output and raw-only buffering; save keeps dedicated levels", () => {
  const s = fresh();
  s.money = 1e12;
  s.counts = {
    M5: 1,
    M6: 1,
    M7: 1,
    M9: 2,
    M2: 1,
    T3: 1,
    T7: 1,
    M4: 1,
    V3: 1,
    M16: 1,
    M8: 1,
  };
  const before = rates(s);
  assert.ok(buyUpgrade(s, "wind-blades").ok);
  assert.ok(rates(s).supply > before.supply);
  assert.ok(buyUpgrade(s, "torch-core").ok);
  assert.equal(gridCapacity(s), 240);
  const drillBefore = powerSnapshot(s).loads.find((l) => l.id === "M9").rated;
  buyUpgrade(s, "drill-steel");
  assert.ok(rates(s).regions.overworld.raw > before.regions.overworld.raw);
  assert.equal(
    powerSnapshot(s).loads.find((l) => l.id === "M9").rated,
    drillBefore * 1.1,
  );
  const capacities = rates(s).regions.overworld;
  buyUpgrade(s, "drill-buffer");
  const after = rates(s).regions.overworld;
  assert.equal(after.rawCapacity, capacities.rawCapacity * 2);
  assert.equal(after.capacity, capacities.capacity);
  const load = powerSnapshot(s).loads.find((l) => l.id === "M9").rated;
  buyUpgrade(s, "drill-cooling");
  assert.ok(powerSnapshot(s).loads.find((l) => l.id === "M9").rated < load);
  const saved = restore(s);
  assert.deepEqual(saved.upgrades.levels, s.upgrades.levels);
  advance(saved, 5);
  assert.ok(saved.productionIncome > 0);
});
