// Freeze NEW explicit candidate configurations. Historical bundles are replayed, never regenerated from mutable overlays.
import {build} from 'esbuild';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {relative,resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),dir=resolve(root,'docs/v2.0.0/simulation');
const name=process.argv[2],configPath=process.argv[process.argv.indexOf('--config')+1];
if(!name||!/^[a-z][a-z0-9-]+$/.test(name)||!process.argv.includes('--config')||!configPath)throw Error('Usage: node scripts/balance-v2-calibrate.mjs NEW-NAME --config candidate.json');
const config=JSON.parse(readFileSync(resolve(configPath),'utf8'));
for(const key of ['research','prices'])if(!config[key]||typeof config[key]!=='object')throw Error('Missing config '+key);
{
 const target=resolve(dir,`${name}.mjs`);if(existsSync(target))throw Error('Refusing to overwrite '+target);
 const inputs={},applied={};
 const namespaces=['game','catalog','residents','housing','housing-data','power','guidance','mail','upgrades','development','villager-life','research'];
 const source=namespaces.map(id=>`export * as ${id.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())} from './src/${id}.js';`).join('\n');
 const result=await build({stdin:{contents:source,resolveDir:root},bundle:true,platform:'node',format:'esm',target:'node20',write:false,plugins:[{name:'balance-config',setup(b){b.onResolve({filter:/^\.\/life-economy\.js$/},()=>({path:resolve(root,'spikes/v2-economy-candidates/src/life-economy.js')}));b.onLoad({filter:/\.[cm]?js$/},({path})=>{
  const raw=readFileSync(path,'utf8'),key=relative(root,path),overlay=resolve(root,'spikes/v2-economy-candidates',key),candidate=existsSync(overlay)?readFileSync(overlay,'utf8'):raw,contents=path.endsWith('/life-economy.js')?`export const LIFE_ECONOMY=Object.freeze(${JSON.stringify(config)});`:candidate;
  const hash=s=>createHash('sha256').update(s).digest('hex');inputs[key]=hash(raw);applied[key]=hash(contents);return {contents,loader:'js'};
 });}}]});
 const code=result.outputFiles[0].text;writeFileSync(target,code);writeFileSync(resolve(dir,`${name}-manifest.json`),JSON.stringify({name,config,inputs,applied,sha256:createHash('sha256').update(code).digest('hex'),method:'Real runtime; recorded candidate source overlays and life-economy data; playable source untouched. No injected money, resources, jobs or time.'},null,2)+'\n');console.log(name);
}
