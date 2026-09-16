import { blockBox, cube, group } from './models.js';

// Village life buildings use the same shared geometry, pixel materials and
// Atmosphere window overlays as homes. Coordinates are their occupied envelope;
// decoration stays inside it so fitting never shrinks the useful building.
export const LIFE_MODEL_IDS = ['V11', 'V21', 'V22', 'V23', 'V24', 'V25'];
const C = { wood:'#977054', frame:'#66513c', plaster:'#dfd0aa', stone:'#a7ac96',
  roof:'#617f73', dark:'#45574d', leaf:'#77935e', cream:'#f8edcf', brass:'#d5ae62' };
const B = (g, kind, color, ...v) => blockBox(g, kind, color, ...v);
const timber = (g, ...v) => B(g, 'wood', C.wood, ...v);
const beam = (g, ...v) => B(g, 'log', C.frame, ...v);
function part(g, name) { const p=group(g);p.name=name;p.userData.facilityPart=name;return p; }
function base(g,w,d) { B(g,'cobblestone',C.stone,0,.055,0,w,.11,d); }
function roof(g,x,z,w,d,y,rise,color=C.roof,steps=5) {
  const p=part(g,'roof');
  for(let i=0;i<steps;i++) {
    const m=B(p,'wood',color,x,y+i*rise/steps,z,w-i*w*.14,rise/steps,d);
    m.userData.weatherSurface=true;
  }
  return p;
}
function pane(g,x,y,z,w=.25,h=.27,turn=0) {
  const p=group(g,x,y,z);p.rotation.y=turn;
  beam(p,0,0,0,w+.07,h+.07,.04);
  const glass=cube(p,'#9bb5a0',0,0,.031,w,h,.018);
  glass.userData.windowGlow=true;
  cube(p,C.cream,0,0,.05,.024,h,.018);
  return p;
}
function lantern(g,x,y,z,turn=0) {
  const p=group(g,x,y,z);p.rotation.y=turn;
  B(p,'iron',C.dark,0,0,0,.105,.17,.085);
  const lens=cube(p,'#d9b772',0,0,.049,.069,.115,.018);
  lens.userData.windowGlow=true;
  B(p,'iron',C.dark,0,.101,0,.15,.032,.13);
}
function bench(g,x,z,w=.45,turn=0) {
  const p=part(g,'seat');p.position.set(x,.11,z);p.rotation.y=turn;
  timber(p,0,.18,0,w,.06,.17);
  timber(p,0,.34,-.08,w,.19,.042);
  for(const s of [-1,1])beam(p,s*(w/2-.055),.085,0,.055,.17,.13);
  return p;
}
function book(g,x,y,z,w=.16,d=.15) {
  const p=part(g,'open-book');p.position.set(x,y,z);
  for(const s of [-1,1]) {
    const leaf=group(p,s*w*.24,0,0);leaf.rotation.z=s*.13;
    cube(leaf,'#647e79',0,0,0,w*.50,.025,d+.022);
    cube(leaf,C.cream,0,.019,0,w*.44,.018,d);
  }
  cube(p,C.brass,0,.027,0,.016,.014,d*.85);
}
function shelf(g,x,z,w=.43,y=.14,rows=3) {
  const p=part(g,'open-bookshelf');p.position.set(x,y,z);
  const h=rows*.19+.035;
  timber(p,0,h/2,-.055,w-.09,h,.045);
  for(const s of [-1,1])beam(p,s*(w/2-.02),h/2,0,.04,h,.17);
  for(let j=0;j<=rows;j++)timber(p,0,.025+j*.19,.012,w-.08,.045,.19);
  for(let j=0;j<rows;j++)for(let i=0;i<4;i++) {
    const color=['#a55f4d','#718b6b','#caad67','#6e929b'][(i+j)%4];
    cube(p,color,(i-1.5)*(w-.11)/4,.115+j*.19,.047,(w-.11)/4-.014,.12+(i%2)*.025,.115);
  }
}
function flowerpot(g,x,z,w=.25,color='#daac78') {
  B(g,'wood','#9c7855',x,.18,z,w,.15,.22);
  cube(g,'#6e664d',x,.26,z,w-.025,.02,.18);
  for(let i=0;i<3;i++) {
    cube(g,C.leaf,x+(i-1)*w*.27,.33,z,.035,.14,.035);
    cube(g,color,x+(i-1)*w*.27,.407+(i%2)*.035,z,.075,.065,.075);
  }
}
function table(g,x,z,w=.35,d=.28,y=.44) {
  const p=part(g,'table');p.position.set(x,0,z);
  timber(p,0,y,0,w,.055,d);
  for(const s of [-1,1])beam(p,s*w*.32,(y+.11)/2,0,.045,y-.11,.13);
  return p;
}
function library(g) {
  base(g,1.38,1.38);
  const tower=part(g,'reading-tower');
  B(tower,'wood',C.plaster,-.35,.73,-.27,.50,1.24,.65);
  for(const x of [-.59,-.11])beam(tower,x,.74,-.25,.06,1.3,.68);
  beam(tower,-.35,1.34,-.25,.59,.065,.71);
  pane(tower,-.35,1.105,.071,.28,.30);
  pane(tower,-.086,1.08,-.25,.29,.32,Math.PI/2);
  roof(tower,-.35,-.27,.66,.77,1.39,.36);
  book(tower,-.35,1.805,-.25,.29,.25);
  shelf(g,-.35,.15,.47,.15,3);
  // This open, lower wing exposes the books and desk from the game camera.
  timber(g,.29,.17,-.13,.62,.10,1.02);
  shelf(g,.30,-.36,.50,.22,3);
  for(const x of [.035,.585])beam(g,x,.68,-.45,.06,1.05,.06);
  beam(g,.60,.66,.27,.055,1.01,.055);
  roof(g,.30,-.15,.73,.92,1.21,.13,C.roof,3);
  table(g,.29,.29,.44,.24,.48);book(g,.29,.527,.29,.20,.16);
  bench(g,.29,.56,.47);
  lantern(g,.045,.93,.26);
  flowerpot(g,-.48,.51,.25,'#c6ad69');
}
function cart(g,x,z) {
  const p=part(g,'parked-cart');p.position.set(x,.11,z);
  timber(p,0,.16,0,.28,.055,.29);
  for(const s of [-1,1]) {
    timber(p,s*.124,.275,0,.032,.175,.29);
    timber(p,s*.10,.16,.23,.035,.035,.22);
    const wheel=B(p,'iron',C.dark,s*.18,.12,.01,.06,.22,.22);
    wheel.userData.facilityPart='cart-wheel';
    cube(p,C.brass,s*.216,.12,.01,.017,.06,.06);
  }
  timber(p,0,.275,-.13,.216,.175,.03);
  B(p,'wood','#bb9561',0,.25,-.005,.15,.12,.16);
}
function cartStation(g,level) {
  base(g,1.38,.88);
  // The roof occupies the rear strip so the open beds, wheels and handles read.
  for(const x of [-.60,.60])beam(g,x,.55,-.27,.07,.9,.09);
  timber(g,0,.64,-.32,1.16,.26,.06);
  const canopy=part(g,'cart-shelter');
  for(let i=0;i<3;i++)B(canopy,'wood','#a28a56',0,.97+i*.045,-.18-i*.1,1.35,.065,.1).userData.weatherSurface=true;
  beam(g,0,.90,-.06,1.36,.075,.07);
  for(const x of level>1?[-.43,0,.43]:[-.28,.23])cart(g,x,.055);
  const sign=part(g,'cart-sign');
  B(sign,'wood','#657d68',0,1.205,-.30,.46,.25,.055);
  cube(sign,C.cream,-.015,1.205,-.262,.24,.075,.016);
  for(const x of [-.095,.065])cube(sign,C.cream,x,1.145,-.261,.048,.045,.018);
  cube(sign,C.cream,.13,1.255,-.263,.10,.03,.018);
  lantern(g,-.58,.83,-.035);
  if(level>1) {
    const rack=part(g,'repair-rack');
    for(const x of [-.20,0,.20]){B(rack,'iron','#9eaaa2',x,.74,-.271,.025,.24,.022);cube(rack,C.brass,x,.85,-.255,.12,.04,.027);}
  }
}
function tavern(g,level) {
  base(g,1.88,1.38);
  B(g,'wood',C.plaster,-.10,.57,-.22,1.32,.92,.76);
  for(const x of [-.76,.55])for(const z of [-.58,.14])beam(g,x,.58,z,.075,.98,.075);
  beam(g,-.10,1.035,-.22,1.43,.075,.85);
  roof(g,-.10,-.22,1.58,.93,1.10,.40,'#a46d4c',6);
  const porch=part(g,'tavern-porch');
  timber(porch,-.08,.155,.41,1.53,.08,.42);
  for(const x of [-.79,.61])beam(porch,x,.535,.51,.065,.75,.065);
  for(let i=0;i<3;i++)B(porch,'wood','#a46d4c',-.09,.91+i*.05,.47-i*.12,1.63,.065,.12).userData.weatherSurface=true;
  B(g,'wood','#6c5b43',-.25,.455,.182,.32,.65,.06);
  B(g,'wood','#a57d4d',-.25,.455,.224,.25,.58,.025);
  cube(g,C.brass,-.17,.44,.244,.03,.045,.018);
  pane(g,-.57,.67,.181,.21,.27);pane(g,.27,.67,.181,.30,.27);
  pane(g,.58,.64,-.25,.32,.34,Math.PI/2);
  lantern(g,-.80,.76,.57);
  // A hanging mug remains large enough to identify at normal village zoom.
  const sign=part(g,'tavern-mug-sign');
  beam(sign,.79,1.12,.04,.055,.60,.07);beam(sign,.67,1.40,.04,.30,.06,.08);
  B(sign,'wood','#567365',.75,1.06,.083,.31,.35,.055);
  cube(sign,C.cream,.724,1.055,.12,.13,.17,.02);
  cube(sign,C.brass,.724,1.145,.125,.15,.035,.025);
  for(const y of [1.005,1.105])cube(sign,C.cream,.822,y,.125,.07,.028,.025);
  cube(sign,C.cream,.852,1.055,.125,.025,.125,.025);
  bench(g,.31,.53,.42);
  if(level>=2) {
    const chimney=part(g,'hearth-chimney');
    B(chimney,'cobblestone','#8e9180',.31,1.35,-.40,.21,.88,.24);
    B(chimney,'stone','#6e7566',.31,1.815,-.40,.29,.07,.31);
    table(g,-.62,.47,.24,.25,.43);cube(g,C.cream,-.62,.51,.47,.07,.11,.07);
    bench(g,-.62,.59,.30);
  }
  if(level>=3) {
    const dormer=part(g,'guest-dormer');
    B(dormer,'wood',C.plaster,-.35,1.375,.015,.42,.39,.34);
    pane(dormer,-.35,1.39,.195,.23,.23);
    roof(dormer,-.35,.01,.57,.45,1.61,.15,'#a46d4c',3);
    flowerpot(g,.78,-.43,.21,'#d6b368');
  }
}
function park(g,level) {
  base(g,1.38,1.38);
  cube(g,'#93a879',0,.121,0,1.28,.035,1.28);
  B(g,'stone','#c6c5a6',0,.148,.07,.32,.025,1.12);
  B(g,'stone','#c6c5a6',.32,.15,-.32,.47,.025,.27);
  const tree=part(g,'courtyard-tree');
  B(tree,'wood',C.frame,-.39,.49,-.39,.11,.71,.11);
  cube(tree,'#75905d',-.39,.91,-.39,.47,.42,.45);
  cube(tree,'#93a86d',-.35,1.16,-.41,.36,.19,.32);
  bench(g,.42,-.16,.48,Math.PI/2);
  flowerpot(g,-.44,.39,.28,'#d4a887');
  B(g,'cobblestone',C.stone,0,.25,-.59,1.20,.21,.10);
  lantern(g,.55,.62,.49);
  beam(g,.55,.36,.43,.055,.50,.06);
  if(level>=2) {
    bench(g,-.40,.04,.48,-Math.PI/2);
    const basin=part(g,'birdbath');
    B(basin,'stone','#b8bba4',0,.31,-.32,.10,.31,.10);
    B(basin,'stone',C.stone,0,.48,-.32,.31,.065,.31);
    cube(basin,'#84a9aa',0,.518,-.32,.24,.012,.24);
  }
  if(level>=3) {
    const arbor=part(g,'garden-arbor');
    for(const x of [-.63,-.19])beam(arbor,x,.67,-.05,.04,1.03,.05);
    for(const z of [-.18,-.04,.10])timber(arbor,-.41,1.20,z,.54,.045,.045);
    cube(arbor,'#839b63',-.53,1.24,-.04,.22,.09,.32);
    cube(arbor,'#adba77',-.25,1.24,-.03,.17,.09,.27);
    bench(g,.30,.48,.39);
  }
}
function hall(g,level) {
  base(g,1.88,1.88);
  const building=part(g,'community-wide-hall');
  timber(building,0,.155,-.04,1.68,.08,1.57);
  B(building,'wood',C.plaster,0,.64,-.68,1.63,.87,.09);
  B(building,'wood',C.plaster,-.78,.64,-.26,.09,.87,.78);
  for(const x of [-.78,.78])for(const z of [-.68,.30])beam(building,x,.66,z,.085,1.00,.085);
  beam(building,0,1.15,.28,1.67,.09,.085);
  // Only the rear third is roofed: chess tables and the raised stage stay legible.
  roof(building,0,-.49,1.85,.64,1.17,.29,'#65828c',5);
  pane(building,-.37,.77,-.625,.30,.32);pane(building,.36,.77,-.625,.30,.32);
  const stage=part(g,'small-stage');
  timber(stage,.45,.25,-.41,.52,.18,.39);
  B(stage,'cloth','#b57567',.45,.61,-.635,.52,.56,.035);
  for(const x of [.20,.70])B(stage,'cloth','#9c6058',x,.70,-.55,.07,.65,.12);
  B(stage,'wood','#62796b',.45,.63,-.45,.16,.25,.12);
  cube(stage,C.cream,.45,.775,-.435,.17,.026,.13);
  const chess=(x,z)=>{
    const p=table(g,x,z,.41,.37,.44);p.name='chess-table';p.userData.facilityPart='chess-table';
    for(let a=0;a<4;a++)for(let b=0;b<4;b++)cube(p,(a+b)%2?'#647565':'#ded7b4',(a-1.5)*.079,.474,(b-1.5)*.072,.078,.015,.071);
    for(const s of [-1,1])for(const x of [-.079,.079])cube(p,s>0?'#f4e9cf':'#4e5d51',x,.513,s*.106,.035,.060,.035);
    bench(g,x,z+.30,.38);bench(g,x,z-.30,.38,Math.PI);
  };
  chess(-.39,-.07);
  lantern(g,.77,1.035,.39);lantern(g,-.77,1.035,.39);
  if(level>=2) {chess(.39,.41);flowerpot(g,-.77,.60,.23,'#d6b977');}
  if(level>=3) {
    const awning=part(g,'festival-awning');
    for(const x of [-.83,.83])beam(awning,x,.84,.73,.055,1.36,.055);
    beam(awning,0,1.49,.73,1.77,.055,.065);
    for(let i=0;i<7;i++)B(awning,'cloth',i%2?'#cdae6f':'#799596',-.69+i*.23,1.43,.73,.19,.15,.035);
    bench(g,.72,-.05,.40,Math.PI/2);
  }
}
function canteen(g,level) {
  base(g,1.88,1.38);
  // A low, open kitchen and long communal table distinguish the canteen from
  // the tavern's enclosed room. All benches and roof growth stay on this lot.
  const kitchen=part(g,'canteen-open-kitchen');
  B(kitchen,'stone','#c9c4aa',-.28,.60,-.585,1.16,.98,.09);
  for(const x of [-.85,.30])beam(kitchen,x,.64,-.565,.07,1.07,.11);
  beam(kitchen,-.85,.62,-.02,.07,1.03,.07);
  beam(kitchen,.30,.62,-.02,.07,1.03,.07);
  const stove=part(g,'canteen-stove');
  B(stove,'cobblestone',C.stone,-.62,.42,-.335,.43,.62,.47);
  B(stove,'iron',C.dark,-.62,.752,-.335,.48,.045,.51);
  cube(stove,'#455447',-.62,.33,-.086,.26,.245,.026);
  const fire=cube(stove,'#d9b772',-.62,.316,-.065,.17,.072,.018);
  fire.userData.windowGlow=true;
  B(stove,'iron',C.dark,-.62,.84,-.315,.255,.13,.245);
  B(stove,'iron','#7e8875',-.62,.919,-.315,.30,.04,.29);
  cube(stove,'#b19761',-.62,.944,-.315,.215,.013,.205);
  for(const x of [-.81,-.43])B(stove,'iron',C.dark,x,.855,-.315,.07,.045,.08);
  const chimney=part(g,'canteen-chimney');
  B(chimney,'cobblestone',C.stone,-.62,1.165,-.46,.235,.87,.23);
  B(chimney,'stone','#677360',-.62,1.631,-.46,.32,.065,.31);
  cube(chimney,'#455447',-.62,1.67,-.46,.17,.016,.16);
  const counter=part(g,'canteen-serving-window');
  B(counter,'wood','#b38c58',-.055,.295,-.16,.60,.29,.38);
  B(counter,'wood','#ddcca1',-.055,.465,-.15,.66,.055,.42);
  // Shallow lean-to roof: the gap below remains large enough to see the meal
  // counter at normal zoom. Separated strip faces avoid coplanar shimmer.
  const shed=part(g,'canteen-kitchen-roof');
  for(let i=0;i<4;i++)B(shed,'wood','#8a9b6a',-.28,1.27-i*.043,-.505+i*.153,1.29,.060,.15).userData.weatherSurface=true;
  beam(shed,-.28,1.095,.069,1.31,.085,.055);
  const sign=part(g,'canteen-bowl-sign');
  B(sign,'wood','#5c7865',-.075,1.244,.067,.36,.27,.045);
  cube(sign,C.cream,-.075,1.266,.10,.235,.035,.018);
  cube(sign,C.cream,-.075,1.212,.10,.17,.075,.018);
  cube(sign,C.cream,-.075,1.158,.10,.09,.035,.018);
  cube(sign,C.brass,-.12,1.347,.10,.025,.080,.018);
  cube(sign,C.brass,-.032,1.362,.10,.025,.07,.018);
  lantern(g,-.85,.90,.03);
  const dining=part(g,'canteen-communal-table');
  const diningTable=table(dining,.065,.415,1.35,.235,.46);
  for(const z of [.185,.625]) {
    const seat=part(dining,'canteen-dining-bench');
    timber(seat,.065,.285,z,1.37,.055,.105);
    for(const x of [-.49,.62])beam(seat,x,.183,z,.055,.146,.08);
  }
  function meal(parent,x,y,z) {
    B(parent,'stone','#d7d7bb',x,y,z,.16,.05,.16);
    cube(parent,'#b19761',x,y+.03,z,.115,.017,.115);
    cube(parent,'#89a367',x-.025,y+.052,z,.048,.028,.05);
    cube(parent,C.cream,x+.14,y-.011,z,.02,.025,.15);
  }
  meal(diningTable,-.36,.516,0);meal(diningTable,.33,.516,0);
  if(level>=2) {
    const wing=part(g,'canteen-second-counter');
    B(wing,'stone','#c9c4aa',.585,.595,-.585,.48,.96,.09);
    for(const z of [-.565,-.02])beam(wing,.85,.625,z,.065,1.04,.07);
    for(let i=0;i<4;i++)B(wing,'wood','#8a9b6a',.641,1.267-i*.043,-.505+i*.153,.53,.055,.15).userData.weatherSurface=true;
    beam(wing,.66,1.092,.069,.505,.08,.055);
    B(wing,'wood','#b38c58',.61,.295,-.16,.43,.29,.38);
    B(wing,'wood','#ddcca1',.61,.465,-.15,.46,.055,.42);
    B(wing,'iron','#7e8875',.61,.545,-.14,.29,.10,.21);
    cube(wing,'#b19761',.61,.602,-.14,.245,.025,.165);
    timber(wing,.62,.79,-.47,.41,.045,.21);
    for(const x of [.51,.70])cube(wing,C.cream,x,.855,-.46,.125,.085,.125);
  }
  if(level>=3) {
    const canopy=part(g,'canteen-dining-pergola');
    for(const x of [-.83,.86])beam(canopy,x,.595,.64,.055,.97,.06);
    for(const z of [.22,.64])beam(canopy,.015,1.097,z,1.78,.065,.055);
    // Wide gaps leave the meal bowls and seating visible below the new cover.
    for(const x of [-.80,-.39,.02,.43,.84])B(canopy,'wood','#b9a178',x,1.151,.435,.09,.042,.50).userData.weatherSurface=true;
    lantern(canopy,.85,.91,.62);
    meal(diningTable,-.03,.516,0);
  }
}
export function lifeBuilding(parent,id,state={}) {
  if(!LIFE_MODEL_IDS.includes(id))return null;
  const g=part(parent,'village-life-'+id),max=id==='V11'?1:id==='V24'?2:3;
  const level=Math.max(1,Math.min(max,Math.floor(Number(state.counts?.[id])||1)));
  g.userData.facilityStyle='village-life-v2';g.userData.lifeFacility=id;g.userData.lifeLevel=level;
  ({V11:library,V21:park,V22:tavern,V23:hall,V24:cartStation,V25:canteen})[id](g,level);
  return g;
}

// Small worker accessory in actor-local world units. The caller owns visibility,
// position and motion; this geometry never observes or mutates simulation state.
export function makeHaulerCart(parent) {
  const g=part(parent,'hauler-cart');g.userData.haulerCart=true;
  const bed=part(g,'hauler-cart-bed');
  timber(bed,0,.14,-.10,.31,.03,.27);
  for(const s of [-1,1]) {
    timber(bed,s*.14,.205,-.10,.03,.10,.27);
    timber(g,s*.10,.13,.13,.03,.035,.30);
    // Rotate this group around local X so the shared square wheel and its hub
    // stay together. The thin axle connects the wheels beneath the shallow bed.
    const wheel=part(g,'hauler-cart-wheel');
    wheel.position.set(s*.19,.10,-.10);wheel.userData.cartWheel=true;
    B(wheel,'iron',C.dark,0,0,0,.055,.20,.20);
    cube(wheel,C.brass,s*.035,0,0,.016,.055,.055);
  }
  timber(bed,0,.205,-.22,.25,.10,.03);
  B(g,'iron',C.dark,0,.10,-.10,.38,.035,.035);
  return g;
}
