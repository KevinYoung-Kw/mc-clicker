// Real foreground economy + current narrator rules; modeled menu/receipt visibility.
// This measures scripted density, not human reading or native UI occlusion.
import {writeFileSync,readFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {simulate,ROUTES} from './balance-v2-full.mjs';
import {narrativeSession} from './narrative-session-v17.mjs';
import {currentNarration} from '../src/narrative.js';
const seconds=1800,out=new URL('../docs/v2.0.0/qa/narration/',import.meta.url);
mkdirSync(out,{recursive:true});
const reports=[];
for(const [strategy,attention] of [['industrial-first','normal'],['low-active','slow-read'],['no-livestream','interrupted']]){
 const trace=narrativeSession(attention),bins=Array.from({length:6},(_,i)=>({from:i*300,to:(i+1)*300,visibleSeconds:0,lineStarts:0,characters:0}));
 const r=simulate(ROUTES.find(p=>p.id===strategy),{limit:seconds,afterIncome:(s,t,ctx)=>{
  trace.tick(s,t,ctx);const c=currentNarration(s);
  // blockedFor is advanced by the actual narrator when modeled panels/receipts hide it.
  if(c&&!(s.narrative.current.blockedFor>0))bins[Math.min(5,Math.floor(t/300))].visibleSeconds++;
 }});
 const detail=trace.finish(r.state,r.purchases);
 // Exclude the helper's optional 35s post-run tail from all quantitative results.
 detail.events=detail.events.filter(e=>e.at<=seconds);
 for(const e of detail.events.filter(e=>e.phase==='spoken')){
  const b=bins[Math.min(5,Math.floor(Math.max(0,e.at-1)/300))];b.lineStarts++;b.characters+=[...(e.text||'')].length;
 }
 for(const b of bins)b.visibleFraction=+(b.visibleSeconds/300).toFixed(3);
 const row={strategy,attention,seconds,bins,spoken:detail.events.filter(e=>e.phase==='spoken').map(({at,id,index,text})=>({at,id,index,text})),
  interrupted:detail.events.filter(e=>e.phase==='interrupted').map(({at,id})=>({at,id})),
  completedBy30Minutes:r.completed,method:'真实冻结经济 + 当前旁白；每次购买后 1–2 秒回执、8 秒商城，慢读时钟0.65倍，频繁菜单每180秒先停留65秒工业面板。字幕存在且未因模拟表面阻挡计为显示秒，不包含收尾35秒。不等同浏览器逐帧或真人阅读验收。'};
 reports.push(row);writeFileSync(new URL(`${strategy}.json`,out),JSON.stringify({...row,events:detail.events},null,2)+'\n');
 console.log(JSON.stringify({strategy,bins}));
}
const inputs=['scripts/balance-v2-narration.mjs','scripts/narrative-session-v17.mjs','src/narrative.js','src/narrator-copy.js','src/narrator-voice.js'];
writeFileSync(new URL('report.json',out),JSON.stringify({method:'Current narrator scheduling on frozen real-economy runs; audit, not a human-readability guarantee.',inputs:Object.fromEntries(inputs.map(p=>[p,createHash('sha256').update(readFileSync(new URL('../'+p,import.meta.url))).digest('hex')])),reports},null,2)+'\n');
