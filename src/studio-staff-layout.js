import { STUDIO, STUDIO_ANCHORS as A } from "./studio-layout.js";
import { studioEntities, studioSpec } from "./studio-placement.js";

const radius = 0.36;
const fixed = [
  { x: A.desk.x, z: A.desk.z, w: 1.64, d: 0.75 },
  { x: A.host.x, z: A.host.z, w: 0.75, d: 1 },
  { x: -2.68, z: -0.31, w: 0.38, d: 1.92 },
];

// Staff use free floor beside their real equipment. Positions are presentation
// only: they never change ownership, work progress or the outdoor simulation.
export function studioStaffPlaces(s, people) {
  const obstacles = [...fixed];
  for (const e of studioEntities(s)) {
    if (e.layer !== "floor") continue;
    const p = e.position;
    obstacles.push({
      x: p.x,
      z: p.z,
      w: p.rotation % 2 ? e.d : e.w,
      d: p.rotation % 2 ? e.w : e.d,
    });
  }
  const result = new Map();
  for (const r of people) {
    if (r.job === "host") {
      result.set(r.id, {
        x: A.host.x - 0.035,
        y: STUDIO.floorY + 0.06,
        z: A.host.z + 0.06,
        yaw: 0,
      });
      continue;
    }
    const target = s.studio?.placements.L1 || studioSpec("L1").default;
    let best = null;
    let distance = Infinity;
    for (let x = -2.5; x <= 2.5; x += 0.25) {
      for (let z = -2; z <= 2; z += 0.25) {
        if (
          obstacles.some(
            (b) =>
              Math.abs(x - b.x) < b.w / 2 + radius &&
              Math.abs(z - b.z) < b.d / 2 + radius,
          )
        )
          continue;
        const d = Math.hypot(x - target.x, z - target.z);
        // Prefer the listener-facing side on ties, independent of frame timing.
        const score = d + (z < target.z ? 0.05 : 0);
        if (score < distance) {
          distance = score;
          best = {
            x,
            y: STUDIO.floorY,
            z,
            yaw: Math.atan2(target.x - x, target.z - z),
          };
        }
      }
    }
    if (best) {
      result.set(r.id, best);
      obstacles.push({ ...best, w: radius * 2, d: radius * 2 });
    }
  }
  return result;
}
