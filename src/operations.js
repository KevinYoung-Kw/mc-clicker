import {farmBranch,farmType,farmLocation,reconcileFarmWorkers,freshFarmProduction} from './farm-sites.js';
import {legacyGoodsFactor,legacyMusicFactor} from './training-balance.js';
import {workQuality} from './work-quality.js';
import {advanceResidentLife,lifeWorkFactor,cartFactor,serviceRange,serviceNode} from './villager-life.js';
import {homeDoors} from './housing-data.js';
import {dispatchMode} from './command-dispatch.js';
import {activeLevel} from './facility-storage.js';
import { creditMarketSale } from './market-work.js';
import { recordMarketSale } from './market-ledger.js';
import {
  ensureCommunity,
  JOBS,
  residentBase,
  skillFactor,
  studioStaffJob,
  jobAvailable,
} from "./residents.js";
import { ensureGrid, humanTaskInProgress } from "./power.js";
import { preparationSpeed } from "./power-benefits.js";
import { populationSupport } from "./population.js";
import { currentCrop } from "./collection.js";
import {
  upgradeMultiplier,
  storageCapacity,
  upgradeCapability,
  poweredUpgradeMultiplier,
} from "./upgrades.js";
import { Navigation, avoidsActors } from "./navigation.js";
import {
  footprint, localPoint, localOffset,
  scenery,
  worldScenery,
  sceneryObstacle,
  buildingObstacles,
  sceneryVisible,
} from "./layout.js";
import { waterObstacles } from "./terrain-data.js";
export const COMPANION_RADIUS = 0.22;
export const COMPANION_SPACING = 0.54;
const n = activeLevel;
export const TASKS = {
  farm: { id: "V4", name: "收割", work: 3 },
  wool: { id: "V9", name: "剪毛", work: 3 },
  treasure: { id: "V10", name: "收取宝藏", work: 3 },
  music: { id: "L1", name: "村庄演出", work: 2 },
  note: { id: "M20", name: "机器合奏", work: 2 },
  chorus: { id: "E4", name: "紫颂采收", work: 3 },
  brew: { id: "E10", name: "龙息酿造", work: 3 },
};
const SITE_TASKS = {...TASKS, milk: {id:"V8",name:"收取牛奶",work:3}};
// Milk batches belong only to additional pastures; the original cow remains passive.
export function taskState(s, key, siteId=null) {
  const site=farmBranch(s,siteId);
  const c = site ? (site.production ||= freshFarmProduction()) : ensureCommunity(s);
  return (c.tasks[key] ||= {
    work: 0,
    cooldown: 0,
    tend: 0,
    bonus: 0,
    cycle: 0,
    owners: {},
    tenders: {},
    manual: false,
  });
}
export function taskSize(s, key) {
  return Math.max(1, n(s, SITE_TASKS[key]?.id));
}
const harvestState=(s,siteId)=>farmBranch(s,siteId)?.production?.harvest||s.harvest;
export function taskReady(s, key, siteId=null) {
  return ["music", "note"].includes(key)
    ? taskState(s, key).cooldown <= 0
    : harvestState(s,siteId)[key] >= 1;
}
// Shared by production advancement and UI. Includes the same installed upgrades.
export function harvestPeriod(s, key, power) {
  if (key === "farm") return currentCrop(s).seconds * (n(s, "V5") ? 0.7 : 1) * upgradeMultiplier(s, "V4", "growthPeriod");
  if (key === "brew") return 60 * poweredUpgradeMultiplier(s, "E10", "brewPeriod", power);
  return { milk:30, wool: 35, treasure: 45, chorus: 45 }[key] || 8;
}
export function taskStatus(s, key, siteId=null) {
  const d = SITE_TASKS[key],
    t = taskState(s, key,siteId);
  if (!d || !n(s, d.id)) return "尚未建成";
  if (t.blocked) return "等待货物运走";
  if (t.pendingHarvest > 0) return "等待入库";
  if (t.work > 0)
    return `${d.name} ${Math.min(100, Math.floor((t.work / (d.work * taskSize(s, key))) * 100))}%`;
  if (t.cooldown > 0) return `还需 ${Math.ceil(t.cooldown)} 秒`;
  if (taskReady(s, key,siteId)) return "可以" + d.name;
  const seconds = harvestPeriod(s, key);
  return `还需 ${Math.ceil((1 - (harvestState(s,siteId)[key] || 0)) * seconds)} 秒`;
}
export function requestTask(s, key,siteId=null) {
  const d = SITE_TASKS[key],
    t = taskState(s, key,siteId);
  if (!d || !n(s, d.id)) return { ok: false, reason: "尚未建成对应设施" };
  if (t.pendingHarvest > 0) return { ok: false, reason: "本批收获正在等待入库" };
  if (!taskReady(s, key,siteId)) return { ok: false, reason: taskStatus(s, key,siteId) };
  if (t.manual) return { ok: false, reason: "正在完成这次工作" };
  t.manual = true;
  return { ok: true, text: `开始${d.name}`, value: 0 };
}
const paths = new WeakMap();
export function companionNavigation(s) {
  const signature = (s.layoutRevision || 0) + ":" + (n(s, "V2") >= 3) + ":" + (s.garden?.revision || 0);
  let cache = paths.get(s);
  if (cache?.signature === signature) return cache.nav;
  const obstacles = [{ minX: -0.72, maxX: 0.72, minZ: -0.72, maxZ: 0.72 }];
  for (const [id, p] of Object.entries(s.placements)) {
    if (p.realm !== "overworld") continue;
    obstacles.push(...buildingObstacles(id, p));
  }
  for (const p of worldScenery(s)) {
    if (!sceneryVisible(s, p)) continue;
    obstacles.push(...sceneryObstacle(p));
  }
  obstacles.push(...waterObstacles(s));
  const nav = new Navigation(s.chunks.overworld, obstacles);
  paths.set(s, { signature, nav });
  return nav;
}
function workplace(s, id) {
  // The music job remains L1; after opening the studio, its reachable outdoor
  // work point and collision footprint belong to the L2 entrance.
  return (id === "L1" || id === "L4") && n(s, "L2") ? "L2" : id;
}
export function companionTarget(s, id) {
  id = workplace(s, id);
  return (
    (farmBranch(s,id)&&!farmBranch(s,id).stored?farmBranch(s,id):null) ||
    s.placements[id] ||
    s.placements[id === "V7" ? "V4" : "M4"] ||
    s.placements.V3 || { x: 1.5, z: 1.5, realm: "overworld" }
  );
}
const actorContexts = new WeakMap();
const preparedPositions = new WeakMap();
export function companionActors(s) {
  let cached = actorContexts.get(s);
  if (
    cached &&
    cached.community === s.community &&
    cached.revision === s.community.revision &&
    cached.residentCount === n(s, "V2") &&
    cached.golemCount === n(s, "V15")
  )
    return cached.actors;
  const c = ensureCommunity(s),
    actors = [
      ...c.residents.filter(
        (r) => !r.reserve && r.room !== "studio" && !r.studioExit,
      ),
      ...c.golems,
    ];
  cached = {
    community: c,
    revision: c.revision,
    residentCount: n(s, "V2"),
    golemCount: n(s, "V15"),
    actors,
    others: new Map(),
  };
  for (const actor of actors)
    cached.others.set(
      actor,
      actors.filter((other) => other !== actor),
    );
  actorContexts.set(s, cached);
  return actors;
}
function companionOthers(s, actor) {
  companionActors(s);
  return actorContexts.get(s).others.get(actor) || [];
}
export function visibleCompanions(s, selected = null) {
  // New recruits already fit the unlocked land/services budget. Legacy crowded
  // saves keep a density limit, with up to four extra slots for golem helpers.
  const budget = Math.max(4, populationSupport(s).capacity) +
    Math.min(4, s.community?.golems.length || 0);
  return [...companionActors(s)]
    .sort(
      (a, b) =>
        (b.id === selected) - (a.id === selected) ||
        !!b.cargo - !!a.cargo ||
        (a.job === "idle") - (b.job === "idle") ||
        a.id.localeCompare(b.id, undefined, { numeric: true }),
    )
    .slice(0, budget);
}
const separation = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const hasRoom = (point, others) =>
  others.every((other) => separation(point, other) >= COMPANION_SPACING - 1e-8);
