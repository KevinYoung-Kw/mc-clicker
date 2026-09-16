// Planning inventory only. Never imported by the game or used as live unlock rules.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {catalog as C, upgrades as U, research as R, game as G} from '../docs/v2.0.0/simulation/life-engine-alpha2-medium.mjs';
const phases = {
 P0:{name:'开局 0–5',ids:'T1 T7 V1 V2 V18 X1'},
 P1:{name:'村民工作 5–15',ids:'T2 T3 V3 V4 M1 M4 M5 M6 L1'},
 P2:{name:'村庄经营 15–25',ids:'T4 V5 V6 V7 V8 V9 V10 V11 V12 V14 V17 V19 V20 V21 V22 V24 V25 M2 X2 X3 X4 X5'},
 P3:{name:'工业入门 25–35',ids:'M3 M7 M8 M9 M11 V15'},
 P4:{name:'工业发展 35–45',ids:'M10 M12 M13 M14 M16 M17 M18 M19 M20 V16'},
 P5:{name:'现代/下界准备 45–60',ids:'T5 T8 T9 T10 T11 M15 L2 L3 L4 L5 L6 L7 L8 L9 L10 L12 L13 V23 X6 X7 N1'},
 later:{name:'下界/末地以后',ids:'T6 V13 L11 L14 X8'},
};
const phaseOf={};
for(const [key,p]of Object.entries(phases))for(const id of p.ids.split(' ')){assert.ok(C.ITEMS[id],id);assert.ok(!phaseOf[id],id);phaseOf[id]=key;}
const notes={
 V12:'第一层村庄；第二层工业；第三层现代；后续保留 N4/N11/E8 前置。新候选改为递减收益并移除集市吞吐量叠加，见联合续排。',
 V15:'首次购买要求工业技术；保留原设施前置与旧档已购资格，前期由村民/手推车搬运。',
 V16:'首次购买要求工业技术；保留原设施前置与既有能力，不设置分钟解锁。',
 V13:'保留现有下界/末地/世界工程的逐级门槛。',
 M2:'村庄阶段保留基础加工；高阶炉膛、鼓风和成套工业在后续推荐。',
 M4:'基础物流入口早给；容量/装卸升级随积压推荐，不强迫先买铁路。',
 M5:'基础接电免费说明早给；完整自动控制后来开放。',
 M3:'工业入门候选；不能把它锁在漏斗后形成循环。',
 M8:'所有工业路线都须能发现的基础收取；遗漏会导致名义产能无法变成收入。',
 M9:'首台工业机器；本体与后续改造分批理解，不能升级只增原料积压。',
 M16:'动力运输分支；先村民/手推车，再矿车。',
 M17:'动力运输分支，保留漏斗和铁路的实际前置。',
 M15:'现代实际建设成果，用于用电增长与出发准备。',
 L1:'保留早期演出、岗位和声音解锁；不随直播间一起后移。',
 L2:'现代可选经营；研究/房间/设备作为整套投资校准。',
 L9:'保留真实观众前置；不能只用现金瞬间买满整条直播支线。',
 V21:'可先建小园；此时间只是推荐窗口，不撤回已有可买资格。',
 V25:'全村供餐；比较有上下限的费用、短休与品质收益。升级服务更多人口，不以空容量冒充当前收益。',
 V24:'两人配车到三人配车，仍用现有搬运岗位。',
 V19:'纯观赏，不列主线前置，避免首位村民时同时推荐。',
 V20:'自愿布置需求出现时推荐，保留已解锁可购买入口。',
 N1:'现代准备完成后建设；不额外加入只开放门的高额研究费。',
};
const stageTech={M3:'工业入门',M8:'工业入门',M9:'工业入门',M16:'动力运输',M17:'动力运输',M10:'自动控制',M12:'自动控制',M13:'自动控制',M14:'自动控制',M20:'自动控制',M15:'现代技术',V23:'现代生活',L2:'广播经营',N1:'现代准备'};
const s=G.fresh(0), main=C.CATALOG.filter(i=>/^[TVMLX]/.test(i.id)||i.id==='N1');
assert.equal(Object.keys(phaseOf).length,main.length);
const data=main.map(i=>({id:i.id,name:i.name,basePrice:i.cost,max:i.max===Infinity?'不限':i.max,currentDependencies:i.deps,currentLevelGate:i.gate,currentResearch:R.researchForItem(s,i.id),proposedStage:phaseOf[i.id],proposedChapter:stageTech[i.id]||null,note:notes[i.id]|| (i.family==='X'?'可选收藏。推荐后移不等于把已解锁内容隐藏或加主线门槛。':'保留原有效前置；按使用需求逐步推荐后续升级。')}));
const mods=U.UPGRADE_CATALOG.map(i=>({id:i.id,owner:i.owner,name:i.name,price:i.basePrice,max:i.maxLevel,ownerLevels:i.ownerLevels||[1],dependencies:i.dependencies,effects:i.effects,energy:i.energy,proposedStage:/^[NEZ]/.test(i.owner)||i.dependencies.some(d=>/^[NEZ]\d+$/.test(d)&&d!=='N1')?'later':phaseOf[i.owner]||'later'}));
const safe=x=>String(x??'—').replaceAll('|','／');
let md='# 现有内容接力表\n\n生成自 Alpha.2 冻结目录，覆盖全部主世界 T/V/M/L/X 商品和下界门，以及全部专项改造。**这是策划分类，不是已生效的时间锁或价格修改。** 分钟为预计理解窗口；可选装饰后移指推荐，不撤销可买资格。实际村庄、住房、技能、布景等内页子目录见文末。\n\n';
md+='[整体方案](MAIN-WORLD-REPLAN.md) · [生活与电力联合候选](LIFE-POWER-CANDIDATE.md) · [机器可读表](CONTENT-RELAY.json)\n\n';
for(const [key,p]of Object.entries(phases)){
 md+=`## ${p.name}\n\n| ID | 现有内容 | 当前基础价 | 当前购买前置 | 拟归属/处理 |\n|---|---|---:|---|---|\n`;
 for(const i of data.filter(i=>i.proposedStage===key)){
  const deps=[...i.currentDependencies,...i.currentResearch.map(t=>'研究:'+t),i.currentLevelGate?JSON.stringify(i.currentLevelGate):''].filter(Boolean).join('；')||'无';
  md+=`| ${i.id} | ${i.name} | ${i.basePrice.toLocaleString('en-US')} | ${safe(deps)} | ${i.proposedChapter?i.proposedChapter+'；':''}${i.note} |\n`;
 }
 md+='\n';
}
md+='## 专项改造：全部保留，随所属设施分阶段理解\n\n以下“阶段”是最早讨论窗口；**仍需满足表中的本体等级、专项依赖和资金**，不表示到达时代即全部购买。价格仍是 Alpha.2 当前数据。对产能的名义加成不等同实际成交收益。\n\n| ID | 改造 | 设施 | 最早窗口 | 本体等级/依赖 | 基础价 |\n|---|---|---|---|---|---:|\n';
for(const i of mods)md+=`| ${i.id} | ${i.name} | ${C.ITEMS[i.owner]?.name||i.owner} | ${phases[i.proposedStage].name} | Lv.${i.ownerLevels.join('/')}；${safe(i.dependencies.join('、'))} | ${i.price.toLocaleString('en-US')} |\n`;
md+='\n## 不额外扩建系统的内容归属\n\n| 现有子系统 | 编排方式 | 权威数据/入口 |\n|---|---|---|\n| 免费首屋、住宅与房型 | 首位村民获得住宅，随人口/原设施解锁房型；不先要求买满住房 | `housing-data.js` / `housing.js` |\n| 招募、岗位与个人技能 | 首次工作早给；比较技能和培训放在村庄经营后；不是同时弹出全部岗位 | `residents.js` / `resident-jobs-ui.js` |\n| 唱片收藏与演出 | 保留 L1，声音门槛和演出收益分开；不随现代直播后移 | `records.js` / `records-ui.js` |\n| 装扮、园艺、天气 | 可选的中期自发需求；原已购资格和层级保留；不填主线时长 | `garden-data.js` / `web-catalog.js` / `environment.js` |\n| 通知与目标追踪 | 开局保留；后续按真实进度与缺口介绍，不发过时建议 | `narrative.js` / `narrator-copy.js` |\n| 奖励信与邮政 | 继续保留；不恢复已取消的教学邮箱 | `mail.js` / `mail-content.js` |\n| 科研暂停/切换 | 复用现有投入与进度；即时时代入口不打断可选在研项目 | `research.js` |\n| 生活分点与福利 | 先验证原服务是否有用，再校价；24 人上限不变 | `civic-data.js` / `civic-sites.js` / `villager-life.js` |\n\n明细以 `CONTENT-RELAY.json` 与冻结引擎为准；后续实现需要重新核对 live 源码。此清单不把“现有”写成“全部已通过游戏性验收”。\n';
const out=new URL('../docs/v2.0.0/',import.meta.url);
fs.writeFileSync(new URL('CONTENT-RELAY.json',out),JSON.stringify({status:'proposal-not-runtime',source:'simulation/life-engine-alpha2-medium.mjs',phases,data,mods},null,2)+'\n');
fs.writeFileSync(new URL('CONTENT-RELAY.md',out),md);
console.log(JSON.stringify({mainItems:data.length,allDedicatedUpgrades:mods.length}));
