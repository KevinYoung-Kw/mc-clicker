import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,earn,restore} from '../src/game.js';
import {shareStoryData} from '../src/share-stories.js';
import {paintTerrain} from '../src/garden.js';
import {waterObstacles,footprintHitsWater} from '../src/terrain-data.js';

test('share stories read actual income without changing the save or double counting gifts',()=>{
 const s=fresh();for(const id of ['V1','V2','T1','V18'])s.counts[id]=1;
 earn(s,100,'manual');earn(s,200,'live');earn(s,100,'gift');earn(s,100,'postal');earn(s,100,'production');
 const before=structuredClone(s),d=shareStoryData(s);assert.deepEqual(s,before);
 assert.equal(d.income[2].fraction,.5);assert.ok(Math.abs(d.income.reduce((n,r)=>n+r.fraction,0)-1)<1e-10);
 assert.equal(d.profile.title,'多线经营');assert.equal(d.total,'600');
 s.total+=100;const old=shareStoryData(s);assert.equal(old.income[4].fraction,1/7,'unknown historical income stays in other, not a guessed source');
 assert.deepEqual(shareStoryData(restore(s)).income,old.income);
});
test('passports require real world access; moments neither leak unheard stories nor promise invented timelines',()=>{
 const s=fresh();let d=shareStoryData(s);assert.equal(d.worlds.filter(r=>r.reached).length,1);assert.equal(d.moments.length,1);
 s.counts.E2=1;assert.equal(shareStoryData(s).worlds[2].reached,false);s.endEyes=12;assert.equal(shareStoryData(s).worlds[2].reached,true);
 s.communityStories.triggers['community-tree']=20;assert.ok(!shareStoryData(s).moments.some(m=>m.id==='community-tree'));
 s.narrative.seen.push('community-tree');assert.ok(shareStoryData(s).moments.some(m=>m.id==='community-tree'));
 s.easterEggs.entries['after-hours']={status:'away'};assert.ok(!shareStoryData(s).moments.some(m=>m.id==='date'));
 s.easterEggs.entries['after-hours'].status='claimed';assert.ok(shareStoryData(s).moments.some(m=>m.id==='date'));
});
test('water editing and water collisions remain exclusively in the overworld',()=>{
 const s=fresh();s.counts.V20=1;s.money=1000;s.garden.terrain['4,0']='water';const before=structuredClone(s);
 for(const realm of ['nether','end']){
  assert.equal(paintTerrain(s,'water',{x:4,z:0,realm}).ok,false);
  assert.deepEqual(waterObstacles(s,realm),[]);
  assert.equal(footprintHitsWater(s,{x:4,z:0,w:1,d:1},realm),false);
 }
 assert.deepEqual(s,before);assert.equal(footprintHitsWater(s,{x:4,z:0,w:1,d:1},'overworld'),true);
});
