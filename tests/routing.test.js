import test from "node:test";
import assert from "node:assert/strict";
import { fresh } from "../src/game.js";
import {
  routeBetween,
  routeGrid,
  transportTopology,
  routePoint,
  wireRoute,
  routingStats,
} from "../src/routing.js";
import { buildingObstacles, onLand } from "../src/layout.js";
function layout() {
  const s = fresh(0);
  s.chunks.overworld = [
    { x: 0, z: 0 },
    { x: 1, z: 0 },
    { x: 2, z: 0 },
  ];
  s.counts = { V2: 1, M1: 1, M2: 1, M4: 1, V3: 1, M5: 1, M6: 1 };
  s.placements = {
    M1: { x: -1, z: 0, realm: "overworld" },
    M2: { x: 4, z: 0, realm: "overworld" },
    M4: { x: 6, z: 0, realm: "overworld" },
    V3: { x: 9, z: 0, realm: "overworld" },
    M5: { x: 0, z: 1.5, realm: "overworld" },
    M6: { x: 1, z: 1.5, realm: "overworld" },
  };
  return s;
}
test("routes are cardinal, on land, and outside every building envelope", () => {
  const s = layout();
  s.placements.L2 = { x: 1.5, z: 0, realm: "overworld" };
  const route = wireRoute(s, "M2");
  assert.ok(route);
  const boxes = Object.entries(s.placements).flatMap(([id, p]) =>
    buildingObstacles(id, p),
  );
  for (const [i, p] of route.points.entries()) {
    assert.ok(onLand(s, { ...p, realm: "overworld" }));
    assert.ok(
      !boxes.some(
        (b) => p.x > b.minX && p.x < b.maxX && p.z > b.minZ && p.z < b.maxZ,
      ),
    );
    if (i) {
      const before = route.points[i - 1];
      assert.equal(Math.abs(p.x - before.x) + Math.abs(p.z - before.z), 0.25);
    }
  }
  assert.deepEqual(routePoint(route, route.length), route.points.at(-1));
});
test("production graph follows stages, does not connect decorative nodes", () => {
  const s = layout(),
    g = transportTopology(s);
  assert.ok(g.edges.find((e) => e.from === "M1" && e.to === "M2"));
  assert.ok(g.edges.find((e) => e.from === "M2" && e.to === "M4"));
  assert.ok(g.edges.find((e) => e.from === "M4" && e.to === "V3"));
  s.placements.X7 = { x: 11, z: -1.5, realm: "overworld" };
  const after = transportTopology(s);
  assert.equal(after.length, g.length);
  assert.ok(
    after.edges.every((e) => !e.from.startsWith("X") && !e.to.startsWith("X")),
  );
});
test("cache stays stable through money/time/stock ticks, invalidates on position changes", () => {
  const s = layout(),
    before = routeGrid(s);
  for (let i = 0; i < 100; i++) {
    s.money++;
    s.play++;
    s.buffers.overworld.raw++;
    assert.equal(routeGrid(s), before);
  }
  assert.equal(routingStats(s).builds, 1);
  s.placements.M2.x += 0.5;
  s.layoutRevision++;
  assert.notEqual(routeGrid(s), before);
  assert.equal(routingStats(s).builds, 2);
  assert.notEqual(routeGrid(structuredClone(s)), routeGrid(s));
});
test("disconnected land is not bridged or cut diagonally", () => {
  const s = layout();
  s.chunks.overworld = [
    { x: 0, z: 0 },
    { x: 2, z: 0 },
  ];
  assert.equal(
    routeBetween(
      s,
      { id: "M1", ...s.placements.M1 },
      { id: "V3", ...s.placements.V3 },
    ),
    null,
  );
});
test("virtual portal uses an unoccupied entrance and cache includes dimension access", () => {
  const s = fresh(0);
  s.placements.N4 = { x: 0, z: 0, realm: "nether" };
  const before = transportTopology(s, "nether");
  s.counts.N1 = 1;
  const after = transportTopology(s, "nether");
  assert.notEqual(after, before);
  assert.ok(wireRoute(s, "N4"));
});

// A lone source has no candidate route; don't build a whole navigation grid.
test("wire queries without another source preserve lazy grid construction", () => {
  const s=fresh(0);
  s.placements.M5={x:0,z:1.5,realm:"overworld"};
  assert.equal(wireRoute(s,"M5"),null);
  assert.equal(routingStats(s).builds,0);
});
