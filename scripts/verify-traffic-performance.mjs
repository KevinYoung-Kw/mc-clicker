import fs from 'node:fs';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {restore} from '../src/game.js';
const root=new URL('../',import.meta.url),out=new URL('docs/v1.8/qa/performance/',root);
async function load(text){
 text=text.replace(/from (["'])(\.\/.+?)\1/g,(_,q,p)=>`from '${new URL(p,new URL('src/operations.js',root))}'`);
 return import('data:text/javascript;base64,'+Buffer.from(text+'\nexport {trafficRoute};').toString('base64'));
}
const before=await load(fs.readFileSync(new URL('fixtures/operations-before.txt',out),'utf8'));
const after=await load(fs.readFileSync(new URL('src/operations.js',root),'utf8'));
const s=restore(JSON.parse(fs.readFileSync(new URL('fixtures/crowd-fixture.json',out))),0);
const nav=after.companionNavigation(s),grid=nav.grid(after.COMPANION_RADIUS);
const largest=grid.components.reduce((a,b)=>a.length>b.length?a:b),nodes=largest.map(i=>grid.nodes[i]);
const cases=Array.from({length:24},(_,i)=>({actor:nodes[(i*173)%nodes.length],end:nodes[(nodes.length-1-i*67+nodes.length)%nodes.length],others:Array.from({length:5},(_,j)=>nodes[(i*173+j*103+1)%nodes.length])}));
const times={before:[],after:[]};
for(let pass=0;pass<5;pass++){
 for(const [name,module]of pass%2?[['after',after],['before',before]]:[['before',before],['after',after]]){
  const start=performance.now();const paths=cases.map(c=>module.trafficRoute(nav,c.actor,c.end,c.others));times[name].push(performance.now()-start);
  if(name==='before')times.expected=paths;else if(times.expected)assert.deepEqual(paths,times.expected);
 }
}
// Also compare each path explicitly, independent of timing order.
for(const c of cases)assert.deepEqual(after.trafficRoute(nav,c.actor,c.end,c.others),before.trafficRoute(nav,c.actor,c.end,c.others));
const result={routesPerRound:cases.length,gridNodes:nodes.length,beforeMs:times.before,afterMs:times.after,identicalPaths:true};
fs.writeFileSync(new URL('traffic-report.json',out),JSON.stringify(result,null,2));console.log(result);
