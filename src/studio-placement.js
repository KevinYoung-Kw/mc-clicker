import {ownershipState} from './facility-storage.js';
import { ITEMS } from "./catalog.js";
import { COLLECTION_BY_ID } from "./collection.js";
import { STUDIO, STUDIO_ANCHORS as A } from "./studio-layout.js";

// Positions describe physical furniture, not a second production economy.
// Mounting surfaces constrain placement; intersecting volumes still collide.
const rows = {
  L1: [0.5, 0.5, -1.75, 1.25],
  "L3:0": [0.5, 0.5, -1.25, 0.75],
  "L3:1": [0.5, 0.5, -0.75, 1],
  "L3:2": [0.5, 0.5, -1.25, 0],
  L4: [0.75, 1, A.host.x, A.host.z, "floor", false],
  L5: [1.05, 0.16, 1.25, -2.25, "wall"],
  L6: [0.9, 0.75, 1.5, 0.5],
  L7: [0.75, 0.75, -0.75, 0.5, "ceiling"],
  L8: [0.8, 0.16, -1.25, -2.25, "wall-high"],
  L9: [1, 0.16, 0, -2.25, "wall-high"],
  L10: [0.75, 0.75, -1.25, -1.75],
  L11: [0.75, 0.26, -1.25, -2.25, "wall"],
  L12: [0.75, 0.75, 1.25, -1.5],
  L13: [0.5, 0.5, 1.25, -0.5],
  L14: [1.4, 0.75, 1.25, 1.5],
  studioDesk: [1.64, 0.75, A.desk.x, A.desk.z, "surface", false],
  studioWall: [3.6, 0.05, 0, -2.306, "surface", false],
  studioSign: [1.25, 0.16, 0, -2.25, "wall-top"],
  studioShelf: [0.25, 1.25, 2.5, 1],
  flag: [0.5, 0.16, 1.25, -2.25, "wall-high"],
};
const studioSlots = [
  "studioDesk",
  "studioWall",
  "studioSign",
  "studioShelf",
  "flag",
];
const sampleIds = Object.keys(COLLECTION_BY_ID).filter((id) =>
  ["studio", "flag"].includes(COLLECTION_BY_ID[id].category),
);
const heights = {
  floor: STUDIO.floorY + 0.005,
  wall: 1.2,
  "wall-high": 1.8,
  "wall-top": 2.13,
  ceiling: 2.12,
  surface: 0.9,
  display: 0.7,
};
const fixedDesk = { key: "desk", x: A.desk.x, z: A.desk.z, w: 1.64, d: 0.75 };
const fixedHost = { key: "host", x: A.host.x, z: A.host.z, w: 0.75, d: 1 };
const fixedCabinet = { x: -2.68, z: -0.31, w: 0.38, d: 1.92 };
// Conservative vertical bounds of the shared models, including their highest
// upgrade. Mounting layers choose controls, not collision exemptions.
const verticalBounds = {
  L1: [0.2, 0.68], L3: [0.2, 1.18], L4: [0.2, 1.07],
  L5: [0.9, 1.62], L6: [0.2, 1.27], L7: [1.37, 2.28],
  L8: [1.6, 2.04], L9: [1.62, 1.92], L10: [0.2, 1.28],
  L11: [1.22, 1.68], L12: [0.2, 2.19], L13: [0.2, 1.4],
  L14: [0.2, 2.18], studioShelf: [0.2, 2],
  studioSign: [1.82, 2.25], flag: [1.6, 2.04],
};
const checked = new WeakMap();

