import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { brotliCompressSync, brotliDecompressSync } from 'node:zlib';
import { gunzipSync } from 'fflate';
import { fresh, restore, advance } from '../src/game.js';
import { encodePortableSave, decodePortableSave, inflateBrotli } from '../src/save-brotli.js';
import { encodeSave, encodeCompactSave, encodePersistentSave, decodeSave, checksum, MAX_SAVE_BYTES } from '../src/save-code.js';
import { encodeText, decodeText } from '../src/save-text.js';
const brotli = createRequire(import.meta.url)('brotli-wasm');
const load = async () => brotli;
const wrap = bytes => `MCC4.${encodeText(bytes)}.${checksum(bytes)}`;
const fixture = file => JSON.parse(fs.readFileSync(new URL('../' + file, import.meta.url)));
const files = [...fixture('docs/v1.7/qa/save-code-compression/trained-dictionary.json').trainingFiles,
  'docs/v1.6/qa/feasibility/village-first-900-save.json',
  ...['industrial-first', 'village-first', 'livestream-first'].map(n => `docs/v1.7/qa/balance-baseline/${n}-save.json`)];

test('stronger local codes keep exactly the same persisted content across 29 fixtures', async () => {
  for (const file of files) {
    const raw = fixture(file), old = encodePersistentSave(raw, 'test', 42);
    const code = await encodePortableSave(raw, 'test', 42, load);
    const result = await decodePortableSave(code, load);
    assert.ok(code.length <= old.length, file);
    assert.deepEqual(result, decodeSave(old), file);
    assert.deepEqual(restore(result.save, 100), restore(raw, 100), file);
    if (code.startsWith('MCC4.')) assert.deepEqual(brotliDecompressSync(decodeText(code.split('.')[1])), Buffer.from(gunzipSync(decodeText(old.split('.')[1]))));
  }
});
test('MCC1–3 and missing WebAssembly remain usable without the new module', async () => {
  const fail = async () => { throw Error('unavailable'); }, raw = fresh(42);
  for (const encode of [encodeSave, encodeCompactSave, encodePersistentSave]) {
    const code = encode(raw, 'test', 42);
    assert.deepEqual(await decodePortableSave(code, fail), decodeSave(code));
  }
  assert.equal(await encodePortableSave(raw, 'test', 42, fail), encodePersistentSave(raw, 'test', 42));
});
test('native Brotli, exact floats, Unicode and unknown fields restore independently', async () => {
  const raw = fresh(42); raw.future = { money: 1e300, tiny: Number.MIN_VALUE, name: '\ud800🌱\udfff', data: [null, false, 'MCC4', 1.1234567890123456] };
  const old = encodePersistentSave(raw, 'test', 42), frame = gunzipSync(decodeText(old.split('.')[1]));
  const code = wrap(brotliCompressSync(frame));
  assert.deepEqual(await decodePortableSave('\n' + code.replace(/(.{70})/g, '$1\n'), load), decodeSave(old));
  await assert.rejects(() => decodePortableSave(code, async () => { throw Error('blocked'); }), /加载/);
  await assert.rejects(() => decodePortableSave('MCC6.abc.00000000', load), /新版/);
});
test('Brotli input is bounded, checked before loading, and rejects invalid frames', async () => {
  for (const bytes of [new Uint8Array(), Uint8Array.from([0, 1]), brotliCompressSync(Buffer.from('not a structural frame'))])
    await assert.rejects(() => decodePortableSave(wrap(bytes), load));
  const frame = gunzipSync(decodeText(encodePersistentSave(fresh(42), 'test', 42).split('.')[1]));
  const zipped = brotliCompressSync(frame);
  for (const bytes of [zipped.subarray(0, zipped.length - 1), Buffer.concat([zipped, Buffer.from([0])])])
    await assert.rejects(() => decodePortableSave(wrap(bytes), load));
  let loaded = false;
  await assert.rejects(() => decodePortableSave(wrap(zipped).slice(0, -1), () => { loaded = true; return brotli; }));
  assert.equal(loaded, false);
  const bomb = brotliCompressSync(Buffer.alloc(MAX_SAVE_BYTES + 2, 32));
  assert.throws(() => inflateBrotli(bomb, brotli), /过大/);
  for (const size of [0, 1, 255, 256, 4095, 4096, 4097, 65536]) {
    const bytes = Buffer.from(Array.from({ length: size }, (_, i) => i % 251));
    assert.deepEqual(Buffer.from(inflateBrotli(brotliCompressSync(bytes), brotli)), bytes);
  }
});
test('120 foreground seconds after a portable reload keep production and history unchanged', async () => {
  const raw = fixture(files.at(-1)), a = restore(raw, 100);
  const b = restore((await decodePortableSave(await encodePortableSave(raw, 'test', 42, load), load)).save, 100);
  const run = s => { const original = Math.random; let seed = 42; Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32); try { for (let i = 0; i < 120; i++) advance(s, 1); } finally { Math.random = original; } };
  run(a); run(b); assert.deepEqual(b, a);
});
