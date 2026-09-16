import test from "node:test";
import assert from "node:assert/strict";
import { fresh } from "../src/game.js";
import { facilityStatus, facilityStatusMarkup, formatCountdown } from "../src/facility-status.js";
import { taskState, harvestPeriod } from "../src/operations.js";
import { storageCapacity } from "../src/upgrades.js";
import { freightSpec } from "../src/dimensional.js";
const field=(status,key)=>status.fields.find(f=>f.key===key)?.value;
test("cycle fields remain stable across 60→59, 10→9, and ready",()=>{
  const s=fresh();s.counts.L1=1;
  const signatures=[];
  for(const seconds of [60,59,10,9,1,0]){
    taskState(s,'music').cooldown=seconds;
    const view=facilityStatus(s,'L1');signatures.push(view.fields.map(f=>f.key));
    assert.equal(field(view,'time'),seconds>0?formatCountdown(seconds):'可触发');
  }
  assert.ok(signatures.every(keys=>JSON.stringify(keys)===JSON.stringify(signatures[0])));
  assert.equal(formatCountdown(60),'01:00');assert.equal(formatCountdown(59),'00:59');
});
test("growth timer comes from the exact production formula, including crop and upgrades",()=>{
  const s=fresh();Object.assign(s.counts,{V4:1,V5:1});s.harvest.farm=.25;
  assert.equal(field(facilityStatus(s,'V4'),'time'),formatCountdown(.75*harvestPeriod(s,'farm')));
  s.harvest.farm=1;assert.equal(field(facilityStatus(s,'V4'),'time'),'可采集');
  assert.match(facilityStatusMarkup(s,'V4'),/role="progressbar"/);
});
test("warehouse, unavailable power and waiting unload remain different states",()=>{
  const s=fresh();Object.assign(s.counts,{M9:1,M3:1,N6:1,N1:1});
  const powered={loads:[],sources:[],perDevice:{},capacity:120};
  s.harvest.piston=12;s.buffers.overworld.raw=storageCapacity(s,'overworld','raw');
  assert.equal(field(facilityStatus(s,'M3',powered),'state'),'仓储已满');
  const noPower={...powered,loads:[{id:'M9',state:'no-power',actual:0}]};
  assert.equal(field(facilityStatus(s,'M9',noPower),'state'),'等待供电');
  const spec=freightSpec(s,'N6');s.dimensions.trips.N6={...spec,cargo:12,remaining:0,duration:spec.flight};
  assert.equal(field(facilityStatus(s,'N6',powered),'state'),'等待卸货');
  assert.equal(field(facilityStatus(s,'N6',powered),'time'),'等待卸货');
});
test("renaming or assigning people changes values, not schema; no timer for a storage box",()=>{
  const s=fresh();Object.assign(s.counts,{L1:1,M4:1,V2:1});const t=taskState(s,'music');t.cooldown=8;
  const a=facilityStatus(s,'L1');
  Object.assign(s.community.residents[0],{name:'村民名字很长',job:'musician'});
  const b=facilityStatus(s,'L1');assert.deepEqual(a.fields.map(f=>f.key),b.fields.map(f=>f.key));
  assert.equal(field(b,'owner'),'村民名字很长');assert.equal(field(facilityStatus(s,'M4'),'time'),undefined);
});
test("transfer and magma status follow current buffers instead of historical deliveries",()=>{
  const s=fresh();Object.assign(s.counts,{N1:1,N12:1,E2:1,E7:1,N5:1});s.endEyes=12;
  const powered={loads:[],sources:[],perDevice:{N5:1}};
  s.dimensions.last.N12={amount:100,state:'working',at:0};
  assert.equal(field(facilityStatus(s,'N12',powered),'state'),'等待货物');
  s.buffers.overworld.goods=10;
  assert.equal(field(facilityStatus(s,'N12',powered),'state'),'正在转运');
  s.buffers.nether.raw=storageCapacity(s,'nether','raw');
  assert.equal(field(facilityStatus(s,'N12',powered),'state'),'目的仓已满');
  s.grid.links.N12=false;
  assert.equal(field(facilityStatus(s,'N12',powered),'state'),'线路未接通');
  s.transfer='end';s.buffers.end.raw=storageCapacity(s,'end','raw');
  assert.equal(field(facilityStatus(s,'E7',powered),'state'),'目的仓已满');
  s.buffers.nether.goods=storageCapacity(s,'nether','goods');
  assert.equal(field(facilityStatus(s,'N5',powered),'state'),'仓储已满');
  s.buffers.nether.goods=0;s.buffers.nether.raw=0;
  assert.equal(field(facilityStatus(s,'N5',powered),'state'),'等待原料');
});
