import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh} from '../src/game.js';
import {CATALOG,ITEMS} from '../src/catalog.js';
import {ownedCatalog,ownedGroups} from '../src/facility-shops.js';
import {shoppingOptions,shoppingUpgrades} from '../src/shopping-options.js';
import {facilityUpgrades,upgradeStatus} from '../src/upgrades.js';

function developed(){const s=fresh(0);for(const i of CATALOG)s.counts[i.id]=Number.isFinite(i.max)?i.max:40;s.money=0;s.endEyes=12;s.research.completed={industrial:true,modern:true,railway:true,automation:true,broadcasting:true};return s;}
test('owned inventory includes nested training, indoor equipment and system levels without adding them to discovery',()=>{
 const s=developed();for(const id of ['V12','V13','L1','L2','L3','M10','M11','V8','T9'])s.counts[id]=1;
 const before=JSON.stringify(s),ids=ownedCatalog(s).map(i=>i.id);
 for(const id of ['V12','V13','L1','L2','L3','M11','V8','T9'])assert.ok(ids.includes(id),id);
 assert.ok(ownedCatalog(s,'M').every(i=>i.family==='M'));
 for(const row of shoppingOptions(s).available)assert.equal(s.counts[row.id]||0,0);
 assert.equal(JSON.stringify(s),before);
});
test('full owned offers contain every unlocked mod, including unaffordable and beyond the old one-per-owner shortlist',()=>{
 const s=developed();s.upgrades.levels['drill-steel']=1;const rows=shoppingUpgrades(s,'all',{all:true});
 assert.equal(new Set(rows.map(r=>r.key)).size,rows.length);
 const expected=CATALOG.flatMap(i=>facilityUpgrades(i.id).filter(m=>['ready','short'].includes(upgradeStatus(s,m.id).kind)).map(m=>m.id));
 assert.deepEqual(rows.filter(r=>r.kind==='mod').map(r=>r.mod).sort(),expected.sort());
 assert.ok(rows.filter(r=>r.id==='M9').length>4);
 const shown=new Set(ownedGroups(s,ownedCatalog(s)).upgradable.map(i=>i.id));
 assert.ok(rows.every(r=>shown.has(r.id)));
 s.money=1e20;assert.deepEqual(shoppingUpgrades(s,'all',{all:true}).map(r=>r.key),rows.map(r=>r.key));
});
test('buying one modification does not hide its siblings; stored and completed items do not become new offers',()=>{
 const s=developed();s.upgrades.levels['drill-steel']=1;
 const mods=shoppingUpgrades(s,'all',{all:true}).filter(r=>r.id==='M9');
 assert.ok(!mods.some(r=>r.mod==='drill-steel'));assert.ok(mods.some(r=>r.mod==='drill-twin'));
 s.facilityStorage.M9=true;assert.ok(!shoppingUpgrades(s,'all',{all:true}).some(r=>r.id==='M9'));
 assert.ok(ownedGroups(s,ownedCatalog(s)).stored.some(i=>i.id==='M9'));
 for(const r of shoppingUpgrades(s,'all',{all:true}))assert.ok(!['V1','V2'].includes(r.id));
 s.counts.V12=ITEMS.V12.max;s.counts.V13=ITEMS.V13.max;assert.ok(!ownedCatalog(s).some(i=>['V12','V13'].includes(i.id)));
});
