// One world unit is one construction grid square. Every placed item has a footprint.
import {homeType,homeFootprint,homeObstacles} from './housing-data.js';
import {parcelScenery} from './natural-scenery.js';
import {parcelObjects,parcelKey} from './land.js';
import {gardenType,gardenGround,naturalPatches} from './garden-data.js';
import {footprintHitsWater} from './terrain-data.js';
export const BUILDING_SIZES = {
  V21:[1.5,1.5],V22:[2,1.5],V23:[2,2],V24:[1.5,1],V25:[2,1.5],
  V20: [2, 2],
  T7: [1, 1],
  T8: [1, 1],
  V3: [2, 1.5],
  V4: [2, 2],
  V5: [0.5, 0.5],
  V6: [1, 1],
  V7: [2, 2],
  V11: [1.5, 1.5],
  V14: [1.5, 1.5],
  V17: [1, 1],
  V18: [0.5, 0.5],
  V19: [1.5, 1.5],
  M1: [2, 2],
  M2: [1, 1],
  M3: [1, 1],
  M4: [1, 1],
  M5: [1, 1],
  M6: [0.5, 0.5],
  M7: [2, 2],
  M8: [0.5, 0.5],
  M9: [2, 2],
  M10: [0.5, 0.5],
  M11: [0.5, 0.5],
  M12: [0.5, 0.5],
  M13: [0.5, 0.5],
  M14: [1, 1],
  M15: [2, 1.5],
  M16: [2, 1],
  M17: [3, 2],
  M18: [2, 2],
  M19: [0.5, 0.5],
  M20: [0.5, 0.5],
  L1: [0.5, 0.5],
  L2: [2, 2],
  L3: [0.5, 0.5],
  L4: [1, 1],
  L5: [1.5, 0.5],
  L6: [1, 1],
  L12: [2, 2],
  L13: [1, 0.5],
  L14: [2, 2],
  N1: [2, 1],
  N2: [2, 2],
  N3: [1, 1],
  N4: [3, 2],
  N5: [1, 1],
  N6: [1, 1],
  N7: [2, 2],
  N8: [1, 1],
  N9: [2, 2],
  N10: [2, 2],
  N11: [2, 2],
  N12: [3, 2],
  E1: [1, 1],
  E2: [5, 5],
  E3: [1, 1],
  E4: [2, 2],
  E5: [1, 1],
  E6: [0.5, 0.5],
  E7: [1, 1],
  E8: [2, 2],
  E9: [3, 3],
  E10: [2, 1.5],
  E11: [2, 2],
  X2: [1, 1],
  X7: [1, 1],
  Z1: [1, 1],
  Z2: [3, 3],
};
export const rotationOf = p => Number.isInteger(p?.rotation) ? ((p.rotation%4)+4)%4 : 0;
export function localPoint(p, x, z) {
  const angle=rotationOf(p)*Math.PI/2;
  return {x:p.x+x*Math.cos(angle)+z*Math.sin(angle),z:p.z-x*Math.sin(angle)+z*Math.cos(angle)};
}
export function localOffset(p, point) {
  const angle=rotationOf(p)*Math.PI/2, x=point.x-p.x,z=point.z-p.z;
  return {x:x*Math.cos(angle)-z*Math.sin(angle),z:x*Math.sin(angle)+z*Math.cos(angle)};
}
export function footprint(id, placement=null) {
  const item=String(id).startsWith("home:")?homeType(id):gardenType(id);
  const [w, d] = BUILDING_SIZES[id] || (item?[item.w,item.d]:[1, 1]);
  return rotationOf(placement)%2 ? {w:d,d:w} : { w, d };
}
// Model fitting leaves 0.06 units on each side. The same physical envelope is
// used by rendered creatures and simulation workers, not roof overhangs.
export const MODEL_INSET = 0.06;
export const WALKWAY_GAP = 0.4;
export function buildingObstacle(id, p) {
  const { w, d } = footprint(id,p);
  return {
    minX: p.x - w / 2 + MODEL_INSET,
    maxX: p.x + w / 2 - MODEL_INSET,
    minZ: p.z - d / 2 + MODEL_INSET,
    maxZ: p.z + d / 2 - MODEL_INSET,
  };
}
// A farm has two planted beds and a real, open central footpath. Both renderer
// and simulation consume these exact envelopes; larger bodies route around it.
export function buildingObstacles(id, p) {
  const box = buildingObstacle(id, p);
  if (id !== "V4") return [box];
  if(rotationOf(p)%2)return [{...box,maxZ:p.z-.38},{...box,minZ:p.z+.38}];
  return [
    { ...box, maxX: p.x - 0.38 },
    { ...box, minX: p.x + 0.38 },
  ];
}
export function sceneryVisible(s, p, realm = "overworld") {
  if(p.kind==='housing'||p.kind==='civic')return true;
  if(p.native && civicObjects(s).some(q=>overlaps(p,q,.08)))return false;
  if(p.native && (s.housing?.homes||[]).some(h=>overlaps(p,{...h,...homeFootprint(h)},.08)))return false;
  if(gardenGround(p))return !(s.garden?.cleared||[]).includes(p.id);
  return (
    !(s.garden?.cleared||[]).includes(p.id) &&
    !(p.kind === "house" && (s.counts.V2 || 0) < 3) &&
    !Object.entries(s.placements).some(
      ([id, b]) =>
        b.realm === realm &&
        overlaps(p, { ...b, ...footprint(id,b) }, WALKWAY_GAP),
    )
  );
}
export function worldScenery(s,realm='overworld') {
  if(realm!=='overworld')return [];
  const native=scenery(s.chunks[realm]).filter(p=>(p.kind!=='house'||!s.housing)&&!Number.isInteger(s.garden?.naturalSeeds?.[`overworld:${Math.round(p.x/5)}:${Math.round(p.z/5)}`])).map(p=>({...p,realm,native:true,id:`native:${realm}:${p.kind}:${p.x}:${p.z}`}));
  native.push(...s.chunks[realm].flatMap(c=>parcelScenery(s,c)));
  const planted=(s.garden?.plants||[]).filter(p=>p.realm===realm).map(p=>{const i=gardenType(p.type);return {...p,w:(p.rotation||0)%2?i.d:i.w,d:(p.rotation||0)%2?i.w:i.d};});
  const homes=(s.housing?.homes||[]).map(p=>({...p,kind:'housing',...homeFootprint(p)}));
  const natural=[...native,...naturalPatches(s,realm)].filter(p=>!Object.hasOwn(s.land?.scenery||{},parcelKey(realm,{x:Math.round(p.x/5),z:Math.round(p.z/5)})));
  return [...natural,...parcelObjects(s,realm),...planted,...homes,...civicObjects(s)];
}
export function sceneryObstacle(p) {
  if(p.kind==='civic')return buildingObstacles(p.type,p);
  if(p.kind==='housing')return homeObstacles(p);
  const r=p.kind==='tree'?.22:p.kind==='house'?.58:gardenType(p.type)?.radius||0;
  if(!r)return [];
  const i=gardenType(p.type),rectangular=['hedge','vine'].includes(p.type)||i?.souvenir,w=rectangular?((p.rotation||0)%2?i.d:i.w)/2:r,d=rectangular?((p.rotation||0)%2?i.w:i.d)/2:r;
  return [{minX:p.x-w,maxX:p.x+w,minZ:p.z-d,maxZ:p.z+d}];
}
export function district(id) {
  return id?.startsWith("M")
    ? "industry"
    : id?.startsWith("N")
      ? "nether"
      : id?.startsWith("E")
        ? "end"
        : ["Z", "L", "T"].includes(id?.[0])
          ? "center"
          : "village";
}
export const DISTRICTS = {
  village: { name: "村庄", ground: "#c5b591", detail: "#a8b87d" },
  industry: { name: "工业", ground: "#9da5a0", detail: "#b87552" },
  center: { name: "中心", ground: "#c4caba", detail: "#779c90" },
  nether: { name: "下界工业", ground: "#876256", detail: "#c59057" },
  end: { name: "末地设施", ground: "#c2c39a", detail: "#668d82" },
};
export function districtAt(s, realm, x, z) {
  let nearest = null,
    dist = Infinity;
  for (const [id, p] of Object.entries(s.placements)) {
    if (p.realm !== realm) continue;
    const f = footprint(id,p),
      dx = Math.max(0, Math.abs(p.x - x) - f.w / 2),
      dz = Math.max(0, Math.abs(p.z - z) - f.d / 2),
      d = Math.hypot(dx, dz);
    if (d < 0.5 && d < dist) {
      nearest = district(id);
      dist = d;
    }
  }
  return nearest;
}
export function scenery(chunks) {
  return chunks.flatMap((c, index) => [
    {
      x: c.x * 5 + 1.4,
      z: c.z * 5 - 1.9,
      w: 1,
      d: 1,
      kind: "house",
      variant: index % 3,
    },
    {
      x: c.x * 5 + 2,
      z: c.z * 5 + 1.9,
      w: 0.5,
      d: 0.5,
      kind: "tree",
      variant: index % 3,
    },
  ]);
}
export function overlaps(a, b, gap = 0.12) {
  return (
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 + gap - 1e-6 &&
    Math.abs(a.z - b.z) < (a.d + b.d) / 2 + gap - 1e-6
  );
}
export function onLand(s, p) {
  return s.chunks[p.realm]?.some(
    (c) => Math.abs(p.x - c.x * 5) < 2.501 && Math.abs(p.z - c.z * 5) < 2.501,
  );
}
// Short-lived search context: never retained across a build, move, terrain edit or restore.
export function landChecker(s, realm) {
 const chunks=s.chunks[realm]||[];
 if(chunks.some(c=>!Number.isInteger(c.x)||!Number.isInteger(c.z)))return p=>onLand(s,p);
 const rows=new Map();for(const c of chunks){if(!rows.has(c.x))rows.set(c.x,new Set());rows.get(c.x).add(c.z);}
 return p=>{
  if(p.realm!==realm)return false;
  for(let x=Math.ceil((p.x-2.501)/5);x<=Math.floor((p.x+2.501)/5);x++){
   const row=rows.get(x);if(!row||Math.abs(p.x-x*5)>=2.501)continue;
   for(let z=Math.ceil((p.z-2.501)/5);z<=Math.floor((p.z+2.501)/5);z++)if(row.has(z)&&Math.abs(p.z-z*5)<2.501)return true;
  }
  return false;
 };
}
export function placementChecker(s, realm, ignore = null) {
 const contains=landChecker(s,realm);
 const obstacles=[...worldScenery(s,realm).filter(q=>!q.native&&!gardenGround(q)&&q.id!==ignore),
 ...Object.entries(s.placements).filter(([id,p])=>id!==ignore&&p.realm===realm).map(([id,p])=>({...p,...footprint(id,p)}))];
  return (id, p) => {
  if (
    !p ||
    !Number.isFinite(p.x) ||
    !Number.isFinite(p.z) ||
    !s.chunks[p.realm] || (p.rotation!==undefined&&!Number.isInteger(p.rotation))
  )
    return false;
  const f = footprint(id,p),
    a = { ...p, ...f };
  if (obstacles.some(b => overlaps(a, b, WALKWAY_GAP))) return false;
  // Reserve a walkable margin, including at the exposed coast. Existing saves
  // use the same placement migration as other footprint changes.
  const marginX = Math.min(0.4, Math.max(0, (5 - f.w) / 2)),
    marginZ = Math.min(0.4, Math.max(0, (5 - f.d) / 2));
  for (
    let x = p.x - f.w / 2 - marginX;
    x <= p.x + f.w / 2 + marginX + 0.001;
    x += 0.2
  )
    for (
      let z = p.z - f.d / 2 - marginZ;
      z <= p.z + f.d / 2 + marginZ + 0.001;
      z += 0.2
    )
      if (!contains({ x, z, realm: p.realm })) return false;
  if (footprintHitsWater(s, a, p.realm)) return false;
  if (overlaps(a, { x: 0, z: 0, w: 1.45, d: 1.45 }, 0.2)) return false;

  return true;
  };
}
export function canPlace(s, id, p, ignore = null) {
 if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.z)||!s.chunks[p.realm])return false;
 return placementChecker(s,p.realm,ignore)(id,p);
}

