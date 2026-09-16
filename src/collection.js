import { WEB_BY_ID } from './web-catalog.js';
import { buyWeb, equipWeb, resetWeb } from './presentation.js';
import { environmentEnabled, environmentPhase, environmentWeather, advanceEnvironment, ENV_LEGACY, setEnvironment } from './environment.js';
// Optional collections use the same emerald wallet, with fixed prices and explicit ownership.
export const COLLECTION_CATEGORIES = {
  title: "标题牌",
  icon: "页签徽记",
  cursor: "指针",
  frame: "界面边框",
  share: "分享特效",
  flag: "村旗",
  sky: "天空",
  studio: "演播室布置",
  world: "世界趣事",
};
const rows = [];
function variants(category, names, prices, colors, extra = {}) {
  names.forEach((name, index) =>
    rows.push({
      id: `${category}-${index}`,
      category: category.startsWith("studio") ? "studio" : category,
      slot: category,
      name,
      cost: prices[index],
      color: colors[index],
      index,
      ...extra,
    }),
  );
}
variants(
  "title",
  ["橡木告示牌", "红石开工牌", "末地探险牌"],
  [350, 1400, 12000],
  ["#a97a47", "#b75945", "#8574ad"],
);
variants(
  "icon",
  ["绿宝石徽记", "红石火花", "末影之眼"],
  [280, 900, 8500],
  ["#82ac61", "#d2604b", "#8d79af"],
);
variants(
  "cursor",
  ["铁镐指针", "钻石镐指针", "附魔镐指针"],
  [500, 2400, 18000],
  ["#b6bfc0", "#5eafb1", "#a080c7"],
);
variants(
  "frame",
  ["橡木工作台", "铜制电路框", "黑曜石边框"],
  [650, 2600, 22000],
  ["#94704a", "#ae7858", "#625278"],
);
variants(
  "share",
  ["绿宝石礼花", "红石信号波", "末地传送碎片"],
  [450, 1800, 16000],
  ["#8aa66d", "#c76348", "#9881b3"],
);
variants(
  "flag",
  ["村庄麦穗旗", "工厂齿纹旗", "末地龙翼旗"],
  [400, 1600, 10000],
  ["#739777", "#cf9868", "#a29abe"],
  { requires: ["L2"] },
);
variants(
  "sky",
  ["薄荷清晨", "蜂蜜落日", "末影星夜"],
  [900, 3800, 24000],
  ["#afcbb9", "#dfb984", "#777797"],
);
variants(
  "studioDesk",
  ["橡木导播桌", "铜制调音台"],
  [1500, 8000],
  ["#a98252", "#b07b52"],
  { requires: ["L2"] },
);
variants(
  "studioWall",
  ["苔藓唱片墙", "紫晶声学墙"],
  [1200, 9000],
  ["#709176", "#8e79a1"],
  { requires: ["L2"] },
);
variants(
  "studioSign",
  ["红石 ON AIR", "钻石频道灯牌"],
  [2200, 11000],
  ["#c5604f", "#72b9b9"],
  { requires: ["L2"] },
);
variants(
  "studioShelf",
  ["村民收藏架", "异界标本架"],
  [2600, 18000],
  ["#b89359", "#87759b"],
  { requires: ["L2"] },
);
rows.push(
  {
    id: "world-day",
    category: "world",
    name: "日晷",
    cost: 1800,
    color: "#d5b670",
    desc: "昼夜循环：8 分钟，可手动调节时间。",
  },
  {
    id: "world-weather",
    category: "world",
    name: "气象台",
    cost: 4800,
    color: "#87a6ac",
    desc: "晴天、自动天气与手动控制；雨雪分别购买。",
  },
  {
    id: "world-rain",
    category: "world",
    name: "雨幕",
    cost: 2200,
    color: "#78a7bc",
    requires: ["world-weather"],
    desc: "方块雨线、阴天光照，雨景也能成为直播节目。",
  },
  {
    id: "world-snow",
    category: "world",
    name: "初雪",
    cost: 9000,
    color: "#b4c8d2",
    requires: ["world-weather"],
    desc: "方形雪片与冷色天光，不影响基础生产。",
  },
  {
    id: "world-fireflies",
    category: "world",
    name: "萤火瓶",
    cost: 15000,
    color: "#cad084",
    requires: ["world-day"],
    desc: "夜间出现萤火，解锁观景记录。",
  },
  {
    id: "world-meteor",
    category: "world",
    name: "流星观测",
    cost: 150000,
    color: "#b1a0c5",
    requires: ["world-day"],
    desc: "每在线 6 分钟出现流星雨，解锁节目与观景记录。",
  },
);
export const COLLECTION = [
  {
    id: "stall",
    category: "world",
    name: "装扮摊",
    node: "X2",
    cost: 250,
    color: "#9b967a",
  },
  ...rows,
  {
    id: "garden",
    category: "world",
    name: "园林灯饰",
    node: "X7",
    cost: 900,
    color: "#b1be7a",
  },
];
export const COLLECTION_BY_ID = Object.fromEntries(
  COLLECTION.map((i) => [i.id, i]),
);
export const CROPS = [
  {
    id: "wheat",
    name: "小麦",
    cost: 0,
    seconds: 40,
    reward: 1,
    color: "#ddbc68",
    desc: "成熟最快，适合经常回来收。",
  },
  {
    id: "carrot",
    name: "胡萝卜",
    cost: 750,
    seconds: 55,
    reward: 1.5,
    color: "#e18d4e",
    desc: "比小麦长得慢一点，每次收获更多。",
  },
  {
    id: "potato",
    name: "马铃薯",
    cost: 1800,
    seconds: 75,
    reward: 2.1,
    color: "#b5a06c",
    desc: "比胡萝卜长得慢，每次收获也更多。",
  },
  {
    id: "beet",
    name: "甜菜根",
    cost: 4800,
    seconds: 100,
    reward: 3,
    color: "#b45864",
    desc: "等得更久，单次收成比马铃薯高。",
  },
  {
    id: "pumpkin",
    name: "南瓜",
    cost: 14000,
    seconds: 140,
    reward: 4.4,
    color: "#d28d42",
    desc: "成熟最慢，单次收成最多。长成后是一颗方块南瓜。",
  },
];
export const freshCollection = () => ({
  version: 2,
  owned: {},
  equipped: {},
  disabled: {},
});
export const freshAtmosphere = () => ({
  clock: 0,
  cycle: true,
  phase: 0.3,
  weather: "clear",
  auto: false,
  seen: [],
  mark: 0,
});
export const hasExtra = (s,id) => !!(COLLECTION_BY_ID[id]?.node ? s.counts[COLLECTION_BY_ID[id].node] : ENV_LEGACY[id] ? s.environment?.modules[ENV_LEGACY[id]] : s.scenery?.owned[id]);
export function extraEnabled(s,id) {
  if(ENV_LEGACY[id]) return environmentEnabled(s,ENV_LEGACY[id]) && (!['world-fireflies','world-meteor'].includes(id) || s.environment.enabled[id.slice(6)]===true);
  const item=COLLECTION_BY_ID[id];
  if(!item || !hasExtra(s,id))return false;
  return item.slot ? s.scenery.equipped[item.slot]===id : s.scenery.disabled[id]!==true;
}
export function setExtraEnabled(s,id,enabled) {
  if(ENV_LEGACY[id])return setEnvironment(s,{toggle:ENV_LEGACY[id],value:enabled});
  if(!hasExtra(s,id))return false;
  s.scenery.disabled[id]=!enabled;return true;
}
export function resetAllExtras(s) { return resetWeb(s); }
export const shopAvailable = (s) =>
  !!s.counts.V3 ||
  Object.keys(s.counts).some(
    (id) => id.startsWith("X") && id !== "X1" && s.counts[id],
  );
