// Offline authoring tool. Source text only; NEVER train on a player archive.
// Refuse overwriting a frozen table. New copy requires a new table/version.
import fs from 'node:fs';
import { NARRATOR_COPY, NARRATOR_PLACES } from '../src/narrator-copy.js';
import { JOBS } from '../src/residents.js';
import { ITEMS } from '../src/catalog.js';
export function transcriptTemplates() {
  const rows=[],seen=new Set();
  function add(id,lines){for(let length=1;length<=lines.length;length++){
    const row={id,text:lines.slice(0,length).join(' ')},key=JSON.stringify(row);
    if(row.text&&!seen.has(key)){seen.add(key);rows.push(row);}
  }}
  for(const [id,copy]of Object.entries(NARRATOR_COPY))add(id,copy.lines);
  for(const [job,spec]of Object.entries(JOBS)) {
    if(job==='idle')continue;
    for(const target of [spec.target,...(job==='hauler'?['V3']:[])]){
      const place=NARRATOR_PLACES[target]||ITEMS[target]?.name;if(!place)continue;
      add(`vacancy:${job}`,NARRATOR_COPY['job-vacancy'].lines.map(line=>line.replace('{设施}',place).replace('{岗位}',spec.name)));
    }
    for(const variant of ['resident-vacant','resident-no-music'])add('resident',NARRATOR_COPY[variant].lines.map(line=>line.replace('{岗位}',spec.name)));
  }
  return rows;
}
if(process.argv[1]===new URL(import.meta.url).pathname){
  const at=process.argv.indexOf('--out');if(at<0)throw Error('Pass --out for a NEW frozen table');
  const rows=transcriptTemplates(),path=process.argv[at+1];fs.writeFileSync(path,JSON.stringify(rows)+'\n',{flag:'wx'});
  console.log(JSON.stringify({records:rows.length,bytes:Buffer.byteLength(JSON.stringify(rows)+'\n')}));
}
