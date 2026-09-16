import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,restore,advance} from '../src/game.js';
import {assignJob,ensureCommunity} from '../src/residents.js';
import {buildCivic,civicSites,civicReason,storeCivic} from '../src/civic-sites.js';
import {farmLocations,farmLocation,farmLimit,reconcileFarmWorkers} from '../src/farm-sites.js';
import {requestTask,taskState,taskReady,advanceOperations,advanceFarmSites,sellCommunity} from '../src/operations.js';
import {serviceNodes} from '../src/villager-life.js';
import {encodePersistentSave,decodeSave} from '../src/save-code.js';
import {selectCrop} from '../src/collection.js';
function fixture(type='V4',level=6){
 const s=fresh(0);s.money=1e7;s.counts={T1:1,V1:9,V2:6,V3:5,V4:6,V7:4,V8:1,V9:1,V10:1,M4:8};s.counts[type]=level;
 s.chunks.overworld=Array.from({length:9},(_,i)=>({x:i%3-1,z:Math.floor(i/3)-1}));
 s.placements.V4={x:-3,z:1,realm:'overworld'};s.placements.V7={x:2,z:1,realm:'overworld'};s.placements.V3={x:0,z:5,realm:'overworld'};s.placements.M4={x:-3,z:5,realm:'overworld'};ensureCommunity(s);return s;
}
function add(s,type){const site=civicSites(s,type)[0];assert.ok(site);const r=buildCivic(s,type,site);assert.equal(r.ok,true,r.reason);return s.life.sites.find(p=>p.id===r.id);}
const api={earn:(s,v)=>{s.money+=v;},emit:()=>null,collectGift:()=>{},deliverOrders:()=>0};
const power={automation:{},perDevice:{},loads:[]};
test('农牧本体等级解锁真实增建名额；未建好不会多出岗位',()=>{
 const s=fixture('V4',1);assert.match(civicReason(s,'V4'),/Lv.3/);assert.ok(assignJob(s,'resident-1','farmer').ok);assert.equal(assignJob(s,'resident-2','farmer').ok,false);
 s.counts.V4=3;const before=s.money,p=add(s,'V4');assert.equal(before-s.money,1388);assert.equal(farmLimit(s,'V4'),2);assert.ok(assignJob(s,'resident-2','farmer').ok);assert.equal(farmLocation(s,s.community.residents[1]).id,p.id);assert.match(civicReason(s,'V4'),/Lv.6/);
 s.counts.V4=6;add(s,'V4');assert.ok(assignJob(s,'resident-3','farmer').ok);assert.equal(new Set(s.community.residents.filter(r=>r.job==='farmer').map(r=>r.farmSiteId)).size,3);assert.equal(assignJob(s,'resident-4','farmer').ok,false);
 s.counts.V7=1;assert.match(civicReason(s,'V7'),/Lv.2/);s.counts.V7=2;add(s,'V7');assert.match(civicReason(s,'V7'),/Lv.4/);s.counts.V7=4;add(s,'V7');assert.equal(farmLocations(s,'V7').length,3);assert.equal(serviceNodes(s).length,0);
});
test('多片田地各自成熟、收割、产生带来源货批；交货出售才产生收入',()=>{
 const s=fixture(),p=add(s,'V4'),q=add(s,'V4');s.harvest.farm=1;p.production.harvest.farm=1;q.production.harvest.farm=.2;
 const before=s.money;assert.ok(requestTask(s,'farm',p.id).ok);
 for(let i=0;i<8;i++){s.play++;advanceOperations(s,1,api,power);}
 assert.equal(s.harvest.farm,1);assert.equal(p.production.harvest.farm,0);assert.equal(q.production.harvest.farm,.2);assert.equal(s.money-before,s.community.baseIncome);
 const goods=s.community.batches.find(b=>b.origin===p.id);assert.ok(goods?.qty>0);const gross=goods.qty*goods.value,money=s.money;sellCommunity(s,1000,1000,1000,1,api);assert.ok(s.money>money);assert.ok(s.money-money<=gross+1e-8);const sold=s.money;sellCommunity(s,1000,1000,1000,1,api);assert.equal(s.money,sold);
});
test('三个村民在三个田地到岗，独立产出增加，仍经过真实成交',()=>{
 function probe(plots){const s=fixture();for(let i=1;i<plots;i++)add(s,'V4');for(let i=1;i<=plots;i++)assert.ok(assignJob(s,`resident-${i}`,'farmer').ok);
  const start=s.money;for(let i=0;i<600;i++){s.play++;s.harvest.farm=Math.min(1,s.harvest.farm+1/40);advanceFarmSites(s,1);advanceOperations(s,1,api,power);sellCommunity(s,1,1000,1000,1,api);}
  return {s,jobs:s.community.jobIncome,earned:s.money-start-s.community.baseIncome};}
 const one=probe(1),three=probe(3);assert.ok(three.jobs>one.jobs*1.8,JSON.stringify({one:one.jobs,three:three.jobs}));assert.ok(three.s.community.residents.slice(0,3).every(r=>r.jobsDone>0));
});
test('新增畜栏独立收取牛奶、羊毛和宝藏；同类本体不被重复计数',()=>{
 const s=fixture('V7',2),p=add(s,'V7');advanceFarmSites(s,50);for(const key of ['milk','wool','treasure'])assert.ok(requestTask(s,key,p.id).ok);
 for(let i=0;i<4;i++){s.play++;advanceOperations(s,1,api,power);}
 assert.ok(s.community.batches.some(b=>b.origin===p.id&&b.kind==='milk'));assert.ok(s.community.batches.some(b=>b.origin===p.id&&b.kind==='wool'));assert.equal(s.counts.V8,1);assert.equal(s.counts.V9,1);assert.equal(s.counts.V10,1);
});
test('存档码及 JSON 保留农牧位置、在岗关系、成熟和货批；重复读取不重发',()=>{
 const s=fixture(),p=add(s,'V4');assignJob(s,'resident-1','farmer');assignJob(s,'resident-2','farmer');p.production.harvest.farm=.73;taskState(s,'farm',p.id).tend=.5;taskState(s,'farm',p.id).tenders['resident-2']=.5;
 const coded=restore(decodeSave(encodePersistentSave(s,'test')).save),json=restore(JSON.parse(JSON.stringify(s)));for(const copy of [coded,json,restore(json)]){assert.equal(copy.life.sites[0].production.harvest.farm,.73);assert.equal(copy.life.sites[0].production.tasks.farm.tend,.5);assert.equal(copy.community.residents[1].farmSiteId,p.id);assert.equal(copy.money,s.money);}
 assert.equal(storeCivic(json,p.id).ok,false);assignJob(json,'resident-2','idle');assert.equal(storeCivic(json,p.id).ok,true);const money=json.money;assert.ok(buildCivic(json,'V4',civicSites(json,'V4',1,p.id)[0],{moveId:p.id}).ok);assert.equal(json.money,money);assert.equal(json.life.sites[0].production.harvest.farm,.73);
 const life=JSON.stringify(json.life);advance(json,0);assert.equal(JSON.stringify(json.life),life);
});
test('旧档多人共田保留工作，增建后分散到新田；改种同步重长，不复制成熟产物',()=>{
 const s=fixture();for(const r of s.community.residents.slice(0,3))r.job='farmer';const old=restore(s);assert.equal(old.community.residents.filter(r=>r.job==='farmer').length,3);add(old,'V4');add(old,'V4');reconcileFarmWorkers(old);assert.equal(new Set(old.community.residents.slice(0,3).map(r=>r.farmSiteId)).size,3);
 old.crops.owned.carrot=true;old.life.sites[0].production.harvest.farm=1;selectCrop(old,'carrot');assert.equal(old.life.sites[0].production.harvest.farm,0);
});

