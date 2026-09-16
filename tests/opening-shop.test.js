import test from 'node:test';
import assert from 'node:assert/strict';
import { buy, restore } from '../src/game.js';
import { fresh } from './helpers/first-time-game.js';
import { buyGuidance } from '../src/guidance.js';
import { openingShop } from '../src/opening-shop.js';

test('rescuing information recommends goals, then leaves room for tools and first income',()=>{
 const s=fresh();s.money=1000;
 assert.deepEqual(openingShop(s),{captive:true,features:['info']});
 assert.ok(buyGuidance(s,'info').ok);
 assert.deepEqual(openingShop(s),{captive:false,features:['goals']});
 assert.ok(buyGuidance(s,'goals').ok);
 assert.deepEqual(openingShop(restore(s)).features,[]);
 for(const id of ['T1','V1','V18']){assert.ok(buy(s,id).ok);assert.deepEqual(openingShop(restore(s)).features,[]);}
 assert.equal(s.guidance.counter,false);assert.equal(s.guidance.nameplate,false);
 assert.ok(buy(s,'V2').ok);assert.equal(openingShop(s),null);
});
test('optional interface purchases remain available early but cannot displace goals',()=>{
 const s=fresh();s.money=1000;buyGuidance(s,'info');
 for(const id of ['nameplate','counter']){assert.ok(buyGuidance(s,id).ok);assert.deepEqual(openingShop(restore(s)).features,['goals']);}
});
test('legacy games and players bypassing the narrator keep their catalogue',()=>{
 const legacy=fresh();legacy.narrative.legacy=true;assert.equal(openingShop(legacy),null);
 const s=fresh();s.money=100;assert.ok(buy(s,'T1').ok);
 assert.deepEqual(openingShop(s),{captive:false,features:['info']});
});
