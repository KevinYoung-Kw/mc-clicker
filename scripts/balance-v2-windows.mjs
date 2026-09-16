// Replay two representative management gaps; feedback is not inferred from shop timing.
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {simulate,ROUTES} from './balance-v2-full.mjs';
import {game as G,catalog as C,upgrades as U} from '../docs/v2.0.0/simulation/life-engine-final.mjs';
const dir=new URL('../docs/v2.0.0/simulation/',import.meta.url);
const arg=(key,fallback)=>process.argv.includes(key)?process.argv[process.argv.indexOf(key)+1]:fallback;
const selected=arg('--profile','all');
const probePosition=arg('--probe','mid');
const specs=[{id:'industrial-first',start:1664,end:1935,target:'N1'},{id:'low-active',start:4620,end:4944,target:'E2'}];
function receipts(s){return new Map(s.marketLedger.receipts.map(r=>[`${r.source}:${r.bucket}`,r.money]));}
function waitToCash(seed,route,target,mining,horizon=1200){const s=structuredClone(seed),cost=G.price(s,C.ITEMS[target]);let targetAt=null;const initial=s.money;for(let t=0;t<horizon;t++){G.advance(s,1);if(mining&&(Math.floor(seed.play)+t)%route.click===0)G.mine(s,()=>1);if(s.money>=cost&&targetAt===null)targetAt=t+1;}return {targetCashAt:targetAt,netCash:s.money-initial};}
for(const spec of specs.filter(s=>selected==='all'||s.id===selected)){
  const route=ROUTES.find(r=>r.id===spec.id);let checkpoint;
  const cache=new URL(`window-${spec.id}-checkpoint.json`,dir);
  if(existsSync(cache))checkpoint=JSON.parse(readFileSync(cache));
  else {simulate(route,{limit:spec.start+2,afterIncome(s,t){if(t===spec.start+1)checkpoint=structuredClone(s);}});if(checkpoint)writeFileSync(cache,JSON.stringify(checkpoint)+'\n');}
  if(!checkpoint)throw new Error('Missing replay checkpoint');
  const s=structuredClone(checkpoint),beforeMoney=s.money,beforeTotal=s.total,beforeNarrative=s.narrative.history.length,eventSerial=s.eventSerial;
  const feedback=[],mines=[],samples=[];let sales=0,meanBacklog=0,maxBacklog=0,probeSeed=probePosition==='start'?checkpoint:null;
  const seconds=spec.end-spec.start;
  for(let t=0;t<seconds;t++){
    const before=receipts(s);G.advance(s,1);let sold=0;
    for(const r of s.marketLedger.receipts)sold+=Math.max(0,r.money-(before.get(`${r.source}:${r.bucket}`)||0));
    if(sold>0){sales+=sold;feedback.push(t+1);}
    if((spec.start+2+t)%route.click===0){const cash=s.money;G.mine(s,()=>1);if(s.money>cash)mines.push({at:t+1,money:s.money-cash});}
    const backlog=s.community.batches.reduce((v,b)=>v+b.qty-b.delivered,0);meanBacklog+=backlog;maxBacklog=Math.max(maxBacklog,backlog);
    if(t%30===0)samples.push({at:t+1,money:s.money,sales,backlog,buffer:structuredClone(s.buffers)});
    if(probePosition!=='start'&&t===Math.floor(seconds/2))probeSeed=structuredClone(s);
  }
  const gaps=times=>times.slice(1).map((t,i)=>t-times[i]).sort((a,b)=>a-b);
  const saleGaps=gaps(feedback),mineGaps=gaps(mines.map(m=>m.at));
  const candidates=[];const base=G.rates(probeSeed).total;
  for(const item of C.CATALOG){if(item.id==='V1'||item.family==='X'||G.n(probeSeed,item.id)>=item.max||G.price(probeSeed,item)>probeSeed.money||G.requirements(probeSeed,item).length)continue;
    const copy=structuredClone(probeSeed);if(!G.buy(copy,item.id).ok)continue;const gain=G.rates(copy).total-base;
    if(gain>0||['M4','M8','V3'].includes(item.id))candidates.push({id:item.id,cost:G.price(probeSeed,item),gain,copy});}
  for(const row of U.UPGRADE_CATALOG){if(U.upgradeStatus(probeSeed,row.id).kind!=='ready')continue;const cost=U.upgradePrice(probeSeed,row.id);if(cost>probeSeed.money)continue;const copy=structuredClone(probeSeed);if(!U.buyUpgrade(copy,row.id).ok)continue;const gain=G.rates(copy).total-base;if(gain>0)candidates.push({id:row.id,cost,gain,copy});}
  candidates.sort((a,b)=>a.cost/Math.max(.00001,a.gain)-b.cost/Math.max(.00001,b.gain));
  const control=structuredClone(probeSeed);G.advance(control,300);
  const tested=candidates.slice(0,3).map(c=>{G.advance(c.copy,300);return {id:c.id,cost:c.cost,netCashAfter300:c.copy.money-control.money};});
  const row={...spec,checkpointAt:spec.start+1,checkpointMoney:checkpoint.money,targetCashRequired:G.price(checkpoint,C.ITEMS[spec.target]),ordinaryTargetRequirements:G.requirements(checkpoint,C.ITEMS[spec.target]),researchOnlySeconds:0,
    replaySeconds:seconds,cashDelta:s.money-beforeMoney,income:s.total-beforeTotal,actualSales:sales,saleFeedbackEvents:feedback.length,saleMedianGap:saleGaps[Math.floor(saleGaps.length/2)]||null,saleLongestGap:Math.max(0,...saleGaps),
    immediateMiningEvents:mines.length,immediateMiningIncome:mines.reduce((v,r)=>v+r.money,0),miningMedianGap:mineGaps[Math.floor(mineGaps.length/2)]||null,miningLongestGap:Math.max(0,...mineGaps),
    meanBacklog:meanBacklog/seconds,maxBacklog,newNarrativeHistory:s.narrative.history.length-beforeNarrative,engineEventDelta:s.eventSerial-eventSerial,narrativeOpening:s.narrative.openingChoice,
    opportunityProbeAt:probePosition==='start'?spec.start+1:spec.start+Math.floor(seconds/2)+2,opportunityProbeCash:probeSeed.money,affordableCandidates:candidates.length,real300SecondUpgradeProbes:tested,cashTargetWithMining:waitToCash(checkpoint,route,spec.target,true),cashTargetWithoutMining:waitToCash(checkpoint,route,spec.target,false),samples};
  writeFileSync(new URL(`window-${spec.id}.json`,dir),JSON.stringify({method:'Real same-policy prefix replay to just after start; representative window advances actual frozen engine and original mining cadence, no purchases or manual work starts within the known management gap. Sale feedback is actual money settlement per 1s tick, not rendered animation. At most three affordable legal nominal-ROI candidates at the midpoint receive real300s paid-vs-control cash probes; M4/M8/V3 are also allowed when nominal gain is zero to probe buffering. Mining intervention measures seconds to target CASH threshold, not layout/research purchase readiness; no later purchases. Narration opening remains pending in this engine harness, so UI displayed narration density is unmeasured. No claim all >30/60s gaps are classified.',row},null,2)+'\n');
  console.log(JSON.stringify({...row,samples:undefined}));
}
