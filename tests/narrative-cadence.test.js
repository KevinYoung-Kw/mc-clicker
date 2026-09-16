import test from 'node:test';
import assert from 'node:assert/strict';
import { advance, restore, buy } from '../src/game.js';
import { fresh } from './helpers/first-time-game.js';
import { buyGuidance } from '../src/guidance.js';
import { advanceNarrative, currentNarration, narrationLines, NARRATION, IDLE_LINES, reconcileNarrative, narrationGap } from '../src/narrative.js';
import { eggById, advanceEasterEggs, beginDialogueEgg, narratorAway, returnRemaining, equipNarrator } from '../src/easter-eggs.js';
// A fixed terrain seed keeps the spatial event independent of the test clock.
function world(){const s=fresh(42);s.money=10000;buyGuidance(s,'info');for(const id of ['T1','V1','V18','V2'])buy(s,id);return s;}
test('quiet asides and treasure are kept out of the opening, independently of how rich a player is',()=>{
 const s=world();s.money=1e20;s.counts.M5=1;s.counts.M16=1;
 for(const play of [180,600,1079]){s.play=play;for(let i=0;i<300;i++)advanceEasterEggs(s,1,{quiet:true,random:()=>0});assert.deepEqual(s.easterEggs.entries,{});}
 assert.ok(IDLE_LINES.every(r=>r.minPlay>=720));s.play=1080;assert.equal(eggById('private-stash').eligible(s),true);
 assert.equal(eggById('after-hours').eligible(s),false);s.play=1680;assert.equal(eggById('after-hours').eligible(s),true);
 assert.deepEqual([0,600,1500].map(play=>narrationGap({...s,play})),[20,20,90]);
});
test('ignored or unfinished treasure does not prevent the later dialogue invitation',()=>{
 const s=world();s.counts.M5=1;s.counts.M16=1;s.play=1080;
 for(let i=0;i<60;i++)advanceEasterEggs(s,1,{quiet:true,random:()=>0});
 s.easterEggs.entries['private-stash'].announced=true;s.play=1680;
 for(let i=0;i<60;i++)advanceEasterEggs(s,1,{quiet:true,random:()=>0});
 assert.equal(s.easterEggs.entries['after-hours'].status,'offered');assert.equal(s.easterEggs.entries['private-stash'].status,'offered');
});
test('giving money is explicit, atomic, one-time, and does not increase income',()=>{
 const s=fresh();s.guidance.info=true;s.easterEggs.entries['after-hours']={status:'offered'};
 s.money=519;assert.equal(beginDialogueEgg(s,'after-hours').ok,false);assert.equal(s.money,519);
 s.money=600;assert.equal(beginDialogueEgg(s,'after-hours').cost,520);assert.equal(s.money,80);assert.equal(s.total,0);
 assert.equal(beginDialogueEgg(s,'after-hours').ok,false);assert.equal(s.money,80);assert.equal(narratorAway(s),'after-hours');
});
test('absence uses saved foreground time, completes while muted, and rewards an unequippable/re-equippable accessory only once',()=>{
 const s=fresh();s.guidance.info=true;s.money=600;s.easterEggs.entries['after-hours']={status:'offered'};beginDialogueEgg(s,'after-hours');
 advance(s,20);assert.equal(returnRemaining(s),40);s.guidance.notices=false;
 const raw=structuredClone(s),loaded=restore(raw,Date.now()+1e8);assert.equal(returnRemaining(loaded),40);
 advance(loaded,500,{offline:true});assert.equal(returnRemaining(loaded),40);
 advance(loaded,39);assert.equal(narratorAway(loaded),'after-hours');advance(loaded,1);
 assert.equal(narratorAway(loaded),null);assert.deepEqual(loaded.easterEggs.wardrobe.owned,['date-bow']);assert.equal(loaded.easterEggs.wardrobe.equipped,'date-bow');assert.equal(loaded.money,80);
 assert.ok(equipNarrator(loaded,null));const again=restore(loaded);assert.equal(again.easterEggs.wardrobe.equipped,null);
 advance(again,100);assert.deepEqual(again.easterEggs.wardrobe.owned,['date-bow']);assert.equal(again.easterEggs.wardrobe.equipped,null);assert.ok(equipNarrator(again,'date-bow'));assert.equal(equipNarrator(again,'unknown'),false);
});
test('old spatial-event saves retain their claim and location state after the event is moved later',()=>{
 const s=world();s.easterEggs={version:1,entries:{'private-stash':{status:'claimed',reward:30}},attemptIn:0};
 const loaded=restore(s);assert.equal(loaded.easterEggs.entries['private-stash'].status,'claimed');assert.deepEqual(loaded.easterEggs.wardrobe,{owned:[],equipped:null});
});
test('reviewed comments do not repeat effects, and the mailbox callback requires the earlier line to have been heard',()=>{
 const s=world();assert.deepEqual(narrationLines(s,'pick'),[]);assert.match(narrationLines(s,'work')[0],/细思极恐/);
 assert.deepEqual(narrationLines(s,'mail'),['这邮箱里居然有绿宝石。']);s.narrative.history.push({id:'land',text:narrationLines(s,'land').join(' ')});
 assert.deepEqual(narrationLines(s,'mail'),['邮箱里还真有钱。我刚才随口说的。']);
 assert.ok(!narrationLines(s,'goals').join('').includes('它指路，你决定'));
});
test('optional comments expire rather than being backfilled after a long menu visit',()=>{
 const s=world();s.counts.T7=1;s.play=100;reconcileNarrative(s);assert.equal(s.narrative.eligibleAt.bench,100);
 s.play=200;reconcileNarrative(s);assert.ok(s.narrative.seen.includes('bench'));
 const r=restore(s);assert.ok(r.narrative.seen.includes('bench'));
});
test('music and moving-train copy are guarded by the actual presentation, not just purchases',()=>{
 const s=world();s.counts.L1=1;s.counts.M16=1;s.narrative.seen=NARRATION.filter(r=>!['music','rail'].includes(r.id)).map(r=>r.id);
 advanceNarrative(s,1,{context:{}});assert.equal(currentNarration(s),null);
 advanceNarrative(s,1,{context:{musicPlaying:()=>true}});assert.equal(currentNarration(s).id,'music');
 advanceNarrative(s,1,{context:{musicPlaying:()=>false}});assert.equal(currentNarration(s),null);
 s.narrative.gap=0;for(let i=0;i<4;i++)advanceNarrative(s,1,{context:{railRunning:()=>true}});assert.equal(currentNarration(s).id,'rail');
});
