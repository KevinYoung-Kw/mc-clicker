import test from "node:test";
import assert from "node:assert/strict";
import { fresh, advance, rates, emit, action } from "../src/game.js";
import {
  powerSnapshot,
  gridConnection,
  automationAssignments,
  configureAutomation,
  toggleDevice,
  gridRange,
} from "../src/power.js";
import { taskState } from "../src/operations.js";
const setup = (counts) => Object.assign(fresh(0), { counts });
test("studio base survives shedding; each attachment has its own billed load; decorations have none", () => {
  const s = setup({
    M5: 1,
    M6: 1,
    L2: 1,
    L3: 2,
    L5: 1,
    L10: 1,
    L6: 3,
    L12: 1,
    X7: 8,
  });
  s.live.viewers = 100;
  const p = powerSnapshot(s, 1, true);
  for (const id of ["L2", "L3", "L5", "L10", "L6", "L12"])
    assert.ok(p.loads.some((l) => l.id === id));
  assert.equal(p.perDevice.L2, 1);
  assert.ok(p.perDevice.L12 < 1);
  assert.equal(
    p.loads.some((l) => l.id === "X7"),
    false,
  );
  assert.ok(
    Math.abs(p.generated + p.old - p.consumed - p.stored - p.spill) < 1e-9,
  );
});
test("no base power means no new studio income, viewers, gifts or director events; existing gifts persist", () => {
  const s = setup({ M5: 1, L2: 1, L3: 1, L5: 1, L6: 3, L7: 1, L10: 1 });
  s.live.viewers = s.live.peak = 100;
  s.live.gifts = [{ id: 1, value: 50, life: 20 }];
  advance(s, 60);
  emit(s, "milestone", "无电期间施工");
  assert.equal(s.liveIncome, 0);
  assert.equal(s.live.viewers, 100);
  assert.equal(s.live.gifts.length, 1);
  assert.equal(s.live.gifts[0].life, 20);
  assert.equal(action(s, "respond").ok, false);
  s.counts.M6 = 2;
  advance(s, 30);
  assert.ok(s.liveIncome > 0);
});
test("actual wire distance is finite, tiers reduce loss and real loss is conserved", () => {
  const s = setup({ M5: 1, M6: 1, M9: 1, M1: 1, M2: 1 });
  s.chunks.overworld = Array.from({ length: 7 }, (_, x) => ({ x, z: 0 }));
  s.placements = {
    M5: { x: 0, z: 0, realm: "overworld" },
    M6: { x: 1, z: 1, realm: "overworld" },
    M9: { x: 30, z: 0, realm: "overworld" },
    M2: { x: 27, z: 0, realm: "overworld" },
  };
  assert.equal(gridConnection(s, "M9").connected, false);
  s.counts.M11 = 2;
  assert.equal(gridConnection(s, "M9").connected, true);
  const before = gridConnection(s, "M9").loss;
  s.counts.M11 = 3;
  assert.ok(gridConnection(s, "M9").loss < before);
  s.counts.M6 = 10;
  const p = powerSnapshot(s, 0.25, true);
  assert.ok(p.lineLoss > 0);
  assert.ok(
    Math.abs(p.generated + p.old - p.consumed - p.stored - p.spill) < 1e-8,
  );
  s.counts.M11 = 500;
  assert.equal(gridRange(s), 56);
});
test("observer allocates only idle actuators and never takes a started personal cycle", () => {
  const s = setup({
    M5: 1,
    M7: 1,
    M10: 1,
    M13: 1,
    M14: 1,
    V4: 1,
    V9: 1,
    M1: 1,
  });
  s.harvest.farm = s.harvest.wool = 1;
  assert.equal(automationAssignments(s).farm, 1);
  assert.equal(automationAssignments(s).wool, 0);
  const task = taskState(s, "farm");
  task.work = 0.2;
  task.owners = { resident1: 0.2 };
  assert.equal(automationAssignments(s).farm, 0);
  assert.equal(automationAssignments(s).wool, 1);
  configureAutomation(s, "farm", 1);
  const p = powerSnapshot(s);
  assert.equal(
    p.loads.some((l) => l.id === "auto-farm"),
    false,
  );
  assert.equal(automationAssignments(s).wool, 0);
});
test("idle, disabled, out-of-range and working are separate states", () => {
  const s = setup({ M5: 1, M7: 1, M9: 1 });
  const p = powerSnapshot(s);
  assert.equal(p.loads.find((l) => l.id === "M9").state, "working");
  s.buffers.overworld.raw = 120;
  assert.equal(powerSnapshot(s).loads.find((l) => l.id === "M9").state, "idle");
  assert.equal(
    powerSnapshot(s).perDevice.M9,
    0,
    "idle motor animation must stop with actual work",
  );
  toggleDevice(s, "M9");
  assert.equal(powerSnapshot(s).loads.find((l) => l.id === "M9").state, "off");
});
test("clock increases mechanical power demand and output together when powered", () => {
  const s = setup({ M5: 1, M7: 2, M9: 1, M2: 1, M1: 1 });
  const before = powerSnapshot(s),
    raw = rates(s).regions.overworld.raw;
  s.counts.M10 = 1;
  const after = powerSnapshot(s);
  assert.equal(
    after.loads.find((l) => l.id === "M9").rated,
    before.loads.find((l) => l.id === "M9").rated * 1.3,
  );
  assert.ok(rates(s).regions.overworld.raw > raw);
});
