// Agricultural branches share technology, but never their crop/task clocks.
// Placement records use the existing multi-site persistence and collision path.
export const FARM_TYPES = Object.freeze({V4:{job:'farmer',name:'麦田',levels:[1,3,6]},V7:{job:'rancher',name:'畜栏',levels:[1,2,4]}});
export const farmBranch=(s,id)=>(s.life?.sites||[]).find(p=>p.id===id&&FARM_TYPES[p.type]);
export const farmType=(s,id)=>farmBranch(s,id)?.type||id;
export const farmLimit=(s,type)=>FARM_TYPES[type]?.levels.filter(l=>(s.counts?.[type]||0)>=l).length||0;
export function farmLocations(s,type){
 if(!FARM_TYPES[type]||!s.counts?.[type]||s.facilityStorage?.[type])return [];
 return [{...s.placements?.[type],id:type,type},...(s.life?.sites||[]).filter(p=>p.type===type&&!p.stored)];
}
export function farmLocation(s,r){
 const type=r.job==='farmer'?'V4':r.job==='rancher'?'V7':null;
 if(!type)return null;
 const list=farmLocations(s,type);return list.find(p=>p.id===r.farmSiteId)||list[0]||null;
}
export function reconcileFarmWorkers(s){
 for(const [type,def]of Object.entries(FARM_TYPES)){
  const sites=farmLocations(s,type),used=new Map(sites.map(p=>[p.id,0]));
  const people=(s.community?.residents||[]).filter(r=>!r.reserve&&r.job===def.job);
  // Keep valid assignments first. Legacy colleagues at one plot remain employed;
  // as new plots are built, surplus colleagues move into the newly vacant plots.
  for(const r of people){if(used.has(r.farmSiteId))used.set(r.farmSiteId,used.get(r.farmSiteId)+1);}
  for(const r of people){
   const current=used.get(r.farmSiteId)||0,empty=sites.find(p=>used.get(p.id)===0);
   const next=(!current||current>1)&&empty?empty:sites.find(p=>p.id===r.farmSiteId)||sites[0];
   if(!next||next.id===r.farmSiteId)continue;
   if(current)used.set(r.farmSiteId,current-1);used.set(next.id,(used.get(next.id)||0)+1);
   r.farmSiteId=next.id;r.path=[];r.destination=null;r.workSpot=null;r.workTour=false;
  }
 }
}
const finite=(v,max)=>Number.isFinite(v)?Math.max(0,Math.min(max,v)):0;
export function freshFarmProduction(){return {harvest:{farm:0,milk:0,wool:0,treasure:0},tasks:{}};}
export function restoreFarmProduction(raw){
 const out=freshFarmProduction();
 for(const key of Object.keys(out.harvest)){
  out.harvest[key]=finite(raw?.harvest?.[key],1);
  const t=raw?.tasks?.[key];if(!t||typeof t!=='object')continue;
  const credits=value=>Object.fromEntries(Object.entries(value||{}).filter(([id,v])=>/^(resident-\d+|manual|machine)$/.test(id)&&Number.isFinite(v)&&v>=0).map(([id,v])=>[id,Math.min(v,1e6)]));
  out.tasks[key]={work:finite(t.work,1e5),cooldown:0,tend:finite(t.tend,1),bonus:finite(t.bonus,10),cycle:Math.floor(finite(t.cycle,1e12)),owners:credits(t.owners),tenders:credits(t.tenders),manual:false};
 }
 return out;
}
export function farmLocationLabel(s,r){
 const p=farmLocation(s,r);if(!p)return '';
 const all=[p.type,...(s.life?.sites||[]).filter(q=>q.type===p.type).map(q=>q.id)];
 return `${FARM_TYPES[p.type].name} ${all.indexOf(p.id)+1}号`;
}
