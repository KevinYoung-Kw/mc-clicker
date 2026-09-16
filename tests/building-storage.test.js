import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fresh,restore,rates,advance,buy,sites} from '../src/game.js';
import {storeFacility,replaceFacility,facilityStorageReason} from '../src/building-storage.js';
import {facilityStored,activeLevel} from '../src/facility-storage.js';
import {storeHome,homeStorageReason} from '../src/housing.js';
import {powerSnapshot} from '../src/power.js';
import {encodeSave,decodeSave} from '../src/save-code.js';
const peak=()=>restore(JSON.parse(readFileSync(new URL('../docs/v1.6/qa/stability-baseline/fixtures/peak.json',import.meta.url))));
function idle(s){for(const r of s.community.residents){r.job='idle';r.prioritySource=null;r.cargo=null;}for(const g of s.community.golems){g.stops=[];g.cargo=null;}s.community.batches=[];s.community.tasks={};s.harvest.piston=0;for(const b of Object.values(s.buffers))Object.assign(b,{raw:0,goods:0,delivered:0});return s;}
test('storing and replacing preserves ownership, money, installed upgrades and grid preferences',()=>{
 const s=idle(peak()),id='M9';s.grid.disabled.push(id);const p={...s.placements[id]},counts={...s.counts},money=s.money,upgrades=structuredClone(s.upgrades.levels),links={...s.grid.links};
 assert.equal(storeFacility(s,id).ok,true);assert.equal(activeLevel(s,id),0);assert.deepEqual(s.counts,counts);assert.equal(s.money,money);assert.equal(buy(s,id).ok,false);
 assert.equal(s.placements[id],undefined);assert.equal(powerSnapshot(s).perDevice[id]||0,0);
 const saved=restore(decodeSave(encodeSave(s)).save);assert.ok(saved.grid.disabled.includes(id));assert.equal(facilityStored(saved,id),true);assert.equal(saved.placements[id],undefined);assert.deepEqual(saved.upgrades.levels,upgrades);
 assert.equal(replaceFacility(saved,id,p).ok,true);assert.equal(facilityStored(saved,id),false);assert.equal(saved.counts[id],counts[id]);assert.deepEqual(saved.grid.links,links);assert.equal(saved.money,money);assert.equal(replaceFacility(saved,id,p).ok,false);
});
test('storage cannot discard workers, haul priorities, golem routes or unpaid goods',()=>{
 const s=idle(peak()),id='M1',r=s.community.residents[0],g=s.community.golems[0];
 r.job='miner';assert.match(facilityStorageReason(s,id),/村民/);r.job='idle';r.prioritySource=id;assert.match(facilityStorageReason(s,id),/优先/);r.prioritySource=null;
 g.stops=[id];assert.match(facilityStorageReason(s,id),/巡收/);g.stops=[];
 s.community.batches=[{source:id,qty:4}];assert.match(facilityStorageReason(s,id),/货物/);assert.equal(storeFacility(s,id).ok,false);assert.equal(s.community.batches[0].qty,4);
});
test('stored production matches a stopped source over simulation without selling ownership',()=>{
 const s=fresh();s.counts={V1:1,M1:2};assert.ok(rates(s).regions.overworld.raw>0);s.placements.M1={x:1.5,z:1.5,realm:'overworld'};
 assert.equal(storeFacility(s,'M1').ok,true);
 const expected=fresh();expected.counts.V1=1;advance(s,20);advance(expected,20);
 assert.equal(s.buffers.overworld.raw,expected.buffers.overworld.raw);assert.equal(s.counts.M1,2);assert.equal(s.money,expected.money);
});
test('storing generation removes its supply and cannot erase excess raw capacity',()=>{
 const s=idle(peak()),before=powerSnapshot(s).supply;assert.equal(storeFacility(s,'M15').ok,true);assert.ok(powerSnapshot(s).supply<before);
 s.buffers.overworld.raw=1e100;assert.match(facilityStorageReason(s,'M9'),/仓储容量/);
});
test('empty homes return to free inventory; occupied homes and duplicate reclaim are blocked',()=>{
 const s=peak(),home=s.housing.homes[0];assert.match(homeStorageReason(s,home.id),/住户/);assert.equal(storeHome(s,home.id).ok,false);
 s.community.residents=s.community.residents.filter(r=>s.housing.assignments[r.id]);
 const empty={id:'home:999',type:'hearth',realm:'overworld',x:30,z:30,rotation:0};s.housing.homes.push(empty);s.housing.serial=999;
 const before=s.money;assert.equal(storeHome(s,empty.id).ok,true);assert.equal(s.housing.stored.hearth,1);assert.equal(storeHome(s,empty.id).ok,false);assert.equal(s.money,before);
 assert.equal(restore(s).housing.stored.hearth,1);
});

test('stored facilities leave upgrade recommendations and preserve active route preferences',async()=>{
 const {ownedGroups}=await import('../src/facility-shops.js');const {ITEMS}=await import('../src/catalog.js');
 const s=idle(peak());assert.equal(storeFacility(s,'M9').ok,true);const groups=ownedGroups(s,[ITEMS.M9]);assert.equal(groups.stored[0].id,'M9');assert.equal(groups.upgradable.length,0);
 const before=rates(s);s.editing.lines={power:false,logistics:false};assert.deepEqual(rates(s),before);
 assert.deepEqual(restore(s).editing.lines,s.editing.lines);
});
test('automation must be released before storing its assigned production facility',()=>{
 const s=idle(peak());s.grid.automation.farm=1;assert.match(facilityStorageReason(s,'V4'),/自动化/);assert.equal(storeFacility(s,'V4').ok,false);
 s.grid.automation.farm=0;assert.equal(storeFacility(s,'V4').ok,true);
});
test('new storage flags survive the current portable format',async()=>{
 const {createRequire}=await import('node:module'),brotli=createRequire(import.meta.url)('brotli-wasm');
 const {encodePortableSave,decodePortableSave}=await import('../src/save-brotli.js');
 const s=idle(peak());assert.equal(storeFacility(s,'M15').ok,true);
 const decoded=await decodePortableSave(await encodePortableSave(s,'test',42,async()=>brotli),async()=>brotli),loaded=restore(decoded.save);
 assert.equal(facilityStored(loaded,'M15'),true);assert.equal(loaded.placements.M15,undefined);assert.equal(loaded.counts.M15,s.counts.M15);
});
