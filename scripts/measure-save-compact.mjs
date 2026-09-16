// Reproducible full-archive measurements. No network and no real player storage.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { fresh } from '../src/game.js';
import { encodeSave, encodeCompactSave, decodeSave } from '../src/save-code.js';
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
  const before=encodeSave(raw,'1.7.0-alpha.12',42), begin=performance.now(), code=encodeCompactSave(raw,'1.7.0-alpha.12',42), encodeMs=performance.now()-begin;
  const decoded=decodeSave(code).save; assert.equal(JSON.stringify(decoded),JSON.stringify(raw));
  const parts=splitSaveCode(code), compressedBefore=Buffer.from(before.split('.')[1],'base64url').length, compressedAfter=decodeText(code.split('.')[1]).length;
  const row={sample:name,jsonBytes:Buffer.byteLength(JSON.stringify(raw)),oldCharacters:before.length,newCharacters:code.length,oldCompressedBytes:compressedBefore,newCompressedBytes:compressedAfter,utf8Bytes:Buffer.byteLength(code),encodeMs:Math.round(encodeMs*10)/10,parts:parts.length,maxPartCharacters:Math.max(...parts.map(p=>p.length)),exactRoundTrip:true};
  rows.push(row); console.log(name,`${before.length} → ${code.length} characters`,`${compressedBefore} → ${compressedAfter} compressed bytes`,`${row.encodeMs}ms`);
}
const out=path.join(root,'docs/v1.7/qa/save-code-compression/local-v2-results.json');
fs.writeFileSync(out,JSON.stringify({version:'MCC2 / frozen structure v1',status:'complete local archive, no server or omitted fields',environment:process.version,rows},null,2)+'\n');
