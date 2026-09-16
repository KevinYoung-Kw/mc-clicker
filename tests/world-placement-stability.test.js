import test from 'node:test';
import assert from 'node:assert/strict';
import {Group} from 'three';
import {World} from '../src/world.js';
import {fresh,buy} from '../src/game.js';
import {worldScenery} from '../src/layout.js';
import {placementCue} from '../src/construction-preview.js';

function world(){
 const s=fresh(42);s.counts.T1=1;s.money=1e10;
 for(const [x,z] of [[0,0],[1,0],[0,1],[-1,0]])assert.ok(buy(s,'V1',{x,z,realm:'overworld'}).ok);
 return Object.assign(Object.create(World.prototype),{state:s,view:'overworld',markerGroup:new Group(),studioCue:placementCue()});
}
test('legal placement coverage remains attached and visible through selection, turn and invalid clicks',()=>{
 const w=world();w.setMode({id:'V4',kind:'build',rotation:0});
 assert.ok(w.placementSites.length);
 const site={...w.placementSites[0],realm:'overworld',rotation:0};
 w.setMode({...w.mode,site});
 assert.equal(w.outdoorGhost.root.userData.valid,true);
 assert.equal(w.availableSurface.root.visible,true);
 for(let rotation=1;rotation<=4;rotation++){
  w.setMode({...w.mode,rotation:rotation%4,site:{...site,rotation:rotation%4}});
  assert.equal(w.availableSurface.root.visible,true);
  assert.equal(w.availableSurface.root.parent,w.markerGroup);
 }
 w.setMode({...w.mode,site:{x:100,z:100,realm:'overworld'}});
 assert.equal(w.outdoorGhost.root.userData.valid,false);
 assert.equal(w.availableSurface.root.visible,true);
 w.setMode({...w.mode,site});
 assert.equal(w.outdoorGhost.root.userData.valid,true);
 assert.equal(w.availableSurface.root.visible,true);
 w.setMode(null);assert.equal(w.availableSurface,null);
});
test('expansion coverage survives a valid land selection and is cleared on exit',()=>{
 const w=world();w.setMode({id:'V1',kind:'expand'});const p=w.placementSites[0];
 w.setMode({...w.mode,site:{x:p.x/5,z:p.z/5,realm:'overworld'}});
 assert.equal(w.outdoorCue.fill.userData.valid,true);
 assert.equal(w.availableSurface.root.visible,true);
 w.setMode(null);assert.equal(w.availableSurface,null);
});
test('model refresh preserves existing walkers but initializes newly added or resized actors',()=>{
 const w=world();let searches=0;
 w.navigation={nearest:()=>{searches++;return {x:2,z:3,component:1};}};
 const before={id:'N3',home:{x:2,z:3},radius:.2,root:new Group(),path:[{x:3,z:3}],x:2.5,z:3,active:true,visit:8,wait:.4,stuck:0,component:1};
 before.root.rotation.y=1.2;
 const actor=()=>({id:'N3',home:{x:2,z:3},radius:.2,root:new Group()});
 const updated=actor(),added=actor();w.walkers=[updated,added];w.initializeWalkers([before]);
 assert.equal(searches,1);assert.equal(updated.x,2.5);assert.equal(updated.visit,8);
 assert.equal(updated.path,before.path);assert.equal(updated.root.rotation.y,1.2);
 assert.equal(added.x,2);assert.equal(added.path.length,0);
 const resized={...actor(),radius:.3};w.walkers=[resized];w.initializeWalkers([before]);
 assert.equal(searches,2);assert.equal(resized.x,2);
 // A layout change calls initialization without old motion, rebuilding all paths.
 w.walkers=[actor()];w.initializeWalkers();assert.equal(searches,3);
});

for(const [kind,type] of [['home','oak'],['garden','hedge']])test(`${kind} selection and rotation keep the available area`,()=>{
 const w=world();w.state.counts.V2=1;w.state.counts.V20=3;
 w.state.garden.cleared=worldScenery(w.state).filter(p=>p.native).map(p=>p.id);w.state.garden.revision++;w.state.layoutRevision++;
 w.setMode({id:`${kind}:${type}`,type,kind:`${kind}-build`,rotation:0});
 assert.ok(w.placementSites.length);
 for(let rotation=0;rotation<4;rotation++){
  w.setMode({...w.mode,rotation,site:null});
  w.setMode({...w.mode,site:{...(kind==='home'?{x:5,z:0,realm:'overworld'}:w.placementSites[0]),rotation}});
  assert.equal(w.outdoorGhost.root.userData.valid,true);
  assert.equal(w.availableSurface.root.visible,true);
 }
 w.setMode(null);assert.equal(w.availableSurface,null);
});

test('studio floor and wall previews keep coverage on valid and invalid positions',()=>{
 const w=world();w.studio=true;w.shot='L2';
 Object.assign(w.state.counts,{L2:1,L3:1,L5:1});
 w.studioGhost=w.studioCue.fill;w.studioOutline=w.studioCue.outline;
 for(const [id,key] of [['L3','L3:0'],['L5','L5']]){
  w.setMode({id,key,kind:'studio-move',rotation:0});
  assert.ok(w.studioCandidates.length);
  const site={...w.studioCandidates[0],rotation:0};
  w.setMode({...w.mode,site});
  assert.equal(w.studioGhost.userData.valid,true);
  assert.equal(w.availableSurface.root.visible,true);
  w.setMode({...w.mode,site:{...site,x:100}});
  assert.equal(w.studioGhost.userData.valid,false);
  assert.equal(w.availableSurface.root.visible,true);
 }
 w.setMode(null);assert.equal(w.availableSurface,null);
});

test('new actors avoid preserved later walkers, and previously hidden actors can find a space',()=>{
 const w=world(),before={id:'N3',home:{x:2,z:3},radius:.2,root:new Group(),path:[],x:2.5,z:3,active:true,component:1};
 const existing={id:'N3',home:{x:2,z:3},radius:.2,root:new Group()},added={id:'N5',home:{x:2,z:3},radius:.2,root:new Group()};
 let occupied;
 w.navigation={nearest:(_home,_radius,_component,others)=>{occupied=[...others];return {x:4,z:3,component:1};}};
 w.walkers=[added,existing];w.initializeWalkers([before]);
 assert.equal(occupied.length,1);assert.equal(occupied[0].x,2.5);
 assert.equal(existing.x,2.5);assert.equal(added.x,4);
 before.active=false;before.root.visible=false;w.walkers=[existing];w.initializeWalkers([before]);
 assert.equal(existing.active,true);assert.equal(existing.x,4);
});
