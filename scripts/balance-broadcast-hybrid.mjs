// Mixed preferences: buy a radio/host alongside normal industrial or village investments.
import{simulate,ROUTES}from'./balance-v2-joint-readable.mjs';import{writeFileSync,mkdirSync}from'node:fs';
const out='docs/v2.0.0/simulation/broadcast-stages/hybrid';mkdirSync(out,{recursive:true});
for(const id of ['industrial-first','village-life']){
 const route=ROUTES.find(r=>r.id===id),r=simulate({...route,extra:[...route.extra,'L2','L4']},{stopAtNether:true,limit:5400}),{state,...report}=r;
 writeFileSync(`${out}/${id}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({id,seconds:r.seconds,radio:r.purchases.find(p=>p.id==='L2')?.at,host:r.purchases.find(p=>p.id==='L4')?.at,liveIncome:r.income.live,effectiveActionLongestGap:r.effectiveActionLongestGap,deficitSeconds:r.electricity.deficitSeconds}));
}
