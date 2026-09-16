// Read-only evidence aggregation. Recompute investment gaps from all paid/free actions.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../docs/v2.0.0/simulation/',import.meta.url);
const read=name=>JSON.parse(fs.readFileSync(new URL(name,root)));
const exists=name=>fs.existsSync(new URL(name,root));
const hash=x=>createHash('sha256').update(x).digest('hex');
const names={'village-life':'村庄与生活','industrial-first':'工业倾向','village-first':'村庄倾向','livestream-first':'直播倾向','no-livestream':'不直播','low-active':'低频操作'};
const folders=['a3-a-routes','a3-b-routes','a3-c-routes','a3-e-routes','a3-stage-control','a3-f-routes','a3-g-routes','a3-h-routes','a3-j-routes','a3-k-routes','a3-j-chapters-r2','a3-chapters-control-r2'];
const runs=[];
for(const dir of folders){if(!exists(dir))continue;for(const file of fs.readdirSync(new URL(dir+'/',root)).filter(f=>f.endsWith('.json')&&!/save|summary/.test(f))){
 const r=read(dir+'/'+file),ps=r.purchases||[],stamps=[0,...ps.map(p=>p.at).sort((a,b)=>a-b),r.seconds];
 const gaps=stamps.slice(1).map((end,i)=>({start:stamps[i],end,seconds:end-stamps[i]})).sort((a,b)=>b.seconds-a.seconds);
 const buckets=[];for(let start=0;start<r.seconds;start+=300){const p=ps.filter(p=>p.at>=start&&p.at<start+300);buckets.push({from:start,to:Math.min(start+300,r.seconds),allInvestments:p.length,newFacilities:p.filter(p=>/^[TVMLX]\d+$/.test(p.id)&&p.id!=='V1'&&p.level===1).length,research:p.filter(p=>p.id.startsWith('research:')).length,bodyUpgrades:p.filter(p=>p.level>1&&!p.type&&p.id!=='V1').length,dedicated:p.filter(p=>p.type==='dedicated').length});}
 runs.push({folder:dir,route:r.scenario,file:dir+'/'+file,nether:r.milestones?.find(x=>x.id==='N1')?.seconds??null,observed:r.seconds,investmentGap:gaps[0],actionGap:r.effectiveActionLongestGap,investments:ps.length,research:ps.filter(p=>p.id.startsWith('research:')),buckets,hash:hash(fs.readFileSync(new URL(dir+'/'+file,root)))});
}}
const probes={};for(const engine of ['a3-a','a3-d','a3-l']){const r=read(engine+'-investments.json');probes[engine]={rows:r.rows.length,cases:Object.fromEntries([...new Set(r.rows.map(r=>r.id))].map(id=>{const x=r.rows.filter(r=>r.id===id);return[id,{samples:x.length,failed:x.filter(r=>r.failed).length,minNet30:Math.min(...x.map(r=>r.delta.at(-1).netCash)),maxNet30:Math.max(...x.map(r=>r.delta.at(-1).netCash))}]}))};}
const audit=read('a3-e-economy-audit-v3.json');
const bundleHashes=Object.fromEntries(fs.readdirSync(root).filter(f=>/^a3-[a-z]-manifest.json$/.test(f)).map(f=>{const m=read(f);if(hash(fs.readFileSync(new URL(f.replace('-manifest.json','.mjs'),root)))!==m.sha256)throw Error('Changed bundle '+f);return[m.name,m.sha256];}));
const policyHashes=Object.fromEntries(fs.readdirSync(new URL('policies/',root)).map(f=>[f,hash(fs.readFileSync(new URL('policies/'+f,root)))]));
fs.writeFileSync(new URL('replan-summary.json',root),JSON.stringify({status:'planning-only-not-accepted-balance',method:'All investment gaps recomputed including research and housing. New-facility counts are script purchase events, not UI exposures. N1 milestone is success for this scope; completed means final world project. No human completion-time inference.',runs,probes,audit,bundleHashes,policyHashes},null,2)+'\n');
const time=s=>s===null?'未到达':`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
let md='# 本轮主世界模拟复盘\n\n2026-09-13。**未通过最终数值验收；只用于重新策划。** [整体方案](../MAIN-WORLD-REPLAN.md) · [汇总原始数据](replan-summary.json)。当前可玩代码仍为 Alpha.2，下述 a3 字母编号只是实验编号。\n\n';
md+='## 1. 同一策略下，涨价与强化前置的结果\n\n这组使用同一个 stages 策略：真实生产/资金/岗位/住房/运输，主动每两秒采集、每四秒决策；低频每二十秒采集、每十二秒决策。仍考虑世界工程祖先，不等于只想去下界的真人。零秒主线研究不代表没有其他空档。\n\n| 路线 | Alpha.2 基准 | F | G | H | G 最长无投资间隔 |\n|---|---:|---:|---:|---:|---:|\n';
for(const id of Object.keys(names)){const pick=d=>runs.find(r=>r.folder===d&&r.route===id);md+=`| ${names[id]} | ${time(pick('a3-stage-control')?.nether??null)} | ${time(pick('a3-f-routes')?.nether??null)} | ${time(pick('a3-g-routes')?.nether??null)} | ${time(pick('a3-h-routes')?.nether??null)} | ${time(pick('a3-g-routes')?.investmentGap.seconds??null)} |\n`;}
md+='\n- Alpha.2 工业/现代研究为 4,000/24,000，钻机 16,000，下界门 560,000。\n- F：工业/现代 20,000/240,000，钻机 28,000，下界门 2,000,000，并强化村庄与工业等级前置。\n- G：工业/现代 28,000/320,000，下界门 2,600,000，其余沿用该阶段方案。\n- H：在 G 上把工匠书相关倍率从 1.55 试降至 1.4，并把公共生活前置提高到六人/六住址。这是组合干预，不能将全部时长变化归因于书。\n- F/G/H 共 18 条完整 N1 路线，与六条同策略基准对照。阶段模型更慢，但没有一档同时证明“约六十分钟且没有无效攒钱”。\n\n';
md+='## 2. 换一种操作偏好，不能仍报同一个时长\n\nG 的另一套 intensity 策略使用 0.2 秒引擎步长、连续采集占空比和少量真实 180 秒投资分叉。主动 61:08、不买装扮 68:24、低频 81:12 到达 N1。主动路线仍出现约 30 分钟无购买，不能因为 61:08 接近目标就验收。这里的候选升级不全，长窗既可能来自价格，也可能来自脚本不会解决瓶颈，不能直接算成玩家必等。详见 [操作偏好原始报告](a3-g-intensity.json)。\n\n';
md+='## 3. 进入时代与时代内研究分开\n\nJ/K 增加动力运输、自动控制、广播、跨界准备候选，主线均即时。J 工业/现代 12,000/90,000，下界门 1.2M；K 为 20,000/140,000/1.8M。额外模块分别为 14k/40k/80k/180k，全部只是待检验数据。\n\n初版 chapters 只规划 N1 祖先，村庄策略没有把漏斗纳入主动购买；有原料和机器却缺基本收取。J/K 村庄 110 分钟未进下界不能当作有效时长调节。轨迹保留，运行其余重复长例已停止。r2 将基本收取及其依赖纳入所有生产路线，没有向游戏注入资产或收入。\n\n| r2 路线 | 引擎 | 进入下界 | 最长无投资间隔 | 即时工作/经营动作最长间隔 |\n|---|---|---:|---:|---:|\n';
for(const r of runs.filter(r=>['a3-j-chapters-r2','a3-chapters-control-r2'].includes(r.folder)))md+=`| ${names[r.route]} | ${r.folder==='a3-j-chapters-r2'?'J 分批研究':'Alpha.2 同策略控制'} | ${time(r.nether)} | ${time(r.investmentGap.seconds)} | ${time(r.actionGap)} |\n`;
md+='\n前述两个间隔不能混用：第二项包含成功收割等操作，玩家可能仍有即时收益，却很久没有新的投资。所有间隔都不自动证明没有其他选择。研究付款和免费住宅也计入投资事件；修正了旧 `longestWait` 对这些事件漏重置的问题。\n\n分批研究的结构适合继续研究，但目前仍可很早进入工业/现代，也仍有长投资间隔。**没有批准 J 或 K 的价格。** 高额跨界研究没有独立经营用途，不进入推荐定稿；后续改由实际工具/能源准备承接。\n\n';
md+='## 4. 现有升级实际值不值\n\n来自 E 不直播路线挣得的同一中后期存档。每项都是合法、付得起的本体升级，分别与不买对照，运行 600 秒；已扣购买费用，同为两秒一次采集，没有其他新投资。这不是商品常驻的收益率，也没有覆盖全部专项改造。\n\n| 设施升级 | 支出 | 10 分钟净钱包差 |\n|---|---:|---:|\n';
for(const p of audit.improvementProbes)md+=`| ${p.id} | ${Math.round(p.cost).toLocaleString('en-US')} | ${Math.round(p.net600).toLocaleString('en-US')} |\n`;
md+='\n加工/运力投资在这个状态有价值，继续增原料没有价值。此前全局脚本在这段窗口仍有遗漏，证明必须完善策略和面板推荐，不能只提高门价。\n\n';
md+=`主动采集对照：检查点 play=${audit.saving.play} 秒，从约 ${Math.round(audit.saving.money).toLocaleString('en-US')} 现金攒到 ${audit.saving.target.toLocaleString('en-US')}；两秒一次点击 ${audit.saving.click.reached} 秒达标，不点 ${audit.saving.idle.reached} 秒达标，只提前 ${audit.saving.idle.reached-audit.saving.click.reached} 秒。这表明这个现代阶段的采集贡献偏弱；不能用“按钮始终可点”判定空档已解决。\n\n`;
md+='## 5. 直播与食堂的投资探针\n\nE 现代检查点的直播包：研究 320k、唱片机 300、集市升级 576、直播间 120k，共 440,876；不额外注资，现金不足时自然经营到付得起。所有比较包含原有两秒采集，直播未增配主持或其他设备。10 分钟相对不投资约 -85.3k，15 分钟 +267.2k，30 分钟 +1.029M；该包包含集市升级，增益不能全部归为直播本体。\n\n单独提高钻机一级的 41,440 投资在相同检查点 30 分钟仍净少约 41.1k。需要比较正确的工业组合投资，而非拿一项碰巧无效的升级证明直播必选。\n\n生活测试采用同一份真实六人存档、不同起始休息相位，每案 30 分钟，无后续采集/投资，选合法且接近工人的位置，扣研发、建筑、升级与福利。A 与 D 各 48 案；L 9 案，共 105 案。它们是多相位而非多布局，也没有覆盖全部人口与岗位组合。\n\n| 候选 | 干预 | 食堂 Lv.1 30 分钟净钱包差范围 | 结论 |\n|---|---|---:|---|\n';
for(const [e,label]of [['a3-a','范围/记忆/人工岗位收益接入'],['a3-d','再加到访后较快休息、降低升级/分点价'],['a3-l','试返还未使用的村庄运输/交易预留能力']]){const x=probes[e].cases.canteen;md+=`| ${e} | ${label} | ${Math.round(x.minNet30).toLocaleString('en-US')} ～ ${Math.round(x.maxNet30).toLocaleString('en-US')} | 尚未证明稳定投资价值 |\n`;}
md+='\n改过的食堂仍未通过；不能用“可选设施”跳过效益校验。L 只说明返还空闲能力没有单独救活食堂；不能据此批准运输结算变更。费用守恒、非负钱包、幸福人工加成上限在探针中有断言；并不代替所有货物流向/旧档/浏览器测试。\n\n';
md+='## 6. 信息密度的可见代理\n\n下表是 J/r2 村庄策略每五分钟发生的购买事件，**不是实际 UI 展示或旁白密度**。后续还要用真实界面和叙事运行器测已显示的信息。\n\n| 时间段 | 首购商品种类事件 | 本体升级 | 专项改造 | 研究 | 全部投资事件 |\n|---|---:|---:|---:|---:|---:|\n';
for(const b of runs.find(r=>r.folder==='a3-j-chapters-r2'&&r.route==='village-life')?.buckets||[])md+=`| ${time(b.from)}–${time(b.to)} | ${b.newFacilities} | ${b.bodyUpgrades} | ${b.dedicated} | ${b.research} | ${b.allInvestments} |\n`;
md+='\n总量里还包括居民、住宅、扩地等事件，因此不等于前四列之和。当前数据仍显示内容前置和后期稀疏；这正是继续重新编排的依据，而不是用旁白或装扮填满后半程。\n\n';
md+='## 7. 证据完整性与本轮边界\n\n- 当前正式运行模块未采用上述候选。冻结源哈希及本轮回归见 [源码保持检查](replan-source-check.json)。\n- 各 a3 引擎均有不可变 bundle/manifest；汇总核对了 bundle 哈希。旧引擎不能用当前覆盖层重新生成。\n- r1/r2、stages/intensity、整体控制与局部分叉分别报告，不能把不同策略下的差异全部归因于价格。\n- E 审计 v1 错误处理直播前置、v2 点击探针太靠近窗口末端，均不采纳。当前 [v3](a3-e-economy-audit-v3.json) 是正确采用文件，无后缀别名曾被覆盖，不声称保存了所有旧 JSON。\n- 未统计实际显示旁白、未做真人 60 分钟测试、未测试候选旧档迁移或双端 UI。没有“整体游戏性通过”的结论。\n- 下一步先校正策略遗漏和真实投资关系，然后对照“分批开放不加额外费 / 分批开放加费用 / 原结构”，最后再定固定数值。完整工作顺序见 [主方案](../MAIN-WORLD-REPLAN.md#8-下一批工作顺序)。\n';
fs.writeFileSync(new URL('REPLAN-RESULTS.md',root),md);
console.log(JSON.stringify({routeFiles:runs.length,lifeCases:Object.values(probes).reduce((n,x)=>n+x.rows,0),frozenCandidates:Object.keys(bundleHashes).length}));
