// Evidence index for the isolated combined candidate. No playable imports.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../docs/v2.0.0/simulation/',import.meta.url);
const evidence={};
const load=path=>{const raw=readFileSync(new URL(path,root));evidence[path]=createHash('sha256').update(raw).digest('hex');return JSON.parse(raw);};
const routes=['village-life','industrial-first','village-first','livestream-first','no-livestream','low-active'];
const names=['村庄与生活','工业','村庄','直播','不直播','低频'];
const stamp=n=>`${Math.floor(n/60)}:${String(Math.round(n%60)).padStart(2,'0')}`;
const range=ns=>`${Math.min(...ns).toFixed(1)}–${Math.max(...ns).toFixed(1)}`;
const episode=es=>es.filter((e,i)=>!i||e.at-es[i-1].at>120).length;
const businessGap=r=>{const ts=[0,...r.purchases.map(p=>p.at).sort((a,b)=>a-b),r.milestones.find(x=>x.id==='N1')?.seconds??r.seconds];return Math.max(...ts.slice(1).map((t,i)=>t-ts[i]));};
const brief=r=>({nether:r.milestones.find(x=>x.id==='N1')?.seconds??null,industrial:r.research.completed.industrial,modern:r.research.completed.modern,
  generation:r.electricity.generated,spilledPercent:r.electricity.spilled/r.electricity.generated*100,deficitSeconds:r.electricity.deficitSeconds,powerEpisodes:episode(r.electricity.decisions),powerBuys:r.electricity.decisions.length,
  longestBusinessGap:businessGap(r),recordedActionGap:r.effectiveActionLongestGap,researchOnlySeconds:r.researchOnlySeconds,
  income:r.income,totalIncome:r.actualIncome,food:r.foodCare});
const power=routes.map((route,i)=>({route,name:names[i],control:brief(load(`power-p5-control/${route}.json`)),candidate:brief(load(`power-p5-linear/${route}.json`))}));
const response=routes.map((route,i)=>({route,name:names[i],control:brief(load(`flow-food-ignore-routes/${route}.json`)),candidate:brief(load(`flow-food-response-routes/${route}.json`))}));
const joint=routes.map((route,i)=>({route,name:names[i],control:brief(load(`flow-j-continuation-oldpower-routes/${route}.json`)),candidate:brief(load(`flow-j-continuation-routes/${route}.json`))}));
const microNames=['power-staged-60-linear','power-service-wide','power-food-global-r2','power-food-shortage-r2','power-food-closed-r2','power-food-transport','power-food-closed-transport','power-food-hauling','power-food-closed-hauling'];
const service=Object.fromEntries(microNames.map(name=>[name,load(`${name}-service-access.json`).rows]));
const marginal=(open,closed)=>service[open].filter(r=>r.layout!=='none').map(r=>{const c=service[closed].find(c=>c.phase===r.phase&&c.layout===r.layout),a=r.samples.at(-1),b=c.samples.at(-1);return{phase:r.phase,layout:r.layout,netCash:a.wallet-b.wallet,income:a.income-b.income,completedWork:a.completedWork-b.completedWork,shipped:a.shipped-b.shipped};});
const marginalFood=marginal('power-food-shortage-r2','power-food-closed-r2');
const marginalTransport=marginal('power-food-transport','power-food-closed-transport');
const marginalHauling=marginal('power-food-hauling','power-food-closed-hauling');
const full=['control','linear'].map(id=>({id,...brief(load(`power-p5-full-${id}/industrial-first.json`)),milestones:load(`power-p5-full-${id}/industrial-first.json`).milestones}));
const layouts=[{seed:17,...brief(load('power-p5-linear/no-livestream.json'))},...[42,91].map(seed=>({seed,...brief(load(`power-p5-layout${seed}/no-livestream.json`))}))];
for(const name of ['power-p1-control','power-staged-60-linear','flow-relay-food-r2','flow-j-continuation','flow-j-continuation-oldpower',...microNames]){
 const manifest=load(name+'-manifest.json');const raw=readFileSync(new URL(name+'.mjs',root));
 if(createHash('sha256').update(raw).digest('hex')!==manifest.sha256)throw Error('Frozen engine changed: '+name);
}
const data={status:'isolated-candidates-not-promoted',date:'2026-09-13',power,response,joint,service,marginalFood,marginalTransport,marginalHauling,full,layouts,evidence,
 limitations:['Not a human playthrough.','Policy general-upgrade ROI uses nominal capacity, not realised cash.','Recorded action intervals are not all available opportunities.','Research-only wait is not instrumented; null is not zero.','actualIncome already includes manual; base/jobs are components, not extra income.','No joint Web/XHS UI or combined life migration passed.']};
