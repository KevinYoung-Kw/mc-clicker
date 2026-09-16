import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,buy,restore,frontier} from '../src/game.js';
import {parcelScenery} from '../src/natural-scenery.js';
import {worldScenery,sceneryVisible} from '../src/layout.js';
import {clearGarden,gardenObjects} from '../src/garden.js';
import {housingSites,claimStarterHome,buildHome} from '../src/housing.js';
const first=seed=>{const s=fresh(seed);s.money=1e10;for(const id of ['T1','V1','V18','V2'])assert.ok(buy(s,id).ok);return s;};
test('new parcels vary position, amount, species and orientation without rerolling',()=>{
 const s=first(783);for(let i=0;i<16;i++)assert.ok(buy(s,'V1',frontier(s)[0]).ok);
 const samples=s.chunks.overworld.map(c=>parcelScenery(s,c));
 assert.ok(new Set(samples.map(p=>p.length)).size>1);
 assert.ok(new Set(samples.flat().filter(p=>p.kind==='garden').map(p=>p.type)).size>=4);
 assert.ok(new Set(samples.flat().map(p=>p.rotation)).size===4);
 assert.ok(new Set(samples.map((p,i)=>JSON.stringify(p.map(q=>[q.x-s.chunks.overworld[i].x*5,q.z-s.chunks.overworld[i].z*5])))).size===samples.length);
 assert.deepEqual(s.chunks.overworld.map(c=>parcelScenery(s,c)),samples);
 const loaded=restore(s,0);assert.deepEqual(loaded.garden.naturalSeeds,s.garden.naturalSeeds);
 assert.deepEqual(loaded.chunks.overworld.map(c=>parcelScenery(loaded,c)),samples);
});
test('natural removals survive refresh and old land does not reshuffle during migration',()=>{
 const s=first(359);s.counts.V20=1;const object=gardenObjects(s).find(p=>p.native);assert.ok(object);assert.ok(clearGarden(s,object.id).ok);
 const loaded=restore(s,0);assert.ok(loaded.garden.cleared.includes(object.id));assert.ok(!gardenObjects(loaded).some(p=>p.id===object.id));
 delete s.garden.naturalSeeds;delete s.garden.naturalSeed;s.garden.cleared=[];s.counts.V20=0;
 const before=worldScenery(s).filter(p=>p.native),old=restore(s,0);
 assert.deepEqual(worldScenery(old).filter(p=>p.native),before);
 const existing=JSON.stringify(before);assert.ok(buy(old,'V1',frontier(old)[0]).ok);
 assert.deepEqual(worldScenery(old).filter(p=>before.some(q=>q.id===p.id)),JSON.parse(existing));
 assert.equal(Object.keys(old.garden.naturalSeeds).length,1);
});
test('random starter scenery still allows the free house without buying extra land',()=>{
 for(let seed=0;seed<16;seed++){
  const s=first(seed*98761);claimStarterHome(s);
  const site=housingSites(s,'oak',0)[0];assert.ok(site,`starter seed ${seed} has a visible valid site`);
  assert.ok(buildHome(s,'oak',site).ok);
  assert.equal(worldScenery(s).filter(p=>p.kind==='house').length,0);
  const native=worldScenery(s).filter(p=>p.native&&sceneryVisible(s,p));assert.ok(native.length<6);
 }
});
