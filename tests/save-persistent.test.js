import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'fflate';
import { fresh, restore, advance, settleOffline, redeemMail } from '../src/game.js';
import { readMail } from '../src/mail.js';
import { persistentSave } from '../src/save-persistent.js';
import { packSaveV2, unpackSaveV2 } from '../src/save-packed-v2.js';
import { encodeCompactSave, encodePersistentSave, decodeSave, checksum } from '../src/save-code.js';
import { encodeText } from '../src/save-text.js';
import { victorySource } from '../src/victory.js';
import { residentFixture } from '../scripts/resident-fixture.mjs';
import { plantGarden, gardenSites, gardenPlacementReason, clearGarden, gardenObjects } from '../src/garden.js';
import { buildHome, housingSites, housingPlacementReason } from '../src/housing.js';
import { worldScenery } from '../src/layout.js';
const clone = s => JSON.parse(JSON.stringify(s));
const fixture = file => JSON.parse(fs.readFileSync(new URL('../' + file, import.meta.url)));
const rng = () => { let x = 42; return () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 2 ** 32); };
function continueWorld(s, seconds) {
  const original = Math.random; Math.random = rng();
  try { for (let i = 0; i < seconds; i++) advance(s, 1); } finally { Math.random = original; }
}
const files = [
  ...fixture('docs/v1.7/qa/save-code-compression/trained-dictionary.json').trainingFiles,
  'docs/v1.6/qa/feasibility/village-first-900-save.json',
  ...['industrial-first', 'village-first', 'livestream-first'].map(n => `docs/v1.7/qa/balance-baseline/${n}-save.json`),
];

test('persistent format dictionaries and cross-shape/text golden bytes remain frozen', () => {
  for (const [file, hash] of [['persistent-defaults-v1.json', 'f4f6413e64006f6de1cc56ebf1317b621ee8004aa1c5e6aafac9cbaea0f6cd0e'], ['words-v2.json', '3a07bc18cd3af3e3fdda00269ee03614ac8e3e05152b9f0c57f6d456a64ff247']])
    assert.equal(createHash('sha256').update(fs.readFileSync(new URL('../src/save-format/' + file, import.meta.url))).digest('hex'), hash);
  const row = { id: 'resident-1', name: '阿木', status: '在村庄散步', x: 1.5, z: 1.5, job: 'farmer', text: '红石钻机加入世界' };
  const { status, ...subset } = row, value = [row, subset];
  const hex = '0702080007820283028c02c901ca018502dd0206860406960906af090b00030b000306e2080d02fe0496080c55000682028302c901ca018502dd0200';
  assert.equal(Buffer.from(packSaveV2(value)).toString('hex'), hex);
  assert.deepEqual(unpackSaveV2(Buffer.from(hex, 'hex')), value);
});

