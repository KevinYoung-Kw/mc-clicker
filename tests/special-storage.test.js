import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {fresh,restore,advance,rates,buy} from '../src/game.js';
import {STORABLE_FACILITIES,activeLevel,operatingState} from '../src/facility-storage.js';
import {storeFacility,replaceFacility,facilityStorageReason} from '../src/building-storage.js';
import {ITEMS} from '../src/catalog.js';import {storageCapacity} from '../src/upgrades.js';
import {ensureStudio} from '../src/studio-placement.js';import {homeStorageReason,storeHome,buildHome,housingSites} from '../src/housing.js';
import {commandAuto} from '../src/command-dispatch.js';
const peak=()=>restore(JSON.parse(readFileSync(new URL('../docs/v1.6/qa/stability-baseline/fixtures/peak.json',import.meta.url))));
function idle(s){for(const r of s.community.residents)Object.assign(r,{job:'idle',prioritySource:null,cargo:null});for(const g of s.community.golems)Object.assign(g,{stops:[],cargo:null});s.community.batches=[];s.community.tasks={};for(const k of Object.keys(s.grid.automation))s.grid.automation[k]=0;for(const b of Object.values(s.buffers))Object.assign(b,{raw:0,goods:0});s.harvest.piston=0;s.harvest.treasure=0;s.live.gifts=[];s.energy=0;s.dimensions.heat=0;s.dimensions.trips={};s.dimensions.awaiting={endRaw:0,endGoods:0};return s;}
test('every outdoor catalogue facility retains ownership through storage and reload',()=>{
 assert.equal(STORABLE_FACILITIES.size,63);
 for(const id of STORABLE_FACILITIES){
  const s=idle(peak());s.counts[id] ||=1;s.placements[id]||={x:0,z:0,realm:ITEMS[id].realm};
  if(id==='L1'){delete s.counts.L2;delete s.placements.L2;}
  if(['N1','E2'].includes(id)){const realm=id==='N1'?'nether':'end';for(const [key,p]of Object.entries(s.placements))if(p.realm===realm)delete s.placements[key];}
  const count=s.counts[id],money=s.money,mods=structuredClone(s.upgrades.levels);
  assert.equal(storeFacility(s,id).ok,true,`${id}: ${facilityStorageReason(s,id)}`);
  assert.equal(activeLevel(s,id),0,id);assert.equal(s.money,money,id);
  const loaded=restore(s);assert.equal(loaded.facilityStorage[id],true,id);assert.equal(loaded.placements[id],undefined,id);assert.equal(loaded.counts[id],count,id);assert.deepEqual(loaded.upgrades.levels,mods,id);
 }
});
test('stored studio retains interior layout and purchased equipment without earning or recreating the room',()=>{
 const s=idle(peak()),p={...s.placements.L2},layout=structuredClone(ensureStudio(s).placements),count={...s.counts},income=s.liveIncome;
 assert.ok(storeFacility(s,'L2').ok);assert.equal(activeLevel(s,'L1'),0);assert.equal(activeLevel(s,'L4'),0);assert.equal(rates(s).live,0);assert.deepEqual(ensureStudio(operatingState(s)).placements,layout);
 assert.equal(buy(s,'L3').ok,false);advance(s,12);assert.equal(s.liveIncome,income);assert.deepEqual(s.counts,count);assert.deepEqual(s.studio.placements,layout);
 const loaded=restore(s);assert.deepEqual(loaded.studio.placements,layout);assert.equal(replaceFacility(loaded,'L2',p).ok,true);assert.ok(activeLevel(loaded,'L4')>0);assert.deepEqual(loaded.studio.placements,layout);
});
test('ranch storage pauses animals without deleting livestock or harvest progress',()=>{
 const s=idle(peak());s.harvest.wool=.7;s.harvest.treasure=.4;const wool=s.harvest.wool,treasure=s.harvest.treasure,animals=[s.counts.V8,s.counts.V9,s.counts.V10];assert.ok(storeFacility(s,'V7').ok);
 assert.equal(activeLevel(s,'V9'),0);advance(s,5);assert.equal(s.harvest.wool,wool);assert.equal(s.harvest.treasure,treasure);assert.deepEqual([s.counts.V8,s.counts.V9,s.counts.V10],animals);
});
test('capacity and cargo checks reject storage before data can be lost',()=>{
 const s=idle(peak());s.buffers.end.goods=storageCapacity({...s,facilityStorage:{M4:true}},'end')+1;assert.match(facilityStorageReason(s,'M4'),/容量/);s.buffers.end.goods=0;
 s.energy=1;assert.match(facilityStorageReason(s,'M5'),/电量/);s.energy=0;
 s.dimensions.trips.N6={cargo:12,remaining:2};assert.match(facilityStorageReason(s,'N6'),/途中/);assert.match(facilityStorageReason(s,'N1'),/途中/);assert.equal(s.dimensions.trips.N6.cargo,12);
 s.dimensions.trips={};assert.match(facilityStorageReason(s,'E2'),/这个世界/);
 s.live.gifts=[{id:1,value:20}];assert.match(facilityStorageReason(s,'L2'),/礼物/);
});
test('mail and command storage stop their recurring effects while preserving preferences and letters',()=>{
 const s=idle(peak()),letters=structuredClone(s.mail.letters);s.dispatch='auto';assert.ok(storeFacility(s,'V18').ok);assert.equal(rates(s).postal,0);assert.ok(storeFacility(s,'Z1').ok);assert.equal(commandAuto(s),false);
 const loaded=restore(s);assert.deepEqual(loaded.mail.letters,letters);assert.equal(loaded.dispatch,'auto');assert.equal(commandAuto(loaded),false);
});
test('an empty original cottage can be stored and rebuilt without losing its variant',()=>{
 const s=idle(peak()),site=housingSites(s,'cottage')[0];assert.ok(site);s.community.residents=s.community.residents.filter(r=>s.housing.assignments[r.id]);s.counts.V2=s.community.residents.length;const h={id:'home:999',type:'legacy',variant:2,...site};s.housing.homes.push(h);s.housing.serial=999;
 assert.equal(homeStorageReason(s,h.id),'');const money=s.money;assert.ok(storeHome(s,h.id).ok);assert.equal(s.housing.stored.cottage,1);
 const loaded=restore(s);assert.deepEqual(loaded.housing.storedVariants.cottage,[2]);const p=housingSites(loaded,'cottage')[0];assert.ok(p);const result=buildHome(loaded,'cottage',p);assert.equal(result.ok,true,result.reason);assert.equal(result.cost,0);assert.equal(loaded.money,money);assert.equal(loaded.housing.homes.find(h=>h.id===result.id).variant,2);
});

test('portable saves retain original cottage variants and special storage flags together',async()=>{
 const {createRequire}=await import('node:module'),brotli=createRequire(import.meta.url)('brotli-wasm');
 const {encodePortableSave,decodePortableSave}=await import('../src/save-brotli.js');
 const s=idle(peak());s.housing.stored.cottage=2;s.housing.storedVariants.cottage=[2,1];assert.ok(storeFacility(s,'L2').ok);assert.ok(storeFacility(s,'V18').ok);
 const decoded=await decodePortableSave(await encodePortableSave(s,'storage',42,async()=>brotli),async()=>brotli),loaded=restore(decoded.save);
 assert.equal(loaded.housing.stored.cottage,2);assert.deepEqual(loaded.housing.storedVariants.cottage,[2,1]);assert.equal(loaded.facilityStorage.L2,true);assert.equal(loaded.facilityStorage.V18,true);assert.deepEqual(loaded.studio.placements,s.studio.placements);
});
