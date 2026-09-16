// Synthetic saves only. Never use player saves in a public design gallery.
import fs from 'node:fs/promises';
import {fresh,restore,buy,sites,frontier,formatWallet} from '../../src/game.js';
import {ITEMS} from '../../src/catalog.js';
import {chooseOpening} from '../../src/opening-guide.js';
import {buyGuidance} from '../../src/guidance.js';
import {encodePortableSave,decodePortableSave} from '../../src/save-brotli.js';
import {decodeText} from '../../src/save-text.js';
import {createRequire} from 'node:module';
const brotli=createRequire(import.meta.url)('brotli-wasm');
const out='/tmp/mcc-save-card-design',now=Date.parse('2026-09-10T09:30:00+08:00');
await fs.mkdir(out,{recursive:true});
const early=fresh(42);chooseOpening(early,'returning');early.money=1e6;
for(const id of ['info','counter','nameplate','goals'])buyGuidance(early,id);
for(const id of ['T1','V1','V18','V2','V3','L1']){
 const item=ITEMS[id];
 for(let tries=0;item.place&&id!=='V1'&&!sites(early,item.realm,null,id).length&&tries<8;tries++){
  const land=buy(early,'V1',{...frontier(early,item.realm)[0],realm:item.realm});if(!land.ok)throw Error(land.reason);
 }
 const result=buy(early,id);if(!result.ok)throw Error(id+':'+result.reason);
}
early.play=428;early.money=1260;early.total=2684;
const peak=restore(JSON.parse(await fs.readFile(new URL('../../docs/v1.6/qa/stability-baseline/fixtures/peak.json',import.meta.url),'utf8')),now);
for(const [id,label,s] of [['village','村庄初成',early],['advanced','三界远行',peak]]){
 s.sound=false;s.audio.narratorVoice=false;s.reducedMotion=true;
 const code=await encodePortableSave(s,'1.7.0-alpha.15',now,async()=>brotli);
 const expected=await decodePortableSave(code,async()=>brotli);
 const archive=Uint8Array.from([Number(code[3]),...decodeText(code.split('.')[1])]);
 await fs.writeFile(`${out}/${id}.json`,JSON.stringify(s));
 await fs.writeFile(`${out}/${id}.code.txt`,code);
 await fs.writeFile(`${out}/${id}.archive`,archive);
 await fs.writeFile(`${out}/${id}.expected.json`,JSON.stringify(expected));
 const meta={id,label,savedAt:'2026.09.10 / 09:30',release:'1.7.0-alpha.15',play:`${Math.floor(s.play/60)} 分钟`,money:formatWallet(s.money),residents:s.community.residents.length,lands:s.chunks.overworld.length};
 await fs.writeFile(`${out}/${id}.meta.json`,JSON.stringify(meta));
 console.log({...meta,codeCharacters:code.length,archiveBytes:archive.length});
}
