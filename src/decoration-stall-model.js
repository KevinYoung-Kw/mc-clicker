import { blockBox as b, cube, group } from './models.js';
export function decorationStall(parent, level=1) {
 const g=group(parent), wood='#9c774d';g.userData.facilityStyle='decoration-stall';g.userData.stallLevel=level;
 const part=(name,kind,color,x,y,z,w,h,d)=>{const m=b(g,kind,color,x,y,z,w,h,d);m.userData.facilityPart=name;return m;};
 part('shop-plinth','cobblestone','#8e9987',0,.06,0,1.28,.12,1.1);
 for(const x of [-.55,.55])part('shop-post','log',wood,x,.76,-.38,.13,1.4,.13);
 part('shop-back','wood','#705b40',0,.73,-.39,1,.95,.08);
 // Lower counter and open front keep the merchandise readable at world zoom.
 part('paint-counter','wood',wood,0,.37,.26,1.14,.5,.42);
 part('counter-top','wood','#c7a772',0,.645,.26,1.28,.07,.48);
 for(let i=0;i<3;i++){
  const x=-.4+i*.39,c=['#819b71','#c28d63','#7a9da0'][i];
  part('pigment-box','wood','#705b40',x,.76,.3,.22,.16,.22);
  part('pigment','cloth',c,x,.848,.3,.17,.016,.17);
 }
 // A broad framed sample sign replaces tiny indistinct jars as the silhouette.
 part('sample-frame','wood','#705b40',0,1.18,-.329,.84,.39,.04);
 part('sample-paper','cloth','#e6d7b1',0,1.18,-.298,.76,.31,.018);
 for(let i=0;i<3;i++)cube(g,['#819b71','#c28d63','#7a9da0'][i],-.23+i*.23,1.18,-.28,.15,.13,.016);
 for(let i=0;i<6;i++)part('awning','cloth',i%2?'#e2d3af':'#73977e',-.55+i*.22,1.5,-.04,.22,.12,1.13);
 for(const x of [-.48,.48]){
  part('paint-brush','wood',wood,x,.98,.28,.045,.25,.045);
  part('brush-tip','cloth',x<0?'#879e74':'#b99caa',x,1.12,.28,.09,.075,.055);
 }
 if(level>=2){
  part('extra-shelf','wood','#b38e5e',0,.95,-.23,.97,.055,.23);
  for(let i=0;i<4;i++)part('fabric-roll','cloth',['#b68568','#7a9972','#7a9b9f','#b8a47b'][i],-.34+i*.23,1.035,-.2,.17,.115,.13);
  for(const x of [-.58,.58])part('shelf-bracket','iron','#a17b56',x,1.21,-.3,.06,.3,.1);
 }
 if(level>=3){
  part('shop-crest','wood','#705b40',0,1.53,.544,.42,.25,.045);
  cube(g,'#d9b66d',0,1.54,.576,.21,.12,.019);
  for(const x of [-.53,.53]){
   part('hanging-sample','cloth',x<0?'#8a7f9f':'#b99862',x,1.1,.48,.18,.43,.025);
   cube(g,'#e1d4b0',x,1.06,.501,.065,.11,.013);
  }
 }
 return g;
}
