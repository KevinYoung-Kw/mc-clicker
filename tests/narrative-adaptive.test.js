import test from 'node:test';
import assert from 'node:assert/strict';
import { buy, restore } from '../src/game.js';
import { fresh } from './helpers/first-time-game.js';
import { buyGuidance } from '../src/guidance.js';
import { assignJob } from '../src/residents.js';
import { advanceNarrative, currentNarration, reconcileNarrative, NARRATION, IDLE_LINES } from '../src/narrative.js';
import { recordNarrativeAction, rushing } from '../src/narrative-behavior.js';

function step(s,seconds,options={}){
 const log=[];let key='';
 for(let t=0;t<seconds;t+=.2){s.play+=.2;advanceNarrative(s,.2,options);const c=currentNarration(s),next=c?`${c.id}:${c.index}`:'';
  if(c&&next!==key)log.push({...c,at:s.play});key=next;}
 return log;
}
function info(){const s=fresh();s.money=1e6;buyGuidance(s,'info');recordNarrativeAction(s,'purchase',{id:'feature:info'});return s;}
function focus(s,ids){s.narrative.companionsShown=!ids.includes('companions');s.narrative.seen=[...NARRATION,...IDLE_LINES].filter(r=>!ids.includes(r.id)).map(r=>r.id);}
function purchase(s,id){assert.ok(buy(s,id).ok);recordNarrativeAction(s,'purchase',{id});}

