import {COMMUNITY_SOUVENIRS} from './community-souvenirs-data.js';
// Garden collectibles are scene objects, separate from web/studio cosmetics.
export const GARDEN_ID = 'V20';
export const GARDEN_LEVEL_COSTS = [12000, 60000, 300000];
export const GARDEN_ITEMS = [
 ['lotus','荷塘',2,900,1,1,0,'浮叶围着淡粉荷花，沿浅水边缘拼成小池塘。'],
 ['fallenlog','林间倒木',2,1100,1,.5,.18,'倒下的老树留着年轮，苔藓和小蘑菇沿木身生长。'],
 ['hydrangea','绣球花丛',2,750,.5,.5,0,'蓝紫花团高低错落，适合门前或树荫下。'],
 ['turf','草坪地皮',1,90,1,1,0,'铺一方短草坪，可以连成整片。'],
 ['earth','黄土地皮',1,80,1,1,0,'露出细碎土色，适合院子和种植区。'],
 ['gravel','石子小径',1,120,1,1,0,'灰白小石子铺成的路面。'],
 ['flagstone','石板小径',2,260,1,1,0,'宽窄错落的方石板，中间留着细缝。'],
 ['mossground','苔藓地毯',2,180,1,1,0,'深浅相间的苔藓，适合树林脚下。'],
 ['boardwalk','木栈地板',2,320,1,1,0,'一块块木板拼成栈道，可旋转铺设方向。'],
 ['pond','浅水小景',2,600,1,1,0,'一方安静的浅水，水面浮着几片小叶。'],
 ['fern','蕨叶丛',1,180,.5,.5,0,'长短不一的羽状叶，填在树边和石缝。'],
 ['poppy','虞美人',1,240,.5,.5,0,'红色花瓣和深色花心，花丛里的一点亮色。'],
 ['bluebells','风铃花',2,580,.5,.5,0,'低垂的小蓝花，沿着高低不同的花茎生长。'],
 ['reeds','芦苇',2,650,.5,.5,.12,'细长叶片与褐色穗头，搭配浅水布景。'],
 ['bamboo','竹丛',2,1800,1,1,.19,'几根错落的竹节，顶端伸出细小叶枝。'],
 ['grass','矮草簇',1,80,.5,.5,0,'几丛高低错落的草，适合填在路边。'],
 ['wildflowers','野花丛',1,150,.5,.5,0,'白花里夹几朵暖黄的小花。'],
 ['shrub','矮灌木',1,220,.5,.5,.15,'贴地生长的小灌木，能围出花园边缘。'],
 ['stones','叠石',1,260,.5,.5,.17,'三块大小不同的石头，点缀岸边和院角。'],
 ['oak','橡树',2,1600,1,1,.22,'宽阔的方块树冠，树下留一点阴凉。'],
 ['birch','白桦',2,1800,1,1,.18,'白色树干与浅绿树叶，树形更高挑。'],
 ['spruce','云杉',2,2200,1,1,.22,'层层收窄的深绿针叶，适合林地。'],
 ['blossom','花树',2,2800,1,1,.22,'不对称的粉色树冠，让村庄多一点春色。'],
 ['hedge','树篱',2,900,1,.5,.19,'一小段整齐的绿篱，可以旋转后接着摆。'],
 ['mossrock','苔石',2,1200,.5,.5,.18,'石缝里长着苔藓与小叶片。'],
 ['vine','垂藤架',3,5200,1,.5,.19,'木架垂下长短不同的藤蔓。'],
 ['glowcap','发光蕈',3,6500,.5,.5,.15,'方形菌盖带着柔和的浅绿光。'],
 ['crimson','绯红菌丛',3,8500,1,1,.22,'从下界带回来的暗红菌丛。','N1'],
 ['amethyst','紫晶石景',3,9500,.5,.5,.18,'几根错落的紫晶嵌在石座上。'],
 ['chorus','紫颂小景',3,12000,1,1,.19,'分叉的紫色枝条，只作园艺观赏。','E2'],
].map(([id,name,level,cost,w,d,radius,desc,requires])=>({id,name,level,cost,w,d,radius,desc,requires,group:['turf','earth','gravel','flagstone','mossground','boardwalk','pond','lotus'].includes(id)?'ground':['oak','birch','spruce','blossom','hedge','mossrock','bamboo','fallenlog'].includes(id)?'trees':level===3?'odd':'flowers'}));
GARDEN_ITEMS.push(...COMMUNITY_SOUVENIRS.map(i=>({...i,level:1,cost:0,group:'souvenir',souvenir:true})));
export const GARDEN_BY_ID=Object.fromEntries(GARDEN_ITEMS.map(x=>[x.id,x]));
export const gardenGround = p => GARDEN_BY_ID[p?.type]?.group==='ground';
export const gardenType = id => GARDEN_BY_ID[String(id).replace(/^garden:/,'')];
export const freshGarden = (seed=0) => ({version:1,revision:0,serial:0,cleared:[],plants:[],stored:{},parcels:[],naturalSeed:Math.floor(seed)>>>0,naturalSeeds:{},terrain:{}});
export function gardenMissing(s){
 if(s.counts?.V20)return [];
 const missing=[];
 if((s.play||0)<900)missing.push('前台游玩满 15 分钟');
 if(Object.keys(s.placements||{}).length<12)missing.push('建成 12 座实体设施');
 if((s.chunks?.overworld?.length||0)<4)missing.push('主世界扩至 4 片土地');
 return missing;
}
export const gardenDiscovered=s=>!!s.counts?.V20||!gardenMissing(s).length;
export function gardenItemReason(s,id){
 const i=GARDEN_BY_ID[id];if(!i)return '没有这种布景';
 if(i.souvenir&&!(s.garden?.stored?.[id]>0))return s.communityStories?.claimed?.includes(id)?'已经摆放，可到整理中搬动或收回':'到纪念景物领取';
 if((s.counts?.V20||0)<i.level)return `园艺台达到 ${i.level} 级后解锁`;
 if(i.requires&&!s.counts[i.requires])return i.requires==='N1'?'先打开下界门':'先建成末地传送门';
 return '';
}
export function naturalPatches(s,realm){
 if(realm!=='overworld')return [];
 return (s.garden?.parcels||[]).flatMap(key=>{
  const [r,x,z]=key.split(':');if(r!==realm)return [];
  if(Number.isInteger(s.garden.naturalSeeds?.[key]))return [];
  return [[-.9,1.9,'wildflowers'],[-1.8,-1.8,'grass']].map(([dx,dz,type],j)=>({id:`patch:${key}:${j}`,kind:'garden',type,x:+x*5+dx,z:+z*5+dz,realm,w:.5,d:.5,rotation:0,native:true}));
 });
}
