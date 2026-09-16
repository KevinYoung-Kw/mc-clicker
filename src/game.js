import { ACHIEVEMENTS, restoreAchievements } from './achievements.js';
export { ACHIEVEMENTS } from './achievements.js';
import { BROADCAST_VERSION, broadcastStage, broadcastAudience, broadcastAudienceLimit, restoreBroadcast } from './broadcasting.js';
import {dispatchMode,advanceCommand,commandCapacities,commandAuto,beaconTarget,beaconMode} from './command-dispatch.js';
import {operatingState,facilityStored,facilityInactive,restoreFacilityStorage} from './facility-storage.js';
import { restoreEditing } from './editing.js';
import { marketService, creditMarketSale } from './market-work.js';
import {freshTrainingBalance,restoreTrainingBalance,trainingFactor,legacyGoodsFactor,legacyTradeFactor} from './training-balance.js';
import { recordMarketSale, restoreMarketLedger } from './market-ledger.js';
import { formatHudNumber } from './hud-numbers.js';
import {freshHousing,housingBlock,housingCapacity} from './housing-data.js';
import {restoreHousing,syncHousingResidents} from './housing.js';
import {freshCommunityStories,restoreCommunityStories} from './community-stories.js';
import {freshGarden,gardenMissing,GARDEN_LEVEL_COSTS} from './garden-data.js';
import {restoreGarden,restoreDeferredGardenPlants} from './garden.js';
import {parcelSeed} from './natural-scenery.js';
import { miningCombo, addMiningCombo, decayMiningCombo } from './mining-combo.js';
import { scaledCount, drillCapacity, furnaceCapacity } from "./facility-capacity.js";
import { landPrice, registerLandPurchase, restoreLand } from "./land.js";
import { populationSupport, populationBlock } from "./population.js";
import { freshWebAppearance, freshScenery, restorePresentation } from './presentation.js';
import { freshEnvironment } from './environment.js';
import { DIMENSION_RULES } from "./economy.js";
import { beginIncome, recordIncome, finishIncome } from './income.js';
import { captureFirstVictory, restoreVictory } from "./victory.js";
import {
  createOrders,
  deliverOrders,
  settleOrders,
  restoreOrders,
} from "./orders.js";
import {
  freshDimensions,
  dragonReserve,
  beginDimensions,
  thermalProcessLimit,
  consumeThermal,
  magmaProcess,
  advanceFreight,
  startFreight,
  terminalTransfers,
  restoreDimensions,
} from "./dimensional.js";
import {
  freshCollection,
  freshAtmosphere,
  restoreCollection,
  advanceAtmosphere,
} from "./collection.js";
import { CATALOG, ITEMS, REALMS } from "./catalog.js";
import { buildSites, canPlace } from "./layout.js";
import { transportTopology } from "./routing.js";
import {
  freshUpgrades,
  restoreUpgrades,
  upgradeMultiplier,
  storageCapacity,
  poweredUpgradeMultiplier,
} from "./upgrades.js";
import {
  sourceHasRoute,
  transportAccess,
  recordTransport,
} from "./transport.js";
import { ensureStudio, restoreStudio } from "./studio-placement.js";
import { freshSharing, restoreSharing } from "./sharing.js";
import {
  PROJECT_TARGET,
  PROJECT_WEIGHT,
  restoreProjectProgress,
} from "./project.js";
export { PROJECT_TARGET } from "./project.js";
import {
  freshMail,
  restoreMail,
  ensureMail,
  postalRate,
  claimMail,
} from "./mail.js";
import { freshNarrative, restoreNarrative } from "./narrative.js";
import { freshEasterEggs, restoreEasterEggs, collectEgg, refreshEggLocations, advanceDialogueEggs } from "./easter-eggs.js";
import { freshGuidance, restoreGuidance } from "./guidance.js";
import { freshRecords, freshAudio, ensureRecords, restoreRecords } from "./records.js";
import {
  freshCommunity,
  ensureCommunity,
  restoreCommunity,
  baseIncome,
  RESIDENT_LIMIT,
  LEGACY_RESIDENT_LIMIT,
  activeHost,
  skillFactor,
} from "./residents.js";
import { freshGrid, ensureGrid, restoreGrid, powerSnapshot, initializeConnection, transportDeviceEnabled } from "./power.js";
import {
  TASKS,
  requestTask,
  advanceOperations,
  sellCommunity,
  harvestPeriod,
} from "./operations.js";
import {freshResearch,restoreResearch,researchRequirements,advanceResearch,RESEARCH_BY_ID} from './research.js';
import {advanceFarmSites} from './operations.js';
import {restoreCivic} from './civic-sites.js';
import {freshLife,restoreLife,advanceLifeBudget} from './villager-life.js';
export const VERSION = 10,
  OFFLINE_CAP = 0;
