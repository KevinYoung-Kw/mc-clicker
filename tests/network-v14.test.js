import {prepareResearchFor} from '../scripts/research-fixture.mjs';
import test from "node:test";
import assert from "node:assert/strict";
import { fresh, buy, restore, rates, frontier, sites } from "../src/game.js";
import { ITEMS, topological } from "../src/catalog.js";
import {
  connectGrid,
  disconnectGrid,
  connectAll,
  setAutoConnect,
  gridConnection,
  powerSnapshot,
  toggleDevice,
  configureAutomation,
  automationAssignments,
} from "../src/power.js";
import {
  ensureCommunity,
  prioritizeHauling,
  assignJob,
  residentBase,
} from "../src/residents.js";
import {
  enqueueBatch,
  advanceOperations,
  sellCommunity,
  taskState,
} from "../src/operations.js";
import { residentFixture } from "../scripts/resident-fixture.mjs";
import { buyEarlyGuidance } from "../scripts/early-fixture.mjs";
import { facilityStatus } from "../src/facility-status.js";
import { features } from "../src/progression-ui.js";
const setup = (counts) => {
  const s = fresh(0);
  Object.assign(s.counts, counts);
  ensureCommunity(s);
  return s;
};
const earnings = {
  earn(s, v) {
    s.money += v;
  },
  emit() {},
  collectGift() {},
  deliverOrders() {
    return 0;
  },
};

test('a basic warehouse opens logistics without demanding electricity for ordinary storage',()=>{
  const s=setup({M4:1,M5:1});s.grid.links.M4=false;
  assert.equal(features(s).network,true);
  assert.ok(!facilityStatus(s,'M4').fields.some(f=>f.key==='connection'));
  assert.deepEqual(connectAll(s).connected,[]);
});

test('buying music before the grid does not leave an inaccessible pending link when it moves indoors',()=>{
  const s=fresh();s.money=1e8;s.research.completed["basic-power"]=true;buyEarlyGuidance(s);
  for(const id of ['V2','T7','L1','M5']){
    while(!sites(s,'overworld',null,id).length) assert.ok(buy(s,'V1',frontier(s)[0]).ok);
    assert.ok(buy(s,id).ok,id);
  }
  assert.equal(s.grid.links.L1,false);
  assert.ok(connectGrid(s,'L1').ok);
  Object.assign(s.counts,{M10:1,M7:1});
  assert.ok(configureAutomation(s,'music',true).ok);
  assert.ok(powerSnapshot(s).perDevice['auto-music']>0);
  s.counts.L2=1;assert.ok(powerSnapshot(s).perDevice['auto-music']>0);
});

