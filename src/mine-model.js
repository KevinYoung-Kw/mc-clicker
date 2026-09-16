import { storageCapacity } from './upgrades.js';
import { blockBox as b, cube, group, mat, P } from './models.js';
// A snapped stone face: cells share edges, never coplanar overlapping faces.
export function mineSite(parent, state, animations) {
 const root=group(parent);root.userData.facilityStyle='stepped-quarry';
 const part=(name,kind,color,x,y,z,w,h,d)=>{const m=b(root,kind,color,x,y,z,w,h,d);m.userData.facilityPart=name;return m;};
 part('quarry-floor','stone','#9ba294',0,.04,0,1.7,.08,1.56);
 const size=.4;
 for(let x=-1;x<=1;x++)for(let z=0;z<2;z++) {
   const height=z===0?3:Math.abs(x)?2:1;
   for(let y=0;y<height;y++) {
    const px=x*.42,pz=-.4+z*.42,py=.08+size/2+y*size;
    part('quarry-cell','cobblestone',(x+y+z)%2?'#818d83':'#9da697',px,py,pz,size,size,size);
    if(z===1&&y===height-1)for(let k=0;k<3;k++){
      const ore=cube(root,k===1?'#c5b38b':'#9b886d',px-.105+k*.1,py+(k%2?.035:-.05),pz+.206,.065,.065,.012);
      ore.userData.facilityPart='exposed-ore';
    }
   }
 }
 for(const x of [-.69,.69])part('pit-prop','log',P.wood,x,.69,-.19,.13,1.22,.14);
 part('pit-beam','log',P.wood,0,1.34,-.19,1.58,.15,.18);
 // A slatted sorting tray, separated from the rock face.
 part('sorting-tray','wood','#977054',.36,.16,.54,.64,.16,.27);
 for(let k=0;k<3;k++)part('sorted-stone','stone','#a9ac9a',.17+k*.19,.29,.54,.15,.1,.19);
 part('lantern-hook','iron','#455a50',-.72,1.15,.07,.045,.25,.06);
 part('lantern-frame','iron','#455a50',-.72,1.02,.07,.16,.2,.15);
 const flame=cube(root,'#e3b560',-.72,1.02,.153,.105,.125,.024);flame.material=mat('#e3b560',.18);flame.castShadow=false;
 const particles=[];
 for(let j=0;j<3;j++){
   const dust=cube(root,'#c7c1a4',-.12+j*.1,.6,.25,.025,.025,.025);
   dust.userData.facilityPart='quarry-dust';dust.userData.nonSolid=true;dust.castShadow=false;
   particles.push(dust);
 }
 animations.push(t=>{
   const full=(state.buffers?.overworld?.raw||0)>=storageCapacity(state,"overworld","raw");
   for(let j=0;j<particles.length;j++){
    const f=(t*.36+j*.18)%1, m=particles[j];
    m.visible=!state.reducedMotion&&!full&&f<.3;
    m.position.set(-.13+j*.105+f*.13,.67-f*.8,.28+f*.12);
   }
 });
 return root;
}
