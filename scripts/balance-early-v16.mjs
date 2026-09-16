// Reproducible investment policies, not a prediction of human completion times.
// Uses the real foreground simulation, purchases, housing, jobs and power paths.
import {mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {ITEMS} from '../src/catalog.js';
import {fresh,n,buy,price,requirements,rates,advance,mine,action,frontier,populationCap} from '../src/game.js';
import {buyGuidance} from '../src/guidance.js';
import {postalLevel,postalRate,postalUpgradeCost,upgradePostal} from '../src/mail.js';
import {housingCapacity} from '../src/housing-data.js';
import {starterHomeAvailable,claimStarterHome,homeCost,housingSites,housingPlacementReason,buildHome} from '../src/housing.js';
import {assignJob,jobAvailable,jobSlots} from '../src/residents.js';
import {connectAll,setAutoConnect} from '../src/power.js';

const OPENING=['info','goals','T1','V1','V18','counter','V2','T7'];
const INDUSTRY=['T2','T3','M1','M2','M4','M5','M6','M3','M8','M9','M7','M16','M17','M20','T5','N1'];
const VILLAGE=['L1','V3','V4','V7','V8','V9','V6','V11','V12','V14','V15'];
const LIVE=['L1','V3','M5','M6','L2','L5','L6','L3','L4','V11','V12','L8'];
export const PROFILES=[
 {id:'rush',branch:INDUSTRY,people:4,postal:false,decision:4,active:1},
 {id:'industry',branch:INDUSTRY,people:4,postal:true,decision:8,active:.45},
 {id:'village',branch:[...VILLAGE,...INDUSTRY],people:6,postal:true,decision:8,active:.45},
 {id:'live',branch:[...LIVE,...INDUSTRY],people:5,postal:true,decision:8,active:.45},
 {id:'low-active',branch:[...VILLAGE,...INDUSTRY],people:4,postal:true,decision:12,active:.08},
 {id:'industry-no-postal',branch:INDUSTRY,people:4,postal:false,decision:8,active:.45},
 {id:'industry-maintained',branch:INDUSTRY,people:4,postal:true,decision:8,active:.45,invest:true},
];

export function simulate(profile,{seconds=900,seed=17}={}){
 const s=fresh(0);s.garden.naturalSeed=seed;
 const purchases=[],milestones={},samples=[],failures=new Map();
 let time=0,nextClick=0,lastPurchase=0,longestWait=0,pending=null;
 const record=(id,result)=>{
  if(!result.ok){failures.set(result.reason,(failures.get(result.reason)||0)+1);return false;}
  purchases.push({at:Math.round(time),id,level:n(s,id)||undefined,cost:result.cost,remaining:Math.round(s.money)});
  if(!(id in milestones))milestones[id]=Math.round(time);
  longestWait=Math.max(longestWait,time-lastPurchase);lastPurchase=time;return true;
 };
 function land(){
  const p=frontier(s,'overworld').sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z)||(seed%2?b.x-a.x:a.x-b.x))[0];
  if(!p)return false;const cost=price(s,ITEMS.V1,'overworld');
  return s.money>=cost&&record('V1',{...buy(s,'V1',{...p,realm:'overworld'}),cost});
 }
 function home(){
  if(starterHomeAvailable(s))return record('claim-home',claimStarterHome(s));
  const type='oak',cost=homeCost(s,type);if(s.money<cost)return false;
  for(let rotation=0;rotation<4;rotation++){
   const p=housingSites(s,type,rotation).find(p=>!housingPlacementReason(s,type,p));
   if(p)return record('home:oak',buildHome(s,type,p));
  }
  return land();
 }
 function purchase(id){
  if(['info','goals','counter'].includes(id))return record(id,buyGuidance(s,id));
  if(id==='V1')return land();
  if(id==='V2'&&n(s,'V2')){
   if(n(s,'V2')>=populationCap(s))return land();
   if(housingCapacity(s)<=n(s,'V2'))return home();
  }
  const item=ITEMS[id],cost=price(s,item);if(s.money<cost)return false;
  const r=buy(s,id);
  if(!r.ok&&r.reason.includes('挤'))return land();
  return record(id,{...r,cost});
 }
 function prerequisite(id,seen=new Set()){
  if(!ITEMS[id]||seen.has(id))return null;seen.add(id);
  for(const dep of ITEMS[id].deps)if(!n(s,dep))return prerequisite(dep,seen)||dep;
  const gate=ITEMS[id].gate;if(gate?.id&&n(s,gate.id)<gate.level)return prerequisite(gate.id,seen)||gate.id;
  return requirements(s,ITEMS[id]).length?null:id;
 }
 function staff(){
  // Start a source job first; dispatch jobs are shared with the village panel.
  const jobs=profile.id==='live'?['musician','host','hauler','stagehand','miner']:
   profile.id.startsWith('industry')||profile.id==='rush'?['miner','hauler','crafter','hauler','farmer']:
   ['farmer','hauler','rancher','musician','hauler','merchant'];
  const desired={};
  for(const job of jobs){desired[job]=(desired[job]||0)+1;if(!jobAvailable(s,job))continue;
   if(s.community.residents.filter(r=>r.job===job&&!r.reserve).length>=Math.min(desired[job],jobSlots(s,job)))continue;
   const r=s.community.residents.find(r=>r.job==='idle'&&!r.reserve);if(r)assignJob(s,r.id,job);
  }
 }
 function decision(){
  const opening=OPENING.find(id=>ITEMS[id]?!n(s,id):!s.guidance[id]);
  if(opening){pending=opening;return purchase(opening);}
  if(starterHomeAvailable(s)||housingCapacity(s)<1)return home();
  // Paired postal policy is otherwise identical, so its opportunity cost is visible.
  if(profile.postal&&postalLevel(s)<5){pending='postal';const cost=postalUpgradeCost(s);return s.money>=cost&&record('postal:'+ (postalLevel(s)+1),upgradePostal(s));}
  const desiredPeople=Math.min(profile.people,2+Math.floor(Object.keys(s.placements).length/4));
  if(n(s,'V2')<desiredPeople){pending='V2';return purchase('V2');}
  // An alternative to saving only for the next machine: expand the same mine,
  // processing and sales chain once its automatic collection is running.
  if(profile.invest&&n(s,'M8')){
   const target=[['V3',2],['M1',3],['M2',2]].find(([id,level])=>n(s,id)<level);
   if(target){pending=prerequisite(target[0])||target[0];return purchase(pending);}
  }
  const next=profile.branch.find(id=>!n(s,id));
  if(!next){pending=null;return false;}
  const target=prerequisite(next);pending=target||next;
  if(target)return purchase(target);
  return false;
 }
 const dt=.2;
 for(let step=0;step<seconds/dt;step++){
  time=step*dt;advance(s,dt);
  // Tap at 2/s before iron; afterwards hold at the actual 5/s. Duty cycle leaves
  // time for reading/managing. Low activity = 8% of each 30-second interval.
  const mining=time%30<30*profile.active;
  if(mining&&time+1e-8>=nextClick){
   mine(s,()=>1);const interval=n(s,'T3')?.2:.5;
   // Alternating 0.4/0.6 steps gives 2 taps/s; never catch up an idle period.
   nextClick=(time-nextClick>interval?time:nextClick)+interval;
  }
  if(step%50===0){staff();if(n(s,'M5')){connectAll(s);if(s.grid.learnedConnection&&!s.grid.autoConnect)setAutoConnect(s,true);}}
  if(step%75===0&&profile.active>.1)for(const key of ['farm','wool','treasure','music'])if(s.harvest[key]>=1)action(s,key);
  if(step%Math.round(profile.decision/dt)===0)decision();
  if(step%300===0){const r=rates(s);samples.push({at:Math.round(time),money:Math.round(s.money),total:Math.round(s.total),rate:s.rate,potential:r.total,
   postal:postalRate(s),base:s.community.baseIncome,jobs:s.community.jobIncome,manual:s.manualIncome,production:s.productionIncome,live:s.liveIncome,
   shipped:s.community.shipped,waiting:s.community.batches.reduce((a,b)=>a+Math.max(0,b.qty-b.delivered),0),pending});}
 }
 let burst=0,newBurst=0;
 for(const p of purchases){
  burst=Math.max(burst,purchases.filter(q=>q.at>=p.at&&q.at<p.at+60&&!q.id.startsWith('home')&&q.id!=='claim-home').length);
  if(p.at>=180)newBurst=Math.max(newBurst,purchases.filter(q=>q.at>=p.at&&q.at<p.at+60&&q.level===1).length);
 }
 return {profile:profile.id,seed,seconds,milestones,purchases,samples,summary:{income:Math.round(s.total),money:Math.round(s.money),purchases:purchases.length,
  newFacilities:Object.keys(s.placements).length,maxPurchasesPerMinute:burst,maxNewItemsPerMinuteAfterOpening:newBurst,longestPurchaseGap:Math.round(Math.max(longestWait,seconds-lastPurchase)),idleTail:Math.round(seconds-lastPurchase),
  shipped:Math.round(s.community.shipped),manual:Math.round(s.manualIncome),base:Math.round(s.community.baseIncome),postal:Math.round(s.postalIncome),production:Math.round(s.productionIncome),live:Math.round(s.liveIncome),pending,counts:s.counts},failures:[...failures]};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const arg=(key,fallback)=>process.argv.includes(key)?process.argv[process.argv.indexOf(key)+1]:fallback;
 const out=arg('--out','docs/v1.6/qa/alpha3/balance'),seconds=+arg('--seconds',900),seeds=arg('--seeds','17').split(',').map(Number);
 mkdirSync(out,{recursive:true});const results=[];
 for(const profile of PROFILES.filter(p=>arg('--profile','all')==='all'||p.id===arg('--profile')))for(const seed of seeds){
  const report=simulate(profile,{seconds,seed});writeFileSync(`${out}/${profile.id}-${seed}.json`,JSON.stringify(report,null,2)+'\n');
  const compact={profile:profile.id,seed,milestones:report.milestones,...report.summary};results.push(compact);console.log(JSON.stringify(compact));
 }
 writeFileSync(`${out}/summary.json`,JSON.stringify({method:'Real foreground engine, 0.2s steps, no money injection or mail rewards. Paid housing and land, manual/hold duty cycles, actual jobs and connections. Scripted policies, not human playthroughs.',results},null,2)+'\n');
}
