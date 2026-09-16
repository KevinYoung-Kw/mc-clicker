import {activeLevel} from './facility-storage.js';
import {
  buildingObstacles,
  footprint,
  scenery,
  worldScenery,
  sceneryObstacle,
  sceneryVisible,
} from "./layout.js";

export const ROUTE_STEP = 0.25;
const cache = new WeakMap();
const key = (x, z) => `${x},${z}`;
const unit = (value) => Math.round(value / ROUTE_STEP);
const world = (value) => value * ROUTE_STEP;
const inside = (p, b) =>
  p.x > b.minX - 1e-6 &&
  p.x < b.maxX + 1e-6 &&
  p.z > b.minZ - 1e-6 &&
  p.z < b.maxZ + 1e-6;
const count = activeLevel;
const REALMS = ["overworld", "nether", "end"];

// Actor-only residents and upgrades use their workplace/portal, never an
// invented obstacle. A real building always uses its physical envelope.
export function facilityAnchor(s, id, realm) {
  if (s.placements[id]?.realm === realm) return { id, ...s.placements[id] };
  if (realm === "overworld" && ["V2", "origin"].includes(id))
    return { id: "origin", x: 0, z: 0, realm, virtual: true };
  if (realm === "nether" && id === "portal" && count(s, "N1"))
    return { id: "portal", x: 0, z: 0, realm, virtual: true };
  if (realm === "end" && id === "portal" && count(s, "E2"))
    return { id: "portal", x: 0, z: 0, realm, virtual: true };
  return null;
}

function signature(s, realm) {
  return `${s.layoutRevision || 0}|${s.chunks[realm]?.length || 0}|${Object.keys(s.placements).length}|${count(s, "V2") >= 3}|${!!count(s, "V1")}`;
}

class Heap {
  a = [];
  push(v) {
    let i = this.a.length;
    this.a.push(v);
    while (i) {
      const p = (i - 1) >> 1;
      if (this.a[p].f <= v.f) break;
      this.a[i] = this.a[p];
      i = p;
    }
    this.a[i] = v;
  }
  pop() {
    const first = this.a[0],
      last = this.a.pop();
    if (this.a.length) {
      let i = 0;
      while (i * 2 + 1 < this.a.length) {
        let child = i * 2 + 1;
        if (child + 1 < this.a.length && this.a[child + 1].f < this.a[child].f)
          child++;
        if (this.a[child].f >= last.f) break;
        this.a[i] = this.a[child];
        i = child;
      }
      this.a[i] = last;
    }
    return first;
  }
}

export function routeGrid(s, realm = "overworld") {
  let entry = cache.get(s);
  if (!entry) {
    entry = { realms: {}, builds: 0 };
    cache.set(s, entry);
  }
  const sig = signature(s, realm),
    old = entry.realms[realm];
  if (
    old?.signature === sig &&
    old.placements === s.placements &&
    old.chunks === s.chunks[realm]
  )
    return old;
  const boxes = Object.entries(s.placements)
    .filter(([, p]) => p.realm === realm)
    .flatMap(([id, p]) => buildingObstacles(id, p));
  boxes.push({ minX: -0.72, maxX: 0.72, minZ: -0.72, maxZ: 0.72 });
  if (realm === "overworld" && count(s, "V1"))
    for (const p of worldScenery(s,realm)) {
      if (!sceneryVisible(s, p, realm)) continue;
      boxes.push(...sceneryObstacle(p));
    }
  const cells = new Map();
  for (const chunk of s.chunks[realm] || []) {
    for (let x = unit(chunk.x * 5 - 2.5); x <= unit(chunk.x * 5 + 2.5); x++)
      for (let z = unit(chunk.z * 5 - 2.5); z <= unit(chunk.z * 5 + 2.5); z++) {
        const p = { x: world(x), z: world(z), realm };
        if (!boxes.some((b) => inside(p, b))) cells.set(key(x, z), { x, z });
      }
  }
  const grid = {
    signature: sig,
    realm,
    cells,
    boxes,
    routes: new Map(),
    buildNumber: ++entry.builds,
    placements: s.placements,
    chunks: s.chunks[realm],
  };
  entry.realms[realm] = grid;
  return grid;
}

function entrances(grid, anchor) {
  if (!anchor) return [];
  if (anchor.virtual) {
    const around = [];
    for (let d = 0; d <= 8; d++)
      for (let dx = -d; dx <= d; dx++)
        for (const dz of new Set([d - Math.abs(dx), Math.abs(dx) - d])) {
          const x = unit(anchor.x) + dx,
            z = unit(anchor.z) + dz;
          if (grid.cells.has(key(x, z))) around.push({ x, z });
        }
    return around.slice(0, 4);
  }
  const { w, d } = footprint(anchor.id,anchor);
  return [
    { x: unit(anchor.x), z: Math.ceil((anchor.z + d / 2) / ROUTE_STEP) },
    { x: Math.ceil((anchor.x + w / 2) / ROUTE_STEP), z: unit(anchor.z) },
    { x: unit(anchor.x), z: Math.floor((anchor.z - d / 2) / ROUTE_STEP) },
    { x: Math.floor((anchor.x - w / 2) / ROUTE_STEP), z: unit(anchor.z) },
  ].filter((p) => grid.cells.has(key(p.x, p.z)));
}

// Multi-entrance A*: every segment is cardinal and stays on owned land.
export function routeBetween(s, from, to, realm = from?.realm || "overworld") {
  return routeOnGrid(routeGrid(s, realm), from, to, realm);
}

