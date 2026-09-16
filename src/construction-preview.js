import * as T from "three";
import { ITEMS } from "./catalog.js";
import { footprint, MODEL_INSET, overlaps, onLand, landChecker } from "./layout.js";
import { makeObject, makeActor } from "./objects.js";

export const OUTDOOR_ACTORS = new Set([
  "N3",
  "N5",
  "N6",
  "N8",
  "N9",
  "E3",
  "E5",
  "E9",
]);
const flying = new Set(["N6", "N9", "E9"]);

// Both finished buildings and previews use this fitting rule.
export function fitOutdoorModel(anchor, id, state, starter = false) {
  if (flying.has(id)) return;
  anchor.updateMatrixWorld(true);
  const bounds = new T.Box3().setFromObject(anchor);
  const size = bounds.getSize(new T.Vector3()),
    f = footprint(id);
  const fit = Math.min(
    (f.w - MODEL_INSET * 2) / Math.max(0.01, size.x),
    (f.d - MODEL_INSET * 2) / Math.max(0.01, size.z),
  );
  anchor.scale.setScalar(
    fit *
      (["L2", "X2", "V20"].includes(id)
        ? 1
        : Math.min(1, 0.9 + ((state.counts[id] || 1) - 1) * 0.012)),
  );
  anchor.updateMatrixWorld(true);
  const floor = new T.Box3().setFromObject(anchor).min.y;
  anchor.position.y = (starter ? 0.085 : 0.16) - floor;
  anchor.rotation.y=(state.placements?.[id]?.rotation||0)*Math.PI/2;
  Object.assign(anchor.userData, {
    footprint:footprint(id,state.placements?.[id]),
    groundY: anchor.position.y,
    baseMinY: floor / anchor.scale.y,
    nominalScale: anchor.scale.y,
  });
}

export function outdoorPreview(state, id, moving = false, starter = false, rotation = 0) {
  // Model helpers may initialise their subsystem. Previewing must not deliver mail,
  // unlock effects or change any part of the player's live save.
  const presentation = structuredClone(state);
  presentation.counts[id] = moving ? state.counts[id] : 1;
  presentation.placements[id]={...presentation.placements[id],rotation};
  const root = new T.Group(),
    animations = [];
  if (OUTDOOR_ACTORS.has(id)) makeActor(root, id, animations, 0, presentation);
  else makeObject(root, ITEMS[id], presentation, animations);
  fitOutdoorModel(root, id, presentation, starter);
  const clones = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = o.receiveShadow = false;
    const ghost = (source) => {
      if (!clones.has(source)) {
        const material = source.clone();
        material.transparent = true;
        material.opacity = PLACEMENT_STYLE.ghostOpacity;
        material.userData.previewColor = source.color?.clone();
        material.depthWrite = false;
        material.polygonOffset = true;
        material.polygonOffsetFactor = -1;
        material.polygonOffsetUnits = -1;
        clones.set(source, material);
      }
      return clones.get(source);
    };
    o.material = Array.isArray(o.material)
      ? o.material.map(ghost)
      : ghost(o.material);
  });
  root.userData.outdoorPreview = id;
  root.userData.previewTop = new T.Box3().setFromObject(root).max.y;
  return {
    root,
    setValid(valid) {
      for (const m of clones.values()) {
        m.depthTest = valid;
        if (m.userData.previewColor)
          m.color
            .copy(m.userData.previewColor)
            .lerp(new T.Color(PLACEMENT_STYLE.invalid), valid ? 0 : 0.65);
      }
    },
    dispose() {
      root.removeFromParent();
      for (const m of clones.values()) m.dispose();
    },
  };
}

// A single translucent surface, with only its outside edge visible.
export const PLACEMENT_STYLE = Object.freeze({
  available: "#7da761",
  valid: "#527b3d",
  invalid: "#be6b58",
  areaOpacity: 0.32,
  ghostOpacity: 0.48,
});

