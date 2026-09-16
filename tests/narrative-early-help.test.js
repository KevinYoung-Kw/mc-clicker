import test from 'node:test';
import assert from 'node:assert/strict';
import { restore, advance, buy } from '../src/game.js';
import { fresh } from './helpers/first-time-game.js';
import { NARRATION, IDLE_LINES, advanceNarrative, currentNarration, reconcileNarrative } from '../src/narrative.js';
import { recordNarrativeAction, rushing } from '../src/narrative-behavior.js';
import { NarrativeAbsence } from '../src/narrative-absence.js';

const ids=[...NARRATION,...IDLE_LINES].map(r=>r.id);
function state(keep=[]){const s=fresh();s.guidance.info=true;s.guidance.notices=true;s.narrative.seen=ids.filter(id=>!keep.includes(id));return s;}
function step(s,seconds,options={}){
 const lines=[];let last='';
 for(let i=0;i<seconds*5;i++){s.play+=.2;advanceNarrative(s,.2,options);const c=currentNarration(s),key=c?`${c.id}:${c.index}`:'';if(c&&key!==last)lines.push({...c,at:s.play});last=key;}
 return lines;
}
function unlock(s,id){s.counts[id]=1;recordNarrativeAction(s,'purchase',{id});}
function leave(s,seconds){const a=new NarrativeAbsence();a.update(true,0,s);a.update(false,1000,s);return {a,queued:a.update(true,1000+seconds*1000,s)};}

