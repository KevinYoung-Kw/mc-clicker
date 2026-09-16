import test from "node:test";
import assert from "node:assert/strict";
import { fresh, restore, advance, rates } from "../src/game.js";
import { gridConnected, gridRange, powerSnapshot } from "../src/power.js";
import { recordTransport } from "../src/transport.js";
import { transportTopology, routingStats } from "../src/routing.js";

test("v5 studio without former optional power keeps owned things and receives explicit finite supply", () => {
  const raw = fresh(0);
  raw.version = 5;
  raw.counts = { T1: 1, V1: 1, L2: 1, L6: 1 };
  raw.money = 1234;
  raw.live.viewers = 100;
  raw.live.peak = 200;
  const s = restore(raw, 100);
  assert.equal(s.money, 1234);
  assert.equal(s.grid.legacyStudioSupply, 6);
  assert.equal(s.counts.M6, 0);
  assert.equal(s.live.viewers, 100);
  assert.ok(rates(s).live > 0);
  advance(s, 5);
  assert.ok(s.liveIncome > 0);
  const copy = restore(s, 200);
  assert.equal(copy.grid.legacyStudioSupply, 6);
  assert.equal(copy.grid.spent, s.grid.spent);
  assert.deepEqual(copy.placements, s.placements);
});
test("legacy line has finite migration reach and manual disconnect remains disconnected", () => {
  const raw = fresh(0);
  raw.version = 5;
  raw.counts = { T1: 1, V1: 6, M5: 1, M6: 1, M9: 1 };
  raw.chunks.overworld = Array.from({ length: 7 }, (_, x) => ({ x, z: 0 }));
  raw.placements = {
    M5: { x: 0, z: 0, realm: "overworld" },
    M6: { x: 1.5, z: 0, realm: "overworld" },
    M9: { x: 29, z: 0, realm: "overworld" },
  };
  const s = restore(raw);
  assert.ok(s.grid.migrationReach > 0);
  assert.ok(Number.isFinite(gridRange(s)));
  assert.equal(gridConnected(s, "M9"), true);
  raw.grid.links.M9 = false;
  assert.equal(gridConnected(restore(raw), "M9"), false);
});
test("flow records count real transfers once per stage and preserve totals when idle", () => {
  const s = fresh(0);
  s.counts = { V2: 1, M1: 1, M2: 1, M4: 1, V3: 1 };
  s.chunks.overworld = [
    { x: 0, z: 0 },
    { x: 1, z: 0 },
  ];
  s.placements = {
    M1: { x: -1, z: 0, realm: "overworld" },
    M2: { x: 1, z: 0, realm: "overworld" },
    M4: { x: 3, z: 0, realm: "overworld" },
    V3: { x: 5, z: 0, realm: "overworld" },
  };
  const topology = transportTopology(s);
  recordTransport(s, "overworld", { raw: 12, processed: 12, delivery: 7 }, 0.5);
  for (const stage of ["raw", "processed", "delivery"])
    assert.equal(
      topology.edges
        .filter((e) => e.stage === stage)
        .reduce((sum, e) => sum + s.transport.edges[e.id].quantity, 0),
      stage === "delivery" ? 7 : 12,
    );
  const totals = Object.fromEntries(
    Object.entries(s.transport.edges).map(([id, v]) => [id, v.total]),
  );
  recordTransport(s, "overworld", {}, 0.5);
  for (const [id, v] of Object.entries(s.transport.edges)) {
    assert.equal(v.rate, 0);
    assert.equal(v.total, totals[id]);
  }
});
test("a disconnected producer cannot feed another island, and no frame rebuilds the route grid", () => {
  const s = fresh(0);
  s.counts = { M5: 1, M7: 1, M9: 1, M2: 1, M4: 1, V3: 1, V2: 1 };
  s.chunks.overworld = [
    { x: 0, z: 0 },
    { x: 2, z: 0 },
  ];
  s.placements = {
    M5: { x: 0, z: 1.5, realm: "overworld" },
    M7: { x: 9, z: 0, realm: "overworld" },
    M9: { x: 11, z: 0, realm: "overworld" },
    M2: { x: -1, z: 0, realm: "overworld" },
    M4: { x: 1, z: 0, realm: "overworld" },
    V3: { x: 0, z: -1.5, realm: "overworld" },
  };
  assert.equal(rates(s).regions.overworld.raw, 0);
  assert.equal(powerSnapshot(s).loads.find((l) => l.id === "M9").rated, 0);
  const builds = routingStats(s).builds;
  advance(s, 10);
  assert.equal(s.buffers.overworld.delivered, 0);
  assert.equal(routingStats(s).builds, builds);
});
