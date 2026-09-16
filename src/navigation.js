// Small deterministic navigation grid. Actors have a real radius; no physics engine is
// needed for a decorative walking layer that must not alter the production economy.
export function intersects(x, z, r, b) {
  const dx = Math.max(b.minX - x, 0, x - b.maxX),
    dz = Math.max(b.minZ - z, 0, z - b.maxZ);
  return dx * dx + dz * dz < r * r - 1e-9;
}
export function bodyRadius(width, depth) {
  // Round up into shared size classes; rotating shoulders still clear walls.
  return Number(
    (
      Math.ceil((Math.hypot(width / 2, depth / 2) + 0.02 - 1e-9) / 0.05) * 0.05
    ).toFixed(2),
  );
}
function segmentDistanceSquared(a, b, x, z) {
  const dx = b.x - a.x,
    dz = b.z - a.z,
    length = dx * dx + dz * dz;
  const t = length
    ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / length))
    : 0;
  return (a.x + t * dx - x) ** 2 + (a.z + t * dz - z) ** 2;
}
// Grid edges already passed static terrain/building clearance. Their remaining
// moving obstacle check can be shared by both walking and delivery searches.
export function avoidsActors(a, b, radius, occupied = []) {
  return !occupied.some(p => segmentDistanceSquared(a, b, p.x, p.z) <
    (radius + p.radius + 0.035) ** 2 - 1e-9);
}
export function sweptObstacle(a, b, radius, box) {
  let enter = 0,
    exit = 1;
  for (const [start, delta, min, max] of [
    [a.x, b.x - a.x, box.minX, box.maxX],
    [a.z, b.z - a.z, box.minZ, box.maxZ],
  ]) {
    if (Math.abs(delta) < 1e-12) {
      if (start < min || start > max) {
        enter = Infinity;
        break;
      }
    } else {
      const t1 = (min - start) / delta,
        t2 = (max - start) / delta;
      enter = Math.max(enter, Math.min(t1, t2));
      exit = Math.min(exit, Math.max(t1, t2));
    }
  }
  if (enter <= exit) return true;
  if (intersects(a.x, a.z, radius, box) || intersects(b.x, b.z, radius, box))
    return true;
  return [box.minX, box.maxX].some((x) =>
    [box.minZ, box.maxZ].some(
      (z) => segmentDistanceSquared(a, b, x, z) < radius * radius - 1e-9,
    ),
  );
}
export class Navigation {
  constructor(chunks, obstacles, step = 0.25) {
    this.chunks = chunks;
    this.land = new Set(chunks.map((c) => `${c.x},${c.z}`));
    this.obstacles = obstacles;
    this.step = step;
    this.grids = new Map();
    this.clearanceOffsets = new Map();
    this.obstacleCells = new Map();
    for (const obstacle of obstacles)
      for (
        let x = Math.floor(obstacle.minX / 5);
        x <= Math.floor(obstacle.maxX / 5);
        x++
      )
        for (
          let z = Math.floor(obstacle.minZ / 5);
          z <= Math.floor(obstacle.maxZ / 5);
          z++
        ) {
          const key = `${x},${z}`;
          if (!this.obstacleCells.has(key)) this.obstacleCells.set(key, []);
          this.obstacleCells.get(key).push(obstacle);
        }
  }
  onLand(x, z) {
    return this.land.has(
      `${Math.floor((x + 2.5) / 5)},${Math.floor((z + 2.5) / 5)}`,
    );
  }
  clear(x, z, r, terrainOnly = false) {
    if (!this.clearanceOffsets.has(r))
      this.clearanceOffsets.set(
        r,
        Array.from({ length: 8 }, (_, a) => [
          Math.cos((a * Math.PI) / 4) * (r + 0.015),
          Math.sin((a * Math.PI) / 4) * (r + 0.015),
        ]),
      );
    for (const [dx, dz] of this.clearanceOffsets.get(r))
      if (!this.onLand(x + dx, z + dz)) return false;
    if (terrainOnly) return true;
    for (let bx = Math.floor((x - r) / 5); bx <= Math.floor((x + r) / 5); bx++)
      for (
        let bz = Math.floor((z - r) / 5);
        bz <= Math.floor((z + r) / 5);
        bz++
      )
        for (const obstacle of this.obstacleCells.get(`${bx},${bz}`) || [])
          if (intersects(x, z, r, obstacle)) return false;
    return true;
  }
  segment(a, b, r, occupied = []) {
    for (
      let x = Math.floor((Math.min(a.x, b.x) - r) / 5);
      x <= Math.floor((Math.max(a.x, b.x) + r) / 5);
      x++
    )
      for (
        let z = Math.floor((Math.min(a.z, b.z) - r) / 5);
        z <= Math.floor((Math.max(a.z, b.z) + r) / 5);
        z++
      )
        for (const box of this.obstacleCells.get(`${x},${z}`) || [])
          if (sweptObstacle(a, b, r, box)) return false;
    if (!avoidsActors(a, b, r, occupied)) return false;
    const steps = Math.max(
      1,
      Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.08),
    );
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      const x = a.x + (b.x - a.x) * f,
        z = a.z + (b.z - a.z) * f;
      if (!this.clear(x, z, r, true)) return false;
    }
    return true;
  }
  grid(radius) {
    if (this.grids.has(radius)) return this.grids.get(radius);
    const nodes = [],
      lookup = new Map(),
      step = this.step;
    for (const c of this.chunks)
      for (
        let ix = Math.ceil((c.x * 5 - 2.5) / step);
        ix <= Math.floor((c.x * 5 + 2.5) / step);
        ix++
      )
        for (
          let iz = Math.ceil((c.z * 5 - 2.5) / step);
          iz <= Math.floor((c.z * 5 + 2.5) / step);
          iz++
        ) {
          const key = `${ix},${iz}`;
          if (lookup.has(key)) continue;
          const x = ix * step,
            z = iz * step;
          if (!this.clear(x, z, radius)) continue;
          const node = {
            x,
            z,
            ix,
            iz,
            index: nodes.length,
            neighbors: [],
            component: -1,
          };
          lookup.set(key, node);
          nodes.push(node);
        }
    for (const a of nodes)
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]) {
        const b = lookup.get(`${a.ix + dx},${a.iz + dz}`);
        if (b && this.segment(a, b, radius)) a.neighbors.push(b.index);
      }
    const components = [];
    for (const node of nodes)
      if (node.component < 0) {
        const queue = [node.index],
          id = components.length;
        node.component = id;
        for (let i = 0; i < queue.length; i++)
          for (const next of nodes[queue[i]].neighbors)
            if (nodes[next].component < 0) {
              nodes[next].component = id;
              queue.push(next);
            }
        components.push(queue);
      }
    const buckets = new Map();
    let minBX = Infinity,
      maxBX = -Infinity,
      minBZ = Infinity,
      maxBZ = -Infinity;
    for (const node of nodes) {
      const x = Math.floor(node.x),
        z = Math.floor(node.z),
        key = `${x},${z}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(node);
      minBX = Math.min(minBX, x);
      maxBX = Math.max(maxBX, x);
      minBZ = Math.min(minBZ, z);
      maxBZ = Math.max(maxBZ, z);
    }
    const grid = { nodes, components, buckets, minBX, maxBX, minBZ, maxBZ };
    this.grids.set(radius, grid);
    return grid;
  }
  nearest(point, radius, component = null, occupied = []) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.z)) return null;
    const { nodes, buckets, minBX, maxBX, minBZ, maxBZ } = this.grid(radius);
    if (!nodes.length) return null;
    let best = null,
      distance = Infinity;
    // Search nearby cells first, but stop only when the exact distance bound
    // excludes every unvisited cell. Original node order resolves equal ties.
    const cx = Math.min(maxBX, Math.max(minBX, Math.floor(point.x))),
      cz = Math.min(maxBZ, Math.max(minBZ, Math.floor(point.z))),
      extent = Math.max(cx - minBX, maxBX - cx, cz - minBZ, maxBZ - cz);
    const visit = (x, z) => {
      for (const node of buckets.get(`${x},${z}`) || []) {
        if (component !== null && node.component !== component) continue;
        const d = (node.x - point.x) ** 2 + (node.z - point.z) ** 2;
        if (!Number.isFinite(d)) continue;
        if (
          d > distance ||
          (d === distance && best && node.index >= best.index)
        )
          continue;
        if (
          occupied.some(
            (a) =>
              Math.hypot(a.x - node.x, a.z - node.z) <
              radius + a.radius + 0.035,
          )
        )
          continue;
        distance = d;
        best = node;
      }
    };
    for (let ring = 0; ring <= extent; ring++) {
      const left = cx - ring,
        right = cx + ring,
        top = cz - ring,
        bottom = cz + ring;
      for (let x = Math.max(minBX, left); x <= Math.min(maxBX, right); x++) {
        if (top >= minBZ) visit(x, top);
        if (ring && bottom <= maxBZ) visit(x, bottom);
      }
      for (
        let z = Math.max(minBZ, top + 1);
        z <= Math.min(maxBZ, bottom - 1);
        z++
      ) {
        if (left >= minBX) visit(left, z);
        if (ring && right <= maxBX) visit(right, z);
      }
      const bound = Math.max(
        0,
        Math.min(
          left > minBX ? point.x - left : Infinity,
          right < maxBX ? right + 1 - point.x : Infinity,
          top > minBZ ? point.z - top : Infinity,
          bottom < maxBZ ? bottom + 1 - point.z : Infinity,
        ),
      );
      if (best && bound * bound > distance + 1e-12) break;
    }
    return best;
  }
  route(from, to, radius, occupied = []) {
    const { nodes } = this.grid(radius),
      start = this.nearest(from, radius);
    if (!start) return [];
    const end = this.nearest(to, radius, start.component, occupied);
    if (!end) return [];
    if (!this.segment(from, start, radius)) return [];
    const queue = [],
      parent = new Int32Array(nodes.length).fill(-1),
      cost = new Float64Array(nodes.length).fill(Infinity),
      closed = new Uint8Array(nodes.length);
    const push = (index, score) => {
      const value = { index, score };
      let at = queue.length;
      queue.push(value);
      while (at > 0) {
        const p = (at - 1) >> 1;
        if (queue[p].score <= score) break;
        queue[at] = queue[p];
        at = p;
      }
      queue[at] = value;
    };
    const pop = () => {
      const first = queue[0],
        last = queue.pop();
      if (queue.length) {
        let at = 0;
        while (at * 2 + 1 < queue.length) {
          let child = at * 2 + 1;
          if (
            child + 1 < queue.length &&
            queue[child + 1].score < queue[child].score
          )
            child++;
          if (queue[child].score >= last.score) break;
          queue[at] = queue[child];
          at = child;
        }
        queue[at] = last;
      }
      return first.index;
    };
    parent[start.index] = start.index;
    cost[start.index] = 0;
    push(start.index, 0);
    while (queue.length) {
      const index = pop(),
        node = nodes[index];
      if (closed[index]) continue;
      closed[index] = 1;
      if (index === end.index) break;
      for (const next of node.neighbors) {
        const b = nodes[next],
          candidate = cost[index] + Math.hypot(b.x - node.x, b.z - node.z);
        if (
          closed[next] ||
          candidate >= cost[next] ||
          (occupied.length && !avoidsActors(node, b, radius, occupied))
        )
          continue;
        parent[next] = index;
        cost[next] = candidate;
        push(next, candidate + Math.hypot(b.x - end.x, b.z - end.z));
      }
    }
    if (parent[end.index] < 0) return [];
    const path = [];
    for (let at = end.index; ; at = parent[at]) {
      path.push(nodes[at]);
      if (at === start.index) break;
    }
    path.reverse();
    if (this.segment(path[path.length - 1], to, radius, occupied))
      path.push({ x: to.x, z: to.z });
    // Skip redundant grid corners only when the complete swept body fits.
    const smooth = [];
    let previous = from;
    for (let i = 0; i < path.length; ) {
      let next = i;
      while (
        next + 1 < path.length &&
        this.segment(previous, path[next + 1], radius, occupied)
      )
        next++;
      smooth.push(path[next]);
      previous = path[next];
      i = next + 1;
    }
    if (
      smooth.length &&
      Math.hypot(smooth[0].x - from.x, smooth[0].z - from.z) < 0.025
    )
      smooth.shift();
    return smooth;
  }
}