test('a broad purchase burst during real narration reacts once and still explains logistics',()=>{
 const s=state(['rush','haul-use']);s.play=100;
 for(const id of ['T1','V1','V18','T2','M4','M5']){
  s.narrative.current={id:'power',index:0,elapsed:0};s.narrative.behavior.lastNarrationAt=s.play;unlock(s,id);s.play+=2;
 }
 assert.equal(rushing(s),true);s.narrative.current=null;s.counts.M1=1;
 const lines=step(s,50);
 assert.equal(lines.filter(r=>r.id==='rush').length,1);
 assert.equal(lines.filter(r=>r.id==='haul-use').length,2);
 assert.equal(rushing(s),false);
});
test('small batches, unread pending dialogue, duplicate levels and old rush state do not imply experience',()=>{
 const s=state(['rush']);s.play=100;
 for(const id of ['T2','T3','T4'])unlock(s,id);
 assert.equal(rushing(s),false);
 for(const id of ['M4','M5','M6'])unlock(s,id);
 assert.equal(rushing(s),false,'never actually heard a line');
 for(let i=0;i<10;i++){s.counts.M6++;recordNarrativeAction(s,'purchase',{id:'M6'});}
 assert.equal(rushing(s),false);
 s.narrative.behavior.version=1;s.narrative.behavior.rushUntil=140;
 assert.equal(rushing(restore(s)),false);
});
test('an unusually early milestone also requires evidence of knowing work or connections',()=>{
 const ordinary=state(['rush']);ordinary.play=60;
 for(const id of ['T1','V1','V18','V2','M5'])unlock(ordinary,id);
 assert.equal(rushing(ordinary),false);
 const fast=state(['rush']);fast.play=24;fast.grid.learnedConnection=true;
 for(const id of ['T1','V1','V18','V2','M5'])unlock(fast,id);
 assert.equal(rushing(fast),true);
 const onTime=state(['rush']);onTime.play=153;onTime.grid.learnedConnection=true;
 for(const id of ['T1','V1','V18','V2','M5'])unlock(onTime,id);
 assert.equal(rushing(onTime),false);
 const held=state(['rush']);held.play=160;held.grid.learnedConnection=true;
 for(const id of ['T1','V1','V18','V2','M8'])unlock(held,id);
 assert.equal(rushing(held),false,'ordinary continuous hold is not a fast milestone');
});
test('newer jokes cannot evict core help and help obeys the shared three-per-minute budget',()=>{
 const s=state(['haul-use','power-use','mail-income','land-use','bench']);
 s.counts={M4:1,M1:1,M5:1,V18:1,V1:1};s.postalIncome=1;
 reconcileNarrative(s);s.play=2;s.counts.T7=1;s.counts.V2=1;
 const lines=step(s,62),starts=lines.filter(r=>r.index===0);
 assert.ok(starts.some(r=>r.id==='haul-use'));
 assert.ok(starts.some(r=>r.id==='power-use'));
 for(const r of starts)assert.ok(starts.filter(o=>o.at>r.at-60&&o.at<=r.at).length<=3);
 assert.ok(!s.narrative.seen.includes('land-use')||s.narrative.history.some(r=>r.id==='land-use'));
});
test('fulfilled work cancels the corresponding instruction even partway through a line',()=>{
 for(const [id,counts,complete] of [
  ['pick-use',{T1:1},s=>s.counts.V1=1],
  ['power-use',{M5:1},s=>s.grid.learnedConnection=true],
  ['farm-work',{V4:1},s=>s.grid.automation.farm=1],
  ['haul-use',{M4:1,M1:1},s=>s.community.residents=[{job:'hauler'}]],
  ['music-work',{L1:1,V2:1},s=>s.community.residents=[{job:'musician'}]],
 ]){const s=state([id]);Object.assign(s.counts,counts);step(s,1);assert.equal(currentNarration(s)?.id,id);complete(s);step(s,.2);assert.equal(currentNarration(s),null);assert.ok(s.narrative.seen.includes(id));}
});
test('return from 12 seconds away waits for a quiet moment, plays once, and cannot mutate money',()=>{
 const s=state(['foreground-return']);s.rate=1;s.money=123;const play=s.play;
 const {a,queued}=leave(s,15);assert.ok(queued);assert.equal(s.play,play);assert.equal(s.money,123);
 assert.equal(step(s,2).length,0);
 const lines=step(s,38);assert.deepEqual(lines.map(r=>r.index),[0,1,2,3]);
 assert.equal(s.money,123);assert.equal(s.total,0);
 assert.ok(s.narrative.seen.includes('foreground-return'));
 a.update(false,50000,s);assert.equal(a.update(true,80000,s),false);
});
test('repeated visibility signals do not reset the absence; idle focus and refresh are not absences',()=>{
 const s=state(['foreground-return']);s.rate=1;const a=new NarrativeAbsence();
 assert.equal(a.update(true,0,s),false);a.update(false,1000,s);a.update(false,10000,s);
 assert.equal(a.update(true,14000,s),true);
 assert.equal(a.update(true,15000,s),false);
 const loaded=restore(s);assert.equal(loaded.narrative.returnAt,null);assert.equal(loaded.narrative.eligibleAt['foreground-return'],undefined);
 assert.equal(step(loaded,10).length,0);
 const startup=new NarrativeAbsence();startup.update(false,0,loaded);assert.equal(startup.update(true,30000,loaded),false);
 const switched=new NarrativeAbsence();switched.update(true,0,s);switched.update(false,1,s);assert.equal(switched.update(true,30000,loaded),false);
});
test('brief absences, no automatic income, locked or disabled narrator do not explain missing earnings',()=>{
 for(const setup of [s=>{},s=>s.guidance.info=false,s=>s.guidance.notices=false]){const s=state(['foreground-return']);setup(s);assert.equal(leave(s,20).queued,false);}
 const s=state(['foreground-return']);s.rate=1;assert.equal(leave(s,10).queued,false);
});
test('return anecdotes yield to receipts and help, expire without a backlog, and allow a later real return',()=>{
 const s=state(['foreground-return','power-use']);s.rate=1;s.counts.M5=1;leave(s,15);
 const hidden=step(s,5,{available:false});assert.equal(hidden.length,0);
 const lines=step(s,45);assert.equal(lines[0].id,'power-use');assert.ok(lines.some(r=>r.id==='foreground-return'));
 const busy=state(['foreground-return']);busy.rate=1;leave(busy,15);step(busy,65,{available:false});
 assert.equal(busy.narrative.returnAt,null);assert.equal(step(busy,10).length,0);
 assert.equal(leave(busy,15).queued,true);assert.ok(step(busy,5).some(r=>r.id==='foreground-return'));
});
test('old saves do not receive a queue of new unlock tutorials, but new purchases can trigger them',()=>{
 const s=state([]);s.money=1e6;for(const id of ['T1','V1','V18','V2'])buy(s,id);
 s.narrative.cadenceVersion=2;s.narrative.seen=['rescued','friend'];s.postalIncome=5;
 const loaded=restore(s);for(const id of ['pick-use','land-use','mail-income'])assert.ok(loaded.narrative.seen.includes(id));
 assert.equal(loaded.money,s.money);assert.equal(loaded.counts.V18,1);assert.equal(loaded.narrative.cadenceVersion,6);
 assert.ok(!loaded.narrative.seen.includes('power-use'));loaded.counts.M5=1;
 loaded.narrative.seen=ids.filter(id=>id!=='power-use');assert.equal(step(loaded,1)[0].id,'power-use');
 const modern=state(['power-use']);modern.counts.M5=1;step(modern,1);
 const continuing=restore(modern);assert.equal(continuing.narrative.current.id,'power-use');assert.ok(!continuing.narrative.seen.includes('power-use'));
});
test('foreground money still advances only through the existing simulation',()=>{
 const s=state(['foreground-return']);s.money=1000;buy(s,'T1');buy(s,'V1');buy(s,'V18');advance(s,2);
 const money=s.money;assert.ok(s.rate>0);leave(s,60);advance(s,60,{offline:true});assert.equal(s.money,money);
 advance(s,10);assert.equal(s.money-money,10);
});
