// Presentation only: the cardinal transport graph remains the source of truth
// for reachability, distance, capacity and income.
const EPS = 1e-8;
const distance = (a, b) => Math.hypot(b.x - a.x, b.z - a.z);
const same = (a, b) => distance(a, b) < EPS;
export const RAIL_HALF_GAUGE = 0.1;

function pose(part, t) {
  if (part.kind === "line") {
    return {
      x: part.a.x + (part.b.x - part.a.x) * t,
      z: part.a.z + (part.b.z - part.a.z) * t,
      heading: Math.atan2(part.b.x - part.a.x, part.b.z - part.a.z),
    };
  }
  const angle = part.angle + part.sweep * t,
    direction = Math.sign(part.sweep);
  return {
    x: part.center.x + Math.cos(angle) * part.radius,
    z: part.center.z + Math.sin(angle) * part.radius,
    heading: Math.atan2(
      -Math.sin(angle) * direction,
      Math.cos(angle) * direction,
    ),
  };
}

export function createRailPath(route, isClear = () => true) {
  const points = [];
  for (const p of route.points) {
    if (points.length && same(points.at(-1), p)) continue;
    while (points.length > 1) {
      const a = points.at(-2),
        b = points.at(-1),
        ux = b.x - a.x,
        uz = b.z - a.z,
        vx = p.x - b.x,
        vz = p.z - b.z;
      if (Math.abs(ux * vz - uz * vx) > EPS || ux * vx + uz * vz <= 0) break;
      points.pop();
    }
    points.push({ x: p.x, z: p.z });
  }
  const parts = [];
  let length = 0,
    cursor = points[0] || { x: 0, z: 0 };
  const add = (part) => {
    if (part.length < EPS) return;
    part.start = length;
    length += part.length;
    part.end = length;
    parts.push(part);
  };
  const lineTo = (p) => {
    add({ kind: "line", a: cursor, b: p, length: distance(cursor, p) });
    cursor = p;
  };
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1],
      b = points[i],
      c = points[i + 1],
      before = distance(a, b),
      after = distance(b, c),
      u = { x: (b.x - a.x) / before, z: (b.z - a.z) / before },
      v = { x: (c.x - b.x) / after, z: (c.z - b.z) / after };
    if (Math.abs(u.x * v.x + u.z * v.z) > EPS) {
      lineTo(b);
      continue;
    }
    // Half of each adjacent run prevents consecutive bends from overlapping.
    let radius = Math.min(0.35, before / 2, after / 2),
      bend = null;
    while (radius >= 0.125 - EPS) {
      const candidate = {
        kind: "arc",
        radius,
        center: {
          x: b.x - u.x * radius + v.x * radius,
          z: b.z - u.z * radius + v.z * radius,
        },
        angle: Math.atan2(-v.z, -v.x),
        sweep: (Math.sign(u.x * v.z - u.z * v.x) * Math.PI) / 2,
        length: (radius * Math.PI) / 2,
      };
      if (
        Array.from({ length: 17 }, (_, j) => pose(candidate, j / 16)).every(
          isClear,
        )
      ) {
        bend = candidate;
        break;
      }
      if (radius <= 0.125 + EPS) break;
      radius = Math.max(0.125, radius / 2);
    }
    // A blocked or degenerate turn must not cut through a building/coast.
    if (!bend) {
      lineTo(b);
      continue;
    }
    lineTo(pose(bend, 0));
    add(bend);
    cursor = pose(bend, 1);
  }
  if (points.length) lineTo(points.at(-1));
  return { parts, length, origin: points[0] || { x: 0, z: 0 } };
}

export function railPoint(path, distance) {
  if (!path.parts.length) return { ...path.origin, heading: 0 };
  const at = Math.max(0, Math.min(path.length, distance));
  let lo = 0,
    hi = path.parts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (path.parts[mid].end < at) lo = mid + 1;
    else hi = mid;
  }
  const part = path.parts[lo];
  return pose(part, Math.max(0, Math.min(1, (at - part.start) / part.length)));
}
