import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh, restore, advance, rates, earn, emit } from '../src/game.js';
import { enqueueBatch, sellCommunity } from '../src/operations.js';
import { deliverOrders } from '../src/orders.js';
import { recordMarketSale, MARKET_RECEIPT_LIMIT } from '../src/market-ledger.js';
import { storageCapacity } from '../src/upgrades.js';
import { productionSummary, productionSummaryMarkup } from '../src/production-summary.js';
import { connectAll } from '../src/power.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
test('receipts only record actual sales, group small settlements, persist and never award money on restore',()=>{
 let s=fresh(0);s.counts.V3=1;
 assert.ok(enqueueBatch(s,'V4','小麦',24,4,{},'wheat'));
 s.community.batches[0].delivered=24;
 s.orders=[{id:1,realm:'overworld',kind:'wheat',progress:0,target:10,reward:100,life:100}];
 sellCommunity(s,1,0,8,0,{earn,emit,deliverOrders});assert.equal(s.marketLedger,undefined);assert.equal(s.total,0);
 sellCommunity(s,1,0,8,0,{earn,emit,deliverOrders});assert.equal(s.marketLedger.receipts[0].quantity,6);
 sellCommunity(s,1,0,8,0,{earn,emit,deliverOrders});assert.equal(s.community.batches.length,0);
 assert.equal(s.marketLedger.receipts.length,1);assert.equal(s.marketLedger.receipts[0].quantity,14);
 assert.equal(s.marketLedger.receipts[0].money,56);assert.equal(s.money,56);
 s=restore(JSON.parse(JSON.stringify(s)),467000);assert.equal(s.money,56);assert.equal(s.marketLedger.receipts[0].money,56);
 sellCommunity(s,1,10,10,0,{earn,emit,deliverOrders});assert.equal(s.money,56);
 for(let i=0;i<80;i++){s.play+=10;recordMarketSale(s,{source:'test',label:'成品',realm:'overworld',quantity:1,money:1});}
 assert.equal(s.marketLedger.receipts.length,MARKET_RECEIPT_LIMIT);assert.equal(s.money,56);
 const old=fresh(0);assert.deepEqual(restore(old).marketLedger.receipts,[]);
});
test('three worlds conserve produced goods through processing, orders, project and market across stop/reload',()=>{
 let s=fresh(0);s.counts={T7:1,V3:1,M2:1,N1:1,E2:1,Z2:1};s.endEyes=12;
 for(const realm of Object.keys(s.buffers))Object.assign(s.buffers[realm],{raw:40,goods:20});
 s.orders=Object.keys(s.buffers).map((realm,i)=>({id:i+1,realm,target:4,progress:0,reward:100,life:200,kind:'goods'}));
 let created=0,disposed=0,sales=0,initial=180;
 for(let second=0;second<60;second++){
  if(second===10){s.grid.disabled.push('M2');}
  if(second===20){s.grid.disabled=[];s=restore(JSON.parse(JSON.stringify(s)),467000);}
  const r=rates(s);
  for(const realm of Object.keys(s.buffers))created+=Math.min(r.regions[realm].raw,Math.max(0,storageCapacity(s,realm,'raw')-s.buffers[realm].raw));
  advance(s,1);
  for(const [realm,flow] of Object.entries(s.transport.realms)){
   disposed+=flow.sold+flow.orders+flow.project;sales+=flow.sold*r.regions[realm].value;
  }
  const stock=Object.values(s.buffers).reduce((v,b)=>v+b.raw+b.goods,0);
  close(stock+disposed,initial+created);
 }
 // The legacy cumulative production counter includes order rewards. Receipts
 // intentionally show only the ordinary sale, never those bonuses twice.
 close(s.productionIncome,sales+s.ordersCompleted*100);
 close(s.marketLedger.receipts.reduce((v,r)=>v+r.money,0),sales);
 assert.equal(s.ordersCompleted,3);
 assert.ok(s.project>0);
});
test('production overview distinguishes actual settlement from theoretical capacity and identifies a paused source',()=>{
 const s=fresh(0);s.counts={M9:1,M5:1,V3:1};s.grid.disabled=['M9'];
 const overview=productionSummary(s);assert.equal(overview.target,'M9');assert.equal(overview.reason,'设备已暂停');
 s.transport={realms:{overworld:{at:s.play,dt:.25,processed:5,sold:2,orders:1,project:2}}};
 const active=productionSummary(s);assert.equal(active.processed,20);assert.equal(active.sold,8);assert.equal(active.orders,4);assert.equal(active.project,8);
 s.play+=10;assert.equal(productionSummary(s).sold,0);
 const disconnected=fresh(0);disconnected.counts={M1:1,M2:1,M4:1,V3:1,M5:1,M6:2};
 disconnected.chunks.overworld=[{x:0,z:0},{x:2,z:0}];
 disconnected.placements=Object.fromEntries(Object.entries({M1:[0,0],M2:[10,0],M4:[10,1.5],V3:[10,-1.5],M5:[9,1.5],M6:[9,-1.5]}).map(([id,[x,z]])=>[id,{x,z,realm:'overworld'}]));
 connectAll(disconnected);
 const stopped=productionSummary(disconnected);
 assert.equal(stopped.reason,'采集线路未接通');assert.equal(stopped.target,'M1');assert.equal(stopped.tone,'blocked');
});
test('the overview reveals order and engineering fields independently with their actual unlocks',()=>{
 const s=fresh(0);
 assert.doesNotMatch(productionSummaryMarkup(s),/data-production-value="(?:orders|project)"/);
 s.counts.V17=1;
 assert.match(productionSummaryMarkup(s),/data-production-value="orders"/);
 assert.doesNotMatch(productionSummaryMarkup(s),/data-production-value="project"/);
 s.counts.Z2=1;
 assert.match(productionSummaryMarkup(s),/data-production-value="project"/);
 s.counts.V17=0;s.upgrades.levels['piglin-contract']=1;s.upgrades.revision++;
 assert.match(productionSummaryMarkup(s),/data-production-value="orders"/);
});
