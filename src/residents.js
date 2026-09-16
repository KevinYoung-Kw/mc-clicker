import {farmLocations,reconcileFarmWorkers} from './farm-sites.js';
import {trainingFactor} from './training-balance.js';
import {isResting} from './villager-life.js';
import {activeLevel} from './facility-storage.js';
// Identity and work survive rendering limits. Legacy reserves keep B and personal history.
const n = activeLevel;
import { RESIDENT_LIMIT, LEGACY_RESIDENT_LIMIT } from "./population.js";
import { recordNarrativeAction } from './narrative-behavior.js';
export { RESIDENT_LIMIT, LEGACY_RESIDENT_LIMIT } from "./population.js";
export const HAUL_SOURCES = ["V4", "V7", "M1", "M2", "M3"];
const num = (v, max = 1e100) =>
  Number.isFinite(v) ? Math.min(max, Math.max(0, v)) : 0;
export const PROFESSIONS = {
  farming: "农艺",
  ranching: "牧养",
  hauling: "物流",
  mining: "采掘",
  crafting: "工艺",
  music: "演出",
};
export const JOBS = {
  researcher: {name:'研究员',skill:'crafting',target:'V11',desc:'到图书馆加快研究。没有研究员时，已投入的研究也会继续。'},
  idle: {
    name: "自由活动",
    skill: null,
    target: null,
    desc: "在村庄自由活动，也会自动赚取绿宝石。",
  },
  farmer: {
    name: "农民",
    skill: "farming",
    target: "V4",
    desc: "每位农民照料一片田，成熟后自动收割。麦田 3／6 级可增建，共享种子和改造。",
  },
  rancher: {
    name: "牧工",
    skill: "ranching",
    target: "V7",
    desc: "牧工分到各自的畜栏收取产物。畜栏 2／4 级可增建；动物品种与改造共享。",
  },
  merchant: {
    name: "售货员", skill: "hauling", target: "V3",
    desc: "到集市卖货，提高结款速度。货物实际售出后计入工作收入；没货时不额外发钱。",
  },
  hauler: {
    name: "搬运工",
    skill: "hauling",
    target: "M4",
    desc: "把货物从工作地点送到交货点。售出后，计入这位村民的工作收入。",
  },
  miner: {
    name: "矿工",
    skill: "mining",
    target: "M1",
    desc: "开采矿料。矿料运走、卖出后，计入工作收入。",
  },
  crafter: {
    name: "工匠",
    skill: "crafting",
    target: "M2",
    desc: "把矿料加工成更值钱的货物。运走、卖出后，计入工作收入。",
  },
  musician: {
    name: "乐师",
    skill: "music",
    target: "L1",
    desc: "自动完成唱片机演出，赚取绿宝石。建成直播间后会搬进室内。",
  },
  host: {
    name: "主持人",
    skill: "music",
    target: "L4",
    desc: "进入直播间主持节目，提高节目效果和直播收入。",
  },
  engineer: {
    name: "音序师",
    skill: "music",
    target: "M20",
    desc: "自动完成机器合奏，让机器加速 10%，持续 4 秒。也可交给红石自动触发。",
  },
  stagehand: {
    name: "场务",
    skill: "music",
    target: "L2",
    desc: "准备特别节目、提高热度、赚取绿宝石，也会帮忙收礼物。",
  },
};
export const SKIN = [
  "#c6966f",
  "#a97752",
  "#e0b38b",
  "#885b40",
  "#bc8d61",
  "#d7a984",
];
export const HAIR = [
  "#514032",
  "#78543a",
  "#b18350",
  "#343a39",
  "#c1b39b",
  "#916749",
];
export const COATS = [
  "#729782",
  "#b17b56",
  "#7794ac",
  "#a28aaf",
  "#c0a05c",
  "#7e9670",
  "#b58188",
  "#738e96",
  "#aa9170",
  "#969da9",
];
const names = [
  "阿木",
  "小石",
  "麦芽",
  "阿栗",
  "豆豆",
  "青禾",
  "小榆",
  "阿墨",
  "小陶",
  "松子",
  "铜铃",
  "小满",
  "云杉",
  "南瓜",
  "小桥",
  "阿芦",
  "木棉",
  "小麦",
  "石榴",
  "阿蓝",
];
export const escapeHtml = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function appearance(index) {
  return {
    skin: index % 6,
    hair: Math.floor(index / 6) % 6,
    coat: index % 10,
    style: Math.floor(index / 3) % 4,
    beard: index % 5 === 0,
    glasses: index % 7 === 3,
    height: [0.96, 1, 1.04][index % 3],
  };
}
export function newResident(index) {
  return {
    id: `resident-${index + 1}`,
    name:
      names[index % names.length] +
      (index < names.length ? "" : `·${Math.floor(index / names.length) + 1}`),
    look: appearance(index),
    job: "idle",
    reserve: false,
    previousJob: "idle",
    skills: {},
    baseEarned: 0,
    jobEarned: 0,
    jobsDone: 0,
    status: "在村庄散步",
    activity: "idle",
    room: null,
    studioEntry: false,
    studioExit: false,
    wanderAt: 0,
    wanderCount: 0,
    handover: 0,
    progress: 0,
    x: 1.4,
    z: 1.4,
    path: [],
    destination: null,
    cargo: null,
    visits: 0,
  };
}
export function newGolem(index) {
  return {
    id: `golem-${index + 1}`,
    name: ["铜豆", "小铜", "铜铃", "阿锈", "铜芽", "铜米"][index],
    mode: "all",
    stops: ["V4", "V7", "M2", "L2"].slice(0, 2),
    upgrades: { basket: 0, route: 0, sorting: 0, bell: 0 },
    x: 1.4,
    z: 1.4,
    path: [],
    destination: null,
    cargo: null,
    progress: 0,
    delivered: 0,
    trips: 0,
    status: "等待取货",
    visits: 0,
  };
}
export function freshCommunity() {
  return {
    residents: [],
    golems: [],
    tasks: {},
    batches: [],
    serial: 0,
    revision: 0,
    baseIncome: 0,
    jobIncome: 0,
    shipped: 0,
    lastIncome: 0,
  };
}
export function ensureCommunity(s) {
  if (!s.community) s.community = freshCommunity();
  const c = s.community;
  while (c.residents.length < n(s, "V2")) {
    c.residents.push(newResident(c.residents.length));
    c.revision++;
  }
  while (c.golems.length < n(s, "V15")) {
    c.golems.push(newGolem(c.golems.length));
    c.revision++;
  }
  c.residents.length = Math.min(c.residents.length, n(s, "V2"));
  c.golems.length = Math.min(c.golems.length, n(s, "V15"));
  normalizeResidentRoster(s);
  for (const r of c.residents)
    if (r.room === "studio" && !studioStaffJob(r, s)) leaveStudio(s, r);
  return c;
}
// Assignment reserves a seat; only a completed entrance handover puts the
// actual resident in the room. No purchase ever creates an anonymous worker.
export function studioStaffJob(r, s) {
  if (!r || r.reserve || !n(s, "L2")) return null;
  if (r.job === "host" && n(s, "L4")) return "host";
  if (r.job === "musician" && n(s, "L1")) return "musician";
  return null;
}
export function studioResidents(s) {
  return ensureCommunity(s).residents.filter(
    (r) =>
      r.room === "studio" &&
      !r.studioExit &&
      !r.handover &&
      !r.cargo &&
      studioStaffJob(r, s),
  );
}
export function activeHost(s) {
  return studioResidents(s).find((r) => r.job === "host" && !isResting(s,r)) || null;
}
function leaveStudio(s, r) {
  if (r.room !== "studio") return;
  r.room = null;
  // The movement system admits this resident outdoors only once a collision-
  // free entrance position is available. Reservists wait until recalled.
  r.studioExit = true;
  r.studioEntry = false;
  r.handover = 0;
  r.path = [];
  r.destination = null;
  resetTraffic(r);
  r.activity = "handover";
  s.community.revision++;
  if (r.job === "host") {
    s.live.host = 0;
    s.live.hostHeat = 0;
  }
}
// Keep paid-for identities in legacy saves. Only a compact team lives/works here.
function normalizeResidentRoster(s) {
  const c = s.community;
  const target = Math.min(RESIDENT_LIMIT, c.residents.length);
  const active = c.residents.filter((r) => !r.reserve);
  if (active.length === target) return;
  const score = (r) =>
    (r.cargo ? 1e9 : 0) +
    (r.job !== "idle" ? 1e6 : 0) +
    (r.name !== newResident(Number(r.id.split("-")[1]) - 1).name ? 1e5 : 0) +
    Object.values(r.skills).reduce(
      (sum, level) => sum + Math.max(0, level - 1),
      0,
    ) *
      1000;
  if (active.length > target) {
    const keep = new Set(
      [...active]
        .sort((a, b) => score(b) - score(a))
        .slice(0, target)
        .map((r) => r.id),
    );
    for (const r of active) if (!keep.has(r.id)) parkResident(s, r);
  } else {
    for (const r of c.residents
      .filter((r) => r.reserve)
      .slice(0, target - active.length))
      r.reserve = false;
  }
  c.revision++;
}
function resetTraffic(r) {
  Object.assign(r, {
    workTour: false,
    workMoveAt: 0,
    workRound: 0,
    workSpot: null,
    yielding: false,
    yieldSpot: null,
    yieldUntil: 0,
    blockedFor: 0,
    trafficWait: 0,
    parkingRevision: -1,
  });
}
function parkResident(s, r) {
  leaveStudio(s, r);
  r.reserve = true;
  r.previousJob = r.job;
  r.job = "idle";
  r.status = "轮休 · 保留完整基础收入";
  r.destination = null;
  r.path = [];
  resetTraffic(r);
  r.progress = 0;
  r.handover = 0;
  r.studioEntry = false;
  r.activity = "idle";
  if (r.cargo) {
    for (const b of s.community.batches)
      if (b.claimed === r.id) b.claimed = null;
    for (const g of s.live.gifts) if (g.claimed === r.id) g.claimed = null;
    if (s.community.treasureClaim === r.id) s.community.treasureClaim = null;
    r.cargo = null;
  }
}
export function activeResidents(s) {
  return ensureCommunity(s).residents.filter((r) => !r.reserve);
}
export function recallResident(s, incomingId, outgoingId) {
  const c = ensureCommunity(s),
    incoming = c.residents.find((r) => r.id === incomingId),
    outgoing = c.residents.find((r) => r.id === outgoingId);
  if (!incoming?.reserve || !outgoing || outgoing.reserve)
    return { ok: false, reason: "选择一位驻村同伴与它换班" };
  if (outgoing.cargo)
    return { ok: false, reason: "这位同伴正在送货，交付后才能换班" };
  parkResident(s, outgoing);
  incoming.reserve = false;
  incoming.job = "idle";
  incoming.handover = 0;
  incoming.activity = incoming.studioExit ? "handover" : "idle";
  incoming.destination = null;
  incoming.path = [];
  resetTraffic(incoming);
  incoming.status = "回到村庄 · 可以安排工作";
  c.revision++;
  s.layoutRevision++;
  return { ok: true, text: `${incoming.name}回村了，${outgoing.name}开始轮休` };
}
export function jobAvailable(s, job) {
  const j = JOBS[job];
  if (!j) return false;
  if (job === "idle") return true;
  if (job === "hauler") return !!(n(s, "M4") || n(s, "V3"));
  if (job === "host") return !!(n(s, "L2") && n(s, "L4"));
  return !!n(s, j.target);
}
export function jobSlots(s, job) {
  if (job === "idle") return RESIDENT_LIMIT;
  if (job === "host" || job === "researcher") return 1;
  if(job==='farmer'||job==='rancher'){
    const places=farmLocations(s,JOBS[job].target).length;
    const retained=(s.community?.residents||[]).filter(r=>!r.reserve&&r.job===job).length;
    return Math.max(places,retained);
  }
  // Early cargo has several collection points. Two helpers can split these;
  // storage Lv.3 opens the third slot without raising the late-game maximum.
  if (job === "hauler") return n(s, "M4") >= 3 ? 3 : 2;
  const count = n(s, JOBS[job]?.target) || 1;
  return count >= 6 ? 3 : count >= 3 ? 2 : 1;
}
export function fullJobReason(s, job) {
  if(job==='farmer'||job==='rancher')return '工作地点已满；到设施详情增建麦田或畜栏后再安排村民';
  if (job === "host") return "主持席已有同伴，请先为它换岗";
  if (job === "hauler") return n(s, "M4") >= 3
    ? "3 个搬运岗位已满，可给现有搬运工学习物流技能"
    : "2 个搬运岗位已满；储物箱达到 3 级可再安排 1 人";
  return "岗位已满；设施达到 3 / 6 级可增加名额";
}
export function assignJob(s, id, job) {
  const c = ensureCommunity(s),
    r = c.residents.find((x) => x.id === id);
  if (r?.reserve)
    return { ok: false, reason: "这位同伴正在轮休，先换班回村再安排工作" };
  if (!r || !jobAvailable(s, job))
    return { ok: false, reason: "先建成这个岗位对应的设施" };
  if (
    job !== "idle" &&
    c.residents.filter((x) => !x.reserve && x.id !== id && x.job === job)
      .length >= jobSlots(s, job)
  )
    return {
      ok: false,
      reason: fullJobReason(s, job),
    };
  if (r.job === job) return { ok: true };
  if (r.cargo) return { ok: false, reason: "正在运送货物，交付后即可换岗" };
  leaveStudio(s, r);
  r.job = job;
  r.farmSiteId=null;
  reconcileFarmWorkers(s);
  r.workplaceId = null;
  if (job !== "hauler") r.prioritySource = null;
  r.studioEntry = false;
  r.handover = job === "idle" ? 0 : 2;
  r.activity = job === "idle" ? "idle" : "handover";
  r.wanderAt = s.play + 4;
  r.progress = 0;
  r.path = [];
  resetTraffic(r);
  r.destination = null;
  r.status = job === "idle" ? "在村庄散步" : "准备上岗";
  c.revision++;
  recordNarrativeAction(s,'assignment',{id,job});
  return {
    ok: true,
    text: `${r.name}已${job === "idle" ? "回到自由活动" : "成为" + JOBS[job].name}`,
  };
}
// A preference on the existing job, never a second independent worker/task.
export function prioritizeHauling(s, residentId, source) {
  const r = ensureCommunity(s).residents.find((x) => x.id === residentId);
  if (!r || r.reserve) return { ok: false, reason: "先选择一位驻村同伴" };
  if (source !== null && (!HAUL_SOURCES.includes(source) || !n(s, source)))
    return { ok: false, reason: "先建成可取货的设施" };
  if (r.cargo) return { ok: false, reason: "正在交货，交付后可调整优先取货点" };
  if (source !== null) {
    const assigned = assignJob(s, residentId, "hauler");
    if (!assigned.ok) return assigned;
  }
  r.prioritySource = source;
  r.path = [];
  r.destination = null;
  r.progress = 0;
  ensureCommunity(s).revision++;
  return {
    ok: true,
    text: source ? `${r.name}会优先来这里取货` : "已取消优先，继续搬运其他货物",
  };
}
export function renameCompanion(s, id, name) {
  const c = ensureCommunity(s),
    a = [...c.residents, ...c.golems].find((r) => r.id === id);
  const clean = String(name)
    .replace(/[\x00-\x1f\x7f]/g, "")
    .trim();
  if (!a || !clean || Array.from(clean).length > 12)
    return { ok: false, reason: "昵称需要 1–12 个字符" };
  a.name = clean;
  c.revision++;
  return { ok: true, text: "昵称已保存" };
}
export function skillLevel(r, skill = JOBS[r.job]?.skill) {
  return r.skills?.[skill] || 1;
}
export function skillFactor(r, skill) {
  return 1 + 0.25 * (skillLevel(r, skill) - 1);
}
export function trainingPrice(r, skill) {
  return [0, 200, 800, 3200, 12800][skillLevel(r, skill)] || 0;
}
export function trainResident(s, id, skill) {
  const c = ensureCommunity(s),
    r = c.residents.find((x) => x.id === id);
  if (!r || !PROFESSIONS[skill] || !n(s, "V11"))
    return { ok: false, reason: "图书管理员到来后可以购买个人技能书" };
  const level = skillLevel(r, skill),
    cost = trainingPrice(r, skill);
  if (level >= 5) return { ok: false, reason: "这个专业已经达到大师等级" };
  if (level >= 3 && !n(s, "V13"))
    return { ok: false, reason: "全村大师培训后开放 Lv.4–5" };
  if (s.money < cost) return { ok: false, reason: "绿宝石还不够" };
  s.money -= cost;
  r.skills[skill] = level + 1;
  c.revision++;
  return {
    ok: true,
    text: `${r.name}学会了${PROFESSIONS[skill]} Lv.${level + 1}`,
  };
}
export function residentBase(s, r) {
  const count = n(s, "V2"),
    scale = count >= 25 ? 3 : count >= 10 ? 1.8 : count >= 5 ? 1.25 : 1;
  const localValue = n(s, "N11") ? 32 : n(s, "M2") ? 8 : n(s, "T7") ? 3 : 1;
  const level = Math.max(1, ...Object.values(r.skills || {}));
  return (
    scale *
    trainingFactor(s) *
    localValue *
    (1 + 0.1 * (level - 1))
  );
}
export function baseIncome(s) {
  return ensureCommunity(s).residents.reduce(
    (sum, r) => sum + residentBase(s, r),
    0,
  );
}
export const GOLEM_UPGRADES = {
  basket: {
    name: "大背篓",
    prices: [1200, 4800],
    desc: "容量 16 → 32 → 64 份，背篓随升级变大",
  },
  route: {
    name: "巡回路线牌",
    prices: [500, 2000],
    desc: "取货点上限 2 → 4 → 6",
  },
  sorting: {
    name: "分拣标签",
    prices: [2500],
    needs: "M4",
    desc: "先取临近满载的货物，减少生产停顿",
  },
  bell: {
    name: "红石呼叫铃",
    prices: [1800],
    needs: "M13",
    desc: "有电时立即接到就绪呼叫，消耗 0.1 E/s",
  },
};
export function upgradeGolem(s, id, key) {
  const c = ensureCommunity(s),
    g = c.golems.find((x) => x.id === id),
    u = GOLEM_UPGRADES[key];
  if (!g || !u) return { ok: false, reason: "找不到这个升级" };
  const cost = u.prices[g.upgrades[key] || 0];
  if (cost === undefined) return { ok: false, reason: "已完成升级" };
  if (u.needs && !n(s, u.needs))
    return {
      ok: false,
      reason: `尚未解锁${key === "bell" ? "侦测器" : "储物箱"}`,
    };
  if (s.money < cost) return { ok: false, reason: "绿宝石还不够" };
  s.money -= cost;
  g.upgrades[key]++;
  c.revision++;
  return { ok: true, text: `${g.name} · ${u.name}升级了` };
}
export function setGolemRoute(s, id, stops, mode = "all") {
  const c = ensureCommunity(s),
    g = c.golems.find((x) => x.id === id);
  if (!g) return { ok: false, reason: "找不到这位帮手" };
  const valid = [...new Set(stops)].filter(
    (x) => ["V4", "V7", "M2", "M1", "L2", "M3"].includes(x) && n(s, x),
  );
  if (valid.length > 2 + 2 * g.upgrades.route)
    return { ok: false, reason: "路线牌容量不足" };
  g.stops = valid;
  g.mode = ["all", "cargo", "events"].includes(mode) ? mode : "all";
  // An in-flight shipment still belongs to its original destination and owners.
  // The saved collection range is consulted when the next trip starts.
  if (!g.cargo) {
    g.path = [];
    g.destination = null;
  }
  c.revision++;
  return { ok: true, text: g.cargo ? "已保存，送完这趟货后按新范围巡收" : "巡收范围已保存" };
}
export function portrait(r) {
  const a = r.look || appearance(0),
    skin = SKIN[a.skin % 6],
    hair = HAIR[a.hair % 6],
    coat = COATS[a.coat % 10];
  const job = r.job,
    hat =
      job === "farmer"
        ? "#d5b45f"
        : job === "miner"
          ? "#c5c5aa"
          : ["crafter","merchant"].includes(job)
            ? "#5f757c"
            : null;
  return `<svg viewBox="0 0 32 36" aria-hidden="true" shape-rendering="crispEdges"><path fill="${coat}" d="M5 26h22v10H5z"/><path fill="${skin}" d="M8 5h16v21H8z"/><path fill="${hair}" d="M8 4h16v4H8zM8 7h${3 + a.style}v${3 + a.style}H8z"/><path fill="#514234" d="M9 12h14v2H9z"/><path fill="#eef0d9" d="M10 15h4v3h-4zM18 15h4v3h-4z"/><path fill="#4d775d" d="M12 15h2v3h-2zM18 15h2v3h-2z"/><path fill="${skin}" d="M14 17h4v8h-4z"/><path fill="#775442" d="M14 24h4v2h-4z"/>${a.beard ? `<path fill="${hair}" d="M9 22h4v4h6v-4h4v7H9z"/>` : ""}${a.glasses ? '<path fill="none" stroke="#354541" d="M9 14h6v5H9zM17 14h6v5h-6zM15 16h2"/>' : ""}${hat ? `<path fill="${hat}" d="M5 5h22v3H5zM9 1h14v4H9z"/>` : ""}${job === "musician" || job === "engineer" || job === "host" ? '<path fill="#3d5c64" d="M6 10h3v11H6zM23 10h3v11h-3zM8 3h16v3H8z"/>' : ""}${["rancher","crafter","merchant"].includes(job) ? '<path fill="#e2d2ad" d="M11 27h10v9H11z"/>' : ""}<path fill="#e6bd70" d="M23 29h3v3h-3z"/></svg>`;
}
export function restoreCommunity(s, raw) {
  const c = freshCommunity(),
    old = raw.community || {};
  s.community = c;
  for (let i = 0; i < n(s, "V2"); i++) {
    const r = newResident(i),
      saved = Array.isArray(old.residents)
        ? old.residents.find((x) => x?.id === r.id)
        : null;
    if (saved) {
      r.name = String(saved.name || r.name)
        .replace(/[\x00-\x1f]/g, "")
        .slice(0, 24);
      for (const skill of Object.keys(PROFESSIONS))
        r.skills[skill] = Math.max(
          1,
          Math.floor(num(saved.skills?.[skill], 5)),
        );
      r.job = jobAvailable(s, saved.job) ? saved.job : "idle";
      r.prioritySource =
        r.job === "hauler" &&
        HAUL_SOURCES.includes(saved.prioritySource) &&
        n(s, saved.prioritySource)
          ? saved.prioritySource
          : null;
      if (
        saved.lastDelivery &&
        HAUL_SOURCES.includes(saved.lastDelivery.source) &&
        Number.isFinite(saved.lastDelivery.qty)
      )
        r.lastDelivery = {
          source: saved.lastDelivery.source,
          target: ["M4", "V3", "home"].includes(saved.lastDelivery.target)
            ? saved.lastDelivery.target
            : "home",
          qty: num(saved.lastDelivery.qty),
          at: num(saved.lastDelivery.at),
        };
      r.farmSiteId = typeof saved.farmSiteId==='string' && /^(V[47]|civic:[1-9]\d*)$/.test(saved.farmSiteId)?saved.farmSiteId:null;
      r.reserve = saved.reserve === true;
      r.previousJob = JOBS[saved.previousJob] ? saved.previousJob : "idle";
      if (r.reserve) r.job = "idle";
      for (const key of ["x", "z"])
        if (Number.isFinite(saved[key]) && Math.abs(saved[key]) < 100)
          r[key] = saved[key];
      r.progress = num(saved.progress, 60);
      r.handover = num(saved.handover, 2);
      if (
        c.residents.filter((x) => !x.reserve && x.job === r.job).length >=
        ((r.job==='farmer'||r.job==='rancher')?3:jobSlots(s, r.job))
      )
        r.job = "idle";
      if (saved.room === "studio" && studioStaffJob(r, s)) {
        r.room = "studio";
        r.handover = 0;
        r.activity = "working";
        r.status = r.job === "host" ? "在直播间主持节目" : "在直播间演出";
      } else if (saved.room === "studio" || saved.studioExit) {
        r.studioExit = true;
        r.activity = r.reserve ? "idle" : "handover";
      }
      for (const key of ["baseEarned", "jobEarned", "jobsDone", "visits"])
        r[key] = num(saved[key]);
    }
    c.residents.push(r);
  }
  for (let i = 0; i < n(s, "V15"); i++) {
    const g = newGolem(i),
      saved = Array.isArray(old.golems)
        ? old.golems.find((x) => x?.id === g.id)
        : null;
    if (saved) {
      for (const key of ["x", "z"])
        if (Number.isFinite(saved[key]) && Math.abs(saved[key]) < 100)
          g[key] = saved[key];
      g.name = String(saved.name || g.name).slice(0, 24);
      for (const key in GOLEM_UPGRADES)
        g.upgrades[key] = Math.floor(
          num(saved.upgrades?.[key], GOLEM_UPGRADES[key].prices.length),
        );
      g.stops = Array.isArray(saved.stops)
        ? [...new Set(saved.stops)]
            .filter((x) => ["V4", "V7", "M2", "M1", "L2", "M3"].includes(x))
            .slice(0, 2 + 2 * g.upgrades.route)
        : g.stops;
      g.mode = ["all", "cargo", "events"].includes(saved.mode)
        ? saved.mode
        : "all";
      g.delivered = num(saved.delivered);
      g.trips = num(saved.trips);
    }
    c.golems.push(g);
  }
  c.serial = Math.floor(num(old.serial, 1e12));
  c.baseIncome = num(old.baseIncome);
  c.jobIncome = num(old.jobIncome);
  c.shipped = num(old.shipped);
  // In-flight cargo remains in its batch; restore releases claims without losing stock.
  const seen = new Set();
  for (const b of Array.isArray(old.batches) ? old.batches.slice(0, 256) : []) {
    if (
      !b ||
      typeof b.id !== "string" ||
      seen.has(b.id) ||
      !Number.isFinite(b.qty) ||
      b.qty <= 0
    )
      continue;
    seen.add(b.id);
    const owners = {};
    for (const [id, v] of Object.entries(b.owners || {}))
      if (c.residents.some((r) => r.id === id)) owners[id] = num(v, 1);
    const fractionSum = Object.values(owners).reduce((a, b) => a + b, 0);
    if (fractionSum > 0.85)
      for (const id in owners) owners[id] *= 0.85 / fractionSum;
    c.serial = Math.max(
      c.serial,
      Number(b.id.match(/^batch-(\d+)$/)?.[1]) || 0,
    );
    c.batches.push({
      id: b.id.slice(0, 40),
      source: ["V4", "V7", "M2", "M1", "M3"].includes(b.source)
        ? b.source
        : "V4",
      origin: typeof b.origin==='string'&&/^civic:[1-9]\d*$/.test(b.origin)?b.origin:null,
      label: String(b.label || "货物").slice(0, 24),
      kind: ["wheat", "carrot", "potato", "beet", "pumpkin", "wool", "milk"].includes(
        b.kind,
      )
        ? b.kind
        : "goods",
      qty: num(b.qty, 1e9),
      value: num(b.value, 1e20),
      haulOwners: Object.fromEntries(
        Object.entries(b.haulOwners || {}).filter(
          ([id, v]) =>
            Number.isFinite(v) &&
            (c.residents.some((r) => r.id === id) ||
              c.golems.some((g) => g.id === id)),
        ),
      ),
      delivered: Math.min(num(b.qty), num(b.delivered)),
      owners,
      claimed: null,
      at: num(b.at),
    });
  }
  for (const key of [
    "farm",
    "wool",
    "treasure",
    "music",
    "note",
    "piston",
    "chorus",
    "brew",
  ]) {
    const t = old.tasks?.[key];
    if (!t) continue;
    c.tasks[key] = {
      work: num(t.work, 1000),
      cooldown: num(t.cooldown, 180),
      tend: Math.min(1, num(t.tend)),
      bonus: num(t.bonus, 4),
      cycle: Math.floor(num(t.cycle, 1e12)),
      pendingHarvest: key === "chorus" && s.counts.E4 ? num(t.pendingHarvest, 1e30) : 0,
      owners: {},
      tenders: {},
      manual: false,
    };
    for (const field of ["owners", "tenders"])
      for (const [id, v] of Object.entries(t[field] || {}))
        if (c.residents.some((r) => r.id === id))
          c.tasks[key][field][id] = num(v, 1e9);
  }
  if (!raw.community) {
    c.tasks.music = {
      work: 0,
      cooldown: num(raw.harvest?.note, 8),
      tend: 0,
      bonus: 0,
      cycle: 0,
      owners: {},
      tenders: {},
    };
    c.tasks.note = { ...c.tasks.music, owners: {}, tenders: {} };
  }
  normalizeResidentRoster(s);
  return c;
}
