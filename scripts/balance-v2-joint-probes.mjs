// Capital, recurring expense and actual delivered sales, not nominal rate ROI.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const arg=(key,fallback)=>process.argv.includes(key)?process.argv[process.argv.indexOf(key)+1]:fallback;
const engine=arg('--engine','flow-joint-life40');
const dir=new URL('../docs/v2.0.0/simulation/',import.meta.url);
const inputPath=arg('--checkpoint','research-fork-checkpoint.json');
const bytes=readFileSync(new URL(inputPath,dir));
const {game:G,catalog:C,research:Q,villagerLife:L,food:F,services:S}=await import(new URL(engine+'.mjs',dir));
const options=[['control'],['canteen','V25'],['canteen-tea','V25','simple'],['cart','V24'],['book','V12'],['furnace','M2'],['market','V3']];
const rows=[];
for(const phase of [0,91]){
 const base=G.restore(JSON.parse(bytes),0);for(let t=0;t<phase;t++)G.advance(base,1);
 if(!G.sites(base,'overworld',null,'V25').length)assert.ok(G.buy(base,'V1',G.frontier(base)[0]).ok);
 for(const [id,item,welfare]of options){
  const s=structuredClone(base),initial={money:s.money,total:s.total,spent:s.life.spent,shipped:s.community.shipped,jobs:s.community.jobIncome,rests:s.life.rests};
  let paid=0,boughtAt=null,failure=null,meanHappiness=0,restSeconds=0;const samples=[],transactions=[];
  if(item)for(const tech of Q.researchForItem(s,item)) {
   if(s.research.completed[tech])continue;
   const result=Q.startResearch(s,tech);
   if(!result.ok){failure=result.reason||Q.researchRequirements(s,item).join(',');break;}
   paid+=result.cost;transactions.push({id:tech,cost:result.cost});
  }
  for(let t=0;t<1800;t++){
   if(item&&!failure&&boughtAt===null&&!Q.researchRequirements(s,item).length&&s.money>=G.price(s,C.ITEMS[item])) {
    const cost=G.price(s,C.ITEMS[item]),result=G.buy(s,item);
    if(!result.ok)failure=result.reason;else{paid+=cost;boughtAt=t;transactions.push({id:item,cost});if(welfare)assert.ok(L.setWelfare(s,welfare).ok);}
   }
   G.advance(s,1);const life=L.lifeSnapshot(s);meanHappiness+=life.happiness;restSeconds+=life.resting;
   assert.ok(life.bonus<=25.0001&&s.money>=0);
   const f=F.foodSnapshot(s);assert.ok(Math.abs(f.cooked-f.eaten-f.stock-f.discarded)<1e-5);
   if([300,600,900,1800].includes(t+1))samples.push({seconds:t+1,wallet:s.money-initial.money,income:s.total-initial.total,jobs:s.community.jobIncome-initial.jobs,shipped:s.community.shipped-initial.shipped,expense:s.life.spent-initial.spent,foodExpense:f.spent,foodPeople:f.fed,contract:S?.serviceQuote(s)});
  }
  assert.ok(Math.abs(s.money-initial.money-(s.total-initial.total-paid-(s.life.spent-initial.spent)))<1e-4);
  const row={phase,id,paid,boughtAt,failure,transactions,meanHappiness:meanHappiness/1800,restPersonSeconds:restSeconds,samples};
  const control=id==='control'?row:rows.find(r=>r.phase===phase&&r.id==='control');
  row.delta=samples.map((p,i)=>({seconds:p.seconds,netCash:p.wallet-control.samples[i].wallet,actualIncome:p.income-control.samples[i].income,shipped:p.shipped-control.samples[i].shipped}));rows.push(row);
 }
}
const out=arg('--out',engine+'-joint-probes');
writeFileSync(new URL(out+'.json',dir),JSON.stringify({engine,inputPath,inputSha256:createHash('sha256').update(bytes).digest('hex'),manifest:JSON.parse(readFileSync(new URL(engine+'-manifest.json',dir))),method:'Same earned save, two rest phases, each choice pays its own required research, purchase and recurring costs. Waits until affordable. No later investment, manual clicks or staff rearrangement. Missing conditions recorded as failures, not silently unlocked. Delivery and net wallet deltas after 5/10/15/30 minutes. Paired continuation is a local investment diagnostic, not proof of whole-game strategy dominance.',rows},null,2)+'\n');
console.log(JSON.stringify(rows.map(r=>({phase:r.phase,id:r.id,paid:r.paid,failure:r.failure,net30:r.delta.at(-1).netCash,delivered:r.delta.at(-1).shipped,happiness:r.meanHappiness}))));
