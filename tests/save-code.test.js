import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
import { fresh, restore, settleOffline } from '../src/game.js';
import { encodeSave, decodeSave, parseSaveJSON, validateSave, checksum, MAX_SAVE_BYTES, MAX_CODE_CHARS } from '../src/save-code.js';
import { BACKUP_KEY, commitImportedSave } from '../src/save-transfer.js';

const codeForBytes = bytes => `MCC1.${Buffer.from(bytes).toString('base64url')}.${checksum(bytes)}`;
test('save code preserves every field including Unicode, preferences and nested snapshots', () => {
  const raw = fresh(123); raw.customFutureField = { text: '小陶 🌳「我的世界」\n换行', data: [1, null, false, 1e30] };
  const code = encodeSave(raw, '1.7.0-alpha.10', 456);
  assert.match(code, /^MCC1\.[\w-]+\.[a-f0-9]{8}$/);
  assert.deepEqual(decodeSave(code), { game: 'mc-clicker-2', release: '1.7.0-alpha.10', createdAt: 456, save: raw });
  assert.deepEqual(JSON.parse(gunzipSync(Buffer.from(code.split('.')[1], 'base64url'))).save, raw);
});
for (const name of ['village-first', 'industrial-first', 'low-active']) {
  test(`complete simulation save round-trip: ${name}`, () => {
    const raw = JSON.parse(fs.readFileSync(new URL(`../docs/v1.7/qa/balance-baseline/${name}-save.json`, import.meta.url)));
    const code = encodeSave(raw, 'test', 42), result = decodeSave(code).save;
    assert.deepEqual(result, raw);
    assert.deepEqual(restore(result, 500), restore(raw, 500));
    assert.ok(code.length < Buffer.byteLength(JSON.stringify(raw)) * .3);
  });
}
test('whitespace wrapping, leading/trailing newlines survive copy/paste', () => {
  const raw = fresh(42), code = encodeSave(raw, 'test', 42);
  assert.deepEqual(decodeSave('\n  ' + code.replace(/(.{60})/g, '$1\n') + '\t ').save, raw);
});
test('reject truncated, changed and unrelated clipboard contents', () => {
  const code = encodeSave(fresh(42), 'test');
  for (const input of ['', code.slice(0, -1), code.slice(3), '我的存档：' + code, code + '…', code.replace('MCC1.', 'MCC1.a'), code.slice(0, -8) + 'ffffffff'])
    assert.throws(() => decodeSave(input));
});
test('versioned codes and future save schemas fail explicitly', () => {
  assert.throws(() => decodeSave('MCC4.abc.00000000'), /新版/);
  assert.throws(() => validateSave({ ...fresh(), version:11 }), /更新/);
});
test('accept standard gzip produced outside the game', () => {
  const raw = fresh(42);
  const code = codeForBytes(gzipSync(JSON.stringify({ game: 'mc-clicker-2', save: raw })));
  assert.deepEqual(decodeSave(code).save, raw);
});
test('malformed gzip, invalid payload, wrong game and excessive nesting are rejected', () => {
  assert.throws(() => decodeSave(codeForBytes(new Uint8Array([0, 1, 2, 3]))));
  for (const text of ['broken', JSON.stringify({ game: 'other', save: fresh() }), JSON.stringify({ game: 'mc-clicker-2', save: {} })])
    assert.throws(() => decodeSave(codeForBytes(gzipSync(text))));
  const raw = fresh(); raw.extra = JSON.parse('['.repeat(50) + '0' + ']'.repeat(50));
  assert.throws(() => validateSave(raw), /复杂/);
  assert.throws(() => parseSaveJSON('{"version":7,"counts":{},"money":10,"__proto__":{}}'), /无效字段/);
});
test('compressed bombs and oversize clipboard data are bounded', () => {
  const code = codeForBytes(gzipSync(Buffer.alloc(MAX_SAVE_BYTES + 1, 32)));
  assert.throws(() => decodeSave(code), /过大/);
  assert.throws(() => decodeSave(' '.repeat(MAX_CODE_CHARS + 1)), /过长/);
  assert.throws(() => parseSaveJSON(' '.repeat(MAX_SAVE_BYTES + 1)), /过大/);
});
test('JSON import accepts versions 2–7, BOM; never resets on bad data', () => {
  for (const version of [2, 3, 4, 5, 6, 7]) {
    const raw = { version, money: 42, counts: { T1: 1 } };
    assert.deepEqual(parseSaveJSON('\uFEFF' + JSON.stringify(raw)), raw);
    assert.equal(restore(raw).money, 42);
  }
  for (const raw of [null, [], {}, { version: 7 }, { version: 7, counts: [], money: 2 }, { version: 7, counts: {}, money: '50' }])
    assert.throws(() => parseSaveJSON(JSON.stringify(raw)));
});
test('import does not create offline money', () => {
  const raw = fresh(1); raw.money = 50; raw.rate = 999; raw.counts.V18 = 1;
  const imported = restore(decodeSave(encodeSave(raw, 'test')).save, 99999999999);
  settleOffline(imported);
  assert.equal(imported.money, 50);
});
function storage(failKey) {
  const map = new Map([['save', 'original']]);
  return { getItem: key => map.get(key), setItem(key, value) { if (key === failKey) throw Error('quota'); map.set(key, value); } };
}
test('successful import writes both snapshots without mutating their live objects', () => {
  const store = storage(), current = fresh(1), next = fresh(2); current.money = 100; next.money = 7;
  commitImportedSave(store, 'save', current, next, 42);
  assert.equal(JSON.parse(store.getItem(BACKUP_KEY)).money, 100);
  assert.equal(JSON.parse(store.getItem('save')).money, 7);
  assert.equal(current.savedAt, 1); assert.equal(next.savedAt, 2);
  const previous = JSON.parse(store.getItem(BACKUP_KEY));
  commitImportedSave(store, 'save', next, previous, 43);
  assert.equal(JSON.parse(store.getItem('save')).money, 100);
  assert.equal(JSON.parse(store.getItem(BACKUP_KEY)).money, 7);
});
for (const key of [BACKUP_KEY, 'save']) test(`failed storage write preserves current progress: ${key}`, () => {
  const store = storage(key), current = fresh(1), next = fresh(2);
  assert.throws(() => commitImportedSave(store, 'save', current, next), /没有被替换/);
  assert.equal(store.getItem('save'), 'original');
  assert.equal(current.savedAt, 1);
});
