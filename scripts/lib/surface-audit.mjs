import * as T from 'three';
// Diagnostic only: coplanar, same-facing, exposed box faces. Opposite-facing
// shared edges and hidden internal joins are not rendering defects.
export function exposedCoplanarFaces(root) {
 root.updateMatrixWorld(true);const boxes=[];
 root.traverse(o=>{
  if(!o.isMesh||o.geometry.type!=='BoxGeometry'||o.material.transparent||!o.visible)return;
  const e=o.matrixWorld.elements;
  if([0,4,8].some(i=>[e[i],e[i+1],e[i+2]].filter(v=>Math.abs(v)>1e-7).length!==1))return;
  o.geometry.computeBoundingBox();const b=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
  boxes.push({b,name:o.userData.facilityPart||o.name||String(boxes.length),color:o.material.color.getHexString(),map:!!o.material.map});
 });
 const hits=[],axes=['x','y','z'],eps=1e-7;
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
  const a=boxes[i],b=boxes[j];
  for(const axis of axes)for(const side of ['min','max']){
   if(Math.abs(a.b[side][axis]-b.b[side][axis])>eps)continue;
   const rest=axes.filter(k=>k!==axis),lo={},hi={};
   for(const k of rest){lo[k]=Math.max(a.b.min[k],b.b.min[k]);hi[k]=Math.min(a.b.max[k],b.b.max[k]);}
   const area=(hi[rest[0]]-lo[rest[0]])*(hi[rest[1]]-lo[rest[1]]);
   if(rest.some(k=>hi[k]-lo[k]<=eps)||area<.000004)continue;
   const p=new T.Vector3();p[axis]=a.b[side][axis]+(side==='max'?1:-1)*1e-5;for(const k of rest)p[k]=(lo[k]+hi[k])/2;
   if(boxes.some((other,k)=>k!==i&&k!==j&&axes.every(a=>p[a]>other.b.min[a]+eps&&p[a]<other.b.max[a]-eps)))continue;
   if(a.color===b.color&&!a.map&&!b.map)continue; // identical solid color has no competing pattern
   hits.push({parts:[a.name,b.name],colors:[a.color,b.color],axis,side,area:Number(area.toFixed(6)),point:p.toArray()});
  }
 }
 return hits;
}