test('opening guides follow the receipt within seconds, even with an old 90-second cooldown and a full-screen shop',()=>{
 const s=info();s.money=0;s.narrative.gap=90;
 step(s,3.6,{available:false});
 const log=step(s,30,{canPresent:r=>r?.shop===true});
 assert.ok(log.find(r=>r.id==='rescued').at<4.1);
 assert.ok(log.find(r=>r.id==='friend').at<19,'name the two free tools in one sentence, then continue without waiting for money');
 const friend=log.filter(r=>r.id==='friend');assert.deepEqual(friend.map(r=>r.index),[0,1]);assert.ok(friend[1].at-friend[0].at>=6&&friend[1].at-friend[0].at<7,'read the sentence, then rest before the next');
 assert.equal(step(s,100).filter(r=>r.id==='friend').length,0,'no repeated nagging while saving');
});
test('a cancelled guide yields to the player’s completed action instead of finishing its obsolete second sentence',()=>{
 const s=info();focus(s,['friend','goals']);step(s,.2);assert.equal(currentNarration(s).id,'friend');
 buyGuidance(s,'goals');recordNarrativeAction(s,'purchase',{id:'feature:goals'});
 const log=step(s,15);assert.ok(log.every(r=>r.id!=='friend'));assert.ok(log.some(r=>r.id==='goals'));
});
test('three normal opening purchases keep useful introductions instead of labelling a veteran',()=>{
 const s=info();step(s,1);purchase(s,'T1');step(s,2);purchase(s,'V1');step(s,2);purchase(s,'V18');s.postalIncome=1;
 assert.equal(rushing(s),false);step(s,3.6,{available:false});const log=step(s,18);
 assert.equal(log.filter(r=>r.id==='rush').length,0);
 assert.ok(log.some(r=>r.id==='friend'));
 const loaded=restore(s);assert.ok(!loaded.narrative.seen.includes('rush'));
 step(loaded,45);assert.equal(rushing(loaded),false);
 loaded.counts.N1=1;const scene=step(loaded,4,{context:{realm:()=> 'nether'}});assert.ok(scene.some(r=>r.id==='nether'));
});
test('repeat upgrades and spaced purchases do not label an ordinary player as rushing',()=>{
 const s=info();for(let i=0;i<5;i++){recordNarrativeAction(s,'purchase',{id:'V1'});step(s,2);}assert.equal(rushing(s),false);
 for(const id of ['T1','V18','V2']){step(s,25);recordNarrativeAction(s,'purchase',{id});}assert.equal(rushing(s),false);
});
test('the persistent miner gets one useful, affordable suggestion that is cancelled by buying',()=>{
 const s=info();focus(s,['grind']);s.play=50;s.clicks=40;
 const context={affordableTarget:()=>({id:'T1',name:'木镐'})};step(s,.2,{context});
 assert.equal(currentNarration(s).id,'grind');const log=step(s,5,{context});assert.ok(log.some(r=>r.text.includes('木镐的钱已经够了')));
 purchase(s,'T1');assert.ok(step(s,10,{context}).every(r=>r.id!=='grind'));
 const broke=info();focus(broke,['grind']);broke.play=50;broke.clicks=40;
 assert.equal(step(broke,5,{context:{affordableTarget:()=>null}}).length,0);
});
test('window shopping is recognized through distinct inspected items, not repeated rendering or a subsequent purchase',()=>{
 const s=info();focus(s,['browse']);s.play=60;
 for(const id of ['T1','V1','V18'])recordNarrativeAction(s,'inspect',{id});
 const log=step(s,8,{context:{surface:()=> 'shop'}});assert.equal(log[0].id,'browse');assert.match(log[0].text,/货架/);
 const shopper=info();focus(shopper,['browse']);shopper.play=60;
 for(const id of ['T1','V1','V18'])recordNarrativeAction(shopper,'inspect',{id});purchase(shopper,'T1');
 assert.equal(step(shopper,10,{context:{surface:()=> 'shop'}}).length,0);
});
test('only successful job changes count and their commentary does not survive an old save as a new event',()=>{
 const s=info();for(const id of ['T1','V1','V18','V2'])buy(s,id);s.counts.V4=1;s.counts.L1=1;
 const r=s.community.residents[0];assert.ok(assignJob(s,r.id,'farmer').ok);assert.ok(assignJob(s,r.id,'farmer').ok);
 assert.equal(s.narrative.behavior.assignments.length,1);
 assert.equal(assignJob(s,r.id,'unknown').ok,false);assert.equal(s.narrative.behavior.assignments.length,1);
 step(s,1);assert.ok(assignJob(s,r.id,'musician').ok);step(s,1);assert.ok(assignJob(s,r.id,'farmer').ok);
 focus(s,['rearrange']);s.narrative.current=null;s.narrative.silence=10;
 assert.equal(step(s,8)[0].id,'rearrange');
 const old=structuredClone(s);delete old.narrative.behavior;old.narrative.seen=[];old.narrative.current=null;
 assert.deepEqual(restore(old).narrative.behavior.assignments,[]);
});
test('first earned job money gets a different reaction from merely assigning a job',()=>{
 const s=info();buy(s,'T1');buy(s,'V1');buy(s,'V18');buy(s,'V2');focus(s,['first-wages']);
 assert.equal(step(s,2,{context:{workingVisible:()=>true}}).length,0);
 s.community.residents[0].jobEarned=5;
 assert.equal(step(s,2,{context:{workingVisible:()=>true}})[0].id,'first-wages');
});
test('scene and music observation windows begin on actual arrival/listening, even long after buying',()=>{
 const s=info();s.counts.N1=1;s.counts.L1=1;focus(s,['nether','music']);
 step(s,300,{context:{realm:()=> 'overworld',musicPlaying:()=>false}});
 assert.equal(s.narrative.eligibleAt.nether,undefined);assert.equal(s.narrative.eligibleAt.music,undefined);
 assert.equal(step(s,1,{context:{realm:()=> 'nether'}})[0].id,'nether');
 step(s,8,{context:{realm:()=> 'nether'}});
 assert.ok(step(s,8,{context:{realm:()=> 'overworld',musicPlaying:()=>true}}).some(r=>r.id==='music'));
});
test('hidden reading time freezes while foreground waiting elapses; a long-hidden observation expires',()=>{
 const s=info();s.counts.V4=1;focus(s,['farm']);step(s,.2,{context:{visible:()=>true}});
 const elapsed=s.narrative.current.elapsed;
 step(s,5,{available:false,context:{visible:()=>true}});assert.equal(s.narrative.current.elapsed,elapsed);
 step(s,70,{available:false,context:{visible:()=>true}});assert.equal(s.narrative.current,null);assert.ok(s.narrative.seen.includes('farm'));
});
test('upgrading an old cadence save removes artificial opening waits without resetting heard dialogue or purchases',()=>{
 const s=info();s.narrative.cadenceVersion=1;delete s.narrative.companionsShown;delete s.narrative.silence;s.narrative.gap=90;s.narrative.seen=['rescued'];
 const loaded=restore(s);assert.ok(loaded.narrative.seen.includes('rescued'));assert.equal(loaded.guidance.info,true);
 const log=step(loaded,2);assert.equal(log[0].id,'friend');assert.equal(loaded.money,s.money);
});
