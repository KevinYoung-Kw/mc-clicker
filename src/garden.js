import {freshGarden,GARDEN_BY_ID,gardenItemReason,gardenGround} from './garden-data.js';
import {landChecker,onLand,overlaps,footprint,worldScenery,sceneryVisible,sceneryObstacle,buildingObstacles} from './layout.js';
import {Navigation} from './navigation.js';
import {
  TERRAIN_BY_ID,TERRAIN_MOTTLE,cellKey,brushCells,terrainAt,footprintHitsWater,waterObstacles,parseCellKey,
} from './terrain-data.js';
const revision=s=>{s.garden.revision++;s.layoutRevision=(s.layoutRevision||0)+1;};
export function gardenObjects(s){return worldScenery(s,'overworld').filter(p=>p.kind!=='house'&&p.kind!=='housing'&&p.kind!=='civic'&&sceneryVisible(s,p,'overworld'));}
export function gardenObject(s,id){return gardenObjects(s).find(p=>p.id===id);}
export function gardenGeometryReason(s,type,p,ignore=null,{restoring=false,context=null}={}){
 const i=GARDEN_BY_ID[type];if(!i)return '没有这种布景';
 if(!p||p.realm!=='overworld'||!Number.isFinite(p.x)||!Number.isFinite(p.z)||!Number.isInteger(p.rotation||0))return '请在主世界选择位置';
 // Quarter turns rotate rectangular hedges/pergolas as well as their model.
 const f=(p.rotation||0)%2?{w:i.d,d:i.w}:i,area={...p,w:f.w,d:f.d};
 if(footprintHitsWater(s,area))return '浅水上不能布置，请先恢复扩地原貌';
 const margin=i.group==='ground'?0:.12;
 for(const x of [p.x-f.w/2-margin,p.x+f.w/2+margin])for(const z of [p.z-f.d/2-margin,p.z+f.d/2+margin])if(!(context?context.contains({x,z,realm:p.realm}):onLand(s,{x,z,realm:p.realm})))return '请向土地内侧移动';
 if(overlaps(area,{x:0,z:0,w:1.45,d:1.45},i.group==='ground'?0:.25))return '请避开采集方块';
 if(!(restoring&&i.group==='ground')&&(context?.buildings||Object.entries(s.placements).filter(([,q])=>q.realm===p.realm).map(([id,q])=>({...q,...footprint(id,q)}))).some(q=>overlaps(area,q,i.group==='ground'?.08:.4)))return '给建筑和门口留些空间';
 if((context?.scenery||worldScenery(s,p.realm).filter(q=>q.id!==ignore&&sceneryVisible(s,q,p.realm))).some(q=>(q.kind==='house'||q.kind==='housing'||q.kind==='civic'||gardenGround(q)===(i.group==='ground'))&&overlaps(area,q,i.group==='ground'?0:.12)))return '这里已有布景，请换个位置';
 return '';
}
const navigationCache=new WeakMap();
function navigationBefore(s,ignore){
 const key=`${s.layoutRevision}:${ignore||''}`;let cache=navigationCache.get(s);
 if(cache?.key===key)return cache;
 const boxes=[{minX:-.72,maxX:.72,minZ:-.72,maxZ:.72},...Object.entries(s.placements).filter(([,p])=>p.realm==='overworld').flatMap(([id,p])=>buildingObstacles(id,p)),...worldScenery(s,'overworld').filter(p=>p.id!==ignore&&sceneryVisible(s,p)).flatMap(sceneryObstacle),...waterObstacles(s)];
 cache={key,boxes,nav:new Navigation(s.chunks.overworld,boxes),results:new Map()};navigationCache.set(s,cache);return cache;
}
function pathReason(s,type,p,ignore){
 const i=GARDEN_BY_ID[type];if(!i.radius)return '';
 const cache=navigationBefore(s,ignore),key=`${type}:${p.x}:${p.z}:${p.rotation||0}`;if(cache.results.has(key))return cache.results.get(key);
 const after=new Navigation(s.chunks.overworld,[...cache.boxes,...sceneryObstacle({...p,kind:'garden',type})]);let reason='';
 for(const radius of [.22,.4]){
  const before=cache.nav.grid(radius),next=after.grid(radius),lookup=new Map(next.nodes.map(n=>[`${n.x}:${n.z}`,n.component])),connections=new Map();
  for(const n of before.nodes){const component=lookup.get(`${n.x}:${n.z}`);if(component===undefined)continue;const previous=connections.get(n.component);if(previous!==undefined&&previous!==component){reason='这里会挡住通道，请换个位置';break;}connections.set(n.component,component);}
  if(reason)break;
 }
 if(cache.results.size>128)cache.results.clear();cache.results.set(key,reason);return reason;
}
export function gardenPlacementReason(s,type,p,ignore=null){return gardenGeometryReason(s,type,p,ignore)||pathReason(s,type,p,ignore);}
export function gardenSites(s,type,rotation=0,ignore=null){
 const out=[],context={contains:landChecker(s,'overworld'),buildings:Object.entries(s.placements).filter(([,q])=>q.realm==='overworld').map(([id,q])=>({...q,...footprint(id,q)})),scenery:worldScenery(s).filter(q=>q.id!==ignore&&sceneryVisible(s,q))};for(const c of s.chunks.overworld)for(let x=-2;x<=2;x+=.5)for(let z=-2;z<=2;z+=.5){const p={x:c.x*5+x,z:c.z*5+z,realm:'overworld',rotation};if(!gardenGeometryReason(s,type,p,ignore,{context}))out.push(p);}return out;
}
export function plantGarden(s,type,p,{moveId=null}={}){
 const source=moveId&&gardenObject(s,moveId),i=GARDEN_BY_ID[type];
 if(moveId&&!source)return {ok:false,reason:'这个布景已不在原处'};
 const missing=gardenItemReason(s,type);if(missing&&!moveId)return {ok:false,reason:missing};
 if(!s.counts.V20)return {ok:false,reason:'先建造园艺台'};
 if(moveId&&source.type!==type&&!(source.kind==='tree'&&type==='oak'))return {ok:false,reason:'搬动时不能更换布景'};
 const reason=gardenPlacementReason(s,type,p,moveId);if(reason)return {ok:false,reason};
 const fromStorage=!moveId&&(s.garden.stored?.[type]||0)>0;
 const cost=moveId||fromStorage?0:i.cost;if(!Number.isFinite(s.money)||s.money<cost)return {ok:false,reason:`还差 ${Math.ceil(cost-s.money)} 绿宝石`};
 if(s.garden.serial>=Number.MAX_SAFE_INTEGER && !s.garden.plants.some(x=>x.id===moveId))return {ok:false,reason:'布景编号已用尽'};
 const q={x:p.x,z:p.z,realm:'overworld',rotation:((p.rotation||0)%4+4)%4};
 let planted=s.garden.plants.find(x=>x.id===moveId);
 if(planted)Object.assign(planted,q);
 else{
  if(source&&!s.garden.cleared.includes(source.id))s.garden.cleared.push(source.id);
  planted={id:`planted:${++s.garden.serial}`,kind:'garden',type,...q};s.garden.plants.push(planted);
 }
 if(fromStorage)s.garden.stored[type]--;
 s.money-=cost;revision(s);return {ok:true,cost,id:planted.id,name:i.name};
}
export function clearGarden(s,id){
 if(!s.counts.V20)return {ok:false,reason:'先建造园艺台'};
 const object=gardenObject(s,id);if(!object)return {ok:false,reason:'这个布景已不在原处'};
 const index=s.garden.plants.findIndex(p=>p.id===id);
 if(index>=0){s.garden.plants.splice(index,1);s.garden.stored||={};s.garden.stored[object.type]=(s.garden.stored[object.type]||0)+1;}else if(!s.garden.cleared.includes(id))s.garden.cleared.push(id);
 revision(s);return {ok:true,name:object.kind==='tree'?'树木':GARDEN_BY_ID[object.type]?.name||'布景',undo:structuredClone(object)};
}
export function undoGardenClear(s,object){
 if(!object||!s.counts.V20)return {ok:false,reason:'无法撤销'};
 const planted=object.id.startsWith('planted:');
 if(planted?s.garden.plants.some(p=>p.id===object.id):!s.garden.cleared.includes(object.id))return {ok:false,reason:'这处布景已恢复'};
 const type=object.kind==='tree'?'oak':object.type;
 // Naturally generated trees may sit on the coast. Restoring one uses its old
 // footprint, not the larger planting footprint of a newly purchased oak.
 if(planted&&!(s.garden.stored?.[type]>0))return {ok:false,reason:'这件布景已经重新摆放'};
 const reason=planted?(gardenGround(object)?gardenGeometryReason(s,type,object,null,{restoring:true}):gardenPlacementReason(s,type,object)):
   !sceneryVisible({...s,garden:{...s.garden,cleared:s.garden.cleared.filter(id=>id!==object.id)}},object)?'原来的位置已有建筑':
   worldScenery(s).some(p=>p.id!==object.id&&sceneryVisible(s,p)&&gardenGround(p)===gardenGround(object)&&overlaps(object,p,gardenGround(object)?0:.12))?'原来的位置已有布景':pathReason(s,type,object);
 if(reason)return {ok:false,reason};
 if(planted){const {id,type,realm,x,z,rotation=0}=object;s.garden.plants.push({id,type,kind:'garden',realm,x,z,rotation});s.garden.stored[type]--;}
 else s.garden.cleared=s.garden.cleared.filter(id=>id!==object.id);
 revision(s);return {ok:true};
}
export function restoreGarden(s,raw){
 const saved=raw?.garden,g=freshGarden(),deferred=[];s.garden=g;
 if(!saved||saved.version!==1)return deferred;
 for(const [type,value] of Object.entries(saved.stored||{}))if(GARDEN_BY_ID[type]&&Number.isSafeInteger(value)&&value>0)g.stored[type]=value;
 const validParcel=key=>{if(typeof key!=='string')return false;const [r,x,z,...rest]=key.split(':');return !rest.length&&r==='overworld'&&s.chunks.overworld.some(c=>String(c.x)===x&&String(c.z)===z);};
 g.parcels=[...new Set((Array.isArray(saved.parcels)?saved.parcels:[]).filter(validParcel))];
 g.naturalSeed=Number.isInteger(saved.naturalSeed)?saved.naturalSeed>>>0:0;
 for(const [key,seed] of Object.entries(saved.naturalSeeds||{}))if(validParcel(key)&&Number.isInteger(seed)&&seed>=0&&seed<=0xffffffff)g.naturalSeeds[key]=seed;
 const nativeIds=new Set(worldScenery(s,'overworld').filter(p=>p.kind!=='house').map(p=>p.id));
 g.cleared=[...new Set((Array.isArray(saved.cleared)?saved.cleared:[]).filter(id=>nativeIds.has(id)))];
 for(const p of Array.isArray(saved.plants)?saved.plants:[]){
  if(!p||!/^planted:[1-9]\d*$/.test(p.id)||!GARDEN_BY_ID[p.type]||g.plants.some(x=>x.id===p.id))continue;
  if(!Number.isSafeInteger(+p.id.slice(8)))continue;
  const q={id:p.id,type:p.type,kind:'garden',realm:p.realm,x:p.x,z:p.z,rotation:Number.isInteger(p.rotation)?((p.rotation%4)+4)%4:0};
  // Existing facilities have already been restored; a corrupted plant never moves a building.
  if(gardenGeometryReason(s,q.type,q,null,{restoring:true})){deferred.push(q);continue;}
  g.plants.push(q);g.serial=Math.max(g.serial,+p.id.slice(8));
 }
 g.serial=Math.max(g.serial,Number.isSafeInteger(saved.serial)&&saved.serial>=0?saved.serial:0);
 g.terrain={};
 for(const [key,id] of Object.entries(saved.terrain||{})){
  if(!TERRAIN_BY_ID[id])continue;
  const cell=parseCellKey(key);if(!cell||!onLand(s,{x:cell.x,z:cell.z,realm:'overworld'}))continue;
  g.terrain[cellKey(cell.x,cell.z)]=id;
 }
 g.revision=1;s.layoutRevision=(s.layoutRevision||0)+1;
 return deferred;
}
export function paintTerrainReason(s,type,site,brush=1){
 if(!s.counts?.V20)return '先建造园艺台';
 if(type!==TERRAIN_MOTTLE&&!TERRAIN_BY_ID[type])return '没有这种地貌';
 if(!site||site.realm!=='overworld'||!Number.isFinite(site.x)||!Number.isFinite(site.z))return '请在主世界选择位置';
 const cells=brushCells(site.x,site.z,brush).filter(c=>onLand(s,{x:c.x,z:c.z,realm:'overworld'}));
 if(!cells.length)return '请向土地内侧移动';
 if(type==='water'){
  for(const c of cells){
   const area={x:c.x,z:c.z,w:1,d:1};
   if(Object.entries(s.placements).some(([id,p])=>p.realm==='overworld'&&overlaps(area,{...p,...footprint(id,p)},0.08)))return '浅水不能盖住建筑，请先搬走';
   const blocker=worldScenery(s,'overworld').find(q=>sceneryVisible(s,q)&&overlaps(area,q,0.08)&&(q.kind==='tree'||q.kind==='garden'||gardenGround(q)));
   if(blocker)return gardenGround(blocker)?'浅水格上还有地表布景，请先到整理收回':'浅水格上还有花草树木，请先到整理收回或清除';
   if((s.housing?.homes||[]).some(p=>p.realm==='overworld'&&overlaps(area,{...p,w:p.w||1.5,d:p.d||1.5},0.08)))return '浅水不能盖住住宅';
  }
 }
 return '';
}
export function paintTerrainCost(s,type,site,brush=1){
 const cells=brushCells(site.x,site.z,brush).filter(c=>onLand(s,{x:c.x,z:c.z,realm:'overworld'}));
 const unit=type===TERRAIN_MOTTLE?0:(TERRAIN_BY_ID[type]?.cost||0);
 let count=0;
 for(const c of cells){
  const current=terrainAt(s,c.x,c.z);
  if(type===TERRAIN_MOTTLE){if(current)count++;}
  else if(current!==type)count++;
 }
 return {cells,count,cost:count*unit};
}
export function paintTerrain(s,type,site,brush=1){
 const reason=paintTerrainReason(s,type,site,brush);if(reason)return {ok:false,reason};
 const {cells,count,cost}=paintTerrainCost(s,type,site,brush);
 if(!count)return {ok:false,reason:'这里已经是这种地貌'};
 if(cost>0&&(!Number.isFinite(s.money)||s.money<cost))return {ok:false,reason:`还差 ${Math.ceil(cost-s.money)} 绿宝石`};
 s.garden.terrain||={};
 for(const c of cells){
  const key=cellKey(c.x,c.z);
  if(type===TERRAIN_MOTTLE)delete s.garden.terrain[key];
  else s.garden.terrain[key]=type;
 }
 if(cost)s.money-=cost;
 revision(s);
 const name=type===TERRAIN_MOTTLE?'扩地原貌':TERRAIN_BY_ID[type].name;
 return {ok:true,cost,count,name,cells};
}
export function terrainSites(s,brush=1){
 const out=[];
 for(const c of s.chunks.overworld)for(let x=-2;x<=2;x++)for(let z=-2;z<=2;z++){
  const p={x:c.x*5+x,z:c.z*5+z,realm:'overworld'};
  if(brushCells(p.x,p.z,brush).some(cell=>onLand(s,{x:cell.x,z:cell.z,realm:'overworld'})))out.push(p);
 }
 return out;
}
// Homes can hide native trees. During the first pass those homes do not exist
// yet, so retry rejected plants after housing has restored its real geometry.
// Keep the original order and repeat normal collision checks; never move homes.
export function restoreDeferredGardenPlants(s,deferred,original){
 let added=false;
 for(const q of deferred){
  if(s.garden.plants.some(p=>p.id===q.id)||gardenGeometryReason(s,q.type,q,null,{restoring:true}))continue;
  s.garden.plants.push(q);s.garden.serial=Math.max(s.garden.serial,+q.id.slice(8));added=true;
 }
 if(!added)return;
 const order=new Map((Array.isArray(original)?original:[]).map((p,i)=>[p?.id,i]));
 s.garden.plants.sort((a,b)=>order.get(a.id)-order.get(b.id));revision(s);
}
