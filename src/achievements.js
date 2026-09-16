// One definition owns the condition, progress and explanation. No economy writes.
import { CATALOG } from './catalog.js';
import { atlasCount, atlasProgress } from './atlas-progress.js';
import { ownershipState } from './facility-storage.js';
import { HOME_BY_ID } from './housing-data.js';
import { GARDEN_BY_ID } from './garden-data.js';
import { farmLocations } from './farm-sites.js';

const count = (s, id) => s.counts?.[id] || 0;
const people = s => (s.community?.residents || []).filter(r => !r.reserve);
const homes = s => s.housing?.homes || [];
const plants = s => s.garden?.plants || [];
const unique = values => new Set(values).size;
const item = (id, name, target, group, symbol, description, flavor = '') =>
  ({id, name, group, symbol, description, flavor, target, total:1, value:s=>Math.min(1,count(s,target))});
const score = (id, name, group, symbol, description, total, value, extra = {}) =>
  ({id, name, group, symbol, description, total, value, ...extra});
export const ACHIEVEMENT_GROUPS = [['all','全部'],['journey','成长'],['work','经营'],['collection','收藏'],['challenge','挑战']];

// Historical IDs and conditions stay stable. New achievements append to this list.
export const ACHIEVEMENT_DEFS = [
  score('first','万物第一块','journey','hand','完成第一次采集。',1,s=>Math.min(1,s.clicks||0),{flavor:'这块地终于不是静态壁纸了。'}),
  item('colleague','终于有同事','V2','journey','person','招募第一位村民。'),
  score('land','大陆在生长','journey','cube','在主世界累计购买 3 次土地。',3,s=>count(s,'V1'),{target:'V1'}),
  item('farm','麦田的风','V4','journey','wheat','建成第一块麦田。'),
  item('automatic','放下双手','M8','journey','gear','安装漏斗，让货物自动收取。'),
  item('rail','通向远方','M17','journey','circuit','建成自动装卸站。'),
  item('live','我们开播了','L2','journey','camera','建成广播与直播间。'),
  score('audience','一千双眼睛','work','camera','直播间历史最高观众达到 1,000。',1000,s=>s.live?.peak||0,{target:'L2'}),
  item('nether','另一种天空','N1','journey','cube','建成下界传送门。'),
  item('end','世界之外','E2','journey','spark','建成末地传送门。'),
  item('dragon','龙也来上班','E9','journey','person','解锁末影龙。'),
  score('wealth','亿点可能','work','bag','累计赚取 100M 绿宝石，不要求存在余额里。',1e8,s=>s.total||0),
  item('master','整个世界听我说','Z1','journey','bolt','安装命令方块。'),
  score('collector','还有这么多惊喜','collection','book','拥有至少 70 种商品，等级不重复计数。',70,s=>Object.values(s.counts||{}).filter(Boolean).length,{target:'X1'}),
  item('universe','种下小宇宙','E11','journey','leaf','解锁维度盆栽。'),
  score('complete','从一块到万物','journey','spark','完成世界工程，达成主线结局。',1,s=>+!!s.completed,{target:'Z3'}),
  score('many-hands','各显神通','work','person','同时安排 4 种不同岗位，每位代表至少完成过一次工作。',4,s=>unique(people(s).filter(r=>r.job!=='idle'&&r.jobsDone>0).map(r=>r.job)),{target:'V2',flavor:'终于不是一个人开四个会了。'}),
  score('first-delivery','送到才算数','work','box','让一位村民完成一次实际交货。',1,s=>+people(s).some(r=>r.lastDelivery?.qty>0),{target:'M4',flavor:'包裹上的「已送达」，这次是真的。'}),
  score('postal-care','小邮局，大事业','work','mail','把邮政升到 3 级。',3,s=>count(s,'V18')?s.mail?.postalLevel||1:0,{target:'V18'}),
  score('orders-five','熟客生意','work','bag','完成 5 份订单。',5,s=>s.ordersCompleted||0,{target:'V3'}),
  score('small-homes','平房也住得下','challenge','home','至少 6 位在村居民，全部住进基础村屋。只计原木村屋、橡木尖顶屋和石炉矮屋。',s=>Math.max(6,people(s).length),s=>people(s).filter(r=>{const h=homes(s).find(h=>h.id===s.housing?.assignments?.[r.id]?.homeId);return ['cottage','oak','hearth'].includes(h?.type);}).length,{destination:'housing',flavor:'楼不高，门牌倒是不少。可以搬家补做，不限制其他设施等级。'}),
  score('home-variety','拒绝复制粘贴','collection','home','同时摆放 4 种不同房型。',4,s=>unique(homes(s).filter(h=>HOME_BY_ID[h.type]&&h.type!=='legacy').map(h=>h.type)),{destination:'housing',flavor:'邮递员现在得认真看门牌了。'}),
  score('three-farms','这回各有各的田','challenge','wheat','建好 3 块麦田，让 3 位农民各负责一块。',3,s=>{const sites=new Set(farmLocations(s,'V4').map(p=>p.id));return unique(people(s).filter(r=>r.job==='farmer'&&sites.has(r.farmSiteId)).map(r=>r.farmSiteId));},{target:'V4',flavor:'谁再说三个人围着一块田，这次可有地契。'}),
  score('garden-eight','私人植物园','collection','leaf','同时摆放 8 种花草林木或奇景；地皮与纪念景物不计。',8,s=>unique(plants(s).filter(p=>{const i=GARDEN_BY_ID[p.type];return i&&!['ground','souvenir'].includes(i.group);}).map(p=>p.type)),{target:'V20'}),
  score('three-world-garden','我们是怎么种到这的？','challenge','leaf','在主世界同时种下橡树、绯红菌丛和紫颂小景。',3,s=>unique(plants(s).filter(p=>p.realm==='overworld'&&['oak','crimson','chorus'].includes(p.type)).map(p=>p.type)),{target:'V20',flavor:'三个世界的植物，在你家门口开了个会。'}),
  score('hot-meal','今天换个口味','work','bowl','让一位村民真正吃到菌菇炖汤或麦香烤肉，光选菜单不算。',1,s=>+Object.values(s.life?.menuState?.people||{}).some(p=>p.serving?.some(b=>['mushroom','roast'].includes(b.id)&&b.qty>0)),{target:'V25',flavor:'意见箱里那张「天天吃一样的」可以取下来了。'}),
  score('local-brewery','本地酿造厂','challenge','bowl','酒馆供应麦芽酒，并实际支付一次服务费用。',1,s=>+(people(s).length>0&&s.life?.serviceMode==='current'&&s.life?.menuState?.paid?.drink==='ale'&&s.life?.menuState?.spent>0),{target:'V22',flavor:'致敬一下酿造。酒后慢一点，是村民自己的选择。'}),
  score('flags','旗帜鲜明','collection','goal','收集齐三面村旗，装备哪面都算。',3,s=>atlasProgress(s,'X6').complete?3:atlasProgress(s,'X6').collected||0,{target:'X6'}),
  score('all-buildings','这下真的买齐了','collection','book','完成建设图鉴全部条目；合集按收藏计算，不要求设施满级。',CATALOG.length,s=>atlasCount(s),{target:'X1',flavor:'商城还有升级可卖，但不能再说你没买齐了。'}),
];
ACHIEVEMENT_DEFS.push(score('all-achievements','一项也没落下','collection','spark','集齐这一版其他所有成就。',ACHIEVEMENT_DEFS.length,s=>ACHIEVEMENT_DEFS.filter(a=>a.id!=='all-achievements'&&s.achievements?.includes(a.id)).length,{flavor:'本册收齐。世界照常营业。'}));
export const ACHIEVEMENT_BY_ID = Object.fromEntries(ACHIEVEMENT_DEFS.map(a=>[a.id,a]));
export function achievementProgress(state, achievement) {
  const s=ownershipState(state), a=typeof achievement==='string'?ACHIEVEMENT_BY_ID[achievement]:achievement;
  const total=typeof a.total==='function'?a.total(s):a.total;
  const value=Math.max(0,Math.min(total,Number(a.value(s))||0));
  return {value,total,complete:value>=total,earned:s.achievements?.includes(a.id)===true};
}
export const ACHIEVEMENTS = ACHIEVEMENT_DEFS.map(a=>[a.id,a.name,s=>achievementProgress(s,a).complete]);
export function restoreAchievements(s,raw) {
  s.achievements=[...new Set((Array.isArray(raw.achievements)?raw.achievements:[]).filter(id=>typeof id==='string'&&Object.prototype.hasOwnProperty.call(ACHIEVEMENT_BY_ID,id)))];
}
