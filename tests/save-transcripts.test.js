import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { gunzipSync } from 'fflate';
import { fresh } from '../src/game.js';
import { NARRATOR_COPY } from '../src/narrator-copy.js';
import transcripts from '../src/save-format/transcripts-v1.json' with {type:'json'};
import { packSaveV3, unpackSaveV3 } from '../src/save-packed-v3.js';
import { encodePersistentSave, decodeSave, checksum } from '../src/save-code.js';
import { encodePortableSave, decodePortableSave } from '../src/save-brotli.js';
import { encodeText, decodeText } from '../src/save-text.js';
import { splitSaveCode, collectSaveParts } from '../src/save-parts.js';
const brotli=createRequire(import.meta.url)('brotli-wasm'),load=async()=>brotli;
const wrap=(bytes,prefix='MCC5')=>{const zipped=brotli.compress(bytes,{quality:11});return `${prefix}.${encodeText(zipped)}.${checksum(zipped)}`;};
test('transcript dictionary is frozen source text, including partial conversations',()=>{
  assert.equal(createHash('sha256').update(fs.readFileSync(new URL('../src/save-format/transcripts-v1.json',import.meta.url))).digest('hex'),'649cb2c222b1f19913423c04ee4a74a88f169671765f4ec2415ebcf137b21427');
  const bytes=packSaveV3(transcripts),decoded=unpackSaveV3(bytes);
  assert.deepEqual(decoded,transcripts);
  const copy=NARRATOR_COPY.rescued.lines;
  try{NARRATOR_COPY.rescued.lines=['This is a later release'];assert.deepEqual(unpackSaveV3(bytes),transcripts);}
  finally{NARRATOR_COPY.rescued.lines=copy;}
});
test('history references shorten complete saves without changing historical or custom wording',async()=>{
  const s=fresh(42);s.narrative.history=transcripts.slice(0,32);
  s.victory={version:1,release:'old-release',capturedAt:20,snapshot:structuredClone(s)};
  s.narrative.history=[...s.narrative.history.slice(1),{id:'rescued',text:'玩家自定义🌱\ud800，保留原话。'}];
  s.future={floats:[Number.MIN_VALUE,1e300,1.1234567890123456],text:'\udfff'};
  const before=JSON.stringify(s),old=encodePersistentSave(s,'test',42);
  const oldFrame=gunzipSync(decodeText(old.split('.')[1])),oldBrotli=brotli.compress(oldFrame,{quality:11});
  const oldChars=`MCC4.${encodeText(oldBrotli)}.${checksum(oldBrotli)}`.length;
  const code=await encodePortableSave(s,'test',42,load),result=await decodePortableSave(code,load);
  assert.ok(code.startsWith('MCC5.'));assert.ok(code.length<oldChars);
  assert.deepEqual(result,decodeSave(old));assert.equal(JSON.stringify(s),before);
  result.save.narrative.history[0].text='changed';
  assert.deepEqual(result.save.victory.snapshot,s.victory.snapshot);
  const parts=splitSaveCode(code);assert.equal(collectSaveParts([...parts].reverse().join('\n')).code,code);
});
test('new dictionary rejects corrupt references, oversized expansion and wrong format envelopes',async()=>{
  const invalid=[[12,255,255,127],[10,255,255,127],[13,255,255,127],[5,0,0,0,0,0,0,240,127]];
  for(const payload of invalid)await assert.rejects(()=>decodePortableSave(wrap(Uint8Array.from([3,...payload])),load));
  assert.throws(()=>unpackSaveV3(packSaveV3(Array(10000).fill({text:'x'.repeat(1000)}))),/过大/);
  const envelope={game:'mc-clicker-2',release:'test',createdAt:42,save:fresh(42)};
  const packed=packSaveV3(envelope),frame=Uint8Array.from([3,...packed]);
  assert.deepEqual(await decodePortableSave(wrap(frame),load),envelope);
  await assert.rejects(()=>decodePortableSave(wrap(frame,'MCC4'),load));
  await assert.rejects(()=>decodePortableSave(wrap(Uint8Array.from([2,...packed])),load));
  const code=wrap(frame);let loaded=false;
  await assert.rejects(()=>decodePortableSave(code.slice(0,-1),async()=>{loaded=true;return brotli;}));assert.equal(loaded,false);
  assert.throws(()=>decodeSave(code),/新版/);
});
