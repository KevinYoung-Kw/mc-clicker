import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createRailPath} from '../src/rail-path.js';
import {RailTraffic,TRAIN_LIMIT,CARRIAGE_LIMIT} from '../src/rail-traffic.js';
import {beaconLight} from '../src/beacon-light.js';

const path=points=>createRailPath({points:points.map(([x,z])=>({x,z}))});
test('shared and crossing tracks take turns, never stack trains or starve pending shipments',()=>{
  const paths=new Map([
    ['a',path([[-3,0],[3,0]])],['b',path([[0,-3],[0,3]])],
    ['c',path([[3,0],[-3,0]])],['d',path([[0,1],[3,1]])],
  ]),traffic=new RailTraffic(paths,{wagons:3,dispatch:3}),seen=new Set();
  for(let play=0;play<65;play+=.05){
    const flows=Object.fromEntries([...paths.keys()].map(id=>[id,{total:play+1,quantity:1,at:play}]));
    const before=JSON.stringify(flows);traffic.update(play,flows);
    assert.equal(JSON.stringify(flows),before);
    const active=traffic.trains.filter(t=>t.active);
    for(const t of active)seen.add(t.id);
    for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++)
      assert.ok(!active[i].conflicts.has(active[j].id));
    const cars=traffic.trains.flatMap(t=>traffic.poses(t).filter(p=>p.visible));
    for(let i=0;i<cars.length;i++)for(let j=i+1;j<cars.length;j++)
      assert.ok(Math.hypot(cars[i].x-cars[j].x,cars[i].z-cars[j].z)>.4);
  }
  assert.equal(seen.size,4);
});
test('short links do not park convoys; active train/carriage budgets are global and pause with game time',()=>{
  const paths=new Map(Array.from({length:20},(_,i)=>['lane'+i,path([[0,i],[8,i]])]));
  paths.set('short',path([[0,-1],[.5,-1]]));
  const traffic=new RailTraffic(paths,{wagons:3,dispatch:3});
  assert.equal(traffic.trains.length,20);
  const flows=Object.fromEntries([...paths.keys()].map(id=>[id,{total:2,quantity:1,at:0}]));
  traffic.update(0,flows);
  assert.ok(traffic.trains.filter(t=>t.active).length<=TRAIN_LIMIT);
  assert.ok(traffic.trains.filter(t=>t.active).reduce((n,t)=>n+t.cars,0)<=CARRIAGE_LIMIT);
  const before=traffic.trains.map(t=>t.distance);
  for(let i=0;i<60;i++)traffic.update(0,flows);
  assert.deepEqual(traffic.trains.map(t=>t.distance),before);
  for(let t=.1;t<120;t+=.1)traffic.update(t,flows);
  assert.ok(traffic.trains.every(t=>!t.active&&!t.pending),'idle rails clear after shipments finish');
});
test('tight hairpins use one carriage rather than overlapping their own trailers',()=>{
  const traffic=new RailTraffic(new Map([['hairpin',path([[0,0],[3,0],[3,.25],[0,.25]])]]),{wagons:3});
  assert.equal(traffic.trains[0].cars,1);
});
test('beacon is a tall transparent non-shadowing light column, fades without intercepting selection',()=>{
  const root=new T.Group(),animations=[],beam=beaconLight(root,animations);
  assert.equal(beam.children.length,3);
  for(const m of beam.children){
    assert.ok(m.scale.y>8);assert.ok(m.material.transparent);
    assert.equal(m.material.depthWrite,false);assert.equal(m.material.depthTest,true);
    assert.equal(m.material.blending,T.AdditiveBlending);assert.equal(m.castShadow,false);
    assert.equal(m.geometry,beam.children[0].geometry);
  }
  root.updateMatrixWorld(true);
  const ray=new T.Raycaster(new T.Vector3(0,3,5),new T.Vector3(0,0,-1));
  assert.equal(ray.intersectObject(root,true).length,0);
  beam.userData.power=0;for(let i=0;i<40;i++)animations[0](i*.05);
  assert.equal(beam.visible,false);
  beam.userData.power=1;for(let i=0;i<40;i++)animations[0](i*.05);
  assert.equal(beam.visible,true);
  assert.ok(beam.scale.y>.99);
});