export const n = (s, id) => s.counts[id] || 0;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const finite = (x, d = 0) => (Number.isFinite(x) && x >= 0 ? x : d);
export function fresh(now = Date.now()) {
  return {
    trainingBalance:freshTrainingBalance(),
    version: VERSION,
    research: freshResearch(),
    life: freshLife(),
    upgrades: freshUpgrades(),
    dimensions: freshDimensions(),
    community: freshCommunity(),
    grid: freshGrid(),
    rhythm: 0,
    money: 0,
    total: 0,
    manualIncome: 0,
    productionIncome: 0,
    liveIncome: 0,
    mailIncome: 0,
    postalIncome: 0,
    offlineIncome: 0,
    endEyes: 0,
    clicks: 0,
    counts: {},
    placements: {},
    facilityStorage: {},
    communityStories: freshCommunityStories(),
    garden: freshGarden(now),
    housing: freshHousing(),
    studio: { version: 1, placements: {}, revision: 0 },
    sharing: freshSharing(),
    mail: freshMail(),
    guidance: freshGuidance(),
    narrative: freshNarrative(),
    easterEggs: freshEasterEggs(),
    easterEggIncome: 0,
    records: freshRecords(),
    audio: freshAudio(),
    shopHintSeen: false,
    chunks: {
      overworld: [{ x: 0, z: 0 }],
      nether: [{ x: 0, z: 0 }],
      end: [{ x: 0, z: 0 }],
    },
    realm: "overworld",
    buffers: Object.fromEntries(
      Object.keys(REALMS).map((r) => [r, { raw: 0, goods: 0, delivered: 0 }]),
    ),
    jobs: "balanced",
    layoutRevision: 0,
    priority: "balanced",
    beacon: "production",
    beaconRealm: "overworld",
    dispatch: "off",
    transfer: "end",
    emitter: "farm",
    harvestCount: 0,
    dispatchChanges: 0,
    ordersCompleted: 0,
    autoActions: 0,
    energy: 0,
    burst: 0,
    charge: 0,
    combo: 0,
    lastClick: -100,
    play: 0,
    peakRate: 0,
    rate: 0,
    productionRate: 0,
    project: 0,
    projectByRealm: { overworld: 0, nether: 0, end: 0 },
    projectGoal: PROJECT_TARGET,
    projectFlow: { overworld: 0, nether: 0, end: 0 },
    completed: false,
    completedAt: 0,
    victory: null,
    harvest: { farm: 0, wool: 0, treasure: 0, chorus: 0, brew: 0, piston: 0 },
    live: {
      broadcastVersion: BROADCAST_VERSION,
      legacyBroadcast: false,
      viewers: 0,
      peak: 0,
      topic: "pastoral",
      camera: "overworld",
      shot: "L2",
      rainCooldown: 0,
      goal: null,
      heat: 0,
      host: 0,
      hostHeat: 0,
      respondCooldown: 0,
      clock: 0,
      giftClock: 0,
      gifts: [],
      giftSerial: 0,
      events: 0,
      program: "从第一块开始",
      director: true,
      income: 0,
    },
    orders: [],
    orderClock: 0,
    orderSerial: 0,
    events: [],
    eventSerial: 0,
    achievements: [],
    webAppearance: freshWebAppearance(),
    scenery: freshScenery(),
    environment: freshEnvironment(),
    collection: freshCollection(),
    atmosphere: freshAtmosphere(),
    crops: { selected: "wheat", owned: { wheat: true } },
    cosmetics: { title: 0, icon: 0, cursor: true, flag: 0, sky: 0 },
    sound: true,
    reducedMotion: false,
    skipPurchaseConfirmation: false,
    skipBuildConfirmation: false,
    savedAt: now,
    startedAt: now,
  };
}
export function accessible(s, r) {
  return (
    r === "overworld" ||
    (r === "nether" && n(s, "N1") > 0) ||
    (r === "end" && n(s, "E2") > 0 && s.endEyes === 12)
  );
}
export function requirements(s, item) {
  if(item.id === "V19" && s.environment?.access.pending) return [];
  const list = item.deps.filter((id) => !n(s, id)).map((id) => ITEMS[id].name);
  if(item.id==='V20')list.push(...gardenMissing(s));
  if (item.realm === "end" && !accessible(s, "end"))
    list.push("嵌满 12 枚末影之眼，激活末地传送门");
  const g = item.gate;
  // Existing purchases retain their upgrade access when milestones change.
  if (g?.id && !n(s, item.id) && n(s, g.id) < g.level)
    list.push(`${ITEMS[g.id].name}达到 ${g.level} 级／位`);
  if (g?.metric === "viewers" && s.live.peak < g.level)
    list.push(`历史最高观众 ${g.level}`);
  if (g?.metric === "project" && s.project < PROJECT_TARGET)
    list.push("世界工程交付完成");
  list.push(...researchRequirements(s,item));
  return list;
}
export function unlocked(s, item) {
  return requirements(s, item).length === 0;
}
export function price(s, item, realm = s.realm) {
  if(item.id==='V20')return GARDEN_LEVEL_COSTS[n(s,'V20')]||GARDEN_LEVEL_COSTS.at(-1);
  if (item.id === "V1") return landPrice(s, realm);
  if(item.id === "V19" && s.environment?.access.pending) return 0;
  return Math.ceil(item.cost * item.growth ** n(s, item.id));
}
export function populationCap(s) {
  return populationSupport(s).capacity;
}
export function frontier(s, realm = s.realm) {
  const chunks = s.chunks[realm],
    taken = new Set(chunks.map((c) => `${c.x},${c.z}`)),
    out = new Map();
  if (realm === "overworld" && !n(s, "V1")) return [{ x: 0, z: 0 }];
  for (const c of chunks)
    for (const [x, z] of [
      [c.x + 1, c.z],
      [c.x - 1, c.z],
      [c.x, c.z + 1],
      [c.x, c.z - 1],
    ])
      if (!taken.has(`${x},${z}`)) out.set(`${x},${z}`, { x, z });
  return [...out.values()];
}
export function sites(s, realm = s.realm, ignore = null, itemId = ignore, rotation = 0) {
  return buildSites(s, realm, itemId, ignore, rotation);
}
export function cameras(s) {
  const choices = [{ id: "L2", realm: "overworld", name: "演播室现场" }];
  if (n(s, "L3"))
    for (const [id, name] of [
      ["V4", "麦田的风"],
      [n(s, "M9") ? "M9" : "M2", "工厂实录"],
      ["M16", "矿车追踪"],
    ])
      if (n(s, id)) choices.push({ id, realm: "overworld", name });
  if (n(s, "L3") >= 2 && n(s, "V7"))
    choices.push({ id: "V7", realm: "overworld", name: "动物上班日记" });
  if (n(s, "L3") >= 3 && n(s, "V14"))
    choices.push({ id: "V14", realm: "overworld", name: "钟楼与村民" });
  if (n(s, "L11"))
    for (const [id, realm, name] of [
      ["N3", "nether", "烈焰工业"],
      ["N6", "nether", "恶魂送快递"],
      ["N9", "nether", "凋零破岩"],
      ["E4", "end", "紫颂林观察"],
      ["E9", "end", "龙的世界巡游"],
    ])
      if (n(s, id) && accessible(s, realm)) choices.push({ id, realm, name });
  return choices;
}
export function emit(s, type, text, realm = s.realm, { hosted = false } = {}) {
  const event = { id: ++s.eventSerial, type, text, realm, at: s.play };
  s.events.push(event);
  if (s.events.length > 50) s.events.shift();
  const liveElectricity = n(s, "L2") ? powerSnapshot(s) : null;
  if (n(s, "L2") && liveElectricity.perDevice.L2 > 0) {
    s.live.events++;
    s.live.viewers = Math.min(broadcastStage(s).limit, s.live.viewers + Math.min(80, 8 + Math.sqrt(s.live.viewers) * 1.3));
    s.live.peak = Math.max(s.live.peak, s.live.viewers);
    s.live.program = text;
    if (n(s, "L10") && s.live.director && liveElectricity.perDevice.L10 > 0) {
      if (hosted) s.live.hostHeat = Math.max(finite(s.live.hostHeat), 15);
      else s.live.heat = Math.max(s.live.heat, 15);
      const available = cameras(s).filter((c) => c.realm === realm);
      const shot =
        available.find((c) => text.includes(ITEMS[c.id].name)) ||
        available.find((c) =>
          type === "harvest"
            ? ["V4", "V7", "E4"].includes(c.id)
            : type === "creature"
              ? ["N6", "N9", "E9"].includes(c.id)
              : false,
        ) ||
        available[0];
      if (shot) {
        s.live.camera = shot.realm;
        s.live.shot = shot.id;
      }
    }
  }
  if (
    n(s, "L7") &&
    liveElectricity?.perDevice.L2 > 0 &&
    !s.live.rainCooldown &&
    ["harvest", "creature", "milestone", "festival"].includes(type)
  ) {
    s.live.rainCooldown = 40;
    for (let j = 0; j < 7; j++) createGift(s, true);
  }
  return event;
}
export function earn(s, value, source = "production") {
  if (!Number.isFinite(value) || value <= 0) return;
  recordIncome(s, value, source);
  s.money += value;
  s.total += value;
  if (source === "manual") s.manualIncome += value;
  else if (source === "live" || source === "gift") {
    s.liveIncome += value;
    s.live.income += value;
  } else if (source === "easterEgg") s.easterEggIncome = (s.easterEggIncome || 0) + value;
  else if (source === "mail") s.mailIncome += value;
  else if (source === "postal") s.postalIncome += value;
  else s.productionIncome += value;
}
export function redeemEasterEgg(s,id) {
  const result=collectEgg(s,id);if(result.ok)earn(s,result.value,"easterEgg");return result;
}
export function redeemMail(s, id) {
  const result = claimMail(s, id);
  if (result.ok) earn(s, result.value, "mail");
  return result;
}
export function buy(s, id, position = null) {
  const i = ITEMS[id];
  if (id === "V2" && n(s, id) >= RESIDENT_LIMIT)
    return {
      ok: false,
      reason: "全村已满 24 人。可以给现有村民换岗、学习技能。",
    };
  if (!i) return { ok: false, reason: "未知商品" };
  if(facilityInactive(s,id))return {ok:false,reason:"设施已收纳，请先免费摆回"};
  if (n(s, id) >= i.max)
    return { ok: false, reason: i.max === 1 ? "已完成" : "已满级" };
  const missing = requirements(s, i);
  if (missing.length)
    return { ok: false, reason: `需要先${missing.join("、")}` };
  if (id === "V2" && n(s, id) >= populationCap(s))
    return { ok: false, reason: populationBlock(s).reason };
  if(id === "V2" && housingBlock(s))return {ok:false,reason:housingBlock(s).reason};
  const realm = id === "V1" ? position?.realm || s.realm : i.realm;
  if (id === "V1" && !accessible(s, realm))
    return { ok: false, reason: "需要先建好并激活这个世界的传送门" };
  const cost = price(s, i, realm);
  if (s.money < cost)
    return {
      ok: false,
      reason: `还差 ${formatWallet(Math.ceil(cost - s.money))} 绿宝石`,
    };
  const first = !n(s, id);
  let land = null, reusedLand = null;
  if (id === "V1") {
    const r = realm;
    const p = position || frontier(s, r)[0];
    land = { ...p, realm: r };
    if (!frontier(s, r).some((f) => f.x === p.x && f.z === p.z))
      return { ok: false, reason: "请选择与大陆相连的土地" };
    reusedLand = registerLandPurchase(s, r, p);
    if (!(r === "overworld" && !n(s, "V1")))
      s.chunks[r].push({ x: p.x, z: p.z });
  } else if (first && i.place) {
    const p = position || sites(s, i.realm, null, id)[0];
    if (!p) return { ok: false, reason: "这里有点挤，先开垦一片新土地" };
    if (p.realm !== i.realm || !canPlace(s, id, p))
      return { ok: false, reason: "这个位置不能建造" };
    s.placements[id] = { x: p.x, z: p.z, realm: i.realm, ...(p.rotation?{rotation:((p.rotation%4)+4)%4}:{}) };
  }
  s.money -= cost;
  if (!reusedLand) s.counts[id] = n(s, id) + 1;
  if(land?.realm==='overworld' && !reusedLand) {
    const key=`overworld:${land.x}:${land.z}`;
    if(!s.garden.parcels.includes(key))s.garden.parcels.push(key);
    s.garden.naturalSeeds||={};
    if(!Number.isInteger(s.garden.naturalSeeds[key]))s.garden.naturalSeeds[key]=parcelSeed(s.garden.naturalSeed||0,key);
  }
  if (first) initializeConnection(s, id);
  if(id === "V19") s.environment.access.pending=false;
  if (id === "L1") {
    const records = ensureRecords(s);
    if (first) {
      s.sound = true;
      records.playing = true;
    }
  }
  ensureMail(s);
  if (id === "V1" || id === "V2" || (first && i.place)) s.layoutRevision++;
  if (first) {
    emit(s, "build", i.name + "加入世界", i.realm);
    if (id === "L2") s.live.viewers = 12;
    if (id === "V4") s.harvest.farm = 0.7;
    if (id === "N1") s.realm = "nether";
    if (id === "E2") s.endEyes = 0;
  } else if (id === "V1")
    emit(s, "build", `${REALMS[realm].name}新增一片土地`, realm);
  else if ([5, 10, 25].includes(n(s, id)))
    emit(s, "milestone", `${i.name}达到 ${n(s, id)} 级`, i.realm);
  if (id === "Z3") {
    s.completed = true;
    s.completedAt = Date.now();
    emit(s, "ending", "你从一块，造出了整个世界。");
  }
  ensureCommunity(s);
  syncHousingResidents(s);
  if (n(s, "L2")) {
    delete s.facilityStorage.L1;
    if (s.placements.L1) {
      delete s.placements.L1;
      s.layoutRevision++;
    }
    ensureStudio(s);
  }
  checkAchievements(s);
  refreshEggLocations(s);
  if (id === "Z3") captureFirstVictory(s);
  return { ok: true, first, cost, land, reusedLand: !!reusedLand };
}
export function move(s, id, p) {
  if (!p) return false;
  const rotation = p.rotation ?? s.placements[id]?.rotation;
  p = {...p, ...(rotation===undefined?{}:{rotation})};
  if (
    !s.placements[id] ||
    p.realm !== s.placements[id].realm ||
    !canPlace(s, id, p, id)
  )
    return false;
  s.placements[id] = { ...p };
  s.layoutRevision++;
  refreshEggLocations(s);
  return true;
}
const quantity = scaledCount;
export function rates(s, suppliedPower = null) {
  s=operatingState(s);
  const c = (id) => n(s, id),
    q = (id) => quantity(s, id),
    skill = trainingFactor(s);
  const eff = 1 + 0.3 * c("T9");
  const electricity = suppliedPower || powerSnapshot(s),
    { supply, power } = electricity;
  const sync =
    (1 + 0.3 * (electricity.perDevice.M10 || 0)) * (s.rhythm > 0 ? 1.1 : 1);
  const demand = Object.fromEntries(
    Object.keys(REALMS).map((realm) => [
      realm,
      electricity.loads
        .filter((l) => l.realm === realm)
        .reduce((sum, l) => sum + l.rated, 0),
    ]),
  );
  const sum = electricity.demand,
    ow = power.overworld,
    nt = power.nether,
    en = power.end;
  const powered = (id, fallback = 0) => electricity.perDevice[id] ?? fallback;
  const source = (id) => (sourceHasRoute(s, id, ITEMS[id].realm) ? q(id) : 0);
  const distance = {};
  for (const r in REALMS) {
    const avg = transportTopology(s, r).meanLength;
    distance[r] =
      1 / (1 + (avg * 0.025) / (1 + c("M16") * 0.2 + c("E3") * 0.5));
  }
  const cargo =
      (1 + 0.35 * c("E6")) *
      upgradeMultiplier(s, "E6", "cargo") *
      (transportDeviceEnabled(s, "M17") ? 2 : 1),
    farming = c("V6") ? 1.4 : 1,
    animals = (q("V8") * 3 + q("V9") * 0.8 + q("V10") * 0.6) * farming;
  const raw = {
    overworld:
      source("M1") * 2 +
      (source("M9") ? drillCapacity(s) : 0) *
        powered("M9") *
        sync +
      source("M18") * 10 * powered("M18") +
      (c("M8") ? source("M3") * 6 * powered("M3") * sync : 0) +
      animals,
    nether: c("N1")
      ? 1 +
        q("N3") * 7 +
        source("N7") * 2 +
        source("N8") * 5 +
        (c("N9") ? 35 : 0)
      : 0,
    end: accessible(s, "end")
      ? 1 +
        source("E4") * 6 +
        source("E11") *
          25 *
          poweredUpgradeMultiplier(s, "E11", "raw", electricity) *
          (s.burst > 0
            ? poweredUpgradeMultiplier(s, "E11", "brewSynergy", electricity)
            : 1)
      : 0,
  };
  const haul = {
    overworld:
      ((c("V2") ? 3 : 0) +
        q("M8") * 12 * powered("M8") +
        ((q("M16") *
          35 *
          powered("M16") *
          upgradeMultiplier(s, "M16", "cargo")) /
          upgradeMultiplier(s, "M16", "interval")) *
          upgradeMultiplier(s, "M16", "loading") +
        (c("V16") ? 25 : 0)) *
      cargo,
    nether: (3 + q("N2") * 8 + (c("N12") ? 90 : 0) + q("M16") * 3 * powered("M16")) * cargo,
    end: (2 + q("E5") * 8 * powered("E5") + (c("E7") ? 150 : 0)) * cargo,
  };
  const process = {
    overworld:
      ((c("T7") ? 3 : 1e9) +
        furnaceCapacity(s) *
          (1 + powered("M2") * 0.5)) *
      eff *
      sync,
    nether:
      (3 +
        q("N4") * 15 * powered("N4") * upgradeMultiplier(s, "N4", "process") +
        q("N3") * 2) *
      eff,
    end:
      (2 + q("E8") * 20 * powered("E8") + q("E11") * 30 + (c("E10") ? 80 : 0)) *
      eff,
  };
  const trade = {
    overworld:
      ((c("V2") ? 6 : 0) +
        q("V3") * 22 * upgradeMultiplier(s, "V3", "trade") +
        (c("V17") ? 15 : 0)) *
      marketService(s).factor * legacyTradeFactor(s),
    nether:
      4 +
      q("N2") * 20 * upgradeMultiplier(s, "N2", "trade") +
      (c("N12") ? 80 : 0),
    end: 3 + q("E5") * 10 + (c("E7") ? 160 : 0),
  };
  const values = {
    overworld:
      (c("N11") ? 32 : c("M2") ? 8 : c("T7") ? 3 : 1) * upgradeMultiplier(s, "M2", "localValue") * legacyGoodsFactor(s),
    nether: 1200 * (c("N4") ? 2 : 1) * (c("N11") ? 2 : 1),
    end: 3e6 * (c("E10") ? 2 : 1),
  };
  const boost = s.burst > 0 ? 3 : 1,
    out = {};
  for (const r in REALMS) {
    const access = transportAccess(s, r);
    let R = raw[r],
      H = haul[r] * distance[r] * upgradeMultiplier(s, "M4", "outlet"),
      P = access.processed ? process[r] : 0,
      S = access.delivery ? trade[r] : 0;
    if (c("N10") && r === beaconTarget(s)) {
      if (beaconMode(s) === "production") {
        R *= 1 + c("N10") * 0.5 * powered("N10");
        P *= 1 + c("N10") * 0.5 * powered("N10");
      } else H *= 1 + c("N10") * 0.8 * powered("N10");
    }
    if (c("Z1") && dispatchMode(s) === "clear") H *= 1.4;
    if (c("Z1") && dispatchMode(s) === "orders") S *= 1.4;
    const labels = ["采集", "运输", "加工", "交易"],
      vals = [R, H, P, S],
      index = vals.indexOf(Math.min(...vals));
    out[r] = {
      raw: R * boost,
      haul: H * boost,
      process: P * boost,
      trade: S * boost,
      value:
        values[r] *
        poweredUpgradeMultiplier(s, "N11", "goodsValue", electricity),
      power: power[r],
      demand: demand[r],
      capacity: storageCapacity(s, r),
      rawCapacity: storageCapacity(s, r, "raw"),
      bottleneck: labels[index],
      potential:
        Math.min(...vals) *
        boost *
        values[r] *
        poweredUpgradeMultiplier(s, "N11", "goodsValue", electricity),
    };
  }
  const livePower = c("L12") ? 1 + 0.5 * powered("L12") : 1,
    host = activeHost(s),
    hostSkill = host
      ? skillFactor(host, "music") * upgradeMultiplier(s, "V11", "jobWork")
      : 0,
    hostHeat = host ? finite(s.live.hostHeat) : 0;
  const liveBase = c("L2")
    ? Math.pow(broadcastAudience(s), 0.72) * broadcastStage(s).revenue *
      3 * (1 + 0.25 * (c("L2") - 1)) * (c("L9") ? 2 : 1) *
      livePower *
      powered("L2")
    : 0;
  const unhosted = liveBase * (1 + s.live.heat / 50),
    broadcast =
      liveBase * (1 + 0.4 * hostSkill) * (1 + (s.live.heat + hostHeat) / 50);
  const total =
    Object.values(out).reduce((sum, r) => sum + r.potential, 0) +
    broadcast +
    baseIncome(s) +
    postalRate(s);
  const tool = c("T6")
    ? 2500
    : c("T5")
      ? 32
      : c("T4")
        ? 12
        : c("T3")
          ? 8
          : c("T2")
            ? 4
            : c("T1")
              ? 2
              : 1;
  const click = (tool * eff + total * 0.025) * miningCombo(s).multiplier * boost;
  return {
    regions: out,
    supply,
    electricity,
    base: baseIncome(s),
    postal: postalRate(s),
    demand: sum,
    power,
    total,
    live: broadcast,
    hostIncome: Math.max(0, broadcast - unhosted),
    hostId: host?.id || null,
    click,
    population: Math.min(populationCap(s),Math.max(1,housingCapacity(s))),
    skill,
  };
}
export function mine(s, rng = Math.random) {
  addMiningCombo(s);
  const r = rates(s);
  const lucky = rng() < 0.035 + n(s, "T10") * 0.035;
  const value = r.click * (lucky ? 3 + n(s, "T10") : 1);
  earn(s, value, "manual");
  s.clicks++;
  if (n(s, "T11") && !s.burst) {
    s.charge += 5;
    if (s.charge >= 100) {
      s.charge = 0;
      s.burst = 12;
      emit(s, "burst", "世界共振：所有生产 ×3");
    }
  }
  checkAchievements(s);
  return { value, lucky };
}
const actions = {
  farm: { needs: "V4", period: 40 },
  wool: { needs: "V9", period: 35 },
  treasure: { needs: "V10", period: 45 },
  chorus: { needs: "E4", period: 45 },
  brew: { needs: "E10", period: 60 },
};
export function action(s, type, automatic = false) {
  s=operatingState(s);
  if (type === "end-eye" && n(s, "E2") && s.endEyes < 12) {
    s.endEyes++;
    if (s.endEyes === 12)
      emit(s, "milestone", "十二枚末影之眼归位，末地传送门已激活", "overworld");
    return {
      ok: true,
      text:
        s.endEyes === 12 ? "末地传送门已激活" : `末影之眼 ${s.endEyes} / 12`,
      value: 0,
    };
  }
  if (type === "enter-end" && accessible(s, "end")) {
    s.realm = "end";
    return { ok: true, text: "抵达末地", value: 0 };
  }

  if (TASKS[type]) return requestTask(s, type);
  const r = rates(s);
  if (type === "crank" && n(s, "M5")) {
    ensureGrid(s).crank = 0.25;
    return { ok: true, text: "手动发电", value: 0 };
  }
  if (type === "piston" && n(s, "M3")) {
    if (s.harvest.piston > 0) {
      const count = Math.min(
        s.harvest.piston,
        Math.max(0, r.regions.overworld.rawCapacity - s.buffers.overworld.raw),
      );
      if (!count) return { ok: false };
      s.harvest.piston -= count;
      s.buffers.overworld.raw += count;
      emit(s, "collect", "活塞原料送入生产线", "overworld");
      return { ok: true, text: "原料送入工坊", value: count };
    }
    s.harvest.piston = 20 * n(s, "M3");
    return { ok: true, text: "活塞压好了，再点收取", value: 0 };
  }
  if (type === "host") {
    const host = activeHost(s);
    if (!host)
      return { ok: false, reason: "先去「村庄 → 居民」安排主持人，等他到岗再开始。" };
    if (!(r.electricity.perDevice.L2 > 0))
      return { ok: false, reason: "直播间缺电，先恢复供电" };
    if (s.live.host > 0) return { ok: false };
    s.live.host = 25;
    s.live.hostHeat = Math.min(
      40,
      finite(s.live.hostHeat) +
        20 *
          skillFactor(host, "music") *
          upgradeMultiplier(s, "V11", "jobWork"),
    );
    s.live.viewers = Math.min(broadcastStage(s).limit, s.live.viewers + 8 + Math.sqrt(s.live.viewers));
    emit(s, "live", `${host.name}带大家逛了一圈`, s.realm, { hosted: true });
    return { ok: true, text: "节目热度上升", value: 0 };
  }
  if (type === "respond" && n(s, "L5")) {
    if (!(r.electricity.perDevice.L2 > 0 && r.electricity.perDevice.L5 > 0))
      return { ok: false, reason: "弹幕屏缺电" };
    if (s.live.respondCooldown > 0) return { ok: false };
    s.live.respondCooldown = 5;
    s.live.heat = Math.min(40, s.live.heat + 5);
    return { ok: true, text: "收到！观众很开心", value: 0 };
  }
  if (type === "ghast" && n(s, "N6")) {
    return startFreight(s, "N6", r.electricity, { manual: true });
  }
  if (type === "festival" && n(s, "L14")) {
    if (!(r.electricity.perDevice.L2 > 0))
      return { ok: false, reason: "直播间缺电，先恢复供电" };
    if (s.harvest.festival > 0) return { ok: false };
    s.harvest.festival = 90;
    s.burst = 20;
    s.live.heat = 40;
    for (let j = 0; j < 7; j++) createGift(s);
    emit(s, "festival", "全世界，都在这场直播里");
    return { ok: true, text: "世界直播庆典开始", value: 0 };
  }
  return { ok: false, reason: "这个操作尚未开放" };
}

