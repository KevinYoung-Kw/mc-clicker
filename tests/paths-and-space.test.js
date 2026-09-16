import test from "node:test";
import assert from "node:assert/strict";
import { Navigation, bodyRadius, sweptObstacle } from "../src/navigation.js";
import {
  footprint,
  canPlace,
  buildingObstacle,
  sceneryVisible,
} from "../src/layout.js";
import { fresh } from "../src/game.js";

test("half-grid lamp placement takes half a square, with shared pedestrian clearance", () => {
  const s = fresh();
  assert.deepEqual(footprint("M19"), { w: 0.5, d: 0.5 });
  s.placements.M19 = { x: -1.5, z: -1.5, realm: "overworld" };
  assert.ok(canPlace(s, "M20", { x: -0.5, z: -1.5, realm: "overworld" }));
  assert.equal(
    canPlace(s, "M20", { x: -1, z: -1.5, realm: "overworld" }),
    false,
  );
});
test("mine-side half-square passage stays connected on the construction-aligned grid", () => {
  const obstacles = [
    buildingObstacle("M1", { x: -1.25, z: 0 }),
    buildingObstacle("M1", { x: 1.25, z: 0 }),
  ];
  const nav = new Navigation([{ x: 0, z: 0 }], obstacles);
  assert.ok(nav.route({ x: 0, z: -1.8 }, { x: 0, z: 1.8 }, 0.22).length);
  assert.ok(nav.segment({ x: 0, z: -1.8 }, { x: 0, z: 1.8 }, 0.22));
  assert.equal(nav.segment({ x: 0, z: -1.8 }, { x: 0, z: 1.8 }, 0.4), false);
});
test("continuous corner collision catches the contact missed between sampled points", () => {
  const box = { minX: -0.72, maxX: 0.72, minZ: -0.72, maxZ: 0.72 };
  const a = { x: -0.75, z: 1 },
    b = { x: -1, z: 0.75 };
  assert.equal(sweptObstacle(a, b, 0.22, box), true);
  assert.equal(
    new Navigation([{ x: 0, z: 0 }], [box]).segment(a, b, 0.22),
    false,
  );
});
test("body-size classes route large creatures around a narrow gate instead of squeezing through", () => {
  const nav = new Navigation(
    [{ x: 0, z: 0 }],
    [
      { minX: -0.1, maxX: 0.1, minZ: -1.25, maxZ: -0.3 },
      { minX: -0.1, maxX: 0.1, minZ: 0.3, maxZ: 1.25 },
    ],
  );
  const from = { x: -1.5, z: 0 },
    to = { x: 1.5, z: 0 },
    radius = bodyRadius(0.7, 0.4);
  assert.ok(radius >= 0.4);
  assert.ok(nav.segment(from, to, 0.22));
  assert.equal(nav.segment(from, to, radius), false);
  let previous = from;
  const route = nav.route(from, to, radius);
  assert.ok(route.some((p) => Math.abs(p.z) > 1.25));
  for (const point of route) {
    assert.ok(nav.segment(previous, point, radius));
    previous = point;
  }
  assert.ok(Math.hypot(previous.x - to.x, previous.z - to.z) < 0.01);
});
test("dynamic bodies cause a safe detour and scenery never consumes a building's shared walkway", () => {
  const nav = new Navigation([{ x: 0, z: 0 }], []),
    occupied = [{ x: 0, z: 0, radius: 0.4 }];
  let previous = { x: -1.5, z: 0 };
  const route = nav.route(previous, { x: 1.5, z: 0 }, 0.3, occupied);
  assert.ok(route.some((p) => Math.abs(p.z) > 0.7));
  for (const point of route) {
    assert.ok(nav.segment(previous, point, 0.3, occupied));
    previous = point;
  }
  const s = fresh();
  s.counts.V2 = 3;
  s.placements.M1 = { x: 0, z: 0, realm: "overworld" };
  assert.equal(
    sceneryVisible(s, { x: 1.7, z: 0, w: 1, d: 1, kind: "house" }),
    false,
  );
});