test('persistent projection restores the complete state in all 29 historical simulation fixtures', () => {
  for (const file of files) {
    const raw = fixture(file), before = JSON.stringify(raw), projected = persistentSave(raw);
    assert.deepEqual(restore(projected, 42000), restore(clone(raw), 42000), file);
    assert.equal(JSON.stringify(raw), before, 'export must not mutate the running world');
    assert.equal(JSON.stringify(projected.victory), JSON.stringify(raw.victory), 'historical renderer input');
    const code = encodePersistentSave(raw, 'test', 42), restored = decodeSave(code).save;
    assert.deepEqual(restore(restored, 42000), restore(clone(raw), 42000), file);
    assert.ok(code.length <= encodeCompactSave(raw, 'test', 42).length, file);
  }
});
test('three late routes and active village keep exact income, cargo, jobs and historical views after 120 foreground seconds', () => {
  for (const file of files.slice(-4)) {
    const raw = fixture(file), a = restore(clone(raw), 42000), b = restore(decodeSave(encodePersistentSave(raw, 'test', 42)).save, 42000);
    const p = restore(persistentSave(raw), 42000);
    continueWorld(a, 120); continueWorld(b, 120); continueWorld(p, 120);
    assert.deepEqual(b, a, file); assert.deepEqual(p, a, file + ' pruned');
    assert.deepEqual(victorySource(b), victorySource(a));
    const c = restore(decodeSave(encodePersistentSave(b, 'test', 42)).save, 42000), baseline = restore(clone(a), 42000);
    continueWorld(c, 15); continueWorld(baseline, 15); assert.deepEqual(c, baseline, 're-export and reload');
  }
});
test('real housing, moved natural scenery, purchased plants and claimed rewards survive', () => {
  let s = residentFixture(); s.counts.V20 = 3; s.play = 950;
  for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) if (!s.chunks.overworld.some(p => p.x === x && p.z === z)) s.chunks.overworld.push({ x, z });
  s.layoutRevision++;
  s = restore(clone(s), 42000); // Place the fixture's newly granted garden facility first.
  for (const type of ['oak', 'hearth']) {
    const site = housingSites(s, type, 1).find(p => !housingPlacementReason(s, type, p));
    assert.ok(site); assert.ok(buildHome(s, type, site).ok);
  }
  const tree = gardenObjects(s).find(p => p.kind === 'tree'); assert.ok(clearGarden(s, tree.id).ok);
  for (const type of ['wildflowers', 'hedge', 'turf']) {
    const site = gardenSites(s, type, 1).find(p => !gardenPlacementReason(s, type, p));
    assert.ok(site); assert.ok(plantGarden(s, type, site).ok);
  }
  s.community.residents[0].name = '阿木🌱\ud800';
  const a = restore(clone(s), 42000), b = restore(decodeSave(encodePersistentSave(s, 'test', 42)).save, 42000);
  assert.deepEqual(a, b); assert.deepEqual(worldScenery(a), worldScenery(b));
  assert.deepEqual(a.garden.plants, s.garden.plants); assert.deepEqual(a.garden.cleared, s.garden.cleared);
  const before = b.money; settleOffline(b); assert.equal(b.money, before);
  continueWorld(a, 1); continueWorld(b, 1);
  assert.ok(a.rate > 0);
  for (const id of Object.keys(a.mail.letters || {})) {
    assert.deepEqual(readMail(a, id), readMail(b, id));
    assert.deepEqual(redeemMail(a, id), redeemMail(b, id));
    const c = restore(decodeSave(encodePersistentSave(b, 'test', 42)).save, 42000);
    assert.deepEqual(redeemMail(c, id), redeemMail(restore(clone(a), 42000), id));
    assert.equal(c.money, a.money);
  }
});
test('only known runtime fields are omitted; goods, choices, exact numbers and unknown extensions stay', () => {
  const s = fresh(42);
  s.community.residents = [{ id: 'resident-1', look: { skin: 2 }, path: [{ x: 2, z: 4 }], cargo: { batch: 'b' }, progress: .123456789, custom: { y: 7 }, job: 'farmer', skills: { farming: 5 }, x: .87654321, z: 4 }];
  s.community.batches = [{ id: 'b', qty: 17.25, delivered: 2, value: 4.5, claimed: 'resident-1', owners: { 'resident-1': .85 }, future: 7 }];
  s.community.golems = [{ id: 'golem-1', stops: ['M2', 'V4'], upgrades: { route: 2 }, x: 4, z: 5 }];
  s.dimensions.trips.E3 = { cargo: 4, duration: 7, remaining: 3, at: 8, capacity: 99, from: 'end', future: true };
  s.extra = { str: '玩家昵称与随机文本🌱\ud800\udfff', number: Number.MIN_VALUE, money: 123456789.1234567 };
  const p = persistentSave(s);
  assert.equal(p.community.residents[0].look, undefined); assert.equal(p.community.residents[0].cargo, undefined);
  assert.equal(p.community.batches[0].claimed, undefined); assert.equal(p.community.batches[0].qty, 17.25);
  assert.deepEqual(p.community.golems, s.community.golems); assert.deepEqual(p.extra, s.extra);
  assert.deepEqual(p.dimensions.trips.E3, { cargo: 4, duration: 7, remaining: 3, at: 8, future: true });
  for (let version = 2; version < 7; version++) { const old = { ...s, version }; assert.deepEqual(persistentSave(old), old); }
});
test('new object differences and text fragments are exact for Unicode, missing keys, arrays and unknown content', () => {
  const random = rng();
  for (let i = 0; i < 120; i++) {
    const record = { id: 'resident-1', name: '阿木', foo: [random(), i, null], path: [], status: '在村庄散步', job: 'hauler', money: random() * 1e30 };
    const subset = { id: record.id, name: record.name, foo: record.foo, job: record.job, money: record.money };
    const payload = { full: record, subset, variant: { ...subset, money: Number.MIN_VALUE, future: '\ud800🌱' }, messages: ['红石钻机加入世界', '红石钻机加入世界', '自定义🌱升级', '阿木：可以收获了！'] };
    const before = JSON.stringify(payload), b = packSaveV2(payload), restored = unpackSaveV2(b);
    assert.equal(JSON.stringify(restored), before); restored.full.foo.push('changed'); assert.deepEqual(restored.subset.foo, subset.foo);
  }
});
test('new-code corruption, reference expansion and text-fragment expansion are bounded', () => {
  const wrap = bytes => { const z = gzipSync(Uint8Array.from([2, ...bytes])); return `MCC3.${encodeText(z)}.${checksum(z)}`; };
  for (const data of [[12, 255, 255, 127], [12, 0, 0, 1, 0, 3, 34, 120, 34, 0], [13, 255, 255, 127], [5, 0, 0, 0, 0, 0, 0, 240, 127]]) assert.throws(() => decodeSave(wrap(data)));
  assert.throws(() => unpackSaveV2(packSaveV2(Array(10000).fill({ text: 'x'.repeat(1000) }))), /过大/);
  const code = encodePersistentSave(fresh(42), 'test', 42);
  assert.throws(() => decodeSave(code.slice(0, -1))); assert.throws(() => decodeSave(code.replace('MCC3.', 'MCC4.')), /新版/);
  const newKind = wrap([...packSaveV2({ game: 'mc-clicker-2', save: fresh(42) })]);
  for (const format of ['MCC1', 'MCC2']) assert.throws(() => decodeSave(newKind.replace('MCC3', format)));
});
