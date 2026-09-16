import {freshHousing,HOME_BY_ID,homeReason,homeFootprint,homeObstacles,homeDoors,housingCapacity} from './housing-data.js';
import {landChecker,onLand,overlaps,footprint,worldScenery,sceneryVisible,sceneryObstacle,buildingObstacles} from './layout.js';
import {Navigation} from './navigation.js';
import {footprintHitsWater,waterObstacles} from './terrain-data.js';
const revise=s=>{s.housing.revision++;s.layoutRevision=(s.layoutRevision||0)+1;};
export const starterHomeAvailable=s=>!!s.counts.V2&&!s.housing.starterClaimed;
export const homeCost=(s,type)=>s.housing.stored[type]>0?0:HOME_BY_ID[type]?.cost;
export const homeResidents=(s,id)=>Object.entries(s.housing.assignments).filter(([,a])=>a.homeId===id).sort((a,b)=>a[1].unit-b[1].unit).map(([id,a])=>({...s.community.residents.find(r=>r.id===id),unit:a.unit}));
export function syncHousingResidents(s){
  if(!s.housing || !s.community)return;
  const active=s.community.residents.filter(r=>!r.reserve),h=s.housing,used=new Set(),next={};
  for(const r of active){const a=h.assignments[r.id],home=h.homes.find(p=>p.id===a?.homeId),key=`${a?.homeId}:${a?.unit}`;
    if(home&&Number.isInteger(a.unit)&&a.unit>=1&&a.unit<=HOME_BY_ID[home.type].beds&&!used.has(key)){next[r.id]={homeId:a.homeId,unit:a.unit};used.add(key);}}
  for(const r of active.filter(r=>!next[r.id])){
    outer:for(const home of h.homes)for(let unit=1;unit<=HOME_BY_ID[home.type].beds;unit++){
      const key=`${home.id}:${unit}`;if(!used.has(key)){next[r.id]={homeId:home.id,unit};used.add(key);break outer;}}
  }
  if(JSON.stringify(h.assignments)!==JSON.stringify(next)){h.assignments=next;h.revision++;}
}
export function claimStarterHome(s){
  if(!starterHomeAvailable(s))return {ok:false,reason:'首栋住宅已经领取'};
  s.housing.starterClaimed=true;s.housing.stored.oak=(s.housing.stored.oak||0)+1;revise(s);
  return {ok:true,cost:0,name:'橡木尖顶屋'};
}
export function housingGeometryReason(s,type,p,ignore=null,context=null){
  if(!HOME_BY_ID[type])return '请选择一种住宅';
  if(!p||p.realm!=='overworld'||!Number.isFinite(p.x)||!Number.isFinite(p.z)||!Number.isInteger(p.rotation||0))return '请在主世界选择位置';
  const f=homeFootprint({...p,type}),area={...p,...f};
  if(footprintHitsWater(s,area))return '浅水上不能建住宅，请先恢复扩地原貌';
  for(const x of [p.x-f.w/2-.12,p.x+f.w/2+.12])for(const z of [p.z-f.d/2-.12,p.z+f.d/2+.12])if(!(context?context.contains({x,z,realm:'overworld'}):onLand(s,{x,z,realm:'overworld'})))return '请把住宅放在土地内侧';
  if(homeObstacles({...p,type}).some(b=>overlaps({x:(b.minX+b.maxX)/2,z:(b.minZ+b.maxZ)/2,w:b.maxX-b.minX,d:b.maxZ-b.minZ},{x:0,z:0,w:1.45,d:1.45},.2)))return '请避开采集方块';
  if((context?.buildings||Object.entries(s.placements).filter(([,q])=>q.realm==='overworld').map(([id,q])=>({...q,...footprint(id,q)}))).some(q=>overlaps(area,q,.4)))return '给设施和门口留些空间';
  // Native flowers/trees disappear beneath construction, as with other facilities.
  if((context?.scenery||worldScenery(s).filter(q=>q.id!==ignore&&!q.native&&q.kind!=='patch'&&sceneryVisible(s,q))).some(q=>overlaps(area,q,q.kind==='housing'?.4:.12)))return '这里已有住宅或布景，请换个位置';
  return '';
}
const navCache=new WeakMap();
function baseline(s,ignore){const key=`${s.layoutRevision}:${ignore}`;let c=navCache.get(s);if(c?.key===key)return c;
  const boxes=[{minX:-.72,maxX:.72,minZ:-.72,maxZ:.72},...Object.entries(s.placements).filter(([,p])=>p.realm==='overworld').flatMap(([id,p])=>buildingObstacles(id,p)),...worldScenery(s).filter(p=>p.id!==ignore&&sceneryVisible(s,p)).flatMap(sceneryObstacle),...waterObstacles(s)];
  c={key,boxes,nav:new Navigation(s.chunks.overworld,boxes),results:new Map()};navCache.set(s,c);return c;
}
export function housingPlacementReason(s,type,p,ignore=null){
  const geometry=housingGeometryReason(s,type,p,ignore);if(geometry)return geometry;
  const c=baseline(s,ignore),key=`${type}:${p.x}:${p.z}:${p.rotation||0}`;if(c.results.has(key))return c.results.get(key);
  // The proposed house hides only native scenery actually under its footprint.
  const proposed={id:ignore||'proposed',type,kind:'housing',...p},snapshot={...s,housing:{...s.housing,homes:[...s.housing.homes.filter(h=>h.id!==ignore),proposed]}};
  const boxes=[{minX:-.72,maxX:.72,minZ:-.72,maxZ:.72},...Object.entries(s.placements).filter(([,q])=>q.realm==='overworld').flatMap(([id,q])=>buildingObstacles(id,q)),...worldScenery(snapshot).filter(q=>sceneryVisible(snapshot,q)).flatMap(sceneryObstacle),...waterObstacles(s)],nav=new Navigation(s.chunks.overworld,boxes);
  let reason='';
  // The first 5×5 island must fit a resident's starter home. Wider-body routes
  // become relevant after expansion (or when a golem already lives here).
  const radii=s.chunks.overworld.length>1||s.counts.V15||s.counts.V16?[.22,.4]:[.22];
  for(const radius of radii){
    const after=nav.grid(radius),sizes=new Map();for(const n of after.nodes)sizes.set(n.component,(sizes.get(n.component)||0)+1);
    // Ignore isolated coast slivers smaller than one walkable tile. They are not
    // corridors; treating them as routes made the entire starter island unbuildable.
    const lookup=new Map(after.nodes.filter(n=>sizes.get(n.component)>3).map(n=>[`${n.x}:${n.z}`,n.component])),parts=new Map();
    for(const n of c.nav.grid(radius).nodes){const component=lookup.get(`${n.x}:${n.z}`);if(component===undefined)continue;const last=parts.get(n.component);if(last!==undefined&&last!==component){reason='这里会截断通道，请留出绕行空间';break;}parts.set(n.component,component);}
    if(reason)break;
  }
  if(!reason){const nodes=nav.grid(.22).nodes,counts=new Map();for(const n of nodes)counts.set(n.component,(counts.get(n.component)||0)+1);
    const main=[...counts].sort((a,b)=>b[1]-a[1])[0]?.[0];
    if(!homeDoors(proposed).every(d=>{const n=nav.nearest(d,.22,main);return n&&Math.hypot(n.x-d.x,n.z-d.z)<.45&&nav.segment(d,n,.22);}))reason='门口需要接到能走的路上，试试旋转住宅';
  }
  if(c.results.size>256)c.results.clear();c.results.set(key,reason);return reason;
}
export function housingSites(s,type,rotation=0,ignore=null){const out=[],context={contains:landChecker(s,"overworld"),buildings:Object.entries(s.placements).filter(([,q])=>q.realm==="overworld").map(([id,q])=>({...q,...footprint(id,q)})),scenery:worldScenery(s).filter(q=>q.id!==ignore&&!q.native&&q.kind!=="patch"&&sceneryVisible(s,q))};for(const c of s.chunks.overworld)for(let x=-2;x<=2;x+=.5)for(let z=-2;z<=2;z+=.5){const p={x:c.x*5+x,z:c.z*5+z,realm:'overworld',rotation};if(!housingGeometryReason(s,type,p,ignore,context)&&(s.chunks.overworld.length>1||!housingPlacementReason(s,type,p,ignore)))out.push(p);}return out;}
export function buildHome(s,type,p,{moveId=null}={}){
  const home=moveId&&s.housing.homes.find(h=>h.id===moveId);
  if(moveId&&(!home||home.type!==type))return {ok:false,reason:'这座住宅已不在原处'};
  const missing=!moveId&&homeReason(s,type);if(missing)return {ok:false,reason:missing};
  const reason=housingPlacementReason(s,type,p,moveId);if(reason)return {ok:false,reason};
  const cost=moveId?0:homeCost(s,type);if(!Number.isFinite(s.money)||s.money<cost)return {ok:false,reason:`还差 ${Math.ceil(cost-s.money)} 绿宝石`};
  if(!moveId&&s.housing.serial>=Number.MAX_SAFE_INTEGER)return {ok:false,reason:'住宅编号已用尽'};
  const q={realm:'overworld',x:p.x,z:p.z,rotation:((p.rotation||0)%4+4)%4};let result=home;
  if(home)Object.assign(home,q);else{result={id:`home:${++s.housing.serial}`,type,...q,...(type==='cottage'?{variant:s.housing.storedVariants?.cottage?.shift()??0}:{})};s.housing.homes.push(result);if(s.housing.stored[type]>0)s.housing.stored[type]--;}
  s.money-=cost;revise(s);syncHousingResidents(s);return {ok:true,id:result.id,cost,name:HOME_BY_ID[type].name};
}
export function moveResidentHome(s,residentId,homeId,unit){
  const r=s.community.residents.find(r=>r.id===residentId&&!r.reserve),home=s.housing.homes.find(h=>h.id===homeId);
  if(!r||!home||!Number.isInteger(unit)||unit<1||unit>HOME_BY_ID[home.type].beds)return {ok:false,reason:'请选择一个空住址'};
  if(Object.entries(s.housing.assignments).some(([id,a])=>id!==residentId&&a.homeId===homeId&&a.unit===unit))return {ok:false,reason:'这个住址已经有人住了'};
  s.housing.assignments[residentId]={homeId,unit};s.housing.revision++;return {ok:true};
}
export function restoreHousing(s,raw){
  const saved=raw?.housing,h=freshHousing();
  if(!saved){
    // Preserve only cottages that the old save actually displayed, at their old scale.
    const before={...s,housing:undefined};
    for(const p of worldScenery(before).filter(p=>p.kind==='house'&&sceneryVisible(before,p)))h.homes.push({id:`home:${++h.serial}`,type:'legacy',variant:p.variant,realm:'overworld',x:p.x,z:p.z,rotation:0});
  }
  s.housing=h;
  if(saved?.version===1){
    h.starterClaimed=saved.starterClaimed===true;
    for(const [type,value] of Object.entries(saved.stored||{}))if(HOME_BY_ID[type]&&type!=='legacy'&&Number.isSafeInteger(value)&&value>0)h.stored[type]=value;
    h.storedVariants.cottage=(Array.isArray(saved.storedVariants?.cottage)?saved.storedVariants.cottage:[]).slice(0,h.stored.cottage||0).map(v=>Number.isInteger(v)?Math.abs(v%3):0);
    for(const p of Array.isArray(saved.homes)?saved.homes:[]){
      if(!p||!/^home:[1-9]\d*$/.test(p.id)||!Number.isSafeInteger(+p.id.slice(5))||!HOME_BY_ID[p.type]||h.homes.some(q=>q.id===p.id))continue;
      const q={id:p.id,type:p.type,realm:'overworld',x:p.x,z:p.z,rotation:Number.isInteger(p.rotation)?((p.rotation%4)+4)%4:0,...(['legacy','cottage'].includes(p.type)?{variant:Number.isInteger(p.variant)?Math.max(0,p.variant%3):0}:{})};
      if(p.realm!=='overworld'||!Number.isFinite(q.x)||!Number.isFinite(q.z)||!onLand(s,q))continue;
      // Existing placements/addresses are authoritative; no migration moves a home.
      // If a repaired save has conflicting geometry, preserve the purchased house
      // in storage so the player can place it again without paying twice.
      if(p.type!=='legacy'&&housingGeometryReason(s,q.type,q)){
        h.stored[q.type]=(h.stored[q.type]||0)+1;if(q.type==='cottage')h.storedVariants.cottage.push(q.variant||0);h.serial=Math.max(h.serial,+q.id.slice(5));continue;
      }
      h.homes.push(q);h.serial=Math.max(h.serial,+q.id.slice(5));
    }
    h.serial=Math.max(h.serial,Number.isSafeInteger(saved.serial)&&saved.serial>=0?saved.serial:0);
    h.assignments=saved.assignments&&typeof saved.assignments==='object'?saved.assignments:{};
  }
  syncHousingResidents(s);revise(s);
}

export function homeStorageReason(s,id){
 const h=s.housing.homes.find(h=>h.id===id);
 if(!h)return '这座住宅已经不在这里';

 return homeResidents(s,id).length?'还有住户，请先在入住安排中搬到其他住宅':'';
}
export function storeHome(s,id){
 syncHousingResidents(s);
 const reason=homeStorageReason(s,id);if(reason)return {ok:false,reason};
 const h=s.housing.homes.find(h=>h.id===id);
 s.housing.homes=s.housing.homes.filter(h=>h.id!==id);
 const type=h.type==='legacy'?'cottage':h.type;
 s.housing.stored[type]=(s.housing.stored[type]||0)+1;
 if(type==='cottage'){s.housing.storedVariants||={};(s.housing.storedVariants.cottage||=[]).push(h.variant||0);}
 revise(s);
 return {ok:true,name:HOME_BY_ID[h.type].name,cost:0};
}
