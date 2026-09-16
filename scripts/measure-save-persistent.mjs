// Reproducible full-archive measurements. No network and no real player storage.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { fresh, restore } from '../src/game.js';
import { encodeCompactSave, encodePersistentSave, decodeSave } from '../src/save-code.js';
import { persistentSave } from '../src/save-persistent.js';
import { decodeText } from '../src/save-text.js';
import { splitSaveCode } from '../src/save-parts.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const samples=[['fresh',fresh(42)],['village-15min',JSON.parse(fs.readFileSync(path.join(root,'docs/v1.6/qa/feasibility/village-first-900-save.json')))],
  ...['industrial-first','village-first','livestream-first'].map(n=>[n,JSON.parse(fs.readFileSync(path.join(root,`docs/v1.7/qa/balance-baseline/${n}-save.json`)))])];
// A non-training layout exercises custom housing/gardens, names and free data.
const custom=structuredClone(samples[2][1]);
custom.housing={version:1,serial:24,homes:Array.from({length:24},(_,i)=>({id:`home-${i}`,type:['oak','tower','arcade'][i%3],x:(i%6)*3.5,z:Math.floor(i/6)*4.5,rotation:i%4})),stored:{},assignments:{},starterClaimed:true};
custom.garden={version:1,serial:200,plants:Array.from({length:200},(_,i)=>({id:`plant-${i}`,kind:`unknown-future-plant-${i%8}`,x:((i*47)%193)/2,z:((i*31)%197)/2,rotation:i%4})),cleared:[],parcels:[],stored:{},naturalSeed:42345678,naturalSeeds:{}};
custom.customNote='院子留给小陶🌱，屋后那排树不要动。'; samples.push(['custom-layout-stress',custom]);
const rows=[];
for(const[name,raw]of samples){
  const before=encodeCompactSave(raw,'1.7.0-alpha.13',42), begin=performance.now(), code=encodePersistentSave(raw,'1.7.0-alpha.13',42), encodeMs=performance.now()-begin;
  const decoded=decodeSave(code).save; assert.deepEqual(restore(decoded,42000),restore(structuredClone(raw),42000));
  assert.equal(JSON.stringify(decoded.victory),JSON.stringify(raw.victory));
  const parts=splitSaveCode(code), compressedBefore=decodeText(before.split('.')[1]).length, compressedAfter=decodeText(code.split('.')[1]).length;
  const row={sample:name,jsonBytes:Buffer.byteLength(JSON.stringify(raw)),persistentJsonBytes:Buffer.byteLength(JSON.stringify(persistentSave(raw))),oldCharacters:before.length,newCharacters:code.length,oldCompressedBytes:compressedBefore,newCompressedBytes:compressedAfter,utf8Bytes:Buffer.byteLength(code),encodeMs:Math.round(encodeMs*10)/10,parts:parts.length,maxPartCharacters:Math.max(...parts.map(p=>p.length)),identicalRestoredState:true,exactHistoricalSnapshot:true,omittedRuntimeFields:JSON.stringify(decoded)!==JSON.stringify(raw)};
  rows.push(row); console.log(name,`${before.length} → ${code.length} characters`,`${compressedBefore} → ${compressedAfter} compressed bytes`,`${row.encodeMs}ms`);
}
const out=path.join(root,'docs/v1.7/qa/save-code-compression/local-v3-results.json');
fs.writeFileSync(out,JSON.stringify({version:'MCC3 / persistent projection 1 / frozen structure v2',status:'local frontend reconstruction; exact persistent gameplay and historical snapshot; no server',environment:process.version,rows},null,2)+'\n');
