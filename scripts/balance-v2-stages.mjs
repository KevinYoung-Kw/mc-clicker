// Stage-aware variant of the global route policy; resolves actual research prerequisites; uses a named immutable runtime snapshot.
import {writeFileSync,mkdirSync,readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const engineName=process.env.V2_ENGINE||'life-engine-final';
if(!/^[a-z0-9-]+$/.test(engineName))throw Error('Invalid engine name');
const {game,catalog,upgrades,residents,housing,housingData,power,guidance,research}=await import(`../docs/v2.0.0/simulation/${engineName}.mjs`);
const {CATALOG,ITEMS,ancestors}=catalog;
const {fresh,n,buy,price,unlocked,rates,advance,action,mine,frontier,sites,PROJECT_TARGET}=game;
const {UPGRADE_CATALOG,upgradeStatus,upgradePrice,buyUpgrade,upgradeLevel}=upgrades;
const {trainResident,trainingPrice,JOBS,assignJob,jobAvailable}=residents;
const {housingCapacity}=housingData;
const {starterHomeAvailable,claimStarterHome,homeCost,housingSites,housingPlacementReason,buildHome}=housing;
const {connectAll,setAutoConnect,powerSnapshot}=power;
const {buyGuidance}=guidance;
const sourceHashes=JSON.parse(readFileSync(new URL(`../docs/v2.0.0/simulation/${engineName}-manifest.json`,import.meta.url)));
export const ROUTES = [
 {id:'village-life',extra:['V4','V6','V7','V8','V9','V12','V15','V25','V24'],prefer:['V'],click:2,residents:8},
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
const out = option("--out", "docs/v2.0.0/simulation/full-routes");
const maxSeconds = +option("--max-seconds", "14400");
const selected = option("--route", "all");
mkdirSync(out, { recursive: true });

export function simulate(route, { afterIncome = null, seed = 17, limit = maxSeconds, stopAtNether = false } = {}) {
  const s = fresh(0),
    required = ancestors("Z3"),
    milestones = [],
    purchases = [],
    samples = [];
  s.garden.naturalSeed = seed;
  const management=[];
  for(const id of ['V4','V11','M9']){required.add(id);for(const dep of ancestors(id))required.add(dep);}
  const mark=(kind,id)=>management.push({at:time,kind,id});
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
    if (item.id === 'E2') for (let i=0;i<12;i++)if(action(s,'end-eye').ok)mark('portal-eye','end-eye');
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
  function house() {
    if (starterHomeAvailable(s)) { const r=claimStarterHome(s); if(r.ok){purchases.push({at:time,id:'claim-home',cost:0});return true;} }
    if(housingCapacity(s)>n(s,'V2'))return false;
    const cost=homeCost(s,'oak'); if(s.money<cost)return false;
    for(let rotation=0;rotation<4;rotation++){
      const site=housingSites(s,'oak',rotation).find(p=>!housingPlacementReason(s,'oak',p));
      if(site){const r=buildHome(s,'oak',site);if(r.ok){purchases.push({at:time,id:'home:oak',cost});return true;}}
    }
    const edge=frontier(s,'overworld').sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z))[0];
    if(edge&&s.money>=price(s,ITEMS.V1,'overworld')){const cost=price(s,ITEMS.V1,'overworld');const r=buy(s,'V1',{...edge,realm:'overworld'});if(r.ok){purchases.push({at:time,id:'V1',realm:'overworld',cost});return true;}}
    return false;
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
      if (resident && assignJob(s, resident.id, job).ok) mark('job',job);
    }
  }
  for (; time < limit && !s.completed && !(stopAtNether && n(s,'N1')); time++) {
    const total = s.total;
    advance(s, 1);
    if (time % (n(s, "V2") ? route.click : 1) === 0) mine(s, () => 1);
    actualIncome += s.total - total;
    if(n(s,'M5')&&time%15===0){const connected=connectAll(s).connected;if(connected.length)mark('power',connected.join(','));if(s.grid.learnedConnection&&!s.grid.autoConnect)setAutoConnect(s,true);}
    afterIncome?.(s, time, { purchase, purchases });
    if (time % 15 === 0) {
      staff();
      for (const key of ["farm", "wool", "treasure", "chorus", "brew"])
        if (s.harvest[key] >= 1 && route.id !== 'low-active' && action(s,key).ok)mark('manual-work',key);
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
          spilled: s.grid.spilled,
          generated: s.grid.generated,
          spent: s.grid.spent,
          disconnected: r.electricity.loads.filter(l=>!l.connected).map(l=>l.id),
          loads: r.electricity.loads.map(l=>({id:l.id,rated:l.rated,required:l.required,actual:l.actual,state:l.state})),
          sources: r.electricity.sources,
          counts: {...s.counts},
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
    if (time % (route.id==='low-active'?12:4)) continue;
    for(const id of ['industrial','modern',...(route.extra.includes('V25')?['community-life']:[]),...(route.extra.includes('V24')?['cargo-tools']:[])]){const status=research.researchStatus(s,id);if(status.kind==='ready'&&status.affordable){const r=research.startResearch(s,id);if(r.ok)purchases.push({at:time,id:'research:'+id,cost:r.cost});}}
    const stageTech=!s.research.completed.industrial?'industrial':!s.research.completed.modern?'modern':null;
    const stageNeed=stageTech&&n(s,'V11')?research.researchPrerequisiteItems(s,stageTech).map(x=>ITEMS[x.id]).filter(x=>unlocked(s,x)).sort((a,b)=>price(s,a)-price(s,b))[0]:null;
    if(stageNeed&&s.money>=price(s,stageNeed)){if(purchase(stageNeed))continue;}

    const guide=['info','goals'].find(id=>!s.guidance[id]);
    if(guide){const r=buyGuidance(s,guide);if(r.ok)purchases.push({at:time,id:guide,cost:r.cost});continue;}
    if (n(s,'V2') && (starterHomeAvailable(s) || housingCapacity(s)<Math.min(Math.max(route.residents,research.RESEARCH_BY_ID.industrial.residents),n(s,'V2')+1))) { if(house())continue; }
    if (
      n(s, "V2") < Math.max(route.residents,research.RESEARCH_BY_ID.industrial.residents) &&
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
    let next = CATALOG.filter(
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
    const gateOwner=CATALOG.filter(i=>required.has(i.id)&&!n(s,i.id)&&i.deps.every(d=>n(s,d))&&i.gate?.id&&n(s,i.gate.id)<i.gate.level).map(i=>ITEMS[i.gate.id]).filter(Boolean).sort((a,b)=>price(s,a)-price(s,b))[0];
    if(gateOwner&&(!next||price(s,gateOwner)<price(s,next)))next=gateOwner;
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
      if(s.money<price(s,item))continue;
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
  const actions=[...management,...purchases.map(p=>({at:p.at,kind:'purchase',id:p.id}))].sort((a,b)=>a.at-b.at);
  const gaps=actions.slice(1).map((a,i)=>({start:actions[i].at,end:a.at,seconds:a.at-actions[i].at}));
  if(actions.length&&time>actions.at(-1).at)gaps.push({start:actions.at(-1).at,end:time,seconds:time-actions.at(-1).at});
  return {
    effectiveActionCount:actions.length,effectiveActionLongestGap:Math.max(0,...gaps.map(g=>g.seconds)),alarmWindows:gaps.filter(g=>g.seconds>120),management,
    researchOnlySeconds:0,research:structuredClone(s.research),
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
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
const results = [];
for (const route of ROUTES.filter(
  (r) => selected === "all" || r.id === selected,
)) {
  const profile=option('--trace-profile','');
  const trace=profile?(await import('./narrative-session-v17.mjs')).narrativeSession(profile):null;
  const r = simulate(route, { afterIncome: trace?.tick, stopAtNether:process.argv.includes('--stop-at-nether') }),
    { state, ...report } = r;
  writeFileSync(
    `${out}/${route.id}.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  writeFileSync(`${out}/${route.id}-save.json`, JSON.stringify(state) + "\n");
  if(trace)writeFileSync(`${out}/${route.id}-narrative.json`,JSON.stringify(trace.finish(state,r.purchases),null,2)+'\n');
  const { purchases, samples, counts, ...summary } = report;
  results.push(summary);
  console.log(
    JSON.stringify({
      scenario: r.scenario,
      seconds: r.seconds,
      completed: r.completed,
      longestWait: r.longestWait,
      effectiveActionLongestGap:r.effectiveActionLongestGap,
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
        "Frozen named runtime; sourceHashes identifies the exact schema and prices. Full-game v17 cost/ROI policy, distinct from earlier active-duty research policy; real prices, paid land/housing, free starter home, level prerequisites, explicit connections, jobs and upgrades. Foreground 1s steps, scripted route-specific tap frequency; no reward mail or money injection into the played state. ROI probes use affordable legally purchased cloned states only and nominal rates; they do not prove realised return. Effective actions are successful purchases, job assignments, new power connections, manual work starts and portal insertions; narration, repeated mining taps and auto-completion are excluded. Alarm windows over120s are diagnostic thresholds, not validated fun cutoffs. Mainline research is instant so pure research-time wait is zero. Not a human playthrough or a measured human completion time.",
      version: JSON.parse(readFileSync(new URL('../package.json',import.meta.url))).version,
      sourceHashes,
      maxSeconds,
      results,
    },
    null,
    2,
  ) + "\n",
);

}
