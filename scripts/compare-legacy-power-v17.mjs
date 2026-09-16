import fs from 'node:fs';
import { restore } from '../src/game.js';
import { powerSnapshot } from '../src/power.js';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const baselineArg=process.argv.indexOf('--baseline'),baseline=baselineArg>=0?process.argv[baselineArg+1]:'/tmp/mc-v17-baseline';
const oldGame=await import(pathToFileURL(resolve(baseline,'src/game.js')));
const oldPower=await import(pathToFileURL(resolve(baseline,'src/power.js')));
const files=['dense-0','dense-150','peak'].map(name=>`docs/v1.6/qa/stability-baseline/fixtures/${name}.json`);
files.push('docs/v1.7/qa/balance-baseline/industrial-first-save.json','docs/v1.7/qa/balance-baseline/village-first-save.json');
const report=[];
for(const file of files){
 const raw=JSON.parse(fs.readFileSync(file)),before=oldGame.restore(raw,467000),after=restore(raw,467000),a=oldPower.powerSnapshot(before),b=powerSnapshot(after);
 const stopped=a.loads.filter(l=>l.actual>0&&!b.loads.some(next=>next.id===l.id&&next.actual>0)).map(l=>l.id);
 if(stopped.length||before.money!==after.money||JSON.stringify(before.counts)!==JSON.stringify(after.counts))throw Error(file+': incompatible migration '+stopped);
 report.push({file,moneyPreserved:true,countsPreserved:true,newlyStopped:stopped,before:{generation:a.supply,demand:a.demand,consumption:a.consumption},after:{generation:b.supply,demand:b.demand,consumption:b.consumption}});
}
fs.writeFileSync('docs/v1.7/qa/legacy-power.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
