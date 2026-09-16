import test from "node:test";
import assert from "node:assert/strict";
import { Navigation, intersects } from "../src/navigation.js";

function bruteNearest(nav, point, radius, component, occupied) {
  let best = null,
    distance = Infinity;
  for (const node of nav.grid(radius).nodes) {
    if (component !== null && node.component !== component) continue;
    if (
      occupied.some(
        (a) =>
          Math.hypot(a.x - node.x, a.z - node.z) < radius + a.radius + 0.035,
      )
    )
      continue;
    const d = (node.x - point.x) ** 2 + (node.z - point.z) ** 2;
    if (d < distance) {
      best = node;
      distance = d;
    }
  }
  return best;
}
const chunks = [
  { x: 0, z: 0 },
  { x: 1, z: 0 },
  { x: -1, z: 0 },
  { x: 0, z: 1 },
  { x: 0, z: -1 },
  { x: 3, z: -2 },
];
const obstacles = [
  { minX: -0.02, maxX: 0.02, minZ: -2.5, maxZ: 2.5 },
  { minX: 4.3, maxX: 5.7, minZ: -0.8, maxZ: 0.8 },
  { minX: -5.4, maxX: -4.5, minZ: 0.2, maxZ: 1.8 },
];
test("spatial nearest search returns the same exact node and tie order as exhaustive search", () => {
  const nav = new Navigation(chunks, obstacles);
  let seed = 137;
  const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  for (const radius of [0.22, 0.3, 0.4]) {
    const occupied = Array.from({ length: 18 }, () => ({
      x: random() * 14 - 7,
      z: random() * 14 - 7,
      radius: 0.285,
    }));
    const points = [
      { x: 0, z: 0 },
      { x: 0.1, z: 0.1 },
      { x: 100000, z: -100000 },
      { x: -4, z: 5 },
      ...Array.from({ length: 200 }, () => ({
        x: random() * 28 - 9,
        z: random() * 22 - 14,
      })),
    ];
    for (const point of points)
      for (const component of [null, 0, 1, 999])
        assert.equal(
          nav.nearest(point, radius, component, occupied),
          bruteNearest(nav, point, radius, component, occupied),
          JSON.stringify({ point, radius, component }),
        );
  }
  assert.equal(nav.nearest({ x: NaN, z: 1 }, 0.22), null);
  assert.equal(new Navigation([], []).nearest({ x: 0, z: 0 }, 0.22), null);
});
test("indexed wall checks preserve the full terrain-edge and obstacle collision rules", () => {
  const nav = new Navigation(chunks, obstacles);
  for (const radius of [0.22, 0.3, 0.54, 2.6])
    for (let x = -7.6; x <= 17.6; x += 0.37)
      for (let z = -12.6; z <= 7.6; z += 0.41) {
        let clear = true;
        for (let a = 0; a < 8; a++)
          if (
            !nav.onLand(
              x + Math.cos((a * Math.PI) / 4) * (radius + 0.015),
              z + Math.sin((a * Math.PI) / 4) * (radius + 0.015),
            )
          )
            clear = false;
        clear &&= !obstacles.some((b) => intersects(x, z, radius, b));
        assert.equal(nav.clear(x, z, radius), clear);
      }
});
