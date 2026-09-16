// Bounded investigation of the longest purchase gaps, not an optimal solver.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {simulate,ROUTES} from './balance-v2-joint-staffed.mjs';
const engine=process.env.V2_ENGINE;
if(!engine)throw Error('V2_ENGINE required');
const {game:G,catalog:C,upgrades:U,power:P}=await import(`../docs/v2.0.0/simulation/${engine}.mjs`);
const dir=new URL('../docs/v2.0.0/simulation/',import.meta.url),rows=[];
const hash=url=>createHash('sha256').update(readFileSync(url)).digest('hex');
const provenance={engineSha256:hash(new URL(`${engine}.mjs`,dir)),policySha256:hash(new URL('./balance-v2-joint-staffed.mjs',import.meta.url)),probeSha256:hash(new URL(import.meta.url)),foodResponse:process.argv.includes('--food-response'),lifePolicy:process.argv.includes('--life-policy')};
for(const id of ['village-life','no-livestream']) {
 const report=JSON.parse(readFileSync(new URL(`${engine}-p8/${id}.json`,dir)));
 assert.equal(report.provenance.engineSha256,provenance.engineSha256);
 assert.equal(report.provenance.policySha256,provenance.policySha256);
 const purchases=report.purchases.slice().sort((a,b)=>a.at-b.at);
 const gap=purchases.slice(1).map((p,i)=>({start:purchases[i].at,end:p.at,seconds:p.at-purchases[i].at})).sort((a,b)=>b.seconds-a.seconds)[0];
 const at=gap.start+Math.min(120,Math.floor(gap.seconds/2));const route=ROUTES.find(r=>r.id===id);let checkpoint;
 simulate(route,{stopAtNether:true,limit:at+1,afterIncome(s,t){if(t===at)checkpoint=structuredClone(s);}});
 assert.ok(checkpoint);writeFileSync(new URL(`${engine}-${id}-gap-checkpoint.json`,dir),JSON.stringify(checkpoint)+'\n');
 const base=G.rates(checkpoint).total,candidates=[];
 for(const item of C.CATALOG) {
  if(item.family==='X'||item.id==='V1'||G.n(checkpoint,item.id)>=item.max||G.requirements(checkpoint,item).length||G.price(checkpoint,item)>checkpoint.money)continue;
  const copy=structuredClone(checkpoint),cost=G.price(copy,item);if(!G.buy(copy,item.id).ok)continue;
  candidates.push({id:item.id,cost,gain:G.rates(copy).total-base,state:copy});
 }
 for(const item of U.UPGRADE_CATALOG){if(U.upgradeStatus(checkpoint,item.id).kind!=='ready')continue;
  const copy=structuredClone(checkpoint),cost=U.upgradePrice(copy,item.id);if(!U.buyUpgrade(copy,item.id).ok)continue;
  candidates.push({id:item.id,cost,gain:G.rates(copy).total-base,state:copy});
 }
 const selected=candidates.filter(c=>c.gain>0).sort((a,b)=>a.cost/a.gain-b.cost/b.gain).slice(0,8);
 for(const key of ['M17','V3','V25','V24','M4']){const c=candidates.find(c=>c.id===key);if(c&&!selected.includes(c))selected.push(c);}
 function replay(seed) {
  const s=structuredClone(seed),initial={money:s.money,total:s.total,ship:s.community.shipped,manual:s.manualIncome};let deficit=0,targetAt=null;
  for(let t=1;t<=600;t++){
   G.advance(s,1);if((at+t)%route.click===0)G.mine(s,()=>1);
   if((at+t)%15===0){P.connectAll(s);for(const key of ['farm','wool','treasure'])if(s.harvest[key]>=1)G.action(s,key);}
   if(s.grid.last?.consumption+.001<s.grid.last?.demand)deficit++;
   if(targetAt===null&&s.money>=G.price(s,C.ITEMS.N1))targetAt=t;
  }
  return {money:s.money,income:s.total-initial.total,delivered:s.community.shipped-initial.ship,manual:s.manualIncome-initial.manual,deficit,targetCashAt:targetAt};
 }
 const control=replay(checkpoint),options=selected.map(c=>{
  const r=replay(c.state);return {id:c.id,cost:c.cost,nominalGain:c.gain,netCash:r.money-control.money,delivered:r.delivered-control.delivered,deficit:r.deficit,targetCashAt:r.targetCashAt};
 });
 rows.push({route:id,gap,probeAt:at,cash:checkpoint.money,targetPrice:G.price(checkpoint,C.ITEMS.N1),targetConditions:G.requirements(checkpoint,C.ITEMS.N1),affordableLegalCount:candidates.length,control,options});
 console.log(JSON.stringify(rows.at(-1)));
}
writeFileSync(new URL(`${engine}-gap-probes.json`,dir),JSON.stringify({engine,provenance,method:'P8 exact prefix to 120s inside each longest purchase gap, using matching food/life flags. Up to eight nominal-gain investments plus relevant service/storage choices; paid actual API, 600s same manual cadence and connection checks, no further investments. Positive net proves an available useful option, not player discoverability. Negative tested options do not prove every possible option fails. Target cash is only cash, not full permission to enter Nether.',rows},null,2)+'\n');
