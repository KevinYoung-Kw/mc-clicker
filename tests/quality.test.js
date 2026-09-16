import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { ForegroundClock } from "../src/foreground.js";
import { CATALOG, ITEMS } from "../src/catalog.js";
import {
  fresh,
  buy,
  action,
  accessible,
  unlocked,
  restore,
  settleOffline,
  rates,
} from "../src/game.js";
import { BUILDING_SIZES, footprint, canPlace } from "../src/layout.js";
import { endPortal } from "../src/end-portal.js";

test("foreground clock drops 467 seconds in background and never catches up on focus", () => {
  const c = new ForegroundClock(0, true);
  assert.equal(c.step(100), 0.1);
  c.setActive(false, 100);
  assert.equal(c.step(467100), 0);
  c.setActive(true, 467100);
  assert.equal(c.step(467116), 0.016);
  assert.equal(c.step(934116), 0);
  assert.equal(c.step(934132), 0.016);
});
test("all placed items have deliberate footprints; a portal needs a whole clear parcel", () => {
  for (const i of CATALOG.filter((i) => i.place))
    assert.ok(BUILDING_SIZES[i.id], i.id);
  assert.deepEqual(footprint("N4"), { w: 3, d: 2 });
  assert.deepEqual(footprint("E2"), { w: 5, d: 5 });
  const s = fresh();
  s.counts.V1 = 1;
  s.chunks.overworld.push({ x: 1, z: 0 });
  assert.equal(canPlace(s, "E2", { x: 5, z: 0, realm: "overworld" }), true);
  s.placements.L1 = { x: 5.5, z: 1.5, realm: "overworld" };
  assert.equal(canPlace(s, "E2", { x: 5, z: 0, realm: "overworld" }), false);
  assert.equal(unlocked(fresh(), ITEMS.T7), false);
});
test("twelve eyes activate a horizontal portal, gate residents, and cannot be inserted twice", () => {
  const s = fresh();
  s.money = 1e12;
  s.counts = { T1: 1, V1: 1, E1: 1, N12: 1 };
  s.chunks.overworld.push({ x: 1, z: 0 });
  assert.ok(buy(s, "E2", { x: 5, z: 0, realm: "overworld" }).ok);
  assert.equal(s.realm, "overworld");
  assert.equal(accessible(s, "end"), false);
  assert.equal(unlocked(s, ITEMS.E3), false);
  assert.equal(rates(s).regions.end.potential, 0);
  for (let j = 0; j < 11; j++) assert.ok(action(s, "end-eye").ok);
  assert.equal(accessible(s, "end"), false);
  assert.ok(action(s, "end-eye").ok);
  assert.equal(accessible(s, "end"), true);
  assert.equal(unlocked(s, ITEMS.E3), true);
  assert.equal(action(s, "end-eye").ok, false);
  assert.ok(action(s, "enter-end").ok);
  assert.equal(s.realm, "end");
  const old = { ...s };
  delete old.endEyes;
  assert.equal(restore(old).endEyes, 12);
  const pending = restore({ ...s, endEyes: 6 });
  assert.equal(pending.endEyes, 6);
  assert.equal(accessible(pending, "end"), false);
  const world = new T.Group(),
    animations = [],
    model = endPortal(world, s, animations);
  const size = new T.Box3().setFromObject(model).getSize(new T.Vector3());
  assert.equal(model.userData.portal.frameCount, 12);
  assert.ok(size.x > 4.9 && size.z > 4.9 && size.y < 1);
});
test("old save reload and import after 467 seconds preserve money and all queues", () => {
  const s = fresh(1000);
  s.money = 15023;
  s.counts = { V1: 1, V2: 3, L2: 1, L6: 1 };
  s.buffers.overworld.raw = 78;
  const imported = restore(s, 468000);
  const before = structuredClone(imported);
  settleOffline(imported, 468000);
  assert.equal(imported.money, 15023);
  assert.deepEqual(imported.buffers, before.buffers);
  assert.deepEqual(imported.live, before.live);
  assert.equal(imported.play, 0);
});
