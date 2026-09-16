import test from 'node:test';
import assert from 'node:assert/strict';
import {fresh,requirements} from '../src/game.js';
import {CATALOG,ITEMS} from '../src/catalog.js';
import {inConstruction,ownedGroups} from '../src/facility-shops.js';
import {ensureCommunity,assignJob} from '../src/residents.js';
import {discoveryStock,developmentStep,createDevelopmentGuide,DEVELOPMENT_ORDER} from '../src/development.js';
import {buyGuidance} from '../src/guidance.js';

function village(){
 const s=fresh(0);Object.assign(s.counts,{T1:1,V1:1,V18:1,V2:1,T7:1,V3:1,T2:1});
 ensureCommunity(s);return s;
}
const ids=items=>items.map(i=>i.id).sort();

test('goals lead the opening; counter and nameplate wait until the first resident',()=>{
 const s=fresh(0);s.money=100;const guide=createDevelopmentGuide();
 assert.equal(guide(s).id,'T1');buyGuidance(s,'info');
 assert.equal(guide(s).key,'feature:goals');
 assert.ok(discoveryStock(s).available.some(i=>i.id==='T1'));
 const step=guide(s);s.money=0;assert.equal(guide(s),step);
 s.money=100;buyGuidance(s,'goals');assert.equal(guide(s).id,'T1','buying goals invalidates the cached recommendation immediately');
 s.counts.T1=1;assert.equal(guide(s).id,'V1');
 s.counts.V1=1;assert.equal(guide(s).id,'V18');
 s.counts.V18=1;assert.equal(guide(s).id,'V2');
 s.counts.V2=1;assert.equal(guide(s).key,'feature:counter');
 buyGuidance(s,'nameplate');assert.equal(guide(s).key,'feature:counter');
 buyGuidance(s,'counter');assert.equal(guide(s).id,'T7');
});
test('late and out-of-order purchases never recommend owned features',()=>{
 const s=village();s.money=200;buyGuidance(s,'info');
 assert.equal(developmentStep(s).key,'feature:goals');
 buyGuidance(s,'goals');assert.equal(developmentStep(s).key,'feature:counter');
 buyGuidance(s,'counter');assert.equal(developmentStep(s).key,'feature:nameplate');
 buyGuidance(s,'nameplate');assert.equal(developmentStep(s).id,'T3');
});

test('all unlocked outdoor goods stay discoverable regardless of recommendation, money or family',()=>{
 const s=village();
 const expected=CATALOG.filter(i=>inConstruction(i)&&!s.counts[i.id]&&!requirements(s,i).length);
 assert.ok(expected.length>5);
 assert.deepEqual(ids(discoveryStock(s).available),ids(expected));
 assert.equal(discoveryStock(s).available[0].id,'T3');
 s.money=1e9;
 assert.deepEqual(ids(discoveryStock(s).available),ids(expected));
 for(const family of ['T','V','M','L'])
  assert.deepEqual(ids(discoveryStock(s,family).available),ids(expected.filter(i=>i.family===family)));
});

test('first-work suggestion uses a real empty job, without assigning, spending or hiding other goods',()=>{
 const s=village();s.counts.V4=1;const before=JSON.stringify(s);
 assert.equal(developmentStep(s).job,'farmer');assert.equal(JSON.stringify(s),before);
 const stock=ids(discoveryStock(s).available);
 assert.ok(stock.includes('T3'));assert.ok(stock.includes('M1'));
 assert.ok(assignJob(s,'resident-1','farmer').ok);
 assert.equal(developmentStep(s).kind,'purchase'); // Never force a wait for a harvest.
 assert.deepEqual(ids(discoveryStock(s).available),stock);
});

test('reserved or busy workers do not create an impossible assignment prompt',()=>{
 const s=village();s.counts.V4=1;
 s.community.residents[0].cargo={id:1,qty:3};assert.equal(developmentStep(s).kind,'purchase');
 s.community.residents[0].cargo=null;s.community.residents[0].reserve=true;
 assert.equal(developmentStep(s).kind,'purchase');
});

test('real waiting batches suggest a hauler, then stop after one has been assigned',()=>{
 const s=village();s.community.batches=[{qty:5,delivered:0,claimed:null}];
 assert.equal(developmentStep(s).job,'hauler');assert.equal(developmentStep(s).id,'V3');
 assignJob(s,'resident-1','hauler');assert.equal(developmentStep(s).kind,'purchase');
});

test('connection teaching uses a real enabled unconnected load and ends after connection learning',()=>{
 const s=village();Object.assign(s.counts,{M5:1,M3:1});
 const report={electricity:{loads:[{id:'M3',enabled:true,connected:false,rated:1}]}};
 assert.equal(developmentStep(s,report).id,'M6');
 s.counts.M6=1;assert.equal(developmentStep(s,report).kind,'power');
 s.grid.learnedConnection=true;assert.equal(developmentStep(s,report).kind,'purchase');
 s.grid.learnedConnection=false;s.grid.disabled.push('M3');
 assert.equal(developmentStep(s,report).kind,'purchase');
});

test('level prerequisites are offered as upgrades to an existing building',()=>{
 const s=village();s.research.completed.industrial=true;Object.assign(s.counts,{T3:1,V4:1,V6:1,V11:1,M1:1,M2:1,M5:1,M6:1,M7:1,M9:1});
 s.community.residents[0].jobsDone=1;
 const step=developmentStep(s);assert.equal(step.id,'M2');assert.equal(step.kind,'purchase');
 assert.equal(requirements(s,ITEMS.M3).length,1);
 assert.ok(discoveryStock(s,'M').soon.some(i=>i.id==='M3'));
 s.counts.M2=2;assert.equal(developmentStep(s).id,'M3');
});

test('rail is visible before it is recommended; transport pressure changes priority, not unlocks',()=>{
 const s=village();
  s.research.completed={industrial:true,modern:true,railway:true,automation:true,broadcasting:true};
 for(const id of DEVELOPMENT_ORDER.slice(0,DEVELOPMENT_ORDER.indexOf('M16')))s.counts[id]=1;
 s.community.residents[0].jobsDone=1;
 s.counts.M4=1;s.grid.learnedConnection=true;s.buffers.overworld.raw=40;
 const report={regions:{overworld:{bottleneck:'运输'}}};
 assert.equal(developmentStep(s,report).id,'M16');
 assert.notEqual(developmentStep(s,{regions:{overworld:{bottleneck:'加工'}}}).id,'M16');
 assert.ok(discoveryStock(s,'M').available.some(i=>i.id==='M16'));
 const guide=createDevelopmentGuide();const suggested=guide(s,report);
 s.money+=100;s.play+=2;s.buffers.overworld.raw=0;
 assert.equal(guide(s,{regions:{overworld:{bottleneck:'加工'}}}),suggested);
 s.counts.M16=1;assert.notEqual(guide(s,report).id,'M16');
});

test('indoor collections retain their own entrance rather than duplicate outdoor rows',()=>{
 const s=village();s.counts.L2=1;delete s.counts.L1;
 const stock=discoveryStock(s).available;
 assert.ok(!stock.some(i=>i.id==='L1'||i.id==='L3'));
});

test('postal upgrades are discoverable in the upgradable group until genuinely maxed',()=>{
 const s=village();s.mail.postalLevel=1;
 assert.deepEqual(ownedGroups(s,[ITEMS.V18]).upgradable,[ITEMS.V18]);
 s.mail.postalLevel=5;assert.deepEqual(ownedGroups(s,[ITEMS.V18]).complete,[ITEMS.V18]);
});
