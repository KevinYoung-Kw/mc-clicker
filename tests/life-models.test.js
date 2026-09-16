import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {lifeBuilding,LIFE_MODEL_IDS,makeHaulerCart} from '../src/life-models.js';
import {boxGeometry} from '../src/models.js';
import {makeObject} from '../src/objects.js';
import {ITEMS} from '../src/catalog.js';
import {fresh} from '../src/game.js';
import {fitOutdoorModel,outdoorPreview} from '../src/construction-preview.js';
import {footprint,MODEL_INSET} from '../src/layout.js';
import {windowGlowMatrix} from '../src/atmosphere.js';
import {exposedCoplanarFaces} from '../scripts/lib/surface-audit.mjs';

function named(root,name){const found=[];root.traverse(o=>{if(o.userData.facilityPart===name)found.push(o)});return found;}
test('life facilities dispatch to distinct full-size, grounded pixel structures at every stage and rotation',()=>{
 for(const id of LIFE_MODEL_IDS)for(let level=1;level<=ITEMS[id].max;level++)for(let rotation=0;rotation<4;rotation++){
  const s=fresh();s.counts[id]=level;s.placements[id]={x:0,z:0,realm:'overworld',rotation};
  const before=structuredClone(s),root=new T.Group(),animations=[];
  makeObject(root,ITEMS[id],s,animations);fitOutdoorModel(root,id,s);
  const b=new T.Box3().setFromObject(root),size=b.getSize(new T.Vector3()),f=footprint(id,s.placements[id]);
  assert.ok(size.x<=f.w-MODEL_INSET*2+1e-6&&size.z<=f.d-MODEL_INSET*2+1e-6,`${id}/${level}/${rotation}: inside lot`);
  assert.ok(size.x>f.w*.72&&size.z>f.d*.72,`${id}/${level}: substantial building, no distant prop shrinking it`);
  assert.ok(Math.abs(b.min.y-.16)<1e-6,'on real ground');
  let meshes=0,windows=0;const materials=new Set();
  root.traverse(m=>{if(!m.isMesh)return;meshes++;materials.add(m.material);assert.equal(m.geometry,boxGeometry);if(m.userData.windowGlow)windows++;});
  assert.ok(windows>=1,`${id}: warm nighttime window/lamp integration`);
  assert.ok(meshes<=125,`${id}: bounded model complexity`);assert.ok(materials.size<=24);
  assert.deepEqual(s,before,'building presentation does not mutate simulation');
 }
});

test('new life models have no competing exposed box faces, including their upgraded roofs',()=>{
 for(const id of LIFE_MODEL_IDS)for(let level=1;level<=ITEMS[id].max;level++){
  const model=lifeBuilding(new T.Group(),id,{counts:{[id]:level}});
  const hits=exposedCoplanarFaces(model).filter(h=>h.axis!=='y'||h.side!=='min');
  assert.deepEqual(hits,[],`${id}/${level}`);
 }
});

test('life upgrades add usable visible furniture and recognizable structural additions',()=>{
 const make=(id,level)=>lifeBuilding(new T.Group(),id,{counts:{[id]:level}});
 assert.equal(named(make('V24',1),'parked-cart').length,2);
 assert.equal(named(make('V24',2),'parked-cart').length,3);
 assert.equal(named(make('V24',2),'repair-rack').length,1);
 assert.deepEqual([1,2,3].map(l=>named(make('V21',l),'seat').length),[1,2,3]);
 assert.equal(named(make('V21',3),'garden-arbor').length,1);
 assert.equal(named(make('V22',1),'tavern-mug-sign').length,1);
 assert.equal(named(make('V22',2),'hearth-chimney').length,1);
 assert.equal(named(make('V22',3),'guest-dormer').length,1);
 assert.deepEqual([1,2,3].map(l=>named(make('V23',l),'chess-table').length),[1,2,2]);
 assert.equal(named(make('V23',3),'festival-awning').length,1);
 assert.equal(named(make('V23',1),'small-stage').length,1);
 assert.equal(named(make('V11',1),'reading-tower').length,1);
 assert.equal(named(make('V11',1),'open-bookshelf').length,2);
});

test('night overlay matrices follow rotated windows and catalog previews leave shared surfaces intact',()=>{
 for(const id of LIFE_MODEL_IDS){
  const s=fresh();s.counts[id]=1;const original=lifeBuilding(new T.Group(),id,s),source=[];
  original.traverse(m=>{if(m.isMesh)source.push(m.material)});
  original.rotation.y=Math.PI/2;original.scale.setScalar(.8);original.updateMatrixWorld(true);
  original.traverse(m=>{if(!m.userData.windowGlow)return;const matrix=windowGlowMatrix(m),p=new T.Vector3().setFromMatrixPosition(matrix),front=new T.Vector3(0,0,.62).applyMatrix4(m.matrixWorld);assert.ok(p.distanceTo(front)<1e-9);});
  const preview=outdoorPreview(s,id,false,false,3);preview.setValid(false);preview.dispose();
  assert.ok(source.every(m=>!m.transparent&&m.opacity===1),'preview does not tint shared production materials');
 }
});

test('worker handcart stays compact and its two axle-aligned wheels animate without shared exposed faces',()=>{
 const parent=new T.Group(),cart=makeHaulerCart(parent);
 assert.equal(cart.parent,parent);assert.equal(cart.userData.haulerCart,true);
 const wheels=named(cart,'hauler-cart-wheel');assert.equal(wheels.length,2);
 assert.ok(wheels.every(w=>w.userData.cartWheel));
 assert.equal(named(cart,'hauler-cart-bed').length,1);
 const size=new T.Box3().setFromObject(cart).getSize(new T.Vector3());
 assert.ok(size.x<=.55&&size.z<=.55&&size.y<=.4,JSON.stringify(size));
 cart.traverse(o=>{if(o.isMesh)assert.equal(o.geometry,boxGeometry)});
 for(const angle of [0,Math.PI/4,Math.PI/2,Math.PI]) {
  wheels.forEach(w=>{w.rotation.x=angle});
  const moving=new T.Box3().setFromObject(cart).getSize(new T.Vector3());
  assert.ok(moving.x<=.55&&moving.z<=.55&&moving.y<=.4,'wheel spin fits accessory envelope');
  assert.deepEqual(exposedCoplanarFaces(cart).filter(h=>h.axis!=='y'||h.side!=='min'),[]);
 }
});
