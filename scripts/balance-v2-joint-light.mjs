// One optional, existing investment per route. Not another mandatory tech gate.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {simulate,ROUTES} from './balance-v2-joint-staffed.mjs';
const engine=process.env.V2_ENGINE;
assert.equal(engine,'flow-joint-r3-focused','This intervention belongs to the R3 comparison');
assert.ok(process.argv.includes('--food-response')&&process.argv.includes('--life-policy'));
const dir=new URL('../docs/v2.0.0/simulation/',import.meta.url);
const read=file=>JSON.parse(readFileSync(new URL(file,dir)));
const hash=url=>createHash('sha256').update(readFileSync(url)).digest('hex');
const gaps=read(`${engine}-gap-probes.json`);
const {catalog:C,game:G}=await import(new URL(`${engine}.mjs`,dir));
const provenance={engineSha256:hash(new URL(`${engine}.mjs`,dir)),policySha256:hash(new URL('./balance-v2-joint-staffed.mjs',import.meta.url)),interventionSha256:hash(new URL(import.meta.url))};
assert.equal(gaps.provenance.engineSha256,provenance.engineSha256);
assert.equal(gaps.provenance.policySha256,provenance.policySha256);
const rows=[];
for(const [routeId,item]of [['village-life','V16'],['no-livestream','M17']]) {
 const input=gaps.rows.find(r=>r.route===routeId),control=read(`${engine}-p8/${routeId}.json`);
 const probe=input.options.find(o=>o.id===item);assert.ok(probe.netCash>0);
 let event=null;
 const result=simulate(ROUTES.find(r=>r.id===routeId),{stopAtNether:true,limit:7200,afterIncome(s,t,{purchase}){
  if(t!==input.probeAt)return;
  assert.ok(Math.abs(s.money-input.cash)<1e-5,'control prefix changed');
  const before=s.money,cost=G.price(s,C.ITEMS[item]);
  assert.ok(!G.requirements(s,C.ITEMS[item]).length&&cost<=before);
  assert.ok(purchase(C.ITEMS[item]),'ordinary paid purchase/placement failed');
  event={at:t,id:item,name:C.ITEMS[item].name,cost,cashBefore:before,cashAfter:s.money};
 }});
 assert.ok(event);
 const before=control.milestones.find(m=>m.id==='N1')?.seconds,after=result.milestones.find(m=>m.id==='N1')?.seconds;
 assert.ok(before&&after);
 writeFileSync(new URL(`${engine}-${routeId}-light.json`,dir),JSON.stringify({...result,intervention:{provenance,event,method:'Same earned P8 prefix, one paid opportunity at the diagnosed gap checkpoint, then original P8 policy. Time is an experiment checkpoint, not an unlock condition or an optimal policy.'}},null,2)+'\n');
 const row={route:routeId,event,netherBefore:before,netherAfter:after,changeSeconds:after-before,changePercent:(after/before-1)*100,
  baselinePurchases:control.purchases.length,purchases:result.purchases.length,deficitSeconds:result.electricity.deficitSeconds,
  hungryPersonSeconds:result.foodCare.hungryPersonSeconds,actionGap:result.effectiveActionLongestGap,baselineActionGap:control.effectiveActionLongestGap};
 rows.push(row);console.log(JSON.stringify(row));
}
writeFileSync(new URL(`${engine}-light-comparison.json`,dir),JSON.stringify({provenance,status:'bounded-existing-content-intervention',rows,limits:'One seeded deterministic policy per route. No injected money, added products or new rewards; not proof of a UI recommendation, route optimality or human enjoyment.'},null,2)+'\n');
