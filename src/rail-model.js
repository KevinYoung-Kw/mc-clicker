import { box } from "./models.js";
import { RAIL_HALF_GAUGE, railPoint } from "./rail-path.js";

const round = (n) => Math.round(n * 1e6) / 1e6;
const pointKey = (p) => `${round(p.x)},${round(p.z)}`;

export function drawRailTracks(parent, paths) {
  const lines = new Map(),
    curves = new Map(),
    ties = new Map();
  for (const path of paths)
    for (const part of path.parts) {
      if (part.kind === "arc") {
        const start = railPoint({ ...path, parts: [part] }, part.start),
          end = railPoint({ ...path, parts: [part] }, part.end),
          key = `${pointKey(part.center)}:${[pointKey(start), pointKey(end)].sort().join(":")}`;
        curves.set(key, part);
      } else {
        const horizontal = Math.abs(part.a.x - part.b.x) > 1e-8,
          fixed = horizontal ? part.a.z : part.a.x,
          key = `${horizontal}:${round(fixed)}`,
          axis = horizontal ? "x" : "z";
        if (!lines.has(key))
          lines.set(key, { horizontal, fixed, intervals: [] });
        lines
          .get(key)
          .intervals.push([
            Math.min(part.a[axis], part.b[axis]),
            Math.max(part.a[axis], part.b[axis]),
          ]);
      }
    }
  const sleeper = (p) => {
    const angle = ((p.heading % Math.PI) + Math.PI) % Math.PI,
      key = `${pointKey(p)}:${round(angle)}`;
    if (ties.has(key)) return;
    // Curved and straight approaches share the same junction sleepers.
    if ([...ties.values()].some(q=>Math.hypot(p.x-q.x,p.z-q.z)<.19)) return;
    ties.set(key,p);
    const m = box(parent, "#958972", p.x, 0.187, p.z, 0.32, 0.024, 0.075);
    m.rotation.y = p.heading;
    m.name = "rail-sleeper";
  };
  const rail = (a, b, curved = false) => {
    const m = box(
      parent,
      "#929d94",
      (a.x + b.x) / 2,
      0.213,
      (a.z + b.z) / 2,
      0.034,
      0.036,
      Math.hypot(b.x - a.x, b.z - a.z) + (curved ? 0.008 : 0.002),
    );
    m.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
    m.name = curved ? "rail-bend" : "rail-straight";
  };
  for (const { horizontal, fixed, intervals } of lines.values()) {
    intervals.sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const [start, end] of intervals) {
      if (merged.length && start <= merged.at(-1)[1] + 1e-8)
        merged.at(-1)[1] = Math.max(end, merged.at(-1)[1]);
      else merged.push([start, end]);
    }
    const at = (along, offset = 0) =>
      horizontal
        ? { x: along, z: fixed + offset }
        : { x: fixed + offset, z: along };
    for (const [start, end] of merged) {
      for (const offset of [-RAIL_HALF_GAUGE, RAIL_HALF_GAUGE])
        rail(at(start, offset), at(end, offset));
      // Fixed world spacing also keeps shared routes from duplicating sleepers.
      let count = 0;
      for (
        let p = Math.ceil((start - 0.2) / 0.4) * 0.4 + 0.2;
        p <= end;
        p += 0.4
      ) {
        if (p < start) continue;
        sleeper({ ...at(p), heading: horizontal ? Math.PI / 2 : 0 });
        count++;
      }
      if (!count && end - start > 0.1)
        sleeper({
          ...at((start + end) / 2),
          heading: horizontal ? Math.PI / 2 : 0,
        });
    }
  }
  for (const part of curves.values()) {
    // Short box segments retain the block art style while describing a bend.
    const segments = 8;
    for (const offset of [-RAIL_HALF_GAUGE, RAIL_HALF_GAUGE]) {
      const radius = part.radius + offset;
      const at = (i) => {
        const angle = part.angle + (part.sweep * i) / segments;
        return {
          x: part.center.x + Math.cos(angle) * radius,
          z: part.center.z + Math.sin(angle) * radius,
        };
      };
      for (let i = 0; i < segments; i++) rail(at(i), at(i + 1), true);
    }
    const path = { parts: [part], length: part.end };
    const count = Math.max(1, Math.ceil(part.length / 0.4));
    for (let i = 0; i < count; i++)
      sleeper(railPoint(path, part.start + (part.length * (i + 0.5)) / count));
  }
}
