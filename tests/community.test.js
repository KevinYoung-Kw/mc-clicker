import { magmaProcess } from "../src/dimensional.js";
import test from "node:test";
import assert from "node:assert/strict";
import {
  fresh,
  restore,
  advance,
  action,
  rates,
  collectGift,
} from "../src/game.js";
import {
  ensureCommunity,
  assignJob,
  renameCompanion,
  trainResident,
  residentBase,
  skillLevel,
  appearance,
  upgradeGolem,
} from "../src/residents.js";
import {
  ensureGrid,
  powerSnapshot,
  upgradeCapacitor,
  configureAutomation,
  toggleDevice,
} from "../src/power.js";
import {
  taskState,
  enqueueBatch,
  companionNavigation,
  COMPANION_RADIUS,
} from "../src/operations.js";
import { residentFixture } from "../scripts/resident-fixture.mjs";
import { selectCrop } from "../src/collection.js";
const state = (counts = {}) => {
  const s = fresh(0);
  Object.assign(s.counts, counts);
  ensureCommunity(s);
  return s;
};
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test("every bought villager has a stable name, identity and distinct appearance", () => {
  const s = state({ V2: 60 });
  assert.equal(s.community.residents.length, 60);
  assert.equal(new Set(s.community.residents.map((r) => r.id)).size, 60);
  assert.equal(
    new Set(s.community.residents.map((r) => JSON.stringify(r.look))).size,
    60,
  );
  renameCompanion(s, "resident-1", "阿木的新名字");
  const copy = restore(s);
  assert.equal(copy.community.residents[0].name, "阿木的新名字");
  assert.deepEqual(
    copy.community.residents.map((r) => r.look),
    s.community.residents.map((r) => r.look),
  );
  const duplicated = structuredClone(s);
  duplicated.community.residents.push(duplicated.community.residents[0]);
  assert.equal(restore(duplicated).community.residents.length, 60);
});
test("employment always keeps full B, even while waiting; the first villager can work", () => {
  const s = state({ V2: 1, V4: 1 });
  const r = s.community.residents[0],
    b = residentBase(s, r);
  assert.ok(assignJob(s, r.id, "farmer").ok);
  advance(s, 5);
  close(r.baseEarned, b * 5);
  assert.ok(assignJob(s, r.id, "idle").ok);
  advance(s, 5);
  close(r.baseEarned, b * 10);
  assert.equal(s.money, b * 10);
  assert.equal(s.counts.M12, undefined);
});
test("jobs reserve finite slots and cannot duplicate the same worker", () => {
  const s = state({ V2: 3, V4: 1 });
  assert.ok(assignJob(s, "resident-1", "farmer").ok);
  assert.equal(assignJob(s, "resident-2", "farmer").ok, false);
  s.counts.V4 = 3; s.life.sites.push({id:"civic:1",type:"V4",x:5,z:0,rotation:0});
  assert.ok(assignJob(s, "resident-2", "farmer").ok);
  assert.ok(assignJob(s, "resident-1", "idle").ok);
  assert.equal(
    s.community.residents.filter((r) => r.job === "farmer").length,
    1,
  );
});
test("personal books charge exactly one person and retain learned professions after changing job", () => {
  const s = state({ V2: 2, V4: 1, V11: 1, L1: 1 });
  s.money = 10000;
  const r = s.community.residents[0];
  assert.ok(trainResident(s, r.id, "farming").ok);
  assert.equal(s.money, 9800);
  assert.equal(skillLevel(r, "farming"), 2);
  assert.equal(skillLevel(s.community.residents[1], "farming"), 1);
  assignJob(s, r.id, "musician");
  assert.equal(skillLevel(r, "music"), 1);
  assert.equal(skillLevel(r, "farming"), 2);
  trainResident(s, r.id, "farming");
  assert.equal(trainResident(s, r.id, "farming").ok, false);
  const copy = restore(s);
  assert.equal(skillLevel(copy.community.residents[0], "farming"), 3);
});
test("farmer outcomes settle through goods once while B continues in full", () => {
  const s = state({ V2: 1, V4: 1, V3: 1 });
  const r = s.community.residents[0];
  assignJob(s, r.id, "farmer");
  advance(s, 160);
  assert.ok(r.jobsDone >= 2);
  assert.ok(r.jobEarned > 0);
  assert.ok(s.community.shipped > 0);
  close(s.money, s.community.baseIncome + s.community.jobIncome);
  assert.ok(r.jobEarned <= s.community.jobIncome);
  close(r.baseEarned, residentBase(s, r) * 160);
});
test("two manual requests cannot finish a single harvest twice and switching crops clears pending tending", () => {
  const s = state({ V2: 1, V4: 1 });
  s.harvest.farm = 1;
  assert.ok(action(s, "farm").ok);
  assert.equal(action(s, "farm").ok, false);
  advance(s, 1);
  assert.equal(s.harvestCount, 1);
  assert.equal(action(s, "farm").ok, false);
  s.crops.owned.pumpkin = true;
  taskState(s, "farm").bonus = 0.4;
  taskState(s, "farm").work = 2;
  selectCrop(s, "pumpkin");
  assert.equal(s.harvest.farm, 0);
  assert.equal(taskState(s, "farm").bonus, 0);
  assert.equal(taskState(s, "farm").work, 0);
});
test("music and note blocks have independent visible cooldown state", () => {
  const s = state({ L1: 1, M20: 1 });
  assert.ok(action(s, "music").ok);
  advance(s, 1);
  assert.ok(taskState(s, "music").cooldown > 0);
  assert.ok(action(s, "note").ok);
  advance(s, 1);
  assert.ok(taskState(s, "note").cooldown > 0);
  assert.ok(s.rhythm > 0);
  assert.equal(action(s, "music").ok, false);
});
test("idle stored electricity does not decay; crank input is time based and storage upgrades grant no charge", () => {
  const s = state({ M5: 1 });
  s.energy = 12;
  advance(s, 1);
  close(s.energy, 12);
  for (let i = 0; i < 30; i++) action(s, "crank");
  advance(s, 0.25);
  close(s.energy, 18);
  s.money = 10000;
  assert.ok(upgradeCapacitor(s).ok);
  close(s.energy, 18);
  assert.equal(powerSnapshot(s).capacity, 480);
});
test("generation equals consumption plus stored change and spill, including a full battery", () => {
  const s = state({ M5: 1, M7: 3, M9: 2, M1: 1 });
  s.energy = 119;
  for (const dt of [0.01, 0.2, 1]) {
    const p = powerSnapshot(s, dt, true);
    close(p.old + p.generated, p.consumed + p.stored + p.spill);
    assert.ok(p.stored <= p.capacity);
    assert.ok(p.consumed <= p.old + p.generated + 1e-8);
  }
});
test("tiny positive power cannot instantly harvest; zero power performs no automatic work", () => {
  const s = state({ V4: 1, M1: 1, M5: 1, M6: 1, M9: 20, M10: 1, M14: 1 });
  configureAutomation(s, "farm", 1);
  s.harvest.farm = 1;
  advance(s, 0.01);
  assert.equal(s.harvestCount, 0);
  assert.ok(taskState(s, "farm").work < 0.02);
  delete s.counts.M6;
  s.energy = 0;
  const work = taskState(s, "farm").work;
  advance(s, 1);
  close(taskState(s, "farm").work, work);
});
test("automation channels are finite and robot work does not increment player clicks", () => {
  const s = state({ V4: 1, V9: 1, M1: 1, M5: 1, M7: 2, M10: 1, M14: 1 });
  assert.ok(configureAutomation(s, "farm", 1).ok);
  assert.equal(configureAutomation(s, "wool", 1).ok, false);
  s.harvest.farm = 1;
  advance(s, 4);
  assert.equal(s.harvestCount, 1);
  assert.equal(s.clicks, 0);
  assert.equal(s.charge, 0);
});
test("copper golem physically collects bounded cargo and cannot mint income without work", () => {
  const s = state({ V2: 1, V15: 1, V4: 1, M4: 1 });
  const g = s.community.golems[0];
  g.stops = ["V4"];
  enqueueBatch(s, "V4", "小麦", 80, 4, {});
  advance(s, 3);
  assert.ok(g.cargo || g.delivered > 0);
  if (g.cargo) assert.ok(g.cargo.qty <= 16);
  advance(s, 20);
  assert.ok(g.delivered >= 16);
  assert.ok(g.trips > 0);
  const empty = state({ V15: 1 });
  advance(empty, 30);
  assert.equal(empty.money, 0);
});
test("golem equipment upgrades only one golem and an in-flight save keeps all cargo", () => {
  const s = state({ V15: 2, V4: 1, M4: 1 });
  s.money = 10000;
  assert.ok(upgradeGolem(s, "golem-1", "basket").ok);
  assert.equal(s.community.golems[1].upgrades.basket, 0);
  s.community.golems[0].stops = ["V4"];
  enqueueBatch(s, "V4", "小麦", 80, 4, {});
  advance(s, 2);
  const qty = s.community.batches.reduce((v, b) => v + b.qty, 0),
    copy = restore(s);
  close(
    copy.community.batches.reduce((v, b) => v + b.qty, 0),
    qty,
  );
  assert.ok(copy.community.batches.every((b) => !b.claimed));
});
test("legacy version 2 migrates names, books and electricity without offline rewards", () => {
  const raw = {
    ...fresh(0),
    version: 2,
    money: 4321,
    energy: 40,
    counts: { V2: 3, V12: 2, M5: 1, V15: 1 },
    savedAt: 0,
  };
  delete raw.community;
  delete raw.grid;
  const s = restore(raw, 467000);
  assert.equal(s.version, 10);
  assert.equal(s.money, 4321);
  assert.equal(s.community.residents.length, 3);
  assert.equal(s.community.golems.length, 1);
  assert.equal(s.counts.V12, 2);
  close(s.energy, 40);
  const before = structuredClone(s);
  advance(s, 467, { offline: true });
  assert.deepEqual(s, before);
});
test("claimed gifts survive save and can only be collected once", () => {
  const s = state({ L2: 1, L6: 1, V15: 1 });
  s.live.gifts = [
    { id: 10, value: 20, life: 15, x: 30, y: 30, claimed: "golem-1" },
  ];
  const copy = restore(s);
  assert.equal(copy.live.gifts.length, 1);
  assert.equal(collectGift(copy, 10), 20);
  assert.equal(collectGift(copy, 10), 0);
});

