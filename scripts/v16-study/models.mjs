// Isolated, second-round art study. No gameplay, prices, housing or save rules change.
import * as T from 'three';
import {blockBox,cube,group} from '../../src/models.js';
export const HOMES=[
 {id:'oak',name:'橡木尖顶屋',w:1.5,d:1.5,beds:1,tier:1,idea:'陡峭山墙 · 阁楼小窗 · 偏置入口'},
 {id:'hearth',name:'石炉矮屋',w:1.5,d:1.5,beds:1,tier:1,idea:'低矮石墙 · 单坡屋面 · 外置壁炉'},
 {id:'porch',name:'转角花庭屋',w:2,d:1.5,beds:1,tier:2,idea:'L 形屋身 · 开敞花庭 · 木架遮棚'},
 {id:'moss',name:'覆土林间屋',w:2,d:1.5,beds:1,tier:2,idea:'厚覆土屋顶 · 低窗 · 下沉式门廊'},
 {id:'duplex',name:'错层双子屋',w:2.5,d:1.5,beds:2,tier:2,idea:'高低错层 · 双向屋脊 · 两个门牌'},
 {id:'tower',name:'悬阁石木塔',w:2,d:1.5,beds:3,tier:3,idea:'收分石塔 · 悬挑木阁 · 侧廊外梯'},
 {id:'corner',name:'退台公寓',w:2.5,d:2,beds:4,tier:3,idea:'阶梯体块 · 屋顶露台 · 外侧楼梯'},
 {id:'gallery',name:'围院长屋',w:3,d:2,beds:4,tier:3,idea:'双翼围院 · 连桥回廊 · 共用庭院'},
];
const B=(p,kind,c,x,y,z,w,h,d)=>['dirt','grass'].includes(kind)?cube(p,c,x,y,z,w,h,d):blockBox(p,kind,c,x,y,z,w,h,d);
const wood='#876749',stone='#959b86',frame='#6d6149',plaster='#d6c5a3';
function footing(g,w,d){B(g,'cobblestone','#989e88',0,.055,0,w,.11,d);}
function volume(g,x,z,w,d,bottom,height,c=plaster,kind='wood'){
 B(g,kind,c,x,bottom+height/2,z,w,height,d);
}
function timber(g,x,z,w,d,y,h,c=wood){
 for(const a of [-1,1])for(const b of [-1,1]) B(g,'log',c,x+a*(w-.07)/2,y+h/2,z+b*(d-.07)/2,.075,h,.075);
 B(g,'log',c,x,y+.055,z,w+.02,.09,d+.02);B(g,'log',c,x,y+h-.045,z,w+.035,.085,d+.035);
}
// Front-facing stepped gable. Its steepness and ridge direction are chosen per house.
function gable(g,x,z,w,d,y,rise,c,axis='x',n=8){
 const r=group(g,x,y,z);if(axis==='z')r.rotation.y=Math.PI/2;
 const step=(w-.10)/n;
 for(let i=0;i<n;i++){
  const width=w-step*i;
  // Roof tiles form a shell; pale gable infill keeps the roof from reading as a solid pyramid.
  for(const s of [-1,1])B(r,'wood',c,s*(width/2-step/4),i*rise/n,0,step/2+.032,rise/n+.012,d);
  for(const s of [-1,1]) B(r,'wood',plaster,0,i*rise/n-.014,s*(d/2-.12),Math.max(.065,width-.16),rise/n+.018,.055);
 }
 B(r,'wood',c,0,rise,0,.16,.055,d+.015);
}
function mono(g,x,z,w,d,y,rise,c,n=5){
 for(let i=0;i<n;i++)B(g,'wood',c,x,y+i*rise/n,z+d/2-(i+.5)*d/n,w,.075,d/n+.015);
}
function pane(g,x,y,z,{turn=0,w=.26,h=.28,night=false,shutters=false,cross=true}={}){
 const r=group(g,x,y,z);r.rotation.y=turn;
 B(r,'wood',frame,0,0,0,w+.07,h+.07,.05);
 const m=cube(r,night?'#ffcb79':'#739f9b',0,0,.031,w,h,.018);
 m.material=m.material.clone();m.material.emissive.set('#ffb955');m.material.emissiveIntensity=night?.85:0;m.userData.studyWindow=true;
 if(cross){B(r,'wood','#cbb990',0,0,.05,.026,h,.025);B(r,'wood','#cbb990',0,0,.05,w,.026,.025);}
 if(shutters)for(const s of [-1,1])B(r,'wood','#617663',s*(w/2+.095),0,.015,.10,h+.035,.055);
}
function lantern(g,x,y,z,night){
 B(g,'iron','#5c6658',x,y+.055,z,.12,.14,.1);
 const m=cube(g,night?'#ffd27e':'#b3a171',x,y+.05,z+.055,.076,.088,.016);m.material=m.material.clone();m.material.emissive.set('#ffc978');m.material.emissiveIntensity=night?1:0;m.userData.studyWindow=true;
}
function door(g,x,z,y=0,night=false,{h=.65,w=.28,number=1}={}){
 B(g,'log',frame,x,y+h/2+.1,z,w+.08,h+.08,.07);
 B(g,'wood','#a17a4e',x,y+h/2+.1,z+.045,w,h,.03);
 cube(g,'#d4b36d',x+w*.28,y+.36,z+.068,.024,.034,.018);
 B(g,'stone','#9da38d',x,y+.055,z+.075,w+.15,.09,.2);
 // Separate address plaque; no two competing entrances on a single residence.
 B(g,'wood','#e0d0ac',x+w/2+.1,y+.52,z+.025,.10,.105,.035);
 for(let i=0;i<Math.min(4,number);i++)cube(g,'#6d6a55',x+w/2+.067+i*.021,y+.52,z+.05,.012,.046,.012);
 lantern(g,x-w/2-.10,y+h+.15,z+.05,night);
}
function flowers(g,x,y,z,w=.32,c='#d1a889'){
 B(g,'wood','#8b6b48',x,y+.09,z,w,.18,.2);
 B(g,'dirt','#695b41',x,y+.185,z,w-.035,.02,.15);
 for(let i=0;i<3;i++){
 const a=x+(i-1)*w*.28;cube(g,'#718552',a,y+.27,z,.035,.18,.035);cube(g,c,a,y+.36+(i%2)*.035,z,.075,.07,.075);
 }
}
function rail(g,x,y,z,w,along='x'){
 const r=group(g,x,y,z);if(along==='z')r.rotation.y=Math.PI/2;
 B(r,'wood',frame,0,.29,0,w,.045,.05);
 const n=Math.max(2,Math.ceil(w/.18));for(let i=0;i<=n;i++)B(r,'wood',frame,-w/2+i*w/n,.16,0,.035,.29,.035);
}
function stairs(g,x,z,y,w,run,rise,n=6){
 for(let i=0;i<n;i++)B(g,'cobblestone',stone,x,y+(i+1)*rise/n/2,z-(i+.5)*run/n,w,(i+1)*rise/n,run/n+.01);
}
function beam(g,x,y,z,w,h,d,c=frame){return B(g,'log',c,x,y,z,w,h,d);}
function turf(g,x,y,z,w,d){
 B(g,'dirt','#807356',x,y-.065,z,w,.15,d);B(g,'grass','#80935f',x,y+.015,z,w+.02,.06,d+.02);
}
function houseOak(g,night){
 footing(g,1.25,1.17);volume(g,0,-.08,1.0,.91,.11,.78);timber(g,0,-.08,1,.91,.1,.86);
 // A narrow, tall gable reads from the normal game camera, not only in close-up.
 gable(g,0,-.09,1.38,1.16,.94,.91,'#ad834b','x',10);
 volume(g,0,.383,.64,.045,.94,.29,'#d9caa7');pane(g,0,1.09,.414,{night,w:.19,h:.20,cross:false});
 beam(g,0,.90,.425,1.01,.075,.075);
 door(g,-.18,.39,0,night);pane(g,.30,.65,.40,{night,w:.19,h:.26,shutters:false});
 pane(g,.508,.65,-.17,{night,turn:Math.PI/2,w:.30,h:.31});flowers(g,.42,.1,.58,.26);
}
function houseHearth(g,night){
 footing(g,1.32,1.2);volume(g,-.10,-.075,1.0,.94,.11,.62,'#9d9f8b','cobblestone');
 B(g,'stone','#bdbaa1',-.1,.72,-.075,1.04,.12,.97);mono(g,-.07,-.11,1.23,1.14,.82,.22,'#736e55',5);
 // Hearth built outside the wall, with a chimney that becomes its main silhouette.
 volume(g,.48,-.18,.30,.53,.12,.78,'#858773','cobblestone');volume(g,.48,-.25,.21,.29,.9,.46,'#989b88','cobblestone');
 B(g,'stone','#626c5e',.48,1.40,-.25,.31,.09,.36);cube(g,'#465445',.48,1.448,-.25,.16,.009,.20);
 door(g,-.28,.405,0,night,{h:.52,w:.25});pane(g,.17,.49,.411,{night,w:.23,h:.14,cross:false});
 pane(g,-.606,.48,-.18,{night,turn:-Math.PI/2,w:.20,h:.16,cross:false});
 // Split firewood beside the stove.
 for(let j=0;j<2;j++)for(let i=0;i<3;i++)beam(g,.36+i*.07,.16+j*.073,.52,.058,.065,.22,'#957044');
}
function housePorch(g,night){
 footing(g,1.82,1.29);
 // Back room and right wing make a genuine L, leaving the front-left terrace open.
 volume(g,0,-.35,1.68,.53,.12,.83);timber(g,0,-.35,1.68,.53,.12,.85);
 volume(g,.58,.07,.53,.68,.12,.73);timber(g,.58,.07,.53,.68,.12,.76);
 mono(g,0,-.35,1.87,.66,1.02,.16,'#a17f4f',4);mono(g,.58,.1,.70,.78,.89,.20,'#a17f4f',5);
 B(g,'wood','#b3986b',-.40,.14,.23,.83,.065,.61);
 for(const x of [-.81,-.01])beam(g,x,.60,.49,.05,.88,.05);
 for(let i=0;i<5;i++)beam(g,-.40,1.055,-.02+i*.13,.90,.035,.045,'#90956e');
 door(g,-.48,-.078,.05,night);pane(g,.22,.67,-.071,{night,w:.30,h:.23});pane(g,.853,.57,.16,{night,turn:Math.PI/2,w:.27,h:.25});
 flowers(g,.08,.11,.48,.32,'#d0a09c');flowers(g,-.60,.15,.54,.38,'#d6c6a4');
}
function houseMoss(g,night){
 footing(g,1.79,1.22);volume(g,0,-.11,1.48,.93,.11,.62,'#a59e7e','cobblestone');
 // A broad planted roof, with a shallow centre entrance; entirely different from a gable.
 turf(g,0,.84,-.11,1.79,1.12);turf(g,.18,.965,-.21,1.35,.81);turf(g,.25,1.055,-.27,.79,.46);
 for(const x of [-.73,.73])beam(g,x,.46,.38,.13,.65,.15,'#6f7151');
 B(g,'wood','#747553',0,.69,.49,.63,.13,.24);
 door(g,0,.37,0,night,{h:.46,w:.28});
 pane(g,-.46,.49,.365,{night,w:.32,h:.16,cross:false});pane(g,.46,.49,.365,{night,w:.28,h:.16,cross:false});
 for(let i=0;i<4;i++){const x=-.53+i*.31;cube(g,'#647e4f',x,1.02,-.43,.033,.22,.033);cube(g,i%2?'#cfbc83':'#aab98a',x,1.14,-.43,.07,.07,.07);}
 flowers(g,-.59,.10,.55,.33,'#c1b9cd');
}
function houseDuplex(g,night){
 footing(g,2.32,1.27);
 volume(g,-.57,-.19,1.02,.78,.11,1.00);timber(g,-.57,-.19,1.02,.78,.11,1.05);
 gable(g,-.57,-.19,1.20,.98,1.15,.66,'#8c704d','x',8);
 volume(g,.53,.045,.98,.86,.11,.68,'#b7baa0');timber(g,.53,.045,.98,.86,.11,.75,'#737b5e');
 gable(g,.53,.045,1.07,1.16,.89,.35,'#6e8376','z',5);
 door(g,-.64,.21,0,night,{number:1});door(g,.48,.49,0,night,{number:2,h:.57});
 pane(g,-.28,.70,.209,{night,w:.18,h:.27});pane(g,-.60,1.04,.209,{night,w:.19,h:.14,cross:false});pane(g,1.028,.53,.04,{night,turn:Math.PI/2,w:.29,h:.25});
 beam(g,-.03,.38,.46,.035,.49,.31);flowers(g,-1,.1,.51,.26);
}
function houseTower(g,night){
 footing(g,1.80,1.27);
 volume(g,-.10,-.1,.99,.99,.11,.39,'#7f8b7b','cobblestone');volume(g,-.10,-.1,.83,.84,.5,1.39,'#afb09a','cobblestone');
 for(const y of [.49,1.10,1.80])B(g,'stone','#858e7c',-.1,y,-.1,.94,.09,.95);
 // A larger wooden top room sits visibly proud of the slim stone shaft.
 volume(g,-.09,-.1,1.23,1.07,1.85,.71,'#c7b58d');timber(g,-.09,-.1,1.23,1.07,1.85,.76,'#756245');
 for(const x of [-.63,.44])beam(g,x,1.78,.36,.1,.25,.15);
 for(let i=0;i<5;i++)B(g,'wood','#718d7b',-.09,2.64+i*.10,-.1,1.38-i*.23,.105,1.24-i*.19);
 cube(g,'#bec7a4',-.09,3.115,-.10,.15,.11,.15);
 door(g,-.12,.397,0,night,{h:.59});pane(g,-.10,1.43,.327,{night,w:.16,h:.28,cross:false});
 pane(g,-.10,2.24,.443,{night,w:.43,h:.31,shutters:true});pane(g,.53,2.24,-.07,{night,turn:Math.PI/2,w:.37,h:.31});
 // Narrow external stair climbs up the side to a small landing.
 stairs(g,.67,.54,.10,.27,.95,.93,7);B(g,'wood',wood,.66,1.06,-.38,.42,.07,.35);rail(g,.86,1.08,-.39,.32,'z');
 pane(g,.324,1.15,-.25,{night,turn:Math.PI/2,w:.17,h:.25,cross:false});
}
function houseCorner(g,night){
 footing(g,2.30,1.81);
 volume(g,-.20,-.07,1.73,1.55,.11,.87);timber(g,-.20,-.07,1.73,1.55,.11,.9);
 B(g,'stone','#b0b29b',-.20,1.07,-.07,1.80,.12,1.62);
 volume(g,-.47,-.27,1.13,.97,1.12,.79);timber(g,-.47,-.27,1.13,.97,1.12,.82);
 // Setback roof and a front sun terrace. One facade is visibly stepped.
 mono(g,-.47,-.27,1.30,1.11,2.02,.16,'#8b9b86',5);
 door(g,-.73,.725,0,night,{h:.61,number:1});door(g,.01,.725,0,night,{h:.61,number:2});
 door(g,-.66,.232,1.03,night,{h:.54,number:3});pane(g,-.15,1.55,.232,{night,w:.24,h:.26});
 pane(g,-1.079,.64,-.31,{night,turn:-Math.PI/2,w:.37,h:.30});
 stairs(g,.86,.81,.1,.40,1.45,1.04,8);B(g,'stone',stone,.75,1.15,-.69,.62,.075,.33);
 rail(g,-.3,1.13,.70,1.54);rail(g,.565,1.13,.41,.55,'z');
 flowers(g,-.86,1.14,.58,.30,'#d0a393');flowers(g,.36,1.14,.56,.30,'#d1c897');
 // Lower-level bay and awning break the otherwise blank side wall.
 pane(g,.668,.61,.09,{night,turn:Math.PI/2,w:.27,h:.29});
}
function houseGallery(g,night){
 // Two separate wings and a raised link form an actual open courtyard.
 footing(g,2.82,1.83);
 for(const s of [-1,1]){
 const x=s*1.04;volume(g,x,-.01,.70,1.58,.11,1.20,s<0?'#c8b78f':'#bdbda2');timber(g,x,-.01,.70,1.58,.11,1.23);
 gable(g,x,-.02,.85,1.73,1.39,.36,s<0?'#8a7857':'#7c8c75','x',5);
 door(g,x,.795,0,night,{number:s<0?1:2,h:.58});pane(g,x,1.08,.795,{night,w:.21,h:.16,cross:false});
 for(const z of [-.40,.20])pane(g,x+s*.359,.76,z,{night,turn:s*Math.PI/2,w:.28,h:.31});
 }
 // The rear bridge has light underneath instead of a solid wall filling the courtyard.
 B(g,'wood',wood,0,1.08,-.56,1.41,.12,.57);
 volume(g,0,-.61,1.40,.40,1.14,.66);timber(g,0,-.61,1.40,.4,1.14,.69);
 mono(g,0,-.60,1.58,.66,1.88,.16,'#8b8060',4);
 for(const x of [-.38,.38])door(g,x,-.389,1.01,night,{h:.48,w:.21,number:x<0?3:4});
 B(g,'wood','#a08964',0,1.09,-.20,1.42,.06,.21);rail(g,0,1.11,-.08,1.36);
 for(const x of [-.67,.67])beam(g,x,.59,-.19,.08,.95,.08);
 // Entry paving, one communal tree, low seating and warm door lamps.
 B(g,'stone','#b7baa1',0,.123,.24,.53,.025,1.10);
 B(g,'wood',wood,-.49,.28,.48,.15,.12,.49);flowers(g,.45,.12,.35,.31,'#ceb993');
}
export function homeModel(spec,night=false){
 const g=new T.Group();g.name=spec.id;
 ({oak:houseOak,hearth:houseHearth,porch:housePorch,moss:houseMoss,duplex:houseDuplex,tower:houseTower,corner:houseCorner,gallery:houseGallery})[spec.id](g,night);
 return g;
}
function glass(g,x,y,z,w,h,d){
 const m=cube(g,'#bed4c6',x,y,z,w,h,d);m.material=m.material.clone();m.material.transparent=true;m.material.opacity=.19;m.material.depthWrite=false;return m;
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
   cube(g,j%2?'#748e60':'#8ea576',x+(j%2)*.04,1.57-j*.105,z,.13,.12,.13);
   if(j%2)cube(g,'#b6a0b9',x+.065,1.56-j*.105,z+.04,.065,.075,.065);
  }
  for(const x of [-.42,.43]){beam(g,x,1.45,.74,.025,.29,.025);pot(g,x,1.03,.74,'#78945e',.17);}
  // Distinct odd specimens: stepped violet crystal and glowing square-capped fungus.
  const specimen=group(g,.46,.1,.49);B(specimen,'stone','#718774',0,.09,0,.48,.18,.40);
  cube(specimen,'#8d79a9',-.13,.36,0,.12,.36,.12);cube(specimen,'#c0a5c9',-.09,.55,.015,.08,.11,.08);
  cube(specimen,'#758879',.12,.29,.02,.044,.23,.044);const cap=cube(specimen,'#bdc992',.12,.43,.02,.22,.08,.21);cap.material=cap.material.clone();cap.material.emissive.set('#c9ce98');cap.material.emissiveIntensity=night?.6:0;cap.userData.studyWindow=true;
  lantern(g,-.70,1.31,.80,night);
 }
 return g;
}
