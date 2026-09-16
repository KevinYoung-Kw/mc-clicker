import test from 'node:test';
import assert from 'node:assert/strict';
import { restore } from '../src/game.js';
import { fresh } from './helpers/first-time-game.js';
import {advanceNarrative,currentNarration,setNarrationEnabled} from '../src/narrative.js';
import {noticeFace} from '../src/notice-face.js';
function run(s,seconds,options={}){const log=[],flights=[];let last='';for(let i=0;i<seconds*10;i++){s.play+=.1;const result=advanceNarrative(s,.1,options);if(result.companions)flights.push(s.play);const c=currentNarration(s);if(c?.id!==last&&c)log.push({id:c.id,at:s.play});last=c?.id;}return {log,flights};}
test('rescue thanks, one short friends introduction, three-tool delivery, then next purchase',()=>{
 const s=fresh();s.guidance.info=true;s.money=0;
 run(s,3.6,{available:false});const {log,flights}=run(s,20);
 assert.deepEqual(log.slice(0,3).map(r=>r.id),['rescued','companions','friend']);
 assert.ok(log[1].at-log[0].at>=4.6&&log[1].at-log[0].at<5.1,'short thanks, then a 1.5-second beat');assert.ok(log[2].at<19);
 assert.equal(flights.length,1);assert.ok(flights[0]>log[1].at&&flights[0]<log[2].at);
 assert.equal(s.money,0);assert.equal(s.guidance.counter,false);
 assert.equal(run(restore(s),30).flights.length,0);
});
test('unheard introduction waits through a modal or background; a mid-line reload continues once',()=>{
 const s=fresh();s.guidance.info=true;s.narrative.seen=['rescued'];
 run(s,1);assert.equal(currentNarration(s).id,'companions');
 const elapsed=s.narrative.current.elapsed;run(s,12,{available:false});assert.equal(s.narrative.current.elapsed,elapsed);
 const loaded=restore(s);assert.equal(loaded.narrative.companionsShown,false);
 assert.equal(run(loaded,15).flights.length,1);assert.equal(run(restore(loaded),15).flights.length,0);
});
test('published saves do not acquire a retroactive opening, new saves retain their introduction',()=>{
 const old=fresh();old.guidance.info=true;delete old.narrative.companionsShown;delete old.narrative.muteReactionSeen;
 old.narrative.seen=['rescued','friend'];const loaded=restore(old);
 assert.equal(loaded.narrative.companionsShown,true);assert.equal(run(loaded,30).flights.length,0);
 const freshOld=fresh();delete freshOld.narrative.companionsShown;
 const newPlayer=restore(freshOld);newPlayer.guidance.info=true;assert.equal(run(newPlayer,25).flights.length,1);
});
test('only the first actual mute reacts; settings persist and do not change economy',()=>{
 const s=fresh();s.guidance.info=true;s.money=123;s.rate=9;run(s,1);
 assert.equal(setNarrationEnabled(s,true),false);assert.equal(setNarrationEnabled(s,false),true);
 assert.equal(s.narrative.current,null);assert.equal(s.narrative.companionsShown,true);
 assert.equal(run(s,30).log.length,0);assert.equal(s.money,123);assert.equal(s.rate,9);
 const loaded=restore(s);assert.equal(loaded.guidance.notices,false);assert.equal(loaded.narrative.muteReactionSeen,true);
 assert.equal(setNarrationEnabled(loaded,true),false);assert.equal(setNarrationEnabled(loaded,false),false);
 assert.match(noticeFace('muffled','date-bow'),/notice-gag/);assert.match(noticeFace('muffled','date-bow'),/date-bow/);
});

test('new entry gate survives reload, while pre-delivery-version saves retain their old tools',()=>{
 const s=fresh();assert.equal(s.narrative.companionsShown,false);assert.equal(restore(s).narrative.companionsShown,false);
 s.guidance.info=true;assert.equal(restore(s).narrative.companionsShown,false,'purchase alone does not reveal tools');
 for(const info of [false,true]){const old=fresh();old.guidance.info=info;delete old.narrative.companionsVersion;assert.equal(restore(old).narrative.companionsShown,true);}
 s.narrative.companionsShown=true;const recovered=restore(s);assert.equal(recovered.narrative.companionsShown,true);assert.equal(run(recovered,10).flights.length,0);
});