test("normal building placement leaves traversable routes for real resident and golem work", () => {
  const s = residentFixture();
  assignJob(s, "resident-1", "farmer");
  assignJob(s, "resident-2", "rancher");
  assignJob(s, "resident-3", "musician");
  const nav = companionNavigation(s);
  for (let i = 0; i < 160; i++) {
    advance(s, 1);
    for (const a of [
      ...s.community.residents.filter((r) => r.job !== "idle"),
      ...s.community.golems,
    ])
      assert.ok(
        nav.clear(a.x, a.z, COMPANION_RADIUS),
        `${a.id} crossed a building or coast`,
      );
  }
  for (const r of s.community.residents.slice(0, 3))
    assert.ok(r.jobEarned > 0, `${r.job} never completed useful work`);
  assert.ok(
    s.community.golems[0].delivered > 0,
    "golem never delivered a real batch",
  );
});
test("disabling one dimensional consumer stops its output while other powered machines keep working", () => {
  const s = state({
    V2: 1,
    M5: 1,
    M6: 1,
    M7: 2,
    N1: 1,
    N3: 1,
    N4: 1,
    N5: 1,
    E2: 1,
    E3: 1,
    E5: 1,
    E8: 1,
  });
  s.endEyes = 12;
  s.buffers.nether.raw = 100;
  s.buffers.end.raw = 100;
  const before = rates(s);
  toggleDevice(s, "N5");
  toggleDevice(s, "E5");
  const after = rates(s);
  assert.equal(after.electricity.perDevice.N5, 0);
  assert.equal(after.electricity.perDevice.E5, 0);
  assert.equal(after.regions.nether.raw, before.regions.nether.raw); // Magma now processes real batches.
  assert.equal(magmaProcess(s, 10, after.electricity), 0);
  assert.ok(magmaProcess(s, 10, before.electricity) > 0);
  assert.ok(after.regions.end.haul < before.regions.end.haul);
  assert.ok(after.electricity.perDevice.N4 > 0);
  assert.ok(after.electricity.perDevice.E8 > 0);
});

test("the final fraction of an automatic harvest still costs its actual energy", () => {
  const s = state({ V2: 1, V4: 1, M5: 1, M10: 1, M14: 1 });
  s.harvest.farm = 1;
  const t = taskState(s, "farm");
  t.work = 2.9;
  t.owners.machine = 2.9;
  configureAutomation(s, "farm", 1);
  s.energy = 0.1;
  advance(s, 0.1);
  assert.equal(s.harvestCount, 0);
  assert.ok(t.work > 2.9 && t.work < 3);
  s.energy = 1;
  advance(s, 1);
  assert.equal(s.harvestCount, 1);
});
