// Paired earned-save continuation: capital + research + recurring expenses included.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const arg=(key,fallback)=>process.argv.includes(key)?process.argv[process.argv.indexOf(key)+1]:fallback;
const engine=arg('--engine','a3-a'),out=arg('--out',`${engine}-investments`);
const {game:G,catalog:C,research:R,villagerLife:L}=await import(`../docs/v2.0.0/simulation/${engine}.mjs`);
const input=JSON.parse(fs.readFileSync(new URL('../docs/v2.0.0/simulation/research-fork-checkpoint.json',import.meta.url)));
const cases=[['control'],['park','V21',1],['canteen','V25',1],['canteen2','V25',2],['canteen3','V25',3],['canteen-welfare','V25',1,'simple'],['tavern','V22',1],['cart','V24',1]];
const rows=[];
for(const phase of arg('--phases','0,45,91,137,180,230').split(',').map(Number)){
 const base=G.restore(input);for(let i=0;i<phase;i++)G.advance(base,1);
 // Common legal land only when required by the candidate footprint; no cash injection.
 if(!G.sites(base,'overworld',null,'V25').length)assert.ok(G.buy(base,'V1',G.frontier(base)[0]).ok);
 for(const [id,asset,target=1,welfare]of cases.filter(c=>arg('--cases','all')==='all'||arg('--cases','all').split(',').includes(c[0]))){
  const s=structuredClone(base),initial={money:s.money,total:s.total,spent:s.life.spent,shipped:s.community.shipped,jobs:s.community.jobIncome,done:s.community.residents.reduce((n,r)=>n+r.jobsDone,0)};
  let capital=0,built=!asset,boughtAt=null,tech=asset==='V24'?'cargo-tools':['V25','V22'].includes(asset)?'community-life':null;
  if(tech){const r=R.startResearch(s,tech);assert.ok(r.ok);capital+=r.cost;}
  let happy=0,food=0,backlog=0,maxRest=0,failed=null;const samples=[];
  for(let t=0;t<1800;t++){
   if(!built&&(!tech||s.research.completed[tech])){
    const workers=s.community.residents.filter(r=>r.job!=='idle'),positions=G.sites(s,'overworld',null,asset).sort((a,b)=>workers.reduce((v,r)=>v+Math.hypot(a.x-r.x,a.z-r.z)-Math.hypot(b.x-r.x,b.z-r.z),0));
    const p=positions[0];if(!p){failed='no legal site';break;}
    const cost=G.price(s,C.ITEMS[asset]),r=G.buy(s,asset,p);if(!r.ok){failed=r.reason;break;}capital+=cost;built=true;boughtAt=t;
    for(let level=1;level<target;level++){const cost=G.price(s,C.ITEMS[asset]),r=G.buy(s,asset);if(!r.ok){failed=r.reason;break;}capital+=cost;}
    if(welfare)assert.ok(L.setWelfare(s,welfare).ok);
   }
   G.advance(s,1);const a=L.lifeSnapshot(s);happy+=a.happiness;food+=a.foodPeople;maxRest=Math.max(maxRest,a.resting);
   backlog+=s.community.batches.reduce((v,b)=>v+b.qty-b.delivered,0);assert.ok(a.bonus<=15.000001);assert.ok(s.money>=0);
   if([300,600,900,1800].includes(t+1))samples.push({seconds:t+1,income:s.total-initial.total,wallet:s.money-initial.money,jobs:s.community.jobIncome-initial.jobs,shipped:s.community.shipped-initial.shipped,expense:s.life.spent-initial.spent,visits:s.life.visits-base.life.visits});
  }
  assert.ok(failed||Math.abs(s.money-initial.money-((s.total-initial.total)-capital-(s.life.spent-initial.spent)))<.001);
  rows.push({phase,id,capital,boughtAt,failed,meanHappiness:happy/1800,meanFoodPeople:food/1800,meanBacklog:backlog/1800,maxRest,samples});
 }
}
for(const row of rows){const control=rows.find(r=>r.phase===row.phase&&r.id==='control');row.delta=row.samples.map((s,i)=>({seconds:s.seconds,netCash:s.wallet-control.samples[i].wallet,income:s.income-control.samples[i].income,jobs:s.jobs-control.samples[i].jobs,shipped:s.shipped-control.samples[i].shipped}));}
fs.writeFileSync(new URL(`../docs/v2.0.0/simulation/${out}.json`,import.meta.url),JSON.stringify({engine,source:JSON.parse(fs.readFileSync(new URL(`../docs/v2.0.0/simulation/${engine}-manifest.json`,import.meta.url))),method:'Real earned six-person save, six starting phases, nearest legal service site, no mining or further purchases. Each intervention pays own research, building, upgrades and welfare. Samples measure actual wallet, income and shipped cargo. Common extra land only if geometry needs it. All deltas paired against same-phase control. No guaranteed return in other layouts.',rows},null,2)+'\n');
console.log(JSON.stringify(rows.map(r=>({phase:r.phase,id:r.id,capital:r.capital,failed:r.failed,food:r.meanFoodPeople,net15:r.delta[2]?.netCash,net30:r.delta[3]?.netCash,job30:r.delta[3]?.jobs}))));
