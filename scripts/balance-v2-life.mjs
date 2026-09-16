// Integrated schema-8 game.advance probes: actual short rest, welfare and carts.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const arg=(key,fallback)=>process.argv.includes(key)?process.argv[process.argv.indexOf(key)+1]:fallback;
const engineName=arg('--engine','life-engine-staggered');
if(!/^[a-z0-9-]+$/.test(engineName))throw new Error('Invalid engine snapshot');
const { game:G,catalog:C,research:R,villagerLife:L }=await import(`../docs/v2.0.0/simulation/${engineName}.mjs`);
const out=new URL('../docs/v2.0.0/simulation/',import.meta.url);
const saved=JSON.parse(readFileSync(new URL('research-fork-checkpoint.json',out)));
const cases=[{id:'life-off',off:true},{id:'basic-life'},{id:'park',facility:'V21'},{id:'cart',technology:'cargo-tools',facility:'V24'},
  {id:'tavern',technology:'community-life',facility:'V22'},{id:'tavern-tea',technology:'community-life',facility:'V22',welfare:'simple'}];
const rows=[];
function receipts(s){return new Map((s.marketLedger?.receipts||[]).map(r=>[`${r.source}:${r.bucket}`,{money:r.money,quantity:r.quantity}]));}
function buyWithLand(s,id,events,t){
  let cost=G.price(s,C.ITEMS[id]),result=G.buy(s,id);
  if(result.ok){events.push({at:t,id,cost});return cost;}
  if(result.reason?.includes('挤')){
    const p=G.frontier(s,'overworld').sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z))[0],landCost=G.price(s,C.ITEMS.V1,'overworld');
    if(p&&G.buy(s,'V1',{...p,realm:'overworld'}).ok){events.push({at:t,id:'V1',cost:landCost});const after=G.buy(s,id);if(after.ok){events.push({at:t,id,cost});return cost+landCost;}return {failed:after.reason,spent:landCost};}
  }
  return {failed:result.reason,spent:0};
}
for(const phaseOffset of [0,91])for(const scenario of cases){
  const s=G.restore(structuredClone(saved),0);if(phaseOffset)G.advance(s,phaseOffset);
  const initial={money:s.money,total:s.total,base:s.community.baseIncome,shipped:s.community.shipped,work:s.community.residents.reduce((sum,r)=>sum+r.jobsDone,0),welfare:s.life.spent};
  if(scenario.off)delete s.life;
  let investment=0,failed=null,sales=0,sold=0,maxResting=0,restPersonSeconds=0,maxOutstanding=0,facilityBought=false;
  const events=[],samples=[];
  if(scenario.technology){const result=R.startResearch(s,scenario.technology);if(!result.ok)failed=result.reason;else{investment+=result.cost;events.push({at:0,id:scenario.technology,cost:result.cost});}}
  for(let t=0;t<1800;t++){
    if(!failed&&scenario.facility&&!facilityBought&&(!scenario.technology||s.research.completed[scenario.technology])){
      const result=buyWithLand(s,scenario.facility,events,t);if(typeof result==='number'){investment+=result;facilityBought=true;
        if(scenario.welfare){const welfare=L.setWelfare(s,scenario.welfare);if(!welfare.ok)failed=welfare.reason;}}
      else{investment+=result.spent;failed=result.failed;}
    }
    const before=receipts(s);G.advance(s,1);
    for(const r of s.marketLedger.receipts){const old=before.get(`${r.source}:${r.bucket}`);sales+=Math.max(0,r.money-(old?.money||0));sold+=Math.max(0,r.quantity-(old?.quantity||0));}
    const resting=s.community.residents.filter(r=>L.isResting(s,r)).length;maxResting=Math.max(maxResting,resting);restPersonSeconds+=resting;
    if(engineName==='life-engine-staggered')assert.ok(resting<=Math.max(1,Math.ceil(s.community.residents.filter(r=>!r.reserve&&r.job!=='idle').length/4)),'Staggered rest capacity');
    maxOutstanding=Math.max(maxOutstanding,s.community.batches.reduce((v,b)=>v+b.qty-b.delivered,0));
    assert.ok(s.money>=0);for(const b of s.community.batches){assert.ok(b.qty>=-1e-7);assert.ok(b.delivered>=-1e-7&&b.delivered<=b.qty+1e-7);}
    if([599,1799].includes(t))samples.push({at:t+1,walletDelta:s.money-initial.money,income:s.total-initial.total,salesMoney:sales,soldQuantity:sold,
      baseIncome:s.community.baseIncome-initial.base,shipped:s.community.shipped-initial.shipped,jobsDone:s.community.residents.reduce((v,r)=>v+r.jobsDone,0)-initial.work,
      welfareCost:(s.life?.spent||0)-initial.welfare,rests:s.life?.rests||0,returns:s.life?.returns||0,visits:s.life?.visits||0,meanHappiness:L.lifeSnapshot(s).happiness});
  }
  const welfare=(s.life?.spent||0)-initial.welfare;
  assert.ok(Math.abs(s.money-(initial.money+s.total-initial.total-investment-welfare))<1e-5,'Cash conservation including welfare and capital');
  rows.push({scenario:scenario.id,phaseOffset,initialMoney:initial.money,investment,failed,facilityBought,maxSimultaneousResting:maxResting,restPersonSeconds,maxOutstanding,events,samples});
  console.log(JSON.stringify({scenario:scenario.id,phaseOffset,investment,failed,maxSimultaneousResting:maxResting,restPersonSeconds,final:samples.at(-1)}));
}
const report={method:'Integrated life-engine snapshot, schema 8; genuine game.restore/game.advance, research starts, catalogue purchases, placements/paid land and welfare ledger. All forks start from the same historical real-policy save; 0/91s warm offsets test phase sensitivity. No cash, goods, staff or facility injection. life-off deletes the life subtree to disable BOTH rest and happiness, so it is a combined-system comparison, not an isolated attendance coefficient. No continued buying/mining/manual harvesting beyond the named paid intervention. Asset cost and recurring welfare included; this is not a full playthrough.',
  engine:JSON.parse(readFileSync(new URL(`${engineName}-manifest.json`,out))),inputHash:createHash('sha256').update(JSON.stringify(saved)).digest('hex'),rows};
writeFileSync(new URL(arg('--out','integrated-life-staggered-forks.json'),out),JSON.stringify(report,null,2)+'\n');
