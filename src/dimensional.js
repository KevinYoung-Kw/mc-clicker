import { REALM_PROJECT_TARGET } from "./project.js";
import { DIMENSION_RULES as D } from "./economy.js";
import {
  upgradeMultiplier,
  upgradeExtraPower,
  storageCapacity,
} from "./upgrades.js";
import {activeLevel} from './facility-storage.js';
const n = activeLevel;
const q = (s, id) =>
  n(s, id) *
  (n(s, id) >= 25 ? 3 : n(s, id) >= 10 ? 1.8 : n(s, id) >= 5 ? 1.25 : 1);
const clean = (v, max = 1e30) =>
  Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : 0;
export function freshDimensions() {
  return {
    version: 1,
    heat: 0,
    heatMade: 0,
    heatUsed: 0,
    recovered: 0,
    recoveryRate: 0,
    clocks: {},
    trips: {},
    awaiting: { endRaw: 0, endGoods: 0 },
    moved: {},
    last: {},
    magmaProgress: 0,
    magmaProcessed: 0,
    chorusWave: 0,
  };
}
export function ensureDimensions(s) {
  return (s.dimensions ||= freshDimensions());
}
export function heatCapacity(s) {
  return (
    D.heatCapacity *
    Math.max(1, n(s, "N3")) *
    upgradeMultiplier(s, "N3", "heat")
  );
}
export function beginDimensions(s, dt) {
  const d = ensureDimensions(s);
  d.last = {};
  if (n(s, "N1") && n(s, "N3")) {
    const made = Math.min(
      Math.max(0, heatCapacity(s) - d.heat),
      q(s, "N3") *
        D.heatPerBlaze *
        upgradeMultiplier(s, "N3", "heatDelivery") *
        dt,
    );
    d.heat += made;
    d.heatMade += made;
  }
}
export function thermalProcessLimit(s, desired, dt) {
  const d = ensureDimensions(s),
    manual = (3 + q(s, "N3") * 2) * dt;
  return Math.min(desired, manual + d.heat / D.heatPerGoods);
}
export function consumeThermal(s, made, dt) {
  const d = ensureDimensions(s),
    manual = (3 + q(s, "N3") * 2) * dt;
  const heated = n(s, "N4")
    ? Math.min(Math.max(0, made - manual), d.heat / D.heatPerGoods)
    : 0;
  d.heat -= heated * D.heatPerGoods;
  d.heatUsed += heated * D.heatPerGoods;
  d.recoveryRate =
    (heated / dt) *
    D.recoveredElectricityPerGoods *
    upgradeMultiplier(s, "N4", "heatRecovery");

  return heated;
}
export function recoveredPower(s, dt) {
  const d = s.dimensions;
  if (
    !n(s, "N4") ||
    !d ||
    s.buffers.nether.goods >= storageCapacity(s, "nether") - 0.01 ||
    (!s.buffers.nether.raw && !n(s, "N3"))
  )
    return 0;
  return Math.min(
    d.recoveryRate,
    120 * q(s, "N4") * upgradeMultiplier(s, "N4", "heatRecovery"),
  );
}
export function magmaProcess(s, dt, power) {
  const d = ensureDimensions(s),
    b = s.buffers.nether;
  if (!n(s, "N5") || !n(s, "N1")) return 0;
  if (b.raw <= 0 || b.goods >= storageCapacity(s, "nether") - 0.01) return 0;
  d.magmaProgress = Math.min(
    D.magmaPeriod,
    d.magmaProgress + dt * (power.perDevice.N5 || 0),
  );
  if (d.magmaProgress < D.magmaPeriod) return 0;
  const amount = Math.min(
    b.raw,
    D.magmaBatch * q(s, "N5") * upgradeMultiplier(s, "N5", "batch"),
    Math.max(0, storageCapacity(s, "nether") - b.goods),
  );
  if (amount <= 0) return 0;
  b.raw -= amount;
  b.goods += amount;
  d.magmaProgress = 0;
  d.magmaProcessed += amount;
  d.last.N5 = { amount, at: s.play, state: "unloading" };
  return amount;
}
export function freightSpec(s, id) {
  const cargo = upgradeMultiplier(s, "E6", "cargo") * (1 + 0.35 * n(s, "E6"));
  if (id === "N6")
    return {
      from: "overworld",
      to: "nether",
      source: "goods",
      target: "raw",
      period: D.ghastPeriod,
      capacity: D.ghastCapacity * upgradeMultiplier(s, id, "cargo") * cargo,
      flight: D.ghastFlight,
    };
  if (id === "E3")
    return {
      from: "end",
      to: "end",
      source: "raw",
      target: "endRaw",
      period: D.endermanPeriod * upgradeMultiplier(s, id, "interval"),
      capacity:
        D.endermanCapacity *
        q(s, id) *
        upgradeMultiplier(s, id, "cargo") *
        cargo,
      flight: D.endermanFlight,
    };
  if (id === "E9")
    return {
      from: "end",
      to: "end",
      source: "goods",
      target: "endGoods",
      period: D.dragonPeriod * upgradeMultiplier(s, id, "interval"),
      capacity: D.dragonCapacity * upgradeMultiplier(s, id, "cargo") * cargo,
      flight: D.dragonFlight,
    };
  return null;
}
export function startFreight(s, id, power, { manual = false } = {}) {
  const d = ensureDimensions(s),
    spec = freightSpec(s, id);
  if (!spec || !n(s, id) || d.trips[id])
    return { ok: false, reason: "正在运输" };
  if (s.grid.disabled.includes(id) || s.grid.links[id] === false)
    return { ok: false, reason: "运输已关闭" };
  if (!(n(s, "N1") && (id === "N6" || (n(s, "E2") && s.endEyes === 12))))
    return { ok: false, reason: "传送门尚未连通" };
  if (!manual && (d.clocks[id] || 0) < spec.period)
    return { ok: false, reason: "等待下一班" };
  if (upgradeExtraPower(s, id) > 0 && !(power.perDevice[id] > 0))
    return { ok: false, reason: "航标缺电" };
  const loading =
    id === "N6"
      ? 1
      : 1 +
        (upgradeMultiplier(s, "E5", "loading") - 1) * (power.perDevice.E5 || 0);
  const reserve =
    id === "N6" &&
    n(s, "Z2") &&
    !s.completed &&
    s.projectByRealm.overworld < REALM_PROJECT_TARGET
      ? 1 - D.projectShare
      : 1;
  const qty = Math.min(
    s.buffers[spec.from][spec.source] * reserve,
    spec.capacity,
    Math.max(
      0,
      storageCapacity(
        s,
        spec.to,
        ["raw", "endRaw"].includes(spec.target) ? "raw" : "goods",
      ) -
        (spec.target.startsWith("end")
          ? d.awaiting[spec.target]
          : s.buffers[spec.to][spec.target]),
    ),
  );
  // Loading cannot override warehouse room; capacity is independently bounded.
  const room = Math.max(
    0,
    storageCapacity(
      s,
      spec.to,
      ["raw", "endRaw"].includes(spec.target) ? "raw" : "goods",
    ) -
      (spec.target.startsWith("end")
        ? d.awaiting[spec.target]
        : s.buffers[spec.to][spec.target]),
  );
  const amount = Math.min(qty, room);
  if (amount <= 0)
    return {
      ok: false,
      reason:
        s.buffers[spec.from][spec.source] <= 0 ? "等待货物" : "目的地已满仓",
    };
  s.buffers[spec.from][spec.source] -= amount;
  d.trips[id] = {
    ...spec,
    cargo: amount,
    duration: spec.flight / Math.max(1, loading),
    remaining: spec.flight / Math.max(1, loading),
    at: s.play,
  };
  d.clocks[id] = 0;
  d.last[id] = { amount, at: s.play, state: "departed" };
  return {
    ok: true,
    text: "已发出 " + Math.floor(amount) + " 份货物",
    value: 0,
  };
}
export function advanceFreight(s, dt, power, emit) {
  const d = ensureDimensions(s);
  for (const id of ["N6", "E3", "E9"]) {
    const spec = freightSpec(s, id);
    if (!n(s, id) || !spec) continue;
    let trip = d.trips[id];
    if (trip) {
      const fraction =
        s.grid.disabled.includes(id) || s.grid.links[id] === false
          ? 0
          : upgradeExtraPower(s, id) > 0
            ? power.perDevice[id] || 0
            : 1;
      if (fraction <= 0) continue;
      trip.remaining = Math.max(0, trip.remaining - dt * fraction);
      if (trip.remaining <= 0) {
        const room = Math.max(
          0,
          storageCapacity(
            s,
            trip.to,
            ["raw", "endRaw"].includes(trip.target) ? "raw" : "goods",
          ) -
            (trip.target.startsWith("end")
              ? d.awaiting[trip.target]
              : s.buffers[trip.to][trip.target]),
        );
        const delivered = Math.min(trip.cargo, room);
        if (trip.target.startsWith("end")) d.awaiting[trip.target] += delivered;
        else s.buffers[trip.to][trip.target] += delivered;
        trip.cargo -= delivered;
        d.moved[id] = (d.moved[id] || 0) + delivered;
        if (delivered > 0)
          d.last[id] = { amount: delivered, at: s.play, state: "unloading" };
        if (trip.cargo <= 1e-8) {
          delete d.trips[id];
          if (id === "E9" && delivered > 0)
            emit?.(
              s,
              "creature",
              "末影龙巡游归来 · 卸下 " + Math.floor(delivered) + " 份货物",
              "end",
            );
        }
      }
    } else {
      d.clocks[id] = Math.min(spec.period, (d.clocks[id] || 0) + dt);
      startFreight(s, id, power);
    }
  }
  return d;
}
export function dragonReserve(s, power) {
  if (
    !n(s, "E9") ||
    s.dimensions?.trips.E9 ||
    s.grid.disabled.includes("E9") ||
    s.grid.links.E9 === false ||
    (upgradeExtraPower(s, "E9") > 0 && !(power.perDevice.E9 > 0))
  )
    return 0;
  return Math.min(s.buffers.end.goods, freightSpec(s, "E9").capacity);
}
export function terminalTransfers(s, dt, power) {
  const d = ensureDimensions(s),
    moved = { overworld: 0, nether: 0, end: 0 };
  const fractionFor = id =>
    s.grid.disabled.includes(id) || s.grid.links[id] === false ? 0 :
      upgradeExtraPower(s, id) > 0 ? power.perDevice[id] || 0 : 1;
  function move(id, from, to, source, target, rate, budget = Infinity) {
    const hasMotor = upgradeExtraPower(s, id) > 0,
      fraction =
        s.grid.disabled.includes(id) || s.grid.links[id] === false
          ? 0
          : hasMotor
            ? power.perDevice[id] || 0
            : 1;
    const reserve =
      source === "goods" &&
      n(s, "Z2") &&
      !s.completed &&
      s.projectByRealm[from] < REALM_PROJECT_TARGET
        ? 1 - D.projectShare
        : 1;
    const amount = Math.min(
      budget,
      s.buffers[from][source] * reserve,
      rate * dt * fraction,
      Math.max(0, storageCapacity(s, to, target) - s.buffers[to][target]),
    );
    s.buffers[from][source] -= amount;
    s.buffers[to][target] += amount;
    d.moved[id] = (d.moved[id] || 0) + amount;
    moved[from] += amount;
    if (amount > 0) d.last[id] = {
      amount: (d.last[id]?.at === s.play ? d.last[id].amount : 0) + amount,
      at: s.play, state: "working",
    };
  }
  if (n(s, "N12") && n(s, "N1"))
    move(
      "N12",
      "overworld",
      "nether",
      "goods",
      "raw",
      D.netherTransfer * upgradeMultiplier(s, "N12", "transfer"),
    );
  if (n(s, "E7") && n(s, "E2") && s.endEyes === 12) {
    const target = s.transfer;
    const rate = D.chestTransfer * upgradeMultiplier(s, "E7", "transfer");
    const sources = ["overworld", "nether", "end"].filter(r => r !== target)
      .sort((a, b) => s.buffers[a].raw - s.buffers[b].raw);
    let budget = Math.min(rate * dt * fractionFor("E7"),
      Math.max(0, storageCapacity(s, target, "raw") - s.buffers[target].raw));
    // One device, one budget. Small sources use their share first; unused
    // throughput is available to the other source in the same simulation step.
    for (const [index, from] of sources.entries()) {
      const share = Math.min(s.buffers[from].raw, budget / (sources.length - index));
      move(
        "E7",
        from,
        target,
        "raw",
        "raw",
        rate,
        share,
      );
      budget -= share;
    }
  }
  return moved;
}
export function restoreDimensions(s, raw) {
  const d = (s.dimensions = freshDimensions()),
    old = raw.dimensions;
  if (!old) return;
  for (const key of [
    "heat",
    "heatMade",
    "heatUsed",
    "recovered",
    "recoveryRate",
    "magmaProcessed",
    "chorusWave",
  ])
    d[key] = clean(old[key]);
  d.heat = Math.min(d.heat, heatCapacity(s));
  d.magmaProgress = clean(old.magmaProgress, D.magmaPeriod);
  for (const key of ["endRaw", "endGoods"])
    d.awaiting[key] = clean(old.awaiting?.[key]);
  for (const id of ["N6", "E3", "E9"]) {
    const spec = freightSpec(s, id);
    d.clocks[id] = clean(old.clocks?.[id], spec.period);
    const saved = old.trips?.[id];
    if (n(s, id) && saved && clean(saved.cargo) > 0)
      d.trips[id] = {
        ...spec,
        cargo: clean(saved.cargo),
        duration: clean(saved.duration, spec.flight) || spec.flight,
        remaining: clean(saved.remaining, spec.flight),
        at: clean(saved.at),
      };
  }
  for (const id of ["N6", "E3", "E9", "N12", "E7"])
    d.moved[id] = clean(old.moved?.[id]);
}
