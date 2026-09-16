import {researchForItem,researchStatus} from './research.js';
import { CATALOG, ITEMS } from './catalog.js';
import { earlyTarget, nextGuidedTarget } from './first-steps.js';
import { requirements } from './game.js';
import { inConstruction } from './facility-shops.js';
import { gardenDiscovered } from './garden-data.js';
import { JOBS, jobAvailable, jobSlots } from './residents.js';
import { priorityInterface } from './guidance.js';

export const DEVELOPMENT_ORDER = ['T1','V1','V18','V2','T7','V3','T2','T3','V4','V6','M1','M2','V11','M5','M6','M7','M9','M3','M8','M16','M15','T5','N1','N12','T8','E1','E2','E9','Z1','Z2','Z3'];
const count=(s,id)=>s.counts[id]||0;
const early=s=>s.play<900&&!count(s,'N1')&&!s.completed;
const people=s=>(s.community?.residents||[]).filter(r=>!r.reserve);
const purchase=(s,id)=>id?{key:`buy:${id}`,kind:'purchase',id,label:ITEMS[id].name}:null;

// A recommendation never changes availability, prices or earned income.
// Use completed work and real connection state; no second countdown or fixed wait.
export function developmentStep(s,report=null){
 const feature=priorityInterface(s);
 if(feature)return {key:`feature:${feature.id}`,kind:'feature',id:feature.id,label:feature.name,icon:feature.icon};
 const opening=earlyTarget(s);
 if(opening)return purchase(s,opening);
 if(early(s)){
  const residents=people(s),idle=residents.some(r=>r.job==='idle'&&!r.cargo);
  const worked=residents.some(r=>r.jobsDone>0||r.jobEarned>0);
  const workers=residents.filter(r=>r.job&&r.job!=='idle');
  const waiting=(s.community?.batches||[]).some(b=>b.qty>b.delivered&&!b.claimed);
  const choices=[];
  if(waiting&&!s.community.shipped&&!workers.some(r=>r.job==='hauler'))choices.push('hauler');
  if(!worked&&!workers.length)choices.push('farmer','miner','musician','crafter');
  const job=idle&&choices.find(id=>jobAvailable(s,id)&&workers.filter(r=>r.job===id).length<jobSlots(s,id));
  if(job){
   const id=job==='hauler'&&!count(s,'M4')?'V3':JOBS[job].target;
   return {key:`job:${job}`,kind:'job',id,job,label:`安排${JOBS[job].name}`,description:JOBS[job].desc};
  }
  if(count(s,'M5')&&!s.grid?.learnedConnection){
   const load=report?.electricity?.loads?.find(l=>!l.connected&&!s.grid?.disabled?.includes(l.id)&&l.rated>0&&count(s,l.id));
   if(load){
    if(!count(s,'M6'))return purchase(s,'M6');
    return {key:'power:first',kind:'power',id:'M5',label:'接通第一台设备',description:'到电力面板接入已有设备，看看它用电后怎样工作。'};
   }
  }
 }
 // Once its technology is known, recommend rail when industrial cargo
 // is transport-limited; later cross-dimension prerequisites still resolve normally.
 const railUseful=!early(s)||(report?.regions?.overworld?.bottleneck==='运输'&&
  ((s.buffers?.overworld?.raw||0)+(s.buffers?.overworld?.goods||0)>0));
 const next=nextGuidedTarget(s,DEVELOPMENT_ORDER.filter(id=>id!=='M16'||railUseful));
 const technology=next&&researchForItem(s,next).find(id=>!s.research?.completed[id]);
 if(technology){
  if(!count(s,'V11'))return purchase(s,nextGuidedTarget(s,['V11']));
  const research=researchStatus(s,technology);
  return {key:'research:'+technology,kind:'research',id:'V11',research:technology,label:'研究'+research.name,description:research.requirements.length?research.requirements.join('；'):'图书馆里选择这项技术，即可开放下一批设施。'};
 }
 return purchase(s,next);
}

// Stable between deliberate actions and first-work milestones. A production
// buffer fluctuating each tick must not reorder merchandise under a finger.
export function createDevelopmentGuide(){
 let previous=null,step=null;
 return (s,report=null)=>{
  const key=JSON.stringify([s.counts,s.research?.completed,s.research?.milestones,s.housing?.revision,s.guidance?.info,s.guidance?.goals,s.guidance?.counter,s.guidance?.nameplate,early(s),s.completed,s.grid?.learnedConnection,s.grid?.disabled,
   people(s).map(r=>[r.id,r.job,!!r.jobsDone,!!r.jobEarned,!!r.reserve]),
   !!s.community?.shipped,!s.community?.shipped&&(s.community?.batches||[]).some(b=>b.qty>b.delivered&&!b.claimed)]);
  if(key!==previous){previous=key;step=developmentStep(s,report);}
  return step;
 };
}

export function discoveryStock(s,family='all',report=null,step=developmentStep(s,report)){
 const pool=CATALOG.filter(i=>inConstruction(i)&&!count(s,i.id)&&
  (i.id!=='V20'||gardenDiscovered(s))&&!(i.id==='L1'&&count(s,'L2'))&&
  (family==='all'||i.family===family));
 // Every unlocked item remains in the list, even when it is not recommended.
 const available=pool.filter(i=>!requirements(s,i).length)
  .sort((a,b)=>Number(b.id===step?.id)-Number(a.id===step?.id)||a.cost-b.cost);
 const soon=pool.filter(i=>requirements(s,i).length&&i.deps.some(id=>count(s,id)))
  .sort((a,b)=>requirements(s,a).length-requirements(s,b).length||a.cost-b.cost).slice(0,2);
 return {step,available,soon};
}
