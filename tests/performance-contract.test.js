import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh} from '../src/game.js';
import {chooseOpening} from '../src/opening-guide.js';
import {reconcileNarrative,advanceNarrative} from '../src/narrative.js';
import {communityModel} from '../src/community-models.js';

// UI preflight and simulation entry points must yield the same dialogue state,
// including pauses, purchases and a background/receipt gap.
test('single narrator reconciliation preserves dialogue timing and state',()=>{
 for(const choice of ['first','returning']){
  const a=fresh(0);chooseOpening(a,choice);const b=structuredClone(a);
  for(let i=0;i<1200;i++){
   for(const s of [a,b]){
    s.play+=.25;
    if(i===40){s.guidance.info=true;s.guidance.notices=true;}
    if(i===400){s.guidance.goal=true;s.counts.T1=1;}
    if(i===700)s.counts.V1=1;
   }
   const options={available:i<200||i>240};
   reconcileNarrative(a);advanceNarrative(a,.25,options);
   reconcileNarrative(b);advanceNarrative(b,.25,{...options,reconcile:false});
   assert.deepEqual(b.narrative,a.narrative,`${choice}, tick ${i}`);
  }
 }
});

test('rebuilding souvenir signs reuses geometry and materials without changing bounds',()=>{
 // Minimal canvas stand-in exercises sign geometry creation in Node.
 const original=globalThis.document;
 globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},fillText(){}})})};
 try{
  const meshes=()=>{const out=[];for(const id of ['request-pond','cash-counter','village-stage'])communityModel(id).traverse(o=>{if(o.geometry?.type==='PlaneGeometry')out.push(o);});return out;};
  const first=meshes();assert.ok(first.length>=6);
  const shared=first[0].geometry;
  for(let cycle=0;cycle<30;cycle++)for(const [i,m]of meshes().entries()){
   assert.equal(m.geometry,shared);assert.equal(m.material,first[i].material);
   assert.deepEqual(m.scale.toArray(),first[i].scale.toArray());
  }
 }finally{if(original===undefined)delete globalThis.document;else globalThis.document=original;}
});

test('cached neighbor actor checks match full swept checks around obstacles and land gaps',async()=>{
 const {Navigation,avoidsActors}=await import('../src/navigation.js');
 const chunks=[{x:0,z:0},{x:1,z:0},{x:1,z:1}];
 const nav=new Navigation(chunks,[{minX:.5,maxX:1.5,minZ:-1,maxZ:1},{minX:3,maxX:4,minZ:1,maxZ:3}],.5);
 for(const radius of [.15,.3]){
  const {nodes}=nav.grid(radius);let checked=0;
  for(const node of nodes)for(const id of node.neighbors){
   const end=nodes[id];
   for(const occupied of [[],[{x:node.x,z:node.z,radius:.2}],[{x:(node.x+end.x)/2+.3,z:(node.z+end.z)/2,radius:.15}],[{x:8,z:-2,radius:.5}]]){
    assert.equal(avoidsActors(node,end,radius,occupied),nav.segment(node,end,radius,occupied));checked++;
   }
  }
  assert.ok(checked>1000);
 }
});
