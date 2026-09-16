import test from 'node:test';
import assert from 'node:assert/strict';
import { restore, buy, advance, redeemEasterEgg } from '../src/game.js';
import { fresh } from './helpers/first-time-game.js';
import { buyGuidance } from '../src/guidance.js';
import { freshNarrative, advanceNarrative, currentNarration, notePurchaseConfirmation, NARRATION, IDLE_LINES, reconcileNarrative } from '../src/narrative.js';
import { advanceEasterEggs, activeEgg, startEgg, eggById } from '../src/easter-eggs.js';
import { incomeSnapshot } from '../src/income.js';
import { canPlace } from '../src/layout.js';
function speak(s,seconds=40,options={}){for(let i=0;i<seconds;i++)advanceNarrative(s,1,options);}
function village(seed=42){const s=fresh(seed);s.money=10000;buyGuidance(s,'info');for(const id of ['T1','V1','V18','V2'])assert.ok(buy(s,id).ok);s.play=200;return s;}
function offer(s){s.play=18*60;s.counts.M5=1;for(let i=0;i<60;i++)advanceEasterEggs(s,1,{quiet:true,random:()=>0});return activeEgg(s);}
test('intro is foreground-only, survives refresh and remains in shop until an actual purchase',()=>{
 const s=fresh();s.money=9;speak(s);assert.equal(currentNarration(s),null);
 s.money=10;speak(s,1);assert.equal(currentNarration(s).id,'rescue');assert.equal(s.narrative.intro,'calling');
 const progress=structuredClone(s.narrative);speak(s,300,{available:false});assert.equal(s.narrative.current.elapsed,progress.current.elapsed);assert.equal(s.narrative.current.index,progress.current.index);
 const loaded=restore(structuredClone(s));assert.deepEqual(currentNarration(loaded),currentNarration(s));
 speak(loaded);assert.equal(loaded.narrative.intro,'captured');speak(loaded,100);assert.equal(currentNarration(loaded),null);
 assert.ok(buyGuidance(loaded,'info').ok);speak(loaded,1);assert.equal(loaded.narrative.intro,'rescued');assert.equal(currentNarration(loaded).id,'rescued');
});
test('narrator saves line position, yields without consuming it, and cannot change production',()=>{
 const s=village(),baseline=structuredClone(s);speak(s,3);const before=structuredClone(s.narrative);
 speak(s,60,{available:false});assert.equal(s.narrative.current.elapsed,before.current.elapsed);assert.equal(s.narrative.current.index,before.current.index);
 const reloaded=restore(structuredClone(s));assert.deepEqual(currentNarration(reloaded),currentNarration(s));
 speak(s,600);advance(s,10);advance(baseline,10);assert.equal(s.money,baseline.money);assert.equal(s.total,baseline.total);
 assert.equal(new Set(s.narrative.seen).size,s.narrative.seen.length);
});
test('confirmation hint counts only completed paid manual confirmations and persists',()=>{
 const s=fresh();for(let i=0;i<10;i++)notePurchaseConfirmation(s,{manual:false,paid:10});
 notePurchaseConfirmation(s,{manual:true,paid:0});notePurchaseConfirmation(s,{manual:true,paid:undefined});
 assert.equal(s.narrative.confirmations,0);for(let i=0;i<9;i++)notePurchaseConfirmation(s,{manual:true,paid:10});
 assert.equal(NARRATION.find(r=>r.id==='confirmations').when(s),false);
 notePurchaseConfirmation(s,{manual:true,paid:10});
 const loaded=restore(s);assert.equal(loaded.narrative.confirmations,10);
 assert.ok(NARRATION.find(r=>r.id==='confirmations').when(loaded));loaded.skipPurchaseConfirmation=true;
 assert.equal(NARRATION.find(r=>r.id==='confirmations').when(loaded),false);
});
test('legacy UI entitlements remain and established jobs are not narrated as new purchases',()=>{
 const s=village();delete s.narrative;s.guidance={version:1,info:true,goals:true,notices:false};s.community.residents[0].job='farmer';s.counts.V4=1;
 const a=restore(s),b=restore(a);assert.ok(a.guidance.counter&&a.guidance.nameplate);assert.equal(a.guidance.notices,false);
 assert.ok(a.narrative.legacy);assert.ok(a.narrative.seen.includes('resident'));assert.ok(a.narrative.seen.includes('work'));assert.deepEqual(a.narrative,b.narrative);
 const freshAgain=restore(fresh());assert.equal(freshAgain.guidance.counter,false);assert.equal(freshAgain.guidance.nameplate,false);assert.equal(freshAgain.narrative.legacy,false);
});
test('stash is eligible only in a quiet foreground world and requires an explicit response',()=>{
 const s=village();for(let i=0;i<1000;i++)advanceEasterEggs(s,1,{quiet:false,random:()=>0});assert.equal(activeEgg(s),null);
 const id=offer(s);assert.equal(id,'private-stash');const e=s.easterEggs.entries[id];
 assert.equal(e.status,'offered');assert.ok(canPlace(s,'V18',e.point));assert.equal(redeemEasterEgg(s,id).ok,false);
 assert.ok(startEgg(s,id));assert.equal(e.status,'seeking');
});
test('stash rewards are exactly-once, survive reload and are separated from recurring income',()=>{
 const s=village(),id=offer(s);startEgg(s,id);const loaded=restore(JSON.parse(JSON.stringify(s)));const money=loaded.money;
 const result=redeemEasterEgg(loaded,id);assert.equal(result.value,30);assert.equal(loaded.money,money+30);assert.equal(loaded.easterEggIncome,30);
 assert.equal(incomeSnapshot(loaded).recent[0].key,'easterEgg');assert.equal(incomeSnapshot(loaded).total,0);
 assert.equal(redeemEasterEgg(loaded,id).ok,false);const reload=restore(loaded);assert.equal(redeemEasterEgg(reload,id).ok,false);
 assert.equal(reload.money,loaded.money);assert.equal(reload.easterEggIncome,30);
 for(let i=0;i<600;i++)advanceEasterEggs(reload,1,{quiet:true,random:()=>0});assert.equal(activeEgg(reload),null);
});
test('building over an unclaimed stash relocates it without losing entitlement or awarding money',()=>{
 const s=village(),id=offer(s);startEgg(s,id);const e=s.easterEggs.entries[id],point=structuredClone(e.point),before=s.money;
 s.placements.T7={...point};s.counts.T7=1;s.layoutRevision++;
 advanceEasterEggs(s,1,{quiet:true,random:()=>0});assert.notDeepEqual(e.point,point);assert.ok(eggById(id).valid(s,e.point));assert.equal(s.money,before);assert.equal(e.status,'seeking');
});
test('a naturally crowded island defers the stash until a reachable site exists',()=>{
 const s=village(26),money=s.money;assert.equal(offer(s),null);
 assert.equal(s.money,money);assert.deepEqual(s.easterEggs.entries,{});
 assert.ok(buy(s,'V1').ok);
 const id=offer(s);assert.equal(id,'private-stash');
 assert.ok(eggById(id).valid(s,s.easterEggs.entries[id].point));
});
test('registry contains unique stable IDs and game comments target mechanics rather than player failures',()=>{
 const all=[...NARRATION,...IDLE_LINES];assert.equal(new Set(all.map(r=>r.id)).size,all.length);
 // Runtime text must remain short enough to fit the subtitle strip; prose cannot become a hidden dialog.
 for(const s of [fresh(),village()])for(const r of all){const lines=typeof r.lines==='function'?r.lines(s):r.lines;for(const line of lines)assert.ok(line.length<=85,`${r.id}: ${line.length}`);}
});
test('muting narration drops stale lessons rather than replaying a backlog on return',()=>{
 const s=village();s.guidance.notices=false;s.counts.M5=1;s.counts.L2=1;speak(s,1);
 assert.equal(currentNarration(s),null);assert.ok(s.narrative.seen.includes('power'));assert.ok(s.narrative.seen.includes('live'));
 s.guidance.notices=true;speak(s,1);assert.equal(currentNarration(s),null);
});
test('pending recommendation is skipped if the player already acted before it was spoken',()=>{
 const s=village();s.narrative.current={id:'friend',index:0,elapsed:0};s.guidance.goals=true;
 speak(s,1);assert.notEqual(currentNarration(s)?.id,'friend');assert.ok(s.narrative.seen.includes('friend'));
});
test('rapid early purchases retire the land, mailbox and villager recommendations before display',()=>{
 const s=village();s.community.residents[0].job='musician';s.counts.L1=1;
 reconcileNarrative(s);
 for(const id of ['pick','land','mail','resident'])assert.ok(s.narrative.seen.includes(id),id);
 for(let i=0;i<300;i++){
   speak(s,1);assert.ok(!['pick','land','mail','resident'].includes(currentNarration(s)?.id));
 }
});
test('an in-flight land recommendation disappears after mailbox purchase, including save restore',()=>{
 const s=fresh();s.money=1000;buyGuidance(s,'info');buy(s,'T1');buy(s,'V1');
 s.narrative.current={id:'land',index:0,elapsed:2};
 assert.ok(buy(s,'V18').ok);
 const restored=restore(JSON.parse(JSON.stringify(s)));
 assert.ok(reconcileNarrative(restored));assert.equal(currentNarration(restored),null);
 assert.ok(restored.narrative.seen.includes('land'));assert.ok(restored.narrative.gap>=3);
});
test('mailbox comment waits for actual income and has no redundant counter recommendation',()=>{
 const s=fresh();s.money=1000;buyGuidance(s,'info');buy(s,'T1');buy(s,'V1');buy(s,'V18');
 assert.equal(NARRATION.find(r=>r.id==='mail').when(s),false);advance(s,1);
 s.narrative.current={id:'mail',index:0,elapsed:0};
 buyGuidance(s,'counter');reconcileNarrative(s);assert.equal(currentNarration(s).index,0);
 for(let i=0;i<15;i++) {speak(s,1);assert.notEqual(currentNarration(s)?.index===1&&currentNarration(s)?.id==='mail',true);}
});
