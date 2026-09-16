// Sparse cell map: missing key = mottled expand-default grass (rand top/rock).
// District ground colors mirror layout.DISTRICTS (avoid circular import with layout).
const DISTRICT_GROUND = Object.freeze({
  village: {ground:'#c5b591',detail:'#a8b87d'},
  industry: {ground:'#9da5a0',detail:'#b87552'},
  center: {ground:'#c4caba',detail:'#779c90'},
});
export const TERRAIN_MOTTLE = 'mottle';
export const TERRAIN_TYPES = Object.freeze([
  {id:'grassLight',name:'浅色草地',cost:8,desc:'扩地浅草那一路，铺成整片浅绿色。',walk:true,build:true},
  {id:'grassDark',name:'深色草地',cost:8,desc:'扩地深草那一路，铺成整片偏深的草皮。',walk:true,build:true},
  {id:'sand',name:'沙地',cost:18,desc:'浅沙地面，适合院子边缘和旱地氛围。',walk:true,build:true},
  {id:'water',name:'浅水',cost:28,desc:'低一截的浅水格，不能走路也不能盖建筑。',walk:false,build:false},
  {id:'dirt',name:'泥土院',cost:14,desc:'暖土院子，适合种植区和房前空地。',walk:true,build:true},
  {id:'village',name:'村庄区',cost:12,desc:'村庄建筑脚边同款土黄地面，可手刷固定。',walk:true,build:true},
  {id:'industry',name:'工业区',cost:12,desc:'工业设施同款灰地面，可手刷固定。',walk:true,build:true},
  {id:'center',name:'演出区',cost:12,desc:'唱片机 / 直播一带的中心地面，可手刷固定。',walk:true,build:true},
]);
export const TERRAIN_BY_ID = Object.freeze(Object.fromEntries(TERRAIN_TYPES.map(t=>[t.id,t])));
export const TERRAIN_RESTORE = Object.freeze({id:TERRAIN_MOTTLE,name:'扩地原貌',cost:0,desc:'恢复刚扩地时的深浅混草，改完可随时刷回。',walk:true,build:true});

export const cellKey = (x,z) => `${Math.round(x)},${Math.round(z)}`;
export const parseCellKey = key => {
  const [xs,zs]=String(key).split(',');
  const x=+xs,z=+zs;
  return Number.isInteger(x)&&Number.isInteger(z)?{x,z}:null;
};

export function terrainAt(s,x,z){
  const key=cellKey(x,z),id=s.garden?.terrain?.[key];
  return TERRAIN_BY_ID[id]?id:null;
}

export function terrainBlocksWalk(s,x,z){
  return terrainAt(s,x,z)==='water';
}

export function terrainBlocksBuild(s,x,z){
  return terrainAt(s,x,z)==='water';
}

/** Integer cells covered by a brush of size 1/2/3 centered on (cx,cz). */
export function brushCells(cx,cz,size=1){
  const n=Math.max(1,Math.min(3,Math.floor(size)||1));
  if(n===1)return [{x:Math.round(cx),z:Math.round(cz)}];
  if(n===2){
    const x0=Math.floor(cx),z0=Math.floor(cz);
    return [{x:x0,z:z0},{x:x0+1,z:z0},{x:x0,z:z0+1},{x:x0+1,z:z0+1}];
  }
  const x=Math.round(cx),z=Math.round(cz),cells=[];
  for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)cells.push({x:x+dx,z:z+dz});
  return cells;
}

export function terrainPalette(id,theme){
  if(id==='grassLight')return {ground:theme.top,detail:'#a7b77e',edge:theme.edge,y:0.08,style:'grass'};
  if(id==='grassDark')return {ground:theme.rock,detail:'#5f7a4c',edge:theme.edge,y:0.08,style:'grass'};
  // Sand / dirt: own sparse pixel grains (rock/wood density), not district joints.
  if(id==='sand')return {ground:'#d7bf82',detail:'#c4a86e',edge:'#a88855',y:0.08,style:'sand'};
  if(id==='dirt')return {ground:'#9a7350',detail:'#7a5739',edge:'#6a4a32',y:0.08,style:'dirt'};
  if(id==='water')return {ground:'#5e8f9a',detail:'#7eafb4',edge:'#4a6f6a',y:0.04,water:true,style:'water'};
  if(id==='village')return {ground:DISTRICT_GROUND.village.ground,detail:DISTRICT_GROUND.village.detail,edge:theme.edge,y:0.08,style:'district'};
  if(id==='industry')return {ground:DISTRICT_GROUND.industry.ground,detail:DISTRICT_GROUND.industry.detail,edge:theme.edge,y:0.08,style:'district'};
  if(id==='center')return {ground:DISTRICT_GROUND.center.ground,detail:DISTRICT_GROUND.center.detail,edge:theme.edge,y:0.08,style:'district'};
  return null;
}

export function waterObstacles(s,realm='overworld'){
  if(realm!=='overworld'||!s.garden?.terrain)return [];
  const out=[];
  for(const [key,id] of Object.entries(s.garden.terrain)){
    if(id!=='water')continue;
    const cell=parseCellKey(key);if(!cell)continue;
    out.push({minX:cell.x-0.5,maxX:cell.x+0.5,minZ:cell.z-0.5,maxZ:cell.z+0.5});
  }
  return out;
}

export function footprintHitsWater(s,area,realm='overworld'){
  if(realm!=='overworld')return false;
  const minX=Math.floor(area.x-area.w/2),maxX=Math.ceil(area.x+area.w/2-1e-9);
  const minZ=Math.floor(area.z-area.d/2),maxZ=Math.ceil(area.z+area.d/2-1e-9);
  for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++)if(terrainBlocksBuild(s,x,z))return true;
  return false;
}

export function terrainCellsInParcel(terrain,parcelX,parcelZ){
  const map={};
  if(!terrain)return map;
  for(let x=parcelX*5-2;x<=parcelX*5+2;x++)for(let z=parcelZ*5-2;z<=parcelZ*5+2;z++){
    const key=cellKey(x,z);if(terrain[key])map[key]=terrain[key];
  }
  return map;
}

/** Remap absolute terrain keys when a stored 5×5 parcel is placed at a new chunk. */
export function remapTerrainCells(terrain,fromParcel,toParcel){
  const map={};
  if(!terrain)return map;
  const dx=(toParcel.x-fromParcel.x)*5,dz=(toParcel.z-fromParcel.z)*5;
  for(const [key,id] of Object.entries(terrain)){
    if(!TERRAIN_BY_ID[id])continue;
    const cell=parseCellKey(key);if(!cell)continue;
    map[cellKey(cell.x+dx,cell.z+dz)]=id;
  }
  return map;
}

export function restoreTerrainMap(raw){
  const map={};
  if(!raw||typeof raw!=='object')return map;
  for(const [key,id] of Object.entries(raw)){
    if(!TERRAIN_BY_ID[id])continue;
    const cell=parseCellKey(key);if(!cell)continue;
    map[cellKey(cell.x,cell.z)]=id;
  }
  return map;
}
