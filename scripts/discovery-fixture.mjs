import {fresh,buy,sites,frontier,rates} from '../src/game.js';
import {ITEMS} from '../src/catalog.js';
import {buyEarlyGuidance} from './early-fixture.mjs';
import {discoveryStock,developmentStep} from '../src/development.js';

// Isolated UI fixtures: abundant funds, but real prerequisites and placement.
export function discoveryFixture(kind='stock'){
 const s=fresh(0);s.money=1e6;buyEarlyGuidance(s);
 function ensure(id,level=1){
  if((s.counts[id]||0)>=level)return;
  const item=ITEMS[id];for(const dep of item.deps)ensure(dep);
  if(item.gate?.id)ensure(item.gate.id,item.gate.level);
  while((s.counts[id]||0)<level){
   while(item.place&&!s.counts[id]&&!sites(s,item.realm,null,id).length){
    const edge=frontier(s).sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z))[0];
    const result=buy(s,'V1',edge);if(!result.ok)throw Error(result.reason);
   }
   const result=buy(s,id);if(!result.ok)throw Error(`${id}: ${result.reason}`);
  }
 }
 for(const id of kind==='opening'?['T7','T2']:['V2','T7','T2','V3'])ensure(id);
 if(kind==='job')ensure('V4');
 if(['level','power'].includes(kind)){
  for(const id of ['T3','M1','M2'])ensure(id);
  s.community.residents[0].jobsDone=1;
 }
 if(kind==='power')for(const id of ['M3','M5','M6'])ensure(id);
 s.narrative.companionsShown=true;s.narrative.intro='released';s.guidance.notices=false;
 return s;
}
if(process.argv[1]?.endsWith('discovery-fixture.mjs')){
 const kind=process.argv[2]||'stock',state=discoveryFixture(kind),report=rates(state);
 console.log(JSON.stringify({state,expected:discoveryStock(state,'all',report).available.map(i=>i.id),step:developmentStep(state,report)}));
}
