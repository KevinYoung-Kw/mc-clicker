// Research wrappers around a frozen REAL engine, not a replacement economy.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const cliArg=(key,fallback)=>process.argv.includes(key)?process.argv[process.argv.indexOf(key)+1]:fallback;
const engineName=cliArg('--engine','baseline-engine');
if(!/^[a-z0-9-]+$/.test(engineName))throw new Error('Invalid engine snapshot');
const engine=await import(`../docs/v2.0.0/simulation/${engineName}.mjs`);
const {game:G,catalog:C,residents:R,housing:H,housingData:HD,power:P,guidance:Q,mail:M}=engine;
const research=engine.research||await import('../docs/v2.0.0/simulation/research-model.mjs');
const {freshResearch,researchRequirements,researchForItem,researchPrerequisites,startResearch,advanceResearch,RESEARCH_BY_ID}=research;

const INDUSTRY = ['T2','T3','M1','M2','M4','M5','M6','M3','M8','M9','M7','M16','M17','M20','T5','N1'];
const VILLAGE = ['L1','V3','V4','V7','V8','V9','V6','V11','V12','V14','V15'];
const LIVE = ['L1','V3','M5','M6','L2','L5','L6','L3','L4','V11','V12','L8'];
export const PROFILES = [
  {id:'active',branch:[...VILLAGE,...INDUSTRY],people:6,decision:4,active:.75,invest:true,cosmetics:true},
  {id:'low-frequency',branch:[...VILLAGE,...INDUSTRY],people:4,decision:12,active:.08,invest:true},
  {id:'village',branch:[...VILLAGE,...INDUSTRY],people:6,decision:8,active:.45,invest:true,cosmetics:true},
  {id:'industrial',branch:INDUSTRY,people:4,decision:8,active:.45,invest:true},
  {id:'livestream',branch:[...LIVE,...VILLAGE,...INDUSTRY],people:6,decision:8,active:.45,invest:true,cosmetics:true},
  {id:'no-livestream',branch:[...VILLAGE,...INDUSTRY],people:6,decision:8,active:.45,invest:true,noLive:true,cosmetics:true},
  {id:'no-cosmetics',branch:[...VILLAGE,...INDUSTRY],people:6,decision:8,active:.45,invest:true,cosmetics:false},
];
const q = (values, fraction) => values.length ? values.toSorted((a,b)=>a-b)[Math.min(values.length-1,Math.floor(values.length*fraction))] : 0;
const round = value => Math.round(value * 1000) / 1000;
function receiptMap(s) { return new Map((s.marketLedger?.receipts||[]).map(r=>[`${r.source}:${r.bucket}`,r.money])); }
function receiptIncrease(before,s) { return (s.marketLedger?.receipts||[]).reduce((sum,r)=>sum+Math.max(0,r.money-(before.get(`${r.source}:${r.bucket}`)||0)),0); }

