// P9: same real rules and choices as P8, with eight seconds between business decisions.
// This file is an experiment runner, never loaded by the playable edition.
import {writeFileSync,mkdirSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const engineName=process.env.V2_ENGINE||'life-engine-final';
if(!/^[a-z0-9-]+$/.test(engineName))throw Error('Invalid engine name');
const {game,catalog,upgrades,residents,housing,housingData,power,guidance,research,food,villagerLife}=await import(`../docs/v2.0.0/simulation/${engineName}.mjs`);
const respondsToFood=process.argv.includes('--food-response');
const lifePolicy=process.argv.includes('--life-policy');
if(respondsToFood&&!food)throw Error('Food-response policy requires a frozen food engine');
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
const out = option("--out", "docs/v2.0.0/simulation/power-p1");
const maxSeconds = +option("--max-seconds", "14400");
const selected = option("--route", "all");
mkdirSync(out, { recursive: true });

export function simulate(route, { afterIncome = null, seed = 17, limit = maxSeconds, stopAtNether = false } = {}) {
  const s = fresh(0),
    required = ancestors(stopAtNether ? "N1" : "Z3"),
    milestones = [],
    purchases = [],
    samples = [];
  s.garden.naturalSeed = seed;
  const management=[];
  const foodCare={policy:respondsToFood?'prevent-shortage':'route-only',requests:[],hungryPersonSeconds:0,fedPersonSeconds:0,ingredientCost:0};
  const electricity = { decisions: [], deficitSeconds: 0, generationShortSeconds: 0, maxDeficitRun: 0, losses: 0, surplusRuns: [], operating: [], reasons: {} };
  const history = [];
  let deficitRun = 0, surplusStart = null;
  let reserveTarget=0,reserveUntil=0;
  let pendingBuild=null;
  const generationIds = new Set(['M6','M7','M15','E8']);
  const generationMod = row => typeof row.effects?.generation === 'number';
  const siteScore=(p,id='land')=>{
    if(seed===17)return Math.hypot(p.x,p.z);
    let hash=seed|0;for(const c of `${id}:${p.x}:${p.z}`)hash=Math.imul(hash^c.charCodeAt(0),16777619);
    return Math.hypot(p.x,p.z)+(hash>>>0)/4294967296*.45;
  };
  for(const id of ['V4','V11','M9','M8']){required.add(id);for(const dep of ancestors(id))required.add(dep);}
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
        (a, b) => siteScore(a)-siteScore(b),
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
    if(seed!==17&&item.place&&!n(s,item.id))position=sites(s,item.realm,null,item.id).sort((a,b)=>siteScore(a,item.id)-siteScore(b,item.id))[0]||null;
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
  // Spend on power only in response to working load or a legally affordable
  // planned build. Probes never add money, material, connections or jobs.
  function planPower(next) {
    if (!n(s, 'M5') || !n(s, 'M6')) return false;
    const current = powerSnapshot(s);
    let demand = Math.max(current.demand, ...history.map(x => x.demand));
    let reason = 'working-load';
    const modification=next&&UPGRADE_CATALOG.find(row=>row.id===next.id);
    const nextCost=next?(modification?upgradePrice(s,next.id):price(s,next)):Infinity;
    if (next && !generationIds.has(next.id) && s.money >= nextCost) {
      const copy = structuredClone(s);
      if ((modification?buyUpgrade(copy,next.id):buy(copy, next.id)).ok) {
        connectAll(copy);
        const planned = powerSnapshot(copy).demand;
        if (planned > demand) { demand = planned; reason = `planned:${next.id}`; }
      }
    }
    const plannedTight=reason.startsWith('planned:')&&current.supply<demand*1.15;
    const pending=time<=reserveUntil&&current.supply<reserveTarget-.01;
    if ((current.supply >= demand - 0.01 && !plannedTight && !pending) || demand <= 0) return false;
    const target = Math.max(demand * 1.2,pending?reserveTarget:0), candidates = [];
    if (!pending) {reserveTarget=target;reserveUntil=time+60;}
    for (const item of CATALOG.filter(i => generationIds.has(i.id))) {
      if (!unlocked(s, item) || n(s, item.id) >= item.max || s.money < price(s, item)) continue;
      const copy = structuredClone(s);
      if (!buy(copy, item.id).ok) continue;
      connectAll(copy);
      const supply = powerSnapshot(copy).supply;
      if (supply > current.supply + .01) candidates.push({item, cost: price(s,item), supply});
    }
    for (const row of UPGRADE_CATALOG.filter(row => generationMod(row) || row.energy?.work < 1)) {
      if (upgradeStatus(s, row.id).kind !== 'ready') continue;
      const copy = structuredClone(s);
      if (!buyUpgrade(copy, row.id).ok) continue;
      const after = powerSnapshot(copy), reduction = Math.max(0, current.demand - after.demand);
      if (after.supply > current.supply + .01 || reduction > .01)
        candidates.push({mod: row, cost: upgradePrice(s,row.id), supply: after.supply + reduction, reduction});
    }
    const covers = candidates.filter(c => c.supply >= target);
    // Prefer the cheapest complete remedy; otherwise buy efficient incremental
    // capacity. No blind speculative purchase while supply already meets need.
    const complete = covers.sort((a,b) => a.cost - b.cost)[0];
    const incremental = candidates.sort((a,b) => a.cost / Math.min(target-current.supply,a.supply-current.supply) - b.cost / Math.min(target-current.supply,b.supply-current.supply))[0];
    const choice = complete && complete.cost <= (incremental?.cost || Infinity) * 1.5 ? complete : incremental;
    if (!choice) return false;
    if (!(choice.mod ? dedicated(choice.mod) : purchase(choice.item))) return false;
    if (next && reason.startsWith('planned:')) pendingBuild=next;
    connectAll(s);
    const after = powerSnapshot(s);
    electricity.decisions.push({at:time, reason, id:choice.mod?.id || choice.item.id, cost:choice.cost, beforeSupply:current.supply, beforeDemand:current.demand, plannedDemand:demand, afterSupply:after.supply, afterDemand:after.demand});
    return true;
  }
  function house() {
    if (starterHomeAvailable(s)) { const r=claimStarterHome(s); if(r.ok){purchases.push({at:time,id:'claim-home',cost:0});return true;} }
    if(housingCapacity(s)>n(s,'V2'))return false;
    const cost=homeCost(s,'oak'); if(s.money<cost)return false;
    for(let rotation=0;rotation<4;rotation++){
      const available=housingSites(s,'oak',rotation);if(seed!==17)available.sort((a,b)=>siteScore(a,'home')-siteScore(b,'home'));
      const site=available.find(p=>!housingPlacementReason(s,'oak',p));
      if(site){const r=buildHome(s,'oak',site);if(r.ok){purchases.push({at:time,id:'home:oak',cost});return true;}}
    }
    const edge=frontier(s,'overworld').sort((a,b)=>siteScore(a)-siteScore(b))[0];
    if(edge&&s.money>=price(s,ITEMS.V1,'overworld')){const cost=price(s,ITEMS.V1,'overworld');const r=buy(s,'V1',{...edge,realm:'overworld'});if(r.ok){purchases.push({at:time,id:'V1',realm:'overworld',cost});return true;}}
    return false;
  }
  function staff() {
    const priority=route.id==='livestream-first'
      ? ['host','stagehand','musician','merchant','hauler','farmer','miner','crafter']
      : route.id.startsWith('village')
      ? ['farmer','rancher','hauler','merchant','musician','hauler','farmer','crafter','miner']
      : ['miner','hauler','crafter','merchant','miner','hauler','farmer','rancher','musician'];
    const people=s.community.residents.filter(r=>!r.reserve),wanted={};let slots=0;
    for(const job of priority){
      if(slots>=people.length)break;
      if(!jobAvailable(s,job)||(wanted[job]||0)>=residents.jobSlots(s,job))continue;
      wanted[job]=(wanted[job]||0)+1;slots++;
    }
    for(const [job,target]of Object.entries(wanted)) {
      while(people.filter(r=>r.job===job).length<target){
        const person=people.find(r=>r.job==='idle'&&!r.cargo)||people.find(r=>!r.cargo&&people.filter(p=>p.job===r.job).length>(wanted[r.job]||0));
        if(!person||!assignJob(s,person.id,job).ok)break;
        mark('job',job);
      }
    }
  }
  for (; time < limit && !s.completed && !(stopAtNether && n(s,'N1')); time++) {
    const total = s.total;
    advance(s, 1);
    if(food) {
      const meal=food.foodSnapshot(s);
      foodCare.hungryPersonSeconds+=meal.hungry;
      foodCare.fedPersonSeconds+=meal.fed;
      foodCare.ingredientCost=meal.spent;
    }
    const tickPower = s.grid.last;
    if (tickPower?.demand > 0) {
      const gap = tickPower.consumption + 1e-6 < tickPower.demand;
      if (gap) { electricity.deficitSeconds++; deficitRun++; } else deficitRun=0;
      electricity.maxDeficitRun=Math.max(electricity.maxDeficitRun, deficitRun);
      if (tickPower.supply < tickPower.demand) electricity.generationShortSeconds++;
      electricity.losses += tickPower.lineLoss;
      history.push({at:time, demand:tickPower.demand});
      while (history.length && history[0].at < time-60) history.shift();
      const working=tickPower.loads.filter(l=>l.enabled&&l.rated>0);
      for(const load of tickPower.loads) electricity.reasons[load.state]=(electricity.reasons[load.state]||0)+1;
      // Retain oversupply even when waiting for cargo, and label it. Standby
      // cannot be silently relabelled as a useful power investment.
      if (tickPower.supply > tickPower.demand * 2) {
        if (surplusStart === null) surplusStart=time;
      } else if (surplusStart !== null) {
        if (time-surplusStart >=180) electricity.surplusRuns.push({start:surplusStart,end:time,seconds:time-surplusStart});
        surplusStart=null;
      }
      if(time%15===0) electricity.operating.push({at:time, supply:tickPower.supply,demand:tickPower.demand,actual:tickPower.consumption,stored:s.energy,loss:tickPower.lineLoss,working:working.map(l=>l.id),idle:tickPower.loads.filter(l=>l.state==='idle').map(l=>l.id)});
    } else { deficitRun=0; history.splice(0); }
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
        food:food?food.foodSnapshot(s):null,
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
    if (process.env.V2_TRACE && time%600===0) console.log(JSON.stringify({route:route.id,at:time,money:s.money,supply:s.grid.last?.supply,demand:s.grid.last?.demand,modern:!!s.research.completed.modern,N1:n(s,'N1')}));
    if (time % (route.id==='low-active'?12:8)) continue;
    if(lifePolicy&&route.id==='village-life'&&n(s,'V25')&&s.life.welfare==='off'&&s.money>villagerLife.lifeSnapshot(s).serviceContract.simple*s.community.residents.length*5){
      if(villagerLife.setWelfare(s,'simple').ok)mark('welfare','simple');
    }
    const meal=food?.foodSnapshot(s);
    const needsFood=respondsToFood&&meal?.graceUntil!==null&&meal?.capacity<meal?.people&&meal.clock>=meal.graceUntil-90;
    if(needsFood&&!required.has('V25')) {
      required.add('V25');for(const dep of ancestors('V25'))required.add(dep);
      foodCare.requests.push({at:time,people:meal.people,capacity:meal.capacity,hungry:meal.hungry,reason:'population exceeds meal capacity; grace is ending'});
    }
    // A food-conscious player budgets for a clearly visible shortage. This is
    // a preference policy, not an assertion that the canteen maximises cash ROI.
    if(needsFood&&unlocked(s,ITEMS.V25)&&s.money>=price(s,ITEMS.V25)&&purchase(ITEMS.V25))continue;
    if(pendingBuild) {
      const modification=UPGRADE_CATALOG.find(row=>row.id===pendingBuild.id);
      const eligible=modification?['ready','short'].includes(upgradeStatus(s,pendingBuild.id).kind):unlocked(s,pendingBuild);
      if(!eligible) {mark('power-plan-cancelled',pendingBuild.id);pendingBuild=null;}
      else {
        if(planPower(pendingBuild))continue;
        if(modification?dedicated(pendingBuild):purchase(pendingBuild))pendingBuild=null;
        continue;
      }
    }
    const technologies=new Set();
    function needTech(id){if(technologies.has(id))return;for(const parent of research.RESEARCH_BY_ID[id].requires)needTech(parent);technologies.add(id);}
    if(needsFood)for(const tech of research.researchForItem(s,'V25'))needTech(tech);
    for(const id of required)for(const tech of research.researchForItem(s,id))needTech(tech);
    for(const tech of technologies){const row=research.RESEARCH_BY_ID[tech];for(const [id]of row.items){required.add(id);for(const dep of ancestors(id))required.add(dep);}}
    const ready=[...technologies].map(id=>research.researchStatus(s,id)).find(row=>row.kind==='ready'&&row.affordable);
    if(ready){const r=research.startResearch(s,ready.id);if(r.ok){purchases.push({at:time,id:'research:'+ready.id,cost:r.cost});continue;}}
    const stageTech=[...technologies].find(id=>!s.research.completed[id]&&research.RESEARCH_BY_ID[id].requires.every(p=>s.research.completed[p]));
    const stageNeed=stageTech&&n(s,'V11')?research.researchPrerequisiteItems(s,stageTech).map(x=>ITEMS[x.id]).filter(x=>unlocked(s,x)).sort((a,b)=>price(s,a)-price(s,b))[0]:null;
    if(stageNeed&&s.money>=price(s,stageNeed)){if(purchase(stageNeed))continue;}
    if (planPower(null)) continue;
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
          (a, b) => siteScore(a)-siteScore(b),
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
        // A power ancestor alone is not a reason to buy it now. Keep the first
        // torch; defer other sources until demand or the next affordable build.
        (!generationIds.has(i.id) || i.id==='M6' || route.overbuild || [...required].some(id => {
          const target=ITEMS[id];
          if (!target || generationIds.has(id) || n(s,id)) return false;
          const missing=[...ancestors(id)].filter(dep=>dep!==id&&!n(s,dep));
          return missing.includes(i.id) && missing.every(dep=>generationIds.has(dep)) &&
            !research.researchRequirements(s,id).length &&
            (!target.gate || n(s,target.gate.id)>=target.gate.level) &&
            s.money >= missing.reduce((sum,dep)=>sum+price(s,ITEMS[dep]),price(s,target));
        })) &&
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
    if (planPower(next)) continue;
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
        item.max < 1 ||
        item.id === "V1" ||
        !unlocked(s, item) ||
        n(s, item.id) >= item.max ||
        item.family === "X" ||
        generationIds.has(item.id) ||
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
      if (generationMod(row)) continue;
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
          !generationMod(row) &&
          upgradeStatus(s, row.id).kind === "ready" &&
          upgradePrice(s, row.id) <= s.money * 0.12 &&
          (!next || upgradePrice(s, row.id) <= price(s, next) * 0.3),
      ).sort(
        (a, b) =>
          (route.prefer.includes(a.owner[0]) ? 0 : 1) -
            (route.prefer.includes(b.owner[0]) ? 0 : 1) ||
          upgradePrice(s, a.id) - upgradePrice(s, b.id),
      )[0];
      if (branch && (planPower(branch) || dedicated(branch))) continue;
      if (route.id === "village-first" && n(s, "V11")) {
        const worker = s.community.residents.find(
          (r) =>
            JOBS[r.job]?.skill &&
            residents.skillLevel(r,JOBS[r.job].skill)<(n(s,"V13")?5:3) &&
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
      planPower(upgrade.mod || upgrade.item) || (upgrade.mod ? dedicated(upgrade.mod) : purchase(upgrade.item));
  }
  longestWait = Math.max(longestWait, time - lastPurchase);
  if(surplusStart!==null&&time-surplusStart>=180)electricity.surplusRuns.push({start:surplusStart,end:time,seconds:time-surplusStart});
  electricity.generated=s.grid.generated; electricity.spilled=s.grid.spilled; electricity.consumed=s.grid.spent;
  const actions=[...management,...purchases.map(p=>({at:p.at,kind:'purchase',id:p.id}))].sort((a,b)=>a.at-b.at);
  const gaps=actions.slice(1).map((a,i)=>({start:actions[i].at,end:a.at,seconds:a.at-actions[i].at}));
  if(actions.length&&time>actions.at(-1).at)gaps.push({start:actions.at(-1).at,end:time,seconds:time-actions.at(-1).at});
  return {
    provenance:{engine:engineName,engineSha256:sourceHashes.sha256,policy:lifePolicy?'P9-read-eight-life':'P9-read-eight',policySha256:createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),seed,stopAtNether},
    foodCare,
    electricity,
    effectiveActionCount:actions.length,effectiveActionLongestGap:Math.max(0,...gaps.map(g=>g.seconds)),alarmWindows:gaps.filter(g=>g.seconds>120),management,
    researchOnlySeconds:null,research:structuredClone(s.research),
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
  const r = simulate(route, { seed:+option('--seed','17'), afterIncome: trace?.tick, stopAtNether:process.argv.includes('--stop-at-nether') }),
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
      powerPurchases:r.electricity.decisions.length,
      deficitSeconds:r.electricity.deficitSeconds,
      waste:r.electricity.spilled/Math.max(1,r.electricity.generated),
    }),
  );
}
writeFileSync(
  `${out}/${selected === "all" ? "summary" : selected + "-summary"}.json`,
  JSON.stringify(
    {
      method:
        "Frozen named runtime; sourceHashes identifies exact parameters. Real purchases, paid land/housing, jobs, production and settlement; no reward mail or injected assets. Foreground 1s steps, route-specific tapping. Power responds to current load or an affordable planned build. Optional P6 food-response policy reserves basic meal service before grace ends; preference is declared, not inferred from ROI. P9 leaves eight seconds between business decisions and assigns real available role quotas via assignJob, preserving cargo restrictions and filling new host roles. It also considers affordable first purchases outside the route list; personal skill candidates skip capped levels. Optional life-policy enables tea only on village-life with five minutes budget. General ROI still uses nominal rates, not realised return. Successful management/work intervals exclude narration and repeated mining; they are NOT all available opportunities or proof of fun. Research-only wait is unmeasured (null), even when mainline research is instant. actualIncome includes manual taps; do not add income.manual again. Not a human playthrough.",
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
