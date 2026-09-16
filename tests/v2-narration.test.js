import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh} from '../src/game.js';
import {NARRATION,reconcileNarrative} from '../src/narrative.js';
const rule=id=>NARRATION.find(r=>r.id===id);
test('life teaching waits for real state and ignores audio settings',()=>{
 const s=fresh();
 for(const id of ['research-library','research-switch','villager-rest','public-visit','cart-work','welfare-running'])assert.ok(!rule(id).when(s),id);
 s.counts.V11=1;assert.ok(rule('research-library').when(s));
 s.research.completed.industrial=true;assert.ok(!rule('research-library').when(s));
 s.research.active='cargo-tools';assert.ok(rule('research-switch').when(s));
 s.life.residents.r={phase:'rest'};assert.ok(rule('villager-rest').when(s));
 s.life.visits=1;assert.ok(rule('public-visit').when(s));
 s.counts.V24=1;s.community.residents=[{id:'r',job:'hauler',cargo:{qty:12}}];assert.ok(rule('cart-work').when(s));
 s.sound=false;s.audio.musicVolume=0;assert.ok(rule('cart-work').when(s));
 s.life.welfare='simple';assert.ok(!rule('welfare-running').when(s));s.life.spent=.1;assert.ok(rule('welfare-running').when(s));
});
test('fast progress invalidates queued research/industry lessons and returning from pause does not replay them',()=>{
 const s=fresh();s.guidance.info=true;s.narrative.openingChoice='new';s.counts.V11=1;s.narrative.current={id:'research-library',index:0,elapsed:1};
 s.research.completed.industrial=true;reconcileNarrative(s);assert.equal(s.narrative.current,null);
 s.narrative.current={id:'industrial-era',index:0,elapsed:1};s.counts.M9=1;reconcileNarrative(s);assert.equal(s.narrative.current,null);
 assert.ok(s.narrative.seen.includes('industrial-era'));
});
test('optional research staff is not recommended merely because the library exists',()=>{
 const s=fresh();s.counts.V2=1;s.counts.V11=1;s.community.residents=[{id:'r',job:'idle'}];
 assert.ok(!rule('vacancy:researcher').when(s));s.research.active='cargo-tools';assert.ok(rule('vacancy:researcher').when(s));
});