test('搬运工前往分田取货；已装货时不可移动，原始货源随存档保留',()=>{
 const s=fixture(),p=add(s,'V4');p.production.harvest.farm=1;requestTask(s,'farm',p.id);
 for(let i=0;i<8;i++){s.play++;advanceOperations(s,1,api,power);}
 const cargo=s.community.batches.find(b=>b.origin===p.id);assert.ok(cargo);
 const copy=restore(decodeSave(encodePersistentSave(s,'test')).save);assert.equal(copy.community.batches.find(b=>b.id===cargo.id).origin,p.id);
 const r=s.community.residents[0];assert.ok(assignJob(s,r.id,'hauler').ok);let picked=false;
 for(let i=0;i<300;i++){s.play++;advanceOperations(s,1,api,power);if(r.cargo?.id===cargo.id){picked=true;assert.ok(Math.hypot(r.x-p.x,r.z-p.z)<4);break;}}
 assert.ok(picked,r.status);assert.equal(buildCivic(s,'V4',civicSites(s,'V4',0,p.id)[0],{moveId:p.id}).ok,false);
 for(let i=0;i<300&&r.cargo;i++){s.play++;advanceOperations(s,1,api,power);}
 assert.ok(cargo.delivered>0);assert.equal(r.lastDelivery.source,'V4');
});
test('畜栏牧工会依次收取牛奶和羊毛，不会因已有羊而漏掉牛奶',()=>{
 const s=fixture('V7',2),p=add(s,'V7');assert.ok(assignJob(s,'resident-1','rancher').ok);assert.ok(assignJob(s,'resident-2','rancher').ok);
 for(let i=0;i<180;i++){s.play++;advanceFarmSites(s,1);advanceOperations(s,1,api,power);}
 const goods=s.community.batches.filter(b=>b.origin===p.id);assert.ok(goods.some(b=>b.kind==='milk'));assert.ok(goods.some(b=>b.kind==='wool'));
});

test('新增畜栏挤奶不会把原有奶牛改成手动设施或显示永久倒计时',async()=>{
 const {TASKS}=await import('../src/operations.js');const {facilityStatus}=await import('../src/facility-status.js');const s=fixture('V7',2);assert.ok(!Object.values(TASKS).some(t=>t.id==='V8'));
 const status=facilityStatus(s,'V8');assert.ok(!status.fields.some(f=>f.key==='countdown'),JSON.stringify(status));
});
