import {facilityStored} from './facility-storage.js';
import { CATALOG, ITEMS } from "./catalog.js";
import { projectProgress } from "./project.js";
import { facilityUpgrades, upgradeLevel, upgradePrice, upgradeRequirements } from './upgrades.js';
import { postalUpgradeCost } from './mail.js';
import { purchaseStatus } from './purchase-feedback.js';

// Ownership describes where an item lives, not the prerequisite that unlocked it.
export function ownerOf(id) {
  if (["X3", "X4", "X5", "X6", "X8"].includes(id)) return "decor";
  if (id.startsWith("L") && !["L1", "L2"].includes(id)) return "L2";
  if (["V8", "V9", "V10"].includes(id)) return "V7";
  if (["V12", "V13"].includes(id)) return "V11";
  if (["T9", "T10", "T11"].includes(id)) return "T8";
  return null;
}
export const SYSTEM_TECH = ["M10", "M11", "M12", "M13"];
export const inConstruction = (i) =>
  !ownerOf(i.id) && !SYSTEM_TECH.includes(i.id);

// Contextual suggestions still occupy their own outdoor land and use placement.
export function relatedFacilities(host) {
  return host === "V4" ? ["V5"] : [];
}

export function spaceOf(id) {
  const item = ITEMS[id];
  if (!item) return null;
  if (id === "V1") return "land";
  if (ownerOf(id) === "L2") return "studio";
  if (item.place) return "outdoor";
  if (item.model === "actor") return "resident";
  if (item.model === "cosmetic") return "cosmetic";
  return "upgrade";
}

// Existing buildings are upgraded in place. Only new physical objects need land.
export function placementFor(s, id) {
  const space = spaceOf(id);
  if (space === "land") return "outdoor";
  if (s.counts[id]) return null;
  return ["outdoor", "studio"].includes(space) ? space : null;
}

export const MANAGEMENT_PURCHASES = {
  village: {
    production: ["V4", "V7", "L1"],
    construction: [
      "V21","V22","V23","V24","V25",
      "V18",
      "V19",
      "V20",
      "V4",
      "V5",
      "V7",
      "V6",
      "V3",
      "V11",
      "V14",
      "V17",
      "L1",
    ],
    education: ["V12", "V13"],
    helpers: ["V14", "V15", "V16"],
    market: ["V3", "V17"],
  },
  industry: {
    production: ["M1", "M2", "M3", "M5", "M9", "M18"],
    power: ["M5", "M6", "M7", "M15", "N4", "E8"],
    automation: ["M10", "M11", "M12", "M13", "M14", "M19", "M20"],
    logistics: ["M4", "V24", "M8", "M16", "M17"],
  },
};

// The price used for ordering must describe the action on the card, not the
// first purchase price. An owned land parcel is never a facility upgrade.
export function ownedUpgrade(s, item) {
  if(facilityStored(s,item.id))return null;
  if (!s.counts[item.id] || item.id === 'V1') return null;
  if (item.id === 'V18') {
    const cost = postalUpgradeCost(s);
    return cost === null ? null : { kind: 'postal', cost, locked: false };
  }
  if (s.counts[item.id] < item.max) {
    const status = purchaseStatus(s, item);
    return { kind: 'level', cost: status.cost, locked: status.kind === 'locked' };
  }
  return facilityUpgrades(item.id)
    .filter(row => upgradeLevel(s, row.id) < row.maxLevel)
    .map(row => ({ kind: 'mod', id: row.id, cost: upgradePrice(s, row.id), locked: upgradeRequirements(s, row.id).length > 0 }))
    .sort((a,b) => Number(a.locked)-Number(b.locked) || a.cost-b.cost)[0] || null;
}

// Discovery is intentionally narrow; the owned inventory is not. Nested
// training, animals, indoor equipment and system modules retain their upgrades.
export function ownedCatalog(s, family='all') {
  return CATALOG.filter(i=>s.counts[i.id]&&!['V1','V2'].includes(i.id)&&
    (family==='all'||i.family===family)&&
    (inConstruction(i)||ownedUpgrade(s,i)||facilityStored(s,i.id)));
}

export function ownedGroups(s, items) {
  const stored=items.filter(i=>facilityStored(s,i.id));
  items = items.filter(i => i.id !== 'V1'&&!facilityStored(s,i.id));
  const building = (i) => i.id === "Z2" && !projectProgress(s).complete;
  const offers = new Map(items.map(i => [i.id, ownedUpgrade(s, i)]));
  const canImprove = i => !!offers.get(i.id);
  return {
    stored,
    building: items.filter((i) => s.counts[i.id] > 0 && building(i)),
    upgradable: items.filter(
      (i) => s.counts[i.id] > 0 && !building(i) && canImprove(i),
    ).sort((a,b) => {
      const left = offers.get(a.id), right = offers.get(b.id);
      return Number(left.locked)-Number(right.locked) || left.cost-right.cost;
    }),
    complete: items.filter(
      (i) => s.counts[i.id] > 0 && !canImprove(i) && !building(i),
    ),
  };
}