export function studioSpec(key) {
  if (typeof key !== "string") return null;
  if (key.startsWith("collectible:")) {
    const id = key.slice(12),
      item = COLLECTION_BY_ID[id],
      index = sampleIds.indexOf(id);
    if (!item || index < 0) return null;
    return {
      key,
      id,
      name: item.name + " · 收藏样本",
      w: 0.19,
      d: 0.19,
      layer: "display",
      y: 0.69 + Math.floor(index / 4) * 0.36,
      movable: false,
      default: { x: -2.68, z: -0.95 + (index % 4) * 0.42, rotation: 0 },
    };
  }
  const row = rows[key];
  if (!row) return null;
  const id = key.startsWith("L3:") ? "L3" : key,
    [w, d, x, z, layer = "floor", movable = true] = row;
  return {
    key,
    id,
    name:
      ITEMS[id]?.name ||
      {
        studioDesk: "导播桌",
        studioWall: "声学墙",
        studioSign: "频道灯牌",
        studioShelf: "收藏架",
        flag: "频道旗帜",
      }[id],
    w,
    d,
    layer,
    movable,
    y: heights[layer],
    default: { x, z, rotation: 0 },
  };
}

function ownedKeys(s) {
  const counts = ownershipState(s)?.counts || {},
    owned = s?.scenery?.owned || {},
    equipped = s?.scenery?.equipped || {},
    keys = [];
  if (counts.L2 && counts.L1) keys.push("L1");
  for (let i = 0; i < Math.min(3, counts.L3 || 0); i++) keys.push(`L3:${i}`);
  for (let i = 4; i <= 14; i++) if (counts[`L${i}`]) keys.push(`L${i}`);
  for (const slot of studioSlots)
    if (
      sampleIds.some((id) => COLLECTION_BY_ID[id].slot === slot && owned[id]) ||
      COLLECTION_BY_ID[equipped[slot]]?.slot === slot
    )
      keys.push(slot);
  for (const id of sampleIds) if (owned[id]) keys.push("collectible:" + id);
  return keys;
}

export function entityForPurchase(s, id) {
  if (id === "L3") return `L3:${Math.min(2, s?.counts?.L3 || 0)}`;
  if (id === "L1" && !s?.counts?.L2) return null;
  if (rows[id]) return id;
  const item = COLLECTION_BY_ID[id];
  return ["studio", "flag"].includes(item?.category) ? item.slot : null;
}

function normalized(p) {
  if (
    !p ||
    !Number.isFinite(p.x) ||
    !Number.isFinite(p.z) ||
    !Number.isFinite(p.rotation ?? 0)
  )
    return null;
  return {
    x: p.x,
    z: p.z,
    rotation: ((Math.round(p.rotation || 0) % 4) + 4) % 4,
  };
}
function size(spec, rotation) {
  return rotation % 2 ? { w: spec.d, d: spec.w } : { w: spec.w, d: spec.d };
}
function touches(a, b) {
  return (
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 - 1e-6 &&
    Math.abs(a.z - b.z) < (a.d + b.d) / 2 - 1e-6
  );
}
function occupancy(s, placements) {
  return Object.fromEntries(
    Object.entries(placements || {}).filter(
      ([key]) => !studioSlots.includes(key) || !!s?.scenery?.equipped?.[key],
    ),
  );
}
function legal(key, p, placements, ignoreKey) {
  const spec = studioSpec(key),
    pos = normalized(p);
  if (!spec || !pos) return false;
  if (!spec.movable)
    return (
      pos.x === spec.default.x && pos.z === spec.default.z && pos.rotation === 0
    );
  if (
    Math.abs(pos.x / STUDIO.grid - Math.round(pos.x / STUDIO.grid)) > 1e-6 ||
    Math.abs(pos.z / STUDIO.grid - Math.round(pos.z / STUDIO.grid)) > 1e-6
  )
    return false;
  const footprint = { ...pos, ...size(spec, pos.rotation) };
  if (spec.layer.startsWith("wall")) {
    if (
      pos.z !== -2.25 ||
      pos.rotation !== 0 ||
      Math.abs(pos.x) + spec.w / 2 > STUDIO.width / 2 - 0.18
    )
      return false;
  } else if (
    Math.abs(pos.x) + footprint.w / 2 > STUDIO.width / 2 - 0.12 + 1e-6 ||
    Math.abs(pos.z) + footprint.d / 2 > STUDIO.depth / 2 - 0.2 + 1e-6
  )
    return false;
  if (
    [ [fixedDesk, 1.25], [fixedHost, 1.8], [fixedCabinet, 1.65], [STUDIO.staffLanding, 1.8] ].some(([reserved, top]) =>
      (verticalBounds[spec.id]?.[0] ?? 0) < top && touches(footprint, reserved),
    )
  )
    return false;
  for (const [other, site] of Object.entries(placements || {})) {
    if (other === ignoreKey || other === key) continue;
    const os = studioSpec(other);
    if (!os || !os.movable) continue;
    const a = verticalBounds[spec.id], b = verticalBounds[os.id];
    if (!a || !b || a[1] <= b[0] || b[1] <= a[0]) continue;
    if (touches(footprint, { ...site, ...size(os, site.rotation || 0) }))
      return false;
  }
  return true;
}

