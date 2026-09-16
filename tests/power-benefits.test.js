import test from "node:test";
import assert from "node:assert/strict";
import { fresh, advance, restore } from "../src/game.js";
import {
  connectGrid,
  disconnectGrid,
  powerSnapshot,
  toggleDevice,
} from "../src/power.js";
import { taskState, requestTask } from "../src/operations.js";
import { facilityStatus } from "../src/facility-status.js";
import { preparationSpeed } from "../src/power-benefits.js";
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
function setup(id) {
  const s = fresh(0);
  Object.assign(s.counts, { [id]: 1, M5: 1, M6: 1 });
  s.grid.links[id] = false;
  taskState(s, id === "L1" ? "music" : "note").cooldown = 8;
  return s;
}
for (const [id, key] of [
  ["L1", "music"],
  ["M20", "note"],
]) {
  test(`${id}: disconnect/shortage keeps free work; powered preparation consumes real energy`, () => {
    const s = setup(id),
      plain = restore(s, 0);
    advance(plain, 2);
    close(taskState(plain, key).cooldown, 6);
    close(plain.grid.spent, 0);
    assert.ok(connectGrid(s, id).ok);
    advance(s, 2);
    close(taskState(s, key).cooldown, 5);
    close(s.grid.spent, 2);
    const load = powerSnapshot(s).loads.find((l) => l.id === id);
    close(load.actual, 1);
    const restored = restore(s, 0);
    assert.equal(restored.grid.links[id], true);
    assert.ok(disconnectGrid(s, id).ok);
    advance(s, 1);
    close(taskState(s, key).cooldown, 4);
    close(s.grid.spent, 2);
    assert.ok(connectGrid(s, id).ok);
    s.counts.M6 = 0;
    s.energy = 0;
    advance(s, 1);
    close(taskState(s, key).cooldown, 3);
    assert.match(
      facilityStatus(s, id).fields.find((f) => f.key === "benefit").value,
      /缺电/,
    );
    toggleDevice(s, id);
    advance(s, 1);
    close(taskState(s, key).cooldown, 2);
  });
  test(`${id}: ready device uses no bonus power; muting never changes income/cooldown`, () => {
    const s = setup(id);
    connectGrid(s, id);
    taskState(s, key).cooldown = 0;
    assert.equal(powerSnapshot(s).loads.find((l) => l.id === id).actual, 0);
    const muted = structuredClone(s);
    muted.sound = false;
    s.sound = true;
    assert.ok(requestTask(s, key).ok);
    assert.ok(requestTask(muted, key).ok);
    advance(s, 4);
    advance(muted, 4);
    close(s.community.jobIncome, muted.community.jobIncome);
    assert.equal(taskState(s, key).cycle, 1);
    close(s.grid.spent, muted.grid.spent);
    close(taskState(s, key).cooldown, taskState(muted, key).cooldown);
  });
}
test("optional preparation scales with allocated supply, and never slows below the base rate", () => {
  close(preparationSpeed("L1", { perDevice: { L1: 0.5 } }), 1.25);
  close(preparationSpeed("L1", { perDevice: { L1: 0 } }), 1);
  const s = setup("L1");
  s.counts.M6 = 0;
  s.energy = 0.5;
  connectGrid(s, "L1");
  const p = powerSnapshot(s, 1);
  close(p.perDevice.L1, 0.5);
  close(p.consumed, 0.5);
});
test("redstone lamp consumes power only when enabled and connected", () => {
  const s = setup("M19");
  close(powerSnapshot(s).loads.find((l) => l.id === "M19").actual, 0);
  connectGrid(s, "M19");
  close(powerSnapshot(s).loads.find((l) => l.id === "M19").actual, 0.5);
  toggleDevice(s, "M19");
  close(powerSnapshot(s).perDevice.M19, 0);
});
