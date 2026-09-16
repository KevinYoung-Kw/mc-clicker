// Local-only reproducible benchmark. Never writes the supplied code or decoded
// player data; --out contains sizes, timings and equality results only.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { brotliCompressSync, brotliDecompressSync, constants } from 'node:zlib';
import { gzipSync } from 'fflate';
import assert from 'node:assert/strict';
import { fresh, restore, advance } from '../src/game.js';
import { packSaveV2, unpackSaveV2 } from '../src/save-packed-v2.js';
import { encodePersistentSave, decodeSave, checksum } from '../src/save-code.js';
import { encodePortableSave, decodePortableSave } from '../src/save-brotli.js';
import { encodeText } from '../src/save-text.js';
const brotli = createRequire(import.meta.url)('brotli-wasm');
const option = key => { const i = process.argv.indexOf(key); return i >= 0 ? process.argv[i + 1] : null; };
const input = option('--input'), output = option('--out');
const inputs = [['fresh', { game: 'mc-clicker-2', release: 'test', createdAt: 42, save: fresh(42) }],
 ...['industrial-first','village-first','livestream-first'].map(name => [name, {game:'mc-clicker-2',release:'test',createdAt:42,save:JSON.parse(fs.readFileSync(new URL(`../docs/v1.7/qa/balance-baseline/${name}-save.json`,import.meta.url)))}])];
if (input) {
 const text = fs.readFileSync(input, 'utf8').trim();
 const value = text.startsWith('MCC') ? await decodePortableSave(text, async () => brotli) : JSON.parse(text);
 inputs.push(['private-completed-sample',value.game==='mc-clicker-2'?value:{game:'mc-clicker-2',release:'test',createdAt:42,save:value}]);
}
const report = { notes: ['Only aggregate data is recorded. No player save is committed or uploaded.', 'Identical release/time and full header/checksum included in code lengths.', 'Native/Zstd measurements are research; only MCC3 fallback and WASM Brotli MCC4 are integrated.', 'Timing is this host, not a physical phone benchmark.'], samples: [] };
for (const [name,envelope] of inputs) {
 const {save,release,createdAt}=envelope, baseline=encodePersistentSave(save,release,createdAt);
 const start=performance.now(), code=await encodePortableSave(save,release,createdAt,async()=>brotli), encodeMs=performance.now()-start;
 const ds=performance.now(), decoded=await decodePortableSave(code,async()=>brotli),decodeMs=performance.now()-ds;
 assert.deepEqual(decoded,decodeSave(baseline));
 const original=restore(save,42000),loaded=restore(decoded.save,42000);assert.deepEqual(loaded,original);
 const run = state => { let n=42;const random=Math.random;Math.random=()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/2**32);try{for(let i=0;i<120;i++)advance(state,1);}finally{Math.random=random;} };
 run(original);run(loaded);assert.deepEqual(loaded,original);
 const candidates=[];
 for(const [structure,kind,data]of [['json',0,new TextEncoder().encode(JSON.stringify(envelope))],['v2',2,packSaveV2(envelope)]]) {
  if(kind===2)assert.deepEqual(unpackSaveV2(data),envelope);
  const frame=new Uint8Array(data.length+1);frame[0]=kind;frame.set(data,1);
  const gz=gzipSync(frame,{level:9,mtime:0});
  candidates.push({structure,compression:'gzip9',bytes:gz.length,fullCodeChars:`MCC3.${encodeText(gz)}.${checksum(gz)}`.length});
  const bs=performance.now(),br=brotliCompressSync(frame,{params:{[constants.BROTLI_PARAM_QUALITY]:11}});assert.deepEqual(brotliDecompressSync(br),Buffer.from(frame));
  candidates.push({structure,compression:'native-brotli11',bytes:br.length,fullCodeChars:`MCC4.${encodeText(br)}.${checksum(br)}`.length,ms:performance.now()-bs});
  const zs=performance.now(),z=spawnSync('zstd',['--ultra','-22','-q','-c'],{input:frame});
  if(z.status===0){assert.deepEqual(spawnSync('zstd',['-d','-q','-c'],{input:z.stdout}).stdout,Buffer.from(frame));candidates.push({structure,compression:'zstd22-research-only',bytes:z.stdout.length,payloadChars:Math.ceil(z.stdout.length*8/14),ms:performance.now()-zs});}
 }
 const row={name,jsonBytes:Buffer.byteLength(JSON.stringify(envelope)),previousChars:baseline.length,newChars:code.length,newFormat:code.slice(0,4),encodeMs,decodeMs,exactPersistedValues:true,restoreAnd120Seconds:true,candidates};
 report.samples.push(row);console.log(JSON.stringify(row));
}
if(output)fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
