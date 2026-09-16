// Deterministic foreground investment model; this is not a human playthrough.
import { writeFileSync, mkdirSync } from "node:fs";
import { CATALOG, ITEMS, ancestors } from "../src/catalog.js";
import {
  fresh,
  n,
  buy,
  price,
  unlocked,
  rates,
  advance,
  action,
  mine,
  frontier,
  sites,
  PROJECT_TARGET,
} from "../src/game.js";
import {
  UPGRADE_CATALOG,
  upgradeStatus,
  upgradePrice,
  buyUpgrade,
  upgradeLevel,
} from "../src/upgrades.js";
import { trainResident, trainingPrice, JOBS } from "../src/residents.js";
import { assignJob, jobAvailable } from "../src/residents.js";

export const ROUTES = [
  {
    id: "industrial-first",
    extra: ["M7", "M9", "M16", "M17"],
    prefer: ["M", "T"],
    click: 2,
    residents: 6,
  },
  {
    id: "village-first",
    extra: ["V4", "V6", "V7", "V8", "V9", "V12", "V15"],
    prefer: ["V"],
    click: 2,
    residents: 8,
  },
  {
    id: "livestream-first",
    extra: ["L2", "L3", "L4", "L5", "L6", "L8", "L9", "L10", "L11"],
    prefer: ["L"],
    click: 2,
    residents: 6,
  },
  {
    id: "no-livestream",
    extra: ["M7", "M16", "V4"],
    prefer: ["M", "V"],
    click: 2,
    residents: 6,
    noLive: true,
  },
  {
    id: "low-active",
    extra: ["M7", "M8", "M14", "V4"],
    prefer: ["V", "M"],
    click: 20,
    residents: 6,
  },
];
const args = process.argv.slice(2),
  option = (key, fallback) =>
    args[args.indexOf(key) + 1] && args.includes(key)
      ? args[args.indexOf(key) + 1]
      : fallback;
const out = option("--out", "docs/v1.1l/simulation/baseline");
const maxSeconds = +option("--max-seconds", "10800");
const selected = option("--route", "all");
mkdirSync(out, { recursive: true });

