import test from "node:test";
import assert from "node:assert/strict";
import { fresh, restore, advance, rates } from "../src/game.js";
import {
  beginDimensions,
  consumeThermal,
  thermalProcessLimit,
  startFreight,
  advanceFreight,
  terminalTransfers,
  magmaProcess,
} from "../src/dimensional.js";
import { deliverOrders, settleOrders, createOrders } from "../src/orders.js";
import { powerSnapshot } from "../src/power.js";
import { storageCapacity, buyUpgrade } from "../src/upgrades.js";
import { sellCommunity, enqueueBatch } from "../src/operations.js";
const power = { perDevice: { N5: 1, N12: 1, E5: 1, E7: 1, E9: 1 } };
function dimensional() {
  const s = fresh();
  s.counts = {
    M5: 1,
    M7: 5,
    N1: 1,
    N3: 1,
    N4: 1,
    N6: 1,
    N12: 1,
    E2: 1,
    E3: 1,
    E5: 1,
    E7: 1,
    E9: 1,
  };
  s.endEyes = 12;
  return s;
}
const inventory = (s) =>
  Object.values(s.buffers).reduce((v, b) => v + b.raw + b.goods, 0) +
  Object.values(s.dimensions.trips).reduce((v, t) => v + t.cargo, 0) +
  Object.values(s.dimensions.awaiting).reduce((a, b) => a + b, 0);
