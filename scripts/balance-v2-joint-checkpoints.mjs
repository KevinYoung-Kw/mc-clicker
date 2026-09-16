// Capture an actual route immediately after research, without granting assets.
import {simulate,ROUTES} from './balance-v2-power.mjs';
import {writeFileSync} from 'node:fs';
const engine=process.env.V2_ENGINE;
if(!engine)throw Error('V2_ENGINE required');
const captured=new Set();
simulate(ROUTES.find(r=>r.id==='industrial-first'),{stopAtNether:true,afterIncome(s,time){
 for(const id of ['industrial','modern'])if(s.research.completed[id]&&!captured.has(id)){
  captured.add(id);writeFileSync(`docs/v2.0.0/simulation/${engine}-${id}-checkpoint.json`,JSON.stringify(s)+'\n');
  console.log(JSON.stringify({id,at:time,money:s.money,book:s.counts.V12}));
 }
}});
