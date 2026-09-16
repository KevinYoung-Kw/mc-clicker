import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,restore,advance} from '../src/game.js';
import {persistentSave} from '../src/save-persistent.js';
import {shoppingOptions,shoppingUpgrades} from '../src/shopping-options.js';
import {developmentStep} from '../src/development.js';
import {postalUpgradeCost} from '../src/mail.js';
import {purchaseStatus} from '../src/purchase-feedback.js';
import {ITEMS} from '../src/catalog.js';
function village(){const s=fresh(0);Object.assign(s.counts,{T1:1,V1:1,V18:1,V2:1,T7:1,V3:1,T2:1});return s;}
test('discovery recommends the next new purchase; postal upgrades stay in owned offers',()=>{
 const s=village(),before=JSON.stringify(s),step=developmentStep(s),rows=shoppingOptions(s,'all',null,step).available;
 assert.equal(rows[0].id,step.id);assert.ok(rows.every(r=>r.kind==='purchase'&&!s.counts[r.id]));
 assert.equal(shoppingUpgrades(s).find(r=>r.id==='V18').cost,postalUpgradeCost(s));
 assert.equal(JSON.stringify(s),before);
});
test('discovery price sorting contains only new purchases and remains stable as money changes',()=>{
 const s=village();s.counts.V3=2;const rows=shoppingOptions(s,'all',null,developmentStep(s),'price').available;
 assert.deepEqual(rows.map(r=>r.cost),rows.map(r=>r.cost).sort((a,b)=>a-b));
 assert.ok(rows.every(r=>r.kind==='purchase'&&!s.counts[r.id]));
 for(const row of rows)if(['purchase','level'].includes(row.kind))assert.equal(row.cost,purchaseStatus(s,ITEMS[row.id]).cost);
 const keys=rows.map(r=>r.key);s.money=1e15;s.play+=1;assert.deepEqual(shoppingOptions(s,'all',null,developmentStep(s),'price').available.map(r=>r.key),keys);
});
test('land, recruitment, stored facilities and completed upgrades are not improvements',()=>{
 const s=village();s.facilityStorage={V3:true};s.mail.postalLevel=5;
 const ids=shoppingUpgrades(s).map(r=>r.id);for(const id of ['V1','V2','V3','V18'])assert.ok(!ids.includes(id));
});
test('an affordable-tier unlocked mod is visible before the facility is maxed; locked mods stay out',()=>{
 const s=village();Object.assign(s.counts,{M9:1,T3:1,M1:3,M5:1});
 const row=shoppingUpgrades(s).find(r=>r.id==='M9');assert.equal(row.kind,'mod');assert.equal(row.mod,'drill-steel');assert.equal(row.cost,4000);
 assert.ok(shoppingUpgrades(s,'M').every(r=>r.item.family==='M'));
});
test('even a required body upgrade never leaks back into discovery through a milestone',()=>{
 const s=village();Object.assign(s.counts,{M9:1,T3:1,M1:3,M5:1});
 for(const family of ['all','M','V','features'])for(const order of ['progress','price']){
  const {available,soon}=shoppingOptions(s,family,null,{kind:'purchase',id:'M9'},order);
  assert.ok(available.every(r=>r.kind==='purchase'&&!s.counts[r.id]));
  assert.ok(soon.every(i=>!s.counts[i.id]));
 }
 assert.ok(shoppingUpgrades(s).some(r=>r.id==='M9'));
});
test('the first villager stays discoverable, repeat recruitment is not a facility improvement',()=>{
 const s=village();s.counts.V2=0;
 for(const order of ['progress','price'])assert.ok(shoppingOptions(s,'V',null,developmentStep(s),order).available.some(r=>r.id==='V2'));
 s.counts.V2=1;
 assert.ok(!shoppingOptions(s).available.some(r=>r.id==='V2'));
 assert.ok(!shoppingUpgrades(s).some(r=>r.id==='V2'));
});
test('recommendations reconstruct from restored saves without adding or losing progress',()=>{
 const s=village();const a=restore(JSON.parse(JSON.stringify(s)),100),b=restore(persistentSave(s),100);
 const before=JSON.stringify(b);assert.deepEqual(shoppingUpgrades(a),shoppingUpgrades(b));assert.equal(JSON.stringify(b),before);
 advance(b,1);assert.ok(b.money>=0);assert.deepEqual(restore(persistentSave(b),200).counts,b.counts);
});
