// Run: node scripts/narrator-timing-v151.mjs --max-seconds 900 --out docs/v1.5.1/qa/simulation
import { mkdirSync, writeFileSync } from 'node:fs';
import { simulate, ROUTES } from './balance-v1.1l.mjs';
import { buyGuidance } from '../src/guidance.js';
import { connectAll, setAutoConnect } from '../src/power.js';
import { recordNarrativeAction } from '../src/narrative-behavior.js';
import { advanceNarrative, currentNarration } from '../src/narrative.js';
import { mine } from '../src/game.js';
import { canHoldMine } from '../src/mining-combo.js';
import { chooseOpening } from '../src/opening-guide.js';

const hold=process.argv.includes('--hold');
const out=process.argv.includes('--out')?process.argv[process.argv.indexOf('--out')+1]:'docs/v1.5.1/qa/simulation';mkdirSync(out,{recursive:true});
const reports=[];
for(const route of hold?[{...ROUTES[0],id:'industrial-hold',click:1}]:[ROUTES[0],ROUTES[1],ROUTES[4]]){
 const features=[],lines=[],rushes=[];let purchaseIndex=0,receiptUntil=0,last='',lastRush=null;
 const result=simulate(route,{afterIncome(s,t,{purchases}){
  chooseOpening(s,'first');
  for(const row of purchases.slice(purchaseIndex)){
   recordNarrativeAction(s,'purchase',{id:row.id});receiptUntil=t+3.6;
  }
  purchaseIndex=purchases.length;
  // Main-world hold repeats every 200 ms: the simulator's one click plus four.
  if(hold&&canHoldMine(s))for(let k=0;k<4;k++)mine(s,()=>1);
  for(const id of ['info','goals'])if(!s.guidance[id]&&buyGuidance(s,id).ok){
   features.push({id,at:t});recordNarrativeAction(s,'purchase',{id:`feature:${id}`});receiptUntil=t+3.6;
  }
  if(s.counts.M5){connectAll(s);if(s.grid.learnedConnection)setAutoConnect(s,true);}
  const context={visible:id=>!!s.counts[id],workingVisible:()=>s.community.residents.some(r=>r.job!=='idle'&&!r.reserve),
   musicPlaying:()=>false,realm:()=>s.realm,railRunning:()=>!!s.counts.M16,
   surface:()=> 'world'};
  advanceNarrative(s,1,{available:t>=receiptUntil,context});
  const c=currentNarration(s),key=c?`${c.id}:${c.index}`:'';
  if(c&&key!==last&&t>=receiptUntil)lines.push({at:t,id:c.id,index:c.index,text:c.text});
  last=t>=receiptUntil?key:'';
  if(s.narrative.behavior.rushAt!==lastRush){lastRush=s.narrative.behavior.rushAt;rushes.push({at:t,reason:s.narrative.behavior.rushReason});}
 }});
 const first=result.purchases.filter((r,i,rows)=>rows.findIndex(v=>v.id===r.id)===i).map(({id,at})=>({id,at}));
 const report={route:route.id,features,first,rushes,lines,heard:result.state.narrative.history};
 reports.push(report);writeFileSync(`${out}/${route.id}.json`,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({route:route.id,lines:lines.length,heard:report.heard.map(r=>r.id),rushes}));
}
writeFileSync(`${out}/summary.json`,JSON.stringify({method:`Deterministic foreground investment policies for the requested --max-seconds, actual purchases and income, no injected money. ${hold?'Continuous 5-action/s hold, without placement/reading delays. ':''}3.6s receipts modeled. Presentation assumes a visible world and assigned workers; music off. Machine-idle visibility is not modeled. It is not a browser or human-play test. Automatic policy connects immediately, so power-use correctly skips once connected.`,reports},null,2)+'\n');