function candidates(key, rotation = 0) {
  const spec = studioSpec(key);
  if (!spec) return [];
  if (!spec.movable) return [{ ...spec.default }];
  const sites = [];
  for (let x = -2.75; x <= 2.75; x += STUDIO.grid)
    for (let z = -2.25; z <= 2.25; z += STUDIO.grid)
      sites.push({
        x,
        z,
        rotation: spec.layer.startsWith("wall")
          ? 0
          : ((Math.round(rotation) % 4) + 4) % 4,
      });
  return sites.sort(
    (a, b) =>
      (a.x - spec.default.x) ** 2 +
      (a.z - spec.default.z) ** 2 -
      (b.x - spec.default.x) ** 2 -
      (b.z - spec.default.z) ** 2,
  );
}

export function restoreStudio(s, raw) {
  const previous = raw?.placements || {},
    placements = {},
    keys = ownedKeys(s);
  // Preserve valid user choices first; repair only invalid or missing entries.
  for (const key of keys) {
    const p = normalized(previous[key]);
    if (p && legal(key, p, occupancy(s, placements))) placements[key] = p;
  }
  for (const key of keys)
    if (!placements[key]) {
      const spec = studioSpec(key),
        options = [spec.default, ...candidates(key), ...candidates(key, 1)];
      const p = options.find((site) =>
        legal(key, site, occupancy(s, placements)),
      );
      if (p) placements[key] = { ...p };
    }
  s.studio = {
    version: 1,
    placements,
    revision: Math.max(0, Math.floor(Number(raw?.revision) || 0)),
  };
  checked.set(s, studioCheckKey(s));
  return s.studio;
}

function studioCheckKey(s) {
  return JSON.stringify([ownedKeys(s), s.scenery?.equipped, s.studio?.placements]);
}

export function ensureStudio(s) {
  const keys = ownedKeys(s),
    current = s?.studio?.placements;
  if (
    !current ||
    s.studio.version !== 1 ||
    Object.keys(current).some((key) => !keys.includes(key)) ||
    checked.get(s) !== studioCheckKey(s)
  )
    restoreStudio(s, s.studio);
  return s.studio;
}

export function studioEntities(s) {
  const studio = ensureStudio(s);
  return ownedKeys(s)
    .filter(
      (key) => !studioSlots.includes(key) || s?.scenery?.equipped?.[key],
    )
    .map((key) => ({
      ...studioSpec(key),
      placed: !!studio.placements[key],
      position: studio.placements[key] || studioSpec(key).default,
    }));
}

export function studioSites(s, key, { ignoreKey, rotation = 0 } = {}) {
  return candidates(key, rotation).filter((p) =>
    legal(key, p, occupancy(s, s?.studio?.placements), ignoreKey),
  );
}

export function canPlaceStudio(s, key, p, { ignoreKey } = {}) {
  return legal(key, p, occupancy(s, s?.studio?.placements), ignoreKey);
}

export function placeStudio(s, key, p) {
  if (!ownedKeys(s).includes(key))
    return { ok: false, reason: "先购买这件室内设备" };
  ensureStudio(s);
  if (!canPlaceStudio(s, key, p, { ignoreKey: key }))
    return { ok: false, reason: "这里已被占用，或超出室内边界" };
  const next = normalized(p),
    old = s.studio.placements[key];
  if (
    !old ||
    old.x !== next.x ||
    old.z !== next.z ||
    old.rotation !== next.rotation
  ) {
    s.studio.placements[key] = next;
    s.studio.revision++;
  }
  return { ok: true };
}
