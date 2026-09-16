import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh, buy, price, frontier, restore } from '../src/game.js';
import { ITEMS } from '../src/catalog.js';
import { landPrice, landPurchaseCount, LAND_PRICING } from '../src/land.js';
import { purchaseStatus } from '../src/purchase-feedback.js';

function openWorlds() {
  const s = fresh();
  Object.assign(s.counts, { T1: 1, N1: 1, E2: 1 });
  s.endEyes = 12;
  return s;
}
function expand(s, realm, position = frontier(s, realm)[0]) {
  const cost = price(s, ITEMS.V1, realm);
  s.money = cost + 1000;
  const result = buy(s, 'V1', { ...position, realm });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.cost, cost);
  assert.equal(s.money, 1000);
  return result;
}

test('land prices grow within their own dimension, keeping the first overworld purchase at 25', () => {
  const s = openWorlds();
  assert.deepEqual(Object.keys(LAND_PRICING).map(r => landPrice(s,r)), [25,25000,2500000]);
  expand(s, 'overworld');
  assert.equal(s.chunks.overworld.length, 1, 'first purchase unfolds the starter island');
  assert.equal(landPurchaseCount(s, 'overworld'), 1);
  assert.equal(landPrice(s, 'overworld'), 42);
  const mainCost = landPrice(s, 'overworld');
  expand(s, 'nether');
  assert.equal(s.chunks.nether.length, 2);
  assert.equal(landPrice(s, 'nether'), 41250);
  assert.equal(landPrice(s, 'end'), 2500000);
  assert.equal(landPrice(s, 'overworld'), mainCost);
  expand(s, 'end');
  assert.equal(landPrice(s, 'end'), 4125000);
  expand(s, 'overworld');
  assert.equal(landPrice(s, 'overworld'), 69);
});

test('each dimension expands beyond the former shared cap, including after loading a long island', () => {
  const s = openWorlds();
  for (const realm of Object.keys(LAND_PRICING)) {
    for (let k = 0; k < 36; k++) {
      const x = realm === 'overworld' ? k : k + 1;
      expand(s, realm, {x,z:0});
    }
    assert.ok(s.chunks[realm].length > 32);
  }
  assert.equal(s.counts.V1, 108);
  s.counts.M2 = 1;
  s.placements.M2 = { realm:'overworld', x:175, z:0 };
  const quoted = Object.keys(LAND_PRICING).map(r => landPrice(s,r));
  const loaded = restore(JSON.parse(JSON.stringify(s)));
  assert.equal(loaded.counts.V1, 108);
  assert.deepEqual(loaded.chunks, s.chunks, 'no 32-plot or 16-coordinate clipping');
  assert.deepEqual(loaded.placements.M2, s.placements.M2, 'far buildings retain their land and position');
  assert.deepEqual(Object.keys(LAND_PRICING).map(r => landPrice(loaded,r)), quoted);
  for (const realm of Object.keys(LAND_PRICING)) {
    const oldPrice = landPrice(loaded, realm);
    loaded.realm = realm;
    loaded.money = oldPrice + 1000;
    assert.equal(purchaseStatus(loaded, ITEMS.V1).kind, 'ready');
    expand(loaded, realm);
    assert.ok(landPrice(loaded, realm) > oldPrice);
  }
});

test('the selected plot determines the charge even when the viewed dimension differs', () => {
  const s = openWorlds();
  expand(s, 'overworld');
  s.realm = 'overworld';
  s.money = 30000;
  const site = {...frontier(s, 'nether')[0], realm:'nether'};
  assert.equal(purchaseStatus(s, ITEMS.V1, {id:'V1',kind:'expand',site}).cost, 25000);
  assert.equal(buy(s, 'V1', site).cost, 25000);
  assert.equal(s.money, 5000);
});

test('blocked expansion never charges or advances prices and still requires an active portal', () => {
  const s = openWorlds();
  expand(s, 'overworld');
  const attempt = site => {
    const before = structuredClone(s);
    assert.equal(buy(s,'V1',site).ok, false);
    assert.deepEqual(s, before);
  };
  s.money = 24999;
  attempt({...frontier(s,'nether')[0],realm:'nether'});
  s.money = 1e9;
  attempt({x:50,z:50,realm:'nether'});
  s.endEyes = 11;
  attempt({...frontier(s,'end')[0],realm:'end'});
  attempt({x:1,z:0,realm:'invalid'});
});

test('old save geometry sets local prices without new counters; invalid plots are still filtered', () => {
  const s = openWorlds();
  s.counts.V1 = 32;
  s.chunks.overworld = Array.from({length:20},(_,x)=>({x,z:0}));
  s.chunks.nether = Array.from({length:9},(_,x)=>({x:-x,z:0}));
  s.chunks.end = Array.from({length:5},(_,x)=>({x,z:0}));
  s.chunks.end.push(null, {x:Infinity,z:0}, {x:1.2,z:0}, {x:0,z:0});
  const loaded = restore(s);
  assert.equal(loaded.chunks.overworld.length, 20);
  assert.equal(loaded.chunks.nether.length, 9);
  assert.equal(loaded.chunks.end.length, 5);
  for (const [realm, count] of [['overworld',20],['nether',8],['end',4]]) {
    assert.equal(landPurchaseCount(loaded,realm), count);
    assert.equal(landPrice(loaded,realm), Math.ceil(LAND_PRICING[realm].base * 1.65**count));
  }
});
