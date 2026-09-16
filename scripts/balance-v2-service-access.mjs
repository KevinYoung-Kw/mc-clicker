// Real earned checkpoint; investment probes, not a complete progression model.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
const root=new URL('../docs/v2.0.0/simulation/',import.meta.url);
const raw=JSON.parse(readFileSync(new URL('research-fork-checkpoint.json',root)));
const engine=process.argv[2]||'power-staged-60-linear';
const {game:G,research:R,villagerLife:L,food,catalog:C}=await import(new URL(engine+'.mjs',root));
const rows=[];
for(const phase of [0,91]) {
 const base=G.restore(raw);for(let t=0;t<phase;t++)G.advance(base,1);
 assert.ok(!G.n(base,'V25'));
 if(!G.sites(base,'overworld',null,'V25').length)assert.ok(G.buy(base,'V1',G.frontier(base)[0]).ok);
 const workers=base.community.residents.filter(r=>r.job!=='idle');
 const distance=p=>workers.reduce((n,r)=>n+Math.hypot(p.x-r.x,p.z-r.z),0)/workers.length;
 const sites=G.sites(base,'overworld',null,'V25').sort((a,b)=>distance(a)-distance(b));
 for(const layout of ['none','near','far']) {
  const s=structuredClone(base),initial={money:s.money,total:s.total,spent:s.life.spent,shipped:s.community.shipped,done:s.community.residents.reduce((n,r)=>n+r.jobsDone,0)};
  const position=layout==='near'?sites[0]:sites.at(-1);
  let capital=0,built=layout==='none',researchPaid=false;
  const coverage=new Set(),samples=[];
  let happy=0,fed=0,hungry=0,rest=0,serviceTrips=0,work=0;
  for(let t=0;t<1800;t++) {
   if(!built) {
    if(!s.research.completed['community-life']&&!researchPaid){const r=R.startResearch(s,'community-life');assert.ok(r.ok,r.reason);capital+=r.cost;researchPaid=true;}
    if(s.research.completed['community-life']){capital+=G.price(s,C.ITEMS.V25);const r=G.buy(s,'V25',position);assert.ok(r.ok,r.reason);built=true;}
   }
   G.advance(s,1);
   const life=L.lifeSnapshot(s),f=food?.foodSnapshot(s);
   happy+=life.happiness;fed+=life.foodPeople;hungry+=f?.hungry||0;
   for(const r of s.community.residents){
    const a=s.life.residents[r.id];
    if(L.happinessParts(s,r).food>0)coverage.add(r.id);
    if(a?.phase==='work'&&r.job!=='idle')work++;
    else if(a?.phase==='going-rest')serviceTrips++;
    else if(a?.phase==='rest')rest++;
   }
   assert.ok(s.money>=0);
   if(f){assert.ok(Math.abs(f.cooked-f.eaten-f.stock-f.discarded)<1e-6);assert.ok(f.spent<=s.life.spent+1e-6);}
   if([300,600,900,1800].includes(t+1))samples.push({seconds:t+1,wallet:s.money-initial.money,income:s.total-initial.total,shipped:s.community.shipped-initial.shipped,completedWork:s.community.residents.reduce((n,r)=>n+r.jobsDone,0)-initial.done,expense:s.life.spent-initial.spent});
  }
  const f=food?.foodSnapshot(s);
  assert.ok(Math.abs(s.money-initial.money-((s.total-initial.total)-capital-(s.life.spent-initial.spent)))<1e-4);
  const row={engine,phase,layout,position:layout==='none'?null:position,meanWorkerDistance:layout==='none'?null:distance(position),capital,
   people:s.community.residents.length,foodEver:coverage.size,meanFoodPeople:fed/1800,meanHungryPeople:hungry/1800,meanHappiness:happy/1800,
   workPersonSeconds:work,restPersonSeconds:rest,tripPersonSeconds:serviceTrips,food:f?{stock:f.stock,cooked:f.cooked,eaten:f.eaten,spent:f.spent,shortages:f.shortages}:null,samples};
  const control=layout==='none'?row:rows.find(r=>r.phase===phase&&r.layout==='none');
  row.delta=samples.map((sample,i)=>({seconds:sample.seconds,netCash:sample.wallet-control.samples[i].wallet,income:sample.income-control.samples[i].income,shipped:sample.shipped-control.samples[i].shipped,completedWork:sample.completedWork-control.samples[i].completedWork}));
  rows.push(row);
  console.log(JSON.stringify({engine,phase,layout,covered:coverage.size,fed:row.meanFoodPeople,hungry:row.meanHungryPeople,capital,net:row.delta.at(-1).netCash,work:row.delta.at(-1).completedWork}));
 }
}
writeFileSync(new URL(engine+'-service-access.json',root),JSON.stringify({engine,manifest:JSON.parse(readFileSync(new URL(engine+'-manifest.json',root))),method:'Same earned six-person checkpoint. Paired no-canteen, nearest/farthest legal canteen site, two rest phases; 1800s real foreground production, no later purchases/clicks. Canteen pays its own 800 research and actual building cost. Common land only when no legal site exists. Not a multi-population or whole-run test. Food candidates purchase ingredients from real wallet and affect real worker speed; no new farm resource or doubled sale. Hunger candidate is experimental, not approved. Meal ledger and wallet conservation asserted each case.',rows},null,2)+'\n');
