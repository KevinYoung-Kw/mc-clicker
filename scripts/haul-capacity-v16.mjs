import {mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {fresh} from '../src/game.js';
import {ensureCommunity,assignJob} from '../src/residents.js';
import {enqueueBatch,advanceOperations,sellCommunity} from '../src/operations.js';
import {powerSnapshot} from '../src/power.js';

// Controlled dispatch benchmark: same residents, routes and finite cargo supply.
// No passive producers are advanced, so delivered cargo cannot be mistaken for B.
export function haulingCase(workers,{distance=1,seconds=180}={}){
 const s=fresh(0);Object.assign(s.counts,{V1:4,V2:3,T7:1,V3:1,V4:1,M1:1,M2:1,M4:1});
 s.chunks.overworld=[];for(let x=0;x<=distance;x++)for(let z=0;z<=1;z++)s.chunks.overworld.push({x,z});
 s.placements={V4:{x:0,z:5,realm:'overworld'},M1:{x:5*distance,z:0,realm:'overworld'},M2:{x:5*distance,z:5,realm:'overworld'},M4:{x:2,z:2,realm:'overworld'}};
 ensureCommunity(s);for(let i=0;i<workers;i++)if(!assignJob(s,`resident-${i+1}`,'hauler').ok)throw Error('Hauler slot unavailable');
 let credited=0;const api={earn(state,value){state.money+=value;credited+=value;},emit(){},collectGift(){},deliverOrders(){return 0;}};
 let accepted=0;
 for(let i=0;i<seconds*4;i++){
  if(i%240===0)for(const source of ['V4','M1','M2'])if(enqueueBatch(s,source,'测试货物',120,4,{}))accepted+=120;
  s.play+=.25;advanceOperations(s,.25,api,powerSnapshot(s));sellCommunity(s,.25,0,100,0,api);
 }
 const people=s.community.residents;
 return {workers,distance,seconds,accepted,delivered:s.community.shipped,trips:people.reduce((sum,r)=>sum+r.jobsDone,0),
  base:people.reduce((sum,r)=>sum+r.baseEarned,0),credited,waiting:s.community.batches.reduce((sum,b)=>sum+Math.max(0,b.qty-b.delivered),0),
  each:people.map(r=>({id:r.id,trips:r.jobsDone,status:r.status}))};
}
if(import.meta.url===pathToFileURL(process.argv[1]).href){const results=[];for(const distance of [1,2,3])for(const workers of [1,2])results.push(haulingCase(workers,{distance}));
 mkdirSync('docs/v1.6/qa/alpha3',{recursive:true});writeFileSync('docs/v1.6/qa/alpha3/hauling.json',JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results));}