writeFileSync(new URL('LIFE-POWER-RESULTS.json',root),JSON.stringify(data,null,2)+'\n');
const lines=[
'# 经营 × 生活 × 电力：候选联合复盘','',
'2026-09-13。**延续主世界重排，未定价、未晋级可玩版。** [设计与取舍](../LIFE-POWER-CANDIDATE.md) · [数据及输入哈希](LIFE-POWER-RESULTS.json)。所有 N1 时间取真实购买事件，不使用循环退出多出来的一秒。','',
'## 1. 各批结果是什么，不能混在一起说','',
'- F/G/H、J/K 是前一轮的整体编排候选，失败轨迹继续保留在 REPLAN-RESULTS.md。',
'- power-p5-* 只验证电力曲线，不承担六十分钟流程目标。两边使用同一 P5 决策规则。',
'- flow-relay-* 是分批研究/直播/食堂的局部联调；工业12k、现代72k，门仍560k；不等于完整阶段重排。',
'- flow-j-continuation-* 继续 J 的工业12k、现代90k、钻机28k、门1.2M、食堂1.6k和分批研究14k/40k/80k；保留六人六床/农田Lv.3/集市Lv.2、工业后的基础收取、现代依赖自动控制。撤掉180k跨界许可费，补现代实际成交/漏斗前置，加入中央供餐、分批工具资格。两组除电力外配置一致，均使用 P6 供餐响应策略。它是 J 的下一轮候选，**不是旧 J 的原样复跑**。',
'- 服务探针：一份挣得的六人存档，近/远合法建址×两个休息相位，30分钟前台模拟。额外人口仅在明确标注的规则测试中构造，不冒充真实24人经营。','',
'## 2. 电力单项：减少浪费，不拿它延长主线','',
'| 路线 | 原电力 N1 | 候选 N1 | 溢出比例：原→候选 | 实际缺电秒数 | 候选补电决策/购买 |',
'|---|---:|---:|---:|---:|---:|',
...power.map(r=>`| ${r.name} | ${stamp(r.control.nether)} | ${stamp(r.candidate.nether)} | ${r.control.spilledPercent.toFixed(1)}% → ${r.candidate.spilledPercent.toFixed(1)}% | ${r.candidate.deficitSeconds} | ${r.candidate.powerEpisodes}/${r.candidate.powerBuys} |`),'',
'候选：基础火把6、风车32不变；发电机60 E/秒、24k；火把组1.3、供能模块1.25；火把本体不再叠加5/10级整体倍率，改造分阶段。补电决策把相邻120秒内的购买合组，并同时保留原始购买数，不把一次操作合并出虚假的少点击。','',
'直播路线早期仍有186秒供电>需求两倍：第一支6 E/秒火把只带约1 E/秒的唱片机，属于基础电源粒度，并非中后期叠满倍率。暂不为消除这个统计值削弱初始供能。部分路线的稳定余量略超过40%，也不以反复调开关消除。','',
`不直播三布局 N1：${layouts.map(r=>`${r.seed}号 ${stamp(r.nether)}`).join('，')}；均无实际缺电。种子影响真实建址与住房，而不是只改草木。三世界工业路线：原 Z3 ${stamp(full[0].milestones.find(x=>x.id==='Z3').seconds)}，候选 ${stamp(full[1].milestones.find(x=>x.id==='Z3').seconds)}。这些只覆盖电力单项，不代表联合新生活规则已经完成三世界验收。`,'',
'## 3. 距离：不能只改那个半径','',
'| 规则 | 四个建址/相位中曾吃到饭的人数 |',
'|---|---:|',
...['power-staged-60-linear','power-service-wide','power-food-global-r2','power-food-shortage-r2'].map(id=>`| ${id} | ${service[id].filter(r=>r.layout!=='none').map(r=>`${r.foodEver}/6`).join('、')} |`),'',
'wide 的一级实际半径31格，但6格路径/6秒放弃仍存在。global-r2把供餐资格按人口和产餐能力计算；shortage-r2在此基础上增加温和缺餐影响。四案全覆盖不等于任意地图、任意人口已经通过。','',
'## 4. 食堂开/关、运输修正、搬运系数分开看','',
'以下对照双方都已付相同研发/建筑费用，建筑位置相同，区别为供餐开启或容量为零；因此隔离了建址和初始资本的影响。净现金已扣食材，不代表初始食堂已回本。','',
'| 相位/建址 | 原岗位连接：供餐净现金差 | 返还闲置运力后 | 补齐村民取货生活系数后 | 补齐系数后的额外工作次数 |',
'|---|---:|---:|---:|---:|',
...marginalFood.map((r,i)=>`| ${r.phase}/${r.layout} | ${r.netCash.toFixed(0)} | ${marginalTransport[i].netCash.toFixed(0)} | ${marginalHauling[i].netCash.toFixed(0)} | ${marginalHauling[i].completedWork} |`),'',
'结论：供餐覆盖的问题已经能在原型中消除；真实工作和现金仍受生产、搬运、交易及布局相位影响。返还闲置运力不是单独的解决方案；补齐取货系数后，四案中有三案为正值，但仍有反例。这两项均未进入联合候选，更不能作为“食堂已证明好玩”。基础服务、可选舒适和赚钱投资按不同目的验收；同样不能以情绪价值忽略反直觉现金变化。','',
'## 5. 模拟玩家真的响应供餐，而非一直无视它','',
'同一 flow-relay-food-r2 引擎。P5原偏好只在生活路线主动买食堂；P6在宽限结束前90秒开始处理人口超过供餐能力的问题，实际付研发/建筑/土地费用。这是生活经营偏好，不是假定它是最快通关解法。','',
'| 路线 | 原偏好 N1 | 处理供餐 N1 | 缺餐累计人秒：原→处理 | 最长经营投资间隔 | 含成功工作操作的最长间隔 |',
'|---|---:|---:|---:|---:|---:|',
...response.map(r=>`| ${r.name} | ${stamp(r.control.nether)} | ${stamp(r.candidate.nether)} | ${r.control.food.hungryPersonSeconds} → ${r.candidate.food.hungryPersonSeconds} | ${stamp(r.candidate.longestBusinessGap)} | ${stamp(r.candidate.recordedActionGap)} |`),'',
'处理缺餐没有造成卡关或实际缺电。但购买食堂后是否值得升级、长期经营是否更有趣，仍不能靠这些时长证明。此批仍有长经营间隔；成功采集/演出能够填入即时操作，但不是经营选择的替代物。','',
'## 6. 回到 J 的流程候选，再比较新旧电力','',
'| 路线 | 原电力 N1 | 新电力 N1 | 时长变化 | 原→新溢出比例 | 最长经营投资间隔 | 缺电秒数 |',
'|---|---:|---:|---:|---:|---:|---:|',
...joint.map(r=>`| ${r.name} | ${stamp(r.control.nether)} | ${stamp(r.candidate.nether)} | ${((r.candidate.nether/r.control.nether-1)*100).toFixed(1)}% | ${r.control.spilledPercent.toFixed(1)}% → ${r.candidate.spilledPercent.toFixed(1)}% | ${stamp(r.candidate.longestBusinessGap)} | ${r.candidate.deficitSeconds} |`),'',
'这轮继续候选，不批准整套价格。还必须修正模拟对非电力升级的名义ROI判断，并把后半程内容分配到可理解的经营成果上。保留或撤销某一研究/价格，要看它是否带来选择，而非是否多拖了几分钟。','',
'## 7. 验证覆盖与缺口','',
'- 隔离供餐规则测试6项：容量6/12/24人、缺餐恢复、资金不足、收纳、搬运货批保留、前台/后台、供餐账本恢复、远距离与室内、忙碌/无水井不能绕过需求。人口扩展是规则夹具。',
'- 原供电候选10项集成/兼容测试通过；416组历史供能公式对照；旧档已有供能补偿绑定设备，重复恢复不叠加，Web/XHS JSON和历史编码/像素载荷往返。**不代表新供餐已经做完图片存档和双版迁移。**',
'- 9项电力场景记录见 POWER-SCENARIOS.json；满仓/缺料/暂停/断开/无电池/恢复/扩建/后台/主动过量投资按真实状态检查。',
'- 独立交易容量守恒测试通过，仅是返还闲置运力原型的底线；不是整段物流收益验收。',
'- 尚未测全：实际可操作机会清单、纯研发等待、实际UI旁白密度、联合生活规则三地图三世界、全部角色幸福连接、娱乐设施远程服务、旧档缺餐提示、手机界面。null/未测不能当0或通过。',
'- P1–P4旧策略与旧seed案例不混作本轮对照。旧食堂R1把吃饭绑忙闲/水井，存在绕过需求的漏洞；只采纳R2覆盖数据。',
'- 运行脚本的actualIncome包含采集收入；base/jobs属于原有收入分解，禁止再次相加。所有界面效果、真人体验与正式定价均未验收。','',
'复跑入口见 [隔离脚本说明](../../../spikes/v2-power/README.md)。'
];
writeFileSync(new URL('LIFE-POWER-RESULTS.md',root),lines.join('\n')+'\n');
console.log(JSON.stringify({powerPairs:power.length,foodPairs:response.length,jointPairs:joint.length,serviceCases:Object.values(service).reduce((n,a)=>n+a.length,0),evidenceFiles:Object.keys(evidence).length}));
