// Isolated art/footprint study: not imported by the game or saved in player worlds.
import * as T from 'three';
import {blockBox,cube,group} from '../../src/models.js';
export const HOMES=[
 {id:'oak',name:'橡木坡顶屋',w:1.5,d:1.5,beds:1,tier:1,shape:'gable',wall:'#d4c49b',wood:'#966f46',roof:'#997346'},
 {id:'hearth',name:'石基烟囱屋',w:1.5,d:1.5,beds:1,tier:1,shape:'chimney',wall:'#adb2a0',wood:'#765f4a',roof:'#79694e'},
 {id:'porch',name:'花窗侧廊屋',w:2,d:1.5,beds:1,tier:2,shape:'porch',wall:'#ded0af',wood:'#976d48',roof:'#ad8350'},
 {id:'moss',name:'苔顶林间屋',w:1.5,d:1.5,beds:1,tier:2,shape:'moss',wall:'#baa98b',wood:'#6e6850',roof:'#6b8151'},
 {id:'duplex',name:'双门联排屋',w:2.5,d:1.5,beds:2,tier:2,shape:'duplex',wall:'#d2c0a2',wood:'#927452',roof:'#8d7050'},
 {id:'tower',name:'石木塔楼',w:1.5,d:1.5,beds:3,tier:3,shape:'tower',wall:'#a3ad9e',wood:'#736347',roof:'#708b7c'},
 {id:'corner',name:'街角公寓',w:2.5,d:2,beds:4,tier:3,shape:'corner',wall:'#d6c8a6',wood:'#775c46',roof:'#ad8060'},
 {id:'gallery',name:'回廊公寓',w:3,d:2,beds:4,tier:3,shape:'gallery',wall:'#cab794',wood:'#77664c',roof:'#728378'},
];
const B=(p,kind,c,x,y,z,w,h,d)=>blockBox(p,kind,c,x,y,z,w,h,d);
function roof(g,x,z,w,d,y,c,pyramid=false){
 const steps=5;
 for(let i=0;i<steps;i++) B(g,'wood',c,x,y+i*.09,z,w-i*(w-.22)/steps,.105,pyramid?d-i*(d-.22)/steps:d);
}
function pane(g,x,y,z,rotation=0,night=false){
 const f=group(g,x,y,z);f.rotation.y=rotation;
 B(f,'wood','#625840',0,0,0,.3,.34,.06);
 const m=cube(f,night?'#ffcc75':'#719d98',0,0,.034,.23,.27,.018);
 m.material=m.material.clone();m.material.emissive.set('#ffbe62');m.material.emissiveIntensity=night?.75:0;
 m.userData.studyWindow=true;
 B(f,'wood','#ccba91',0,0,.05,.025,.29,.026);
 B(f,'wood','#ccba91',0,0,.05,.25,.025,.026);
}
function door(g,x,z,y=0,night=false){
 B(g,'log','#655542',x,y+.43,z,.31,.72,.08);
 B(g,'wood','#9d7b49',x,y+.43,z+.043,.24,.64,.025);
 cube(g,'#dcb96e',x+.075,y+.43,z+.062,.028,.035,.025);
 B(g,'stone','#a7ac96',x,y+.055,z+.12,.43,.11,.27);
 const lantern=cube(g,night?'#ffd480':'#c8a66b',x+.23,y+.8,z+.04,.09,.13,.09);
 lantern.material=lantern.material.clone();lantern.material.emissive.set('#ffba53');lantern.material.emissiveIntensity=night?1:0;
}
function planter(g,x,z){
 B(g,'wood','#95774f',x,.21,z,.34,.2,.22);
 for(const [j,c] of ['#e6bd83','#c98c83','#e1d8a1'].entries()){
  cube(g,'#628957',x+(j-1)*.095,.36,z,.035,.2,.035);
  cube(g,c,x+(j-1)*.095,.47,z,.08,.07,.08);
 }
}
export function homeModel(spec,night=false){
 const g=new T.Group();g.name=spec.id;
 const {w,d,shape}=spec, floors=shape==='tower'?3:['corner','gallery'].includes(shape)?2:1;
 const bodyW=w-.3,bodyD=d-.52,front=bodyD/2;
 B(g,'cobblestone','#9b9d88',0,.09,0,w-.12,.18,d-.12);
 B(g,'cobblestone','#7c8678',0,.21,-.04,bodyW,.22,bodyD);
 B(g,shape==='tower'||shape==='chimney'?'cobblestone':'wood',spec.wall,0,.3+floors*.37,-.04,bodyW,floors*.74,bodyD);
 for(let f=0;f<=floors;f++) B(g,'log',spec.wood,0,.29+f*.74,-.04,bodyW+.06,.09,bodyD+.035);
 for(const x of [-bodyW/2+.055,bodyW/2-.055])for(const z of [-bodyD/2,bodyD/2-.08])B(g,'log',spec.wood,x,.3+floors*.37,z,.11,floors*.74+.06,.11);
 if(shape==='duplex'){
  for(const x of [-.53,.53]){roof(g,x,-.04,1.13,bodyD+.22,1.1,spec.roof);door(g,x,front-.015,0,night);pane(g,x-.33,.72,front,0,night);}
  B(g,'log',spec.wood,0,.67,front,.1,.83,.12);
 }else if(shape==='gallery'){
  roof(g,0,-.22,w-.13,d-.55,.35+floors*.74,spec.roof);
  for(let f=0;f<2;f++){
   for(const x of [-.92,.28]){door(g,x,front-.07,f*.74,night);pane(g,x+.42,.72+f*.74,front-.02,0,night);}
   B(g,'wood',spec.wood,0,.18+f*.74,front+.09,w-.27,.075,.26);
   B(g,'wood',spec.wood,0,.53+f*.74,front+.2,w-.27,.06,.05);
   for(let j=-6;j<=6;j++) B(g,'wood',spec.wood,j*.19,.37+f*.74,front+.2,.045,.29,.045);
  }
 }else{
  const rx=shape==='porch'?-.22:0,rw=shape==='porch'?w-.55:w-.1;
  roof(g,rx,-.04,rw,bodyD+.23,.34+floors*.74,spec.roof,shape==='tower');
  door(g,shape==='corner'?-.64:0,front-.015,0,night);
  for(let f=0;f<floors;f++){
   for(const x of [-bodyW*.31,bodyW*.31]) if(f>0||shape!=='tower')pane(g,x,.76+f*.74,front,0,night);
   pane(g,bodyW/2+.013,.77+f*.74,-.04,Math.PI/2,night);
  }
  if(shape==='corner'){
   const bay=group(g,.61,0,front+.06);
   B(bay,'wood',spec.wall,0,1.35,0,.62,.68,.19);
   pane(bay,0,1.46,.108,0,night);
   roof(g,.59,front-.13,.88,.72,1.97,spec.roof);
  }
 }
 if(shape==='chimney'||shape==='moss'){
  const x=-bodyW*.32,z=-bodyD*.25;
  B(g,'cobblestone','#838978',x,1.4,z,.23,.91,.24);
  B(g,'cobblestone','#697364',x,1.87,z,.3,.07,.31);
  cube(g,'#414c40',x,1.909,z,.14,.008,.16);
 }
 if(shape==='porch'){
  roof(g,.62,.29,.55,.8,1.01,spec.roof);
  for(const z of [.55,-.03])B(g,'log',spec.wood,.82,.58,z,.07,.8,.07);
  planter(g,.61,.51);
 }
 if(shape==='moss')for(let i=0;i<4;i++)cube(g,['#77935a','#95a768'][i%2],-.49+i*.27,1.2+i*.04,-.15,.16,.07,.16);
 if(['oak','corner'].includes(shape))planter(g,-w*.3,d/2-.21);
 // Entry's warm pool is a thin, non-solid patch; no per-house shadow light.
 if(night){const m=new T.Mesh(new T.PlaneGeometry(.55,.23),new T.MeshBasicMaterial({color:'#e9b974',transparent:true,opacity:.2,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.set(0,.185,d/2-.19);g.add(m);}
 return g;
}
export function gardenModel(level=1,night=false){
 const g=new T.Group();g.name='garden-'+level;
 B(g,'cobblestone','#9fa48b',0,.065,0,1.88,.13,1.38);
 B(g,'wood','#8f7451',-.45,.38,-.25,.75,.57,.65);
 roof(g,-.45,-.26,.91,.83,.73,'#758a59');
 B(g,'wood','#a58456',.42,.47,.24,.75,.08,.39);
 for(const x of [.12,.72])B(g,'log','#6e6349',x,.25,.24,.06,.46,.26);
 const benchPlants=group(g,0,.4,0);
 for(let i=0;i<3;i++)planter(benchPlants,.12+i*.25,.27);
 B(g,'log','#826c4d',-.77,.55,.5,.045,.81,.045);
 B(g,'iron','#869c93',-.77,.9,.5,.19,.18,.05);
 B(g,'wood','#aa8b5b',-.23,.53,.5,.28,.34,.25);
 if(level>=2){
  for(const x of [.02,.78])for(const z of [-.58,.07])B(g,'iron','#687e65',x,.66,z,.055,1.14,.055);
  B(g,'iron','#687e65',.4,1.2,-.25,.82,.055,.76);
  const glass=cube(g,'#b1c9ad',.4,.8,-.25,.72,.65,.64);glass.material=glass.material.clone();glass.material.transparent=true;glass.material.opacity=.22;glass.material.depthWrite=false;
 }
 if(level>=3){
  for(const x of [-.06,.86])B(g,'log','#69795d',x,.79,.54,.055,1.43,.055);
  for(let i=0;i<4;i++)B(g,'wood','#7f8b61',.4,1.5,.1+i*.14,1.02,.04,.055);
  pane(g,-.45,.47,.11,0,night);
 }
 return g;
}