function createGift(s, expression = false) {
  if (!n(s, "L6") || s.live.gifts.length >= 12) return;
  if (!(powerSnapshot(s).perDevice.L2 > 0)) return;
  const value = Math.max(12, rates(s).total * (1 + n(s, "L6") * 0.3) * broadcastStage(s).revenue);
  s.live.gifts.push({
    id: ++s.live.giftSerial,
    value,
    life: 35,
    expression,
    x: 15 + ((s.live.giftSerial * 17) % 65),
    y: 25 + ((s.live.giftSerial * 11) % 40),
  });
}
export function collectGift(s, id) {
  const i = s.live.gifts.findIndex((g) => g.id === id);
  if (i < 0) return 0;
  const [g] = s.live.gifts.splice(i, 1);
  earn(s, g.value, "gift");
  return g.value;
}
export function setOption(s, key, value) {
  const options = {
    jobs: ["balanced", "mining", "hauling", "crafting"],
    priority: [
      "balanced",
      "overworld",
      "nether",
      "end",
      "production",
      "logistics",
      "automation",
      "lighting",
    ],
    beacon: ["production", "logistics"],
    beaconRealm: Object.keys(REALMS),
    dispatch: ["off", "supply", "clear", "orders", "auto"],
    transfer: ["overworld", "nether", "end"],
    emitter: ["farm", "wool", "mine"],
  };
  if (!options[key]?.includes(value)) return false;
  if (key === "priority" && !n(s, "M12")) return false;
  if (key === "dispatch" && !n(s, "Z1")) return false;
  if (key === "transfer" && !n(s, "E7")) return false;
  if (key === "emitter" && !n(s, "M14")) return false;
  if (key.startsWith("beacon") && (!n(s, "N10") || commandAuto(s))) return false;
  if (
    ["priority", "beaconRealm", "transfer"].includes(key) &&
    value !== "balanced" &&
    !["production", "logistics", "automation", "lighting"].includes(value) &&
    !accessible(s, value)
  )
    return false;
  if (s[key] !== value) s.dispatchChanges++;
  s[key] = value;
  if(key === "dispatch"){s.commandPlan=null;advanceCommand(s,0,()=>commandCapacities(s,rates(s)));}
  return true;
}
function buildGoal(s) {
  if (!n(s, "L13")) return;
  if (!(powerSnapshot(s).perDevice.L2 > 0)) return;
  if (s.live.goal && n(s, s.live.goal.id) >= s.live.goal.required) {
    earn(s, s.live.goal.reward, "live");
    emit(s, "goal", ITEMS[s.live.goal.id].name + "建设目标完成", "overworld");
    s.live.goal = null;
  }
  if (!s.live.goal) {
    const id =
      n(s, "V1") < 4
        ? "V1"
        : ["M16", "M17", "N1", "E2", "E9", "Z2"].find((id) => !n(s, id));
    if (id)
      s.live.goal = {
        id,
        required: id === "V1" ? n(s, id) + 1 : 1,
        reward: Math.ceil(price(s, ITEMS[id]) * 0.2),
      };
  }
}
function tick(s, dt, offline) {
  advanceCommand(s,dt,()=>commandCapacities(s,rates(s)));
  beginIncome(s);
  const welfareNotice=advanceLifeBudget(s,dt);
  if(welfareNotice)emit(s,'life',welfareNotice);
  const totalBefore = s.total,
    productionBefore = s.productionIncome,
    projectLayerBefore = Math.floor(s.project / (PROJECT_TARGET / 3));
  s.projectFlow = { overworld: 0, nether: 0, end: 0 };
  advanceAtmosphere(s, dt, (type, text, realm) => emit(s, type, text, realm));
  buildGoal(s);
  beginDimensions(s, dt);
  const electricity = powerSnapshot(s, dt, true);
  const r = rates(s, electricity);
  let earned = r.postal * dt;
  earn(s, earned, "postal");
  const madeByRealm = {};
  createOrders(s, dt, r.regions);
  s.play += offline ? 0 : dt;
  if (!offline) advanceDialogueEggs(s);
  s.burst = Math.max(0, s.burst - dt);
  s.rhythm = Math.max(0, (s.rhythm || 0) - dt);
  s.live.heat = Math.max(0, s.live.heat - dt * 0.2);
  s.live.host = r.hostId ? Math.max(0, s.live.host - dt) : 0;
  s.live.hostHeat = r.hostId
    ? Math.max(0, finite(s.live.hostHeat) - dt * 0.8)
    : 0;
  s.live.respondCooldown = Math.max(0, finite(s.live.respondCooldown) - dt);
  s.live.rainCooldown = Math.max(0, (s.live.rainCooldown || 0) - dt);
  decayMiningCombo(s, dt);
  advanceOperations(s, dt, { earn, emit, collectGift }, electricity);
  const researchResult=advanceResearch(s,dt);
  if(researchResult.completed)emit(s,'research',RESEARCH_BY_ID[researchResult.completed].name+'已完成');
  for (const realm in REALMS) {
    if (!accessible(s, realm)) continue;
    const cap = r.regions[realm],
      b = s.buffers[realm];
    // Bounded queues back-pressure the producer; existing inventory never expires.
    b.raw += Math.min(cap.raw * dt, Math.max(0, cap.rawCapacity - b.raw));
    const communityReserve =
      realm === "overworld" && s.community.batches.length ? 0.5 : 0;
    const pendingRaw = realm === "end" ? s.dimensions.awaiting.endRaw : 0;
    const requested = Math.min(
      b.raw + pendingRaw,
      cap.haul * dt * (1 - communityReserve) + pendingRaw,
      cap.process * dt,
      Math.max(0, cap.capacity - b.goods),
    );
    const manufactured =
      realm === "nether" ? thermalProcessLimit(s, requested, dt) : requested;
    const received = Math.min(pendingRaw, manufactured);
    if (realm === "end") s.dimensions.awaiting.endRaw -= received;
    b.raw -= manufactured - received;
    b.goods += manufactured;
    if (realm === "nether") consumeThermal(s, manufactured, dt);
    madeByRealm[realm] = manufactured;
  }
  const pressed = magmaProcess(s, dt, electricity);
  madeByRealm.nether = (madeByRealm.nether || 0) + pressed;
  advanceFreight(s, dt, electricity, offline ? null : emit);
  const terminalOut = terminalTransfers(s, dt, electricity);
  for (const realm in REALMS) {
    if (!accessible(s, realm)) continue;
    const cap = r.regions[realm],
      b = s.buffers[realm],
      communityReserve =
        realm === "overworld" && s.community.batches.length ? 0.5 : 0;

    const dragonGoods = realm === "end" ? s.dimensions.awaiting.endGoods : 0;
    const reserved = realm === "end" ? dragonReserve(s, electricity) : 0;
    const dispatchable =
      Math.min(
        Math.max(0, b.goods - reserved),
        cap.trade * dt * (1 - communityReserve),
      ) + dragonGoods;
    let remaining = dispatchable;
    let projectGoods = 0;
    if (n(s, "Z2") && !s.completed) {
      projectGoods = Math.min(
        remaining * DIMENSION_RULES.projectShare,
        Math.max(0, PROJECT_TARGET / 3 - s.projectByRealm[realm]) /
          PROJECT_WEIGHT[realm],
      );
      remaining -= projectGoods;
      s.projectByRealm[realm] += projectGoods * PROJECT_WEIGHT[realm];
      s.projectFlow[realm] = (projectGoods * PROJECT_WEIGHT[realm]) / dt;
    }
    const ordered = deliverOrders(s, realm, remaining);
    const shipped = remaining - ordered;
    if (realm === "end") s.dimensions.awaiting.endGoods = 0;
    b.goods -= Math.max(0, dispatchable - dragonGoods);
    b.delivered += dispatchable;
    const amount = shipped * cap.value;
    earn(s, amount);
    recordMarketSale(s, { source: `production:${realm}`, label: `${REALMS[realm].name}成品`, realm, quantity: shipped, money: amount });
    if (realm === "overworld") s.community.jobIncome += amount * creditMarketSale(s, amount);
    earned += amount;
    let villageDelivery = 0;
    if (realm === "overworld" && communityReserve)
      villageDelivery = sellCommunity(
        s,
        dt,
        cap.haul * communityReserve,
        cap.trade * communityReserve,
        electricity.perDevice.M8 || 0,
        { earn, emit, deliverOrders },
      );
    recordTransport(
      s,
      realm,
      {
        raw: madeByRealm[realm] || 0,
        processed: madeByRealm[realm] || 0,
        delivery: dispatchable + (terminalOut[realm] || 0) + villageDelivery,
        sold: shipped,
        orders: ordered,
        project: projectGoods,
      },
      dt,
    );
  }
  s.project = Object.values(s.projectByRealm).reduce((a, b) => a + b, 0);
  const projectLayer = Math.floor(s.project / (PROJECT_TARGET / 3));
  if (!offline && projectLayer > projectLayerBefore)
    emit(
      s,
      "milestone",
      `世界工程 · 第 ${projectLayer} 层落成${projectLayer === 3 ? "，可以进入创造模式了" : "，继续接收三维度交付"}`,
    ).projectLayer = projectLayer;
  advanceFarmSites(s,dt);
  for (const [key, a] of Object.entries(actions))
    if (n(s, a.needs)) {
      const period = harvestPeriod(s, key, electricity);
      const before = s.harvest[key];
      s.harvest[key] = Math.min(1, before + dt / period);
      if (before < 1 && s.harvest[key] === 1 && !offline)
        emit(
          s,
          "ready",
          `${ITEMS[a.needs].name}可以收获了`,
          key === "chorus" || key === "brew" ? "end" : "overworld",
        );
    }
  for (const key of ["note", "ghast", "festival"])
    s.harvest[key] = Math.max(0, (s.harvest[key] || 0) - dt);
  if (
    n(s, "M8") &&
    (electricity.perDevice.M8 || 0) > 0 &&
    s.harvest.piston > 0
  ) {
    const take = Math.min(
      s.harvest.piston,
      12 * n(s, "M8") * dt * electricity.perDevice.M8,
      Math.max(0, r.regions.overworld.rawCapacity - s.buffers.overworld.raw),
    );
    s.buffers.overworld.raw += take;
    s.harvest.piston -= take;
  }

  if (n(s, "L2") && electricity.perDevice.L2 > 0) {
    const host = activeHost(s),
      hostSkill = host
        ? skillFactor(host, "music") * upgradeMultiplier(s, "V11", "jobWork")
        : 0,
      hostHeat = host ? finite(s.live.hostHeat) : 0;
    const subjects = Object.keys(s.counts).filter(
      (id) => s.counts[id] > 0 && !["T", "X"].includes(id[0]),
    ).length;
    const topicFit =
      s.live.topic === "pastoral"
        ? n(s, "V4") + n(s, "V7") + n(s, "V8") + n(s, "V9")
        : s.live.topic === "industrial"
          ? n(s, "M9") + n(s, "M16") + n(s, "M2")
          : n(s, "N3") + n(s, "N6") + n(s, "E9") * 3;
    const growth =
      (0.4 + Math.sqrt(subjects) * 0.2) *
      (1 + Math.log1p(topicFit) * 0.15) *
      (1 + n(s, "L3") * 0.25 * (electricity.perDevice.L3 || 0)) *
      (1 + 0.5 * hostSkill) *
      (n(s, "L8") ? 1.8 : 1) *
      (1 + (s.live.heat + hostHeat) / 50);
    const ceiling = broadcastAudienceLimit(s);
    s.live.viewers = Math.min(
      ceiling,
      s.live.viewers + growth * dt * electricity.perDevice.L2 * broadcastStage(s).growth,
    );
    s.live.peak = Math.max(s.live.peak, s.live.viewers);
    earn(s, r.live * dt, "live");
    if (r.hostId) {
      const paidHost = s.community.residents.find(
          (resident) => resident.id === r.hostId,
        ),
        attributed = r.hostIncome * dt;
      if (paidHost) paidHost.jobEarned += attributed;
      s.community.jobIncome += attributed;
    }
    earned += r.live * dt;
    s.live.giftClock += dt * electricity.perDevice.L2;
    if (s.live.giftClock >= 25) {
      s.live.giftClock %= 25;
      if (!offline || n(s, "L6") >= 3 || n(s, "V15")) createGift(s);
    }
    for (const gift of [...s.live.gifts]) {
      if (!gift.claimed) gift.life -= dt;
      if (n(s, "L6") >= 3 && electricity.perDevice.L6 > 0 && !gift.claimed)
        collectGift(s, gift.id);
      else if (gift.life <= 0)
        s.live.gifts = s.live.gifts.filter((g) => g.id !== gift.id);
    }
  }
  earned += settleOrders(s, dt, { earn, emit }, offline);
  for (const [id, key, realm, period, batch, text] of [
    ["V16", "golem", "overworld", 24, 80, "铁傀儡破开了一片矿石"],
    ["N9", "wither", "nether", 30, 200, "凋零完成了一轮破岩"],
  ]) {
    if (n(s, id)) {
      s.harvest[key] = (s.harvest[key] ?? period) - dt;
      if (s.harvest[key] <= 0) {
        s.harvest[key] += period;
        s.buffers[realm].raw += Math.min(
          batch,
          Math.max(0, r.regions[realm].rawCapacity - s.buffers[realm].raw),
        );
        if (!offline) emit(s, "creature", text, realm).facility = id;
      }
    }
  }
  s.productionRate = (s.productionIncome - productionBefore) / dt;
  s.rate = (s.total - totalBefore) / dt;
  finishIncome(s, dt, s.rate);
  s.peakRate = Math.max(s.peakRate, s.rate);
  return earned;
}
export function advance(s, seconds, { offline = false } = {}) {
  if (offline || !Number.isFinite(seconds) || seconds <= 0) return 0;
  const before = s.total;
  let left = seconds;
  while (left > 1e-8) {
    let dt = Math.min(1, left);
    if (s.burst > 0) dt = Math.min(dt, s.burst);
    tick(operatingState(s), dt, offline);
    left -= dt;
  }
  checkAchievements(s);
  return s.total - before;
}
export function settleOffline(s, now = Date.now()) {
  const seconds = Math.max(0, (now - s.savedAt) / 1000);
  s.savedAt = now;
  return { seconds, earned: 0 };
}
export function checkAchievements(s) {
  for (const [id, , test] of ACHIEVEMENTS)
    if (!s.achievements.includes(id) && test(s)) s.achievements.push(id);
}
export function restore(raw, now = Date.now()) {
  const s = fresh(now);
  if (!raw || ![2, 3, 4, 5, 6, 7, 8, 9, VERSION].includes(raw.version)) return s;
  for (const key of [
    "harvestCount",
    "dispatchChanges",
    "ordersCompleted",
    "autoActions",
    "money",
    "total",
    "manualIncome",
    "productionIncome",
    "liveIncome",
    "mailIncome",
    "postalIncome",
    "easterEggIncome",
    "offlineIncome",
    "clicks",
    "play",
    "peakRate",
    "project",
    "completedAt",
    "startedAt",
    "savedAt",
    "eventSerial",
    "orderSerial",
  ])
    s[key] = finite(raw[key], s[key]);
  for (const i of CATALOG)
    s.counts[i.id] = clamp(
      Math.floor(finite(raw.counts?.[i.id])),
      0,
      i.id === "V2" ? LEGACY_RESIDENT_LIMIT : Math.min(Number.MAX_SAFE_INTEGER, i.max),
    );
  restoreFacilityStorage(s,raw.facilityStorage);
  const legacyMail = raw.version < 5 && raw.mail === undefined;
  if (legacyMail && (n(s, "T7") || n(s, "V2"))) s.counts.V18 = 1;
  for (const realm in REALMS) {
    const chunks = raw.chunks?.[realm];
    if (Array.isArray(chunks) && chunks.length) {
      const seen = new Set();
      s.chunks[realm] = chunks
        .filter(
          (p) =>
            Number.isSafeInteger(p?.x) &&
            Number.isSafeInteger(p?.z),
        )
        .filter((p) => {
          const key = p.x + "," + p.z;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      if (!s.chunks[realm].length) s.chunks[realm] = [{ x: 0, z: 0 }];
    }
    for (const key of ["raw", "goods", "delivered"])
      s.buffers[realm][key] = finite(raw.buffers?.[realm]?.[key]);
  }
  restoreLand(s, raw);
  s.editing = restoreEditing(raw.editing);
  s.projectByRealm = restoreProjectProgress(raw);
  for (const i of CATALOG)
    if (
      n(s, i.id) && !facilityStored(s,i.id) &&
      (i.place ||
        (["M10", "M11", "M12", "M13"].includes(i.id) &&
          raw.placements?.[i.id])) &&
      !(i.id === "L1" && n(s, "L2"))
    ) {
      const p = raw.placements?.[i.id];
      if (p && p.realm === i.realm && canPlace(s, i.id, p))
        s.placements[i.id] = { ...p };
      else {
        let options = sites(s, i.realm, null, i.id);
        // Bound repair attempts per missing building, not the player's land.
        for (let attempts = 0; !options.length && attempts < 4; attempts++) {
          const edge = frontier(s, i.realm)[0];
          if (!edge) break;
          s.chunks[i.realm].push(edge);
          options = sites(s, i.realm, null, i.id);
        }
        if (p && Number.isFinite(p.x) && Number.isFinite(p.z))
          options.sort(
            (a, b) =>
              Math.hypot(a.x - p.x, a.z - p.z) -
              Math.hypot(b.x - p.x, b.z - p.z),
          );
        if (options[0]) s.placements[i.id] = options[0];
      }
    }
  s.endEyes = n(s, "E2")
    ? raw.endEyes === undefined
      ? 12
      : Math.min(12, Math.max(0, Math.floor(finite(raw.endEyes))))
    : 0;
  s.realm = accessible(s, raw.realm) ? raw.realm : "overworld";
  const savedDispatch = s.dispatchChanges;
  for (const key of [
    "jobs",
    "priority",
    "beacon",
    "beaconRealm",
    "dispatch",
    "transfer",
    "emitter",
  ])
    setOption(s, key, raw[key]);
  s.dispatchChanges = savedDispatch;
  s.commandPlan=null;
  for (const key of ["viewers", "peak", "events", "income"])
    s.live[key] = finite(raw.live?.[key]);
  // Old host timers mixed replies and hosting. Resume neither short action;
  // preserve ordinary construction/event heat and all historical earnings.
  s.live.heat = Math.min(40, finite(raw.live?.heat));
  s.live.host = 0;
  s.live.hostHeat = 0;
  s.live.respondCooldown = 0;
  s.live.peak = Math.max(s.live.peak, s.live.viewers);
  restoreBroadcast(s, raw);
  const giftIds = new Set();
  s.live.gifts = (Array.isArray(raw.live?.gifts) ? raw.live.gifts : [])
    .filter(
      (g) =>
        Number.isInteger(g?.id) &&
        g.id > 0 &&
        Number.isFinite(g.value) &&
        g.value > 0 &&
        !giftIds.has(g.id) &&
        giftIds.add(g.id),
    )
    .slice(0, 12)
    .map((g) => ({
      id: g.id,
      value: finite(g.value),
      life: Math.max(1, Math.min(35, finite(g.life))),
      expression: !!g.expression,
      x: clamp(finite(g.x), 15, 80),
      y: clamp(finite(g.y), 25, 65),
    }));
  s.live.giftSerial = Math.max(
    finite(raw.live?.giftSerial),
    0,
    ...s.live.gifts.map((g) => g.id),
  );
  if (["pastoral", "industrial", "otherworld"].includes(raw.live?.topic))
    s.live.topic = raw.live.topic;
  const camera = cameras(s).find((c) => c.id === raw.live?.shot);
  if (camera) {
    s.live.camera = camera.realm;
    s.live.shot = camera.id;
  }
  if (raw.live?.goal && ITEMS[raw.live.goal.id] && raw.live.goal.required > 0)
    s.live.goal = {
      id: raw.live.goal.id,
      required: Math.min(
        ITEMS[raw.live.goal.id].max,
        Math.floor(raw.live.goal.required),
      ),
      reward: finite(raw.live.goal.reward),
    };
  s.live.director = raw.live?.director !== false;
  if (typeof raw.live?.program === "string")
    s.live.program = raw.live.program.slice(0, 120);
  if (Array.isArray(raw.events))
    s.events = raw.events
      .filter(
        (e) =>
          typeof e.text === "string" &&
          REALMS[e.realm] &&
          Number.isFinite(e.id),
      )
      .slice(-50)
      .map((e) => ({
        id: e.id,
        text: e.text.slice(0, 140),
        realm: e.realm,
        type: String(e.type).slice(0, 20),
        at: finite(e.at),
      }));
  s.orders = restoreOrders(raw);
  for (const key of Object.keys(actions))
    s.harvest[key] = clamp(finite(raw.harvest?.[key]), 0, 1);
  for (const key of [
    "piston",
    "note",
    "ghast",
    "festival",
    "golem",
    "wither",
    "dragon",
  ])
    s.harvest[key] = Math.min(10000, finite(raw.harvest?.[key]));
  for (const key of ["title", "icon", "flag", "sky"])
    s.cosmetics[key] = Math.floor(clamp(finite(raw.cosmetics?.[key]), 0, 2));
  s.cosmetics.cursor = raw.cosmetics?.cursor !== false;
  s.sound = !!raw.sound;
  restoreRecords(s, raw);
  s.reducedMotion = !!raw.reducedMotion;
  s.skipPurchaseConfirmation = raw.skipPurchaseConfirmation === true;
  s.skipBuildConfirmation = raw.skipBuildConfirmation === true;
  s.completed = !!raw.completed && !!n(s, "Z3");
  s.project = Object.values(s.projectByRealm).reduce((a, b) => a + b, 0);
  restoreCollection(s, raw);
  restorePresentation(s, raw);
  const deferredGarden = restoreGarden(s,raw);
  if (n(s, "L2")) {delete s.placements.L1;delete s.facilityStorage.L1;}
  restoreStudio(s, raw.studio);
  s.sharing = restoreSharing(raw.sharing);
  s.guidance = restoreGuidance(raw.guidance, s);
  s.easterEggs = restoreEasterEggs(raw.easterEggs, s);
  s.shopHintSeen = raw.shopHintSeen === true || n(s, "T1") > 0;
  s.mail = restoreMail(raw.mail, s, { legacy: legacyMail });
  restoreTrainingBalance(s,raw);
  restoreCommunity(s, raw);
  restoreHousing(s,raw);
  restoreLife(s,raw);
  restoreCivic(s,raw);
  restoreResearch(s,raw);
  restoreDeferredGardenPlants(s,deferredGarden,raw.garden?.plants);
  s.communityStories = restoreCommunityStories(raw.communityStories,s);
  s.narrative = restoreNarrative(raw.narrative, s);
  restoreUpgrades(s, raw);
  restoreGrid(s, raw);
  restoreDimensions(s, raw);
  restoreMarketLedger(s, raw);
  refreshEggLocations(s);
  restoreAchievements(s, raw);
  checkAchievements(s);
  restoreVictory(s, raw, (snapshot) => restore(snapshot, now));
  return s;
}
const integerFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});
export function format(v, d = 1) {
  if (!Number.isFinite(v)) return "0";
  for (const [b, u] of [
    [1e16, "京"],
    [1e12, "万亿"],
    [1e8, "亿"],
    [1e4, "万"],
  ])
    if (v >= b) return (v / b).toFixed(d).replace(/\.0+$/, "") + u;
  return v < 10
    ? v.toFixed(d).replace(/\.0+$/, "")
    : integerFormat.format(Math.floor(v));
}

export function formatWallet(v) {
  return formatHudNumber(v);
}