// A wider touch surface snaps to a real legal site. Buildings keep their existing
// footprint and clearance; the larger affordance never grants extra build space.
export function outdoorPlacementArea(state, sites, ignore = null) {
  const cells = new Map(),
    step = 0.25, contains=landChecker(state,sites[0]?.realm);
  const obstacles = [
    { x: 0, z: 0, w: 1.45, d: 1.45 },
    ...Object.entries(state.placements)
      .filter(([id, p]) => id !== ignore && p.realm === sites[0]?.realm)
      .map(([id, p]) => ({ ...p, ...footprint(id,p) })),
  ];
  for (const site of sites)
    for (const dx of [-step, 0, step])
      for (const dz of [-step, 0, step]) {
        const cell = {
          x: site.x + dx,
          z: site.z + dz,
          realm: site.realm,
          w: step,
          d: step,
        };
        if (!contains(cell) || obstacles.some((o) => overlaps(cell, o, 0)))
          continue;
        const key = `${Math.round(cell.x / step)},${Math.round(cell.z / step)}`;
        if (!cells.has(key)) cells.set(key, { point: cell, sites: [] });
        cells.get(key).sites.push(site);
      }
  return {
    sites: [...cells.values()].map((c) => c.point),
    step,
    siteAt(point) {
      const candidates = cells.get(
        `${Math.round(point.x / step)},${Math.round(point.z / step)}`,
      )?.sites;
      return (
        candidates?.reduce((best, p) =>
          Math.hypot(p.x - point.x, p.z - point.z) <
          Math.hypot(best.x - point.x, best.z - point.z)
            ? p
            : best,
        ) || null
      );
    },
  };
}
export function placementSurface(
  sites,
  { step = 0.5, y = 0.19, wall = false, height = 0.35 } = {},
) {
  const root = new T.Group(),
    positions = [],
    edges = [];
  const cells = new Set(
    sites.map((p) => Math.round(p.x / step) + "," + Math.round(p.z / step)),
  );
  const keys = [...cells].map((k) => k.split(",").map(Number));
  const vertex = (x, z) =>
    wall ? [x, y + z, sites[0]?.z + 0.015 || 0] : [x, y, z];
  const quad = (a, b, c, d) =>
    positions.push(...a, ...b, ...c, ...a, ...c, ...d);
  if (wall) {
    // Wall fixtures use a continuous mounting strip at their real height.
    const xs = [...new Set(sites.map((p) => Math.round(p.x / step)))];
    for (const x of xs) {
      const l = (x - 0.5) * step,
        r = (x + 0.5) * step;
      const a = vertex(l, -height / 2),
        b = vertex(r, -height / 2),
        c = vertex(r, height / 2),
        d = vertex(l, height / 2);
      quad(a, b, c, d);
      edges.push(...a, ...b, ...d, ...c);
      if (!xs.includes(x - 1)) edges.push(...a, ...d);
      if (!xs.includes(x + 1)) edges.push(...b, ...c);
    }
  } else
    for (const [x, z] of keys) {
      const l = (x - 0.5) * step,
        r = (x + 0.5) * step,
        t = (z - 0.5) * step,
        b = (z + 0.5) * step;
      const a = vertex(l, t),
        c = vertex(r, t),
        d = vertex(r, b),
        e = vertex(l, b);
      quad(a, c, d, e);
      if (!cells.has(x - 1 + "," + z)) edges.push(...a, ...e);
      if (!cells.has(x + 1 + "," + z)) edges.push(...c, ...d);
      if (!cells.has(x + "," + (z - 1))) edges.push(...a, ...c);
      if (!cells.has(x + "," + (z + 1))) edges.push(...e, ...d);
    }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  const material = new T.MeshBasicMaterial({
    color: PLACEMENT_STYLE.available,
    transparent: true,
    opacity: PLACEMENT_STYLE.areaOpacity,
    side: T.DoubleSide,
    depthWrite: false,
  });
  const fill = new T.Mesh(geometry, material);
  fill.renderOrder = 1;
  root.add(fill);
  const edgeGeometry = new T.BufferGeometry();
  edgeGeometry.setAttribute("position", new T.Float32BufferAttribute(edges, 3));
  const edgeMaterial = new T.LineBasicMaterial({
    color: PLACEMENT_STYLE.valid,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  root.add(new T.LineSegments(edgeGeometry, edgeMaterial));
  root.userData.placementSurface = true;
  return {
    root,
    fill,
    pulse(time, reducedMotion = false) {
      if (!root.visible) return;
      const strength = reducedMotion
        ? 0.5
        : (1 + Math.sin((time * Math.PI * 2) / 2.6)) / 2;
      material.opacity = 0.25 + strength * 0.14;
      edgeMaterial.opacity = 0.35 + strength * 0.25;
    },
    dispose() {
      root.removeFromParent();
      geometry.dispose();
      material.dispose();
      edgeGeometry.dispose();
      edgeMaterial.dispose();
    },
  };
}

// Only the current candidate gets a frame. No repeated symbols or internal grid.
export function placementCue() {
  const root = new T.Group(),
    geometry = new T.BoxGeometry(1, 1, 1);
  const material = new T.MeshBasicMaterial({
    color: PLACEMENT_STYLE.valid,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  });
  const fill = new T.Mesh(geometry, material),
    outline = new T.Group();
  root.add(fill, outline);
  const edgeMaterial = new T.MeshBasicMaterial({
    color: PLACEMENT_STYLE.valid,
    depthTest: false,
  });
  for (let i = 0; i < 8; i++) {
    const e = new T.Mesh(geometry, edgeMaterial);
    e.renderOrder = 3;
    outline.add(e);
  }
  return {
    root,
    fill,
    outline,
    place(site, w, d, y, valid = true, wall = false) {
      root.position.set(site.x, y, site.z);
      root.rotation.x = wall ? Math.PI / 2 : 0;
      fill.scale.set(w, 0.014, wall ? 0.35 : d);
      const depth = wall ? 0.35 : d,
        arm = Math.min(0.22, w * 0.32, depth * 0.32),
        color = valid ? PLACEMENT_STYLE.valid : PLACEMENT_STYLE.invalid;
      material.color.set(color);
      edgeMaterial.color.set(color);
      material.depthTest = valid;
      outline.children.forEach((e, i) => {
        const x = i % 4 < 2 ? -1 : 1,
          z = i % 2 ? -1 : 1;
        const horizontal = i < 4;
        e.position.set(
          x * (w / 2 - (horizontal ? arm / 2 : 0)),
          0.016,
          z * (depth / 2 - (horizontal ? 0 : arm / 2)),
        );
        e.scale.set(horizontal ? arm : 0.027, 0.025, horizontal ? 0.027 : arm);
      });
      root.updateMatrixWorld(true);
    },
    dispose() {
      root.removeFromParent();
      geometry.dispose();
      material.dispose();
      edgeMaterial.dispose();
    },
  };
}