// A topology or wire query already holds a validated grid. Reuse it while
// comparing endpoints; no layout mutation occurs during this synchronous query.
function routeOnGrid(grid, from, to, realm) {
  const tag = `${from?.id}:${from?.x},${from?.z}>${to?.id}:${to?.x},${to?.z}`;
  if (grid.routes.has(tag)) return grid.routes.get(tag);
  const starts = entrances(grid, from),
    goals = entrances(grid, to),
    goalKeys = new Set(goals.map((p) => key(p.x, p.z)));
  if (!starts.length || !goals.length) {
    grid.routes.set(tag, null);
    return null;
  }
  const heuristic = (x, z) =>
    Math.min(...goals.map((g) => Math.abs(g.x - x) + Math.abs(g.z - z)));
  const heap = new Heap(),
    costs = new Map(),
    parents = new Map();
  for (const p of starts) {
    const k = key(p.x, p.z);
    costs.set(k, 0);
    heap.push({ ...p, g: 0, f: heuristic(p.x, p.z), k });
  }
  let finish = null;
  while (heap.a.length) {
    const at = heap.pop();
    if (at.g !== costs.get(at.k)) continue;
    if (goalKeys.has(at.k)) {
      finish = at.k;
      break;
    }
    for (const [dx, dz] of [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ]) {
      const x = at.x + dx,
        z = at.z + dz,
        k = key(x, z),
        g = at.g + 1;
      if (!grid.cells.has(k) || g >= (costs.get(k) ?? Infinity)) continue;
      costs.set(k, g);
      parents.set(k, at.k);
      heap.push({ x, z, k, g, f: g + heuristic(x, z) });
    }
  }
  let result = null;
  if (finish !== null) {
    const points = [];
    for (let at = finish; at !== undefined; at = parents.get(at)) {
      const p = grid.cells.get(at);
      points.push({ x: world(p.x), z: world(p.z) });
    }
    points.reverse();
    result = {
      from: from.id,
      to: to.id,
      realm,
      points,
      length: Math.max(0, points.length - 1) * ROUTE_STEP,
    };
  }
  grid.routes.set(tag, result);
  return result;
}

const STAGES = {
  overworld: [
    ["M1", "M9", "M18", "M3", "V7"],
    ["M2", "T7"],
    ["M17", "M4"],
    ["V3", "V17", "V2"],
  ],
  nether: [
    ["N7", "N8", "N3", "N5", "portal"],
    ["N4", "N11", "portal"],
    ["N12", "portal"],
    ["N2", "N12", "portal"],
  ],
  end: [
    ["E4", "E11", "portal"],
    ["E10", "E8", "portal"],
    ["E7", "E5", "portal"],
    ["E7", "E5", "portal"],
  ],
};
// Small regional queues remain the simulation contract. These edges tell each
// stage which facilities it can reach, without adding individual box micromanagement.
export function transportTopology(s, realm = "overworld") {
  const grid = routeGrid(s, realm),
    tag = `transport:${count(s, "V2") > 0}:${count(s, "N1") > 0}:${count(s, "E2") > 0}`;
  if (grid.routes.has(tag)) return grid.routes.get(tag);
  const stages = STAGES[realm].map((ids) =>
    ids.map((id) => facilityAnchor(s, id, realm)).filter(Boolean),
  );
  if (
    realm === "overworld" &&
    stages[3].some((p) => p.id === "V3" || p.id === "V17")
  )
    stages[3] = stages[3].filter((p) => p.id !== "origin");
  // Before warehouses, each worksite buffers its own output.
  if (!stages[2].length) stages[2] = stages[1];
  const edges = [];
  for (let stage = 0; stage < 3; stage++)
    for (const from of stages[stage]) {
      const targets = stages[stage + 1].filter((to) => to.id !== from.id);
      if (stages[stage + 1].some((to) => to.id === from.id)) continue;
      const candidates = targets
        .map((to) => routeOnGrid(grid, from, to, realm))
        .filter(Boolean)
        .sort((a, b) => a.length - b.length);
      if (candidates[0])
        edges.push({
          ...candidates[0],
          stage: ["raw", "processed", "delivery"][stage],
          id: `${realm}:${stage}:${from.id}>${candidates[0].to}`,
        });
    }
  const result = {
    realm,
    edges,
    stages: stages.map((a) => a.map((p) => p.id)),
    length: edges.reduce((sum, e) => sum + e.length, 0),
    meanLength: edges.length
      ? edges.reduce((sum, e) => sum + e.length, 0) / edges.length
      : 0,
  };
  grid.routes.set(tag, result);
  return result;
}

export function wireRoute(s, id) {
  const p = s.placements[id];
  if (!p) return null;
  const realm = p.realm,
    froms =
      realm === "overworld"
        ? ["M5", "M6", "M7", "M15"]
        : ["portal", ...(realm === "nether" ? ["N4"] : ["E8"])];
  const origins = froms
    .filter((source) => source !== id)
    .map((source) => facilityAnchor(s, source, realm))
    .filter(Boolean);
  if (!origins.length) return null;
  const to = { id, ...p }, grid = routeGrid(s, realm);
  const candidates = origins
    .map((from) => routeOnGrid(grid, from, to, realm))
    .filter(Boolean)
    .sort((a, b) => a.length - b.length);
  return candidates[0] || null;
}

export function routePoint(route, distance) {
  if (!route?.points.length) return { x: 0, z: 0 };
  const n = Math.min(
      route.points.length - 1,
      Math.max(0, distance / ROUTE_STEP),
    ),
    i = Math.floor(n),
    a = route.points[i],
    b = route.points[Math.min(i + 1, route.points.length - 1)],
    f = n - i;
  return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f };
}

export function clearRouteCache(s) {
  cache.delete(s);
}
export function routingStats(s) {
  const c = cache.get(s);
  return { builds: c?.builds || 0, realms: REALMS.filter((r) => c?.realms[r]) };
}
