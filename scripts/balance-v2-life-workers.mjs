// Actual miner/crafter production versus constrained manual cargo, no cash injection.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
const arg=(key,fallback)=>process.argv.includes(key)?process.argv[process.argv.indexOf(key)+1]:fallback;
const engineName=arg('--engine','life-engine-final');
if(!/^[a-z0-9-]+$/.test(engineName))throw new Error('Invalid engine name');
const {game:G,residents:R,research:Q,villagerLife:L,catalog:C,power:P}=await import(`../docs/v2.0.0/simulation/${engineName}.mjs`);
const dir=new URL('../docs/v2.0.0/simulation/',import.meta.url);
const input=JSON.parse(readFileSync(new URL('research-fork-checkpoint.json',dir)));
const rows=[];
function setJob(s,person,job){for(let t=0;t<120;t++){const r=R.assignJob(s,person.id,job);if(r.ok)return;G.advance(s,1);}throw new Error('Could not assign '+job);}
function receiptMap(s){return new Map(s.marketLedger.receipts.map(r=>[`${r.source}:${r.bucket}`,r.money]));}
for(const phaseOffset of arg('--phases','0,91').split(',').map(Number))for(const transport of arg('--transports','two-haulers,one-hauler').split(',')){
  const seed=G.restore(structuredClone(input),0);
  setJob(seed,seed.community.residents.find(r=>r.job==='farmer'),'miner');
  setJob(seed,seed.community.residents.find(r=>r.job==='rancher'),'crafter');
  if(transport.startsWith('one-hauler'))setJob(seed,seed.community.residents.find(r=>r.job==='hauler'),'idle');
  if(transport==='no-hauler-hopper-off')for(const r of seed.community.residents.filter(r=>r.job==='hauler'))setJob(seed,r,'idle');
  if(transport.endsWith('hopper-off'))assert.equal(P.toggleDevice(seed,'M8').ok,true);
  assert.equal(Q.startResearch(seed,'community-life').ok,true);G.advance(seed,20);
  const cost=G.price(seed,C.ITEMS.V22);assert.equal(G.buy(seed,'V22').ok,true);
  G.advance(seed,60+phaseOffset);
  for(const welfare of ['off','simple']){
    const s=structuredClone(seed);assert.equal(L.setWelfare(s,welfare).ok,true);
    const initial={money:s.money,income:s.total,base:s.community.baseIncome,jobs:s.community.jobIncome,spent:s.life.spent,shipped:s.community.shipped,done:s.community.residents.reduce((v,r)=>v+r.jobsDone,0)};
    let sales=0,maxResting=0,outstandingSeconds=0,outstandingQuantity=0,happiness=0;
    const bySource={};
    for(let t=0;t<1800;t++){
      const before=receiptMap(s);G.advance(s,1);
      for(const r of s.marketLedger.receipts){const gain=Math.max(0,r.money-(before.get(`${r.source}:${r.bucket}`)||0));sales+=gain;bySource[r.source]=(bySource[r.source]||0)+gain;}
      const workers=s.community.residents.filter(r=>!r.reserve&&r.job!=='idle'),resting=workers.filter(r=>L.isResting(s,r)).length;
      assert.ok(resting<=Math.max(1,Math.ceil(workers.length/4)));maxResting=Math.max(maxResting,resting);
      for(const job of new Set(workers.map(r=>r.job))){const peers=workers.filter(r=>r.job===job);if(peers.length>1)assert.ok(peers.some(r=>!L.isResting(s,r)));}
      const backlog=s.community.batches.reduce((v,b)=>v+b.qty-b.delivered,0);if(backlog>0)outstandingSeconds++;outstandingQuantity+=backlog;
      happiness+=L.lifeSnapshot(s).happiness;assert.ok(s.money>=0);
    }
    const row={phaseOffset,transport,welfare,commonAssetCost:cost+800,people:s.community.residents.length,jobs:s.community.residents.map(r=>r.job),walletDelta:s.money-initial.money,income:s.total-initial.income,actualSales:sales,baseIncome:s.community.baseIncome-initial.base,jobIncome:s.community.jobIncome-initial.jobs,welfareCost:s.life.spent-initial.spent,shipped:s.community.shipped-initial.shipped,jobsDone:s.community.residents.reduce((v,r)=>v+r.jobsDone,0)-initial.done,meanHappiness:happiness/1800,maxResting,outstandingSeconds,meanOutstanding:outstandingQuantity/1800,bySource};
    assert.ok(Math.abs(row.walletDelta-row.income+row.welfareCost)<1e-5);rows.push(row);console.log(JSON.stringify(row));
  }
}
writeFileSync(new URL(arg('--out','integrated-life-workers.json'),dir),JSON.stringify({method:'Frozen named schema8 engine; manifest identifies exact welfare and comfort/range version. Genuine six-person earned checkpoint. Farmer/rancher reassigned through actual API to miner/crafter; one-hauler assigns second carrier idle; no-hauler assigns both idle. Hopper stays unless explicitly hopper-off: then actual device switch turns it off as a deliberate stress intervention, not a natural route. Common tavern/research bought with earned money before paired forks; 30min off/simple welfare comparisons include recurring costs, not common capital. No source capacity or goods injection. Outstanding goods indicate queue occupancy, not proof that all waiting is caused by transport. Both phases enforce global rest cap and shared-job coverage each second.',engine:JSON.parse(readFileSync(new URL(`${engineName}-manifest.json`,dir))),rows},null,2)+'\n');
