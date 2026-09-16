import {atlasCount} from './atlas-progress.js';
import {CATALOG} from './catalog.js';
import {accessible,formatWallet} from './game.js';
import {COMMUNITY_COPY} from './community-souvenirs-data.js';

// Read-only projections of an existing save. No invented dates, rankings or personality scores.
export const SHARE_STORIES = [
 {id:'receipt',name:'数据小票',hint:'看看这局都攒下了什么'},
 {id:'world',name:'世界明信片',hint:'给现在的世界拍张照'},
 {id:'passport',name:'冒险护照',hint:'给走到的世界盖个章'},
 {id:'profile',name:'经营名片',hint:'这局靠什么发家'},
 {id:'moment',name:'本局名场面',hint:'把遇到的趣事留下来'},
];
const number=v=>Number.isFinite(v)?Math.max(0,v):0;
const count=v=>Math.floor(number(v));
export const playTime=seconds=>{const m=Math.floor(number(seconds)/60);return m>=60?`${Math.floor(m/60)} 小时 ${m%60} 分`:`${m} 分 ${Math.floor(number(seconds)%60)} 秒`;};
export function shareStoryData(s){
 const owned=id=>number(s.counts?.[id])>0,unlocked=atlasCount(s);
 const income=[['采集',number(s.manualIncome)],['生产与工作',number(s.productionIncome)],['直播',number(s.liveIncome)],['邮政',number(s.postalIncome)],['奖励等',number(s.mailIncome)+number(s.easterEggIncome)+number(s.offlineIncome)]];
 const recorded=income.reduce((n,row)=>n+row[1],0);
 income[4][1]+=Math.max(0,number(s.total)-recorded);
 const total=income.reduce((n,row)=>n+row[1],0),rank=income.map(([name,value],i)=>({name,value,i,fraction:total?value/total:0})).sort((a,b)=>b.value-a.value);
 const early=total===0||unlocked<4,lead=rank[0];
 const profiles=[['靠手吃饭','这片天，是一点一点点出来的。'],['实业派村长','最理想的工作，是看着别人工作。'],['村里的带货王','开局一块地，现在靠观众养活。'],['邮政储蓄户','别人等快递，我等绿宝石。'],['好运收藏家','意外之财，也是财。']];
 const [title,quip]=early?['刚来这块地','先点两下，看看会长出什么。']:lead.fraction<.55?['多线经营','钱从哪来不重要。最好从各处都来。']:profiles[lead.i];
 const sceneRows=[];
 const seen=new Set(s.narrative?.seen||[]),communityTitles={'community-cash':'有钱，提不出来','community-hold':'手指才是生产力','community-tree':'这棵树有自己的想法','community-mansion':'旁白的豪宅没了','community-overtime':'通关了，还没下班','community-pond':'建议已进入需求池','community-stage':'有梦你就来'};
 for(const [id,sceneTitle]of Object.entries(communityTitles))if(seen.has(id))sceneRows.push({id,title:sceneTitle,lines:COMMUNITY_COPY[id].slice(0,2),evidence:'这段旁白，你已经听过了。',face:'smirk'});
 if(s.easterEggs?.entries?.['after-hours']?.status==='claimed')sceneRows.push({id:'date',title:'公费约会，领结归我',lines:['旁白借了 520 颗绿宝石，出去见了一趟对象。','对象的事没说清楚，领结倒是带回来了。'],evidence:'已获得「约会领结」',face:'bow'});
 if(s.easterEggs?.entries?.['private-stash']?.status==='claimed')sceneRows.push({id:'stash',title:'破案了，真有私房钱',lines:['旁白说藏了一笔钱。','我去找了。还真有。'],evidence:'本局已找到私房钱',face:'smirk'});
 if(s.completed)sceneRows.push({id:'complete',title:'通关了。然后呢？',lines:['世界工程做完了。','回头一看，这儿还有块空地。'],evidence:'已完成世界工程',face:'smile'});
 if(owned('L2')&&number(s.live?.peak)>0)sceneRows.push({id:'live',title:'把村子播出去了',lines:['以前是我看村民上班。','现在还有观众陪我一起看。'],evidence:`直播最高观众 ${formatWallet(number(s.live?.peak))}`,face:'smirk'});
 if(owned('V2'))sceneRows.push({id:'villager',title:'街溜子报到',lines:['看，来了个街溜子。','地倒是不缺，得给他找点活儿。'],evidence:`村里现在有 ${count(s.community?.residents?.length||s.counts.V2)} 位居民`,face:'smile'});
 sceneRows.push({id:'start',title:owned('V1')?'草皮终于变大了':'事情从一块草皮开始',lines:owned('V1')?['本来只是想多买块地。','现在开始琢磨邻居住哪儿了。']:['说好只点两下。','先把这块草皮点明白。'],evidence:`本局采集 ${formatWallet(count(s.clicks))} 次`,face:'smile'});
 return {play:playTime(s.play),clicks:formatWallet(count(s.clicks)),total:formatWallet(number(s.total)),wallet:formatWallet(number(s.money)),unlocked,catalog:CATALOG.length,
  residents:count(s.community?.residents?.length||s.counts?.V2),homes:s.housing?.homes?.length||0,orders:count(s.ordersCompleted),modifications:Object.values(s.upgrades?.levels||{}).reduce((n,v)=>n+count(v),0),
  lands:Object.keys(s.chunks||{}).filter(realm=>accessible(s,realm)).reduce((n,realm)=>n+(s.chunks[realm]?.length||0),0),
  income:income.map(([name,value])=>({name,value:formatWallet(value),fraction:total?value/total:0})),profile:{title,quip,basis:early?'这局才刚刚开始，暂不判断经营偏好。':`按本局累计入账，${lead.name}占 ${Math.round(lead.fraction*100)}%。`},
  worlds:[['overworld','主世界','从第一块草皮，到一个村庄。'],['nether','下界','门的另一边，生意也继续。'],['end','末地','走这么远，还是惦记着盖点东西。']].map(([realm,name,caption])=>({realm,name,caption,reached:accessible(s,realm),lands:accessible(s,realm)?s.chunks?.[realm]?.length||0:0})),
  chapters:[['村庄落成',owned('V2')],['工业起步',!!s.research?.completed?.industrial||owned('M8')],['进入现代',!!s.research?.completed?.modern||owned('L2')],['世界工程',!!s.completed]],moments:sceneRows};
}
