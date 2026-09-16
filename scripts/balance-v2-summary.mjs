import {readFileSync,writeFileSync} from 'node:fs';
const dir=new URL('../docs/v2.0.0/simulation/',import.meta.url),rows=[];
for(const [directory,id]of [['full-active','industrial-first'],['full-low-frequency','low-active'],['full-no-livestream','no-livestream']]){
  const r=JSON.parse(readFileSync(new URL(`${directory}/${id}.json`,dir)));
  const point=id=>r.milestones.find(p=>p.id===id)?.seconds;
  const actions=[...r.management,...r.purchases].sort((a,b)=>a.at-b.at),windows=actions.slice(1).map((a,i)=>({start:actions[i].at,end:a.at,seconds:a.at-actions[i].at,after:actions[i].id,before:a.id})),gaps=windows.map(w=>w.seconds).sort((a,b)=>a-b);
  rows.push({id,completed:r.completed,seconds:r.seconds,N1:point('N1'),E2:point('E2'),Z2:point('Z2'),Z3:point('Z3'),phases:[point('N1'),point('E2')-point('N1'),point('Z3')-point('E2')],researchOnlySeconds:r.researchOnlySeconds,medianActionGap:gaps[Math.floor(gaps.length/2)],longestActionGap:r.effectiveActionLongestGap,longestPurchaseGap:r.longestWait,alarmCounts:{over30:windows.filter(w=>w.seconds>30).length,over60:windows.filter(w=>w.seconds>60).length,over120:windows.filter(w=>w.seconds>120).length},over30Windows:windows.filter(w=>w.seconds>30),alarmWindows:r.alarmWindows,V12:r.counts.V12||0,V13:r.counts.V13||0,L2:r.counts.L2||0,BShare:r.income.base/r.actualIncome,base:r.income.base,actualIncome:r.actualIncome});
}
writeFileSync(new URL('full-summary.json',dir),JSON.stringify({engine:'life-engine-final',method:'Complete independent v17 global cost/ROI policies. Effective action definition in README. Not paired continuation of N1-only research routes.',rows},null,2)+'\n');
console.log(JSON.stringify(rows));
