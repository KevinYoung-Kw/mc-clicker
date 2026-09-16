import * as T from 'three';
import {blockBox,cube,mat} from './models.js';
const B=(g,k,c,x,y,z,w,h,d)=>blockBox(g,k,c,x,y,z,w,h,d);
// Text is rendered into a crisp, shared plane; no per-frame canvas or rotation.
const signs=new Map();
// One geometry for every inscription, including temporary placement previews.
// Scene rebuilds dispose instance buffers, while model-kit geometry is shared.
const signGeometry=new T.PlaneGeometry(1,1);
function sign(g,text,x,y,z,w,h,{back=false,frame=true,color='#ede0b4',ink='#70422e'}={}){
 if(frame)B(g,'wood','#79583e',x,y,z,w+.035,h+.035,.045);
 if(typeof document==='undefined')return;
 const key=[text,color,ink].join('|');let material=signs.get(key);
 if(!material){const c=document.createElement('canvas');c.width=512;c.height=128;const q=c.getContext('2d');q.fillStyle=color;q.fillRect(0,0,512,128);q.fillStyle=ink;q.textAlign='center';q.textBaseline='middle';q.font=`bold ${Math.min(72,440/text.length)}px "Noto Sans SC",sans-serif`;q.fillText(text,256,68);const t=new T.CanvasTexture(c);t.magFilter=T.NearestFilter;t.minFilter=T.LinearFilter;material=new T.MeshStandardMaterial({map:t,roughness:1});signs.set(key,material);}
 const plane=new T.Mesh(signGeometry,material);plane.scale.set(w,h,1);plane.position.set(x,y,z+(back?-.026:.026));if(back)plane.rotation.y=Math.PI;g.add(plane);
}
function lamp(g,x,y,z){
 B(g,'iron','#665345',x,y+.14,z,.045,.14,.045);
 B(g,'wood','#b64f36',x,y,z,.18,.23,.18);
 for(const yy of [y-.13,y+.13])cube(g,'#bea25c',x,yy,z,.21,.03,.21);
 const glow=cube(g,'#efb565',x,y,z+.095,.10,.12,.012);glow.material=mat('#efb565',.35);glow.userData.windowGlow=true;
 cube(g,'#ba763b',x,y-.19,z,.025,.1,.025);
}
function bench(g,x,z,w){B(g,'wood','#ae8655',x,.22,z,w,.07,.20);for(const xx of [x-w*.32,x+w*.32])B(g,'wood','#796442',xx,.1,z,.065,.2,.15);}
export function communityModel(type){
 const g=new T.Group();g.name='garden-'+type;
 if(type==='request-pond'){
  // Stepped shoreline rather than a rectangular bathtub.
  for(const [z,w] of [[-.57,1.40],[-.32,1.83],[0,1.94],[.30,1.77],[.56,1.32]]){
   B(g,'rock','#9ba58b',-.03,.035,z,w,.07,.25);
   cube(g,'#76997a',-.03,.076,z,w-.09,.012,.245);
  }
  for(const [z,w]of [[-.36,.86],[-.14,1.35],[.08,1.45],[.30,1.10]])cube(g,'#70a9a0',-.05,.088,z,w,.016,.22);
  for(const [x,z,w,d,h]of [[-.70,-.30,.22,.21,.15],[-.81,.03,.20,.28,.10],[-.65,.42,.28,.18,.12],[-.27,.49,.30,.18,.08],[.10,.47,.24,.19,.10],[.61,.29,.29,.26,.12],[.76,.0,.24,.30,.14],[.52,-.39,.23,.19,.09],[-.21,-.53,.32,.21,.14]]){
   B(g,'rock','#b6b99d',x,.085+h/2,z,w,h,d);cube(g,'#839c64',x-.018,.09+h,z,w*.6,.023,d*.55);
  }
  for(const [x,z]of [[-.76,-.26],[.52,-.48],[.73,.31]])for(let j=0;j<3;j++){
   cube(g,j%2?'#a1b16c':'#739253',x+(j-1)*.06,.15+j*.027,z,.029,.21+j*.05,.025);
   if(j===1)cube(g,'#ad8652',x,.31,z,.045,.09,.038);
  }
  for(const [x,z]of [[-.27,-.3],[.38,.20]]){cube(g,'#6e945a',x,.108,z,.19,.018,.14);cube(g,'#d6a4ae',x,.139,z,.07,.06,.07);cube(g,'#eacb7d',x,.175,z,.025,.014,.025);}
  for(const [x,z,r,scale]of [[-.28,.13,-.35,1],[.28,-.12,.8,.8]]){
   const duck=new T.Group();duck.position.set(x,.105,z);duck.rotation.y=r;duck.scale.setScalar(scale);g.add(duck);
   // Square body, raised head, orange bill and two little black eyes.
   cube(duck,'#f0c74c',0,.075,0,.24,.13,.16);cube(duck,'#ffe087',-.025,.15,.045,.14,.08,.13);
   cube(duck,'#f5d15d',.105,.19,0,.13,.15,.13);cube(duck,'#d99237',.197,.17,0,.09,.045,.10);
   for(const side of [-1,1])cube(duck,'#424839',.13,.212,side*.067,.025,.028,.012);
   cube(duck,'#e1ac38',-.02,.094,.084,.14,.07,.021);cube(duck,'#f5d778',-.143,.12,0,.05,.055,.085);
   for(const side of [-1,1])cube(duck,'#b9d5bb',-.09,.008,side*.145,.19,.008,.018);
  }
  const boat=new T.Group();boat.position.set(.01,.115,-.34);boat.rotation.y=-.5;g.add(boat);
  cube(boat,'#e9dcc0',0,.01,0,.22,.03,.12);cube(boat,'#f4ead6',0,.047,0,.16,.045,.065);cube(boat,'#f4ead6',-.02,.095,0,.06,.06,.025);
  B(g,'log','#785d40',.58,.29,-.56,.035,.44,.035);
  sign(g,'已排期',.58,.49,-.56,.48,.16);
  sign(g,'没事，怕你没看到，不是催你。',.58,.49,-.56,.48,.16,{back:true,frame:false});
 }
 if(type==='cash-counter'){
  // A village service booth: stone footings, framed window, green tiled roof.
  B(g,'stone','#a1a28e',0,.055,0,1.45,.11,1.43);
  B(g,'stone','#b9b49a',0,.16,-.07,1.27,.12,1.14);
  B(g,'wood','#c0ae87',0,.62,-.56,1.16,.87,.06);
  for(const x of [-.56,.56]){
   B(g,'wood','#bba982',x,.62,-.11,.055,.87,.91);
   B(g,'stone','#beb59a',x,.29,.40,.17,.23,.17);
   B(g,'log','#6c7560',x,.86,.40,.09,1.05,.09);
  }
  // Dark empty interior and a safe on the back wall.
  B(g,'iron','#586759',0,.66,-.51,.49,.58,.075);
  B(g,'iron','#7d8872',0,.68,-.457,.36,.43,.035);
  cube(g,'#bac0a2',.095,.69,-.428,.025,.12,.035);
  for(const x of [-.52,.52])B(g,'wood','#899478',x,.77,-.09,.09,1.01,1.08);
  B(g,'wood','#9b875f',0,.54,.37,1.12,.52,.11);
  B(g,'wood','#c6b183',0,.82,.47,1.31,.075,.35);
  B(g,'wood','#6d795e',0,1.31,.36,1.23,.13,.13);
  // Short pitched roof, with a contrasting brass ridge.
  for(let j=0;j<5;j++)for(const side of [-1,1])B(g,'stone',j%2?'#647c64':'#718a70',0,1.41+j*.073,-.07+side*(.57-j*.12),1.42-j*.04,.075,.14);
  for(const x of [-.54,.54])for(let j=0;j<5;j++)B(g,'wood','#879073',x,1.4+j*.063,-.07,.06,.07,1.05-j*.21);
  B(g,'iron','#b29a60',0,1.78,-.07,1.26,.055,.13);
  sign(g,'大王提现处',0,1.22,.50,1.04,.21,{color:'#546c52',ink:'#f1dfae'});
  sign(g,'暂停营业',-.13,.57,.438,.69,.15);
  B(g,'iron','#607062',.25,.875,.49,.32,.025,.22);
  for(const x of [.09,.41])cube(g,'#aeb69b',x,.896,.49,.022,.035,.22);
  cube(g,'#aeb69b',.25,.896,.59,.34,.035,.022);
  // Emerald mounted on a side bracket, readable even when the sign is tiny.
  B(g,'iron','#9d8a58',.64,1.24,.18,.045,.28,.045);
  cube(g,'#5b9669',.64,1.42,.18,.15,.18,.13);cube(g,'#a5cc82',.603,1.46,.25,.045,.09,.014);
  B(g,'stone','#9a957c',-.46,.23,.58,.25,.25,.24);
  cube(g,'#79915c',-.46,.40,.58,.28,.14,.25);cube(g,'#94aa6f',-.49,.51,.56,.17,.09,.16);
 }
 if(type==='village-stage'){
  B(g,'stone','#92998a',0,.11,-.10,2.86,.22,2.18);
  B(g,'wood','#b49363',0,.26,-.37,2.49,.10,1.48);
  for(const [z,w,y]of [[.49,1.06,.18],[.66,1.18,.10]])B(g,'stone','#adb09a',0,y,z,w,.13,.21);
  // Warm timber frame, an open proscenium and curtain wings.
  for(const x of [-1.07,1.07])for(const z of [-.94,.24]){
   B(g,'stone','#b4b298',x,.39,z,.20,.2,.20);
   B(g,'log','#995141',x,1.05,z,.105,1.30,.105);
   B(g,'wood','#a25a43',x,1.68,z,.20,.10,.20);
  }
  B(g,'wood','#764d3b',0,1.71,-.34,2.52,.12,1.63);
  B(g,'wood','#6c5143',0,1.0,-1.01,2.15,1.32,.065);
  B(g,'petals','#a04a43',0,1.03,-.96,1.94,1.18,.035);
  for(const x of [-.83,.83]){B(g,'petals','#b45145',x,1.04,.235,.33,1.17,.045);cube(g,'#ddba73',x,.92,.266,.34,.05,.018);}
  // Stepped grey roof with raised eaves, not a recolored cottage roof.
  for(let n=0;n<7;n++)for(const side of [-1,1]){
   const z=-.34+side*(.84-n*.115),y=1.83+n*.068;
   B(g,'stone',n%2?'#68796f':'#738379',0,y,z,2.77-n*.045,.08,.14);
  }
  B(g,'stone','#879387',0,2.29,-.34,2.58,.085,.15);
  for(const x of [-1.37,1.37])for(const z of [-1.18,.5]){B(g,'stone','#849082',x,1.93,z,.12,.16,.16);B(g,'stone','#9aa38e',x,2.015,z,.1,.035,.1);}
  sign(g,'农村大舞台',0,1.61,.50,1.36,.25,{color:'#744537',ink:'#eed297'});
  for(const x of [-1.08,1.08])lamp(g,x,1.4,.48);
  for(const x of [-.91,.91])bench(g,x,1.02,.65);
  sign(g,'有梦你就来',0,.58,-.84,1.0,.20,{color:'#ad5140',ink:'#f2d7a1'});
  B(g,'log','#876844',1.20,.33,.72,.045,.55,.045);
  sign(g,'用心经营我的小游戏',1.08,.61,.73,.55,.11);
 }
 return g;
}
