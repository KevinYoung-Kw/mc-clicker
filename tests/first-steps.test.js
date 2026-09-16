import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh, restore, mine, buy, advance, earn } from '../src/game.js';
import { buyGuidance } from '../src/guidance.js';
import { firstPurchasePending, earlyTarget, itemSummary } from '../src/first-steps.js';
import { incomeSnapshot } from '../src/income.js';
import { takeShopHint } from '../src/shop-onboarding.js';
import { ITEMS } from '../src/catalog.js';
test('first purchase is notification at ten emeralds; animation seen does not complete the purchase',()=>{
  const s=fresh();for(let i=0;i<10;i++)mine(s,()=>1);
  assert.equal(takeShopHint(s,10),true);
  const saved=restore(JSON.parse(JSON.stringify(s)));
  assert.equal(takeShopHint(saved,10),false);assert.equal(firstPurchasePending(saved),true);
  const balance=saved.money;assert.ok(buyGuidance(saved,'info').ok);
  assert.equal(saved.money,balance-10);assert.equal(firstPurchasePending(saved),false);
  assert.equal(earlyTarget(saved),'T1');
  const legacy=fresh();legacy.counts.T1=1;assert.equal(firstPurchasePending(restore(legacy)),false);
});
test('early route reaches actual 1 → 2 → 4 per second without jobs, letters or info',()=>{
  const s=fresh();s.money=1000;buyGuidance(s,'goals');
  for(const id of ['T1','V1','V18'])assert.ok(buy(s,id).ok);
  const balance=s.money;advance(s,10);assert.equal(s.money-balance,10);assert.equal(s.rate,1);
  assert.deepEqual(incomeSnapshot(s).rows.map(x=>[x.key,x.rate]),[['postal',1]]);
  assert.equal(earlyTarget(s),'V2');assert.ok(buy(s,'V2').ok);advance(s,1);assert.equal(s.rate,2);
  assert.ok(buy(s,'T7').ok);advance(s,1);assert.equal(s.rate,4);
  const income=incomeSnapshot(s);assert.equal(income.total,s.rate);assert.equal(income.rows.reduce((v,r)=>v+r.rate,0),s.rate);
  assert.equal(income.rows.find(r=>r.key==='base').rate,3);assert.equal(s.guidance.info,false);
  assert.match(itemSummary(s,ITEMS.T7).effect,/1 颗提高到 3 颗/);
});
test('one-time rewards and manual mining do not masquerade as recurring theoretical rates',()=>{
  const s=fresh();s.counts.V18=1;advance(s,1);earn(s,50,'mail');mine(s,()=>1);
  assert.equal(incomeSnapshot(s).total,1);assert.equal(incomeSnapshot(s).recent[0].amount,50);
  const before=s.money;advance(s,5,{offline:true});assert.equal(s.money,before);
});
test('goal tracker resolves a missing predecessor instead of pointing at a locked successor',async()=>{
 const {nextGuidedTarget}=await import('../src/first-steps.js');const s=fresh();
 assert.equal(nextGuidedTarget(s,['M7']),'T1');
 for(const id of ['T1','T7','T2','V1','M1','M2','T3','M3','M5'])s.counts[id]=1;
 assert.equal(nextGuidedTarget(s,['M7']),'M6');s.counts.M6=1;assert.equal(nextGuidedTarget(s,['M7']),'M7');
});