test("heat accumulates to a finite capacity; electricity recovery requires actual hot processing", () => {
  const s = dimensional();
  beginDimensions(s, 100);
  assert.equal(s.dimensions.heat, 120);
  assert.equal(powerSnapshot(s).sources.find((x) => x.id === "N4").rate, 0);
  const made = thermalProcessLimit(s, 1000, 1);
  assert.equal(made, 245);
  consumeThermal(s, made, 1);
  assert.equal(s.dimensions.heat, 0);
  assert.equal(s.dimensions.heatUsed, 120);
  assert.ok(powerSnapshot(s).sources.find((x) => x.id === "N4").rate > 0);
  consumeThermal(s, 0, 1);
  assert.equal(powerSnapshot(s).sources.find((x) => x.id === "N4").rate, 0);
});
test("empty carriers never create cargo, raw material or money", () => {
  const s = dimensional();
  for (let t = 0; t < 120; t++) advanceFreight(s, 1, power);
  assert.equal(inventory(s), 0);
  assert.equal(s.total, 0);
  assert.deepEqual(s.dimensions.trips, {});
});
test("ghast pickup, save reload, blocked destination and later arrival conserve one cargo", () => {
  const s = dimensional();
  s.buffers.overworld.goods = 80;
  assert.ok(startFreight(s, "N6", power, { manual: true }).ok);
  assert.equal(s.buffers.overworld.goods, 0);
  assert.equal(inventory(s), 80);
  const restored = restore(s);
  assert.equal(restored.dimensions.trips.N6.cargo, 80);
  restored.buffers.nether.raw = storageCapacity(restored, "nether", "raw");
  advanceFreight(restored, 4, power);
  assert.equal(restored.dimensions.trips.N6.cargo, 80);
  restored.buffers.nether.raw = 0;
  advanceFreight(restored, 1, power);
  assert.equal(restored.buffers.nether.raw, 80);
  assert.equal(restored.dimensions.trips.N6, undefined);
  assert.equal(inventory(restored), 80);
});
test("enderman has a finite departure interval and leaves real stock in the processing queue", () => {
  const s = dimensional();
  s.counts.E9 = 0;
  s.buffers.end.raw = 100;
  advanceFreight(s, 7, power);
  assert.equal(s.buffers.end.raw, 100);
  advanceFreight(s, 1, power);
  assert.equal(s.dimensions.trips.E3.cargo, 64);
  assert.equal(s.buffers.end.raw, 36);
  advanceFreight(s, 1, power);
  assert.equal(s.dimensions.awaiting.endRaw, 64);
  assert.equal(inventory(s), 100);
  assert.equal(s.total, 0);
});
test("dragon carries goods already produced, without awarding money or mining new raw", () => {
  const s = dimensional();
  s.counts.E3 = 0;
  s.counts.M4 = 5;
  s.buffers.end.goods = 1000;
  advanceFreight(s, 40, power);
  assert.equal(s.dimensions.trips.E9.cargo, 800);
  assert.equal(s.buffers.end.goods, 200);
  advanceFreight(s, 6, power);
  assert.equal(s.dimensions.awaiting.endGoods, 800);
  assert.equal(inventory(s), 1000);
  assert.equal(s.buffers.end.raw, 0);
  assert.equal(s.total, 0);
});
test("magma is a batch processor, pauses without power and cannot exceed a full destination", () => {
  const s = dimensional();
  s.counts.N5 = 1;
  s.buffers.nether.raw = 100;
  assert.equal(magmaProcess(s, 10, { perDevice: { N5: 0 } }), 0);
  assert.equal(magmaProcess(s, 9, power), 0);
  assert.equal(magmaProcess(s, 1, power), 60);
  assert.equal(s.buffers.nether.raw, 40);
  assert.equal(s.buffers.nether.goods, 60);
  assert.equal(inventory(s), 100);
  s.buffers.nether.goods = storageCapacity(s, "nether");
  const before = s.dimensions.magmaProgress;
  assert.equal(magmaProcess(s, 100, power), 0);
  assert.equal(s.dimensions.magmaProgress, before);
});
test("two orders consume disjoint stock; settlement pays each order only once", () => {
  const s = fresh();
  s.orders = [
    {
      id: 1,
      realm: "overworld",
      target: 10,
      progress: 0,
      reward: 100,
      life: 100,
    },
    {
      id: 2,
      realm: "overworld",
      target: 10,
      progress: 0,
      reward: 100,
      life: 100,
    },
  ];
  assert.equal(deliverOrders(s, "overworld", 15), 15);
  assert.deepEqual(
    s.orders.map((o) => o.progress),
    [10, 5],
  );
  let paid = 0;
  const api = { earn: (_s, v) => (paid += v), emit: () => {} };
  settleOrders(s, 1, api);
  settleOrders(s, 1, api);
  assert.equal(paid, 100);
  assert.equal(s.orders.length, 1);
});
test("one runtime dispatch cannot sell the same goods and also deliver them to orders or the project", () => {
  const s = fresh();
  s.counts = { V3: 1, Z2: 1 };
  s.buffers.overworld.goods = 10;
  s.orders = [
    {
      id: 1,
      realm: "overworld",
      target: 10,
      progress: 0,
      reward: 100,
      life: 100,
    },
    {
      id: 2,
      realm: "overworld",
      target: 10,
      progress: 0,
      reward: 100,
      life: 100,
    },
  ];
  advance(s, 1);
  assert.equal(s.buffers.overworld.goods, 0);
  assert.ok(
    Math.abs(
      s.projectByRealm.overworld / 0.2 +
        s.orders.reduce((v, o) => v + o.progress, 0) -
        10,
    ) < 1e-8,
  );
  assert.equal(s.total, 0);
  assert.equal(s.orders[1].progress, 0);
});
test("crop contracts require the matching delivered batch; general goods and other crops cannot satisfy it", () => {
  const s = fresh();
  s.counts.V2 = 1;
  s.orders = [
    {
      id: 1,
      realm: "overworld",
      kind: "carrot",
      target: 10,
      progress: 0,
      reward: 100,
      life: 100,
    },
  ];
  assert.equal(deliverOrders(s, "overworld", 100), 0);
  assert.equal(deliverOrders(s, "overworld", 100, { kind: "wheat" }), 0);
  enqueueBatch(s, "V4", "胡萝卜", 10, 6, {}, "carrot");
  s.community.batches[0].delivered = 10;
  let paid = 0;
  sellCommunity(s, 10, 10, 10, 1, {
    earn: (_s, v) => (paid += v),
    emit: () => {},
    deliverOrders,
  });
  assert.equal(s.orders[0].progress, 10);
  assert.equal(s.community.batches.length, 0);
  assert.equal(paid, 0);
  settleOrders(s, 1, { earn: (_s, v) => (paid += v), emit: () => {} });
  assert.equal(paid, 100);
});
test("contract quotes follow fixed quantities and goods values, never current player income", () => {
  const s = fresh();
  s.counts = { V17: 1, V3: 1 };
  const r = rates(s);
  s.rate = 1e30;
  s.productionRate = 1e30;
  createOrders(s, 90, r.regions);
  assert.equal(s.orders[0].target, 64);
  assert.equal(
    s.orders[0].reward,
    Math.ceil(64 * r.regions.overworld.value * 1.4),
  );
});
test("explicit carrier shutoff pauses real in-flight cargo and resumes without duplication", () => {
  const s = dimensional();
  s.buffers.end.goods = 100;
  assert.ok(startFreight(s, "E9", power, { manual: true }).ok);
  const before = { ...s.dimensions.trips.E9 };
  s.grid.disabled.push("E9");
  advanceFreight(s, 30, power);
  assert.equal(s.dimensions.trips.E9.remaining, before.remaining);
  assert.equal(s.dimensions.trips.E9.cargo, 100);
  s.dimensions.trips.E9.remaining = 0;
  advanceFreight(s, 1, power);
  assert.equal(s.dimensions.trips.E9.cargo, 100);
  assert.equal(s.dimensions.awaiting.endGoods, 0);
  s.grid.disabled = [];
  advanceFreight(s, 6, power);
  assert.equal(s.dimensions.awaiting.endGoods, 100);
  assert.equal(s.dimensions.trips.E9, undefined);
});
test("loading upgrades require power and preserve the effective flight duration on reload", () => {
  const s = dimensional();
  s.money = 1e12;
  s.counts.E6 = 1;
  s.counts.M13 = 1;
  assert.ok(buyUpgrade(s, "shulker-coil").ok);
  s.buffers.end.goods = 100;
  assert.ok(
    startFreight(s, "E9", { perDevice: { E5: 0 } }, { manual: true }).ok,
  );
  const slow = s.dimensions.trips.E9.duration;
  delete s.dimensions.trips.E9;
  s.buffers.end.goods = 100;
  assert.ok(startFreight(s, "E9", power, { manual: true }).ok);
  const fast = s.dimensions.trips.E9.duration;
  assert.ok(fast < slow);
  assert.equal(s.dimensions.trips.E9.remaining, fast);
  assert.equal(restore(s).dimensions.trips.E9.duration, fast);
});
