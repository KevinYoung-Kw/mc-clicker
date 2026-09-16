import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const dir=new URL('../docs/v2.0.0/simulation/',import.meta.url);
const json=p=>JSON.parse(readFileSync(new URL(p,dir)));
const hash=p=>createHash('sha256').update(readFileSync(new URL(p,dir))).digest('hex');
const routes=['village-life','industrial-first','village-first','livestream-first','no-livestream','low-active'];
const names={'village-life':'生活经营','industrial-first':'工业优先','village-first':'村庄优先','livestream-first':'直播优先','no-livestream':'不直播','low-active':'低频操作'};
const groups=[
 {id:'A',policy:'p6',engines:['flow-joint-golems','flow-joint-book40','flow-joint-life40','flow-joint-life30']},
 {id:'B',policy:'p7',engines:['flow-joint-r2-reprice','flow-joint-r2-quality','flow-joint-r2-book20','flow-joint-r2-focused']},
 {id:'C',policy:'p8',engines:['flow-joint-r2-quality','flow-joint-r2-focused','flow-joint-r3-focused']},
];
const rows=[],inputs=[];
for(const group of groups){
 const base=json(group.engines[0]+'-manifest.json').inputs;let policyHash=null;
 for(const engine of group.engines){
  const manifest=json(engine+'-manifest.json');assert.equal(hash(engine+'.mjs'),manifest.sha256);
  for(const [key,value]of Object.entries(base).filter(([k])=>k.startsWith('src/')))assert.equal(manifest.inputs[key],value,group.id+': base changed '+key);
  for(const route of routes){
   const file=`${engine}-${group.policy}/${route}.json`,r=json(file);
   assert.equal(r.provenance.engineSha256,manifest.sha256);policyHash ||= r.provenance.policySha256;assert.equal(r.provenance.policySha256,policyHash);
   const ordered=r.purchases.slice().sort((a,b)=>a.at-b.at);
   rows.push({group:group.id,engine,policy:group.policy,route,nether:r.milestones.find(m=>m.id==='N1')?.seconds??null,
    industrial:r.purchases.find(p=>p.id==='research:industrial')?.at??null,modern:r.purchases.find(p=>p.id==='research:modern')?.at??null,
    longestPurchaseGap:Math.max(0,...ordered.slice(1).map((p,i)=>p.at-ordered[i].at)),recordedActionGap:r.effectiveActionLongestGap,
    researchOnlySeconds:r.researchOnlySeconds,purchases:r.purchases.length,actualIncome:r.actualIncome,foodExpense:r.foodCare.ingredientCost,
    hungerPersonSeconds:r.foodCare.hungryPersonSeconds,powerActions:r.electricity.decisions.length,deficitSeconds:r.electricity.deficitSeconds,
    spilledShare:r.electricity.spilled/r.electricity.generated});
   inputs.push({file,sha256:hash(file)});
  }
 }
}
const probes=['flow-joint-r2-reprice-joint-probes','flow-joint-r2-quality-joint-probes','flow-joint-r2-quality-modern-probes','flow-joint-r2-focused-modern-probes'].map(id=>({id,...json(id+'.json')}));
const gaps=json('flow-joint-r3-focused-gap-probes.json');
const full=json('flow-joint-r3-focused-full/industrial-first.json');assert.ok(full.completed,'full run failed');
const light=json('flow-joint-r3-focused-light-comparison.json');
const latestManifest=json('flow-joint-r3-focused-manifest.json');
for(const p of [gaps.provenance,light.provenance,full.provenance])assert.equal(p.engineSha256,latestManifest.sha256);
for(const file of ['flow-joint-r3-focused-gap-probes.json','flow-joint-r3-focused-light-comparison.json','flow-joint-r3-focused-full/industrial-first.json',...probes.map(p=>p.id+'.json')])inputs.push({file,sha256:hash(file)});
const m=s=>s===null?'—':`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
let md='# 培训、生活服务与联合流程复盘\n\n2026-09-13。**隔离候选，未发布；规则通过不等于游戏性通过。** [设计与公式](../JOINT-FLOW-REFINEMENT.md) · [机器可读结果](JOINT-SERVICES-RESULTS.json)\n\n';
md+='## 结论\n\n两种傀儡的工业门槛、生活费上下限、递减培训与有限品质收益已做成可运行候选。新增物品仍保持克制，优先解决现有链路和投资关系。本轮没有把“总时长靠近一小时”当作晋级条件。\n\n';
md+='最新候选 R3 去掉 V12 的交易容量乘法，基础每级 +20 个百分点、货值/农牧订单每级 +15 个百分点；使用低开支服务合同和实际品质结算。按最新确认，本轮收窄到生活/不直播两条路线的一次可选既有投资，不强求纯路线等速、等密度。**本轮模拟已完成，可进入适度整合；尚不是可玩版交付或发布。**\n\n';
md+='## 1. 最新完整主世界矩阵\n\n同一冻结底本、同一 P8 策略。P8 会按真实岗位名额填充可用岗位，并在主持岗位开放后安排人；没有注入钱、免费建筑或伪造收益。\n\n| 路线 | 进入工业 | 进入现代 | 进入下界 | 最大购买间隔 | 已记录经营/工作动作间隔 | 伙食累计 | 实际缺电秒 |\n|---|---:|---:|---:|---:|---:|---:|---:|\n';
const latest=rows.filter(r=>r.engine==='flow-joint-r3-focused');
for(const r of latest)md+=`| ${names[r.route]} | ${m(r.industrial)} | ${m(r.modern)} | ${m(r.nether)} | ${m(r.longestPurchaseGap)} | ${m(r.recordedActionGap)} | ${Math.round(r.foodExpense).toLocaleString('en-US')} | ${r.deficitSeconds} |\n`;
md+='\n购买间隔不是“没有东西可点”；动作间隔也不是所有可用机会，未包含重复挖矿。研发纯等待字段仍是 null，表示未完成逐窗口分类。不能把采集一直可点解释成没有发展空档。当前工业/现代仍较早进入，后段内容分布尚未符合 25–35 / 45–60 的设计窗口。\n\n';
md+=`六路线缺餐人秒合计 ${latest.reduce((s,r)=>s+r.hungerPersonSeconds,0)}；溢出电量占比约 ${(Math.min(...latest.map(r=>r.spilledShare))*100).toFixed(1)}%–${(Math.max(...latest.map(r=>r.spilledShare))*100).toFixed(1)}%。补电动作 ${Math.min(...latest.map(r=>r.powerActions))}–${Math.max(...latest.map(r=>r.powerActions))} 次，包含一次扩建中的多次小升级，尚不能直接换算成目标的 2–4 次供电决策。\n\n`;
md+=`## 2. 三轮对照不能混成一张因果表\n\n| 组别 | 对照范围 | 说明 |\n|---|---|---|\n| A：P6，24 条 | 傀儡门槛 → 书本加法 0.4 → 高开支生活 → 加法 0.3 | 同一原始源码，保持旧策略 |
| B：P7，24 条 | 低开支 → 品质 → 基础加法 0.2 → 同时减少货值/移除交易加成 | 冻结 R2 底本，补非清单首购和满级技能筛选 |
| C：P8，18 条 | 品质 → 集中培训 → 补齐农牧订单同口径 | 同一底本，补实际岗位配置，作为最新矩阵 |\n\n`;
md+='A 与 B 之间，工作区住宅、园艺、布局和搬运源码有并行变化，因此不把跨组差异归因于价格。R2 起保存完整只读输入快照 `inputs/joint-services-r2/`，组内共同源码 SHA 必须相同。过渡的 `flow-joint-quality40` 轨迹保留，但不混入同底本的因果比较。R2 focused 未同步农牧订单的旧 30% 系数，R3 已补齐；旧结果仅保留作诊断。\n\n';
md+='各组 N1 时间（分钟:秒）：\n\n| 引擎/策略 | 生活 | 工业 | 村庄 | 直播 | 不直播 | 低频 |\n|---|---:|---:|---:|---:|---:|---:|\n';
for(const g of groups)for(const e of g.engines)md+=`| ${e} / ${g.policy} | ${routes.map(route=>m(rows.find(r=>r.group===g.id&&r.engine===e&&r.route===route).nether)).join(' | ')} |\n`;
md+='\n## 3. 食堂：持续效果与资本回收分别看\n\n真实六人旧存档，两种休息相位；各分支支付自己的研究、建筑和后续费用，继续运行 30 分钟，不额外采矿。下表与同相位无食堂分支相比，持续净增收已经扣伙食/福利，完整净现金再扣建造投入 2,400。\n\n| 候选 | 相位 | 分支 | 多交货 | 持续净增收 | 含建造费净现金 |\n|---|---:|---|---:|---:|---:|\n';
for(const p of probes.slice(0,2))for(const r of p.rows.filter(r=>['canteen','canteen-tea'].includes(r.id))) {
 const d=r.delta.at(-1);md+=`| ${p.id.includes('reprice')?'仅降开支':'加品质'} | ${r.phase} | ${r.id==='canteen'?'基础食堂':'食堂+茶点'} | ${d.shipped.toFixed(1)} | ${Math.round(d.netCash+r.paid).toLocaleString('en-US')} | ${Math.round(d.netCash).toLocaleString('en-US')} |\n`;
}
md+='\n品质方案的基础食堂持续净效益转正，但没有伪称两种相位都在 30 分钟回本。茶点的增量效果依赖瓶颈，不能推荐最高福利无脑常开。六人已拥有一级食堂的现代存档，再升一级只增加闲置容量，测试结果为负是合理反例；它为人口扩张服务，不应硬塞额外现金收益。新公式 12/24 人的自然扩张整局仍未覆盖。\n\n';
md+='## 4. 工匠书与有用的替代投资\n\n同一现代检查点，不注资，等待实际可负担后购买，30 分钟继续运行；无后续升级。此时已有一级食堂，故食堂项目是扩容，不是首次建设。\n\n| 候选 | 相位 | 书本净现金 | 集市净现金 |\n|---|---:|---:|---:|\n';
for(const p of probes.slice(2))for(const phase of [0,91]){
 const find=id=>p.rows.find(r=>r.phase===phase&&r.id===id).delta.at(-1).netCash;
 md+=`| ${p.id.includes('focused')?'集中培训':'只降低基础复利'} | ${phase} | ${Math.round(find('book')).toLocaleString('en-US')} | ${Math.round(find('market')).toLocaleString('en-US')} |\n`;
}
md+='\n这里只能说明该存档的成交瓶颈投资可以优于培训，不能推导全局必买集市。在更早六人检查点，书本的工业条件尚未满足，记录为不可买；该组不能当作“书本收益为零”的证据。现代检查点来自前一冻结路线，是明确的共同继续经营输入，不伪装成各候选自己走到此处的路径。\n\n';
md+='## 5. 长间隔内还有什么能做\n\n对最新 P8 两条路线的最大购买间隔，原策略重放到间隔内，选择最多八项名义增益候选，另补相关容量/服务选项，实际支付并继续 600 秒；采集和接电频率相同。\n\n';
for(const g of gaps.rows){const positive=g.options.filter(o=>o.netCash>0).sort((a,b)=>b.netCash-a.netCash);
 md+=`- **${names[g.route]}**：${m(g.gap.start)}–${m(g.gap.end)} 未发生购买；在 ${m(g.probeAt)} 有 ${g.affordableLegalCount} 个合法可负担候选，抽测 ${g.options.length} 项，${positive.length} 项实际净现金为正。${positive.length?'其中 '+positive.slice(0,3).map(o=>`${o.id}：+${Math.round(o.netCash).toLocaleString('en-US')}`).join('；')+'。':'这不证明所有可选操作都无效。'}\n`;
}
md+='\n存在正净收益选择时，先修推荐/策略与可发现性，不马上添加小游戏；若这些选择在真实 UI 仍难发现，仍是设计问题。所有抽测为负也不足以证明全局无解。目标现金达标时间仅指现金，不包括未建电源和全部前置。原始记录见 `flow-joint-r3-focused-gap-probes.json`。\n\n';
md+='### 只补一次既有选择的整段影响\n\n按用户最新意见，不再为纯路线增加一串新目标。沿原始路径运行到上述检查点，只增加一次真实购买，随后恢复原策略；不加钱、不送设施、不改价格或研发时长。\n\n| 路线 | 补充选择 | 原进入下界 | 补后进入下界 | 时长变化 | 已记录动作最大间隔：前→后 |\n|---|---|---:|---:|---:|---:|\n';
for(const r of light.rows)md+=`| ${names[r.route]} | ${r.event.name} | ${m(r.netherBefore)} | ${m(r.netherAfter)} | ${r.changePercent.toFixed(1)}% | ${m(r.baselineActionGap)} → ${m(r.actionGap)} |\n`;
md+='\n这两项是已有内容的串联，不是新建小游戏。装卸站的加速明显，故只在实际物流压力下作为可选方案，不加入所有路线的自动必买清单，也不靠涨价把收益抵消。取样时刻只是反事实实验检查点；正式入口仍按前置与实际需求开放，不按分钟锁定。模拟证明这一选择会改变后续经营，不证明玩家一定会自行找到。展示规则见设计文档第 6 节，尚未修改 UI。纯路线和混合玩家不要求表现一致，不再以消除每一段购买间隔作为本轮完成条件。\n\n';
md+='## 6. 验证与未通过项目\n\n';
md+=`最新 R3 的一条完整工业路线：N1 ${m(full.milestones.find(m=>m.id==='N1')?.seconds??null)}，E2 ${m(full.milestones.find(m=>m.id==='E2')?.seconds??null)}，Z3 ${m(full.milestones.find(m=>m.id==='Z3')?.seconds??null)}，实际缺电 ${full.electricity.deficitSeconds} 秒。完整三世界的目标会改变购买顺序，不能和仅计划 N1 的同名路线直接作时间差归因。\n\n`;
md+='- 13 项针对性规则测试通过：工业门槛、书本三个数值消费者、订单、费用区间、锁价、钱包/餐次守恒、品质单次结算、订单不重复出售、JSON/存档码与后台暂停。详见 `joint-service-tests.tap`。\n- 没有把构造的人口/财富测试当作自然经营路线。没有把 JSON/码通过当作最新图片存档、跨平台和旧收益迁移全通过。\n- 尚未交付：最终候选三地图矩阵、12/24 人生活扩张、旧福利重新报价告知、旧书本收益迁移、公共娱乐覆盖修正、双版 UI 与旁白试玩。\n- 无缺电不等于电力已全部平衡；股票式抽成也不是本轮服务模型。整体阶段分布和经营空档仍需打磨。**不晋级可玩版本，不部署。**\n';
writeFileSync(new URL('JOINT-SERVICES-RESULTS.md',dir),md);
writeFileSync(new URL('JOINT-SERVICES-RESULTS.json',dir),JSON.stringify({status:'candidate-not-promoted',groups,rows,inputs,gaps,light,full:{engine:'flow-joint-r3-focused',policy:full.provenance,completed:full.completed,milestones:full.milestones,deficitSeconds:full.electricity.deficitSeconds},limitations:['No human playability claim','Opportunity probes bounded','Research-only waiting unmeasured','No final UI, all-map/24-population or full migration validation']},null,2)+'\n');
console.log(JSON.stringify({pairedMainWorldRuns:rows.length,latest:latest.map(r=>({route:r.route,nether:r.nether})),status:'candidate-not-promoted'}));
