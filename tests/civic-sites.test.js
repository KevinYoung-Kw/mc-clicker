import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,restore,advance} from '../src/game.js';
import {civicCost,civicReason,civicSites,buildCivic,storeCivic} from '../src/civic-sites.js';
import {serviceNodes,residentLife,restCycle,advanceResidentLife,happinessParts,advanceLifeBudget} from '../src/villager-life.js';
import {facilityStorageReason} from '../src/building-storage.js';
import {landRemovalReason} from '../src/land-management.js';
import {placementReason,worldScenery} from '../src/layout.js';
import {parseSaveJSON} from '../src/save-validation.js';
const setup=()=>{const s=fresh(0);s.money=1e6;s.counts.V1=9;s.counts.V21=1;s.counts.V25=1;s.chunks.overworld=Array.from({length:9},(_,i)=>({x:i%3-1,z:Math.floor(i/3)-1}));s.placements.V21={x:1,z:1,realm:'overworld',rotation:0};s.placements.V25={x:-2,z:1,realm:'overworld',rotation:0};return s;};
test('分点有真实价格和占地，取消选址不扣钱，搬动/回摆不重复收费',()=>{
 const s=setup(),before=s.money,site=civicSites(s,'V25',1)[0];assert.ok(site);assert.equal(s.money,before);
 const r=buildCivic(s,'V25',site);assert.equal(r.ok,true);assert.equal(before-s.money,3900);assert.equal(civicCost(s,'V25'),5850);
 assert.equal(buildCivic(s,'V21',site).ok,false);assert.equal(s.money,before-3900);
 assert.ok(placementReason(s,'V4',site));assert.equal(worldScenery(s,'overworld').filter(p=>p.kind==='civic').length,1);
 assert.match(facilityStorageReason(s,'V25'),/分点/);
 assert.ok(landRemovalReason(s,{x:Math.round(site.x/5),z:Math.round(site.z/5),realm:'overworld'}));
 assert.equal(storeCivic(s,r.id).ok,true);assert.equal(serviceNodes(s).some(p=>p.id===r.id),false);
 assert.equal(buildCivic(s,'V25',civicSites(s,'V25',2,r.id)[0],{moveId:r.id}).cost,0);assert.equal(s.money,before-3900);
 assert.equal(buildCivic(s,'V25',civicSites(s,'V25')[0]).ok,true);assert.match(civicReason(s,'V25'),/3 座/);
 assert.equal(buildCivic(s,'V25',civicSites(s,'V25')[0]).ok,false);
});
test('JSON读档保留已购分点、朝向和免费收纳，不让后续编号重复',()=>{
 const s=setup();const a=buildCivic(s,'V21',civicSites(s,'V21',3)[0]);const b=buildCivic(s,'V25',civicSites(s,'V25',1)[0]);storeCivic(s,b.id);
 const copy=restore(parseSaveJSON(JSON.stringify(s)));assert.equal(copy.version,10);assert.deepEqual(copy.life.sites,s.life.sites);assert.equal(copy.money,s.money);
 const c=buildCivic(copy,'V21',civicSites(copy,'V21')[0]);assert.notEqual(c.id,a.id);assert.notEqual(c.id,b.id);
 const damaged=structuredClone(s);damaged.life.sites[0].x=100;const repaired=restore(damaged);assert.equal(repaired.life.sites[0].stored,true);assert.equal(repaired.money,s.money);
});
test('旧档食堂到访权益保留，分点不叠加，同类升级有限度',()=>{
 const s=setup();s.life.serviceMode='legacy';const r={id:'resident-1',job:'miner',x:-2,z:2,path:[],progress:0};s.community.residents=[r];const a=residentLife(s,r);a.worked=restCycle(s,r);
 assert.equal(happinessParts(s,r).food,0);
 for(let i=0;i<20;i++){s.play++;advanceResidentLife(s,r,1,{move:()=>true});}
 assert.equal(a.visited.V25,s.play);assert.equal(happinessParts(s,r).food,6);
 const firstFood=happinessParts(s,r).food;buildCivic(s,'V25',civicSites(s,'V25')[0]);assert.equal(happinessParts(s,r).food,firstFood);
 s.play+=360;assert.equal(happinessParts(s,r).food,0);
 a.visited.V25=s.play;a.visitLevels.V25=3;a.visited.V21=s.play;a.visited.V22=s.play;a.visited.V23=s.play;s.counts.V22=3;s.counts.V23=3;
 assert.equal(happinessParts(s,r).food,10);assert.equal(happinessParts(s,r).leisure,15);assert.ok(happinessParts(s,r).factor<=1.15);
});
test('分点休息读档不丢岗位；途中没到达、收起后都不能补发用餐效果',()=>{
 const s=setup(),built=buildCivic(s,'V25',civicSites(s,'V25')[0]),p=s.life.sites[0],r={id:'resident-1',job:'miner',x:p.x,z:p.z,path:[],progress:0};s.counts.V2=1;s.counts.M1=1;s.placements.M1={x:4,z:4,realm:'overworld'};s.community.residents=[r];const a=residentLife(s,r);a.phase='rest';a.service=built.id;a.remaining=8;
 const copy=restore(s),person=copy.community.residents.find(p=>p.id==='resident-1');assert.ok(person);assert.equal(copy.life.residents[person.id].service,built.id);assert.equal(person.job,'miner');
 storeCivic(copy,built.id);assert.equal(copy.life.residents[person.id].service,null);
 for(let i=0;i<9;i++)advanceResidentLife(copy,person,1);assert.equal(happinessParts(copy,person).food,0);
 s.life.residents[r.id].phase='going-rest';const moving=restore(s);assert.equal(moving.life.residents[r.id].service,null);
});
test('公共设施收起后福利停供；后台不推进分点休息或费用',()=>{
 const s=setup(),r={id:'r1',job:'miner'};s.community.residents=[r];s.life.welfare='simple';s.facilityStorage.V25=true;s.facilityStorage.V21=true;const money=s.money;
 assert.match(advanceLifeBudget(s,1),/暂停/);assert.equal(s.money,money);assert.equal(s.life.welfare,'off');
 const before=JSON.stringify(s.life);advance(s,0);assert.equal(JSON.stringify(s.life),before);
});
