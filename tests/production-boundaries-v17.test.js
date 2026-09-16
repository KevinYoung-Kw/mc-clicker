import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh, restore, buy, earn, emit, advance } from '../src/game.js';
import { taskState, taskStatus, requestTask, advanceOperations } from '../src/operations.js';
import { taskControl } from '../src/task-control-state.js';
import { storageCapacity, buyUpgrade } from '../src/upgrades.js';
import { drillCapacity, furnaceCapacity } from '../src/facility-capacity.js';
import { ForegroundClock } from '../src/foreground.js';
import { terminalTransfers } from '../src/dimensional.js';

const emptyPower={perDevice:{},automation:{},loads:[]};
function chorus(){const s=fresh(0);Object.assign(s.counts,{E4:4,M4:1});s.upgrades.levels['chorus-roots']=1;s.upgrades.revision=1;s.harvest.chorus=1;return s;}
const work=(s,seconds)=>{for(let t=0;t<seconds;t+=.25){s.play+=.25;advanceOperations(s,.25,{earn,emit},emptyPower);}};
test('oversized chorus harvest enters available storage and resumes exactly once after save/space/upgrade',()=>{
 let s=chorus();assert.ok(requestTask(s,'chorus').ok);work(s,5);
 const cap=storageCapacity(s,'end','raw');assert.equal(s.buffers.end.raw,cap);
 assert.ok(Math.abs(taskState(s,'chorus').pendingHarvest-(360-cap))<1e-8);
 assert.equal(taskState(s,'chorus').cycle,0);
 s=restore(JSON.parse(JSON.stringify(s)),0);s.counts.E4=5; // batch already harvested, upgrading cannot grow it again
 assert.equal(taskStatus(s,'chorus'),'等待入库');
 assert.equal(taskControl(s,'chorus',emptyPower).label,'等待入库');
 assert.equal(taskControl(s,'chorus',emptyPower).disabled,true);
 assert.equal(requestTask(s,'chorus').ok,false);
 const removed=s.buffers.end.raw;s.buffers.end.raw=0;work(s,1);
 assert.ok(Math.abs(s.buffers.end.raw+removed-360)<1e-8);
 assert.equal(taskState(s,'chorus').cycle,1);assert.equal(taskState(s,'chorus').pendingHarvest,0);
 assert.equal(s.harvest.chorus,0);const amount=s.buffers.end.raw;work(s,2);assert.equal(s.buffers.end.raw,amount);
});
test('a full warehouse preserves the entire picked batch until space exists',()=>{
 const s=chorus();s.buffers.end.raw=storageCapacity(s,'end','raw');requestTask(s,'chorus');work(s,6);
 assert.equal(taskState(s,'chorus').pendingHarvest,360);assert.equal(taskState(s,'chorus').cycle,0);
 s.buffers.end.raw=0;work(s,1);const received=s.buffers.end.raw;s.buffers.end.raw=0;work(s,1);
 assert.ok(Math.abs(received+s.buffers.end.raw-360)<1e-8);assert.equal(taskState(s,'chorus').cycle,1);
});
test('foreground 1/2/4/60Hz runs the same postal time; background and unobserved sleep never accrue debt',()=>{
 for(const hz of [1,2,4,60]){
  const s=fresh(0);s.money=1000;for(const id of ['T1','V1','V18'])assert.ok(buy(s,id).ok);
  const initial=s.money,c=new ForegroundClock(0,true);
  for(let i=1;i<=hz*10;i++)advance(s,c.step(i*1000/hz));
  assert.ok(Math.abs(s.money-initial-10)<1e-6,hz);
  c.setActive(false,10000);assert.equal(c.step(477000),0);c.setActive(true,477000);assert.equal(c.step(477016),.016);
 }
 const c=new ForegroundClock(0,true);assert.equal(c.step(3000),2);assert.equal(c.step(3016),1.016);
 c.step(6016);c.setActive(false,6016);c.setActive(true,9000);assert.equal(c.step(9016),.016);
 assert.equal(c.step(500000),0);assert.equal(c.step(500016),.016);
});
test('final inlet/outlet upgrades allow the complete legal drill and furnace combinations to improve capacity',()=>{
 for(const drill of [true,false]){
  const s=fresh(0);s.money=1e12;
  Object.assign(s.counts,drill?{M9:5,N11:1}:{M2:3,T3:1});
  Object.assign(s.upgrades.levels,drill?{'drill-steel':1,'drill-diamond':1,'drill-twin':1,'drill-cooling':1,'drill-outlet':1}:{'furnace-core':2,'furnace-lining':1,'furnace-blower':1,'furnace-feed':1});s.upgrades.revision=1;
  const capacity=drill?drillCapacity:furnaceCapacity,before=capacity(s);
  assert.ok(buyUpgrade(s,drill?'drill-netherite':'furnace-core').ok);assert.ok(capacity(s)>before);
 }
});
test('one ender chest shares total throughput fairly, reuses spare capacity and conserves cargo',()=>{
 const s=fresh(0);Object.assign(s.counts,{E7:1,E2:1});s.endEyes=12;s.transfer='end';
 s.buffers.overworld.raw=100;s.buffers.nether.raw=100;
 let moved=terminalTransfers(s,1,emptyPower);assert.equal(moved.overworld,3);assert.equal(moved.nether,3);assert.equal(s.buffers.end.raw,6);
 s.buffers.overworld.raw=1;s.buffers.nether.raw=100;s.buffers.end.raw=0;
 moved=terminalTransfers(s,1,emptyPower);assert.equal(moved.overworld,1);assert.equal(moved.nether,5);assert.equal(s.buffers.end.raw,6);
 s.grid.disabled.push('E7');assert.deepEqual(terminalTransfers(s,1,emptyPower),{overworld:0,nether:0,end:0});
});
