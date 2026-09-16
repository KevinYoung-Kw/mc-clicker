import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):e.name.endsWith('.md')?[path.join(d,e.name)]:[]);
const files=[...walk(path.join(root,'docs')),...['README.md','DEPLOYMENT.md','CHANGELOG.md'].map(f=>path.join(root,f))];
const missing=[];let checked=0;
for(const file of files){
 const body=fs.readFileSync(file,'utf8').replace(/```[\s\S]*?```/g,'');
 for(const [,raw] of body.matchAll(/\]\(([^)\n]+)\)/g)){
  const href=raw.replace(/^<|>$/g,'').split(/[?#]/)[0];
  if(!href||/^[a-z][a-z0-9+.-]*:/i.test(href)||href.startsWith('/'))continue;
  if(/\s+['"]/.test(href))continue;
  checked++;
  if(!fs.existsSync(path.resolve(path.dirname(file),decodeURIComponent(href))))missing.push({file:path.relative(root,file),target:href});
 }
}
console.log(JSON.stringify({markdownFiles:files.length,localLinks:checked,missing},null,2));
if(missing.length)process.exitCode=1;
