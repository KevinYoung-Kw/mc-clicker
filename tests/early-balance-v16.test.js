import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,buy,restore,requirements,advance,mine,price} from '../src/game.js';
import {ITEMS,topological} from '../src/catalog.js';
import {ensureCommunity,assignJob,jobSlots,setGolemRoute,upgradeGolem} from '../src/residents.js';
import {enqueueBatch} from '../src/operations.js';
import {nextGuidedTarget} from '../src/first-steps.js';
import {nextFacilityUnlock} from '../src/facility-growth.js';
import {purchaseStatus} from '../src/purchase-feedback.js';
import {haulingCase} from '../scripts/haul-capacity-v16.mjs';

test('golem route and mode survive every equipment upgrade and reload',()=>{
 const s=fresh(0);Object.assign(s.counts,{V15:2,V4:1,V7:1,M1:1,M2:1,M3:1,M4:1,M13:1,L2:1});ensureCommunity(s);s.money=50000;
 assert.ok(setGolemRoute(s,'golem-1',['M1','V4'],'cargo').ok);
 const other=structuredClone(s.community.golems[1]);
 for(const key of ['basket','basket','route','route','sorting','bell']){
  assert.ok(upgradeGolem(s,'golem-1',key).ok);
  assert.deepEqual(s.community.golems[0].stops,['M1','V4']);
  const loaded=restore(s).community.golems[0];assert.deepEqual(loaded.stops,['M1','V4']);assert.equal(loaded.mode,'cargo');
 }
 assert.deepEqual(s.community.golems[1],other);
});

test('changing golem collection range in flight preserves shipment and delivery',()=>{
 const s=fresh(0);Object.assign(s.counts,{V15:1,V4:1,M1:1,M4:1});ensureCommunity(s);
 setGolemRoute(s,'golem-1',['V4'],'cargo');enqueueBatch(s,'V4','小麦',80,4,{});
 const g=s.community.golems[0];for(let i=0;i<100&&!g.cargo;i++)advance(s,.2);
 assert.ok(g.cargo);const flight=structuredClone({cargo:g.cargo,path:g.path,destination:g.destination});
 assert.ok(setGolemRoute(s,g.id,['M1'],'cargo').ok);
 assert.deepEqual({cargo:g.cargo,path:g.path,destination:g.destination},flight);
 for(let i=0;i<200&&g.cargo;i++)advance(s,.2);
 assert.equal(g.cargo,null);assert.ok(g.delivered>0);assert.equal(g.lastDelivery.source,'V4');
 assert.deepEqual(g.stops,['M1']);const delivered=g.delivered;advance(s,20);assert.equal(g.delivered,delivered);
});

test('invalid golem selection does not erase the last saved selection',()=>{
 const s=fresh(0);Object.assign(s.counts,{V15:1,V4:1,M1:1,M2:1});ensureCommunity(s);
 setGolemRoute(s,'golem-1',['V4','M1'],'cargo');
 assert.equal(setGolemRoute(s,'golem-1',['V4','M1','M2']).ok,false);
 assert.deepEqual(s.community.golems[0].stops,['V4','M1']);assert.equal(s.community.golems[0].mode,'cargo');
});

test('two early haulers share existing jobs; storage Lv.3 adds the third, not a second roster',()=>{
 for(const access of ['M4','V3']){
  const s=fresh(0);Object.assign(s.counts,{V2:4,[access]:1});ensureCommunity(s);
  assert.equal(jobSlots(s,'hauler'),2);
  assert.ok(assignJob(s,'resident-1','hauler').ok);assert.ok(assignJob(s,'resident-2','hauler').ok);
  assert.equal(assignJob(s,'resident-3','hauler').ok,false);
  s.counts.M4=3;assert.equal(jobSlots(s,'hauler'),3);assert.ok(assignJob(s,'resident-3','hauler').ok);
  s.counts.M4=16;assert.equal(jobSlots(s,'hauler'),3);assert.equal(assignJob(s,'resident-4','hauler').ok,false);
 }
});

test('a second early hauler delivers more real cargo without multiplying base income',()=>{
 for(const distance of [1,2,3]){
  const one=haulingCase(1,{distance}),two=haulingCase(2,{distance});
  assert.ok(two.delivered>one.delivered,JSON.stringify({one,two}));assert.equal(one.base,two.base);
  for(const r of [one,two]){assert.ok(Math.abs(r.credited-r.base-r.delivered*4)<1e-6);assert.ok(Math.abs(r.accepted-r.delivered-r.waiting)<1e-6);}
 }
});

test('iron pickaxe works before the mine and furnace; first automatic income stays affordable',()=>{
 const s=fresh(0);Object.assign(s.counts,{T1:1,T2:1});s.money=800;
 assert.ok(buy(s,'T3').ok);assert.equal(s.money,0);assert.equal(s.counts.M2,undefined);
 mine(s,()=>1);assert.ok(s.money>=8);
 for(const [id,cost] of [['T1',10],['V18',20],['V2',50],['T7',35]])assert.equal(price(fresh(0),ITEMS[id]),cost);
});

test('second-tier discovery points to the actual facility level and preserves purchased legacy access',()=>{
 assert.equal(new Set(topological().map(i=>i.id)).size,Object.keys(ITEMS).length);
 for(const [id,parent,level] of [['V7','V4',2],['M3','M2',2],['M9','M1',3],['L2','V3',2]]){
  const s=fresh(0);
  s.research.completed={industrial:true,modern:true,railway:true,automation:true,broadcasting:true};s.money=1e7;
  // All first-level prerequisites exist; only the new development level is missing.
  for(const i of topological())s.counts[i.id]=1;delete s.counts[id];s.counts[parent]=1;
  const before=s.money;assert.equal(buy(s,id).ok,false);assert.equal(s.money,before);
  assert.equal(purchaseStatus(s,ITEMS[id]).kind,'locked');assert.ok(purchaseStatus(s,ITEMS[id]).links.includes(parent));
  assert.equal(nextGuidedTarget(s,[id]),parent);assert.match(nextFacilityUnlock(s,parent),new RegExp(ITEMS[id].name));
  s.counts[parent]=level;assert.deepEqual(requirements(s,ITEMS[id]),[]);assert.equal(nextGuidedTarget(s,[id]),id);
  s.counts[parent]=1;s.counts[id]=1;
  delete s.live.broadcastVersion; // This branch explicitly represents a pre-stage historical save.
  const loaded=restore(s);assert.deepEqual(requirements(loaded,ITEMS[id]),[]);assert.ok(buy(loaded,id).ok);
 }
});
