import {facilityStored,facilityInactive,activeLevel} from './facility-storage.js';
import { formatHudNumber } from './hud-numbers.js';
import { ITEMS } from "./catalog.js";
import { UPGRADE_CATALOG, UPGRADE_BY_ID } from "./upgrade-catalog.js";
export { UPGRADE_CATALOG, UPGRADE_BY_ID } from "./upgrade-catalog.js";
const byOwner = UPGRADE_CATALOG.reduce((groups, row) => {
  (groups[row.owner] ||= []).push(row);
  return groups;
}, {});
export const UPGRADE_VERSION = 1;
export const freshUpgrades = () => ({
  version: UPGRADE_VERSION,
  levels: {},
  revision: 0,
});
export function upgradeLevel(s, id) {
  return s.upgrades?.levels[id] || 0;
}
export function facilityUpgrades(owner) {
  return byOwner[owner] || [];
}
export function upgradePrice(s, id) {
  const row = UPGRADE_BY_ID[id];
  return row
    ? Math.ceil(row.basePrice * row.growth ** upgradeLevel(s, id))
    : Infinity;
}
export function upgradeRequirements(s, id) {
  const row = UPGRADE_BY_ID[id];
  if (!row) return [{ id, name: "未知改造", type: "invalid" }];
  const next = Math.min(upgradeLevel(s, id), row.maxLevel - 1);
  const requiredLevel = row.ownerLevels?.[next] || 1;
  const missing = [...new Set([...row.dependencies, ...(row.stageRequires?.[next] || [])])]
    .filter((dep) =>
      UPGRADE_BY_ID[dep] ? !upgradeLevel(s, dep) : !s.counts[dep],
    )
    .map((dep) => ({
      id: dep,
      name: UPGRADE_BY_ID[dep]?.name || ITEMS[dep]?.name || dep,
      type: UPGRADE_BY_ID[dep] ? "upgrade" : "item",
    }));
  for (const tech of ({"torch-bank":[[],["industrial"],["modern"]],"torch-module":[["industrial"]],"wind-blades":[[],["industrial"],["modern"]],"wind-gears":[["industrial"]],"wind-coils":[["modern"]]}[id]?.[next] || [])) {
    if (!s.research?.completed?.[tech]) missing.push({id: tech, type:'research', name: {industrial:'工业技术',modern:'现代技术'}[tech]});
  }
  if (requiredLevel > 1 && (s.counts[row.owner] || 0) < requiredLevel) {
    const at = missing.findIndex((dep) => dep.id === row.owner);
    if (at >= 0) missing.splice(at, 1);
    missing.unshift({ id: row.owner, name: `${ITEMS[row.owner].name} Lv.${requiredLevel}`, type: "item", level: requiredLevel });
  }
  return missing;
}
export function upgradeStatus(s, id) {
  const row = UPGRADE_BY_ID[id],
    level = upgradeLevel(s, id),
    cost = upgradePrice(s, id),
    missing = upgradeRequirements(s, id);
  if (!row) return { kind: "locked", level, cost, missing, reason: "未知改造" };
  if(facilityInactive(s,row.owner))return {kind:"locked",level,cost,missing:[],reason:"设施已收纳，请先免费摆回"};
  if (level >= row.maxLevel)
    return { kind: "complete", level, cost, missing: [], reason: "已满级" };
  if (missing.length)
    return {
      kind: "locked",
      level,
      cost,
      missing,
      reason: "需要" + missing.map((x) => x.name).join("＋"),
    };
  if (s.money < cost)
    return {
      kind: "short",
      level,
      cost,
      missing: [],
      shortfall: cost - s.money,
      reason: `还差 ${formatHudNumber(Math.ceil(cost - s.money))} 绿宝石`,
    };
  return { kind: "ready", level, cost, missing: [], reason: "可改造" };
}
export function buyUpgrade(s, id) {
  const status = upgradeStatus(s, id),
    row = UPGRADE_BY_ID[id];
  if (status.kind !== "ready") return { ok: false, reason: status.reason };
  s.upgrades ||= freshUpgrades();
  s.money -= status.cost;
  s.upgrades.levels[id] = status.level + 1;
  s.upgrades.revision++;
  return {
    ok: true,
    id,
    owner: row.owner,
    cost: status.cost,
    level: status.level + 1,
    text: row.name + "已安装",
  };
}
export function restoreUpgrades(s, raw) {
  s.upgrades = freshUpgrades();
  for (const row of UPGRADE_CATALOG) {
    const level = raw?.upgrades?.levels?.[row.id];
    if (!s.counts[row.owner] || !Number.isFinite(level)) continue;
    s.upgrades.levels[row.id] = Math.max(
      0,
      Math.min(row.maxLevel, Math.floor(level)),
    );
  }
  // Do not remove paid legacy levels just because catalogue prerequisites changed.
  s.upgrades.revision = Object.values(s.upgrades.levels).reduce(
    (sum, v) => sum + v,
    0,
  );
}
export function upgradeMultiplier(s, owner, key) {
  if(facilityInactive(s,owner))return 1;
  if (!s.upgrades?.revision) return 1;
  return facilityUpgrades(owner).reduce(
    (value, row) =>
      typeof row.effects[key] === "number"
        ? value * row.effects[key] ** upgradeLevel(s, row.id)
        : value,
    1,
  );
}
export function upgradeCapability(s, owner, key, fallback = 0) {
  if(facilityInactive(s,owner))return fallback;
  return facilityUpgrades(owner).reduce(
    (value, row) =>
      upgradeLevel(s, row.id) && row.effects[key] !== undefined
        ? row.effects[key]
        : value,
    fallback,
  );
}
export function upgradeWork(s, owner) {
  return facilityUpgrades(owner).reduce(
    (value, row) => value * (row.energy.work || 1) ** upgradeLevel(s, row.id),
    1,
  );
}
export function upgradeExtraPower(s, owner) {
  return facilityUpgrades(owner).reduce(
    (value, row) => value + (row.energy.addWork || 0) * upgradeLevel(s, row.id),
    0,
  );
}
export function poweredUpgradeMultiplier(s, owner, key, power = s.grid?.last) {
  const factor =
    upgradeExtraPower(s, owner) > 0 ? power?.perDevice?.[owner] || 0 : 1;
  return 1 + (upgradeMultiplier(s, owner, key) - 1) * factor;
}
export function upgradeStorage(s) {
  return UPGRADE_CATALOG.reduce(
    (value, row) =>
      value + (row.effects.storage || 0) * upgradeLevel(s, row.id),
    0,
  );
}
export function storageCapacity(s, realm = "overworld", kind = "goods") {
  const base =
    120 *
    (1 + activeLevel(s,"M4")) ** 1.5 *
    (1 + activeLevel(s,"E6") * 0.5) *
    upgradeMultiplier(s, "M4", "buffer") *
    upgradeMultiplier(s, "E6", "buffer");
  return (
    base *
    (realm === "overworld" && kind === "raw"
      ? upgradeMultiplier(s, "M9", "buffer")
      : 1)
  );
}
export const EFFECT_NAMES = {
  localValue: "本设施产物价值",
  raw: "原料产量",
  process: "加工速度",
  buffer: "可存货量",
  outlet: "出料速度",
  inlet: "进料速度",
  generation: "发电量",
  storage: "储电上限",
  cargo: "每趟载货量",
  interval: "发车间隔",
  loading: "装卸速度",
  growthPeriod: "生长周期",
  harvest: "收获量",
  jobWork: "村民工作速度",
  trade: "售货速度",
  heat: "可储存热量",
  heatDelivery: "热能输送",
  heatRecovery: "余热发电量",
  batch: "每批处理量",
  transfer: "转运速度",
  goodsValue: "成品价值",
  chain: "连锁采收数",
  brewPeriod: "酿造周期",
  boostDuration: "强化时长",
  brewSynergy: "龙息期间产出",
  cropOrders: "作物订单",
  piglinOrders: "猪灵订单",
};
export function upgradeDescription(id) {
  const row = UPGRADE_BY_ID[id];
  if (!row) return "";
  const changes = Object.entries(row.effects).map(([key, value]) => {
    const name = EFFECT_NAMES[key] || key;
    if (typeof value === "boolean") return `可以接取${name}`;
    if (key === "storage") return `${name}增加 ${value} E`;
    if (key === "chain") return `一次可连续收获 ${value} 批`;
    const percent = Number((Math.abs(value - 1) * 100).toFixed(2));
    return `${name}${value >= 1 ? "提高" : "缩短"} ${percent}%`;
  });
  return (row.maxLevel > 1 ? "每升一级：" : "") + changes.join("；") + "。";
}
export function upgradeEnergyDescription(id) {
  const row = UPGRADE_BY_ID[id];
  if (!row) return "";
  const parts = [];
  if (row.energy.work && row.energy.work !== 1)
    parts.push(`工作耗电${row.energy.work > 1 ? "增加" : "减少"} ${Number((Math.abs(row.energy.work - 1) * 100).toFixed(2))}%`);
  if (row.energy.addWork) parts.push("工作时每秒多耗 " + row.energy.addWork + " E 电力");
  if (row.energy.storage) parts.push("储电上限增加 " + row.energy.storage + " E");
  return parts.length ? (row.maxLevel > 1 ? "每级" : "") + parts.join("；") : "不增加工作耗电";
}