test("new purchase asks for connection once; levels preserve player intent; auto-connect is optional", () => {
  const s = residentFixture();
  setAutoConnect(s, false);
  delete s.counts.M15;delete s.placements.M15;delete s.grid.links.M15;
  while (!sites(s, "overworld", null, "M15").length)
    assert.ok(buy(s, "V1", frontier(s)[0]).ok);
  assert.ok(buy(s, "M15").ok);
  assert.equal(gridConnection(s, "M15").connected, false);
  assert.ok(buy(s, "M15").ok);
  assert.equal(s.grid.links.M15, false);
  const money = s.money;
  assert.ok(connectGrid(s, "M15").ok);
  assert.equal(s.money, money);
  assert.ok(buy(s, "M15").ok);
  assert.equal(s.grid.links.M15, true);
  disconnectGrid(s, "M15");
  assert.ok(buy(s, "M15").ok);
  assert.equal(s.grid.links.M15, false);
  setAutoConnect(s, true);
  while (!sites(s, "overworld", null, "M16").length)
    assert.ok(buy(s, "V1", frontier(s)[0]).ok);
  prepareResearchFor(s,"M16");assert.ok(buy(s, "M16").ok);
  assert.equal(gridConnection(s, "M16").connected, true);
});
test("grid access changes actual generation, load and production; restoring resumes without a second link", () => {
  const s = setup({ M5: 1, M7: 1, M9: 1, M1: 1 });
  s.grid.links = { M7: false, M9: false };
  assert.equal(powerSnapshot(s).supply, 0);
  const before = rates(s).regions.overworld.raw;
  assert.ok(connectGrid(s, "M9").ok);
  assert.equal(powerSnapshot(s).perDevice.M9, 0);
  assert.ok(connectGrid(s, "M7").ok);
  assert.equal(powerSnapshot(s).supply, 32);
  assert.ok(powerSnapshot(s).consumption > 0);
  assert.ok(rates(s).regions.overworld.raw > before);
  toggleDevice(s, "M9");
  assert.equal(rates(s).regions.overworld.raw, before);
  assert.equal(s.grid.links.M9, true);
  toggleDevice(s, "M9");
  assert.ok(rates(s).regions.overworld.raw > before);
});
test("failed access does not announce success or overwrite the saved connection request", () => {
  const s = setup({ M9: 1 });
  s.grid.links.M9 = false;
  assert.match(connectGrid(s, "M9").reason, /控制台/);
  assert.equal(s.grid.links.M9, false);
  s.counts.M5 = 1;
  s.counts.M6 = 1;
  s.chunks.overworld = Array.from({ length: 7 }, (_, x) => ({ x, z: 0 }));
  s.placements = {
    M5: { x: 0, z: 0, realm: "overworld" },
    M6: { x: 1, z: 1, realm: "overworld" },
    M9: { x: 30, z: 0, realm: "overworld" },
  };
  s.layoutRevision++;
  assert.match(connectGrid(s, "M9").reason, /覆盖/);
  assert.equal(s.grid.links.M9, false);
  s.counts.M11 = 3;
  assert.ok(connectGrid(s, "M9").ok);
  s.counts.M11 = 0;
  assert.equal(gridConnection(s, "M9").connected, false);
  assert.equal(s.grid.links.M9, true);
  s.counts.M11 = 3;
  assert.equal(gridConnection(s, "M9").connected, true);
  s.chunks.overworld = [
    { x: 0, z: 0 },
    { x: 6, z: 0 },
  ];
  s.layoutRevision++;
  assert.match(connectGrid(s, "M9").reason, /通路/);
  assert.equal(s.grid.links.M9, true);
});
test("batch connection skips stopped equipment and preserves resources; unloading is genuinely gated", () => {
  const s = setup({ M5: 1, M7: 1, M9: 1, M17: 1, V2: 1, M1: 1 });
  s.grid.links = { M7: false, M9: false, M17: false };
  s.grid.disabled = ["M9"];
  const h = rates(s).regions.overworld.haul,
    money = s.money;
  const result = connectAll(s);
  assert.deepEqual(result.connected.sort(), ["M17", "M7"]);
  assert.equal(s.money, money);
  assert.equal(s.grid.links.M9, false);
  assert.equal(rates(s).regions.overworld.haul, h * 2);
  toggleDevice(s, "M17");
  assert.equal(rates(s).regions.overworld.haul, h);
});
test("V1.3 save preserves implicit links, intentional shutdown, money and old automatic operation", () => {
  const raw = residentFixture();
  delete raw.grid.version;
  delete raw.grid.autoConnect;
  delete raw.grid.learnedConnection;
  delete raw.grid.links.M7;
  raw.grid.links.M9 = false;
  raw.grid.disabled = ["M8"];
  raw.money = 6264321;
  const copy = restore(raw, 467000);
  assert.equal(copy.money, raw.money);
  assert.equal(copy.version, 10);
  assert.equal(copy.grid.autoConnect, false);
  assert.equal(gridConnection(copy, "M7").connected, true);
  assert.equal(copy.grid.links.M9, false);
  assert.ok(copy.grid.disabled.includes("M8"));
  assert.deepEqual(copy.placements, raw.placements);
});
test("a hauler prioritizes real cargo, falls back when empty, and pays only at sale", () => {
  const s = setup({ V2: 1, V4: 1, M1: 1, M4: 1 });
  const r = s.community.residents[0],
    base = residentBase(s, r);
  enqueueBatch(s, "M1", "矿料", 12, 4);
  s.play = 1;
  enqueueBatch(s, "V4", "小麦", 12, 4);
  assert.ok(prioritizeHauling(s, r.id, "V4").ok);
  assert.equal(residentBase(s, r), base);
  for (let i = 0; i < 200 && !r.cargo; i++) {
    s.play += 0.25;
    advanceOperations(s, 0.25, earnings, powerSnapshot(s));
  }
  assert.equal(
    r.cargo?.id,
    s.community.batches.find((b) => b.source === "V4").id,
  );
  assert.equal(prioritizeHauling(s, r.id, "M1").ok, false);
  const atPickup = s.money,
    started = s.play;
  for (let i = 0; i < 200 && r.cargo; i++) {
    s.play += 0.25;
    advanceOperations(s, 0.25, earnings, powerSnapshot(s));
  }
  assert.equal(r.lastDelivery.source, "V4");
  assert.equal(r.lastDelivery.qty, 12);
  assert.ok(
    Math.abs(s.money - atPickup - (s.play - started) * base) < 1e-6,
    "delivery itself does not mint emeralds",
  );
  const beforeSale = s.money;
  sellCommunity(s, 1, 0, 100, 0, earnings);
  assert.equal(s.money - beforeSale, 48);
  sellCommunity(s, 1, 0, 100, 0, earnings);
  assert.equal(s.money - beforeSale, 48, "no double settlement");
  for (let i = 0; i < 200 && !r.cargo; i++) {
    s.play += 0.25;
    advanceOperations(s, 0.25, earnings, powerSnapshot(s));
  }
  assert.equal(
    r.cargo?.id,
    s.community.batches.find((b) => b.source === "M1").id,
  );
});
test("priority uses the existing job and save data; cancel leaves the hauler available", () => {
  const s = setup({ V2: 1, V4: 1, V3: 1 });
  const r = s.community.residents[0];
  prioritizeHauling(s, r.id, "V4");
  const copy = restore(s);
  assert.equal(copy.community.residents[0].prioritySource, "V4");
  assert.ok(prioritizeHauling(s, r.id, null).ok);
  assert.equal(r.job, "hauler");
  assert.equal(r.prioritySource, null);
  prioritizeHauling(s, r.id, "V4");
  assignJob(s, r.id, "farmer");
  assert.equal(r.prioritySource, null);
  assert.equal(prioritizeHauling(s, r.id, "N4").ok, false);
  assert.equal(r.job, "farmer");
});
test("a stopped hopper leaves the original sales box available", () => {
  const s = setup({ V2: 1, V4: 1, M8: 1 });
  enqueueBatch(s, "V4", "小麦", 10, 4);
  sellCommunity(s, 1, 3, 3, 0, earnings);
  assert.equal(s.money, 4);
});
test("fixed and borrowed actuators share one capacity; unavailable targets cannot reserve slots", () => {
  const s = setup({ M5: 1, M7: 1, M10: 1, M13: 1, M14: 2, V4: 1, V9: 1 });
  s.harvest.farm = s.harvest.wool = 1;
  assert.equal(configureAutomation(s, "mine", 1).ok, false);
  assert.ok(configureAutomation(s, "farm", 1).ok);
  assert.equal(configureAutomation(s, "wool", 2).ok, false);
  const a = automationAssignments(s);
  assert.equal(a.farm, 1);
  assert.equal(a.wool, 1);
  assert.equal(s.grid.automation.wool, 0);
  taskState(s, "wool").owners = { resident1: 1 };
  taskState(s, "wool").work = 1;
  assert.equal(automationAssignments(s).wool, 0);
  assert.equal(s.grid.automation.farm, 1);
  assert.equal(restore(s).grid.automation.farm, 1);
});
test("revised access has no cycle and does not require warehouse/clock merely to start a grid or extend it", () => {
  assert.ok(!ITEMS.M5.deps.includes("M4"));
  assert.deepEqual(ITEMS.M11.deps, ["M5"]);
  const seen = new Set();
  for (const item of topological()) {
    for (const id of item.deps) assert.ok(seen.has(id));
    seen.add(item.id);
  }
});
