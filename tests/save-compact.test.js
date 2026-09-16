import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { fresh, restore, advance } from '../src/game.js';
import { encodeCompactSave, decodeSave, checksum } from '../src/save-code.js';
import { packSave, unpackSave } from '../src/save-packed.js';
import { encodeText, decodeText } from '../src/save-text.js';
import { splitSaveCode, collectSaveParts } from '../src/save-parts.js';
const clone = x => JSON.parse(JSON.stringify(x));

test('frozen codec dictionaries and golden archive cannot change silently', () => {
  for (const [file, hash] of [['defaults-v1.json','00f1acdadadeb801f58dbc43790825a121821841a57021643198bfa0a142acc8'], ['records-v1.json','6f0120d61b027e7262448327c0c667ab8e3d02d1a25c4cd2f5626351b8648d4a']])
    assert.equal(createHash('sha256').update(fs.readFileSync(new URL(`../src/save-format/${file}`,import.meta.url))).digest('hex'),hash);
  const raw = {version:7,money:42,counts:{T1:1},text:'小麦🌱\ud800',places:[{x:1.5,z:-7.5},{x:1.5,z:-7.5}]};
  const hex = '080005010711dd02000822706c61636573220307032a080001ac03030106001222e5b08fe9baa6f09f8cb15c756438303022070208160b00030b010f08160b00030b010f';
  assert.equal(Buffer.from(packSave(raw)).toString('hex'),hex);
  assert.deepEqual(unpackSave(Buffer.from(hex,'hex')),raw);
});
test('text encoding preserves all byte lengths, padding and Unicode normalization', () => {
  for (let length=0; length<1024; length++) {
    const data=randomBytes(length), text=encodeText(data);
    assert.deepEqual(decodeText(text),new Uint8Array(data));
    for(const mode of ['NFC','NFD','NFKC','NFKD']) assert.equal(text.normalize(mode),text);
    assert.equal([...text].length,text.length); // no hidden surrogate-pair count
  }
  for(const text of ['', 'A', '\ud800', '一一', '一丁']) assert.throws(()=>decodeText(text));
});
test('full current state, immutable victory, values, field order and unknown extensions survive', () => {
  let seed=12345; const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
  for(let sample=0; sample<120; sample++) {
    const raw=fresh(42); raw.money=random()*1e30; raw.savedAt=1234567890123+sample;
    raw.extra={ unknown: '中文🌳\ud800\udfff\n"'+sample, tiny:Number.MIN_VALUE, huge:1e100, bigInteger:Number.MAX_SAFE_INTEGER, negative:-Number.MAX_SAFE_INTEGER, flag:false, zero:0, nullable:null };
    raw.placements={}; for(let i=0;i<30;i++)raw.placements['building-'+i]={x:random()*100,z:i/2,rotation:i%4};
    const residents=Array.from({length:24},(_,i)=>({id:'id-'+i,name:'村民 '+i,job:'farm',skills:{farm:random()*9},progress:random(),foo:0,bar:false,baz:null}));
    raw.extraResidents=residents; raw.victory={ snapshot:clone(raw) }; raw.money+=1e20; raw.extraResidents[0].name='改名之后';
    const before=JSON.stringify(raw), code=encodeCompactSave(raw,'test',42), result=decodeSave(code).save;
    assert.deepEqual(result,raw); assert.equal(JSON.stringify(result),before); assert.equal(JSON.stringify(raw),before);
    assert.deepEqual(result.victory.snapshot.extraResidents,residents.map((r,i)=>i? r:{...r,name:'村民 0'}));
  }
});
test('historical simulation fixtures retain every field and ten seconds of continued simulation', () => {
  const files=JSON.parse(fs.readFileSync(new URL('../docs/v1.7/qa/save-code-compression/trained-dictionary.json',import.meta.url))).trainingFiles;
  for(const file of [...files,...['industrial-first','village-first','livestream-first'].map(n=>`docs/v1.7/qa/balance-baseline/${n}-save.json`)]) {
    const raw=JSON.parse(fs.readFileSync(new URL('../'+file,import.meta.url))), code=encodeCompactSave(raw,'test',42), result=decodeSave(code).save;
    assert.deepEqual(result,raw,file); assert.equal(JSON.stringify(result),JSON.stringify(raw),file);
    const a=restore(clone(raw),42000), b=restore(result,42000), original=Math.random;
    assert.deepEqual(a,b,file);
    const rng=()=>{let x=42;return()=>((x=(Math.imul(x,1664525)+1013904223)>>>0)/2**32)};
    try {Math.random=rng();advance(a,10);Math.random=rng();advance(b,10);} finally {Math.random=original;}
    assert.deepEqual(a,b,file);
  }
});
test('defaults are reconstructed independently: new changes cannot alter old snapshots or other imports', () => {
  const raw=fresh(42), code=encodeCompactSave(raw,'test',42), first=decodeSave(code).save;
  first.counts.T1=99; first.audio.musicVolume=0; first.narrative.history.push('change');
  assert.deepEqual(decodeSave(code).save,raw);
});
test('damaged compact payload, unsafe fields, missing references, deep expansion and float corruption fail', () => {
  const code=encodeCompactSave(fresh(42),'test',42);
  for(const value of [code.slice(0,-1),code.replace('MCC2.','MCC2.A'),code.slice(0,-8)+'ffffffff']) assert.throws(()=>decodeSave(value));
  for(const value of [new Uint8Array([10,255,255,127]),new Uint8Array([9,255,255,127]),new Uint8Array([255]),new Uint8Array([5,0,0,0,0,0,0,240,127])]) assert.throws(()=>unpackSave(value));
  const raw=clone(fresh(42)); Object.defineProperty(raw,'__proto__',{value:{polluted:true},enumerable:true});
  assert.throws(()=>encodeCompactSave(raw,'test'));
  // A compact back-reference bomb must be rejected before its exponential clone.
  const repeated={text:'x'.repeat(1000)}, data=packSave([repeated]);
  assert.throws(()=>unpackSave(data.slice(0,-1)));
  assert.throws(()=>unpackSave(packSave(Array(10000).fill(repeated))),/过大/);
  const huge=Buffer.concat([Buffer.from([0]),Buffer.alloc(8*1024*1024+1,32)]), zipped=gzipSync(huge);
  assert.throws(()=>decodeSave(`MCC2.${encodeText(zipped)}.${checksum(zipped)}`),/过大/);
  const malformed=gzipSync(Uint8Array.from([255,0]));
  assert.throws(()=>decodeSave(`MCC2.${encodeText(malformed)}.${checksum(malformed)}`));
});
test('each transfer part fits 500 characters; out-of-order, duplicates and multiple pasted parts work', () => {
  const code=encodeCompactSave({...fresh(42),randomData:randomBytes(20000).toString('hex')},'test',42),parts=splitSaveCode(code);
  assert.ok(parts.length>10); assert.ok(parts.every(p=>p.length<=500));
  let state=null;
  for(const part of parts.slice().reverse()) {const result=collectSaveParts(part,state);state=result.state;const again=collectSaveParts(part,state);assert.equal(again.state.parts.size,state.parts.size);}
  assert.equal(collectSaveParts(parts[0],state).code,code);
  assert.equal(collectSaveParts(parts.join('\r\n')).code,code);
  const partial=collectSaveParts(parts[1]);assert.equal(partial.code,null);
  const foreign=splitSaveCode(encodeCompactSave(fresh(900),'test'));
  assert.throws(()=>collectSaveParts(foreign[0],partial.state),/另一份/);
  assert.throws(()=>collectSaveParts(parts[0]+'x',partial.state));assert.equal(partial.state.parts.size,1);
});
