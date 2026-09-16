import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import {restore} from '../src/game.js';
import * as current from '../src/routing.js';
const root=new URL('../',import.meta.url),dir=new URL('docs/v1.8/qa/performance/',root);
const reference=fs.readFileSync(new URL('fixtures/routing-before.txt',dir),'utf8').replace(/from "(\.\/.+?)"/g,(_,p)=>`from "${new URL(p,new URL('src/routing.js',root))}"`).replace(/from '(\.\/.+?)'/g,(_,p)=>`from '${new URL(p,new URL('src/routing.js',root))}'`);
const previous=await import('data:text/javascript;base64,'+Buffer.from(reference).toString('base64'));
const results=[];
for(const name of ['crowd','complete']){
 const original=JSON.parse(fs.readFileSync(new URL(`fixtures/${name}-fixture.json`,dir)));
 const a=restore(original,0),b=restore(original,0),queriesPerRound=Object.keys(a.placements).length*400;
 const queries=(module,s)=>Object.keys(s.placements).map(id=>module.wireRoute(s,id));
 const compare=label=>{assert.deepEqual(queries(current,b),queries(previous,a),label);for(const realm of ['overworld','nether','end'])assert.deepEqual(current.transportTopology(b,realm),previous.transportTopology(a,realm),label);};
 compare('initial');
 const bench=(module,s)=>{queries(module,s);const t=performance.now();for(let j=0;j<400;j++)queries(module,s);return performance.now()-t;};
 const before=[],after=[];
 for(let j=0;j<5;j++){if(j%2){after.push(bench(current,b));before.push(bench(previous,a));}else{before.push(bench(previous,a));after.push(bench(current,b));}}
 for(const s of [a,b]){const id=Object.keys(s.placements).find(id=>id==='M9')||Object.keys(s.placements)[0];s.placements[id].x+=.5;s.placements[id].rotation=((s.placements[id].rotation||0)+1)%4;s.layoutRevision++;}
 compare('move and rotate');
 for(const s of [a,b]){delete s.placements.M4;s.layoutRevision++;s.counts.N1=0;}
 compare('storage and portal access');
 for(const s of [a,b]){s.chunks.overworld=s.chunks.overworld.slice(0,-1);s.layoutRevision++;}
 compare('remove land');
 results.push({fixture:name,queriesPerRound,beforeMs:before,afterMs:after,identicalPaths:true});
}
fs.writeFileSync(new URL('routing-report.json',dir),JSON.stringify(results,null,2));console.log(results);
