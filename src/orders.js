import {legacyGoodsFactor} from './training-balance.js';
import { ORDER_RULES as O, CROP_GOODS } from "./economy.js";
import { upgradeCapability, upgradeMultiplier } from "./upgrades.js";
const n = (s, id) => s.counts[id] || 0;
export function createOrders(s, dt, regions) {
  s.orderClock += dt;
  const crop = !!upgradeCapability(s, "V3", "cropOrders"),
    piglin = !!upgradeCapability(s, "N2", "piglinOrders");
  if (
    !(n(s, "V17") || n(s, "L13") || n(s, "L9") || piglin || crop) ||
    s.orderClock < O.interval ||
    s.orders.length >= O.max
  )
    return;
  s.orderClock = 0;
  const serial = ++s.orderSerial;
  let realm =
    piglin && serial % 2 === 0
      ? "nether"
      : n(s, "L11") && s.live.topic === "otherworld"
        ? n(s, "E2") && s.endEyes === 12
          ? "end"
          : "nether"
        : "overworld";
  let kind = "goods",
    label = piglin && realm === "nether" ? "猪灵契约" : "集市订单",
    target = O.targets[realm],
    value = regions[realm].value;
  if (crop && realm === "overworld" && serial % 2) {
    const kinds = Object.keys(s.crops.owned).filter(
      (k) => s.crops.owned[k] && CROP_GOODS[k],
    );
    kind = kinds[Math.floor(serial / 2) % kinds.length] || "wheat";
    label = CROP_GOODS[kind].name + "订单";
    target = O.cropTarget;
    value = CROP_GOODS[kind].value * upgradeMultiplier(s,"V4","localValue") * legacyGoodsFactor(s);
  }
  const reward = Math.ceil(target * value * O.premium);
  s.orders.push({
    id: serial,
    realm,
    kind,
    label,
    progress: 0,
    target,
    reward,
    life: O.life,
    owners: {},
  });
}
// The caller removes returned quantity from its one available inventory pool.
export function deliverOrders(
  s,
  realm,
  available,
  { kind = "goods", owners = {} } = {},
) {
  let remaining = Math.max(0, available),
    used = 0;
  for (const order of s.orders) {
    if (
      order.realm !== realm ||
      (order.kind || "goods") !== kind ||
      order.life <= 0
    )
      continue;
    const amount = Math.min(
      remaining,
      Math.max(0, order.target - order.progress),
    );
    if (amount <= 0) continue;
    order.progress += amount;
    remaining -= amount;
    used += amount;
    order.owners ||= {};
    for (const [id, fraction] of Object.entries(owners))
      order.owners[id] =
        (order.owners[id] || 0) + amount * Math.max(0, Math.min(1, fraction));
    if (remaining <= 1e-9) break;
  }
  return used;
}
export function settleOrders(s, dt, { earn, emit }, offline = false) {
  let earned = 0;
  for (const order of [...s.orders]) {
    if (order.progress >= order.target - 1e-8) {
      earn(s, order.reward, "order");
      earned += order.reward;
      s.ordersCompleted++;
      for (const [id, quantity] of Object.entries(order.owners || {})) {
        const r = s.community.residents.find((r) => r.id === id);
        const value = order.reward * Math.min(1, quantity / order.target);
        if (r) {
          r.jobEarned += value;
          s.community.jobIncome += value;
        }
      }
      s.orders = s.orders.filter((o) => o !== order);
      if (!offline)
        emit(s, "order", (order.label || "交货订单") + "完成", order.realm);
    } else {
      order.life -= dt;
      if (order.life <= 0) s.orders = s.orders.filter((o) => o !== order);
    }
  }
  return earned;
}
export function restoreOrders(raw) {
  return (Array.isArray(raw.orders) ? raw.orders : [])
    .filter(
      (o) =>
        ["overworld", "nether", "end"].includes(o.realm) &&
        Number.isFinite(o.target) &&
        o.target > 0,
    )
    .slice(0, O.max)
    .map((o) => ({
      id: Number.isFinite(o.id) ? Math.max(0, o.id) : 0,
      realm: o.realm,
      kind: CROP_GOODS[o.kind] ? o.kind : "goods",
      label: typeof o.label === "string" ? o.label.slice(0, 30) : "集市订单",
      target: Math.min(1e15, o.target),
      progress: Number.isFinite(o.progress)
        ? Math.max(0, Math.min(o.target, o.progress))
        : 0,
      reward: Number.isFinite(o.reward)
        ? Math.max(0, Math.min(1e25, o.reward))
        : 0,
      life: Number.isFinite(o.life)
        ? Math.max(0, Math.min(O.life, o.life))
        : O.life,
      owners: Object.fromEntries(
        Object.entries(o.owners || {})
          .filter(([id, v]) => Number.isFinite(v) && v >= 0)
          .map(([id, v]) => [id.slice(0, 40), Math.min(o.target, v)]),
      ),
    }));
}
