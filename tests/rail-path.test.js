import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  createRailPath,
  railPoint,
  RAIL_HALF_GAUGE,
} from "../src/rail-path.js";
import { drawRailTracks } from "../src/rail-model.js";
import { fresh } from "../src/game.js";
import { transportTopology, routeGrid } from "../src/routing.js";
import { World } from "../src/world.js";
import { WAGON_GAP } from '../src/rail-traffic.js';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
const samePoint = (a, b) => {
  near(a.x, b.x);
  near(a.z, b.z);
};
const angleDifference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const route = (points) => ({
  points: points.map(([x, z]) => ({ x, z })),
  length: 2,
});

test("all eight directed corners have connected quarter bends and continuous cart headings", () => {
  for (const [ux, uz] of [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ])
    for (const turn of [-1, 1]) {
      const vx = -uz * turn,
        vz = ux * turn;
      const input = route([
          [-ux, -uz],
          [0, 0],
          [vx, vz],
        ]),
        before = structuredClone(input),
        path = createRailPath(input);
      assert.equal(path.parts.filter((p) => p.kind === "arc").length, 1);
      samePoint(railPoint(path, 0), input.points[0]);
      samePoint(railPoint(path, path.length), input.points.at(-1));
      near(path.length, 2 - 0.7 + (0.35 * Math.PI) / 2);
      for (let i = 1; i < path.parts.length; i++) {
        const boundary = path.parts[i].start;
        const a = railPoint(path, boundary - 1e-8),
          b = railPoint(path, boundary + 1e-8);
        samePoint(a, b);
        assert.ok(Math.abs(angleDifference(a.heading, b.heading)) < 1e-6);
      }
      const bend = path.parts.find((p) => p.kind === "arc"),
        middle = railPoint(path, bend.start + bend.length / 2);
      assert.ok(
        Math.abs(middle.x) > 0.01 && Math.abs(middle.z) > 0.01,
        "cart cuts the bend instead of snapping through the old square corner",
      );
      assert.deepEqual(
        input,
        before,
        "visual smoothing must not rewrite simulation distances or points",
      );
    }
});

test("adjacent quarter-cell turns fit without overlapping; degenerate paths stay finite", () => {
  const input = route([
      [0, 0],
      [0.25, 0],
      [0.25, 0.25],
      [0.5, 0.25],
      [0.5, 0.5],
    ]),
    path = createRailPath(input);
  assert.equal(path.parts.filter((p) => p.kind === "arc").length, 3);
  for (const part of path.parts) {
    assert.ok(part.length > 0);
    if (part.kind === "arc") assert.ok(part.radius > RAIL_HALF_GAUGE + 0.02);
  }
  for (let i = 0; i <= 100; i++) {
    const p = railPoint(path, (path.length * i) / 100);
    assert.ok(
      p.x >= -1e-8 && p.x <= 0.5 + 1e-8 && p.z >= -1e-8 && p.z <= 0.5 + 1e-8,
    );
  }
  for (const points of [
    [],
    [[2, 3]],
    [
      [2, 3],
      [2, 3],
    ],
    [
      [0, 0],
      [1, 0],
      [0, 0],
    ],
  ]) {
    const p = railPoint(createRailPath(route(points)), 100);
    assert.ok(Number.isFinite(p.x + p.z + p.heading));
  }
});

test("corner radius respects obstacles instead of blindly cutting the route", () => {
  const input = route([
      [-1, 0],
      [0, 0],
      [0, 1],
    ]),
    clear = (p) => !(p.x < -0.08 && p.z > 0.08),
    path = createRailPath(input, clear),
    bend = path.parts.find((p) => p.kind === "arc");
  assert.ok(bend && bend.radius < 0.35);
  for (let i = 0; i <= 100; i++)
    assert.ok(clear(railPoint(path, (path.length * i) / 100)));
});

