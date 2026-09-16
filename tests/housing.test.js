import test from 'node:test';import assert from 'node:assert/strict';
import {fresh,buy,restore,advance} from '../src/game.js';
import {HOMES,HOME_BY_ID,homeReason,homeObstacles,homeDoors,housingCapacity,housingBlock} from '../src/housing-data.js';
import {starterHomeAvailable,claimStarterHome,homeCost,buildHome,housingSites,housingPlacementReason,restoreHousing,moveResidentHome} from '../src/housing.js';
import {worldScenery,sceneryVisible,sceneryObstacle,canPlace} from '../src/layout.js';
import {gardenObjects,clearGarden} from '../src/garden.js';
import {prepareRecruitHousing} from '../scripts/housing-fixture.mjs';
import {ensureCommunity,activeResidents,baseIncome} from '../src/residents.js';
import {residentFixture} from '../scripts/resident-fixture.mjs';
import {ITEMS} from '../src/catalog.js';
import {purchaseStatus} from '../src/purchase-feedback.js';
function starter(){const s=fresh(0);s.money=1e8;for(const id of ['T1','V1','V18','V2'])assert.ok(buy(s,id).ok);return s;}
function place(s,type,options={}){let p;for(let rotation=0;rotation<4&&!p;rotation++)p=housingSites(s,type,rotation,options.moveId).find(p=>!housingPlacementReason(s,type,p,options.moveId));assert.ok(p,`No site for ${type}`);const result=buildHome(s,type,p,options);assert.ok(result.ok,result.reason);return result;}
test('first recruit earns one unclaimed zero-price home; claiming is explicit and idempotent',()=>{
 const s=fresh(0);assert.equal(starterHomeAvailable(s),false);assert.equal(claimStarterHome(s).ok,false);
 const a=starter();assert.ok(starterHomeAvailable(a));assert.equal(a.housing.homes.length,0);assert.equal(a.housing.stored.oak,undefined);
 const money=a.money;assert.ok(claimStarterHome(a).ok);assert.equal(a.money,money);assert.equal(homeCost(a,'oak'),0);assert.equal(claimStarterHome(a).ok,false);assert.equal(a.housing.stored.oak,1);
});
test('cancel before placement and reload preserve free entitlement; confirm consumes it only once',()=>{
 let s=starter();claimStarterHome(s);s.money=0;s=restore(s,0);assert.equal(s.housing.stored.oak,1);
 const r=place(s,'oak');assert.equal(r.cost,0);assert.equal(s.money,0);assert.equal(s.housing.stored.oak,0);assert.equal(s.housing.assignments['resident-1'].homeId,r.id);
 s=restore(s,0);assert.equal(s.housing.homes.length,1);assert.equal(s.housing.stored.oak||0,0);assert.equal(starterHomeAvailable(s),false);assert.equal(homeCost(s,'oak'),120);
});
test('invalid placement keeps both emeralds and the claimed home',()=>{
 const s=starter();claimStarterHome(s);const money=s.money;for(const p of [{x:0,z:0,realm:'overworld'},{x:30,z:30,realm:'overworld'},{x:1,z:1,realm:'end'},{x:NaN,z:1,realm:'overworld'}])assert.equal(buildHome(s,'oak',p).ok,false);
 assert.equal(s.money,money);assert.equal(s.housing.stored.oak,1);assert.equal(s.housing.homes.length,0);
});
test('later recruitment needs an empty address, existing villagers still earn income',()=>{
 const s=starter(),before=baseIncome(s);assert.ok(housingBlock(s));assert.equal(buy(s,'V2').ok,false);assert.deepEqual(purchaseStatus(s,ITEMS.V2).links,['housing']);advance(s,10);assert.equal(baseIncome(s),before);
 claimStarterHome(s);place(s,'oak');assert.equal(buy(s,'V2').ok,false);prepareRecruitHousing(s);assert.ok(buy(s,'V2').ok);assert.equal(Object.keys(s.housing.assignments).length,2);assert.equal(housingCapacity(s),2);
});
test('facility upgrades unlock distinct house types, and every gate can actually be reached',()=>{
 const s=starter();assert.deepEqual(HOMES.filter(h=>!homeReason(s,h.id)).map(h=>h.id),['cottage','oak','hearth']);
 s.counts.V6=1;assert.equal(homeReason(s,'porch'),'');assert.ok(homeReason(s,'moss'));
 s.counts.V4=2;assert.equal(homeReason(s,'moss'),'');s.counts.V3=2;assert.equal(homeReason(s,'duplex'),'');assert.ok(homeReason(s,'tower'));
 s.counts.V14=1;assert.equal(homeReason(s,'tower'),'');assert.ok(homeReason(s,'corner'));s.counts.V3=3;assert.equal(homeReason(s,'corner'),'');s.counts.V4=3;assert.equal(homeReason(s,'gallery'),'');
 for(const h of HOMES)for(const [id,level] of h.requires||[])assert.ok(ITEMS[id]&&level<=ITEMS[id].max);
});
test('all nine house models can be purchased, rotated, persisted and assigned without changing income',()=>{
 const s=residentFixture();for(const id of ['V3','V4'])while(s.counts[id]<3)assert.ok(buy(s,id).ok);if(!s.counts.V6)assert.ok(buy(s,'V6').ok);for(let x=-2;x<=2;x++)for(let z=-2;z<=2;z++)if(!s.chunks.overworld.some(p=>p.x===x&&p.z===z))s.chunks.overworld.push({x,z});s.layoutRevision++;const oldCount=s.housing.homes.length,oldCapacity=housingCapacity(s);
 const base=baseIncome(s);for(const h of HOMES){const money=s.money;const r=place(s,h.id);assert.equal(money-s.money,h.cost);assert.equal(r.cost,h.cost);}
 assert.equal(s.housing.homes.length,oldCount+9);assert.equal(housingCapacity(s),oldCapacity+18);assert.equal(baseIncome(s),base);
 const loaded=restore(s,0);assert.deepEqual(loaded.housing.homes.map(({variant,...h})=>h),s.housing.homes.map(({variant,...h})=>h));assert.deepEqual(loaded.housing.assignments,s.housing.assignments);
});
test('moving a home keeps its identity, address and resident; no second charge or free gift',()=>{
 const s=starter();claimStarterHome(s);const r=place(s,'oak');buy(s,'V1');const before=structuredClone(s.housing.assignments),money=s.money;const old=s.housing.homes[0];const p=housingSites(s,'oak',1,r.id).find(p=>Math.hypot(p.x-old.x,p.z-old.z)>2&&!housingPlacementReason(s,'oak',p,r.id));assert.ok(p);
 assert.ok(buildHome(s,'oak',p,{moveId:r.id}).ok);assert.equal(s.housing.homes.length,1);assert.equal(s.housing.homes[0].id,r.id);assert.equal(s.housing.homes[0].rotation,1);assert.equal(s.money,money);assert.deepEqual(s.housing.assignments,before);assert.equal(claimStarterHome(s).ok,false);
});
test('home occupancy assignment cannot overwrite another resident or change a job',()=>{
 const s=starter();prepareRecruitHousing(s,2);buy(s,'V2');prepareRecruitHousing(s,3);const free=s.housing.homes.find(h=>!Object.values(s.housing.assignments).some(a=>a.homeId===h.id));const resident=s.community.residents[0],job=resident.job;
 assert.ok(moveResidentHome(s,resident.id,free.id,1).ok);assert.equal(resident.job,job);assert.equal(moveResidentHome(s,'resident-2',free.id,1).ok,false);assert.equal(moveResidentHome(s,resident.id,free.id,2).ok,false);
});
test('old saves preserve visible cottages at original coordinates and keep every resident and earnings',()=>{
 const raw=starter();raw.counts.V2=12;buy(raw,'V1');ensureCommunity(raw);delete raw.housing;delete raw.garden.naturalSeeds;delete raw.garden.naturalSeed;
 const visible=worldScenery(raw).filter(p=>p.kind==='house'&&sceneryVisible(raw,p));assert.ok(visible.length>0,'must migrate an actually visible old cottage');const before=baseIncome(raw),ids=raw.community.residents.map(r=>r.id);const s=restore(raw,0);
 assert.deepEqual(s.housing.homes.map(p=>[p.x,p.z,p.variant]),visible.map(p=>[p.x,p.z,p.variant]));assert.ok(s.housing.homes.every(h=>h.type==='legacy'));assert.equal(baseIncome(s),before);assert.deepEqual(s.community.residents.map(r=>r.id),ids);assert.ok(starterHomeAvailable(s));assert.equal(buy(s,'V2').ok,false);
 const next=restore(s,0);assert.deepEqual(next.housing.homes,s.housing.homes);assert.deepEqual(next.housing.assignments,s.housing.assignments);
});
test('legacy forty-five-person rosters retain twenty-four active residents and reserves',()=>{
 const raw=starter();raw.counts.V2=45;ensureCommunity(raw);delete raw.housing;const income=baseIncome(raw),s=restore(raw,0);assert.equal(s.community.residents.length,45);assert.equal(activeResidents(s).length,24);assert.equal(baseIncome(s),income);assert.ok(Object.keys(s.housing.assignments).every(id=>activeResidents(s).some(r=>r.id===id)));assert.equal(buy(s,'V2').ok,false);
});
test('housing uses the shared collision graph and cannot be cleared as a garden object',()=>{
 const s=starter();claimStarterHome(s);const r=place(s,'oak'),h=s.housing.homes[0],scenery=worldScenery(s).find(p=>p.id===r.id);assert.equal(scenery.kind,'housing');assert.deepEqual(sceneryObstacle(scenery),homeObstacles(h));assert.equal(canPlace(s,'M2',{x:h.x,z:h.z,realm:'overworld'}),false);assert.ok(!gardenObjects(s).some(p=>p.id===r.id));s.counts.V20=1;assert.equal(clearGarden(s,r.id).ok,false);
 const courtyard={type:'gallery',x:0,z:0,rotation:0};assert.ok(!homeObstacles(courtyard).some(b=>b.minX<0&&b.maxX>0&&b.minZ<0&&b.maxZ>0));
});
test('new expansion does not secretly add cottages; existing homes stay in place',()=>{
 const s=starter();claimStarterHome(s);place(s,'oak');const homes=structuredClone(s.housing.homes);s.counts.V2=3;buy(s,'V1');assert.deepEqual(s.housing.homes,homes);assert.equal(worldScenery(s).filter(p=>p.kind==='house').length,0);
});
