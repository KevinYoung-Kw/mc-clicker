import * as T from 'three';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fresh} from '../src/game.js';
import {CATALOG,ITEMS} from '../src/catalog.js';
import {UPGRADE_CATALOG} from '../src/upgrades.js';
import {makeObject} from '../src/objects.js';
import {footprint,MODEL_INSET} from '../src/layout.js';
const cases=[];
for(const id of ['M4','M5','M7','M15']) for(const variant of ['base','upgraded','maximum']){
 const s=fresh(0);s.counts=Object.fromEntries(CATALOG.map(i=>[i.id,1]));
 if(id==='M5'&&variant==='base')for(const module of ['M10','M11','M12'])s.counts[module]=0;
 s.counts[id]=variant==='maximum'?ITEMS[id].max:1;
 if(variant!=='base')for(const row of UPGRADE_CATALOG.filter(row=>row.owner===id))s.upgrades.levels[row.id]=row.maxLevel;
 const root=new T.Group(),animations=[];makeObject(root,ITEMS[id],s,animations);
 root.updateMatrixWorld(true);const original=new T.Box3().setFromObject(root),size=original.getSize(new T.Vector3()),f=footprint(id);
 const fit=Math.min((f.w-MODEL_INSET*2)/size.x,(f.d-MODEL_INSET*2)/size.z)*Math.min(1,.9+(s.counts[id]-1)*.012);
 root.scale.setScalar(fit);root.updateMatrixWorld(true);root.position.y=.16-new T.Box3().setFromObject(root).min.y;
 let meshes=0;root.traverse(o=>{if(o.isMesh)meshes++});
 const maximum={width:0,depth:0,minY:Infinity};
 for(let t=0;t<=32;t+=.25){animations.forEach(fn=>fn(t));root.updateMatrixWorld(true);const b=new T.Box3().setFromObject(root),v=b.getSize(new T.Vector3());maximum.width=Math.max(maximum.width,v.x);maximum.depth=Math.max(maximum.depth,v.z);maximum.minY=Math.min(maximum.minY,b.min.y);}
 const passed=maximum.width<=f.w+.01&&maximum.depth<=f.d+.01&&Math.abs(maximum.minY-.16)<.01;
 cases.push({id,variant,level:s.counts[id],footprint:f,fit,preBatchMeshes:meshes,maximum,passed});
}
const out='docs/v1.4/qa';mkdirSync(out,{recursive:true});
writeFileSync(`${out}/model-bounds.json`,JSON.stringify({method:'Four changed facilities, base/upgraded/maximum variants, actual world fitting and grounding, 129 animation samples over 32s per variant. Meshes before batching are not GPU draw calls.',cases},null,2)+'\n');
console.log(JSON.stringify({cases:cases.length,failures:cases.filter(c=>!c.passed)}));
if(cases.some(c=>!c.passed))process.exitCode=1;
