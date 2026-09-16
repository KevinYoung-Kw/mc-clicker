import fs from 'node:fs';
const directory='docs/v1.7/qa', routes=['industrial-first','village-first','livestream-first','no-livestream','low-active'];
const median=values=>{const list=values.filter(Number.isFinite).sort((a,b)=>a-b);return list[Math.floor(list.length/2)]??null;};
function summarize(r){
 const end=r.milestones.find(m=>m.id==='E2')?.seconds??r.seconds;
 const late=r.samples.filter(row=>row.seconds>=end);
 const opening=r.purchases.filter(p=>p.at<900);
 const maxPurchases=rows=>Math.max(0,...rows.map(p=>rows.filter(q=>q.at>=p.at&&q.at<p.at+60).length));
 const firstLate=late[0]?.power,last=late.at(-1)?.power;
 return {seconds:r.seconds,completed:r.completed,earlyPurchases:opening.length,earlyMaxPurchasesPer60s:maxPurchases(opening),
  firstRail:r.milestones.find(m=>m.id==='M16')?.seconds??null,firstNether:r.milestones.find(m=>m.id==='N1')?.seconds??null,firstEnd:end,
  endGenerationDemandMedian:median(late.filter(row=>row.power.demand>0).map(row=>row.power.generation/row.power.demand)),
  endSpilled:firstLate&&last?last.spilled-firstLate.spilled:null,endGenerated:firstLate&&last?last.generated-firstLate.generated:null};
}
const rows=routes.map(route=>{
 const before=JSON.parse(fs.readFileSync(`${directory}/balance-baseline/${route}.json`)),after=JSON.parse(fs.readFileSync(`${directory}/balance-final/${route}.json`));
 const opening=r=>r.purchases.filter(p=>p.at<900).map(({at,id,level,cost})=>({at,id,level,cost}));
 return {route,baseline:summarize(before),fixed:summarize(after),secondsChange:after.seconds-before.seconds,percentChange:(after.seconds/before.seconds-1)*100,
  first15MinutesIdentical:JSON.stringify(opening(before))===JSON.stringify(opening(after))};
});
const trace=routes.map(route=>{const data=JSON.parse(fs.readFileSync(`${directory}/balance-final/${route}-narrative.json`));return {route,profile:data.profile,completed:data.completed,phases:data.phases,spoken:data.spoken,pending:data.pending,missedReasons:data.events.filter(e=>e.phase==='skipped').reduce((o,e)=>(o[e.reason]=(o[e.reason]||0)+1,o),{})};});
const report={method:'同一确定性政策、种子 17、真实价格和存档、前台 1 秒步进。五条投资路线；旁白轨迹另模拟阅读与菜单可见性。不是玩家平均通关时间。',rows,trace};
fs.writeFileSync(`${directory}/comparison.json`,JSON.stringify(report,null,2)+'\n');
console.table(rows.map(r=>({route:r.route,before:r.baseline.seconds,after:r.fixed.seconds,change:r.secondsChange,earlySame:r.first15MinutesIdentical,powerBefore:r.baseline.endGenerationDemandMedian,powerAfter:r.fixed.endGenerationDemandMedian})));
