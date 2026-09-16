import test from "node:test";
import assert from "node:assert/strict";
import { CATALOG, ITEMS } from "../src/catalog.js";
import {
  fresh,
  restore,
  buy,
  mine,
  advance,
  rates,
  requirements,
} from "../src/game.js";
import {
  GUIDANCE_ITEMS,
  freshGuidance,
  restoreGuidance,
  guidanceOwned,
  guidanceRequirements,
  buyGuidance,
} from "../src/guidance.js";

test("the early path reaches land, mailbox, workbench and passive income without paid guidance", () => {
  assert.equal(CATALOG.length, 104);
  assert.deepEqual(
    GUIDANCE_ITEMS.map(({ id, cost }) => [id, cost]),
    [
      ["info", 10],
      ["counter", 15],
      ["nameplate", 30],
      ["goals", 20],
    ],
  );
  const s = fresh();
  assert.deepEqual(s.guidance, freshGuidance());
  assert.deepEqual(guidanceRequirements(s, "goals"), []);
  assert.deepEqual(guidanceRequirements(s, "info"), []);
  // A genuine start stays playable: manual mining pays each required step.
  for (let i = 0; i < 250; i++) mine(s, () => 1);
  assert.ok(buy(s, "T1").ok);
  assert.deepEqual(requirements(s, ITEMS.V1), []);
  assert.ok(buy(s, "V1").ok);
  assert.deepEqual(requirements(s, ITEMS.V18), []);
  assert.deepEqual(requirements(s, ITEMS.V2), ["邮箱"]);
  assert.deepEqual(requirements(s, ITEMS.T7), ["邮箱"]);
  assert.ok(buy(s, "V18").ok);
  assert.ok(buy(s, "V2").ok);
  assert.ok(buy(s, "T7").ok);
  const before = s.money;
  advance(s, 5);
  assert.ok(s.money > before);
  assert.equal(s.guidance.goals, false);
  assert.equal(s.guidance.info, false);
});

test("unknown abilities, missing prerequisites, insufficient funds and duplicates are atomic", () => {
  const s = fresh();
  s.money = 100;
  for (const id of ["unknown", "counter"]) {
    const before = structuredClone(s);
    assert.equal(buyGuidance(s, id).ok, false);
    assert.deepEqual(s, before);
  }
  s.counts.T1 = 1;
  for (const money of [5, -1, Infinity, NaN]) {
    s.money = money;
    const before = structuredClone(s);
    assert.equal(buyGuidance(s, "goals").ok, false);
    assert.deepEqual(s, before);
  }
  s.money = 20;
  assert.deepEqual(buyGuidance(s, "goals"), { ok: true, cost: 20 });
  assert.equal(s.money, 0);
  const before = structuredClone(s);
  assert.equal(buyGuidance(s, "goals").ok, false);
  assert.deepEqual(s, before);
  assert.equal(guidanceOwned(s, "goals"), true);
  assert.equal(guidanceOwned(s, "unknown"), false);
});

test("buying abilities only spends 30 emeralds and does not modify production, land or event history", () => {
  const s = fresh();
  Object.assign(s.counts, { T1: 1, V1: 1, V2: 1, V3: 1 });
  s.money = 100;
  s.guidance.collapsed = true;
  s.guidance.notices = false;
  const before = rates(s);
  const baseline = structuredClone(s);
  assert.ok(buyGuidance(s, "goals").ok);
  assert.ok(buyGuidance(s, "info").ok);
  assert.deepEqual(s, {
    ...baseline,
    money: 70,
    guidance: { ...baseline.guidance, goals: true, info: true },
  });
  assert.deepEqual(rates(s), before);
  advance(s, 10);
  advance(baseline, 10);
  assert.equal(s.total, baseline.total);
  assert.equal(s.productionIncome, baseline.productionIncome);
  assert.equal(s.liveIncome, baseline.liveIncome);
  assert.ok(Math.abs(baseline.money - s.money - 30) < 1e-8);
});

test("information is independent of task tracking, and every catalog node ignores both flags", () => {
  const s = fresh(); s.money = 1000; s.counts.V1 = 1;
  assert.ok(buyGuidance(s, "info").ok);
  assert.equal(s.guidance.goals, false);
  for (const item of CATALOG) {
    s.guidance.goals = false; s.guidance.info = false;
    const before = requirements(s, item);
    s.guidance.goals = true; s.guidance.info = true;
    assert.deepEqual(requirements(s, item), before, item.id);
  }
});

test("legacy v2/v3/v4 saves migrate only earned guidance while explicit choices remain intact", () => {
  for (const version of [2, 3, 4]) {
    for (const [counts, goals, info] of [
      [{}, false, false],
      [{ T1: 1 }, false, false],
      [{ V1: 1 }, true, false],
      [{ V1: 1, V2: 1 }, true, true],
      [{ T7: 1 }, false, true],
    ]) {
      const old = fresh();
      old.version = version;
      old.counts = counts;
      delete old.guidance;
      const restored = restore(old);
      assert.equal(restored.guidance.goals, goals);
      assert.equal(restored.guidance.info, info);
      assert.equal(restored.guidance.collapsed, false);
      assert.equal(restored.guidance.notices, true);
    }
  }
  const explicit = fresh();
  Object.assign(explicit.counts, { V1: 1, V2: 1, T7: 1 });
  explicit.guidance = {
    version: 1,
    goals: false,
    info: true,
    collapsed: true,
    notices: false,
  };
  const reloaded = restore(JSON.parse(JSON.stringify(explicit)));
  const migrated={...explicit.guidance,version:2,counter:true,nameplate:true};
  assert.deepEqual(reloaded.guidance, migrated);
  assert.deepEqual(restore(reloaded).guidance, migrated);
  assert.deepEqual(
    restoreGuidance({ goals: "true", info: 1, collapsed: "true" }, explicit),
    {...freshGuidance(),counter:true,nameplate:true},
  );
  const a = freshGuidance(),
    b = freshGuidance();
  a.goals = true;
  assert.equal(b.goals, false);
});
