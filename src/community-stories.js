import {COMMUNITY_SOUVENIRS,SOUVENIR_BY_ID,COMMUNITY_COPY,freshCommunityStories} from './community-souvenirs-data.js';
import {footprint} from './layout.js';
import {homeFootprint} from './housing-data.js';
export {freshCommunityStories};
// Rectangular footprint edge distance, including quarter-turn orientation.
const distance=(a,b)=>Math.hypot(Math.max(0,Math.abs(a.x-b.x)-(a.w+b.w)/2),Math.max(0,Math.abs(a.z-b.z)-(a.d+b.d)/2));
const villageIds=new Set(['V3','V4','V6','V7','V11','V14','V17','V18']);
export function villageBesidePortal(s,changedId=null){
 const p=s.placements?.E2;if(!p||!s.counts.E2)return false;
 const portal={...p,...footprint('E2',p)};
 const village=[...Object.entries(s.placements||{}).filter(([id,q])=>villageIds.has(id)&&(!changedId||changedId==='E2'||changedId===id)&&q.realm===p.realm).map(([id,q])=>({...q,...footprint(id,q)})),
 ...(s.housing?.homes||[]).filter(q=>(!changedId||changedId==='E2'||changedId===q.id)&&q.realm===p.realm).map(q=>({...q,...homeFootprint(q)}))];
 return village.some(q=>distance(portal,q)<=2);
}
export function noteCommunityAction(s,type,{kind,placedId,plantType,duration=0,random=Math.random}={}){
 const c=s.communityStories;if(!c)return false;
 let changed=false;
 const trigger=id=>{if(c.rolled.includes(id))return false;c.rolled.push(id);changed=true;if(random()>=.6)return false;c.triggers[id]=s.play;return true;};
 const unlock=id=>{if(!c.unlocked.includes(id)){c.unlocked.push(id);changed=true;}};
 if(type==='backup'){c.backupAt=s.play;return true;}
 if(type==='info'&&s.play>=1200)trigger('community-mansion');
 if(type==='versions'&&s.play>=1200){if(trigger('community-pond'))unlock('request-pond');}
 if(type==='hold'&&duration>=20&&s.play>=900&&s.counts.M5)trigger('community-hold');
 if(type==='build'){
  if(kind==='garden-build'&&s.play>=900&&['oak','birch','spruce','blossom'].includes(plantType))trigger('community-tree');
  if(s.completed&&['move','home-move','garden-move','garden-build','home-build'].includes(kind))trigger('community-overtime');
  // Completion only: previews, cancelled builds, native scenery and save imports
  // do not qualify. Repositioning a real village also counts as building it nearby.
  if(['build','move','home-build','home-move'].includes(kind)&&villageBesidePortal(s,placedId)){if(trigger('community-stage'))unlock('village-stage');}
 }
 return changed;
}
export function discoverCommunityWealth(s,random=Math.random){
 const c=s.communityStories;if(!c)return false;if(s.play>=1200&&s.money>=1e8&&!c.rolled.includes('community-cash')){
  c.rolled.push('community-cash');if(random()<.6){c.unlocked.push('cash-counter');c.triggers['community-cash']=s.play;}return true;
 }return false;
}
export function claimCommunitySouvenir(s,id){
 const c=s.communityStories,i=SOUVENIR_BY_ID[id];
 if(!i||!c?.unlocked.includes(id))return {ok:false,reason:'还没有发现这件纪念景物'};
 if(c.claimed.includes(id))return {ok:false,reason:'这件纪念景物已经领取过了'};
 if(!s.counts.V20||!s.placements.V20)return {ok:false,reason:'先安放园艺台'};
 c.claimed.push(id);s.garden.stored[id]=(s.garden.stored[id]||0)+1;s.garden.revision++;
 return {ok:true,name:i.name,cost:0};
}
export function restoreCommunityStories(raw,s){
 const c=freshCommunityStories();if(raw?.version!==1)return c;
 c.rolled=[...new Set((Array.isArray(raw.rolled)?raw.rolled:[]).filter(id=>Object.hasOwn(COMMUNITY_COPY,id)))];
 for(const key of ['unlocked','claimed'])c[key]=[...new Set((Array.isArray(raw[key])?raw[key]:[]).filter(id=>Object.hasOwn(SOUVENIR_BY_ID,id)))];
 for(const id of c.claimed)if(!c.unlocked.includes(id))c.unlocked.push(id);
 for(const [id,at]of Object.entries(raw.triggers||{}))if(Object.hasOwn(COMMUNITY_COPY,id)&&Number.isFinite(at)&&at>=0)c.triggers[id]=Math.min(s.play,at);
 for(const key of ['backupAt','lastStoryAt'])if(Number.isFinite(raw[key])&&raw[key]>=0)c[key]=Math.min(s.play,raw[key]);
 for(const id of Object.keys(c.triggers))if(!c.rolled.includes(id))c.rolled.push(id);
 // No retroactive free copies; claimed ownership only follows saved claims.
 return c;
}
export const communityStoryReady=(s,id)=>s.communityStories?.triggers[id]!==undefined;
export const communityReward=id=>COMMUNITY_SOUVENIRS.find(i=>i.story===id);
