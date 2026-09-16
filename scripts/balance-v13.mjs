import {mkdirSync,writeFileSync} from 'node:fs';
import {simulate,ROUTES} from './balance-v1.1l.mjs';
import {ITEMS} from '../src/catalog.js';
import {buyWeb} from '../src/presentation.js';
import {buyEnvironment,ENV_MODULES} from '../src/environment.js';
import {WEB_ITEMS} from '../src/web-catalog.js';
const out='docs/v1.3/simulation';mkdirSync(out,{recursive:true});
const modes=['none','starter','observatory','theme','collection'];const results=[];
for(const [index,route] of ROUTES.entries())for(const mode of index===0?modes:['none']){
 let spent=0;const optional=[];
 const queue=mode==='starter'?['X2','web-title-first-block','web-icon-emerald']:mode==='observatory'?['V19','env-sundial','env-weather','env-rain']:mode==='theme'?['X2','web-theme-backpack']:mode==='collection'?['X2',...WEB_ITEMS.map(i=>i.id)]:[];
 const r=simulate(route,{afterIncome(s,time,{purchase}){
  if(time%4||!queue.length)return;
  const id=queue[0];if(ITEMS[id]){if(s.counts[id])queue.shift();else if(s.money>=ITEMS[id].cost*2&&purchase(ITEMS[id])){queue.shift();spent+=ITEMS[id].cost;optional.push({id,at:time,cost:ITEMS[id].cost});}return;}
  const cost=WEB_ITEMS.find(i=>i.id===id)?.cost??ENV_MODULES.find(i=>i.id===id)?.cost;
  // Keep one equally priced construction budget, then spend through real APIs.
  if(s.money<cost*2)return;const result=id.startsWith('web-')?buyWeb(s,id):buyEnvironment(s,id);
  if(result.ok){queue.shift();spent+=cost;optional.push({id,at:time,cost});}
 }});
 const report={route:route.id,mode,completed:r.completed,seconds:r.seconds,longestWait:r.longestWait,spent,remaining:queue,milestones:r.milestones,optional};
 results.push(report);console.log(JSON.stringify({route:route.id,mode,completed:r.completed,seconds:r.seconds,spent,remaining:queue.length}));
 writeFileSync(`${out}/${route.id}-${mode}.json`,JSON.stringify(report,null,2)+'\n');
}
writeFileSync(`${out}/summary.json`,JSON.stringify({method:'Deterministic foreground simulation; original five route policies. Four optional investment policies on industrial-first use real wallet, prerequisites, legal land and purchase APIs. Not a human playthrough.',results},null,2)+'\n');
