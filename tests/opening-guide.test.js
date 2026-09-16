import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,restore,buy,mine} from '../src/game.js';
import {buyGuidance,guidanceDescription} from '../src/guidance.js';
import {advanceNarrative,currentNarration,NARRATION,IDLE_LINES,reconcileNarrative} from '../src/narrative.js';
import {chooseOpening,openingChoicePending,manualCuePending,visitManual,narrationAllowed} from '../src/opening-guide.js';
import {openingShop} from '../src/opening-shop.js';
import {features} from '../src/progression-ui.js';
import {assignJob} from '../src/residents.js';

function run(s,seconds,options={}) {
  const log=[];let last='';
  for(let i=0;i<seconds*10;i++){
    s.play+=.1;advanceNarrative(s,.1,options);
    const c=currentNarration(s),key=c?`${c.id}:${c.index}`:'';
    if(key&&key!==last)log.push(c);last=key;
  }
  return log;
}
function village({choice='first',assigned=false}={}) {
  const s=fresh(42);chooseOpening(s,choice);s.money=1e6;buyGuidance(s,'info');
  for(const id of ['T1','V1','V18','V2','T7','L1'])assert.ok(buy(s,id).ok,id);
  if(assigned)assert.ok(assignJob(s,s.community.residents[0].id,'musician').ok);
  return s;
}
test('a fresh world waits for a persistent explicit choice, while mining still works',()=>{
  let s=fresh(42);mine(s,()=>1);s.money=10;
  assert.ok(openingChoicePending(s));assert.equal(openingShop(s).captive,false);
  assert.deepEqual(run(s,60),[]);assert.deepEqual(s.narrative.seen,[]);
  s=restore(s);assert.ok(openingChoicePending(s));
  assert.equal(chooseOpening(s,'unknown'),false);assert.ok(chooseOpening(s,'first'));
  assert.equal(chooseOpening(s,'returning'),false,'double clicks cannot change the choice');
  assert.equal(run(s,.1)[0].id,'rescue');
  const loaded=restore(s);assert.equal(loaded.narrative.openingChoice,'first');assert.equal(currentNarration(loaded).id,'rescue');
  assert.equal(features(s).settings,false,'first-time tools wait for their introduction');
});
test('returning players skip the whole opening without gaining paid items or losing free tools',()=>{
  let s=fresh(42);s.money=10;chooseOpening(s,'returning');
  assert.deepEqual(run(s,60),[]);assert.equal(s.money,10);assert.equal(s.guidance.info,false);
  assert.equal(s.narrative.intro,'skipped');assert.equal(openingShop(s).captive,false);
  assert.doesNotMatch(guidanceDescription(s,'info'),/被商城抓/);
  assert.ok(features(s).settings&&features(s).share);assert.equal(features(s).info,false);
  assert.ok(buyGuidance(s,'info').ok);assert.equal(s.money,0);
  s=restore(s);assert.equal(s.narrative.openingChoice,'returning');assert.ok(features(s).info);
  assert.ok(run(s,60).every(c=>!['rescued','companions','friend','rescue-price'].includes(c.id)));
  assert.equal(s.guidance.goals,false);
  for(const row of NARRATION.filter(r=>['guide','explain'].includes(r.kind)))assert.equal(narrationAllowed(s,row),false,row.id);
});
test('returning players retain character asides, with no beginner job reminders',()=>{
  const s=village({choice:'returning',assigned:true});s.play=250;
  const log=run(s,130,{context:{workingVisible:()=>true,musicPlaying:()=>true}});
  assert.ok(log.some(c=>c.id==='work'),'the villager-purchase aside remains');
  assert.ok(log.every(c=>!['manual','resident','music-work','facility-upgrade'].includes(c.id)));
  assert.equal(s.narrative.manualPrompted,false);
});
test('manual cue follows resident advice, survives fast purchases and already-filled jobs',()=>{
  for(const assigned of [false,true]){
    const s=village({assigned});
    const log=run(s,80);
    assert.equal(log.filter(c=>c.id==='manual').length,1);
    if(!assigned)assert.ok(log.findIndex(c=>c.id==='manual')>log.findIndex(c=>c.id==='resident'));
    assert.ok(manualCuePending(s));
    const loaded=restore(s);assert.ok(manualCuePending(loaded));
    assert.ok(run(loaded,120).every(c=>c.id!=='manual'),'the line is not repeated while the cue stays available');
  }
});
test('the required entry reminder does not expire in a modal or behind other purchases',()=>{
  const s=village({assigned:true});s.narrative.companionsShown=true;
  s.narrative.seen=[...NARRATION,...IDLE_LINES].filter(r=>r.id!=='manual').map(r=>r.id);
  run(s,200,{available:false});assert.equal(s.narrative.manualPrompted,false);
  const loaded=restore(s);assert.equal(run(loaded,.2)[0].id,'manual');assert.ok(manualCuePending(loaded));
});
test('visiting the guide, rather than viewing its reminder or reading to the end, completes it',()=>{
  const s=village();run(s,65);assert.ok(manualCuePending(s));
  assert.ok(visitManual(s));assert.equal(manualCuePending(s),false);assert.equal(visitManual(s),false);
  reconcileNarrative(s);const loaded=restore(s);
  assert.equal(loaded.narrative.manualVisited,true);assert.ok(run(loaded,120).every(c=>c.id!=='manual'));
  const early=village();visitManual(early);assert.ok(run(early,90).every(c=>c.id!=='manual'),'earlier self-discovery also counts');
});
test('published saves do not get a new question or retroactive mandatory reminder',()=>{
  for(const owned of [false,true]){
    const s=fresh(42);s.guidance.info=owned;s.money=22;
    delete s.narrative.openingChoice;delete s.narrative.manualVisited;delete s.narrative.manualPrompted;
    const loaded=restore(s);assert.equal(loaded.narrative.openingChoice,'legacy');assert.equal(openingChoicePending(loaded),false);
    assert.equal(loaded.money,22);assert.equal(loaded.guidance.info,owned);assert.equal(manualCuePending(loaded),false);
    assert.deepEqual(restore(loaded).narrative,loaded.narrative);
  }
  const ancient=fresh();delete ancient.narrative;assert.equal(restore(ancient).narrative.openingChoice,'legacy');
});
