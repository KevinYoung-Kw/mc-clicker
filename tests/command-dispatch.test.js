import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import * as T from 'three';
import {fresh,restore,setOption,rates,advance} from '../src/game.js';
import {advanceCommand,commandCapacities,dispatchMode,beaconTarget,beaconMode} from '../src/command-dispatch.js';
import {beaconLight,setBeaconRealm} from '../src/beacon-light.js';
const peak=()=>restore(JSON.parse(readFileSync(new URL('../docs/v1.6/qa/stability-baseline/fixtures/peak.json',import.meta.url))));
const caps=()=>Object.fromEntries(['overworld','nether','end'].map(r=>[r,{raw:20,haul:10,process:20,trade:10}]));
test('automatic dispatch requires command block and prioritises unfinished world engineering',()=>{
 const s=fresh();assert.equal(setOption(s,'dispatch','auto'),false);
 s.counts={Z1:1,Z2:1,N1:1,E2:1,N10:1};s.endEyes=12;s.dispatch='auto';s.projectByRealm={overworld:60000,nether:45000,end:10000};s.buffers.end.goods=100;
 const before=structuredClone(s.buffers);advanceCommand(s,0,caps);
 assert.equal(beaconTarget(s),'end');assert.equal(dispatchMode(s),'orders');assert.equal(beaconMode(s),'logistics');assert.deepEqual(s.buffers,before);assert.equal(s.money,0);
 s.projectByRealm.end=60000;advanceCommand(s,7,caps);assert.equal(beaconTarget(s),'end');advanceCommand(s,1,caps);assert.equal(beaconTarget(s),'nether');
});
test('manual beacon preferences survive automatic control and save restore',()=>{
 const s=peak();assert.ok(setOption(s,'beaconRealm','nether'));assert.ok(setOption(s,'beacon','logistics'));assert.ok(setOption(s,'dispatch','auto'));
 assert.equal(setOption(s,'beaconRealm','overworld'),false);const copy=restore(s);assert.equal(copy.dispatch,'auto');advance(copy,1);
 assert.ok(copy.commandPlan);assert.equal(copy.beaconRealm,'nether');setOption(copy,'dispatch','off');assert.equal(beaconTarget(copy),'nether');assert.equal(beaconMode(copy),'logistics');
});
test('automatic strategy uses the same real transport and trade effects as manual selection',()=>{
 const s=peak();s.dispatch='auto';s.commandPlan={realm:'end',mode:'orders',beacon:'production',remaining:8};
 const manual=restore(s);manual.dispatch='orders';manual.beaconRealm='end';manual.beacon='production';
 assert.deepEqual(rates(s).regions,rates(manual).regions);
 const goods={...s.buffers.end};advance(s,1);assert.ok(Number.isFinite(s.money));assert.ok(s.buffers.end.goods>=0);assert.ok(goods.goods>=0);
});
test('beacon colours are realm-specific and never leak between model instances',()=>{
 const a=beaconLight(new T.Group()),b=beaconLight(new T.Group());
 setBeaconRealm(a,'overworld');const green=a.children[1].material.color.getHex();setBeaconRealm(b,'nether');assert.equal(a.children[1].material.color.getHex(),green);
 const red=b.children[1].material.color.getHex();setBeaconRealm(b,'end');assert.notEqual(b.children[1].material.color.getHex(),red);assert.notEqual(red,green);
 assert.equal(a.children[0].material.depthWrite,false);assert.equal(a.children[0].userData.ignorePick,true);
});

test('dispatch comparisons remove their own bonuses instead of oscillating between modes',()=>{
 const s=fresh();s.counts={Z1:1,N10:1};s.dispatch='auto';s.commandPlan={mode:'clear',realm:'overworld',beacon:'logistics'};
 const report={electricity:{perDevice:{N10:1}},regions:{overworld:{raw:100,haul:80*1.4*1.8,process:120,trade:20}}};
 const c=commandCapacities(s,report).overworld;assert.equal(c.raw,100);assert.ok(Math.abs(c.haul-80)<1e-8);assert.equal(report.regions.overworld.haul,80*1.4*1.8);
 s.buffers.overworld.raw=1000;advanceCommand(s,8,()=>commandCapacities(s,report));assert.equal(beaconMode(s),'logistics');assert.equal(dispatchMode(s),'clear');
});
