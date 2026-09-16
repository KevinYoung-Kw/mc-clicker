import { privateStash } from './easter-eggs/private-stash.js';
import { afterHours } from './easter-eggs/after-hours.js';
export const EASTER_EGGS=Object.freeze([privateStash,afterHours]);
export const eggById=id=>EASTER_EGGS.find(e=>e.id===id);
export const freshEasterEggs=()=>({version:1,clock:0,attemptIn:60,misses:0,lastOfferAt:null,entries:{},wardrobe:{owned:[],equipped:null},revision:0});
const nonnegative=(v,fallback=0)=>Number.isFinite(v)?Math.max(0,v):fallback;
export function restoreEasterEggs(raw,s){
 const e=freshEasterEggs();if(raw?.version!==1)return e;
 e.clock=nonnegative(raw.clock);e.attemptIn=Math.min(60,nonnegative(raw.attemptIn,60));e.misses=Math.min(4,Math.floor(nonnegative(raw.misses)));
 e.lastOfferAt=Number.isFinite(raw.lastOfferAt)?Math.min(s.play,nonnegative(raw.lastOfferAt)):null;
 for(const spec of EASTER_EGGS){
  const v=raw.entries?.[spec.id],statuses=spec.kind==='dialogue'?['offered','away','claimed']:['offered','seeking','claimed'];
  if(!v||!statuses.includes(v.status))continue;
  const entry={status:v.status,version:spec.version,announced:v.announced===true,hinted:v.hinted===true,offerElapsed:Math.min(18,nonnegative(v.offerElapsed))};
  if(spec.kind==='dialogue'){
   if(v.status==='away')entry.returnAt=s.play+Math.min(spec.duration,nonnegative(v.returnAt-s.play,spec.duration));
   if(v.status!=='offered')entry.paid=spec.cost;
  }else{const p=v.point;entry.point=p&&Number.isFinite(p.x)&&Number.isFinite(p.z)&&p.realm==='overworld'?{x:p.x,z:p.z,realm:p.realm}:null;entry.reward=spec.reward;}
  e.entries[spec.id]=entry;
 }
 for(const spec of EASTER_EGGS)if(spec.accessory&&e.entries[spec.id]?.status==='claimed')e.wardrobe.owned.push(spec.accessory);
 if(e.wardrobe.owned.includes(raw.wardrobe?.equipped))e.wardrobe.equipped=raw.wardrobe.equipped;
 return e;
}
// Kept for the single spatial treasure. Dialogue events never block its location.
export function activeEgg(s){return Object.entries(s.easterEggs.entries).find(([id,e])=>eggById(id)?.kind==='scenery'&&e.status!=='claimed')?.[0]||null;}
export const offeredEgg=s=>EASTER_EGGS.find(spec=>{const e=s.easterEggs.entries[spec.id];return e?.status==='offered'&&!e.announced;})?.id||null;
export const narratorAway=s=>EASTER_EGGS.find(spec=>spec.kind==='dialogue'&&s.easterEggs?.entries?.[spec.id]?.status==='away')?.id||null;
export function returnRemaining(s){const id=narratorAway(s);return id?Math.max(0,Math.ceil(s.easterEggs.entries[id].returnAt-s.play)):0;}
export function equipNarrator(s,id){const w=s.easterEggs.wardrobe;if(id!==null&&!w.owned.includes(id))return false;w.equipped=id;s.easterEggs.revision++;return true;}
export function advanceEasterEggs(s,dt,{quiet=false,random=Math.random}={}){
 const e=s.easterEggs;
 if(!s.guidance.info||!s.guidance.notices||!quiet||narratorAway(s)||!Number.isFinite(dt)||dt<=0)return false;
 dt=Math.min(1,dt);e.clock+=dt;const repaired=refreshEggLocations(s,random);
 if((s.communityStories?.lastStoryAt!=null&&s.play-s.communityStories.lastStoryAt<240)||offeredEgg(s)||(e.lastOfferAt!==null&&s.play-e.lastOfferAt<240)||(s.narrative?.lastSuggestionAt!=null&&s.play-s.narrative.lastSuggestionAt<240))return repaired;
 const next=EASTER_EGGS.find(spec=>!e.entries[spec.id]&&spec.eligible(s));if(!next)return repaired;
 e.attemptIn-=dt;if(e.attemptIn>0)return repaired;e.attemptIn=60;
 if(random()>.3&&e.misses<3){e.misses++;return repaired;}
 const prepared=next.prepare(s,random);if(!prepared)return repaired;
 e.entries[next.id]={...prepared,version:next.version,status:'offered',announced:false,hinted:false,checkedRevision:s.layoutRevision};
 e.lastOfferAt=s.play;e.revision++;e.misses=0;return true;
}
export function startEgg(s,id){const e=s.easterEggs.entries[id];if(!e||eggById(id)?.kind!=='scenery'||e.status==='claimed')return false;e.status='seeking';e.announced=true;s.easterEggs.revision++;return true;}
export function beginDialogueEgg(s,id){
 const e=s.easterEggs.entries[id],spec=eggById(id);
 if(!e||spec?.kind!=='dialogue'||e.status!=='offered')return {ok:false,reason:'这次外出已经安排过了'};
 if(!Number.isFinite(s.money)||s.money<spec.cost)return {ok:false,reason:`还差 ${Math.ceil(spec.cost-s.money)} 绿宝石`};
 s.money-=spec.cost;e.status='away';e.paid=spec.cost;e.returnAt=s.play+spec.duration;e.announced=true;s.easterEggs.revision++;
 s.narrative.current=null;s.narrative.gap=30;s.narrative.quiet=0;
 return {ok:true,cost:spec.cost,text:spec.depart};
}
// The simulation's foreground clock runs even when a menu is open or chatter is muted.
export function advanceDialogueEggs(s){
 let changed=false;
 for(const spec of EASTER_EGGS){const e=s.easterEggs.entries[spec.id];if(spec.kind!=='dialogue'||e?.status!=='away'||s.play<e.returnAt)continue;
  e.status='claimed';const w=s.easterEggs.wardrobe;if(!w.owned.includes(spec.accessory))w.owned.push(spec.accessory);w.equipped=spec.accessory;s.easterEggs.revision++;s.narrative.gap=0;changed=true;
 }
 return changed;
}
export function collectEgg(s,id){
 const e=s.easterEggs.entries[id],spec=eggById(id);
 if(!e||spec?.kind!=='scenery'||e.status!=='seeking'||!spec.valid(s,e.point))return {ok:false,reason:'此处没有可领取的彩蛋'};
 e.status='claimed';s.easterEggs.revision++;return {ok:true,value:e.reward,title:spec.title,text:spec.found.join(' ')};
}
export function refreshEggLocations(s,random=Math.random){
 let changed=false;
 for(const spec of EASTER_EGGS){const e=s.easterEggs.entries[spec.id];if(spec.kind!=='scenery'||!e||e.status==='claimed'||e.checkedRevision===s.layoutRevision)continue;
  e.checkedRevision=s.layoutRevision;if(spec.valid(s,e.point))continue;e.point=spec.prepare(s,random)?.point||null;s.easterEggs.revision++;changed=true;
 }
 return changed;
}