test("overlapping and reversed routes share rail meshes and keep curved sleepers", () => {
  const input = route([
      [-1, 0],
      [0, 0],
      [0, 1],
    ]),
    path = createRailPath(input),
    reverse = createRailPath({ ...input, points: input.points.toReversed() }),
    one = new T.Group(),
    repeated = new T.Group();
  drawRailTracks(one, [path]);
  drawRailTracks(repeated, [path, path, reverse]);
  assert.equal(one.children.length, repeated.children.length);
  assert.equal(one.children.filter((m) => m.name === "rail-bend").length, 16);
  assert.ok(
    one.children.some(
      (m) =>
        m.name === "rail-sleeper" && Math.abs(Math.sin(2 * m.rotation.y)) > 0.1,
    ),
  );
  assert.equal(
    new Set(one.children.map((m) => m.geometry)).size,
    1,
    "all segments share the existing batchable box geometry",
  );
  const straight = new T.Group();
  drawRailTracks(straight, [
    createRailPath(
      route([
        [0, 0],
        [2, 0],
      ]),
    ),
    createRailPath(
      route([
        [1, 0],
        [3, 0],
      ]),
    ),
  ]);
  assert.equal(
    straight.children.filter((m) => m.name === "rail-straight").length,
    2,
    "merge partial overlaps, not just equal endpoints",
  );
});

test("different bends with the same endpoints keep both physical tracks", () => {
  const root = new T.Group();
  drawRailTracks(root, [
    createRailPath(
      route([
        [-0.5, 0],
        [0, 0],
        [0, 0.5],
      ]),
    ),
    createRailPath(
      route([
        [-0.25, -0.25],
        [-0.25, 0.25],
        [0.25, 0.25],
      ]),
    ),
  ]);
  assert.equal(root.children.filter((m) => m.name === "rail-bend").length, 32);
});

test("World uses the visible curve for carts and trailers without changing transport data", () => {
  const s = fresh(0);
  s.chunks.overworld = [
    { x: 0, z: 0 },
    { x: 1, z: 0 },
    { x: 2, z: 0 },
  ];
  s.counts = { V2: 1, M1: 1, M2: 1, M4: 1, V3: 1, M16: 1 };
  s.placements = {
    M1: { x: -1, z: 0, realm: "overworld" },
    M2: { x: 4, z: 0, realm: "overworld" },
    M4: { x: 6, z: 0, realm: "overworld" },
    V3: { x: 9, z: 0, realm: "overworld" },
  };
  s.upgrades.levels["rail-wagons"] = 1;
  const grid = routeGrid(s),
    topology = transportTopology(s),
    before = JSON.stringify(topology),
    clear = (p) =>
      !grid.boxes.some(
        (b) => p.x > b.minX && p.x < b.maxX && p.z > b.minZ && p.z < b.maxZ,
      ),
    first = topology.edges[0],
    path = createRailPath(first, clear),
    bend = path.parts.find((p) => p.kind === "arc");
  assert.ok(bend);
  const phase = (bend.start + bend.length / 2) / path.length;
  s.transport = {
    edges: { [first.id]: { total: phase * 24, quantity: 1, at: 0 } },
  };
  const w = Object.assign(Object.create(World.prototype), {
    state: s,
    view: "overworld",
    graph: new T.Group(),
    animations: [],
  });
  w.routes();
  w.animations[0]();
  const train = w.railTraffic.trains.find(t=>t.id===first.id);
  // A real shipment starts a representative train; advance its visual clock
  // onto the bend rather than teleporting according to cumulative income.
  const travelTime=phase*path.length/w.railTraffic.speed;
  for(let t=.05;t<travelTime;t+=.05){s.play=t;w.animations[0]();}
  s.play=travelTime;w.animations[0]();
  const [cart, trailer] = w.graph.children.filter(
    (o) => o.isGroup && o.userData.dynamic,
  );
  const expected = railPoint(path, phase * path.length);
  samePoint(cart.position, expected);
  near(cart.rotation.y, expected.heading);
  samePoint(
    trailer.position,
    railPoint(path, Math.max(0, train.distance - WAGON_GAP)),
  );
  assert.equal(JSON.stringify(transportTopology(s)), before);
});
