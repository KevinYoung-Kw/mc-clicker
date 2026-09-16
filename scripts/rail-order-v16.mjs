// Railway timing is an investment choice: compare purchase orders, not a clock gate.
import {mkdirSync,writeFileSync} from 'node:fs';
import {simulate,PROFILES} from './balance-early-v16.mjs';

const out='docs/v1.6/qa/alpha3',original=PROFILES.find(p=>p.id==='industry');
const branch=original.branch.filter(id=>id!=='M16');
branch.splice(branch.indexOf('M6')+1,0,'M16');
mkdirSync(out,{recursive:true});
const results=[];
for(const seed of [17,41,42,83]){
 const r=simulate({...original,id:'industry-rail-first',branch},{seed});
 writeFileSync(`${out}/rail-first-${seed}.json`,JSON.stringify(r,null,2)+'\n');
 results.push({seed,milestones:r.milestones,...r.summary});
 console.log(JSON.stringify(results.at(-1)));
}
writeFileSync(`${out}/rail-order.json`,JSON.stringify({
 method:'Same industry policy; railway moved immediately after the first redstone torch in the purchase order. Existing prices and unlock rules, no money injection. Compare to final-verified/industry-{seed}.json.',
 results,
},null,2)+'\n');
