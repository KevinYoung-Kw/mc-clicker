import{readFileSync,writeFileSync,mkdirSync}from'node:fs';import assert from'node:assert/strict';
import{game as prior}from'../docs/v2.0.0/simulation/alpha5-broadcast-control.mjs';import * as current from'../src/game.js';
const out='docs/v2.0.0/qa/alpha6-broadcast';mkdirSync(out,{recursive:true});const reports=[];
for(const route of ['livestream-first','village-life','no-livestream']){
 const raw=JSON.parse(readFileSync(`docs/v2.0.0/simulation/broadcast-stages/control/${route}-save.json`));
 function run(engine){const s=engine.restore(structuredClone(raw),0);let seed=29;const random=Math.random;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);try{for(let i=0;i<120;i++)engine.advance(s,1);}finally{Math.random=random;}return s;}
 const a=run(prior),b=run(current);for(const key of ['money','total','liveIncome','productionIncome','counts','placements','buffers','research'])assert.deepEqual(b[key],a[key],`${route}:${key}`);
 for(const key of ['viewers','peak','income','gifts'])assert.deepEqual(b.live[key],a.live[key],`${route}:live.${key}`);
 const saved=current.restore(JSON.parse(JSON.stringify(b)),0);assert.equal(saved.live.legacyBroadcast,b.live.legacyBroadcast);assert.equal(saved.money,b.money);
 reports.push({route,foregroundSeconds:120,money:a.money,live:a.liveIncome,exactWalletIncomeCargoAndAudience:true,legacy:b.live.legacyBroadcast,reloadRetains:true});
}
writeFileSync(`${out}/legacy-report.json`,JSON.stringify(reports,null,2));console.log(reports);
