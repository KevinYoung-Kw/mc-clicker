import {GARDEN_BY_ID} from './garden-data.js';
import {remapTerrainCells,restoreTerrainMap} from './terrain-data.js';
// Historical purchases and stored parcels are independent of the current map.
export const LAND_PRICING = {
  overworld: { base: 25, growth: 1.65 },
  nether: { base: 25000, growth: 1.65 },
  end: { base: 2500000, growth: 1.65 },
};
const valid = n => Number.isSafeInteger(n) && n >= 0;
export const parcelKey = (realm, p) => `${realm}:${p.x}:${p.z}`;
const geometryCount = (s, realm) => realm === 'overworld'
  ? (s.counts?.V1 > 0 ? s.chunks[realm].length : 0)
  : Math.max(0, s.chunks[realm].length - 1);
export function landPurchaseCount(s, realm = s.realm) {
  if (!LAND_PRICING[realm]) return 0;
  return Math.max(geometryCount(s, realm), s.land?.purchased?.[realm] || 0);
}
export function landMarketPrice(s, realm = s.realm) {
  const rule = LAND_PRICING[realm];
  return rule ? Math.min(Number.MAX_VALUE, Math.ceil(rule.base * rule.growth ** landPurchaseCount(s, realm))) : Infinity;
}
export const storedLandCount = (s, realm = s.realm) => s.land?.stored?.[realm]?.length || 0;
export const landPrice = (s, realm = s.realm) => storedLandCount(s, realm) ? 0 : landMarketPrice(s, realm);
export function ensureLand(s) {
  if (s.land?.version === 1) return s.land;
  s.land = {version:1, serial:0, revision:0, purchased:{}, stored:{}, scenery:{}};
  for (const realm in LAND_PRICING) {
    s.land.purchased[realm] = geometryCount(s, realm);
    s.land.stored[realm] = [];
  }
  return s.land;
}
// Relative natural objects preserve old parcels exactly, including cleared plants.
export function parcelObjects(s, realm) {
  return s.chunks[realm].flatMap(c => (s.land?.scenery?.[parcelKey(realm,c)] || []).map((p,i) => ({
    ...p, x:c.x*5+p.x, z:c.z*5+p.z, realm, native:true,
    id:`parcel:${parcelKey(realm,c)}:${i}`,
  })));
}
export function restoreLand(s, raw) {
  const source=raw?.land; delete s.land; const land=ensureLand(s);
  if (source?.version!==1) return;
  const objects = list => (Array.isArray(list)?list:[]).filter(p=>p && ['tree','garden'].includes(p.kind) && (p.kind==='tree'||GARDEN_BY_ID[p.type]) && Number.isFinite(p.x) && Number.isFinite(p.z) && Math.abs(p.x)<=2.5 && Math.abs(p.z)<=2.5 && Number.isFinite(p.w) && p.w>0 && p.w<=2 && Number.isFinite(p.d) && p.d>0 && p.d<=2).map(p=>({kind:p.kind,type:p.type,x:p.x,z:p.z,w:p.w,d:p.d,rotation:Number.isInteger(p.rotation)?p.rotation%4:0,scale:Number.isFinite(p.scale)?Math.max(.3,Math.min(1,p.scale)):1,variant:p.variant||0,cleared:p.cleared===true}));
  const ids=new Set();
  for (const realm in LAND_PRICING) {
    for (const item of Array.isArray(source.stored?.[realm])?source.stored[realm]:[]) {
      if (!item || !valid(item.id) || !item.id || ids.has(item.id) || !Number.isSafeInteger(item.x) || !Number.isSafeInteger(item.z)) continue;
      ids.add(item.id);land.stored[realm].push({id:item.id,x:item.x,z:item.z,scenery:objects(item.scenery),terrain:restoreTerrainMap(item.terrain)});
      land.serial=Math.max(land.serial,item.id);
    }
    land.purchased[realm]=Math.max(geometryCount(s,realm)+land.stored[realm].length,valid(source.purchased?.[realm])?source.purchased[realm]:0);
    for (const c of s.chunks[realm]) {
      const key=parcelKey(realm,c);
      if (Object.hasOwn(source.scenery||{},key)) land.scenery[key]=objects(source.scenery[key]);
    }
  }
  land.serial=Math.max(land.serial,valid(source.serial)?source.serial:0);
  land.revision=valid(source.revision)?source.revision:0;
}
export function registerLandPurchase(s, realm, site) {
  const land=ensureLand(s),stored=land.stored[realm].shift();
  if (!stored) {land.purchased[realm]++;land.revision++;return null;}
  const key=parcelKey(realm,site);
  if (realm==='overworld') {
    land.scenery[key]=stored.scenery;
    stored.scenery.forEach((p,i)=>{if(p.cleared)s.garden.cleared.push(`parcel:${key}:${i}`)});
    s.garden.terrain||={};
    const mapped=remapTerrainCells(stored.terrain,{x:stored.x,z:stored.z},site);
    for(const [cell,id] of Object.entries(mapped))s.garden.terrain[cell]=id;
    if(Object.keys(mapped).length)s.garden.revision++;
  }
  land.revision++;return stored;
}
