import {FARM_TYPES,farmLimit,reconcileFarmWorkers,freshFarmProduction,restoreFarmProduction} from './farm-sites.js';
import {CIVIC_TYPES,civicCount,civicCost} from './civic-data.js';
import {placementReason,buildSites,onLand} from './layout.js';
export {civicCost} from './civic-data.js';
const revise=s=>{s.life.revision++;s.layoutRevision=(s.layoutRevision||0)+1;};
export function civicReason(s,type){
 if(!CIVIC_TYPES[type])return '请选择公共设施';
 if(!s.counts[type]||s.facilityStorage?.[type])return '先建好'+CIVIC_TYPES[type].name;
 if(FARM_TYPES[type]&&civicCount(s,type)>=farmLimit(s,type))return civicCount(s,type)>=3?'已建齐 3 处':`本体达到 Lv.${FARM_TYPES[type].levels[civicCount(s,type)]} 可增建一处`;
 if(civicCount(s,type)>=3)return '同类设施最多建造 3 座';
 return '';
}
export function civicPlacementReason(s,type,p,ignore=null){
 if(!CIVIC_TYPES[type]||p?.realm!=='overworld')return '请在主世界选择位置';
 return placementReason(s,type,p,ignore);
}
export const civicSites=(s,type,rotation=0,ignore=null)=>buildSites(s,'overworld',type,ignore,rotation);
export function buildCivic(s,type,p,{moveId=null}={}){
 const old=moveId&&(s.life?.sites||[]).find(p=>p.id===moveId&&p.type===type);
 if(moveId&&!old)return {ok:false,reason:'这座设施已不在原处'};
 if(old&&FARM_TYPES[type]&&(s.community?.batches||[]).some(b=>b.origin===moveId&&b.claimed))return {ok:false,reason:'有搬运工正在取货，交付后再移动'};
 const reason=(!old&&civicReason(s,type))||civicPlacementReason(s,type,p,moveId);
 if(reason)return {ok:false,reason};
 const cost=old?0:civicCost(s,type);if(!Number.isFinite(s.money)||s.money<cost)return {ok:false,reason:'绿宝石还不够'};
 if(!old&&s.life.siteSerial>=Number.MAX_SAFE_INTEGER)return {ok:false,reason:'设施编号已用尽'};
 const result=old||{id:`civic:${++s.life.siteSerial}`,type};
 Object.assign(result,{x:p.x,z:p.z,realm:'overworld',rotation:((p.rotation||0)%4+4)%4,stored:false});
 if(!old){if(FARM_TYPES[type])result.production=freshFarmProduction();s.life.sites.push(result);}
 reconcileFarmWorkers(s);
 s.money-=cost;revise(s);return {ok:true,id:result.id,name:CIVIC_TYPES[type].name,cost};
}
export function storeCivic(s,id){
 const p=s.life.sites.find(p=>p.id===id);if(!p||p.stored)return {ok:false,reason:'这座设施已经收起'};
 if(FARM_TYPES[p.type]&&(s.community?.batches||[]).some(b=>b.origin===id&&b.qty>0))return {ok:false,reason:'还有待运货物，交付后再收起'};
 if(FARM_TYPES[p.type]&&(s.community?.residents||[]).some(r=>r.farmSiteId===id&&!r.reserve&&r.job===FARM_TYPES[p.type].job))return {ok:false,reason:'还有村民在这里工作，请先换岗'};
 p.stored=true;
 for(const r of s.community?.residents||[]){const a=s.life.residents[r.id];if(a?.service===id){a.service=null;r.path=[];r.destination=null;}}
 revise(s);return {ok:true,id,name:CIVIC_TYPES[p.type].name,cost:0};
}
export function restoreCivic(s,raw){
 s.life.sites=[];s.life.siteSerial=0;
 for(const p of Array.isArray(raw?.life?.sites)?raw.life.sites:[]){
  if(!p||!/^civic:[1-9]\d*$/.test(p.id)||!Number.isSafeInteger(+p.id.slice(6))||!CIVIC_TYPES[p.type]||!s.counts[p.type]||s.life.sites.some(q=>q.id===p.id))continue;
  const q={id:p.id,type:p.type,realm:'overworld',x:Number.isFinite(p.x)?p.x:0,z:Number.isFinite(p.z)?p.z:0,rotation:Number.isInteger(p.rotation)?((p.rotation%4)+4)%4:0,stored:p.stored===true};
  // Do not silently move paid buildings. Repaired geometry stays available to re-place free.
  if(!onLand(s,q)||(!q.stored&&civicPlacementReason(s,q.type,q)))q.stored=true;
  if(FARM_TYPES[q.type])q.production=restoreFarmProduction(p.production);
  s.life.sites.push(q);s.life.siteSerial=Math.max(s.life.siteSerial,+p.id.slice(6));
 }
 const serial=raw?.life?.siteSerial;if(Number.isSafeInteger(serial)&&serial>=0)s.life.siteSerial=Math.max(s.life.siteSerial,serial);
 for(const r of s.community?.residents||[]){const old=raw?.life?.residents?.[r.id],a=s.life.residents[r.id];if(a&&old?.phase==='rest'&&s.life.sites.some(p=>p.id===old.service&&!p.stored)&&s.counts[s.life.sites.find(p=>p.id===old.service).type])a.service=old.service;}
 reconcileFarmWorkers(s);revise(s);
}
