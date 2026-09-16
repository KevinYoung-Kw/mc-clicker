import test from "node:test";
import assert from "node:assert/strict";
import { CATALOG, ITEMS, topological, ancestors } from "../src/catalog.js";
import { buyGuidance } from "../src/guidance.js";
import {
  fresh,
  buy,
  n,
  price,
  unlocked,
  rates,
  advance,
  mine,
  action,
  settleOffline,
  restore,
  frontier,
  move,
  sites,
  PROJECT_TARGET,
  setOption,
} from "../src/game.js";
const wealthy = () => {
  const s = fresh(0);
  s.money = 1e18;
  return s;
};
function own(s, ids) {
  for (const id of ids.split(" ")) s.counts[id] = 1;
  if (s.counts.E2) s.endEyes = 12;
  return s;
}
test("104 complete nodes, no cycles, 47 mandatory ancestors and two distinct portals", () => {
  assert.equal(CATALOG.length, 104);
  assert.equal(new Set(CATALOG.map((i) => i.id)).size, 104);
  assert.equal(topological().length, 104);
  assert.equal(ancestors("Z3").size, 47);
  const s = own(wealthy(), "N1");
  assert.equal(unlocked(s, ITEMS.E9), false);
  assert.equal(unlocked(s, ITEMS.N7), true);
});
test("first worker sells without a market, and the player cannot overdraw", () => {
  const s = fresh();
  assert.equal(buy(s, "T1").ok, false);
  for (let j = 0; j < 10; j++) mine(s, () => 1);
  assert.equal(buy(s, "T1").ok, true);
  s.money = 125; // goals 20 + land 25 + info 10 + mailbox 20 + resident 50
  assert.ok(buyGuidance(s, "goals").ok);
  assert.ok(buy(s, "V1").ok);
  assert.ok(buyGuidance(s, "info").ok);
  assert.ok(buy(s, "V18").ok);
  assert.ok(buy(s, "V2").ok);
  const before = s.money;
  advance(s, 5);
  assert.ok(s.money > before);
  assert.equal(n(s, "V3"), 0);
});
test("repeat prices are fixed and never depend on wallet or income", () => {
  const s = wealthy();
  const first = price(s, ITEMS.V2);
  s.money *= 30;
  s.rate = 1e99;
  assert.equal(price(s, ITEMS.V2), first);
  s.counts.V2 = 1;
  assert.ok(price(s, ITEMS.V2) > first);
});
test("population and skill gates are checked independently of affordability", () => {
  const s = own(wealthy(), "V1 V11");
  s.counts.V2 = 5;
  assert.equal(unlocked(s, ITEMS.V14), false);
  s.counts.V2 = 6;
  assert.equal(unlocked(s, ITEMS.V14), true);
  assert.equal(buy(s, "V2").ok, false);
  s.counts.V12 = 2;
  assert.equal(unlocked(s, ITEMS.V13), false);
  s.counts.V12 = 3;
  s.research.completed={industrial:true,modern:true,railway:true,automation:true,broadcasting:true};s.counts.N11=1;
  assert.equal(unlocked(s, ITEMS.V13), true);
});
test("real transport bottleneck builds inventory, extra rail drains it and raises sales", () => {
  const s = own(fresh(), "T7 M2 V3 M5 M15 M4 M9");
  s.counts.V2 = 6;
  s.counts.M9 = 5;
  s.counts.M2 = 10;
  s.counts.V3 = 10;
  advance(s, 30);
  assert.ok(s.buffers.overworld.raw > 100);
  const before = s.productionRate;
  s.counts.M16 = 5;
  advance(s, 10);
  assert.ok(s.productionRate > before * 1.5);
  assert.ok(s.buffers.overworld.raw < 200);
});
test("wind power really powers drills; blackout does not relock purchased nodes", () => {
  const s = own(wealthy(), "M1 M5 M3 M4 T7 V1 V2");
  s.counts.M9 = 8;
  const before = rates(s);
  s.counts.M7 = 3;
  const after = rates(s);
  assert.ok(after.regions.overworld.raw > before.regions.overworld.raw * 2);
  assert.ok(after.power.overworld > before.power.overworld);
  s.research.completed.industrial=true;assert.ok(unlocked(s, ITEMS.M8));
});
test("expansion must attach to the mainland and moving is free and collision-safe", () => {
  const s = own(wealthy(), "T1");
  assert.ok(buyGuidance(s, "goals").ok);
  assert.ok(buy(s, "V1").ok);
  assert.equal(buy(s, "V1", { x: 9, z: 9, realm: "overworld" }).ok, false);
  assert.ok(buy(s, "V1", { ...frontier(s)[0], realm: "overworld" }).ok);
  assert.equal(s.chunks.overworld.length, 2);
  assert.ok(buyGuidance(s, "info").ok);
  assert.ok(buy(s, "V18").ok);
  assert.ok(buy(s, "T7").ok);
  const before = s.money;
  assert.ok(move(s, "T7", sites(s, "overworld", "T7").at(-1)));
  assert.equal(s.money, before);
});
test("manual piston is only paid into the real production buffer; hopper takes over", () => {
  const s = own(fresh(), "M3");
  action(s, "piston");
  assert.equal(s.buffers.overworld.raw, 0);
  action(s, "piston");
  assert.equal(s.buffers.overworld.raw, 20);
  assert.equal(s.money, 0);
  s.counts.M8 = 1;
  s.counts.M5 = 1;
  s.counts.M7 = 1;
  action(s, "piston");
  advance(s, 1);
  assert.equal(s.harvest.piston, 8); // One hopper moves 12 units per second.
  advance(s, 1);
  assert.equal(s.harvest.piston, 0);
});
test("harvest requires maturity, pays once, and does not stop base production", () => {
  const s = own(fresh(), "V2 V4");
  assert.equal(action(s, "farm").ok, false);
  advance(s, 40);
  assert.ok(action(s, "farm").ok);
  assert.equal(action(s, "farm").ok, false);
  const money = s.money;
  advance(s, 3);
  assert.ok(s.money > money);
});
test("automatic emitter never generates manual clicks or resonance charge", () => {
  const s = own(fresh(), "V2 M14 M5 M7 T11");
  s.emitter = "mine";
  advance(s, 30);
  assert.equal(s.clicks, 0);
  assert.equal(s.charge, 0);
  assert.equal(s.burst, 0);
  assert.ok(s.total > 0);
});
test("467 background seconds and offline imports never generate income or inventory", () => {
  const s = own(fresh(0), "V2 V3 T7 M2 L2 L6");
  const before = structuredClone(s);
  assert.deepEqual(settleOffline(s, 467000), { seconds: 467, earned: 0 });
  assert.equal(s.money, before.money);
  assert.equal(s.total, before.total);
  assert.deepEqual(s.buffers, before.buffers);
  assert.deepEqual(s.live, before.live);
  assert.equal(s.play, 0);
  assert.equal(advance(s, 467, { offline: true }), 0);
  assert.equal(s.total, before.total);
  assert.equal(settleOffline(s, 1e10).earned, 0);
  advance(s, 30);
  assert.ok(s.total > before.total);
});
test("past peak viewers unlock subscriptions and camera does not change production realm", () => {
  const s = own(fresh(), "V2 L2 L8 M5 M6");
  s.research.completed={modern:true,streaming:true}; // The viewer gate belongs to modern subscriptions.
  s.live.peak = 1000;
  s.live.viewers = 10;
  assert.ok(unlocked(s, ITEMS.L9));
  advance(s, 10);
  assert.ok(s.liveIncome > 0);
  assert.equal(s.realm, "overworld");
  assert.equal(unlocked(s, ITEMS.E3), false);
});
test("orders are earned by actual deliveries, not by waiting on stalled production", () => {
  const s = own(fresh(), "V17");
  s.orders = [
    {
      id: 1,
      realm: "overworld",
      target: 10,
      progress: 0,
      reward: 500,
      life: 180,
    },
  ];
  advance(s, 10);
  assert.equal(s.orders[0].progress, 0);
  assert.equal(s.total, 0);
  s.counts.V2 = 5;
  advance(s, 10);
  assert.equal(s.orders[0].progress, 0); // Base B is not a physical delivery.
  s.counts.M1 = 1;
  advance(s, 10);
  assert.ok(s.money >= 500);
});
test("save restore sanitizes data and keeps map, progress, cosmetics and historical gates", () => {
  const s = own(wealthy(), "T1 V1 L2");
  s.live.peak = 1000;
  s.counts.X6 = 1;
  delete s.collection; // A real pre-collection save: preserve its purchased flag pack.
  s.cosmetics.flag = 2;
  s.money = 1234;
  s.chunks.overworld.push({ x: 1, z: 0 });
  const r = restore(s, 10);
  assert.equal(r.money, 1234);
  assert.equal(r.live.peak, 1000);
  assert.equal(r.cosmetics.flag, 2);
  assert.equal(r.chunks.overworld.length, 2);
  assert.equal(restore({ ...s, money: Infinity }).money, 0);
  assert.equal(restore({ ...s, counts: { V2: 1e100 } }).counts.V2, 60);
});
test("ending requires deliveries from all three worlds and is charged once", () => {
  const s = own(wealthy(), "Z2");
  assert.equal(buy(s, "Z3").ok, false);
  s.project = PROJECT_TARGET;
  s.projectByRealm = { overworld: 60000, nether: 60000, end: 60000 };
  const before = s.money;
  assert.ok(buy(s, "Z3").ok);
  assert.equal(s.money, before - ITEMS.Z3.cost);
  assert.equal(buy(s, "Z3").ok, false);
  assert.ok(s.completed);
});
test("dispatch requires the actual controller and invalid modes are rejected", () => {
  const s = fresh();
  assert.equal(setOption(s, "priority", "nether"), false);
  own(s, "M12 N1");
  assert.ok(setOption(s, "priority", "nether"));
  assert.equal(setOption(s, "dispatch", "clear"), false);
  own(s, "Z1");
  assert.ok(setOption(s, "dispatch", "clear"));
});

