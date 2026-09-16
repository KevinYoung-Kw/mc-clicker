// Read-only probes on fresh in-memory worlds. The optional garden is NOT purchased.
import fs from 'node:fs';
import {simulate,ROUTES} from '../balance-v1.1l.mjs';
import {ITEMS} from '../../src/catalog.js';
import {connectAll,setAutoConnect} from '../../src/power.js';
const results=[];
for(const route of ROUTES.filter(r=>['industrial-first','village-first','low-active'].includes(r.id))){
 const observed={route:route.id,firstEligible:{},samples:[]};
 const result=simulate(route,{afterIncome(s,t){
  if(s.counts.M5){connectAll(s);if(s.grid.learnedConnection&&!s.grid.autoConnect)setAutoConnect(s,true);}
  const buildings=Object.keys(s.placements).filter(id=>ITEMS[id]?.place).length;
  const base=buildings>=8&&s.chunks.overworld.length>=4;
  const options={eightBuildingsFourPlots:base,withRedstone:base&&!!s.counts.M5,withRailOrBell:base&&!!(s.counts.M16||s.counts.V14)};
  for(const [key,ready] of Object.entries(options))if(ready&&observed.firstEligible[key]===undefined)observed.firstEligible[key]=t;
  if([600,900,1200,1499].includes(t)) observed.samples.push({seconds:t,buildings,plots:s.chunks.overworld.length,wallet:s.money,rate:s.rate});
  if([900,1200].includes(t))fs.writeFileSync(`docs/v1.6/qa/feasibility/${route.id}-${t}-save.json`,JSON.stringify(s));
 }});
 results.push(observed);console.log(JSON.stringify(observed));
}
fs.writeFileSync('docs/v1.6/qa/feasibility/garden-timing.json',JSON.stringify({method:'Current simulator, three deterministic policies, real purchases and automatic electric reconnection. No injected money. Optional garden not bought; gate times are availability probes, not human purchase times. Simulation excludes new housing costs.',results},null,2)+'\n');