export function simulate(route, { afterIncome = null } = {}) {
  const s = fresh(0),
    required = ancestors("Z3"),
    milestones = [],
    purchases = [],
    samples = [];
  for (const id of route.extra) {
    required.add(id);
    for (const p of ancestors(id)) required.add(p);
  }
  let time = 0,
    lastPurchase = 0,
    longestWait = 0,
    maxPowerDeficit = 0,
    actualIncome = 0;
  const initialPreferred = new Set(
    route.extra.flatMap((id) => [id, ...ancestors(id)]),
  );
  function purchase(item) {
    let position = null;
    if (
      item.place &&
      !n(s, item.id) &&
      !sites(s, item.realm, null, item.id).length
    ) {
      const edges = frontier(s, item.realm).sort(
        (a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z),
      );
      if (edges.length && s.money >= price(s, ITEMS.V1, item.realm)) {
        const cost = price(s, ITEMS.V1, item.realm),
          result = buy(s, "V1", { ...edges[0], realm: item.realm });
        if (result.ok) {
          purchases.push({
            at: time,
            id: "V1",
            level: n(s, "V1"),
            realm: item.realm,
            cost,
          });
          longestWait = Math.max(longestWait, time - lastPurchase);
          lastPurchase = time;
        }
      }
      return false;
    }
    const cost = price(s, item),
      result = buy(s, item.id, position);
    if (!result.ok) return false;
    if (item.id === "E2") for (let i = 0; i < 12; i++) action(s, "end-eye");
    purchases.push({ at: time, id: item.id, level: n(s, item.id), cost });
    longestWait = Math.max(longestWait, time - lastPurchase);
    lastPurchase = time;
    if (
      [
        "T1",
        "V1",
        "V2",
        "V4",
        "M6",
        "L2",
        "M8",
        "M16",
        "N1",
        "E2",
        "Z2",
        "Z3",
      ].includes(item.id) &&
      n(s, item.id) === 1
    )
      milestones.push({
        id: item.id,
        name: item.name,
        seconds: time,
        actualRate: s.rate,
        theoreticalRate: rates(s).total,
      });
    return true;
  }
  function dedicated(row) {
    const result = buyUpgrade(s, row.id);
    if (!result.ok) return false;
    purchases.push({
      at: time,
      id: row.id,
      type: "dedicated",
      owner: row.owner,
      level: result.level,
      cost: result.cost,
    });
    longestWait = Math.max(longestWait, time - lastPurchase);
    lastPurchase = time;
    return true;
  }
  function staff() {
    const jobs =
      route.id === "village-first"
        ? ["farmer", "rancher", "hauler", "miner", "crafter", "host"]
        : route.id === "livestream-first"
          ? ["host", "musician", "stagehand", "hauler", "miner", "farmer"]
          : ["miner", "hauler", "crafter", "farmer", "rancher", "host"];
    for (const job of jobs) {
      if (
        !jobAvailable(s, job) ||
        s.community.residents.some((r) => r.job === job)
      )
        continue;
      const resident = s.community.residents.find(
        (r) => r.job === "idle" && !r.reserve,
      );
      if (resident) assignJob(s, resident.id, job);
    }
  }
  for (; time < maxSeconds && !s.completed; time++) {
    const total = s.total;
    advance(s, 1);
    if (time % (n(s, "V2") ? route.click : 1) === 0) mine(s, () => 1);
    actualIncome += s.total - total;
    afterIncome?.(s, time, { purchase, purchases });
    if (time % 15 === 0) {
      staff();
      for (const key of ["farm", "wool", "treasure", "chorus", "brew"])
        if (s.harvest[key] >= 1 && route.id !== "low-active") action(s, key);
      if (n(s, "L4") && route.id === "livestream-first") action(s, "host");
    }
    if (time % 60 === 0) {
      const r = rates(s);
      maxPowerDeficit = Math.max(
        maxPowerDeficit,
        r.electricity.demand - r.electricity.supply,
      );
      samples.push({
        seconds: time,
        money: s.money,
        created: s.total,
        actualRate: s.rate,
        theoreticalRate: r.total,
        production: s.productionIncome,
        manual: s.manualIncome,
        live: s.liveIncome,
        base: s.community.baseIncome,
        jobs: s.community.jobIncome,
        power: {
          generation: r.electricity.supply,
          demand: r.electricity.demand,
          consumption: r.electricity.consumption,
          stored: s.energy,
        },
        regions: Object.fromEntries(
          Object.entries(r.regions).map(([k, v]) => [
            k,
            {
              raw: v.raw,
              process: v.process,
              haul: v.haul,
              trade: v.trade,
              capacity: v.capacity,
              stock: { ...s.buffers[k] },
              bottleneck: v.bottleneck,
            },
          ]),
        ),
        project: { ...s.projectByRealm },
        heat: {
          stored: s.dimensions.heat,
          recovery: s.dimensions.recoveryRate,
        },
        freight: { ...s.dimensions.moved },
        inTransit: Object.fromEntries(
          Object.entries(s.dimensions.trips).map(([id, t]) => [id, t.cargo]),
        ),
        dedicated: { ...s.upgrades.levels },
      });
    }
    if (time % 4) continue;
    if (
      n(s, "V2") < route.residents &&
      unlocked(s, ITEMS.V2) &&
      s.money >= price(s, ITEMS.V2)
    ) {
      if (purchase(ITEMS.V2)) continue;
      if (s.money >= price(s, ITEMS.V1)) {
        const edge = frontier(s).sort(
          (a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z),
        )[0];
        if (edge) {
          const cost = price(s, ITEMS.V1),
            result = buy(s, "V1", edge);
          if (result.ok) {
            purchases.push({
              at: time,
              id: "V1",
              level: n(s, "V1"),
              realm: s.realm,
              cost,
            });
            longestWait = Math.max(longestWait, time - lastPurchase);
            lastPurchase = time;
          }
        }
      }
    }
    const next = CATALOG.filter(
      (i) =>
        required.has(i.id) &&
        !n(s, i.id) &&
        unlocked(s, i) &&
        !(route.noLive && i.family === "L"),
    ).sort((a, b) => {
      const weight = (i) =>
        (initialPreferred.has(i.id) ? 0.6 : 1) *
        (route.prefer.includes(i.family) ? 0.75 : 1);
      return a.cost * weight(a) - b.cost * weight(b);
    })[0];
    if (next && s.money >= price(s, next) && purchase(next)) continue;
    const r = rates(s),
      project = n(s, "Z2") && s.project < PROJECT_TARGET;
    const utility = (r) =>
      project
        ? Object.entries(r.regions).reduce(
            (sum, [realm, v]) =>
              sum +
              (s.projectByRealm[realm] < PROJECT_TARGET / 3
                ? (v.potential / v.value) *
                  { overworld: 0.2, nether: 1, end: 3 }[realm]
                : 0),
            0,
          )
        : r.total;
    const baseline = utility(r),
      choices = [];
    for (const item of CATALOG) {
      if (
        item.max <= 1 ||
        item.id === "V1" ||
        !unlocked(s, item) ||
        n(s, item.id) >= item.max ||
        item.family === "X" ||
        (route.noLive && item.family === "L")
      )
        continue;
      const copy = structuredClone(s);
      copy.money = 1e30;
      if (!buy(copy, item.id).ok) continue;
      const gain = utility(rates(copy)) - baseline;
      if (gain > 0)
        choices.push({
          item,
          cost: price(s, item),
          roi:
            (price(s, item) / gain) *
            (route.prefer.includes(item.family) ? 0.8 : 1),
        });
    }
    for (const row of UPGRADE_CATALOG) {
      if (upgradeStatus(s, row.id).kind !== "ready") continue;
      const copy = structuredClone(s);
      if (!buyUpgrade(copy, row.id).ok) continue;
      const gain = utility(rates(copy)) - baseline,
        cost = upgradePrice(s, row.id);
      if (gain > 0)
        choices.push({
          mod: row,
          cost,
          roi: (cost / gain) * (route.prefer.includes(row.owner[0]) ? 0.8 : 1),
        });
    }
    // Small branch investments cover utility such as buffering, crops, thermal
    // storage and freight cadence that an instantaneous rate cannot price.
    if (time % 20 === 0) {
      const branch = UPGRADE_CATALOG.filter(
        (row) =>
          upgradeStatus(s, row.id).kind === "ready" &&
          upgradePrice(s, row.id) <= s.money * 0.12 &&
          (!next || upgradePrice(s, row.id) <= price(s, next) * 0.3),
      ).sort(
        (a, b) =>
          (route.prefer.includes(a.owner[0]) ? 0 : 1) -
            (route.prefer.includes(b.owner[0]) ? 0 : 1) ||
          upgradePrice(s, a.id) - upgradePrice(s, b.id),
      )[0];
      if (branch && dedicated(branch)) continue;
      if (route.id === "village-first" && n(s, "V11")) {
        const worker = s.community.residents.find(
          (r) =>
            JOBS[r.job]?.skill &&
            trainingPrice(r, JOBS[r.job].skill) > 0 &&
            trainingPrice(r, JOBS[r.job].skill) < s.money * 0.12,
        );
        if (worker) {
          const skill = JOBS[worker.job].skill,
            cost = trainingPrice(worker, skill),
            result = trainResident(s, worker.id, skill);
          if (result.ok) {
            purchases.push({
              at: time,
              id: worker.id,
              type: "skill",
              skill,
              cost,
            });
            longestWait = Math.max(longestWait, time - lastPurchase);
            lastPurchase = time;
            continue;
          }
        }
      }
    }
    const upgrade = choices.sort((a, b) => a.roi - b.roi)[0];
    const wait = next ? (price(s, next) - s.money) / Math.max(1, s.rate) : 300;
    if (
      upgrade &&
      upgrade.cost <= s.money &&
      (project || upgrade.roi < Math.max(50, wait * 0.8))
    )
      upgrade.mod ? dedicated(upgrade.mod) : purchase(upgrade.item);
  }
  longestWait = Math.max(longestWait, time - lastPurchase);
  return {
    scenario: route.id,
    seconds: time,
    completed: s.completed,
    milestones,
    actualIncome,
    income: {
      manual: s.manualIncome,
      production: s.productionIncome,
      live: s.liveIncome,
      base: s.community.baseIncome,
      jobs: s.community.jobIncome,
      postal: s.postalIncome,
    },
    longestWait,
    maxPowerDeficit,
    orders: s.ordersCompleted,
    counts: s.counts,
    upgrades: s.upgrades.levels,
    freight: s.dimensions.moved,
    project: s.project,
    projectByRealm: s.projectByRealm,
    purchases,
    samples,
    state: s,
  };
}
if (process.argv[1]?.endsWith("balance-v1.1l.mjs")) {
const results = [];
for (const route of ROUTES.filter(
  (r) => selected === "all" || r.id === selected,
)) {
  const r = simulate(route),
    { state, ...report } = r;
  writeFileSync(
    `${out}/${route.id}.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  writeFileSync(`${out}/${route.id}-save.json`, JSON.stringify(state) + "\n");
  const { purchases, samples, counts, ...summary } = report;
  results.push(summary);
  console.log(
    JSON.stringify({
      scenario: r.scenario,
      seconds: r.seconds,
      completed: r.completed,
      longestWait: r.longestWait,
      actualIncome: r.actualIncome,
      purchases: r.purchases.length,
    }),
  );
}
writeFileSync(
  `${out}/${selected === "all" ? "summary" : selected + "-summary"}.json`,
  JSON.stringify(
    {
      method:
        "Deterministic real advance() foreground simulation; purchases every 4 s, route-specific clicks and actual job/path logic; ROI estimates guide investment, results record realized payouts. Not a human playthrough.",
      maxSeconds,
      results,
    },
    null,
    2,
  ) + "\n",
);

}
