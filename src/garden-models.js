import {communityModel} from './community-models.js';
import {SOUVENIR_BY_ID} from './community-souvenirs-data.js';
// Accepted V1.6 garden workyard, plus original voxel scenery.
import * as T from 'three';
import {blockBox,cube,group,mat} from './models.js';
import {terrainPalette,TERRAIN_MOTTLE} from './terrain-data.js';
const B=(p,kind,c,x,y,z,w,h,d)=>['dirt','grass'].includes(kind)?cube(p,c,x,y,z,w,h,d):blockBox(p,kind,c,x,y,z,w,h,d);
const frame='#6d6149';
const glassMaterial=new T.MeshStandardMaterial({color:'#bed4c6',transparent:true,opacity:.19,depthWrite:false,roughness:.7});
function footing(g,w,d){B(g,'cobblestone','#989e88',0,.055,0,w,.11,d);}
function mono(g,x,z,w,d,y,rise,c,n=5){
 for(let i=0;i<n;i++)B(g,'wood',c,x,y+i*rise/n,z+d/2-(i+.5)*d/n,w,.075,d/n);
}
function lantern(g,x,y,z,night){
 B(g,'iron','#5c6658',x,y+.055,z,.12,.14,.1);
 const m=cube(g,night?'#ffd27e':'#b3a171',x,y+.05,z+.055,.076,.088,.016);m.material=mat(night?'#ffd27e':'#b3a171',night?1:0);m.userData.windowGlow=true;
}
function beam(g,x,y,z,w,h,d,c=frame){return B(g,'log',c,x,y,z,w,h,d);}
function glass(g,x,y,z,w,h,d){
 const m=cube(g,'#bed4c6',x,y,z,w,h,d);m.material=glassMaterial;return m;
}
function pot(g,x,y,z,c='#839565',height=.23){
 B(g,'stone','#ab8264',x,y+.10,z,.19,.20,.19);cube(g,'#526745',x,y+.22,z,.028,.18,.028);
 cube(g,c,x,y+.25+height*.4,z,.20,height,.19);cube(g,c,x+.075,y+.30+height*.5,z,.09,height*.6,.1);
}
export function gardenModel(level=1,night=false){
 const g=new T.Group();g.name='garden-'+level;
 // Workyard is 2 × 2: bench, clearance and planting beds are present from level one.
 footing(g,1.83,1.83);
 B(g,'dirt','#a3a485',.45,.118,.48,.61,.025,.55);
 for(let i=0;i<3;i++)cube(g,'#77985b',.26+i*.18,.17,.49,.075,.075,.28);
 // Tool rack and short lean-to; unlike a residential house this stays mostly open.
 for(const x of [-.76,-.06])beam(g,x,.6,-.64,.07,.94,.07);
 B(g,'wood','#9c845b',-.41,.53,-.67,.75,.65,.065);
 mono(g,-.42,-.48,.96,.64,1.02,.12,'#8a9470',4);
 for(let i=0;i<3;i++){
 const x=-.64+i*.22;beam(g,x,.55,-.601,.024,.56,.03);B(g,'iron','#849180',x,.81,-.56,i===1?.15:.09,.10,.035);
 }
 B(g,'wood','#af9262',-.41,.51,.02,.89,.07,.37);
 for(const x of [-.76,-.08])beam(g,x,.31,.02,.05,.38,.28);
 for(let i=0;i<3;i++)pot(g,-.67+i*.25,.55,.02,['#819c5d','#b29baf','#a4b56e'][i],.16);
 B(g,'wood','#8c7151',-.61,.23,.62,.32,.22,.30);beam(g,-.26,.26,.67,.15,.25,.24);
 if(level>=2){
  // A tall, narrow nursery with a pitched glass roof. The workbench remains outside.
  const x=.44,z=-.38,w=.72,d=.90,b=.16,h=1.08;
  B(g,'stone','#899a86',x,.18,z,w+.09,.17,d+.08);
  for(const a of [-1,1])for(const s of [-1,1])beam(g,x+a*w/2,b+h/2,z+s*d/2,.04,h,.04,'#6b8a74');
  glass(g,x,b+h/2,z-d/2,w,h,.012);glass(g,x,b+h/2,z+d/2,w,h,.012);
  for(const a of [-1,1])glass(g,x+a*w/2,b+h/2,z,.012,h,d);
  for(let i=0;i<6;i++){
   const yy=b+h+i*.055,ww=w-i*(w-.09)/6;
   for(const s of [-1,1]){beam(g,x+s*ww/2,yy,z,.028,.065,d+.05,'#6b8a74');glass(g,x+s*ww/2,yy,z,.036,.055,d);}
  }
  for(const zz of [z-d/2,z+d/2])beam(g,x,b+h/2,zz,.035,h,.04,'#6b8a74');
  beam(g,x,b+h+.34,z,.07,.05,d+.08,'#627e65');
  for(const a of [-1,1])pot(g,x+a*.16,.28,z,['#739461','#9cb881'][a<0?0:1],.41);
  lantern(g,-.06,.81,-.55,night);
 }
 if(level>=3){
  // Specimen pergola reaches over the forecourt and hanging plants change the roofline.
  for(const x of [-.73,.77])beam(g,x,.83,.76,.065,1.47,.065,'#667f62');
  beam(g,.02,1.58,.76,1.69,.08,.075,'#667f62');
  for(let i=0;i<6;i++)beam(g,-.72+i*.3,1.62,.40,.05,.06,.92,'#839563');
  for(const [x,z,length]of [[-.68,.71,4],[.73,.67,3],[.13,.05,2]])for(let j=0;j<length;j++){
   cube(g,j%2?'#748e60':'#8ea576',x+(j%2)*.04+.008,1.565-j*.105,z,.13,.10,.13);
   if(j%2)cube(g,'#b6a0b9',x+.065,1.56-j*.105,z+.04,.065,.075,.065);
  }
  for(const x of [-.42,.43]){beam(g,x,1.45,.74,.025,.29,.025);pot(g,x,1.03,.74,'#78945e',.17);}
  // Distinct odd specimens: stepped violet crystal and glowing square-capped fungus.
  const specimen=group(g,.46,.1,.49);B(specimen,'stone','#718774',0,.09,0,.48,.18,.40);
  cube(specimen,'#8d79a9',-.13,.36,0,.12,.36,.12);cube(specimen,'#c0a5c9',-.09,.55,.015,.08,.11,.08);
  cube(specimen,'#758879',.12,.29,.02,.044,.23,.044);const cap=cube(specimen,'#bdc992',.12,.43,.02,.22,.08,.21);cap.material=mat('#bdc992',night?.6:0);cap.userData.windowGlow=true;
  lantern(g,-.70,1.31,.80,night);
 }
 return g;
}

