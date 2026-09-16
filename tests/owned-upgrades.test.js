import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh, price, restore } from '../src/game.js';
import { CATALOG, ITEMS } from '../src/catalog.js';
import { ownedGroups, ownedUpgrade, placementFor } from '../src/facility-shops.js';
import { buyUpgrade, facilityUpgrades, upgradePrice, upgradeStatus } from '../src/upgrades.js';
import { postalUpgradeCost } from '../src/mail.js';
import { createUpgradesUI, nearUpgrades } from '../src/upgrades-ui.js';

function established() {
  const s = fresh(42);
  for (const i of CATALOG) s.counts[i.id] = Number.isFinite(i.max) ? i.max : 40;
  s.money = 1e15;
  s.endEyes = 12;
  return s;
}
const ids = list => list.map(i => i.id);

test('owned land is absent from upgrade and completed facilities but remains expandable', () => {
  const s = fresh(42);
  s.counts = {T1: 1, V1: 40};
  const before = structuredClone(s), cost = price(s, ITEMS.V1);
  assert.equal(ownedUpgrade(s, ITEMS.V1), null);
  const groups = ownedGroups(s, CATALOG);
  assert.deepEqual(groups.upgradable, []);
  assert.deepEqual(ids(groups.complete), ['T1']);
  assert.equal(placementFor(s, 'V1'), 'outdoor');
  assert.equal(price(s, ITEMS.V1), cost);
  assert.deepEqual(s, before);
});

test('owned list orders displayed next costs, including postal levels and maxed owners with unfinished mods', () => {
  const s = established();
  s.counts.M7 = 3;
  s.counts.V4 = 1;
  s.mail.postalLevel = 2;
  const items = ['V1', 'M7', 'M9', 'V4', 'V18', 'T1'].map(id => ITEMS[id]);
  assert.deepEqual(ids(ownedGroups(s, items).upgradable), ['V18', 'V4', 'M9', 'M7']);
  assert.equal(ownedUpgrade(s, ITEMS.V18).cost, postalUpgradeCost(s));
  assert.equal(ownedUpgrade(s, ITEMS.M7).cost, price(s, ITEMS.M7));
  assert.deepEqual(ownedUpgrade(s, ITEMS.M9), {kind: 'mod', id: 'drill-steel', cost: 4000, locked: false});
  s.mail.postalLevel = 5;
  assert.equal(ownedUpgrade(s, ITEMS.V18), null);
  assert.ok(ids(ownedGroups(s, items).complete).includes('V18'));
});

test('list order does not depend on wallet balance or mutate a save; prices recalculate after upgrading', () => {
  const s = established();
  s.counts.M7 = 3;
  s.counts.V4 = 1;
  const before = structuredClone(s), items = ['M7', 'V4', 'M9'].map(id => ITEMS[id]);
  const order = ids(ownedGroups(s, items).upgradable);
  assert.deepEqual(s, before);
  s.money = 0;
  assert.deepEqual(ids(ownedGroups(s, items).upgradable), order);
  s.counts.V4 = 12;
  for (const row of facilityUpgrades('V4')) s.upgrades.levels[row.id] = row.maxLevel;
  assert.deepEqual(ids(ownedGroups(s, items).upgradable), ['M9', 'M7']);
  assert.deepEqual(ids(ownedGroups(restore(s), items).upgradable), ['M9', 'M7']);
});

test('prerequisite-locked upgrades follow available upgrades regardless of price', () => {
  const s = established();
  for (const row of facilityUpgrades('M9')) s.upgrades.levels[row.id] = row.maxLevel;
  delete s.upgrades.levels['drill-diamond'];
  // Only diamond remains, requiring the missing diamond pickaxe.
  delete s.counts.T5;
  const diamond = ownedUpgrade(s, ITEMS.M9);
  assert.equal(diamond.id, 'drill-diamond');
  assert.equal(diamond.locked, true);
  s.counts.M7 = 8;
  assert.ok(price(s, ITEMS.M7) > diamond.cost);
  assert.deepEqual(ids(ownedGroups(s, [ITEMS.M9, ITEMS.M7]).upgradable), ['M7', 'M9']);
});

test('special facility prices use the actual purchase function', () => {
  const s = established();
  s.counts.V20 = 1;
  assert.equal(ownedUpgrade(s, ITEMS.V20).cost, price(s, ITEMS.V20));
});

test('blocking housing and population conditions use the same lock state as purchase buttons', () => {
  const s = established();
  s.counts.V2 = 3;
  s.mail.postalLevel = 2;
  assert.equal(ownedUpgrade(s, ITEMS.V2).locked, true);
  assert.deepEqual(ids(ownedGroups(s, [ITEMS.V2, ITEMS.V18]).upgradable), ['V18', 'V2']);
});

test('modification list and shortlist use next rank price rather than base price', () => {
  const s = established();
  s.research.completed={industrial:true,modern:true};s.upgrades.levels['wind-blades'] = 1;
  const order = ['wind-gears', 'wind-blades', 'wind-coils'];
  assert.deepEqual(ids(nearUpgrades(s, 'M7')), order);
  const ui = createUpgradesUI({state: () => s});
  const shown = () => [...ui.render('M7').matchAll(/data-mod-card="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(shown(), order);
  assert.equal(buyUpgrade(s, 'wind-blades').ok, true);
  assert.ok(upgradePrice(s, 'wind-blades') > upgradeStatus(s, 'wind-coils').cost);
  assert.deepEqual(shown(), ['wind-gears', 'wind-coils', 'wind-blades']);
  s.money = 0;
  assert.deepEqual(shown(), ['wind-gears', 'wind-coils', 'wind-blades']);
});
