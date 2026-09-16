import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,restore} from '../src/game.js';
import {cargoSnapshot,villageOverview} from '../src/management-overview.js';
import {ensureCommunity,prioritizeHauling,setGolemRoute} from '../src/residents.js';
import {recordMarketSale} from '../src/market-ledger.js';
import {sellCommunity} from '../src/operations.js';

test('cargo overview partitions partially delivered and partially carried batches without double counting',()=>{
 const s=fresh();Object.assign(s.counts,{V2:2,V15:1});ensureCommunity(s);
 const r=s.community.residents[0],g=s.community.golems[0];
 s.community.batches=[{id:'a',source:'V4',qty:100,delivered:30,claimed:r.id},{id:'b',source:'M2',qty:50,delivered:10,claimed:g.id}];
 r.cargo={id:'a',qty:20};g.cargo={id:'b',qty:40};
 const before=JSON.stringify(s);
 assert.deepEqual(cargoSnapshot(s,'V4'),{waiting:50,moving:20,trading:30});
 assert.deepEqual(cargoSnapshot(s),{waiting:50,moving:60,trading:40});
 assert.equal(JSON.stringify(s),before);
 // A partially delivered batch can be sold while the rest is still on a cart.
 s.community.batches[0].qty-=10;s.community.batches[0].delivered-=10;
 assert.deepEqual(cargoSnapshot(s,'V4'),{waiting:50,moving:20,trading:20});
});

test('overview uses actual community sales, not industrial receipts, production or unclaimed cargo',()=>{
 const s=fresh();Object.assign(s.counts,{V2:2,V3:1,V4:1});ensureCommunity(s);s.play=20;
 s.community.batches=[{id:'a',source:'V4',kind:'wheat',label:'小麦',qty:24,delivered:0,claimed:null,value:4,owners:{},haulOwners:{}}];
 assert.equal(villageOverview(s).last,null);
 recordMarketSale(s,{source:'production:overworld',realm:'overworld',label:'工业成品',quantity:100,money:10000});
 assert.equal(villageOverview(s).last,null);
 sellCommunity(s,1,1,1,0,{earn:(state,v)=>{state.money+=v;}});
 assert.equal(villageOverview(s).last.money,4);
 assert.equal(villageOverview(s).waiting,23);
 const before=JSON.stringify(s);villageOverview(s);assert.equal(JSON.stringify(s),before);
 const restored=restore(JSON.parse(before));assert.equal(villageOverview(restored).last.money,4);
});

test('work and rest counts are disjoint and dispatch adjustments retain in-flight cargo',()=>{
 const s=fresh();Object.assign(s.counts,{V2:3,V15:1,V3:1,V4:1,V7:1});ensureCommunity(s);
 const [a,b,c]=s.community.residents; a.job='farmer';b.job='hauler';c.job='idle';
 s.life.residents[b.id]={phase:'rest'};s.life.residents[c.id]={phase:'rest'};
 const view=villageOverview(s);assert.equal(view.working,1);assert.equal(view.resting,2);assert.equal(view.idle,0);
 b.cargo={id:'cargo',qty:12};b.prioritySource='V4';
 assert.equal(prioritizeHauling(s,b.id,null).ok,false);assert.equal(b.prioritySource,'V4');
 const g=s.community.golems[0];g.cargo={id:'cargo2',qty:8};g.stops=['V4'];const cargo=JSON.stringify(g.cargo);
 assert.ok(setGolemRoute(s,g.id,['V7'],'cargo').ok);assert.equal(JSON.stringify(g.cargo),cargo);
});
