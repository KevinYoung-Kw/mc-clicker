import {LIFE_SERVICES} from './villager-life.js';
import { ITEMS, CATALOG } from './catalog.js';

export const EARLY_ROUTE = ['T1', 'V1', 'V18', 'V2', 'T7'];
export const firstPurchasePending = s => !s.guidance?.info && !s.narrative?.legacy && !Object.values(s.counts).some(n => n > 0);
export const earlyTarget = s => EARLY_ROUTE.find(id => !s.counts[id]) || null;
export function itemSummary(s, item) {
  const effects = {
    T1: ITEMS.T1.desc,
    V1: `${s.counts.V1 ? '新增一片' : '展开为'} 5×5 地面。新建筑要放在空位上，并留出走路的通道。`,
    V18: ITEMS.V18.desc,
    V2: ITEMS.V2.desc,
    T7: ITEMS.T7.desc,
    L1: ITEMS.L1.desc,
  };
  const next = {T1:'开垦', V1:'邮箱 → 自动收入', V18:'村民、工作台', V2:'工作台、农牧', T7:'石镐、矿区', L1:'广播电台（工业后的广播研究、集市 2 级和红石火把）'};
  if(LIFE_SERVICES[item.id]){
    const spec=LIFE_SERVICES[item.id],level=Math.max(1,s.counts[item.id]||1),comfort=Math.min(15,spec.comfort+2*(level-1));
    effects[item.id]=spec.kind==='food'?item.desc:`全村共享休闲幸福 +${comfort}，不受距离或座位限制。同类效果取最高值，升级提高舒适度。`;
  }
  return { effect: effects[item.id] || item.desc,
    next: next[item.id] || CATALOG.filter(i => i.deps.includes(item.id)).slice(0,2).map(i => i.name).join('、') };
}
export function developmentRoute(s) {
  const stages = [
    {name:'村庄', complete:!!s.counts.V3, text:'先买地、建邮箱，开始自动赚钱；再招募村民，建工作台提高收入。'},
    {name:'工业', complete:!!s.research?.completed.modern, text:'图书馆研究工业技术，开放钻机、铁路和自动化。先安排村民搬货，已有采集、岗位和升级仍能继续推进。'},
    {name:'现代', complete:!!s.counts.N1, text:'工业期可开办广播电台，逐步发展电视与流媒体。现代开放完整演播室和下界建设；不直播也能前往下界。'},
    {name:'下界', complete:!!s.counts.E2, text:'打开下界门，让烈焰人供热、猪灵做生意，再把两个世界的货运连起来。'},
    {name:'末地', complete:!!s.counts.Z1, text:'找到末地入口，嵌入末影之眼开门；建设末地水晶，迎接末影龙。'},
    {name:'世界工程', complete:!!s.completed, text:'让主世界、下界和末地持续交付成品，自动建完工程的三层。'},
  ];
  const current = Math.max(0, stages.findIndex(x => !x.complete));
  return `<section class="development-route" aria-label="世界发展路线"><ol>${stages.map((x,i)=>`<li ${i===current?'aria-current="step"':''}>${x.name}</li>`).join('')}</ol><p>${s.completed?'世界工程已完成。':stages[current].text}</p></section>`;
}

export function nextGuidedTarget(s,order) {
  function missing(id,level=1,seen=new Set()) {
    if((s.counts[id]||0)>=level || seen.has(id))return null;
    const item=ITEMS[id];if(!item)return null;seen.add(id);
    for(const dep of item.deps){const before=missing(dep,1,seen);if(before)return before;}
    if(!s.counts[id]&&item.gate?.id){const before=missing(item.gate.id,item.gate.level,seen);if(before)return before;}
    return id;
  }
  for(const id of order){const next=missing(id);if(next)return next;}
  return null;
}