export function collectionNeeds(s, item) {
  if (!item) return ["未知商品"];
  const needs = [];
  if (item.id === "stall") {
    if (!s.counts.V3) needs.push("集市");
    return needs;
  }
  if (!s.counts.X2 && !["studio", "flag"].includes(item.category))
    needs.push("装扮摊");
  for (const id of item.requires || [])
    if (!(s.counts[id] || hasExtra(s, id)))
      needs.push(COLLECTION_BY_ID[id]?.name || "直播工作台");
  if (item.id === "garden" && !s.counts.M19) needs.push("红石灯");
  return needs;
}
const legacy = { title: "X3", icon: "X4", cursor: "X5", flag: "X6", sky: "X8" };
export function syncCollection(s) {
  s.cosmetics.flag=COLLECTION_BY_ID[s.scenery?.equipped.flag]?.index??0;
}
export function equipExtra(s,id) {
  if(WEB_BY_ID[id])return equipWeb(s,id);
  const item=COLLECTION_BY_ID[id];
  if(!item?.slot || !hasExtra(s,id) || !['flag','studio'].includes(item.category))return false;
  s.scenery.equipped[item.slot]=id;syncCollection(s);return true;
}
export function resetExtra(s,slot) {
  if(!slot.startsWith('studio')&&slot!=='flag')return resetWeb(s,slot);
  delete s.scenery.equipped[slot];syncCollection(s);return true;
}
export function resetScenery(s,scope) {
  for(const slot of Object.keys(s.scenery.equipped))if(scope==='studio'?slot.startsWith('studio'):slot==='flag')delete s.scenery.equipped[slot];
  if(scope==='outdoor'&&s.counts.X7)s.scenery.disabled.garden=true;
  syncCollection(s);
}
export function buyExtra(s,id,nodeBuyer) {
  if(WEB_BY_ID[id])return buyWeb(s,id);
  const item=COLLECTION_BY_ID[id];
  if(!item || !['studio','flag'].includes(item.category)&&!item.node)return {ok:false,reason:'请前往装扮商店或观象台'};
  const needs=collectionNeeds(s,item);
  if(needs.length)return {ok:false,reason:'需要 '+needs.join('、')};
  if(item.node)return nodeBuyer?nodeBuyer(item.node):{ok:false,reason:'请选择建造位置'};
  if(hasExtra(s,id))return {ok:false,reason:'已经收藏'};
  if(s.money<item.cost)return {ok:false,reason:'绿宝石还不够'};
  s.money-=item.cost;s.scenery.owned[id]=true;delete s.scenery.disabled[id];
  if(item.slot)equipExtra(s,id);
  return {ok:true,first:true,cost:item.cost};
}
export function buyCrop(s, id) {
  const crop = CROPS.find((i) => i.id === id);
  if (!crop || !s.counts.V4 || s.crops.owned[id] || s.money < crop.cost)
    return false;
  s.money -= crop.cost;
  s.crops.owned[id] = true;
  return true;
}
export function selectCrop(s, id) {
  if (!s.counts.V4 || !s.crops.owned[id] || !CROPS.some((c) => c.id === id))
    return false;
  if (s.crops.selected !== id) {
    for(const p of s.life?.sites||[])if(p.type==='V4'&&p.production){p.production.harvest.farm=0;p.production.tasks.farm={work:0,cooldown:0,tend:0,bonus:0,manual:false,owners:{},tenders:{},cycle:p.production.tasks.farm?.cycle||0};}
    s.crops.selected = id;
    s.harvest.farm = 0;
    if (s.community?.tasks?.farm) {
      const t = s.community.tasks.farm;
      Object.assign(t, {
        work: 0,
        tend: 0,
        bonus: 0,
        manual: false,
        owners: {},
        tenders: {},
        cycle: t.cycle + 1,
      });
    }
  }
  return true;
}
export const currentCrop = (s) =>
  CROPS.find((c) => c.id === s.crops?.selected) || CROPS[0];
