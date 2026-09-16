import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,rates,restore} from '../src/game.js';
import {productionOffers,productionSignals} from '../src/production-guide.js';
import {productionSummary} from '../src/production-summary.js';
import {buyUpgrade} from '../src/upgrades.js';
import {readFileSync} from 'node:fs';
const fixture=()=>restore(JSON.parse(readFileSync(new URL('../docs/v2.0.0/qa/alpha5/fixture.json',import.meta.url),'utf8')));

test('capacity signals distinguish a weak link, real blockage, idle supply and balanced production',()=>{
 const region={raw:100,haul:30,process:80,trade:90};
 let result=productionSignals(region,{tone:'working'});assert.equal(result.signals.haul,'warning');assert.equal(result.helpKey,'haul');
 result=productionSignals(region,{tone:'blocked',stage:'process',issue:'no-power'});assert.equal(result.signals.process,'blocked');assert.equal(result.helpKey,'power');
 result=productionSignals({raw:0,haul:30,process:80,trade:90},{tone:'idle',stage:'raw',issue:'no-input'});assert.equal(result.signals.raw,'idle');
 assert.deepEqual(Object.values(productionSignals({raw:20,haul:20,process:20,trade:20},{tone:'working'}).signals),['normal','normal','normal','normal']);
});
test('context offers use real unlocks, prices and only modifications which affect the selected capacity',()=>{
 const s=fixture();s.money=0;s.counts.M16=2;s.upgrades.levels={};s.upgrades.revision=0;
 const before=JSON.stringify(s),ow=productionOffers(s,'overworld','haul'),nt=productionOffers(s,'nether','haul');
 assert.ok(ow.some(r=>r.mod==='rail-wagons'));assert.ok(!nt.some(r=>r.mod==='rail-wagons'));
 assert.ok(!ow.some(r=>['V4','V15','V2'].includes(r.id)));assert.ok(!ow.some(r=>r.mod==='store-shelves'));
 assert.ok(productionOffers(s,'overworld','rawStorage').some(r=>r.mod==='drill-buffer'));
 assert.ok(!productionOffers(s,'nether','rawStorage').some(r=>r.mod==='drill-buffer'));
 assert.ok(productionOffers(s,'overworld','power').every(r=>!r.mod||['torch-bank','torch-core','torch-module','wind-blades','wind-gears','wind-coils'].includes(r.mod)));
 assert.ok(ow.some(r=>r.status.kind==='short'));assert.equal(JSON.stringify(s),before);
 const start=fresh();assert.ok(productionOffers(start,'overworld','haul').every(r=>r.status.kind==='locked'));assert.deepEqual(productionOffers(s,'invalid','haul'),[]);
});
test('buying a suggested market modification pays once and raises the real trade capacity; owned complete disappears',()=>{
 const s=fixture();s.counts.V3=2;s.counts.M4=2;s.money=1e7;s.upgrades.levels['market-pack']=0;s.upgrades.revision++;
 const row=productionOffers(s,'overworld','trade').find(r=>r.mod==='market-pack');assert.equal(row.status.kind,'ready');
 const cash=s.money,prior=rates(s).regions.overworld.trade;
 assert.ok(buyUpgrade(s,row.mod).ok);assert.equal(s.money,cash-row.status.cost);assert.ok(rates(s).regions.overworld.trade>prior);
 s.upgrades.levels['market-pack']=3;s.upgrades.revision++;assert.ok(!productionOffers(s,'overworld','trade').some(r=>r.mod==='market-pack'));
});
test('paused and disconnected causes route to the affected device, not a compulsory new power purchase',()=>{
 const s=fixture();s.grid.disabled=['M9'];s.grid.revision++;
 let report=rates(s),actual=productionSummary(s,report.electricity,'overworld');
 assert.equal(actual.issue,'off');assert.equal(actual.target,'M9');assert.equal(actual.stage,'raw');
 s.grid.disabled=[];s.grid.links.M9=false;s.grid.revision++;
 report=rates(s);actual=productionSummary(s,report.electricity,'overworld');assert.equal(actual.issue,'not-connected');assert.equal(actual.target,'M9');
});
