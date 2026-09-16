import test from "node:test";
import assert from "node:assert/strict";
import { Navigation, intersects } from "../src/navigation.js";

const land = [{ x: 0, z: 0 }];
test("body radius clears walls and corners, including a swept move through a thin fence", () => {
  const fence = { minX: -0.02, maxX: 0.02, minZ: -2.5, maxZ: 2.5 };
  const nav = new Navigation(land, [fence]);
  assert.equal(nav.clear(-0.3, 0, 0.2), true);
  assert.equal(nav.clear(-0.15, 0, 0.2), false);
  assert.equal(nav.segment({ x: -1, z: 0 }, { x: 1, z: 0 }, 0.2), false);
  assert.equal(
    intersects(0.3, 0.3, 0.4, { minX: -1, maxX: 0, minZ: -1, maxZ: 0 }),
    false,
  );
  assert.equal(
    intersects(0.25, 0.25, 0.4, { minX: -1, maxX: 0, minZ: -1, maxZ: 0 }),
    true,
  );
});
test("route detours around a building without any diagonal corner cutting", () => {
  const nav = new Navigation(land, [
    { minX: -0.5, maxX: 0.5, minZ: -0.7, maxZ: 0.7 },
  ]);
  let previous = { x: -1.6, z: 0 };
  const route = nav.route(previous, { x: 1.6, z: 0 }, 0.23);
  assert.ok(route.some((p) => Math.abs(p.z) >= 1));
  for (const p of route) {
    assert.ok(nav.segment(previous, p, 0.23));
    previous = p;
  }
  assert.ok(Math.hypot(previous.x - 1.6, previous.z) < 0.01);
});
test("pen gate admits a villager but keeps a larger body out", () => {
  const fences = [
    { minX: -0.03, maxX: 0.03, minZ: -2.5, maxZ: -0.3 },
    { minX: -0.03, maxX: 0.03, minZ: 0.3, maxZ: 2.5 },
  ];
  const nav = new Navigation(land, fences);
  assert.equal(nav.segment({ x: -1, z: 0 }, { x: 1, z: 0 }, 0.23), true);
  assert.equal(nav.segment({ x: -1, z: 0 }, { x: 1, z: 0 }, 0.34), false);
  assert.equal(nav.grid(0.23).components.length, 1);
  assert.equal(nav.grid(0.34).components.length, 2);
});
test("expanded land joins at shared edges, never across water or a diagonal corner", () => {
  const connected = new Navigation([...land, { x: 1, z: 0 }], []);
  assert.ok(connected.segment({ x: 2, z: 0 }, { x: 3, z: 0 }, 0.23));
  assert.equal(connected.clear(2.4, 2.4, 0.23), false);
  const diagonal = new Navigation([...land, { x: 1, z: 1 }], []);
  assert.equal(diagonal.segment({ x: 2, z: 2 }, { x: 3, z: 3 }, 0.23), false);
  assert.equal(diagonal.grid(0.23).components.length, 2);
});
test("new construction changes routes and spawn positions respect existing bodies", () => {
  const before = new Navigation(land, []),
    after = new Navigation(land, [
      { minX: -0.4, maxX: 0.4, minZ: -0.6, maxZ: 0.6 },
    ]);
  assert.equal(before.segment({ x: -1, z: 0 }, { x: 1, z: 0 }, 0.23), true);
  assert.equal(after.segment({ x: -1, z: 0 }, { x: 1, z: 0 }, 0.23), false);
  const occupied = [{ x: 0, z: 0, radius: 0.3 }],
    spawn = before.nearest({ x: 0, z: 0 }, 0.23, null, occupied);
  assert.ok(Math.hypot(spawn.x, spawn.z) >= 0.53);
});
