// Homes have persistent instances and addresses, independent of catalogue levels.
export const HOMES = [
  {id:'cottage',name:'原木村屋',w:1.5,d:1.5,beds:1,tier:1,cost:100,desc:'熟悉的小村屋，木墙配一扇亮堂的窗。'},
  {id:'oak',name:'橡木尖顶屋',w:1.5,d:1.5,beds:1,tier:1,cost:120,desc:'尖顶阁楼，门边留一小丛花。'},
  {id:'hearth',name:'石炉矮屋',w:1.5,d:1.5,beds:1,tier:1,cost:150,desc:'低矮石墙，屋外砌一座壁炉。'},
  {id:'porch',name:'转角花庭屋',w:2,d:1.5,beds:1,tier:2,cost:350,requires:[['V6',1,'水井']],desc:'屋身围出转角花庭，门前有遮棚。'},
  {id:'moss',name:'覆土林间屋',w:2,d:1.5,beds:1,tier:2,cost:350,requires:[['V4',2,'麦田']],desc:'厚草顶、低窗，藏在林子里的小屋。'},
  {id:'duplex',name:'错层双子屋',w:2.5,d:1.5,beds:2,tier:2,cost:600,requires:[['V3',2,'集市']],desc:'两户错层相邻，各有自己的门牌。'},
  {id:'tower',name:'悬阁石木塔',w:2,d:1.5,beds:3,tier:3,cost:1800,requires:[['V14',1,'钟楼']],desc:'石塔托起木阁，沿外梯上楼。'},
  {id:'corner',name:'退台公寓',w:2.5,d:2,beds:4,tier:3,cost:2400,requires:[['V14',1,'钟楼'],['V3',3,'集市']],desc:'逐层退台，把屋顶留给露台。'},
  {id:'gallery',name:'围院长屋',w:3,d:2,beds:4,tier:3,cost:3000,requires:[['V14',1,'钟楼'],['V6',1,'水井'],['V4',3,'麦田']],desc:'两翼住屋连着回廊，中间留一座庭院。'},
];
export const HOME_BY_ID = Object.fromEntries([...HOMES,{id:'legacy',name:'原有村屋',w:1,d:1,beds:1,tier:1,cost:0}].map(h=>[h.id,h]));
export const homeType = id => HOME_BY_ID[String(id || '').replace(/^home:/,'')];
export const freshHousing = () => ({version:1,serial:0,revision:0,starterClaimed:false,stored:{},storedVariants:{},homes:[],assignments:{}});
export function homeReason(s,type){
  const h=HOME_BY_ID[type];
  if(!h || type==='legacy')return '请选择一种住宅';
  if(!s.counts.V2)return '招募首位村民后开放';
  const missing=(h.requires||[]).filter(([id,level])=>(s.counts[id]||0)<level);
  if(missing.length)return '需要'+missing.map(([,level,name])=>name+(level>1?` Lv.${level}`:'')).join('、');
  return '';
}
export function homeFootprint(p){const h=homeType(p.type);return (p.rotation||0)%2?{w:h.d,d:h.w}:{w:h.w,d:h.d};}
// Ground-floor solids only: the flower patio and courtyard remain walkable.
const bodies={
  oak:[[0,-.08,1,.91]],hearth:[[-.1,-.075,1,.94],[.48,-.18,.30,.53]],
  porch:[[0,-.35,1.68,.53],[.58,.07,.53,.68]],moss:[[0,-.11,1.48,.93]],
  duplex:[[-.57,-.19,1.02,.78],[.53,.045,.98,.86]],
  tower:[[-.1,-.1,.99,.99],[.67,.065,.27,.95]],
  corner:[[-.2,-.07,1.73,1.55],[.86,.085,.40,1.45]],
  gallery:[[-1.04,-.01,.70,1.58],[1.04,-.01,.70,1.58],[-.67,-.19,.08,.08],[.67,-.19,.08,.08]],
  cottage:[[0,0,1.16,1.16]],legacy:[[0,0,1.16,1.16]],
};
const doors={oak:[[-.18,.78]],hearth:[[-.22,.74]],porch:[[-.48,.29]],moss:[[0,.74]],duplex:[[-.64,.57],[.48,.86]],tower:[[-.12,.78]],corner:[[-.73,1.10]],gallery:[[0,.82]],cottage:[[0,.88]],legacy:[[0,.88]]};
export function homePoint(p,x,z){const r=(p.rotation||0)*Math.PI/2;return {x:p.x+x*Math.cos(r)+z*Math.sin(r),z:p.z-x*Math.sin(r)+z*Math.cos(r)};}
export function homeDoors(p){return (doors[p.type]||[]).map(([x,z])=>homePoint(p,x,z));}
export function homeObstacles(p){return (bodies[p.type]||[]).map(([x,z,w,d])=>{const c=homePoint(p,x,z);if((p.rotation||0)%2)[w,d]=[d,w];return {minX:c.x-w/2,maxX:c.x+w/2,minZ:c.z-d/2,maxZ:c.z+d/2};});}
export function housingCapacity(s){return (s.housing?.homes||[]).reduce((sum,p)=>sum+(homeType(p.type)?.beds||0),0);}
export function housingBlock(s){
  const people=s.counts.V2||0;
  if(!people || people<housingCapacity(s))return null;
  return {reason:'住房没有空位，先到村庄建一座住宅',links:['housing']};
}
