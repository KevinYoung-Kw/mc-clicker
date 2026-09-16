import test from 'node:test';
import assert from 'node:assert/strict';
import { fresh, restore } from '../src/game.js';
import { CATALOG } from '../src/catalog.js';
import { WEB_ITEMS } from '../src/web-catalog.js';
import { COLLECTION } from '../src/collection.js';
import { ENV_MODULES } from '../src/environment.js';
import { atlasProgress, atlasCount } from '../src/atlas-progress.js';

test('all modern purchases complete the atlas without buying removed category bundles', () => {
  const s = fresh();
  for (const i of CATALOG) if (!atlasProgress(s, i.id).group) s.counts[i.id] = 1;
  const baseline = atlasCount(s);
  assert.equal(baseline, CATALOG.length - 5);
  for (const item of WEB_ITEMS) s.webAppearance.owned[item.id] = true;
  for (const item of COLLECTION) if (['studio', 'flag'].includes(item.category)) s.scenery.owned[item.id] = true;
  for (const item of ENV_MODULES) s.environment.modules[item.id] = true;
  const counts = structuredClone(s.counts), money = s.money;
  assert.equal(atlasCount(s), CATALOG.length);
  for (const id of ['X3', 'X4', 'X5', 'X6', 'X8']) assert.equal(atlasProgress(s, id).complete, true, id);
  s.webAppearance.equipped = {}; s.scenery.equipped = {};
  s.environment.enabled = {}; s.facilityStorage.X2 = true;
  assert.equal(atlasCount(restore(JSON.parse(JSON.stringify(s)))), CATALOG.length);
  assert.deepEqual(s.counts, counts);
  assert.equal(s.money, money);
});

test('partial collections show real progress; unknown and disabled entries cannot fake completion', () => {
  const s = fresh(), titles = WEB_ITEMS.filter(i => i.category === 'title');
  s.webAppearance.owned.invalid = true;
  for (const item of titles.slice(1)) s.webAppearance.owned[item.id] = true;
  assert.deepEqual(atlasProgress(s, 'X3'), {group:true, collected:titles.length-1,total:titles.length,complete:false});
  s.webAppearance.owned[titles[0].id] = false;
  assert.equal(atlasProgress(s, 'X3').complete, false);
  s.webAppearance.owned[titles[0].id] = true;
  assert.equal(atlasProgress(s, 'X3').complete, true);
  assert.equal(atlasCount(s), 1);
  s.counts.unknown = 99;
  assert.equal(atlasCount(s), 1);
});

test('older purchased whole packs remain credited without requiring a second payment', () => {
  const s = fresh();
  for (const id of ['X3', 'X4', 'X5', 'X6', 'X8']) s.counts[id] = 1;
  assert.equal(atlasCount(s), 5);
  assert.equal(atlasCount(restore(s)), 5);
});