export function simulate(profile,{duration=20,gates='strong',seconds=7200,seed=17,maintenance=true,adaptive=false}={}) {
  const s=G.fresh(0); s.garden.naturalSeed=seed; s.research=freshResearch();
  const events=[],samples=[],purchases=[],milestones={},blocked={},opportunities=[],researchMilestones={};
  let t=0,nextClick=0,pending=null,blockedTarget=null,saleMoney=0,lastEvent=0,longestEventGap=0;
  let researchOnly=0,prerequisiteWait=0,targetMoneyWait=0,researchFundsWait=0,researchCost=0,spent=0,lastAdaptive=-120;
  const verifiedOptions=[];
  const dt=.2;
  function event(kind,id,extra={}) { longestEventGap=Math.max(longestEventGap,t-lastEvent);lastEvent=t;events.push({at:round(t),kind,id,...extra}); }
  function record(id,result,cost=0) {
    if(!result.ok){blocked[result.reason]=(blocked[result.reason]||0)+1;return false;}
    const actual=result.cost??cost; spent+=actual; purchases.push({at:round(t),id,level:G.n(s,id)||undefined,cost:actual});
    if(milestones[id]===undefined)milestones[id]=round(t);event('purchase',id,{cost:actual});return true;
  }
  function land(){const p=G.frontier(s,'overworld').sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z)||(seed%2?b.x-a.x:a.x-b.x))[0];if(!p)return false;
    const cost=G.price(s,C.ITEMS.V1,'overworld');return s.money>=cost&&record('V1',G.buy(s,'V1',{...p,realm:'overworld'}),cost);}
  function home(){if(H.starterHomeAvailable(s))return record('claim-home',H.claimStarterHome(s));const cost=H.homeCost(s,'oak');if(s.money<cost)return false;
    for(let rotation=0;rotation<4;rotation++){const p=H.housingSites(s,'oak',rotation).find(p=>!H.housingPlacementReason(s,'oak',p));if(p)return record('home:oak',H.buildHome(s,'oak',p),cost);}return land();}
  function start(id) {
    if(s.research.active===id)return false;
    const row=RESEARCH_BY_ID[id];let result;
    if(gates==='narrow'&&id==='industrial') {
      if(!G.n(s,'V11')||!G.n(s,'M2')||s.money<row.cost)return false;
      const paid=!s.research.projects[id];if(paid){s.money-=row.cost;s.research.projects[id]={paidCost:row.cost,duration,progress:0};}s.research.active=id;result={ok:true,cost:paid?row.cost:0};
    } else result=startResearch(s,id);
    if(!result.ok)return false;
    s.research.projects[id].duration=duration;researchCost+=result.cost;spent+=result.cost;
    event('research-start',id,{cost:result.cost,duration});researchMilestones[`${id}:start`]=round(t);
    if(!duration){advanceResearch(s,Number.EPSILON);event('research-complete',id);researchMilestones[`${id}:complete`]=round(t);}
    return true;
  }
  function purchase(id) {
    if(id==='wait:village-sale')return false;
    if(id==='housing')return home();
    if(id.startsWith('research:'))return start(id.slice(9));
    if(['info','goals','counter'].includes(id))return record(id,Q.buyGuidance(s,id));
    if(id==='V1')return land();
    if(id==='V2'&&G.n(s,'V2')){if(G.n(s,'V2')>=G.populationCap(s))return land();if(HD.housingCapacity(s)<=G.n(s,'V2'))return home();}
    const item=C.ITEMS[id];if(!item)return false;
    const cost=G.price(s,item);if(s.money<cost)return false;
    if(gates!=='none'&&researchRequirements(s,item).length)return false;
    const result=G.buy(s,id);if(!result.ok&&result.reason.includes('挤'))return land();return record(id,result,cost);
  }
  function resolveResearch(id,seen) {
    const row=RESEARCH_BY_ID[id];
    for(const req of row.requires)if(!s.research.completed[req])return resolveResearch(req,seen);
    const items=gates==='narrow'&&id==='industrial'?[['V11',1],['M2',1]]:row.items;
    for(const [dep,level]of items)if(G.n(s,dep)<level)return resolveTarget(dep,seen)||dep;
    if(gates==='strong'&&id==='industrial'){
      if((s.community.residents||[]).filter(r=>!r.reserve).length<4)return 'V2';
      if(HD.housingCapacity(s)<4)return 'housing';
      if(researchPrerequisites(s,id).some(x=>x.includes('成交')))return 'wait:village-sale';
    }
    return `research:${id}`;
  }
  function resolveTarget(id,seen=new Set()) {
    if(!C.ITEMS[id]||seen.has(id))return null;seen.add(id);
    const item=C.ITEMS[id];
    for(const dep of item.deps)if(!G.n(s,dep))return resolveTarget(dep,seen)||dep;
    const gate=item.gate;if(gate?.id&&G.n(s,gate.id)<gate.level)return resolveTarget(gate.id,seen)||gate.id;
    if(gates!=='none'){
      const tech=researchForItem(s,item).find(key=>!s.research.completed[key]);
      if(tech){blockedTarget=id;return resolveResearch(tech,seen);}
    }
    return G.requirements(s,item).length?null:id;
  }
  function staff(){const jobs=profile.id==='livestream'?['musician','host','hauler','stagehand','farmer','miner']:
    profile.id==='industrial'?['miner','hauler','crafter','hauler','farmer']:['farmer','hauler','rancher','musician','hauler','merchant'];
    const desired={};for(const job of jobs){desired[job]=(desired[job]||0)+1;if(!R.jobAvailable(s,job))continue;
      if(s.community.residents.filter(r=>r.job===job&&!r.reserve).length>=Math.min(desired[job],R.jobSlots(s,job)))continue;
      const r=s.community.residents.find(r=>r.job==='idle'&&!r.reserve);if(r&&R.assignJob(s,r.id,job).ok)event('job-assigned',job,{resident:r.id});}}
  function decision(){blockedTarget=null;
    const opening=['info','goals','T1','V1','V18','counter','V2','T7'].find(id=>C.ITEMS[id]?!G.n(s,id):!s.guidance[id]);
    if(opening){pending=opening;return purchase(opening);}
    if(H.starterHomeAvailable(s)||HD.housingCapacity(s)<1)return home();
    if(M.postalLevel(s)<5){pending='postal';const cost=M.postalUpgradeCost(s);return s.money>=cost&&record(`postal:${M.postalLevel(s)+1}`,M.upgradePostal(s),cost);}
    const desired=Math.min(profile.people,2+Math.floor(Object.keys(s.placements).length/4));if(G.n(s,'V2')<desired){pending='V2';return purchase('V2');}
    if(profile.cosmetics&&t>300&&!G.n(s,'X2')&&G.n(s,'V3')&&s.money>5000){pending='X2';return purchase('X2');}
    if(maintenance&&profile.invest&&G.n(s,'M8')){
      const target=[['V3',2],['M1',3],['M2',2]].find(([id,level])=>G.n(s,id)<level);
      if(target){pending=resolveTarget(target[0])||target[0];return purchase(pending);}
    }
    const next=profile.branch.find(id=>!G.n(s,id));if(!next){pending=null;return false;}
    pending=resolveTarget(next)||next;return purchase(pending);
  }
  function scanOpportunities(){
    if(!blockedTarget)return;
    const base=G.rates(s).total, options=[];
    for(const id of ['M1','M2','M6','M7','M8','V3','V4','V12']){
      const item=C.ITEMS[id];if(G.n(s,id)>=item.max||G.requirements(s,item).length||(gates!=='none'&&researchRequirements(s,item).length)||s.money<G.price(s,item))continue;
      const copy=structuredClone(s),cost=G.price(s,item);if(!G.buy(copy,id).ok)continue;
      const gain=G.rates(copy).total-base;if(gain>0)options.push({id,cost,potentialGain:gain});
    }
    if(options.length)opportunities.push({at:round(t),blockedTarget,options});
  }
  function adaptiveInvestment(){
    if(!adaptive||t-lastAdaptive<60||!G.n(s,'M8')||G.n(s,'N1'))return false;
    lastAdaptive=t;
    const baseline=G.rates(s).total, candidates=[];
    for(const id of ['M1','M2','M6','M7','M8','M9','V3','V4','V12']){
      const item=C.ITEMS[id],cost=G.price(s,item);if(G.n(s,id)>=item.max||s.money<cost||G.requirements(s,item).length||(gates!=='none'&&researchRequirements(s,item).length))continue;
      const copy=structuredClone(s);if(!G.buy(copy,id).ok)continue;
      const gain=G.rates(copy).total-baseline;if(gain>0&&cost/gain<240)candidates.push({id,cost,gain,copy});
    }
    candidates.sort((a,b)=>a.cost/a.gain-b.cost/b.gain);
    if(!candidates.length)return false;
    const control=structuredClone(s);G.advance(control,180);
    const tested=candidates.slice(0,2).map(c=>{G.advance(c.copy,180);return {id:c.id,cost:c.cost,net180:c.copy.money-control.money};});
    verifiedOptions.push({at:round(t),pending,options:tested});
    const best=tested.sort((a,b)=>b.net180-a.net180)[0];
    if(best.net180<=0)return false;
    const bought=purchase(best.id);if(bought)event('verified-investment',best.id,{net180:round(best.net180)});return bought;
  }
  for(let step=0;step<seconds/dt;step++){
    t=step*dt;
    if(blockedTarget&&!G.n(s,blockedTarget)){
      const item=C.ITEMS[blockedTarget],tech=researchForItem(s,item).find(id=>!s.research.completed[id]);
      if(tech&&!G.requirements(s,item).length&&s.money>=G.price(s,item)){
        if(s.research.active===tech)researchOnly+=dt;
        else if(researchPrerequisites(s,tech).length)prerequisiteWait+=dt;
        else if(s.money<RESEARCH_BY_ID[tech].cost)researchFundsWait+=dt;
      }
    }
    if(C.ITEMS[pending]&&!G.requirements(s,C.ITEMS[pending]).length&&(gates==='none'||!researchRequirements(s,pending).length)&&s.money<G.price(s,C.ITEMS[pending]))targetMoneyWait+=dt;
    const receipts=receiptMap(s);G.advance(s,dt);saleMoney+=receiptIncrease(receipts,s);
    if(gates!=='none'&&!engine.research){const r=advanceResearch(s,dt);if(r.completed){event('research-complete',r.completed);researchMilestones[`${r.completed}:complete`]=round(t+dt);}}
    if(t%30<30*profile.active&&t+1e-8>=nextClick){G.mine(s,()=>1);const interval=G.n(s,'T3')?.2:.5;nextClick=(t-nextClick>interval?t:nextClick)+interval;}
    if(step%50===0){staff();if(G.n(s,'M5')){const connected=P.connectAll(s).connected;if(connected.length)event('power-connected',connected.join(','));if(s.grid.learnedConnection&&!s.grid.autoConnect)P.setAutoConnect(s,true);}}
    if(step%75===0&&profile.active>.1)for(const key of ['farm','wool','treasure','music'])if(s.harvest[key]>=1&&G.action(s,key).ok)event('manual-work-started',key);
    if(step%Math.round(profile.decision/dt)===0){const acted=decision();if(!acted)adaptiveInvestment();scanOpportunities();}
    if(step%300===0)samples.push({at:round(t),money:round(s.money),income:round(s.total),actualSaleMoney:round(saleMoney),base:round(s.community.baseIncome),pending,blockedTarget,research:structuredClone(s.research)});
    if(G.n(s,'N1'))break;
  }
  const gaps=purchases.slice(1).map((p,i)=>p.at-purchases[i].at),eventGaps=events.slice(1).map((e,i)=>e.at-events[i].at);
  return {profile:profile.id,gates,duration,maintenance,adaptive,seconds:round(t+dt),netherSeconds:milestones.N1??null,milestones,researchMilestones,
    metrics:{researchOnlySeconds:round(researchOnly),technologyPrerequisiteSeconds:round(prerequisiteWait),researchFundsSeconds:round(researchFundsWait),targetMoneySeconds:round(targetMoneyWait),
      purchases:purchases.length,managementActions:events.length,medianPurchaseGap:round(q(gaps,.5)),p90PurchaseGap:round(q(gaps,.9)),longestPurchaseGap:round(Math.max(0,...gaps)),medianManagementGap:round(q(eventGaps,.5)),longestManagementGap:round(longestEventGap),
      potentialOpportunityWindows:opportunities.length,verifiedAlternativeChecks:verifiedOptions.length,verifiedAlternativePurchases:events.filter(e=>e.kind==='verified-investment').length,actualSaleMoney:round(saleMoney),actualIncome:round(s.total),baseIncome:round(s.community.baseIncome),paidResearch:researchCost,totalInvestment:round(spent),saleMinusAllInvestment:round(saleMoney-spent),wallet:round(s.money)},
    events,purchases,samples,opportunities,verifiedOptions,failures:blocked,finalCounts:s.counts,pending};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const arg=(key,fallback)=>process.argv.includes(key)?process.argv[process.argv.indexOf(key)+1]:fallback;
  const profiles=arg('--profiles',PROFILES.map(p=>p.id).join(',')).split(','),gates=arg('--gates','none,narrow,strong').split(','),durations=arg('--durations','0,20,40,60').split(',').map(Number);
  const cases=[];
  for(const gate of gates)for(const duration of gate==='strong'?durations:[0])for(const profile of PROFILES.filter(p=>profiles.includes(p.id))){
    const r=simulate(profile,{gates:gate,duration,seconds:+arg('--seconds','7200'),maintenance:arg('--maintenance','yes')!=='no',adaptive:arg('--adaptive','no')==='yes'});cases.push(r);
    console.log(JSON.stringify({profile:r.profile,gates:gate,duration,netherSeconds:r.netherSeconds,...r.metrics}));
  }
  const out=new URL(`../docs/v2.0.0/simulation/${arg('--out','research-routes.json')}`,import.meta.url);
  const report={engine:engineName,method:'Frozen real engine, 0.2s foreground steps, paid land/housing, real jobs/power/receipts. No reward mail, money injection or researcher. Baseline snapshots omit life; integrated snapshots run their actual life and research exactly once in game.advance. Stage one stops at N1; no claim about later worlds. Policy has a branch queue and planned maintenance. Adaptive mode buys legal upgrades only after a paid purchase versus no-purchase 180s real-engine fork shows positive net cash. Potential opportunities alone are not verified profit or fun. Historical none/narrow0/strong0 separates prerequisites/cost from durations. Integrated snapshots must use strong gates and matching zero mainline durations.',
    sourceHash:createHash('sha256').update(readFileSync(new URL('../docs/v2.0.0/simulation/research-model.mjs',import.meta.url))).digest('hex'),cases};
  writeFileSync(out,JSON.stringify(report,null,2)+'\n');
}
