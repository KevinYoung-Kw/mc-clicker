import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,buy,advance,restore,action} from '../src/game.js';
import {assignJob,ensureCommunity,residentBase} from '../src/residents.js';
import {prepareResearchFor} from '../scripts/research-fixture.mjs';
import {freshResearch,startResearch,researchStatus,researchSpeed,pauseResearch} from '../src/research.js';
import {residentLife,restCycle,setWelfare,lifeWorkFactor,isResting} from '../src/villager-life.js';
import {encodePersistentSave,decodeSave} from '../src/save-code.js';
import {enqueueBatch} from '../src/operations.js';
function village(){
 const s=fresh(0);s.money=1e7;prepareResearchFor(s,'M9');
 // Keep legitimately purchased preconditions, test new research independently.
 s.research=freshResearch();startResearch(s,"basic-power");s.research.milestones.villageSale=true;
 s.guidance.notices=false;return s;
}
test('instant mainline research pays once, changes real purchase requirements, and never needs claiming',()=>{
 const s=village(),balance=s.money;
 assert.ok(startResearch(s,'industrial').ok);
 assert.equal(s.money,balance-12000);assert.equal(s.research.completed.industrial,true);
 assert.equal(startResearch(s,'industrial').ok,false);assert.equal(s.money,balance-12000);
});
test('paid optional project pauses, switches, resumes, persists and completes in the foreground only',()=>{
 const s=village();s.counts.M4=1;
 const before=s.money;assert.ok(startResearch(s,'cargo-tools').ok);assert.equal(s.money,before-600);
 advance(s,3);const progress=s.research.projects['cargo-tools'].progress;assert.ok(progress>0&&progress<20);
 assert.ok(startResearch(s,'community-life').ok);assert.equal(s.research.projects['cargo-tools'].progress,progress);
 advance(s,2);pauseResearch(s);const checkpoint=structuredClone(s.research);
 advance(s,100);assert.deepEqual(s.research,checkpoint);
 let r=restore(decodeSave(encodePersistentSave(s,'test')).save,1e12);
 assert.deepEqual(r.research,s.research);const everything=JSON.stringify(r);
 advance(r,600,{offline:true});assert.equal(JSON.stringify(r),everything);
 const funds=r.money;assert.ok(startResearch(r,'cargo-tools').ok);assert.equal(r.money,funds);
 advance(r,30);assert.equal(r.research.completed['cargo-tools'],true);assert.equal(r.research.active,null);
 assert.equal(r.research.completed['community-life'],undefined);
});
test('researcher contributes only after arrival; resting retains assignment without contributing acceleration',()=>{
 const s=village();s.counts.M4=1;ensureCommunity(s);
 const r=s.community.residents.find(p=>!p.cargo);assert.ok(assignJob(s,r.id,'researcher').ok);
 assert.equal(researchSpeed(s).multiplier,1);startResearch(s,'cargo-tools');
 let reached=false;
 for(let i=0;i<300;i++){advance(s,.1);if(researchSpeed(s).researcherId===r.id){reached=true;break;}}
 assert.ok(reached,r.status);assert.equal(researchSpeed(s).multiplier,1.25);
 const life=residentLife(s,r);life.worked=restCycle(s,r);advance(s,.1);
 assert.equal(isResting(s,r),true);assert.equal(researchSpeed(s).multiplier,1);assert.equal(r.job,'researcher');
});
test('rest never deletes in-flight cargo or base income; delivery remains paid by existing sale path',()=>{
 const s=village(),r=s.community.residents[0];assignJob(s,r.id,'hauler');
 enqueueBatch(s,'V4','小麦',40,4,{[r.id]:1});
 for(let i=0;i<300&&!r.cargo;i++)advance(s,.1);assert.ok(r.cargo);
 const cargo={...r.cargo},a=residentLife(s,r);a.worked=restCycle(s,r);
 const before=r.baseEarned;advance(s,.1);
 assert.equal(a.phase,'work');assert.ok(r.cargo||r.delivered>0);
 if(r.cargo)assert.equal(r.cargo.batchId,cargo.batchId);
 assert.ok(Math.abs(r.baseEarned-before-residentBase(s,r)*.1)<1e-6);
 const loaded=restore(decodeSave(encodePersistentSave(s,'test')).save);
 assert.equal(loaded.community.residents[0].job,'hauler');
 // Rest and route reconstruction retain the underlying goods rather than awarding a second receipt.
 assert.equal(loaded.community.shipped,s.community.shipped);
 assert.equal(loaded.total,s.total);
});
test('welfare changes only foreground expense and human work, never postal/base or automated ownership',()=>{
 const s=village();s.counts.V22=1;s.counts.V23=1;
 const person=s.community.residents[0],base=residentBase(s,person),priorFactor=lifeWorkFactor(s,person);
 assert.ok(setWelfare(s,'simple').ok);assert.ok(lifeWorkFactor(s,person)>priorFactor);assert.equal(residentBase(s,person),base);
 const spent=s.life.spent;advance(s,1);assert.ok(s.life.spent>spent);assert.equal(s.life.welfare,'simple');
 s.money=0;advance(s,.1);assert.equal(s.life.welfare,'off');assert.ok(s.money>=0);
});
test('schema-7 worlds preserve earned technology and book levels; schema-8 starts do not receive that migration',()=>{
 const old=fresh(0);old.version=7;delete old.research;delete old.life;old.counts.M9=1;old.counts.V12=6;old.counts.V13=3;
 const r=restore(old);assert.equal(r.counts.V12,6);assert.equal(r.counts.V13,3);assert.ok(r.research.completed.industrial);assert.ok(r.research.completed.modern);assert.equal(r.life.welfare,'off');
 const current={...old,version:8};assert.deepEqual(restore(current).research.completed,{});
});