export function restoreCollection(s, raw) {
  const legacyHas=(state,id)=>!!(COLLECTION_BY_ID[id]?.node?state.counts[COLLECTION_BY_ID[id].node]:state.collection.owned[id]);
  s.collection = freshCollection();
  s.atmosphere = freshAtmosphere();
  if ([1, 2].includes(raw.collection?.version)) {
    for (const i of rows)
      if (raw.collection.owned?.[i.id] === true)
        s.collection.owned[i.id] = true;
    for (const [slot, id] of Object.entries(raw.collection.equipped || {}))
      if (COLLECTION_BY_ID[id]?.slot === slot && legacyHas(s, id))
        s.collection.equipped[slot] = id;
    for (const item of COLLECTION)
      if (
        item.category === "world" &&
        legacyHas(s, item.id) &&
        raw.collection.disabled?.[item.id] === true
      )
        s.collection.disabled[item.id] = true;
  } else {
    for (const [slot, node] of Object.entries(legacy))
      if (s.counts[node]) {
        for (const i of rows.filter((i) => i.slot === slot))
          s.collection.owned[i.id] = true;
        if (slot !== "cursor" || raw.cosmetics?.cursor !== false)
          s.collection.equipped[slot] =
            `${slot}-${slot === "cursor" ? 0 : s.cosmetics[slot] || 0}`;
      }
  }
  const a = raw.atmosphere || {};
  if (Number.isFinite(a.clock) && a.clock >= 0) s.atmosphere.clock = a.clock;
  s.atmosphere.cycle = a.cycle !== false;
  s.atmosphere.phase = Number.isFinite(a.phase)
    ? Math.max(0, Math.min(0.999, a.phase))
    : 0.3;
  s.atmosphere.auto = legacyHas(s, "world-weather") && !!a.auto;
  if (["rain", "snow"].includes(a.weather) && legacyHas(s, "world-" + a.weather))
    s.atmosphere.weather = a.weather;
  const records = ["雨中村庄", "第一场雪", "萤火之夜", "流星时刻"];
  s.atmosphere.seen = records.filter(
    (x) => Array.isArray(a.seen) && a.seen.includes(x),
  );
  s.atmosphere.mark = Math.floor(s.atmosphere.clock / 360);
  s.crops = { selected: "wheat", owned: { wheat: true } };
  for (const c of CROPS)
    if (raw.crops?.owned?.[c.id] === true) s.crops.owned[c.id] = true;
  if (s.crops.owned[raw.crops?.selected]) s.crops.selected = raw.crops.selected;

}
export const dayPhase=environmentPhase;
export const weatherNow=environmentWeather;
export const advanceAtmosphere=advanceEnvironment;
