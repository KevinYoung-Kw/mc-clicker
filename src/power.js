import {restorePowerCompensation} from './power-compatibility.js';
import {dispatchMode} from './command-dispatch.js';
import {activeLevel} from './facility-storage.js';
import { generationCapacity, purchasedGenerationCapacity } from "./facility-capacity.js";
import { ITEMS } from "./catalog.js";
import { POWER_BENEFITS } from "./power-benefits.js";
import { recoveredPower, freightSpec } from "./dimensional.js";
import { wireRoute } from "./routing.js";
import { sourceHasRoute, transportAccess } from "./transport.js";
import {
  upgradeMultiplier,
  upgradeWork,
  upgradeExtraPower,
  upgradeStorage,
  storageCapacity,
} from "./upgrades.js";
const n = activeLevel;
const q = (s, id) =>
  n(s, id) *
  (n(s, id) >= 25 ? 3 : n(s, id) >= 10 ? 1.8 : n(s, id) >= 5 ? 1.25 : 1);
export const CAPACITIES = [120, 480, 1920, 7680, 30720];
export const CAPACITOR_PRICES = [1600, 6400, 25600, 102400];
export const POWER_FACILITIES = new Set([
  "M2",
  "M3",
  "M4",
  "M5",
  "M6",
  "M7",
  "M8",
  "M9",
  "M10",
  "M11",
  "M12",
  "M13",
  "M14",
  "M15",
  "M16",
  "M18",
  "M19",
  "M20",
  "L1",
  "L2",
  "N4",
  "N5",
  "N10",
  "N11",
  "N12",
  "E5",
  "E7",
  "E8",
  "E9",
  "E10",
  "E11",
]);
export function freshGrid() {
  return {
    version: 2,
    powerBalanceRevision: 1,
    powerCompensation: {},
    autoConnect: false,
    learnedConnection: false,
    capacitor: 0,
    disabled: [],
    links: {},
    automation: { farm: 0, wool: 0, mine: 0, music: false, note: false },
    crank: 0,
    spent: 0,
    generated: 0,
    spilled: 0,
    last: null,
    revision: 0,
  };
}
export function ensureGrid(s) {
  if (!s.grid) s.grid = freshGrid();
  return s.grid;
}
export function gridCapacity(s) {
  return n(s, "M5")
    ? CAPACITIES[ensureGrid(s).capacitor] + upgradeStorage(s)
    : 0;
}
export function gridConnected(s, id) {
  return gridConnections(s)(id);
}
export const POWER_STATES = {
  working: "运行中",
  idle: "待机",
  "no-power": "缺电",
  "out-of-range": "超出供电范围",
  "not-connected": "未接入电网",
  off: "已关闭",
};
export function gridRange(s) {
  return (
    16 +
    8 * Math.min(5, n(s, "M11")) +
    Math.max(0, Math.min(1024, s.grid?.migrationReach || 0))
  );
}
export function gridConnection(s, id) {
  const g = ensureGrid(s),
    anchor = id === "V9" ? "V7" : id,
    realm = s.placements[anchor]?.realm || ITEMS[id]?.realm || "overworld";
  const dimensionReady =
    realm === "overworld" ||
    (realm === "nether" ? n(s, "N1") : n(s, "E2") && s.endEyes === 12);
  const auto =
    (id.startsWith("L") && (id !== "L1" || n(s, "L2"))) ||
    ["M10", "M11", "M12", "M13"].includes(id);
  const route = auto ? null : wireRoute(s, anchor),
    length = route?.length || 0;
  // Unplaced fixtures and nonphysical upgrades are local bus nodes. Real
  // buildings with no legal route remain disconnected, including old links.
  const pathReady =
    auto ||
    !s.placements[anchor] ||
    ["M5", "M6", "M7", "M15"].includes(id) ||
    !!route;
  const inRange = pathReady && length <= gridRange(s),
    connected =
      !!(n(s, "M5") || (g.legacyStudioSupply && id.startsWith("L"))) &&
      !!dimensionReady &&
      g.links[id] !== false &&
      inRange;
  return {
    requested: g.links[id] !== false,
    gridReady: !!(n(s, "M5") || (g.legacyStudioSupply && id.startsWith("L"))),
    dimensionReady: !!dimensionReady,
    pathReady,
    connected,
    inRange,
    route,
    length,
    range: gridRange(s),
    loss: connected
      ? Math.min(0.18, (length * 0.004) / (1 + 0.35 * n(s, "M11")))
      : 0,
    automatic: auto,
  };
}
export function previewConnection(s, id, position) {
  const preview = {
    ...s,
    placements: { ...s.placements, [id]: { ...position } },
    layoutRevision: (s.layoutRevision || 0) + 1,
  };
  return gridConnection(preview, id);
}
// One snapshot shares the same topology. Keep the cache local so moving a
// building, a manual disconnect or restoring a save takes effect immediately.
function gridConnections(s) {
  const cache = new Map();
  return (id) => {
    if (cache.has(id)) return cache.get(id);
    const connected = gridConnection(s, id).connected;
    cache.set(id, connected);
    return connected;
  };
}
export function humanTaskInProgress(s, key) {
  const task = s.community?.tasks[key];
  return (
    !!task?.manual ||
    ((task?.work || 0) > 0 &&
      Object.keys(task?.owners || {}).some((id) => id !== "machine"))
  );
}
export function automationAssignments(s) {
  const g = ensureGrid(s),
    out = { ...g.automation };
  let free = Math.max(
    0,
    n(s, "M14") -
      ["farm", "wool", "mine"].reduce((sum, key) => sum + (out[key] || 0), 0),
  );
  if (
    !n(s, "M13") ||
    !n(s, "M10") ||
    g.disabled.includes("M13") ||
    !gridConnected(s, "M13")
  )
    return out;
  for (const [key, id] of [
    ["farm", "V4"],
    ["wool", "V9"],
    ["mine", "M1"],
  ]) {
    if (!free || out[key] || !n(s, id) || humanTaskInProgress(s, key)) continue;
    if (key !== "mine" && s.harvest[key] < 1) continue;
    if (
      key === "mine" &&
      s.buffers.overworld.raw >= storageCapacity(s, "overworld", "raw")
    )
      continue;
    out[key] = 1;
    free--;
  }
  return out;
}
export function connectGrid(s, id) {
  const reason = connectionProblem(s, id);
  if (reason) return { ok: false, reason };
  const g = ensureGrid(s);
  if (g.links[id] === true) return { ok: true, text: "已接入", id };
  g.links[id] = true;
  g.learnedConnection = true;
  g.revision++;
  return {
    ok: true,
    id,
    connected: true,
    text: id === "M17" ? "自动装卸已启用" : "已接入电网",
  };
}
export const NETWORK_FACILITIES = new Set([...POWER_FACILITIES, "M17"]);
export function connectionProblem(s, id) {
  if (!n(s, id) || !NETWORK_FACILITIES.has(id)) return "先建成可联网的设施";
  const c = gridConnection(s, id);
  if (!c.gridReady) return "需要先建好红石控制台";
  if (!c.dimensionReady) return "需要先激活对应世界的传送门";
  if (!c.pathReady) return "没有可达线路，请调整位置或留出通路";
  if (!c.inRange)
    return `线路长 ${c.length.toFixed(1)} 格，目前可覆盖 ${c.range} 格`;
  return "";
}
export function initializeConnection(s, id) {
  if (
    !NETWORK_FACILITIES.has(id) ||
    id === "M5" ||
    gridConnection(s, id).automatic
  )
    return;
  const g = ensureGrid(s);
  g.links[id] = g.autoConnect && !connectionProblem(s, id);
  g.revision++;
}
export function disconnectGrid(s, id) {
  if (!NETWORK_FACILITIES.has(id) || !n(s, id) || id === "M5")
    return { ok: false, reason: "这项设施不能断开" };
  const g = ensureGrid(s);
  g.links[id] = false;
  g.revision++;
  return { ok: true, text: "已断开，原有人工能力保留" };
}
export function connectAll(s) {
  const connected = [],
    blocked = [];
  for (const id of NETWORK_FACILITIES) {
    if (
      !n(s, id) ||
      id === "M5" ||
      (id === "M4" && !upgradeExtraPower(s, id)) ||
      s.grid.disabled.includes(id) ||
      gridConnection(s, id).connected
    )
      continue;
    const r = connectGrid(s, id);
    if (r.ok) connected.push(id);
    else blocked.push({ id, reason: r.reason });
  }
  return {
    ok: connected.length > 0,
    connected,
    blocked,
    text: `已接入 ${connected.length} 项${blocked.length ? `，${blocked.length} 项需处理` : ""}`,
  };
}
export function setAutoConnect(s, enabled) {
  const g = ensureGrid(s);
  g.autoConnect = !!enabled;
  g.revision++;
  return {
    ok: true,
    text: g.autoConnect ? "新设备建成后自动尝试接入" : "新设备由你手动接入",
  };
}
export function transportDeviceEnabled(s, id) {
  return (
    !!n(s, id) &&
    !ensureGrid(s).disabled.includes(id) &&
    gridConnection(s, id).connected
  );
}
export function devicePaused(s, id) {
  const g = ensureGrid(s);
  return g.disabled.includes(id) ||
    (!NETWORK_FACILITIES.has(id) && !!freightSpec(s, id) && g.links[id] === false);
}
export function toggleDevice(s, id) {
  if (!ITEMS[id] || !n(s, id)) return { ok: false, reason: "先建成设施" };
  const g = ensureGrid(s),
    at = g.disabled.indexOf(id),
    paused = devicePaused(s, id);
  if (paused) {
    if (at >= 0) g.disabled.splice(at, 1);
    // Older saves can pause non-electric carriers through a grid link. Only an
    // explicit resume clears that flag; real grid disconnections stay intact.
    if (!NETWORK_FACILITIES.has(id) && freightSpec(s, id) && g.links[id] === false)
      delete g.links[id];
  } else g.disabled.push(id);
  g.revision++;
  return { ok: true, text: paused ? "设备已启用" : "设备已暂停" };
}
export function upgradeCapacitor(s) {
  const g = ensureGrid(s),
    cost = CAPACITOR_PRICES[g.capacitor];
  if (!n(s, "M5"))
    return { ok: false, reason: "请先建好红石电网，再升级储电容量" };
  if (cost === undefined) return { ok: false, reason: "储电容量已满级" };
  if (s.money < cost) return { ok: false, reason: "绿宝石还不够" };
  s.money -= cost;
  g.capacitor++;
  g.revision++;
  return {
    ok: true,
    text: `最多可储存 ${gridCapacity(s)} E 电力，发电设备会逐步充满`,
  };
}
export function configureAutomation(s, key, value) {
  const g = ensureGrid(s);
  if (!["farm", "wool", "mine", "music", "note"].includes(key))
    return { ok: false, reason: "无效的自动化目标" };
  if (["music", "note"].includes(key)) {
    if (!n(s, "M10") || !n(s, key === "music" ? "L1" : "M20"))
      return { ok: false, reason: "需要红石钟和对应音乐设施" };
    g.automation[key] = !!value;
  } else {
    const target = { farm: "V4", wool: "V9", mine: "M1" }[key];
    if (Number(value) > 0 && !n(s, target))
      return { ok: false, reason: "先建成对应的工作设施" };
    const count = Math.max(
        0,
        Math.min(n(s, "M14"), Math.floor(Number(value) || 0)),
      ),
      used = ["farm", "wool", "mine"]
        .filter((k) => k !== key)
        .reduce((v, k) => v + g.automation[k], 0);
    if (used + count > n(s, "M14"))
      return {
        ok: false,
        reason: "没有空闲发射器了。先从其他任务调一台过来，或再买一台。",
      };
    if (count && (!n(s, "M14") || !n(s, "M10")))
      return { ok: false, reason: "需要发射器和红石钟" };
    g.automation[key] = count;
  }
  g.revision++;
  return { ok: true, text: "自动操作已安排好" };
}
export function powerSnapshot(s, dt = 1, commit = false) {
  dt = Number.isFinite(dt) && dt > 0 ? dt : 1;
  const g = ensureGrid(s),
    automation = automationAssignments(s),
    connected = gridConnections(s),
    enabled = (id) => !g.disabled.includes(id) && connected(id),
    capacity = gridCapacity(s);
  const sources = [
    ["M6", 6],
    ["M7", 32],
    ["M15", 180],
    ["N4", 120],
    ["E8", 400],
  ]
    .filter(([id]) => n(s, id) && enabled(id))
    .filter(([id]) => id[0] !== "N" || n(s, "N1"))
    .filter(([id]) => id[0] !== "E" || (n(s, "E2") && s.endEyes === 12))
    .map(([id, rate]) => ({
      id,
      name: ITEMS[id].name,
      rate:
        id === "N4"
          ? recoveredPower(s, dt)
          : generationCapacity(s, id),
    }));
  if (g.legacyStudioSupply && n(s, "L2") && !g.disabled.includes("L2"))
    sources.push({
      id: "legacy-studio",
      name: "直播间兼容电源",
      rate: g.legacyStudioSupply,
    });
  const supply = sources.reduce((v, x) => v + x.rate, 0),
    crank = n(s, "M5") ? 24 * Math.min(dt, g.crank || 0) : 0;
  const loads = [],
    add = (
      id,
      rate,
      realm = "overworld",
      kind = "production",
      working = rate > 0,
    ) => {
      rate = working ? rate * upgradeWork(s, id) + upgradeExtraPower(s, id) : 0;
      if (n(s, id))
        loads.push({
          id,
          name: ITEMS[id]?.name || id,
          realm,
          kind,
          rated: rate,
          connected: connected(id),
          enabled: enabled(id),
          actual: 0,
          fraction: 0,
        });
    };
  const cap = storageCapacity(s),
    raw = s.buffers.overworld.raw;
  const miningRoom = raw < storageCapacity(s, "overworld", "raw") - 0.01,
    sync = (n(s, "M10") && enabled("M10") ? 1.3 : 1) * (s.rhythm > 0 ? 1.1 : 1);
  const access = transportAccess(s, "overworld");
  add(
    "M9",
    q(s, "M9") *
      6 *
      sync *
      (miningRoom && sourceHasRoute(s, "M9", "overworld") ? 1 : 0),
  );
  add(
    "M18",
    q(s, "M18") *
      4 *
      (miningRoom && sourceHasRoute(s, "M18", "overworld") ? 1 : 0),
  );
  add(
    "M2",
    q(s, "M2") *
      4 *
      sync *
      (access.processed &&
      s.buffers.overworld.goods < cap &&
      (raw > 0 || n(s, "M1") || n(s, "M9"))
        ? 1
        : 0),
  );
  add(
    "M8",
    q(s, "M8") *
      2 *
      ((access.processed &&
        s.buffers.overworld.goods < cap &&
        (raw > 0 || n(s, "M1") || n(s, "M9"))) ||
      (access.delivery && s.buffers.overworld.goods > 0) ||
      (miningRoom && s.harvest.piston > 0) ||
      s.community?.batches.length
        ? 1
        : 0),
    "overworld",
    "logistics",
  );
  add("M10", 0.2, "overworld", "automation");
  add(
    "M16",
    q(s, "M16") *
      0.75 *
      (raw > 0 || s.buffers.overworld.goods > 0 || n(s, "M1") || n(s, "M9")
        ? 1
        : 0),
    "overworld",
    "logistics",
  );
  add(
    "M4",
    0,
    "overworld",
    "logistics",
    raw > 0 || s.buffers.overworld.goods > 0,
  );
  add("M11", 0.1, "overworld", "automation");
  add("M12", 0.2, "overworld", "automation");
  add("M13", 0.3, "overworld", "automation");
  add("M19", 0.5, "overworld", "lighting");
  for (const [id, benefit] of Object.entries(POWER_BENEFITS)) {
    const cooldown = s.community?.tasks[benefit.task]?.cooldown || 0;
    // Charge only for time spent preparing a performance, including the last
    // partial simulation step. Listening to records never draws game energy.
    add(id, benefit.rate * Math.min(1, cooldown / ((1 + benefit.speed) * dt)),
      "overworld", "optional-boost");
  }
  add("M3", n(s, "M8") && miningRoom ? q(s, "M3") * 4 * sync : 0);
  for (const [key, id, rate] of [
    ["farm", "V4", 3],
    ["wool", "V9", 2],
    ["mine", "M1", 3],
  ]) {
    const task = s.community?.tasks[key],
      busy =
        !humanTaskInProgress(s, key) &&
        ((key === "mine" && miningRoom) ||
          s.harvest[key] >= 1 ||
          (task?.work || 0) > 0);
    const remaining =
      key === "mine" ? Infinity : Math.max(0, 3 * n(s, id) - (task?.work || 0));
    if (automation[key] && busy && n(s, id) && n(s, "M14") && n(s, "M10")) {
      loads.push({
        id: `auto-${key}`,
        name: `${key === "farm" ? "收割" : key === "wool" ? "剪毛" : "采集"}装置`,
        realm: "overworld",
        kind: "automation",
        rated: Math.min(
          rate * automation[key],
          (remaining * (key === "wool" ? 4 / 3 : 2)) / dt,
        ),
        connected: connected(id),
        enabled: enabled("M14") && enabled(id),
        actual: 0,
        fraction: 0,
      });
    }
  }
  for (const [key, id] of [
    ["music", "L1"],
    ["note", "M20"],
  ])
    if (
      g.automation[key] &&
      n(s, id) &&
      n(s, "M10") &&
      !humanTaskInProgress(s, key) &&
      !(s.community?.tasks[key]?.cooldown > 0)
    )
      loads.push({
        id: `auto-${key}`,
        name: ITEMS[id].name + "播放",
        realm: "overworld",
        kind: "automation",
        rated: Math.min(
          2,
          Math.max(0, 2 - (s.community?.tasks[key]?.work || 0)) / dt,
        ),
        connected: connected(id),
        enabled: enabled(id) && enabled("M10"),
        actual: 0,
        fraction: 0,
      });
  add("L2", 2, "overworld", "broadcast-base");
  add("L3", n(s, "L3") * 0.5, "overworld", "broadcast-extra");
  add("L5", 0.5, "overworld", "broadcast-extra");
  add("L10", s.live.director ? 1 : 0, "overworld", "broadcast-extra");
  add("L6", n(s, "L6") >= 3 ? 1 : 0, "overworld", "broadcast-extra");
  add("L12", 8, "overworld", "broadcast-extra");
  const netherWorking =
    s.buffers.nether.goods < storageCapacity(s, "nether") &&
    (s.buffers.nether.raw > 0 || n(s, "N3")) &&
    transportAccess(s, "nether").processed;
  const endWorking =
    s.buffers.end.goods < storageCapacity(s, "end") &&
    (s.buffers.end.raw > 0 || s.dimensions?.awaiting.endRaw > 0 || n(s, "E4"));
  add("N4", q(s, "N4") * 8 * (netherWorking ? 1 : 0), "nether");
  add(
    "N5",
    q(s, "N5") * 4 * (netherWorking && s.buffers.nether.raw > 0 ? 1 : 0),
    "nether",
  );
  add("N11", 0, "nether", "production", netherWorking);
  add(
    "N12",
    0,
    "nether",
    "logistics",
    s.buffers.overworld.goods > 0 &&
      s.buffers.nether.raw < storageCapacity(s, "nether", "raw"),
  );
  add("N10", q(s, "N10") * 16, "nether");
  add("E5", q(s, "E5") * 8 * (endWorking ? 1 : 0), "end", "logistics");
  add("E8", q(s, "E8") * 16 * (endWorking ? 1 : 0), "end");
  add(
    "E7",
    0,
    "end",
    "logistics",
    Object.keys(s.buffers).some(
      (r) => r !== s.transfer && s.buffers[r].raw > 0,
    ) && s.buffers[s.transfer].raw < storageCapacity(s, s.transfer, "raw"),
  );
  add(
    "E9",
    0,
    "end",
    "logistics",
    !!s.dimensions?.trips.E9 || s.buffers.end.goods > 0,
  );
  add("E10", 0, "end", "production", (s.harvest.brew || 0) < 1);
  add(
    "E11",
    0,
    "end",
    "production",
    s.buffers.end.raw < storageCapacity(s, "end", "raw"),
  );
  const bells = (s.community?.golems || []).filter(
    (x) => x.upgrades.bell,
  ).length;
  if (bells && n(s, "M13"))
    loads.push({
      id: "golem-bell",
      name: "铜傀儡呼叫铃",
      realm: "overworld",
      kind: "automation",
      rated: bells * 0.1,
      connected: true,
      enabled: enabled("M13"),
      actual: 0,
      fraction: 0,
    });
  for (const l of loads)
    if (
      (l.realm === "nether" && !n(s, "N1")) ||
      (l.realm === "end" && (!n(s, "E2") || s.endEyes !== 12))
    )
      l.enabled = false;
  if (n(s, "Z1") && dispatchMode(s) === "supply")
    for (const l of loads) l.rated *= 0.8;
  for (const l of loads) {
    const anchor = l.id.startsWith("auto-")
      ? { farm: "V4", wool: "V9", mine: "M1", music: "L1", note: "M20" }[
          l.id.slice(5)
        ]
      : l.id === "golem-bell"
        ? "M13"
        : l.id;
    const wire = gridConnection(s, anchor);
    l.lineLength = wire.length;
    l.inRange = wire.inRange;
    l.lossRate = wire.loss;
    l.required = l.rated / (1 - l.lossRate);
    l.loss = 0;
    l.state = g.disabled.includes(anchor)
      ? "off"
      : !l.inRange
        ? "out-of-range"
        : !wire.connected
          ? "not-connected"
          : l.rated
            ? "no-power"
            : "idle";
    if (l.kind === "broadcast-extra" && !enabled("L2")) l.enabled = false;
  }
  const demand = loads
      .filter((l) => l.enabled)
      .reduce((v, l) => v + l.required, 0),
    old = Math.min(capacity, Math.max(0, s.energy || 0));
  let available = old + supply * dt + crank;
  const isController = (l) => ["M10", "M11", "M12", "M13"].includes(l.id);
  const basic = loads.filter((l) => l.kind === "broadcast-base"),
    extras = loads.filter((l) => l.kind === "broadcast-extra"),
    controllers = loads.filter(isController),
    industry = loads.filter(
      (l) => !l.kind.startsWith("broadcast") && !isController(l),
    );
  const clearsStock = (l) =>
    l.kind !== "production" ||
    (["M2", "N4", "E8"].includes(l.id) && s.buffers[l.realm].raw > cap * 0.35);
  const groups = [
    basic,
    controllers,
    ...(n(s, "M12") && s.priority !== "balanced"
      ? [
          industry.filter(
            (l) => l.realm === s.priority || l.kind === s.priority,
          ),
          industry.filter(
            (l) => l.realm !== s.priority && l.kind !== s.priority,
          ),
        ]
      : n(s, "M12") && enabled("M12")
        ? [
            industry.filter(clearsStock),
            industry.filter((l) => !clearsStock(l)),
          ]
        : [industry]),
    extras,
  ];
  for (const group of groups) {
    const need =
        group.filter((l) => l.enabled).reduce((v, l) => v + l.required, 0) * dt,
      f = need ? Math.min(1, available / need) : 1;
    for (const l of group)
      if (l.enabled) {
        l.fraction = f;
        l.actual = l.rated * f;
        l.loss = (l.required - l.rated) * f;
        if (l.rated) l.state = f > 0 ? "working" : "no-power";
      }
    available = Math.max(0, available - need * f);
  }
  const consumed = loads.reduce((v, l) => v + (l.actual + l.loss) * dt, 0),
    stored = Math.min(capacity, available),
    spill = Math.max(0, available - capacity);
  const power = {},
    perDevice = {};
  for (const l of loads) perDevice[l.id] = l.rated > 0 ? l.fraction : 0;
  for (const realm of ["overworld", "nether", "end"]) {
    const a = loads.filter((l) => l.realm === realm),
      need = a.reduce((v, l) => v + l.rated, 0);
    power[realm] = need ? a.reduce((v, l) => v + l.actual, 0) / need : 1;
  }
  const result = {
    supply,
    demand,
    consumption: consumed / dt,
    capacity,
    stored,
    net: supply + crank / dt - consumed / dt,
    power,
    perDevice,
    automation,
    lineLoss: loads.reduce((sum, l) => sum + l.loss, 0),
    sources,
    loads,
    old,
    generated: supply * dt + crank,
    consumed,
    spill,
  };
  if (commit) {
    s.energy = stored;
    g.crank = Math.max(0, g.crank - dt);
    g.spent += consumed;
    g.generated += result.generated;
    if (s.dimensions)
      s.dimensions.recovered +=
        (sources.find((source) => source.id === "N4")?.rate || 0) * dt;
    g.spilled += spill;
    g.last = result;
  }
  return result;
}
export function restoreGrid(s, raw) {
  const g = freshGrid(),
    old = raw.grid || {};
  s.grid = g;
  restorePowerCompensation(s,raw,purchasedGenerationCapacity);
  g.autoConnect = old.autoConnect === true;
  g.learnedConnection =
    old.learnedConnection === true || (old.version !== 2 && !!n(s, "M5"));
  for (const key of ["spent", "generated", "spilled"])
    g[key] = Number.isFinite(old[key]) ? Math.max(0, old[key]) : 0;
  g.legacyStudioSupply =
    raw.version < 6 && n(s, "L2") && !n(s, "M6") && !n(s, "M7") && !n(s, "M15")
      ? 6
      : Math.min(6, Math.max(0, Number(old.legacyStudioSupply) || 0));
  g.migrationReach = Math.min(
    1024,
    Math.max(0, Number(old.migrationReach) || 0),
  );
  g.capacitor = Number.isInteger(old.capacitor)
    ? Math.max(0, Math.min(4, old.capacitor))
    : 0;
  s.energy = Math.min(
    gridCapacity(s),
    Number.isFinite(raw.energy) ? Math.max(0, raw.energy) : 0,
  );
  g.disabled = Array.isArray(old.disabled)
    ? [...new Set(old.disabled)].filter((x) => ITEMS[x] && s.counts[x])
    : [];
  if (old.links)
    for (const [id, v] of Object.entries(old.links))
      if (ITEMS[id] && [true, false, "legacy"].includes(v)) g.links[id] = v;
  if (!raw.grid)
    for (const id of Object.keys(s.placements)) g.links[id] = "legacy";
  if (raw.version < 6 && n(s, "M5")) {
    const lengths = Object.keys(s.placements)
      .filter((id) => old.links?.[id] !== false)
      .map((id) => wireRoute(s, id)?.length || 0);
    g.migrationReach = Math.min(
      1024,
      Math.max(
        g.migrationReach,
        Math.ceil(Math.max(0, ...lengths) - (16 + 8 * n(s, "M11"))),
      ),
    );
    for (const id of Object.keys(g.links))
      if (g.links[id] === "legacy") g.links[id] = true;
  }
  for (const key of ["farm", "wool", "mine"])
    configureAutomation(
      s,
      key,
      Math.min(
        n(s, "M14"),
        Math.max(0, Math.floor(old.automation?.[key] || 0)),
      ),
    );
  for (const key of ["music", "note"])
    g.automation[key] = !!old.automation?.[key] && !!n(s, "M10");
  if (!raw.grid && n(s, "M14"))
    g.automation[
      ["farm", "wool", "mine"].includes(raw.emitter) ? raw.emitter : "farm"
    ] = n(s, "M14");
}
