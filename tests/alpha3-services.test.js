import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,restore,advance,rates} from '../src/game.js';
import {ensureCommunity, residentBase} from '../src/residents.js';
import {residentLife,restCycle,advanceResidentLife,advanceLifeBudget,happinessParts,lifeSnapshot} from '../src/villager-life.js';
import {foodState,foodSnapshot,advanceFood,takeMeal,foodParts} from '../src/food-service.js';
import {menuState,setLifeMenu,menuEffects,enableLifeServices} from '../src/life-menu.js';
import {proposedContract,advanceContract} from '../src/service-economy.js';
import {generationCapacity} from '../src/facility-capacity.js';
import {legacyPurchasedGeneration} from '../src/power-compatibility.js';
import {trainingFactor,legacyGoodsFactor} from '../src/training-balance.js';
import {encodePersistentSave,decodeSave} from '../src/save-code.js';
function village(){const s=fresh(0);s.money=1e7;s.counts.T1=1;s.counts.V1=9;s.chunks.overworld=Array.from({length:9},(_,i)=>({x:i%3-1,z:Math.floor(i/3)-1}));Object.assign(s.counts,{V2:6,V11:1,V25:2,V22:2,V23:2});s.placements.V25={x:0,z:0,realm:'overworld'};s.placements.V22={x:2,z:2,realm:'overworld'};s.placements.V23={x:100,z:100,realm:'overworld'};ensureCommunity(s);return s;}
test('R6 meal, drink and activity choices have bounded real costs, distinct benefits and tradeoffs',()=>{
 const s=village(),r=s.community.residents[0];assert.ok(setLifeMenu(s,'drink','ale').ok);assert.ok(setLifeMenu(s,'activity','dance').ok);
 const money=s.money;advanceLifeBudget(s,1);assert.ok(s.money<money);assert.ok(Math.abs(s.life.lastExpense-(money-s.money))<1e-8);
 const effect=menuEffects(s,r);assert.equal(effect.happiness,12);assert.ok(effect.work>1&&effect.work<1.05);assert.equal(effect.rest,3);
 assert.ok(setLifeMenu(s,'drink','berry').ok);advanceLifeBudget(s,1);assert.equal(menuEffects(s,r).happiness,8);
 assert.equal(setLifeMenu(s,'drink','cheat').ok,false);s.counts.V22=1;assert.equal(setLifeMenu(s,'drink','ale').ok,false);
});
test('meal recipe is attached to actual food, switching cannot turn already cooked home meals into roast',()=>{
 const s=village(),r=s.community.residents[0],f=foodState(s);f.people[r.id]={next:1e4,missed:0,lastMeal:null};
 advanceFood(s,100);assert.ok(f.stock>=1);assert.ok(setLifeMenu(s,'meal','roast').ok);
 f.people[r.id].next=f.clock;assert.ok(takeMeal(s,r));assert.equal(menuState(s).people[r.id].serving[0].id,'home');assert.equal(menuEffects(s,r).work,1);
 assert.ok(f.eaten>0);assert.ok(f.spent>0);assert.ok(Math.abs(f.cooked-f.stock-f.eaten-f.discarded)<1e-7);
});
test('food reaches distant residents and shared recreation survives full seats and blocked paths',()=>{
 const s=village();s.placements.V25.x=100;s.placements.V25.z=100;
 for(const r of s.community.residents){r.job='miner';r.x=-100;r.z=-100;residentLife(s,r).worked=restCycle(s,r);}
 for(let i=0;i<100;i++){s.play++;advanceLifeBudget(s,1);for(const r of s.community.residents)advanceResidentLife(s,r,1,{move:()=>false});}
 assert.ok(foodSnapshot(s).fed>0);
 for(const r of s.community.residents){assert.ok(happinessParts(s,r).leisure>0,r.id);assert.equal(r.job,'miner');}
});
test('missed meals need two rounds after a protected start; resuming meals recovers without clearing cargo',()=>{
 const s=village(),r=s.community.residents[0];s.counts.V25=0;r.cargo={batchId:'a',qty:7};
 for(let i=0;i<410;i++)advanceFood(s,1);assert.equal(happinessParts(s,r).hunger,0);
 for(let i=0;i<660;i++)advanceFood(s,1);assert.equal(happinessParts(s,r).hunger,-8);assert.equal(foodParts(s,r).work,.92);
 s.counts.V25=3;for(let i=0;i<500;i++)advanceFood(s,1);assert.equal(happinessParts(s,r).hunger,0);assert.equal(r.cargo.qty,7);
});
test('service quotes use bounded guaranteed income, ignore wallet windfalls and update after 60 foreground seconds',()=>{
 const s=village(),q=proposedContract(s);s.money=1e50;s.rate=1e50;assert.deepEqual(proposedContract(s),q);
 advanceContract(s,1);const held={...s.life.serviceContract.quote};s.counts.V12=6;s.counts.V13=4;s.research.completed.modern=true;
 advanceContract(s,58);assert.deepEqual(s.life.serviceContract.quote,held);advanceContract(s,1);
 const next=s.life.serviceContract.quote;assert.equal(next.era,'modern');assert.ok(next.food>=next.floor&&next.food<=next.ceiling);
});
test('zero funds suspend paid choices without debt or unearned benefit; free defaults remain selectable',()=>{
 const s=village();setLifeMenu(s,'drink','ale');setLifeMenu(s,'activity','dance');s.money=0;
 advanceLifeBudget(s,1);assert.equal(s.money,0);assert.equal(menuState(s).selected.drink,'water');assert.equal(menuState(s).selected.activity,'free');assert.equal(menuEffects(s,s.community.residents[0]).happiness,0);
 const before=structuredClone(s.life);advance(s,600,{offline:true});assert.deepEqual(s.life,before);
});
test('old welfare keeps its old tariff until an explicit switch, which is saved exactly once',()=>{
 const s=village();s.version=9;s.life.version=2;delete s.life.serviceMode;s.life.welfare='simple';
 const old=restore(s),before=old.money;assert.equal(old.life.serviceMode,'legacy');advanceLifeBudget(old,1);assert.ok(Math.abs(before-old.money-6/60)<1e-7);assert.equal(foodSnapshot(old).cooked,0);
 enableLifeServices(old);assert.equal(old.life.welfare,'off');advanceLifeBudget(old,1);assert.ok(foodSnapshot(old).cooked>0);
 const copy=restore(decodeSave(encodePersistentSave(old,'alpha3')).save);assert.equal(copy.life.serviceMode,'current');assert.deepEqual(copy.life.food,old.life.food);
});
test('paid menu selection, stock recipes, contract and remaining long rest survive compact and JSON saves',()=>{
 const s=village();setLifeMenu(s,'meal','mushroom');setLifeMenu(s,'drink','ale');advanceLifeBudget(s,20);
 const r=s.community.residents[0],a=residentLife(s,r);a.phase='rest';a.remaining=24;
 for(const raw of [JSON.parse(JSON.stringify(s)),decodeSave(encodePersistentSave(s,'alpha3')).save]){
  const loaded=restore(raw);assert.equal(loaded.life.menuState.selected.meal,'mushroom');assert.equal(loaded.life.residents[r.id].remaining,24);assert.equal(loaded.life.food.spent,s.life.food.spent);assert.deepEqual(loaded.life.serviceContract,s.life.serviceContract);
 }
});
test('legacy power capacity and book benefits survive migration and repeated saves; new upgrades only add new increments',()=>{
 const s=village();Object.assign(s.counts,{M6:7,M15:3,V12:4,V13:2});s.upgrades.levels={'torch-bank':3,'torch-core':1,'torch-module':1};
 s.version=9;delete s.trainingBalance;delete s.grid.powerBalanceRevision;delete s.grid.powerCompensation;
 const restored=restore(s),again=restore(JSON.parse(JSON.stringify(restored)));
 for(const id of ['M6','M15']){assert.ok(Math.abs(generationCapacity(restored,id)-legacyPurchasedGeneration(s,id))<1e-7);assert.equal(generationCapacity(again,id),generationCapacity(restored,id));}
 assert.ok(Math.abs(trainingFactor(restored)-1.55**4*2**2)<1e-9);assert.equal(legacyGoodsFactor(restored),2.2);
 const capacity=generationCapacity(restored,'M15');restored.counts.M15++;assert.equal(generationCapacity(restored,'M15')-capacity,60);
 const base=trainingFactor(restored);restored.counts.V12++;assert.ok(trainingFactor(restored)-base<.2);
 restored.facilityStorage.M15=true;assert.equal(generationCapacity(restored,'M15'),0);assert.equal(again.money,s.money);
});
test('new worlds and schema-10 missing credits never receive legacy multipliers',()=>{
 const s=village();s.counts.V12=4;s.counts.V13=2;s.counts.M15=3;delete s.trainingBalance;
 const copy=restore(s);assert.equal(trainingFactor(copy),1.4*1.16);assert.equal(generationCapacity(copy,'M15'),180);assert.equal(legacyGoodsFactor(copy),1);
 assert.ok(Number.isFinite(lifeSnapshot(copy).perMinute));
});
