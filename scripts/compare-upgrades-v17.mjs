import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
const baselineArg=process.argv.indexOf('--baseline');
const roots={baseline:baselineArg>=0?process.argv[baselineArg+1]:'/tmp/mc-v17-baseline',fixed:process.cwd()},report={};
for(const [label,root] of Object.entries(roots)){
 const game=await import(pathToFileURL(resolve(root,'src/game.js'))),up=await import(pathToFileURL(resolve(root,'src/upgrades.js'))),power=await import(pathToFileURL(resolve(root,'src/power.js'))),capacity=await import(pathToFileURL(resolve(root,'src/facility-capacity.js'))),catalog=await import(pathToFileURL(resolve(root,'src/catalog.js')));
 report[label]={};
 for(const type of ['drill','furnace']){
  const original=game.fresh(0);original.money=1e20;
  Object.assign(original.counts,{M5:1,M6:10,M7:12,M15:8,M4:8,M8:16,M16:16,V3:12,T7:1,T3:1,T5:1,M9:type==='drill'?5:20,M2:type==='furnace'?3:16,N1:1,N11:1});
  Object.assign(original.upgrades.levels,{'drill-steel':1,'drill-diamond':1,'drill-twin':1,'drill-cooling':1,'drill-outlet':1,'drill-buffer':3,
   'furnace-core':type==='furnace'?2:3,'furnace-lining':1,'furnace-blower':1,'furnace-feed':1,'market-pack':3});original.upgrades.revision=1;
  for(const [id,level] of Object.entries(original.counts))if(level>catalog.ITEMS[id].max)throw Error('Fixture exceeds facility cap: '+id);
  for(const [id,level] of Object.entries(original.upgrades.levels))if(!up.UPGRADE_BY_ID[id]||level>up.UPGRADE_BY_ID[id].maxLevel||up.upgradeRequirements(original,id).length)throw Error('Invalid upgrade fixture: '+id);
  power.connectAll(original);original.energy=power.gridCapacity(original);
  const run=s=>{const base=s.total,generated=s.grid.generated,spent=s.grid.spent;for(let t=0;t<120;t+=.25)game.advance(s,.25);return {income:s.total-base,generated:s.grid.generated-generated,spent:s.grid.spent-spent,raw:s.buffers.overworld.raw,goods:s.buffers.overworld.goods};};
  const before=structuredClone(original),after=structuredClone(original),id=type==='drill'?'drill-netherite':'furnace-core';
  const cap=s=>type==='drill'?capacity.drillCapacity(s):capacity.furnaceCapacity(s),oldCap=cap(before),purchase=up.buyUpgrade(after,id);
  if(!purchase.ok)throw Error(JSON.stringify(purchase));const newCap=cap(after);
  const a=run(before),b=run(after);report[label][type]={id,beforeCapacity:oldCap,afterCapacity:newCap,before:a,after:b,additionalIncome:b.income-a.income,paybackSeconds:b.income>a.income?purchase.cost/((b.income-a.income)/120):null};
  if(label==='fixed'&&!(newCap>oldCap&&b.income>a.income))throw Error('Upgrade failed controlled full-chain comparison: '+JSON.stringify(report[label][type]));
 }
}
mkdirSync('docs/v1.7/qa',{recursive:true});writeFileSync('docs/v1.7/qa/upgrade-comparison.json',JSON.stringify({method:'同一合法改造组合，固定 120 秒前台运行；充足供电、运输和交易用于隔离改造价值。对照不是整局 ROI 保证。',...report},null,2)+'\n');console.log(JSON.stringify(report,null,2));
