// Capture exactly the playable source for release simulations; no candidate overlays.
import {build} from 'esbuild';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'..'),name=process.argv[2];
if(!/^[a-z][a-z0-9-]+$/.test(name||''))throw Error('Supply a new snapshot name');
const path=resolve(root,'docs/v2.0.0/simulation/'+name+'.mjs');if(existsSync(path))throw Error('Snapshot already exists');
const hash=s=>createHash('sha256').update(s).digest('hex'),inputs={};
const names={game:'game',catalog:'catalog',residents:'residents',housing:'housing',housingData:'housing-data',power:'power',guidance:'guidance',research:'research',upgrades:'upgrades',villagerLife:'villager-life',food:'food-service',lifeMenu:'life-menu',services:'service-economy',operations:'operations',quality:'work-quality',capacity:'facility-capacity'};
const result=await build({stdin:{contents:Object.entries(names).map(([n,p])=>`export * as ${n} from './src/${p}.js';`).join('\n'),resolveDir:root},bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'evidence',setup(b){b.onLoad({filter:/\.[cm]?js$/},({path})=>{const contents=readFileSync(path,'utf8');inputs[relative(root,path)]=hash(contents);return {contents,loader:'js'};});}}]});
const code=result.outputFiles[0].text;writeFileSync(path,code);writeFileSync(path.replace('.mjs','-manifest.json'),JSON.stringify({name,sha256:hash(code),inputs,method:'Unmodified playable runtime. R5 flow, R6 menu choices and village-wide recreation.'},null,2)+'\n');console.log(name);
