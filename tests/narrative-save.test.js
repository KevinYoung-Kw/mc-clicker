import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh, restore } from '../src/game.js';
import { chooseOpening } from '../src/opening-guide.js';
import { NARRATION, IDLE_LINES, advanceNarrative, currentNarration } from '../src/narrative.js';
function state(choice='first') {
 const s=fresh(42);chooseOpening(s,choice);s.guidance.info=true;s.guidance.notices=true;s.narrative.companionsShown=true;
 s.narrative.seen=[...NARRATION,...IDLE_LINES].map(r=>r.id).filter(id=>id!=='save-transfer');return s;
}
function run(s,seconds,options={}) {
 const log=[];let last='';
 for(let i=0;i<seconds;i++){s.play++;advanceNarrative(s,1,options);const c=currentNarration(s),key=c?`${c.id}:${c.index}`:'';if(c&&key!==last)log.push(c);last=key;}
 return log;
}
test('save reminder waits until eight minutes and a quiet interval, then speaks once for first and returning players',()=>{
 for(const choice of ['first','returning']){
  const s=state(choice);assert.equal(run(s,479).length,0);assert.equal(run(s,12).length,0);
  assert.deepEqual(run(s,90).map(c=>c.id),['save-transfer','save-transfer','save-transfer']);
  assert.ok(s.narrative.seen.includes('save-transfer'));assert.equal(run(restore(s),180).length,0);
 }
});
test('the reminder survives a long busy menu, waits for free tools and respects paused narration',()=>{
 const s=state();s.play=600;s.narrative.companionsShown=false;assert.equal(run(s,30).length,0);
 s.narrative.companionsShown=true;assert.equal(run(s,180,{available:false}).length,0);
 assert.equal(run(s,11).length,0);assert.equal(run(s,90)[0]?.id,'save-transfer');
 const muted=state();muted.play=600;muted.guidance.notices=false;assert.equal(run(muted,180).length,0);
});

test('building reminder waits for two homes and the middle game, and does not repeat',()=>{
 const s=state();s.narrative.seen=s.narrative.seen.filter(id=>id!=='building-editing');s.narrative.seen.push('save-transfer');
 s.housing.homes=[{id:'home:1',type:'oak',realm:'overworld',x:3,z:0,rotation:0}];
 assert.equal(run(s,700).length,0);
 s.housing.homes.push({id:'home:2',type:'oak',realm:'overworld',x:5,z:0,rotation:0});
 assert.deepEqual(run(s,90).map(c=>c.id),['building-editing','building-editing']);
 assert.equal(run(s,300).length,0);assert.ok(s.narrative.seen.includes('building-editing'));
});
