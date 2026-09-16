// Three comparisons at earned route checkpoints: choice availability, active saving,
// and a paid modern research + broadcast branch versus keeping the same cash.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {simulate,ROUTES} from './balance-v2-full.mjs';
const engine=process.env.V2_ENGINE||'a3-e';const {game:G,catalog:C,research:R,upgrades:U,power:P}=await import(`../docs/v2.0.0/simulation/${engine}.mjs`);
const route=ROUTES.find(r=>r.id==='no-livestream');let modernSeed,waitSeed,largest=0,windowSeed,windowStart;
const opportunitySamples=[];
const run=simulate(route,{stopAtNether:true,limit:6600,afterIncome(s,t,{purchases}){
 if(!modernSeed&&R.researchStatus(s,'modern').kind==='ready'&&s.money>=R.RESEARCH_BY_ID.modern.cost)modernSeed=structuredClone(s);
 const start=purchases.at(-1)?.at||0,gap=t-start;
 if(t%30||gap<30)return;
 if(windowStart!==start){windowStart=start;windowSeed=structuredClone(s);}
 const options=[];
 for(const item of C.CATALOG){if(item.family==='X'||item.id==='V1'||G.n(s,item.id)>=item.max||s.money<G.price(s,item)||G.requirements(s,item).length)continue;
  const probe=structuredClone(s);if(!G.buy(probe,item.id).ok)continue;const gain=G.rates(probe).total-G.rates(s).total;
  if(gain>0)options.push({id:item.id,location:G.n(s,item.id)?'已购买 / 设施详情':'商城发现',cost:G.price(s,item),nominalGain:gain});
 }
 for(const row of U.UPGRADE_CATALOG){if(U.upgradeStatus(s,row.id).kind!=='ready'||U.upgradePrice(s,row.id)>s.money)continue;const probe=structuredClone(s);if(!U.buyUpgrade(probe,row.id).ok)continue;const gain=G.rates(probe).total-G.rates(s).total;if(gain>0)options.push({id:row.id,location:'设施改造',cost:U.upgradePrice(s,row.id),nominalGain:gain});}
 opportunitySamples.push({at:t,sincePurchase:gap,money:s.money,options});
 if(gap>largest&&s.research.completed.modern&&!G.n(s,'N1')){largest=gap;waitSeed=structuredClone(windowSeed);}
}});
function continueSaving(seed,clicks,cost,seconds=900){const s=structuredClone(seed),money=s.money;let reached=null;for(let t=0;t<seconds;t++){G.advance(s,1);if(clicks&&t%2===0)G.mine(s,()=>1);if(reached===null&&s.money>=cost)reached=t+1;}return {cashAfter:s.money-money,reached};}
const saving=waitSeed?{play:waitSeed.play,money:waitSeed.money,target:G.price(waitSeed,C.ITEMS.N1),click:continueSaving(waitSeed,true,G.price(waitSeed,C.ITEMS.N1)),idle:continueSaving(waitSeed,false,G.price(waitSeed,C.ITEMS.N1))}:null;
if(modernSeed)fs.writeFileSync(new URL(`../docs/v2.0.0/simulation/${engine}-modern-checkpoint.json`,import.meta.url),JSON.stringify(modernSeed)+'\n');
const improvementProbes=[];
if(waitSeed){
 const control=structuredClone(waitSeed);for(let t=0;t<600;t++){G.advance(control,1);if(t%2===0)G.mine(control,()=>1);}
 for(const item of C.CATALOG){if(item.id==='V1'||item.family==='X'||!G.n(waitSeed,item.id)||G.n(waitSeed,item.id)>=item.max||G.price(waitSeed,item)>waitSeed.money||G.requirements(waitSeed,item).length)continue;
  const copy=structuredClone(waitSeed),r=G.buy(copy,item.id);if(!r.ok)continue;for(let t=0;t<600;t++){G.advance(copy,1);if(t%2===0)G.mine(copy,()=>1);}improvementProbes.push({id:item.id,cost:r.cost,net600:copy.money-control.money});
 }
}
const broadcast=[];
if(modernSeed)for(const variant of ['hold-cash','broadcast','industrial-upgrade']){
 const s=structuredClone(modernSeed),initial={money:s.money,total:s.total,live:s.liveIncome};let capital=0,bought=false,study=false;const events=[],samples=[];
 if(variant==='broadcast'){const r=R.startResearch(s,'modern');assert.ok(r.ok);capital+=r.cost;study=true;events.push({at:0,id:'research:modern',cost:r.cost});}
 for(let t=0;t<1800;t++){
  if(variant==='broadcast'&&!bought&&s.money>=G.price(s,C.ITEMS.L2)){
   function prepare(id){const item=C.ITEMS[id];for(const dep of item.deps)if(!G.n(s,dep))return prepare(dep);if(item.gate?.id&&G.n(s,item.gate.id)<item.gate.level)return prepare(item.gate.id);
    if(G.requirements(s,item).length)return {ok:false,reason:G.requirements(s,item).join(';')};
    if(item.place&&!G.n(s,id)&&!G.sites(s,item.realm,null,id).length){const p=G.frontier(s,item.realm)[0];if(!p)return {ok:false,reason:'no frontier'};const cost=G.price(s,C.ITEMS.V1,item.realm),r=G.buy(s,'V1',{...p,realm:item.realm});if(r.ok){capital+=cost;events.push({at:t,id:'V1',cost});}return {ok:false,reason:'expanded'};}
    const cost=G.price(s,item),r=G.buy(s,id);if(r.ok){capital+=cost;events.push({at:t,id,cost});if(id==='L2')bought=true;}return r;}
   prepare('L2');P.connectAll(s);
  }
  if(variant==='industrial-upgrade'&&!bought&&s.money>=G.price(s,C.ITEMS.M9)){const r=G.buy(s,'M9');if(r.ok){capital+=r.cost;bought=true;events.push({at:t,id:'M9',cost:r.cost});}}
  G.advance(s,1);if(t%2===0)G.mine(s,()=>1);
  if([300,600,900,1800].includes(t+1))samples.push({seconds:t+1,wallet:s.money-initial.money,income:s.total-initial.total,live:s.liveIncome-initial.live,viewers:s.live.viewers,rate:G.rates(s).live});
 }
 assert.ok(Math.abs(s.money-initial.money-(s.total-initial.total-capital))<.01);
 broadcast.push({variant,startAt:modernSeed.play,startingCash:initial.money,capital,bought,study,events,samples});
}
const gaps=[...run.management,...run.purchases].sort((a,b)=>a.at-b.at);const intervals=gaps.slice(1).map((x,i)=>x.at-gaps[i].at).sort((a,b)=>a-b);
const report={engine,method:'Same real full-route policy. Legal affordable nominal-improvement opportunities are candidates, not proven ROI. No narrator events counted as actions. Mining paired against no mining at same worst savings checkpoint. Broadcast branch starts from earned pre-modern-research cash, includes research/building/land, compares holding cash and buying one drill grade. Fixed 30min continuation, same 2s clicks, no injected cash. Not a human playtest.',netherSeconds:run.seconds,managementMedian:intervals[Math.floor(intervals.length*.5)],managementP90:intervals[Math.floor(intervals.length*.9)],managementMax:Math.max(...intervals),researchOnlySeconds:run.researchOnlySeconds,opportunitySamples,saving,improvementProbes,broadcast};
fs.writeFileSync(new URL(`../docs/v2.0.0/simulation/${engine}-economy-audit.json`,import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({netherSeconds:run.seconds,saving,broadcast}));