export function buildSites(s, realm, id = null, ignore = null, rotation = 0) {
  const candidates = [],check=placementChecker(s,realm,ignore);
  for (const c of s.chunks[realm])
    for (let x = -2; x <= 2; x += 0.5)
      for (let z = -2; z <= 2; z += 0.5) {
        const p = { x: c.x * 5 + x, z: c.z * 5 + z, realm, ...(rotation?{rotation}: {}) };
        if (check(id, p)) candidates.push(p);
      }
  return candidates;
}

export function placementReason(s, id, p, ignore = null) {
  if (canPlace(s, id, p, ignore)) return "";
  if (!p || !onLand(s, p)) return "需要先开垦这片土地";
  const area = { ...p, ...footprint(id,p) };
  if (overlaps(area, { x: 0, z: 0, w: 1.45, d: 1.45 }, .2)) return "请避开采集方块";
  if(worldScenery(s,p.realm).some(q=>q.id!==ignore&&q.kind==='civic'&&overlaps(area,q,WALKWAY_GAP)))return "这里有已建好的设施，请先搬动";
  if(worldScenery(s,p.realm).some(q=>q.kind==='housing'&&overlaps(area,q,WALKWAY_GAP)))return "这里有住宅，先到村庄·住房搬动";
  if(worldScenery(s,p.realm).some(q=>!q.native&&!gardenGround(q)&&overlaps(area,q,WALKWAY_GAP)))return "这里有已种下的布景，先到园艺台整理";
  if (Object.entries(s.placements).some(([other, q]) => other !== ignore && q.realm === p.realm && overlaps(area, { ...q, ...footprint(other,q) }, WALKWAY_GAP))) return "与建筑或通行空间重叠";
  return "土地边缘空间不足，请向内移动";
}
import {civicObjects} from './civic-data.js';
