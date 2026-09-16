import {ITEMS} from './catalog.js';
import {ensureLand,parcelKey,LAND_PRICING} from './land.js';
import {overlaps,footprint,worldScenery,sceneryVisible,sceneryObstacle,buildingObstacles} from './layout.js';
import {homeFootprint} from './housing-data.js';
import {Navigation,sweptObstacle} from './navigation.js';
import {gridConnection,gridRange} from './power.js';
import {transportTopology,facilityAnchor,routeBetween} from './routing.js';
import {waterObstacles,terrainCellsInParcel} from './terrain-data.js';
const area = p => ({x:p.x*5,z:p.z*5,w:5,d:5});
const same=(a,b)=>a.x===b.x&&a.z===b.z;
const geometryCache=new WeakMap();
function connectivity(chunks) {
  const remaining=new Set(chunks.map(p=>`${p.x},${p.z}`));let components=0;
  while(remaining.size){components++;const start=remaining.values().next().value,queue=[start];remaining.delete(start);
    for(let i=0;i<queue.length;i++){const [x,z]=queue[i].split(',').map(Number);for(const key of [`${x+1},${z}`,`${x-1},${z}`,`${x},${z+1}`,`${x},${z-1}`])if(remaining.delete(key))queue.push(key);}
  }return components;
}
function staticReason(s,site) {
  const realm=site.realm,box=area(site);
  for(const [id,p] of Object.entries(s.placements))if(p.realm===realm&&overlaps(box,{...p,...footprint(id,p)},.4))return `这里有${ITEMS[id]?.name||'设施'}，请先搬走`;
  for(const p of s.housing?.homes||[])if(p.realm===realm&&overlaps(box,{...p,...homeFootprint(p)},.4))return '这里有住宅，请先在村庄住房中搬走';
  for(const p of worldScenery(s,realm))if(!p.native&&p.kind!=='housing'&&overlaps(box,p,0))return p.kind==='civic'?'这里有已建好的设施，请先搬走':'这里有购买的布景，请先到园艺台收回';
  const chunks=s.chunks[realm].filter(p=>!same(p,site));
  if(connectivity(chunks)>connectivity(s.chunks[realm]))return '这片地还连着另一侧，不能收起';
  const next={...s,chunks:{...s.chunks,[realm]:chunks},layoutRevision:s.layoutRevision+1};
  if(realm==='overworld'){
    const obstacles=[{minX:-.72,maxX:.72,minZ:-.72,maxZ:.72},...Object.entries(s.placements).filter(([,p])=>p.realm===realm).flatMap(([id,p])=>buildingObstacles(id,p)),...worldScenery(s,realm).filter(p=>sceneryVisible(s,p,realm)).flatMap(sceneryObstacle),...waterObstacles(s,realm)];
    const before=new Navigation(s.chunks[realm],obstacles),after=new Navigation(chunks,obstacles);
    for(const radius of [.22,.4]){
      const lookup=new Map(after.grid(radius).nodes.map(n=>[`${n.x}:${n.z}`,n.component])),connections=new Map();
      for(const n of before.grid(radius).nodes){const c=lookup.get(`${n.x}:${n.z}`);if(c===undefined)continue;if(connections.has(n.component)&&connections.get(n.component)!==c)return '收起后会挡住通路，请先调整周围设施';connections.set(n.component,c);}
    }
  }
  for(const [id,p] of Object.entries(s.placements))if(p.realm===realm&&gridConnection(s,id).connected&&!gridConnection(next,id).connected)return `收起后${ITEMS[id].name}会断电，请先调整线路`;
  for(const edge of transportTopology(s,realm).edges){const from=facilityAnchor(s,edge.from,realm),to=facilityAnchor(s,edge.to,realm);if(from&&to&&!routeBetween(next,from,to,realm))return '收起后会中断运输，请先调整线路';}
  return '';
}
export function landRemovalReason(s,site) {
  const realm=site?.realm;
  if(!LAND_PRICING[realm]||!Number.isSafeInteger(site.x)||!Number.isSafeInteger(site.z)||!s.chunks[realm].some(p=>same(p,site)))return '请选择已购买的土地';
  if(site.x===0&&site.z===0)return '起始土地与传送门入口不能收起';
  const key=`${s.layoutRevision}:${s.land?.revision||0}:${s.garden?.revision||0}:${gridRange(s)}:${s.endEyes}:${JSON.stringify(s.counts)}:${JSON.stringify(s.grid?.links)}`;
  let cache=geometryCache.get(s);if(cache?.key!==key){cache={key,reasons:new Map()};geometryCache.set(s,cache);}
  const parcel=parcelKey(realm,site);
  if(!cache.reasons.has(parcel)){if(cache.reasons.size>=64)cache.reasons.clear();cache.reasons.set(parcel,staticReason(s,site));}
  if(cache.reasons.get(parcel))return cache.reasons.get(parcel);
  if(realm==='overworld'){
    const p=area(site),box={minX:p.x-2.5,maxX:p.x+2.5,minZ:p.z-2.5,maxZ:p.z+2.5};
    for(const actor of [...(s.community?.residents||[]),...(s.community?.golems||[])]){
      if(actor.reserve||actor.room==='studio'||!Number.isFinite(actor.x)||!Number.isFinite(actor.z))continue;
      const route=[actor,...(actor.path||[])];
      if(overlaps(p,{...actor,w:.8,d:.8},0)||route.some((b,i)=>i>0&&sweptObstacle(route[i-1],b,.4,box)))return '有村民或傀儡正在经过，等他们走开再收起';
    }
  }
  return '';
}
export function storeLand(s,site) {
  const reason=landRemovalReason(s,site);if(reason)return {ok:false,reason};
  const land=ensureLand(s);if(land.serial>=Number.MAX_SAFE_INTEGER)return {ok:false,reason:'土地编号已用尽'};
  const key=parcelKey(site.realm,site),box=area(site);
  const objects=worldScenery(s,site.realm).filter(p=>p.native&&Math.round(p.x/5)===site.x&&Math.round(p.z/5)===site.z);
  const scenery=objects.map(({id,native,realm,...p})=>({...p,x:p.x-box.x,z:p.z-box.z,cleared:s.garden.cleared.includes(id)}));
  const record={id:++land.serial,x:site.x,z:site.z,scenery,terrain:terrainCellsInParcel(s.garden?.terrain,site.x,site.z)};
  land.stored[site.realm].push(record);delete land.scenery[key];
  s.chunks[site.realm]=s.chunks[site.realm].filter(p=>!same(p,site));
  if(site.realm==='overworld'){
    const ids=new Set(objects.map(p=>p.id));s.garden.cleared=s.garden.cleared.filter(id=>!ids.has(id));
    s.garden.parcels=s.garden.parcels.filter(p=>p!==key);delete s.garden.naturalSeeds[key];
    s.garden.terrain||={};
    for(const k of Object.keys(record.terrain||{}))delete s.garden.terrain[k];
    s.garden.revision++;
  }
  land.revision++;s.layoutRevision++;
  return {ok:true,realm:site.realm,id:record.id,cost:0};
}
export function undoStoreLand(s,token) {
  const land=ensureLand(s),list=land.stored[token?.realm],record=list?.find(p=>p.id===token.id);
  if(!record)return {ok:false,reason:'这片土地已经重新摆放'};
  if(s.chunks[token.realm].some(p=>same(p,record)))return {ok:false,reason:'原来的位置已有土地'};
  const c={x:record.x,z:record.z},key=parcelKey(token.realm,c);s.chunks[token.realm].push(c);
  if(token.realm==='overworld'){
    land.scenery[key]=record.scenery;record.scenery.forEach((p,i)=>{if(p.cleared)s.garden.cleared.push(`parcel:${key}:${i}`)});
    s.garden.terrain||={};
    for(const [k,id] of Object.entries(record.terrain||{}))s.garden.terrain[k]=id;
    s.garden.revision++;
  }
  list.splice(list.indexOf(record),1);land.revision++;s.layoutRevision++;
  return {ok:true,land:{...c,realm:token.realm}};
}
