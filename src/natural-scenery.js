// One saved seed per purchased parcel. Reading/rendering never rerolls the world.
export function parcelSeed(seed,key){let hash=seed>>>0;for(const c of key)hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;return hash;}
const cache=new WeakMap();
export function parcelScenery(s,c){
 const g=s.garden,key=`overworld:${c.x}:${c.z}`,seed=g?.naturalSeeds?.[key];if(!Number.isInteger(seed))return [];
 let entries=cache.get(g);if(!entries){entries=new Map();cache.set(g,entries);}if(entries.get(key)?.seed===seed)return entries.get(key).items;
 let t=seed;const random=()=>{t=(t+0x6d2b79f5)>>>0;let x=Math.imul(t^(t>>>15),t|1);x^=x+Math.imul(x^(x>>>7),x|61);return ((x^(x>>>14))>>>0)/4294967296;};
 const items=[],starter=c.x===0&&c.z===0,trees=starter?1:1+Number(random()<.3),flowers=1+Math.floor(random()*3),palette=random()<.5?['grass','wildflowers','poppy']:['fern','grass','bluebells'];
 function point(kind){for(let tries=0;tries<48;tries++){
   const dx=Math.round((random()*4.2-2.1)*10)/10,dz=Math.round((random()*4.2-2.1)*10)/10;
   if(starter&&(Math.max(Math.abs(dx),Math.abs(dz))<(kind==='tree'?1.9:1.5)))continue;
   const x=c.x*5+dx,z=c.z*5+dz;if(items.some(p=>Math.hypot(p.x-x,p.z-z)<(kind==='tree'?1.1:.6)))continue;return{x,z};
  }return null;}
 for(let i=0;i<trees+flowers;i++){
  const kind=i<trees?'tree':'garden',p=point(kind);if(!p)continue;
  const scale=kind==='tree'?Math.round((.43+random()*.23)*100)/100:1;
  items.push({id:`wild:${key}:${i}`,realm:'overworld',native:true,kind,...(kind==='tree'?{scale}:{type:palette[Math.floor(random()*palette.length)]}),...p,w:kind==='tree'?.65:.5,d:kind==='tree'?.65:.5,rotation:Math.floor(random()*4)});
 }
 entries.set(key,{seed,items});return items;
}