export function prepareCompanionPositions(s) {
  const c = ensureCommunity(s);
  for (const r of c.residents) {
    if (r.reserve || !r.studioExit) continue;
    const nav = companionNavigation(s),
      entry = companionTarget(s, "L2"),
      others = companionActors(s),
      point = nav.nearest(
        {
          x: entry.x,
          ...localPoint({...entry,rotation:s.placements.L2?.rotation},0,footprint("L2").d/2+COMPANION_RADIUS+.2),
        },
        COMPANION_RADIUS,
        null,
        others.map((a) => ({
          ...a,
          radius: COMPANION_SPACING - COMPANION_RADIUS - 0.035,
        })),
      );
    if (!point) {
      r.activity = "waiting";
      r.status = "等待入口空出位置";
      continue;
    }
    r.x = point.x;
    r.z = point.z;
    r.studioExit = false;
    r.destination = null;
    r.path = [];
    r.workSpot = null;
    r.parkingRevision = s.layoutRevision || 0;
    r.activity = r.job === "idle" ? "idle" : "travel";
    c.revision++;
  }
  const actors = companionActors(s),
    revision = s.layoutRevision || 0,
    cached = preparedPositions.get(s);
  if (
    cached?.actors === actors &&
    cached.layout === revision &&
    actors.every((a) => a.parkingRevision === revision)
  )
    return;
  const nav = companionNavigation(s),
    placed = [];
  for (const [index, a] of actors.entries()) {
    const park =
      (a.job === "idle" || (!a.job && !a.cargo)) &&
      a.parkingRevision !== (s.layoutRevision || 0);
    if (park || !nav.clear(a.x, a.z, COMPANION_RADIUS) || !hasRoom(a, placed)) {
      const chunk =
          s.chunks.overworld[(index * 7 + 1) % s.chunks.overworld.length],
        home = park
          ? {
              x: chunk.x * 5 + ((index % 3) - 1) * 1.4,
              z: chunk.z * 5 + (index % 2 ? 1.8 : -1.8),
            }
          : a;
      const roomy =
        park &&
        nav
          .grid(COMPANION_RADIUS)
          .nodes.filter((p) => nav.clear(p.x, p.z, 0.4) && hasRoom(p, placed));
      if (roomy)
        roomy.sort((x, y) => separation(x, home) - separation(y, home));
      const point =
        roomy?.[0] ||
        nav.nearest(
          home,
          COMPANION_RADIUS,
          null,
          placed.map((p) => ({
            ...p,
            radius: COMPANION_SPACING - COMPANION_RADIUS - 0.035,
          })),
        );
      if (point) {
        a.x = point.x;
        a.z = point.z;
        a.destination = null;
        a.path = [];
        a.workSpot = null;
      }
    }
    a.parkingRevision = s.layoutRevision || 0;
    placed.push(a);
  }
  preparedPositions.set(s, { actors, layout: revision });
}
// Dynamic occupancy is checked in the simulation, so reduced motion, hidden
// cameras and rendered workers all use exactly the same physical positions.
function trafficRoute(nav, actor, end, others) {
  const occupied = others.map((p) => ({
    ...p,
    radius: COMPANION_SPACING - COMPANION_RADIUS - 0.035,
  }));
  const { nodes } = nav.grid(COMPANION_RADIUS),
    start = nav.nearest(
      actor,
      COMPANION_RADIUS,
      null,
      others.map((p) => ({
        ...p,
        radius: COMPANION_SPACING - COMPANION_RADIUS - 0.035,
      })),
    );
  if (!start || !end || start.component !== end.component) return null;
  if (!nav.segment(actor, start, COMPANION_RADIUS)) return null;
  const queue = [start.index],
    parent = new Int32Array(nodes.length).fill(-1),
    blocked = new Int8Array(nodes.length);
  parent[start.index] = start.index;
  const available = (node) => {
    if (!blocked[node.index])
      blocked[node.index] = hasRoom(node, others) ? 1 : -1;
    return blocked[node.index] > 0;
  };
  for (let i = 0; i < queue.length && parent[end.index] < 0; i++) {
    const from = nodes[queue[i]];
    for (const index of from.neighbors) {
      const point = nodes[index];
      if (parent[index] >= 0 || !available(point)) continue;
      // These are cached grid neighbors: static clearance is already proven.
      if (!avoidsActors(from, point, COMPANION_RADIUS, occupied)) continue;
      parent[index] = queue[i];
      queue.push(index);
    }
  }
  if (parent[end.index] < 0) return null;
  const result = [];
  for (let at = end.index; at !== start.index; at = parent[at])
    result.push({ x: nodes[at].x, z: nodes[at].z });
  result.reverse();
  if (separation(actor, start) > 0.025)
    result.unshift({ x: start.x, z: start.z });
  return result;
}
function workSpot(s, a, target, dest) {
  const nav = companionNavigation(s),
    start = nav.nearest(a, COMPANION_RADIUS);
  if (!start) return null;
  const f = footprint(farmType(s,target),dest),
    others = companionOthers(s, a);
  const reserved = others.filter((p) => p.workSpot).map((p) => p.workSpot);
  const candidates = nav
    .grid(COMPANION_RADIUS)
    .nodes.filter(
      (p) =>
        p.component === start.component &&
        hasRoom(p, reserved) &&
        hasRoom(p, others) &&
        (!(target === "L2" && studioStaffJob(a, s)) ||
          (localOffset({...dest,rotation:s.placements.L2?.rotation},p).z >= footprint("L2").d / 2 + COMPANION_RADIUS - 0.05 &&
            Math.abs(localOffset({...dest,rotation:s.placements.L2?.rotation},p).x) <= footprint("L2").w / 2 + 0.8)) &&
        Math.max(
          0,
          Math.abs(p.x - dest.x) - f.w / 2,
          Math.abs(p.z - dest.z) - f.d / 2,
        ) <= 1.2,
    );
  candidates.sort(
    (x, y) =>
      separation(x, dest) - separation(y, dest) ||
      separation(x, a) - separation(y, a),
  );
  return candidates[0] || null;
}
function yieldTraffic(s, a, others) {
  const nav = companionNavigation(s),
    end = a.workSpot && nav.nearest(a.workSpot, COMPANION_RADIUS);
  if (!end) return;
  const corridor = nav.route(a, end, COMPANION_RADIUS);
  const blocker = others
    .filter(
      (p) =>
        corridor.some((point) => separation(p, point) < COMPANION_SPACING) &&
        !p.yielding,
    )
    .sort((x, y) => separation(x, a) - separation(y, a))[0];
  if (!blocker) return;
  // A working villager can step aside and resume the same job. Two approaching
  // couriers use stable identity priority, avoiding mutual "you first" waits.
  const preferred =
    !blocker.path?.length || blocker.job === "idle" || a.id < blocker.id
      ? blocker
      : a;
  // A worker in a one-person passage may have no side pocket. Let the
  // requester back up instead, using the same collision-checked movement.
  for (const yielding of [preferred, preferred === a ? blocker : a]) {
    const approaching = yielding === a ? blocker : a;
    const occupied = companionOthers(s, yielding),
      start = nav.nearest(yielding, COMPANION_RADIUS);
    if (!start) continue;
    const avoid = yielding === a ? approaching.path || corridor : corridor;
    const options = nav
      .grid(COMPANION_RADIUS)
      .nodes.filter(
        (p) =>
          p.component === start.component &&
          separation(p, yielding) > COMPANION_SPACING &&
          separation(p, yielding) < 2.4 &&
          hasRoom(p, occupied) &&
          !avoid.some((q) => separation(p, q) < COMPANION_SPACING),
      );
    options.sort((x, y) => separation(x, yielding) - separation(y, yielding));
    for (const point of options.slice(0, 12)) {
      const path = trafficRoute(nav, yielding, point, occupied);
      if (!path?.length) continue;
      yielding.path = path;
      yielding.yielding = true;
      yielding.yieldSpot = { x: point.x, z: point.z };
      yielding.destination = null;
      yielding.workSpot = null;
      yielding.status = "让出通道";
      yielding.activity = "travel";
      return;
    }
  }
}
function moveCompanion(s, a, dt, speed) {
  const nav = companionNavigation(s),
    others = companionOthers(s, a);
  let distance = dt * speed;
  while (distance > 0 && a.path?.length) {
    const point = a.path[0],
      d = separation(point, a),
      step = Math.min(distance, d, 0.08);
    const next =
      d < 1e-8
        ? point
        : {
            x: a.x + ((point.x - a.x) * step) / d,
            z: a.z + ((point.z - a.z) * step) / d,
          };
    if (!nav.segment(a, next, COMPANION_RADIUS) || !hasRoom(next, others)) {
      a.activity = "waiting";
      a.trafficWait = (a.trafficWait || 0) + dt;
      a.blockedFor = (a.blockedFor || 0) + dt;
      if (a.trafficWait >= 0.5) {
        const goal = a.yielding ? a.yieldSpot : a.workSpot,
          end = goal && nav.nearest(goal, COMPANION_RADIUS),
          alternate = end && trafficRoute(nav, a, end, others);
        if (alternate?.length) a.path = alternate;
        else if (!a.yielding) yieldTraffic(s, a, others);
        else if (a.blockedFor > 3) {
          a.yielding = false;
          a.path = [];
          a.destination = null;
          a.workSpot = null;
          a.blockedFor = 0;
        }
        a.trafficWait = 0;
      }
      return false;
    }
    a.x = next.x;
    a.z = next.z;
    a.trafficWait = 0;
    a.blockedFor = 0;
    distance -= step;
    if (d <= step + 1e-8) a.path.shift();
  }
  return !a.path?.length;
}
function arrivedAtWork(s, a) {
  if (!a.workSpot || separation(a, a.workSpot) > 0.26) return false;
  const otherSlots = companionOthers(s, a)
    .filter((p) => p.workSpot)
    .map((p) => p.workSpot);
  if (!hasRoom(a, otherSlots)) return false;
  // A worker already within arm's reach uses that free standing spot instead
  // of demanding the last grid step from a courier coming the other way.
  a.workSpot = { x: a.x, z: a.z };
  a.path = [];
  return true;
}
function travel(s, a, target, dt, speed = 1.4) {
  a.activity = a.cargo ? "carrying" : "travel";
  target = workplace(s, target);
  if (a.yielding) {
    a.status = "让出通道";
    if (moveCompanion(s, a, dt, speed)) {
      a.yielding = false;
      a.yieldUntil = s.play + 1.5;
    }
    return false;
  }
  if (a.yieldUntil > s.play) {
    a.status = "等待通道空闲";
    a.activity = "waiting";
    return false;
  }
  const dest = companionTarget(s, target),
    key = `${target}:${dest.x}:${dest.z}`;
  if (a.destination !== key || a.routeRevision !== (s.layoutRevision || 0)) {
    a.workTour = false;
    a.workMoveAt = 0;
    const nav = companionNavigation(s),
      start = nav.nearest(a, COMPANION_RADIUS),
      end = start && workSpot(s, a, target, dest);
    if (!start || !end) {
      a.status = "等待可通行道路";
      a.activity = "waiting";
      return false;
    }
    a.workSpot = { x: end.x, z: end.z };
    a.path =
      trafficRoute(nav, a, end, companionOthers(s, a)) ||
      nav.route(a, end, COMPANION_RADIUS).map((p) => ({ x: p.x, z: p.z }));
    a.destination = key;
    a.routeRevision = s.layoutRevision || 0;
    const f = footprint(farmType(s,target),dest);
    if (
      Math.max(
        0,
        Math.abs(end.x - dest.x) - f.w / 2,
        Math.abs(end.z - dest.z) - f.d / 2,
      ) > 1.2
    ) {
      a.destination = null;
      a.path = [];
      a.status = "道路未连通";
      a.activity = "waiting";
      return false;
    }
  }
  return (
    arrivedAtWork(s, a) || moveCompanion(s, a, dt, speed) || arrivedAtWork(s, a)
  );
}
function enterStudio(s, r, dt) {
  if (r.room === "studio") return true;
  if (!r.studioEntry) {
    r.studioEntry = true;
    r.handover = 2;
    r.destination = null;
    r.path = [];
    r.workSpot = null;
  }
  r.status = "前往直播间入口";
  if (!travel(s, r, "L2", dt)) return false;
  r.activity = "handover";
  r.status = "在入口交接岗位";
  r.handover = Math.max(0, r.handover - dt);
  if (r.handover > 0) return false;
  r.room = "studio";
  r.studioEntry = false;
  r.destination = null;
  r.path = [];
  r.workSpot = null;
  r.yielding = false;
  r.activity = "working";
  s.community.revision++;
  return true;
}
const WORK_ROUNDS = {
  merchant: { seconds: 11, status: "整理货架", speed: .55 },
  farmer: { seconds: 6, status: "沿田埂照料作物", speed: 0.6 },
  rancher: { seconds: 9, status: "沿畜栏查看羊群", speed: 0.65 },
  miner: { seconds: 10, status: "更换采掘位置", speed: 0.7 },
  crafter: { seconds: 12, status: "检查炉料与成品", speed: 0.6 },
  engineer: { seconds: 14, status: "巡看音符线路", speed: 0.55 },
  musician: { seconds: 15, status: "调整演出位置", speed: 0.55 },
  stagehand: { seconds: 10, status: "检查节目准备", speed: 0.65 },
};
function inWorkArea(point, dest, f) {
  return (
    Math.max(
      0,
      Math.abs(point.x - dest.x) - f.w / 2,
      Math.abs(point.z - dest.z) - f.d / 2,
    ) <= 0.95
  );
}
function planWorkRound(s, r, job) {
  const routine = WORK_ROUNDS[r.job];
  if (
    !routine ||
    r.room === "studio" ||
    r.path?.length ||
    r.yielding ||
    r.yieldUntil > s.play
  )
    return;
  const seed = Number(r.id.split("-")[1]) || 1;
  if (!r.workMoveAt) r.workMoveAt = s.play + routine.seconds + (seed % 5);
  if (s.play < r.workMoveAt) return;
  r.workTour = false;
  r.workMoveAt = s.play + routine.seconds + ((seed + (r.workRound || 0)) % 5);
  const nav = companionNavigation(s),
    start = nav.nearest(r, COMPANION_RADIUS),
    others = companionOthers(s, r),
    dest = companionTarget(s, job.target),
    f = footprint(farmType(s,workplace(s,job.target)),dest);
  if (!start) return;
  const reserved = others.filter((a) => a.workSpot).map((a) => a.workSpot),
    direction = seed * 1.7 + (r.workRound || 0) * 2.4,
    wanted =
      r.job === "farmer"
        ? localPoint({...dest,rotation:dest.rotation},0,((r.workRound||0)%2?-.5:.5))
        : {
            x: dest.x + Math.cos(direction) * (f.w / 2 + 0.45),
            z: dest.z + Math.sin(direction) * (f.d / 2 + 0.45),
          };
  const choices = nav
    .grid(COMPANION_RADIUS)
    .nodes.filter(
      (p) =>
        p.component === start.component &&
        inWorkArea(p, dest, f) &&
        separation(p, r) >= 0.65 &&
        separation(p, r) <= 2.4 &&
        hasRoom(p, others) &&
        hasRoom(p, reserved),
    );
  choices.sort((a, b) => separation(a, wanted) - separation(b, wanted));
  r.workRound = (r.workRound || 0) + 1;
  for (const point of choices.slice(0, 12)) {
    const path = trafficRoute(nav, r, point, others);
    if (
      !path?.length ||
      path.length > 14 ||
      !path.every((p) => inWorkArea(p, dest, f))
    )
      continue;
    r.path = path;
    r.workSpot = { x: point.x, z: point.z };
    r.workTour = true;
    return;
  }
}
function attendWorkplace(s, r, job, dt) {
  const arrived = travel(
    s,
    r,
    job.target,
    dt,
    r.workTour ? WORK_ROUNDS[r.job]?.speed || 0.6 : 1.4,
  );
  if (arrived) {
    r.workTour = false;
    planWorkRound(s, r, job);
    return true;
  }
  // Local inspection is part of the job. Initial commuting and yielding do not
  // contribute work; walking around a workplace never mints a separate reward.
  if (!r.workTour || r.yielding || r.yieldUntil > s.play) return false;
  if (r.blockedFor > 1) {
    r.path = [];
    r.workSpot = { x: r.x, z: r.z };
    r.workTour = false;
    r.workMoveAt = s.play + 8;
  }
  return true;
}
function wander(s, r, dt) {
  r.status = "自由活动 · 完整基础收入";
  r.activity = "idle";
  if (r.yieldUntil > s.play) return;
  if (r.destination === "wander" && r.path?.length) {
    r.activity = "travel";
    if (!moveCompanion(s, r, dt, 0.65)) return;
    r.destination = null;
    r.workSpot = null;
    r.activity = "idle";
    r.wanderAt = s.play + 12 + (Number(r.id.split("-")[1]) % 7);
    return;
  }
  r.workSpot = null;
  if (!r.wanderAt) r.wanderAt = s.play + 4 + (Number(r.id.split("-")[1]) % 8);
  if (s.play < r.wanderAt) return;
  const nav = companionNavigation(s),
    start = nav.nearest(r, COMPANION_RADIUS),
    others = companionOthers(s, r);
  r.wanderAt = s.play + 12;
  if (!start) return;
  const angle = Number(r.id.split("-")[1]) * 1.7 + (r.wanderCount || 0) * 2.4,
    desired = {
      x: r.x + Math.cos(angle) * 1.25,
      z: r.z + Math.sin(angle) * 1.25,
    },
    options = nav
      .grid(COMPANION_RADIUS)
      .nodes.filter(
        (p) =>
          p.component === start.component &&
          separation(p, r) >= 0.7 &&
          separation(p, r) <= 1.7 &&
          hasRoom(p, others) &&
          !others.some(
            (a) => a.workSpot && separation(p, a.workSpot) < COMPANION_SPACING,
          ),
      );
  options.sort((a, b) => separation(a, desired) - separation(b, desired));
  r.wanderCount = (r.wanderCount || 0) + 1;
  for (const point of options.slice(0, 8)) {
    const route = trafficRoute(nav, r, point, others);
    // A short stroll must not choose a long detour around an entire building.
    if (!route?.length || route.length > 20) continue;
    r.path = route;
    r.workSpot = { x: point.x, z: point.z };
    r.destination = "wander";
    r.activity = "travel";
    moveCompanion(s, r, dt, 0.65);
    break;
  }
}
function stockLimit(s, source) {
  return storageCapacity(s) * upgradeMultiplier(s, source, "buffer");
}
export function localStock(s, id) {
  return ensureCommunity(s)
    .batches.filter((b) => b.source === id)
    .reduce((v, b) => v + b.qty, 0);
}
function ownersFor(t) {
  const out = {},
    sum = Object.values(t.owners).reduce((a, b) => a + b, 0),
    tsum = Object.values(t.tenders).reduce((a, b) => a + b, 0);
  for (const [id, v] of Object.entries(t.owners))
    if (id !== "manual" && id !== "machine")
      out[id] = (out[id] || 0) + (0.85 * v) / Math.max(1, sum) / (1 + t.bonus);
  for (const [id, v] of Object.entries(t.tenders))
    out[id] =
      (out[id] || 0) +
      (((0.85 * v) / Math.max(1, tsum)) * t.bonus) / (1 + t.bonus);
  return out;
}
export function enqueueBatch(
  s,
  source,
  label,
  qty,
  value,
  owners = {},
  kind = "goods",
  origin = null,
) {
  const c = ensureCommunity(s);
  if (
    c.batches.length >= 200 ||
    localStock(s, source) + qty > Math.max(stockLimit(s, source), qty) + 1e-8
  )
    return false;
  c.batches.push({
    id: `batch-${++c.serial}`,
    source,
    origin,
    label,
    kind,
    qty,
    value: value * workQuality(s,owners),
    owners,
    haulOwners: {},
    delivered: 0,
    claimed: null,
    at: s.play,
  });
  return true;
}
function pay(s, value, owners, api, priced=false) {
  if (!priced) value *= workQuality(s,owners);
  if (!(value > 0)) return;
  api.earn(s, value, 'jobs');
  const c = ensureCommunity(s);
  c.jobIncome += value;
  for (const [id, fraction] of Object.entries(owners)) {
    const r = c.residents.find((x) => x.id === id);
    if (r) r.jobEarned += value * Math.min(1, Math.max(0, fraction));
  }
}
function finishTask(s, key, api, siteId=null) {
  const c = ensureCommunity(s),
    t = taskState(s, key,siteId),
    scale = taskSize(s, key),
    owners = ownersFor(t),
    training = legacyGoodsFactor(s);
  if (key === "farm" || key === "wool" || key === "milk") {
    const crop = currentCrop(s),
      cropValues = {
        wheat: [24, 4],
        carrot: [36, 6],
        potato: [48, 8],
        beet: [72, 10],
        pumpkin: [104, 14],
      },
      v = cropValues[crop.id] || cropValues.wheat;
    const amount =
        (key === "farm" ? v[0] : key === "milk" ? 12 : 8) *
        scale *
        (1 + t.bonus) *
        (n(s, "V6") ? 1.4 : 1) *
        upgradeMultiplier(s, key === "farm" ? "V4" : "V7", "harvest"),
      value = (key === "farm" ? v[1] : 8) * upgradeMultiplier(s,key === "farm" ? "V4" : "V7","localValue") * training;
    if (
      !enqueueBatch(
        s,
        key === "farm" ? "V4" : "V7",
        key === "farm" ? crop.name : key === "milk" ? "牛奶" : "羊毛",
        amount,
        value,
        owners,
        key === "farm" ? crop.id : key === "milk" ? "milk" : "wool",
        siteId,
      )
    )
      {t.blocked=true;return false;}
  } else if (key === "music") {
    if(s.life)s.life.lastPerformance=s.play;
    const people = Object.keys(t.owners)
        .map((id) => c.residents.find((x) => x.id === id))
        .filter(Boolean),
      quality = people.length
        ? people.reduce((v, r) => v + skillFactor(r, "music"), 0) /
          people.length
        : 1;
    const value = 4 * legacyMusicFactor(s) * quality,
      total = Object.values(t.owners).reduce((a, b) => a + b, 0);
    pay(
      s,
      value,
      Object.fromEntries(
        Object.entries(t.owners)
          .filter(([id]) => id !== "manual" && id !== "machine")
          .map(([id, v]) => [id, v / Math.max(1, total)]),
      ),
      api,
    );
  } else if (key === "note") {
    s.rhythm = 4;
  } else if (key === "treasure") {
    const value = 40 * scale * training;
    pay(s, value, owners, api);
  } else if (key === "chorus") {
    const room = Math.max(
      0,
      storageCapacity(s, "end", "raw") - s.buffers.end.raw,
    );
    // Lock a picked batch once, then admit only what fits. An upgrade or reload
    // during unloading must not recalculate (or award) the same harvest again.
    if (!(t.pendingHarvest > 0))
      t.pendingHarvest = 20 * scale * upgradeMultiplier(s, "E4", "harvest") *
        upgradeCapability(s, "E4", "chain", 1);
    const admitted = Math.min(room, t.pendingHarvest);
    s.buffers.end.raw += admitted;
    t.pendingHarvest = Math.max(0, t.pendingHarvest - admitted);
    if (t.pendingHarvest > 1e-8) return false;
    t.pendingHarvest = 0;
    if (s.dimensions) s.dimensions.chorusWave = s.play;
  } else if (key === "brew")
    s.burst = Math.max(
      s.burst,
      15 * poweredUpgradeMultiplier(s, "E10", "boostDuration"),
    );
  if (["music", "note"].includes(key)) t.cooldown = 8;
  else harvestState(s,siteId)[key] = 0;
  for (const id of new Set([
    ...Object.keys(t.owners),
    ...Object.keys(t.tenders),
  ])) {
    const r = c.residents.find((x) => x.id === id);
    if (r) r.jobsDone++;
  }
  if (!t.owners.manual) s.autoActions++;
  s.harvestCount++;
  const completion = api.emit(
    s,
    key === "music" || key === "note" ? "live" : "harvest",
    `${SITE_TASKS[key].name}完成${key === "farm" || key === "wool" ? " · 货物等待转运" : ""}`,
    key === "chorus" || key === "brew" ? "end" : "overworld",
  );
  if (completion) {
    completion.manualTask = !!t.owners.manual;
    completion.facility = SITE_TASKS[key].id;
  }
  if (t.owners.manual && n(s, "T11")) s.charge = Math.min(100, s.charge + 2);
  t.work = 0;
  t.blocked = false;
  t.manual = false;
  t.bonus = 0;
  t.tend = 0;
  t.owners = {};
  t.tenders = {};
  t.cycle++;
  return true;
}
function contribute(s, key, amount, by, api, siteId=null) {
  const t = taskState(s, key,siteId),
    need = SITE_TASKS[key].work * taskSize(s, key);
  const done = Math.max(0, Math.min(amount, need - t.work));
  t.work += done;
  t.owners[by] = (t.owners[by] || 0) + done;
  if (t.work >= need - 1e-8) finishTask(s, key, api,siteId);
}
function runCargo(s, a, dt, api, isGolem = false) {
  const c = ensureCommunity(s),
    capacity = isGolem
      ? 16 * 2 ** a.upgrades.basket
      : 12 * skillFactor(a, "hauling") * upgradeMultiplier(s, "V11", "jobWork") * cartFactor(s,a) * lifeWorkFactor(s,a),
    target = s.placements.M4 ? "M4" : s.placements.V3 ? "V3" : "home";
  if (a.cargo) {
    a.status = "抱箱送往交接点";
    if (!travel(s, a, target, dt, isGolem ? 1.6 : 1.4)) return;
    a.activity = "handover";
    a.progress += dt;
    if (a.progress < 1) return;
    a.progress = 0;
    if (a.cargo.gift) {
      api.collectGift(s, a.cargo.gift);
      a.cargo = null;
      a.trips = (a.trips || 0) + 1;
      a.destination = null;
      return;
    }
    if (a.cargo.treasure !== undefined) {
      const t = taskState(s, "treasure");
      if (taskReady(s, "treasure") && t.cycle === a.cargo.treasure) {
        t.owners = { machine: 3 };
        t.work = 3 * taskSize(s, "treasure");
        finishTask(s, "treasure", api);
      }
      c.treasureClaim = null;
      a.cargo = null;
      a.destination = null;
      return;
    }
    const b = c.batches.find((x) => x.id === a.cargo.id);
    if (b) {
      const take = Math.min(a.cargo.qty, b.qty - b.delivered);
      b.delivered += take;
      b.claimed = null;
      b.haulOwners ||= {};
      b.haulOwners[a.id] = (b.haulOwners[a.id] || 0) + take;
      a.lastDelivery = {source:b.source, target, qty:take, at:s.play};
      if (isGolem) {
        a.delivered += take;
        a.trips++;
        if (a.trips === 100)
          api.emit(s, "live", `${a.name}已经送完 100 趟货物`, "overworld");
      } else a.jobsDone++;
    }
    a.cargo = null;
    a.destination = null;
    a.status = "交付完成";
    a.activity = "handover";
    return;
  }
  if (
    isGolem &&
    a.wait > 0 &&
    !(a.upgrades.bell && (s.grid.last?.perDevice["golem-bell"] || 0) > 0)
  ) {
    a.wait = Math.max(0, a.wait - dt);
    a.status = "巡回检查中";
    a.activity = "waiting";
    return;
  }
  const stops = isGolem ? a.stops : a.job === "stagehand" ? ["L2"] : null;
  let list = c.batches.filter(
    (b) =>
      b.qty - b.delivered > 1e-6 &&
      !b.claimed &&
      (!stops || stops.includes(b.source)),
  );
  if ((isGolem && a.mode === "events") || a.job === "stagehand") list = [];
  list.sort((x, y) =>
    !isGolem && a.prioritySource && (x.source === a.prioritySource) !== (y.source === a.prioritySource)
      ? Number(y.source === a.prioritySource) - Number(x.source === a.prioritySource)
      : isGolem && a.upgrades.sorting
      ? localStock(s, y.source) - localStock(s, x.source) || x.at - y.at
      : x.at - y.at,
  );
  let b = list[0];
  if (b) {
    a.status = `前往${b.label}取货点`;
    if (!travel(s, a, farmBranch(s,b.origin)&&!farmBranch(s,b.origin).stored?b.origin:b.source, dt, isGolem ? 1.6 : 1.4)) return;
    a.activity = "handover";
    a.progress += dt;
    if (a.progress < 1) return;
    a.progress = 0;
    if (b.claimed) return;
    b.claimed = a.id;
    a.cargo = { id: b.id, qty: Math.min(capacity, b.qty - b.delivered) };
    a.activity = "carrying";
    a.destination = null;
    return;
  }
  if ((isGolem && a.mode !== "cargo") || a.job === "stagehand") {
    if (stops.includes("L2")) {
      const gift = s.live.gifts.find((x) => !x.claimed);
      if (gift) {
        a.status = "前往礼物站";
        if (!travel(s, a, "L2", dt, 1.6)) return;
        gift.claimed = a.id;
        a.cargo = { gift: gift.id };
        a.activity = "carrying";
        a.destination = null;
        return;
      }
    }
    if (
      stops.includes("V7") &&
      n(s, "V10") &&
      taskReady(s, "treasure") &&
      !c.treasureClaim
    ) {
      a.status = "去取猪找到的宝藏";
      if (!travel(s, a, "V7", dt, 1.6)) return;
      c.treasureClaim = a.id;
      a.cargo = { treasure: taskState(s, "treasure").cycle };
      a.activity = "carrying";
      a.destination = null;
      return;
    }
  }
  a.status = "等待就绪的取货任务";
  a.activity = "waiting";
  if (isGolem) a.wait = 2;
}
function moveToRest(s,r,service,dt,first){
  if(r.room==='studio')return false;
  if(first){
    const home=s.housing?.homes.find(h=>h.id===s.housing.assignments[r.id]?.homeId);
    const destination=service?serviceNode(s,service):home?homeDoors(home)[0]:null;
    if(!destination||Math.hypot(destination.x-r.x,destination.z-r.z)>(service?serviceRange(s,destination?.type):4))return false;
    const nav=companionNavigation(s),start=nav.nearest(r,COMPANION_RADIUS),end=nav.nearest(destination,COMPANION_RADIUS,start?.component);
    if(!start||!end||Math.hypot(end.x-destination.x,end.z-destination.z)>1.2)return false;
    const route=nav.route(r,end,COMPANION_RADIUS);
    if(!route.length||route.reduce((v,p,i)=>v+Math.hypot(p.x-(route[i-1]||r).x,p.z-(route[i-1]||r).z),0)>6)return false;
    r.path=route.map(p=>({x:p.x,z:p.z}));r.destination='life:'+String(service||home.id);
    return null;
  }
  return moveCompanion(s,r,dt,1.1)?true:null;
}
export function advanceFarmSites(s,dt){
 for(const p of s.life?.sites||[]){
  if(!['V4','V7'].includes(p.type)||p.stored||!n(s,p.type))continue;
  const production=p.production||=freshFarmProduction();
  for(const key of p.type==='V4'?['farm']:['milk','wool','treasure'])if(n(s,SITE_TASKS[key].id))
    production.harvest[key]=Math.min(1,production.harvest[key]+dt/harvestPeriod(s,key));
 }
}
export function advanceOperations(s, dt, api, power) {
  const c = ensureCommunity(s),
    grid = ensureGrid(s);
  const assigned = power.automation || grid.automation;
  reconcileFarmWorkers(s);
  prepareCompanionPositions(s);
  if (c.navigationRevision !== s.layoutRevision) {
    const nav = companionNavigation(s);
    for (const a of companionActors(s)) {
      if (!nav.clear(a.x, a.z, COMPANION_RADIUS)) {
        const node = nav.nearest(a, COMPANION_RADIUS);
        if (node) {
          a.x = node.x;
          a.z = node.z;
        }
      }
      a.destination = null;
      a.path = [];
      a.workSpot = null;
      a.yielding = false;
      a.yieldSpot = null;
      a.yieldUntil = 0;
      a.blockedFor = 0;
      a.trafficWait = 0;
    }
    c.navigationRevision = s.layoutRevision;
  }
  for (const a of companionActors(s)) {
    if (a.yielding) {
      a.status = "让出通道";
      a.activity = "travel";
      a.yieldStep = s.play;
      if (moveCompanion(s, a, dt, 1.4)) {
        a.yielding = false;
        a.yieldUntil = s.play + 1.5;
      }
    }
  }
  for (const r of c.residents) {
    const income = residentBase(s, r) * dt;
    api.earn(s, income, 'base');
    r.baseEarned += income;
    c.baseIncome += income;
  }
  for (const p of s.life?.sites||[]) if(!p.stored&&n(s,p.type)&&p.production)
    for(const key of Object.keys(p.production.tasks))if(taskState(s,key,p.id).manual&&taskReady(s,key,p.id))contribute(s,key,3*dt,'manual',api,p.id);
  for (const key of Object.keys(TASKS)) {
    const t = taskState(s, key);
    if(!n(s,SITE_TASKS[key].id))continue;
    t.cooldown = Math.max(0, t.cooldown - dt * preparationSpeed(SITE_TASKS[key].id, power));
    if (key === "chorus" && t.pendingHarvest > 0) {
      finishTask(s, key, api);
      continue;
    }
    if (t.manual && taskReady(s, key))
      contribute(s, key, 3 * dt, "manual", api);
  }
  for (const r of c.residents) {
    if (r.reserve) {
      r.activity = "idle";
      continue;
    }
    if (r.studioExit || r.yieldStep === s.play) continue;
    if(advanceResidentLife(s,r,dt,{move:(actor,service,seconds,first)=>moveToRest(s,actor,service,seconds,first)}))continue;
    if (r.job === "idle") {
      wander(s, r, dt);
      continue;
    }
    if (!jobAvailable(s, r.job)) {
      r.activity = "waiting";
      r.status = "等待对应工作设施";
      continue;
    }
    const staff = studioStaffJob(r, s);
    if (staff && !enterStudio(s, r, dt)) continue;
    if (!staff && r.handover > 0) {
      r.handover = Math.max(0, r.handover - dt);
      r.status = "交接岗位";
      r.activity = "handover";
      continue;
    }
    if (
      r.job === "hauler" ||
      (r.job === "stagehand" &&
        (r.cargo || s.live.gifts.some((g) => !g.claimed)))
    ) {
      runCargo(s, r, dt, api);
      continue;
    }
    const site=farmLocation(s,r),siteId=site?.id.startsWith("civic:")?site.id:null;
    const job = {...JOBS[r.job],target:site?.id||JOBS[r.job].target};
    const jobEfficiency =
      upgradeMultiplier(s, farmType(s,job.target), "jobWork") *
      upgradeMultiplier(s, "V11", "jobWork") * lifeWorkFactor(s,r);
    r.status = `前往${job.name}工作点`;
    if (!staff && !attendWorkplace(s, r, job, dt)) continue;
    r.activity = "working";
    r.workplaceId = job.target;
    if(r.job === "researcher"){
      r.status=s.research?.active?"查阅资料 · 加快研究":"等待选择研究项目";
      r.activity=s.research?.active?"working":"waiting";
    } else if (r.job === "merchant") {
      const goods=s.buffers.overworld.goods+c.batches.reduce((sum,b)=>sum+(b.delivered||0),0);
      r.status=goods>0?"接货结款":"等待货物送到";
      r.activity=goods>0?"working":"waiting";
    } else if (r.job === "host") {
      r.status = s.live.host > 0 ? "主持特别环节" : "在直播间主持节目";
      r.progress += dt;
      if (r.progress >= 25) {
        r.jobsDone += Math.floor(r.progress / 25);
        r.progress %= 25;
      }
      // The live-income settlement attributes the actual uplift to this
      // resident. Animation and completed segments never mint extra money.
    } else if (r.job === "farmer" || r.job === "rancher") {
      const key =
          r.job === "farmer" ? "farm" : siteId && n(s,"V8") && taskReady(s,"milk",siteId) && !taskState(s,"wool",siteId).work ? "milk" : n(s, "V9") ? "wool" : siteId&&n(s,"V8") ? "milk" : "treasure",
        t = taskState(s, key,siteId),
        size = taskSize(s, key);
      if (!n(s, SITE_TASKS[key].id)) {
        r.status = "等待购买动物";
        r.activity = "waiting";
        continue;
      }
      if (!taskReady(s, key,siteId) && t.tend < 1) {
        const work = Math.min((dt * jobEfficiency) / (4 * size), 1 - t.tend);
        t.tend += work;
        t.bonus += 0.2 * skillFactor(r, job.skill) * work;
        t.tenders[r.id] = (t.tenders[r.id] || 0) + work;
        r.status = "照料 " + Math.floor(t.tend * 100) + "%";
      } else if (taskReady(s, key,siteId) && (!(!siteId && assigned[key]) || t.owners[r.id])) {
        r.status = SITE_TASKS[key].name + "中";
        contribute(s, key, dt * jobEfficiency, r.id, api,siteId);
      } else {
        r.status = (!siteId && assigned[key])
          ? "种植管理 · 等待机器收获"
          : taskStatus(s, key,siteId);
        r.activity = "waiting";
      }
      if (
        r.job === "rancher" &&
        n(s, "V10") &&
        taskReady(s, "treasure",siteId) &&
        (siteId||!c.treasureClaim)
      ) {
        r.status = "收取宝藏";
        r.activity = "working";
        contribute(s, "treasure", dt, r.id, api,siteId);
      }
    } else if (r.job === "musician" || r.job === "engineer") {
      const key = r.job === "musician" ? "music" : "note";
      r.status = taskStatus(s, key);
      r.activity = taskReady(s, key) ? "working" : "waiting";
      if (
        taskReady(s, key) &&
        (!assigned[key] || taskState(s, key).owners[r.id])
      )
        contribute(s, key, dt * jobEfficiency, r.id, api);
      if (assigned[key] && !taskState(s, key).owners[r.id]) {
        r.progress += dt;
        r.status = "准备特别演出";
        r.activity = "working";
        if (r.progress >= 30) {
          r.progress = 0;
          pay(s, 8 * skillFactor(r, "music"), { [r.id]: 1 }, api);
          r.jobsDone++;
          api.emit(s, "live", `${r.name}的特别演出`, "overworld");
        }
      }
    } else if (r.job === "miner" || r.job === "crafter") {
      r.progress += dt;
      r.status = r.job === "miner" ? "开采矿料" : "精制货物";
      if (r.progress >= 4) {
        const craft = r.job === "crafter",
          qty = 4 * skillFactor(r, job.skill) * jobEfficiency,
          source = craft ? "M2" : "M1";
        if (craft && s.buffers.overworld.raw < qty) {
          r.status = "等待原料";
          r.activity = "waiting";
          r.progress = 4;
          continue;
        }
        if (
          enqueueBatch(
            s,
            source,
            craft ? "精制品" : "矿料",
            qty,
            craft ? 8 * upgradeMultiplier(s,"M2","localValue") * legacyGoodsFactor(s) : 1,
            { [r.id]: 0.85 },
          )
        ) {
          if (craft) s.buffers.overworld.raw -= qty;
          r.progress = 0;
          r.jobsDone++;
        } else {
          r.progress = 4;
          r.status = "待转运 · 货堆已满";
          r.activity = "waiting";
        }
      }
    } else if (r.job === "stagehand") {
      r.progress += dt * jobEfficiency;
      r.status = "准备下一场特别节目";
      if (r.progress >= 25) {
        r.progress = 0;
        s.live.heat = Math.min(40, s.live.heat + 4);
        pay(s, 8 * skillFactor(r, "music"), { [r.id]: 1 }, api);
        r.jobsDone++;
        api.emit(s, "live", `${r.name}准备好了一场村庄节目`, "overworld");
      }
    }
  }
  // Locomotion wins over the working pose, including branches waiting on stock.
  for (const r of c.residents) {
    if (r.workTour && r.path?.length && !r.yielding) {
      r.activity = r.blockedFor > 0 ? "waiting" : "travel";
      r.status =
        r.blockedFor > 0
          ? "等待通道空闲"
          : WORK_ROUNDS[r.job]?.status || r.status;
    }
  }
  for (const key of ["farm", "wool", "music", "note"]) {
    const units = assigned[key];
    if (!units || !taskReady(s, key) || humanTaskInProgress(s, key)) continue;
    const factor = power.perDevice[`auto-${key}`] || 0;
    const actual = power.loads.find((l) => l.id === `auto-${key}`)?.actual || 0;
    const energyPerWork =
      (key === "farm" ? 2 : key === "wool" ? 4 / 3 : 1) *
      (n(s, "Z1") && dispatchMode(s) === "supply" ? 0.8 : 1);
    if (factor > 0)
      contribute(s, key, (dt * actual) / energyPerWork, "machine", api);
  }
  if (assigned.mine && (power.perDevice["auto-mine"] || 0) > 0) {
    const cap = storageCapacity(s, "overworld", "raw"),
      amount = 3 * assigned.mine * dt * power.perDevice["auto-mine"];
    s.buffers.overworld.raw += Math.min(
      amount,
      Math.max(0, cap - s.buffers.overworld.raw),
    );
  }
  for (const g of c.golems)
    if (g.yieldStep !== s.play) runCargo(s, g, dt, api, true);
}
export function sellCommunity(s, dt, haul, trade, hopperPower, api) {
  const c = ensureCommunity(s);
  let remainingHaul = Math.max(0, haul * dt),
    remainingTrade = Math.max(0, trade * dt),
    sold = 0;
  for (const b of c.batches) {
    // Baseline sales box handles small batches; powered hoppers use the allocated network capacity.
    const direct = Math.min(
      Math.max(0, b.qty - b.delivered - (b.claimed ? b.qty - b.delivered : 0)),
      remainingHaul,
      Math.max(1, 12 * n(s, "M8") * hopperPower) * dt,
    );
    b.delivered += direct;
    remainingHaul -= direct;
    const amount = Math.min(b.delivered, remainingTrade);
    if (amount <= 0) continue;
    const orderAmount =
      api.deliverOrders?.(s, "overworld", amount, {
        kind: b.kind || "goods",
        owners: b.owners,
      }) || 0;
    const money = (amount - orderAmount) * b.value;
    const commission = creditMarketSale(s, money);
    const owners = Object.fromEntries(Object.entries(b.owners).map(([id,f])=>[id,f*(1-commission)]));
    pay(s, money, owners, api, true);
    recordMarketSale(s, { source: `community:${b.source}:${b.kind}`, label: b.label, realm: 'overworld', quantity: amount - orderAmount, money });
    const haulSum = Object.values(b.haulOwners || {}).reduce(
      (x, y) => x + y,
      0,
    );
    if (haulSum)
      for (const [id, count] of Object.entries(b.haulOwners)) {
        const r = c.residents.find((x) => x.id === id);
        if (r) r.jobEarned += (money * (1-commission) * 0.15 * count) / haulSum;
      }
    b.qty -= amount;
    b.delivered -= amount;
    remainingTrade -= amount;
    sold += amount;
    c.shipped += amount;
  }
  c.batches = c.batches.filter((b) => b.qty > 1e-7);
  return sold;
}