test("all 104 nodes can be purchased through real gates and a three-realm project completes", async () => {
  const { completeFixture } = await import("../scripts/fixtures.mjs");
  const s = completeFixture();
  assert.equal(Object.values(s.counts).filter(Boolean).length, 104);
  assert.ok(s.completed);
  assert.equal(s.project, PROJECT_TARGET);
  for (const realm of ["overworld", "nether", "end"])
    assert.ok(s.buffers[realm].delivered > 0);
});
test("camera purchases add actual facility shots; expression rain is event-driven and bounded", async () => {
  const { cameras, emit, collectGift } = await import("../src/game.js");
  const s = own(fresh(), "V2 V4 M2 L2 M5 M7");
  assert.equal(cameras(s).length, 1);
  s.counts.L3 = 1;
  assert.ok(cameras(s).some((c) => c.id === "V4"));
  own(s, "L5 L6 L7");
  emit(s, "harvest", "麦田大丰收", "overworld");
  assert.equal(s.live.gifts.length, 7);
  assert.ok(s.live.gifts.every((g) => g.expression));
  emit(s, "harvest", "麦田大丰收", "overworld");
  assert.equal(s.live.gifts.length, 7);
  const id = s.live.gifts[0].id;
  assert.ok(collectGift(s, id) > 0);
  assert.equal(collectGift(s, id), 0);
});
test("save restore retains dispatch metrics and unfinished piston inventory", () => {
  const s = own(fresh(), "M12 N1 M3");
  setOption(s, "priority", "nether");
  action(s, "piston");
  const copy = restore(s);
  assert.equal(copy.dispatchChanges, 1);
  assert.equal(copy.harvest.piston, 20);
  assert.equal(copy.priority, "nether");
});

test("donation construction goals pay only after the actual requested build", () => {
  const s = own(wealthy(), "T1 V1 L2 L13 M5 M6");
  advance(s, 0.1);
  const goal = structuredClone(s.live.goal);
  assert.equal(goal.id, "V1");
  const before = s.liveIncome,
    expected = rates(s).live * 0.1;
  advance(s, 0.1);
  assert.equal(s.liveIncome, before + expected);
  assert.ok(buy(s, "V1").ok);
  const income = s.liveIncome;
  advance(s, 0.1);
  assert.ok(s.liveIncome >= income + goal.reward);
  assert.equal(s.live.goal.required, 3);
});
