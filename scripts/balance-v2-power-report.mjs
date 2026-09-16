import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'../docs/v2.0.0/simulation');
const [control,...candidates]=process.argv.slice(2);
if(!control||!candidates.length)throw Error('Usage: CONTROL-DIR CANDIDATE-DIR [...]');
const routes=['village-life','industrial-first','village-first','livestream-first','no-livestream','low-active'];
const median=values=>values.length?[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)]:null;
const read=(dir,route)=>{const p=resolve(root,dir,`${route}.json`);return existsSync(p)?JSON.parse(readFileSync(p)):null;};
export function summarize(r, baseline) {
  const p=r.electricity, milestones=r.milestones||[];
  const nether=milestones.find(m=>m.id==='N1')?.seconds??null;
  const controlNether=baseline?.milestones.find(m=>m.id==='N1')?.seconds;
  const starts=[];
  p.decisions.forEach((d,i)=>{if(!i||d.at-p.decisions[i-1].at>120)starts.push(d.at);});
  const operating=p.operating.filter(x=>x.at>=900&&x.demand>0);
  const ratios=operating.map(x=>x.supply/x.demand);
  const stable=operating.filter(x=>!r.purchases.some(p=>p.at<=x.at&&x.at-p.at<60));
  const realChoices=[...r.purchases,...r.management.filter(x=>x.kind!=='manual-work')].sort((a,b)=>a.at-b.at);
  const choiceGaps=[...realChoices.map((x,i)=>x.at-(i?realChoices[i-1].at:0)),r.seconds-(realChoices.at(-1)?.at||0)];
  return {route:r.scenario,netherSeconds:nether,netherDeltaPercent:nether&&controlNether?100*(nether/controlNether-1):null,
    powerDecisions:starts.length,powerPurchases:p.decisions.length,powerSpend:p.decisions.reduce((sum,x)=>sum+x.cost,0),
    deficitSeconds:p.deficitSeconds,maxDeficitRun:p.maxDeficitRun,generationShortSeconds:p.generationShortSeconds,
    generated:p.generated,consumed:p.consumed,spilled:p.spilled,lineLoss:p.losses,wasteFraction:p.spilled/Math.max(1,p.generated),
    workingSurplusMedian:median(ratios.map(x=>x-1)),surplusMedian:median(stable.map(x=>x.supply/x.demand-1)),aboveTwoMinutes:p.surplusRuns.reduce((sum,x)=>sum+x.seconds,0)/60,
    stableSamples:stable.length,stableInBand:stable.length?stable.filter(x=>x.supply/x.demand>=1.15&&x.supply/x.demand<=1.4).length/stable.length:null,
    longestBusinessGap:Math.max(...choiceGaps),longestRecordedActionGap:r.effectiveActionLongestGap,
    actualIncome:r.actualIncome,income:r.income,
    reasons:p.reasons,
    flags:[!nether?'no-nether':null,p.maxDeficitRun>60?'long-power-shortage':null,nether&&controlNether&&Math.abs(nether/controlNether-1)>.1?'time-delta-over-10-percent':null,p.surplusRuns.length?'sustained-surplus-needs-diagnosis':null,starts.length<2||starts.length>4?'decision-frequency-needs-review':null].filter(Boolean)};
}
const results=[control,...candidates].map(dir=>({dir,routes:routes.map(route=>{const r=read(dir,route);return r?summarize(r,read(control,route)):null;}).filter(Boolean)}));
const output={method:'Same-policy paired comparison. Supply/demand/actual/loss are E/s, stored and accumulated generated/spilled are E. Decisions cluster consecutive power purchases <=120s apart, distinct from individual buys. Stable sample excludes 60s immediately after any purchase; complete >2x runs remain reported and must be diagnosed. Business gap excludes repeat mining/manual task starts; recorded action gap includes successful manual work starts. These are scripted opportunities, not a proof of fun or human completion time.',results};
writeFileSync(resolve(root,'POWER-RESULTS.json'),JSON.stringify(output,null,2)+'\n');
const minute=s=>s===null?'未进入':`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
const lines=['# 电力实验结果（自动汇总）','',output.method,'','| 候选／路线 | 下界时间 | 对照变化 | 补电决策／购买 | 缺电秒数／最长 | 溢出比例 | 持续 >2× 分钟 | 稳定余量中位数 | 最长经营间隔 |','|---|---:|---:|---:|---:|---:|---:|---:|---:|'];
for(const entry of results)for(const r of entry.routes)lines.push(`| ${entry.dir} / ${r.route} | ${minute(r.netherSeconds)} | ${r.netherDeltaPercent?.toFixed(1)??'—'}% | ${r.powerDecisions} / ${r.powerPurchases} | ${r.deficitSeconds} / ${r.maxDeficitRun} | ${(100*r.wasteFraction).toFixed(1)}% | ${r.aboveTwoMinutes.toFixed(1)} | ${r.surplusMedian===null?'—':(100*r.surplusMedian).toFixed(1)+'%'} | ${minute(r.longestBusinessGap)} |`);
writeFileSync(resolve(root,'POWER-RESULTS.md'),lines.join('\n')+'\n');
console.log(JSON.stringify(results.map(x=>({dir:x.dir,routes:x.routes.map(r=>({route:r.route,nether:r.netherSeconds,decisions:r.powerDecisions,deficit:r.deficitSeconds,surplus:r.surplusMedian,waste:r.wasteFraction,flags:r.flags}))})),null,2));
