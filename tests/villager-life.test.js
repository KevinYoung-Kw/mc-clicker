import test from 'node:test';
import assert from 'node:assert/strict';
import {freshLife,residentLife,isResting,restCycle,advanceResidentLife,advanceLifeBudget,setWelfare,lifeWorkFactor,cartFactor,restoreLife} from '../src/villager-life.js';
const setup=()=>{const r={id:'r1',job:'hauler',x:0,z:0,progress:2,cargo:null};return {r,s:{life:freshLife(),play:200,money:100,total:100,counts:{},placements:{},community:{residents:[r],tasks:{}},housing:{assignments:{}}}};};
test('休息保留岗位/生产进度，货批交接完成之后才开始',()=>{
 const {s,r}=setup(),a=residentLife(s,r);a.worked=restCycle(s,r);r.cargo={id:3,qty:12};
 assert.equal(advanceResidentLife(s,r,1),false);assert.equal(a.phase,'work');
 r.cargo=null;assert.equal(advanceResidentLife(s,r,1),true);assert.equal(a.phase,'rest');
 assert.equal(r.job,'hauler');assert.equal(r.progress,2);
 for(let i=0;i<19;i++)advanceResidentLife(s,r,1);
 assert.equal(a.phase,'work');assert.equal(s.life.returns,1);assert.equal(r.job,'hauler');
});
test('没有接管正在完成的收割；普通空闲不会疲劳',()=>{
 const {s,r}=setup(),a=residentLife(s,r);a.worked=restCycle(s,r);s.community.tasks.farm={work:2,owners:{r1:2}};
 assert.equal(advanceResidentLife(s,r,1),false);s.community.tasks.farm.work=0;r.job='idle';
 advanceResidentLife(s,r,10);assert.equal(a.phase,'work');assert.ok(a.worked<restCycle(s,r));
});
test('堵路/行程超时就近休息，仍享受全村娱乐',()=>{
 const {s,r}=setup();s.counts.V22=1;s.placements.V22={x:1,z:1};const a=residentLife(s,r);a.worked=restCycle(s,r);
 for(let i=0;i<20;i++){s.play++;advanceResidentLife(s,r,1,{move:()=>null});}
 assert.equal(a.phase,'work');assert.equal(a.visited.V22,s.play);assert.equal(s.life.visits,1);
});
test('同一服务点有接待名额，完成一次访问后获得有限工作增益',()=>{
 const {s,r}=setup();s.counts.V22=1;s.placements.V22={x:1,z:1};const a=residentLife(s,r);a.worked=restCycle(s,r);
 for(let i=0;i<20;i++)advanceResidentLife(s,r,1,{move:()=>true});
 assert.equal(a.visited.V22,s.play);assert.ok(s.life.visits>=1);assert.ok(lifeWorkFactor(s,r)<=1.25);
});
test('福利主动开启，逐步扣费；不减累计收入，余额不足自动停止',()=>{
 const {s}=setup();assert.equal(setWelfare(s,'simple').ok,false);s.counts.V22=1;
 assert.equal(setWelfare(s,'simple').ok,true);advanceLifeBudget(s,30);assert.equal(s.money,99.875);assert.equal(s.total,100);assert.equal(s.life.spent,.125);
 s.money=0;assert.match(advanceLifeBudget(s,1),/余额不足/);assert.equal(s.life.welfare,'off');assert.equal(s.money,0);
});
test('手推车只增加有限搬运工的下一批携带量，不改途中货物',()=>{
 const {s,r}=setup();s.counts.V24=1;s.community.residents.push({id:'r2',job:'hauler'},{id:'r3',job:'hauler'},{id:'r4',job:'stagehand'});
 r.cargo={qty:12};assert.equal(cartFactor(s,r),1.5);assert.equal(r.cargo.qty,12);
 assert.equal(cartFactor(s,s.community.residents[2]),1);assert.equal(cartFactor(s,s.community.residents[3]),1);
});
test('旧档没有生活字段不会补收福利；新档休息剩余与已享服务保留',()=>{
 const {s,r}=setup();restoreLife(s,{});assert.equal(s.life.welfare,'off');assert.equal(s.life.spent,0);
 const a=residentLife(s,r);a.phase='rest';a.remaining=8;a.visited.L1=180;s.life.spent=5;
 const old=structuredClone(s);restoreLife(s,old);assert.equal(s.life.residents.r1.remaining,8);assert.equal(s.life.residents.r1.visited.L1,180);assert.equal(s.life.spent,5);
});

test('a full village staggers rest and keeps one of each shared job on duty',()=>{
 const s={counts:{V2:24},money:0,play:0,life:freshLife(),community:{residents:Array.from({length:24},(_,i)=>({id:'r'+i,job:i%2?'hauler':'miner',path:[],progress:0,x:0,z:0})),tasks:{}},housing:{assignments:{}}};
 for(const r of s.community.residents)residentLife(s,r).worked=restCycle(s,r);
 let maximum=0;
 for(let t=0;t<900;t++){
  s.play=t;for(const r of s.community.residents)advanceResidentLife(s,r,1);
  const resting=s.community.residents.filter(r=>isResting(s,r));maximum=Math.max(maximum,resting.length);
  assert.ok(resting.length<=6);
  for(const job of ['hauler','miner'])assert.ok(s.community.residents.some(r=>r.job===job&&!isResting(s,r)));
 }
 assert.ok(maximum>0);assert.ok(s.community.residents.every(r=>s.life.residents[r.id].breaks>0));
});