export function natureModel(type){
 if(SOUVENIR_BY_ID[type])return communityModel(type);
 const g=new T.Group();g.name='garden-'+type;
 const leaf=(x,y,z,w,h,d,c='#819a5a',surface='leaves')=>B(g,surface,c,x,y+h/2,z,w,h,d);
 const trunk=(x,y,z,w,h,c='#8c714e')=>B(g,'log',c,x,y+h/2,z,w,h,w);
 const flower=(x,z,c,h=.26)=>{leaf(x,0,z,.025,h,.025,'#698750');leaf(x,h,z,.085,.05,.085,c,'petals');leaf(x,h+.05,z,.026,.022,.026,'#d6b552','petals');leaf(x+.04,h*.4,z,.09,.03,.035,'#819a5c');};
 if(['turf','earth','gravel','flagstone','mossground','boardwalk','pond'].includes(type)){
  const colors={turf:'#829d62',earth:'#a58a61',gravel:'#9c9d8c',flagstone:'#808879',mossground:'#697d50',boardwalk:'#967750',pond:'#689d98'};
  const surface=type==='turf'||type==='mossground'?'leaves':type==='boardwalk'?'wood':type==='pond'?'petals':'rock';
  B(g,surface,colors[type],0,.022,0,1,.012,1);
  if(type==='gravel')for(let i=0;i<16;i++){const x=(i%4-1.5)*.24,z=(Math.floor(i/4)-1.5)*.24;B(g,'rock',i%2?'#b5b8a4':'#92968b',x,.031,z,.085+(i%3)*.025,.009,.075);}
  if(type==='flagstone')for(let row=0;row<3;row++)for(let col=0;col<2;col++)B(g,'rock',row%2?'#b0b5a2':'#a2ac9b',(col-.5)*.49,.035,(row-1)*.325,.45,.021,.28);
  if(type==='boardwalk')for(let j=0;j<5;j++){B(g,'wood',j%2?'#b49a6d':'#a48a5c',0,.034,(j-2)*.197,.98,.018,.18);for(const x of [-.36,.36])cube(g,'#677366',x,.045,(j-2)*.197,.026,.004,.026);}
  if(type==='mossground')for(let j=0;j<7;j++)leaf((j%3-1)*.26,.029,(Math.floor(j/3)-1)*.28,.21,.009,.22,j%2?'#8da66a':'#788f5b');
  if(type==='pond'){for(let j=0;j<4;j++)cube(g,'#92b6a7',-.3+j*.19,.031,j%2?.20:-.24,.13,.007,.025);for(const [x,z]of [[-.27,.26],[.16,.04]]){leaf(x,.033,z,.18,.012,.14,'#87a061');cube(g,'#c5b69c',x-.025,.046,z,.035,.015,.035);}}
 }
 if(type==='lotus'){
  cube(g,'#81ada1',0,.024,0,.98,.025,.98);
  for(const [x,z,w]of [[-.27,.22,.27],[.22,-.18,.32],[.19,.27,.21],[-.20,-.2,.19]]){leaf(x,.043,z,w,.018,w*.76,'#75945b');leaf(x+w*.3,.062,z,.035,.006,w*.32,'#aac28a');}
  for(const [x,z,h]of [[-.25,.18,.16],[.21,-.18,.25]]){leaf(x,.06,z,.025,h,.025,'#6c8855');for(const [dx,dz,y]of [[-.06,0,0],[.06,0,0],[0,.055,.015],[0,-.055,.015]])leaf(x+dx,.09+h+y,z+dz,.085,.06,.08,'#d4a6b3','petals');leaf(x,.14+h,z,.045,.035,.04,'#e4c177','petals');}
 }
 if(type==='fallenlog'){
  B(g,'log','#8e7654',0,.13,0,.82,.24,.27);
  for(const x of [-.416,.416]){B(g,'wood','#c3a275',x,.13,0,.012,.19,.22);cube(g,'#8e7352',x*1.016,.13,0,.008,.09,.12);}
  for(const [x,z,w]of [[-.21,-.02,.23],[.04,.04,.2],[.24,-.07,.12]])leaf(x,.245,z,w,.035,.15,'#7d965d');
  for(const [x,z,h]of [[-.25,.18,.15],[.25,.17,.21]]){leaf(x,0,z,.027,h,.027,'#c5b291');leaf(x,h,z,.12,.04,.1,'#b6937a','rock');}
 }
 if(type==='hydrangea'){
  leaf(0,.02,0,.40,.14,.37,'#688a65');
  for(const [x,z,h,c]of [[-.10,-.08,.20,'#a59fbe'],[.11,-.04,.29,'#91a5c2'],[.01,.12,.19,'#b8abc8']]){
   leaf(x,.05,z,.035,h,.035,'#63805c');
   for(const [dx,dz,dy]of [[0,0,0],[-.065,0,-.025],[.065,0,-.018],[0,.062,-.015],[0,-.062,-.01]]){leaf(x+dx,h+dy,z+dz,.1,.08,.1,c,'petals');leaf(x+dx+.02,h+dy+.081,z+dz,.035,.006,.034,'#dbd5dc','petals');}
  }
 }
 if(type==='fern'){
  for(let j=0;j<3;j++){const z=(j-1)*.115;leaf(0,0,z,.025,.26-j*.04,.025,'#56774e');for(let k=0;k<3;k++)for(const side of [-1,1])leaf(side*(.045+k*.038),.16-k*.04,z+.015*k,.095-k*.016,.026,.055,'#7d9c62');}
 }
 if(type==='poppy')for(const [x,z,h]of [[-.12,-.08,.30],[.11,.11,.22]]){
  leaf(x,0,z,.025,h,.025,'#6f8d57');leaf(x,h,z,.09,.055,.09,'#c47463','petals');
  for(const side of [-1,1]){leaf(x+side*.0665,h,z,.043,.055,.09,'#c47463','petals');leaf(x,h,z+side*.0665,.09,.055,.043,'#c47463','petals');}
  leaf(x,h+.042,z,.045,.035,.045,'#604f48','petals');
 }
 if(type==='bluebells')for(const [x,z,h]of [[-.10,-.1,.38],[.13,.12,.26]]){leaf(x,0,z,.025,h,.025,'#74915f');for(let j=0;j<3;j++){const xx=x+(j%2?.052:-.052),y=h-j*.075;leaf(xx,y,z,.085,.058,.072,j%2?'#9dabc3':'#869cb5','petals');leaf(xx,y-.018,z,.056,.025,.055,'#c0c5cf','petals');}}
 if(type==='reeds')for(let j=0;j<4;j++){const x=(j%2-.5)*.2,z=(Math.floor(j/2)-.5)*.19,h=.40+j*.065;leaf(x,0,z,.028,h,.025,'#819159');leaf(x,h,z,.054,.13,.043,'#967654','rock');leaf(x+.047,.05,z,.022,h*.7,.032,'#95a668');}
 if(type==='bamboo')for(const [x,z,h]of [[-.22,0,1.10],[.17,.14,.86],[.05,-.2,1.27]]){
  for(let j=0;j<Math.ceil(h/.22);j++){const y=j*.22;B(g,'leaves',j%2?'#8b9d63':'#98a970',x,y+.111,z,.065,.21,.065);B(g,'rock','#66784d',x,y+.011,z,.075,.022,.075);}
  for(const side of [-1,1]){leaf(x+side*.09,h*.78,z,.15,.035,.04,'#739253');leaf(x+side*.17,h*.79,z-.028,.10,.025,.07,'#91ac68');}
 }
 if(type==='grass')for(let i=0;i<7;i++){const x=(i%3-1)*.12,z=(Math.floor(i/3)-1)*.11;leaf(x,0,z,.035,.13+(i%3)*.055,.035,i%2?'#8fa56b':'#789354');}
 if(type==='wildflowers'){for(const [x,z,c,h]of [[-.13,-.1,'#eee3bc',.23],[.09,.1,'#f0e8ce',.30],[.13,-.14,'#d6b65a',.19],[-.10,.14,'#e5d9bc',.18]])flower(x,z,c,h);}
 if(type==='shrub'){leaf(0,.03,0,.38,.18,.34);leaf(-.08,.20,-.03,.24,.13,.24,'#92a968');leaf(.13,.09,.1,.19,.15,.19,'#708c55');}
 if(['stones','mossrock'].includes(type)){
 B(g,'rock','#8f9787',-.055,.11,-.02,.31,.22,.29);B(g,'rock','#abb09b',.12,.065,.10,.18,.13,.18);B(g,'rock','#939f92',-.14,.045,.15,.11,.09,.13);
 if(type==='mossrock'){leaf(-.07,.222,-.05,.27,.025,.22,'#7e965f');leaf(-.17,.14,-.04,.06,.1,.17,'#91a36b');flower(.17,-.13,'#d1d3a9',.20);}
 }
 if(['oak','birch','spruce','blossom'].includes(type)){
 const birch=type==='birch',spruce=type==='spruce',blossom=type==='blossom';
 trunk(0,0,0,birch?.11:.16,birch?1.02:.66,birch?'#dcd7bd':'#8a6a43');
 if(birch)for(let i=0;i<4;i++)leaf(i%2?.053:-.054,.11+i*.23,.005,.014,.025,.085,'#645e4b');
 if(spruce){for(let i=0;i<4;i++)leaf(0,.42+i*.23,0,.86-i*.18,.24,.82-i*.17,i%2?'#68806b':'#526e5b');leaf(0,1.33,0,.11,.16,.11,'#759077');}
 else if(birch){leaf(-.06,.74,0,.50,.38,.48,'#9cae70');leaf(.09,1.00,.04,.39,.35,.43,'#adc285');leaf(-.08,1.23,-.08,.27,.23,.32,'#b4c78c');}
 else{
 const c=blossom?'#cfa2a7':birch?'#a2b975':'#7f9c5c',top=blossom?'#deb8b4':birch?'#b2c384':'#95ac6b',y=birch?.9:.52;
 const surface=blossom?'petals':'leaves';leaf(-.09,y,0,.64,.28,.70,c,surface);leaf(.15,y+.15,.10,.48,.30,.46,top,surface);leaf(-.2,y+.27,-.05,.37,.24,.40,c,surface);leaf(-.13,y+.46,-.12,.41,.16,.39,top,surface);
 if(blossom){trunk(.23,.39,.04,.065,.31);for(let i=0;i<4;i++)leaf(-.29+i*.17,.012,.22,.075,.012,.07,'#d9aaa6');}
 }
 }
 if(type==='hedge'){leaf(0,.06,0,.84,.34,.31);leaf(0,.40,0,.76,.06,.27,'#99ad77');trunk(-.31,0,0,.05,.12);trunk(.31,0,0,.05,.12);}
 if(type==='vine'){
 for(const x of [-.38,.38])trunk(x,0,0,.055,.88);B(g,'wood','#887450',0,.88,0,.90,.07,.14);
 for(let i=0;i<5;i++)for(let j=0;j<3+i%3;j++)leaf(-.31+i*.15,.79-j*.115,.05,.095,.108,.12,j%2?'#73945c':'#91a970');
 }
 if(['glowcap','crimson'].includes(type)){
 const red=type==='crimson';
 for(const [x,z,h,k]of red?[[-.16,0,.52,1],[.23,.16,.31,.65]]:[[0,0,.22,.5]]){
 trunk(x,0,z,.09*k,h,red?'#947779':'#a7b09a');leaf(x,h,z,.55*k,.11*k,.49*k,red?'#a26364':'#bdcda2','petals');const cap=leaf(x,h+.11*k,z,.36*k,.09*k,.34*k,red?'#b37a73':'#d6dfa6','petals');if(!red)cap.material=mat('#c7d59f',.35);
 }
 }
 if(type==='amethyst'){
 B(g,'rock','#828d83',0,.05,0,.43,.10,.39);
 for(const [x,z,h]of [[-.11,.02,.47],[.09,-.09,.33],[.12,.14,.21]]){leaf(x,.1,z,.10,h,.10,'#a08ab7');leaf(x,.1+h,z,.065,.08,.065,'#c3add2');}
 }
 if(type==='chorus'){
 B(g,'rock','#bbb99b',0,.05,0,.60,.1,.51);
 trunk(0,.1,0,.115,.77,'#837087');for(const [x,z,h]of [[-.23,0,.48],[.22,.13,.66]]){B(g,'purpur','#947c98',x/2,h, z/2,Math.abs(x)+.13,.1,.12);trunk(x,h,z,.10,.27,'#927d97');leaf(x,h+.27,z,.19,.17,.18,'#bdacba');}leaf(0,.89,0,.20,.16,.20,'#b0a0b6');
 }
 return g;
}
export function naturePreview(type,rotation=0){
 const root=natureModel(type);root.position.y=.18;root.rotation.y=rotation*Math.PI/2;
 const clones=new Map();root.traverse(o=>{if(!o.isMesh)return;let m=clones.get(o.material);if(!m){m=o.material.clone();m.transparent=true;m.opacity=.48;m.depthWrite=false;m.userData.original=m.color.clone();clones.set(o.material,m);}o.material=m;o.castShadow=false;});
 return {root,setValid(valid){for(const m of clones.values())m.color.copy(m.userData.original).lerp(new T.Color('#be6b58'),valid?0:.65);},dispose(){root.removeFromParent();for(const m of clones.values())m.dispose();}};
}
export function terrainPreview(type,brush=1){
 const theme={top:'#8faf70',rock:'#6f8f5a',edge:'#5a6e4a'};
 const palette=type===TERRAIN_MOTTLE
  ?{ground:theme.top,y:0.12}
  :(terrainPalette(type,theme)||{ground:theme.top,y:0.12});
 const root=new T.Group(),clones=new Map(),n=Math.max(1,Math.min(3,brush|0));
 const cells=n===1?[[0,0]]:n===2?[[-.5,-.5],[.5,-.5],[-.5,.5],[.5,.5]]:[[-1,-1],[0,-1],[1,-1],[-1,0],[0,0],[1,0],[-1,1],[0,1],[1,1]];
 for(const [x,z] of cells){
  const tile=cube(root,palette.ground,x,palette.y??0.12,z,.92,.08,.92);
  tile.material=tile.material.clone();tile.material.transparent=true;tile.material.opacity=.55;tile.material.depthWrite=false;
  tile.material.userData.original=tile.material.color.clone();clones.set(tile,tile.material);
 }
 return {root,setValid(valid){for(const m of clones.values())m.color.copy(m.userData.original).lerp(new T.Color('#be6b58'),valid?0:.65);},dispose(){root.removeFromParent();for(const m of clones.values())m.dispose();}};
}
