import { readFileSync, writeFileSync, existsSync } from "node:fs";
const dir = "docs/v1.1l";
const json = (file) => JSON.parse(readFileSync(`${dir}/${file}`, "utf8"));
const save = (file, data) =>
  writeFileSync(`${dir}/${file}`, JSON.stringify(data, null, 2) + "\n");
// Planning exports are a baseline artifact. Never overwrite calibrated prices or
// release evidence during a validation-only rerun.
if (
  existsSync(`${dir}/base-purchases.json`) &&
  json("base-purchases.json").calibration &&
  !process.argv.includes("--reset-run")
) {
  await import("./check-catalog-v1.1l.mjs");
  console.log("Calibrated tables and execution records preserved.");
  process.exit(0);
}
const baseline = json("baseline-purchases.json"),
  upgrades = json("upgrade-purchases.json");
const mods = Array.isArray(upgrades) ? upgrades : upgrades.rows;
if (!mods) throw new Error("Missing mod rows");
const changes = {
  N3: { desc: "烈焰人积蓄热能，供烈焰熔炉加工；可扩蓄热器与供料管。" },
  N4: { desc: "消耗热量加工原料，仅按实际加工回收电能；可改造炉膛与换热器。" },
  N5: { desc: "每 10 秒批量压制真实原料，消耗电力；满仓暂停。" },
  N6: { desc: "每班空运有限货物；点按可加派空闲班次，抵达满仓时等待卸货。" },
  E3: { desc: "按班次瞬移搬运末地原料；仍需后续加工与交货。" },
  E9: {
    desc: "周期提取已生产的成品，巡游后卸货；货物进入销售、订单与工程调度。",
  },
  E11: { desc: "种植异界原料，接入加工网络；龙息期间可强化气候联动。" },
  M5: {
    cost: 240,
    deps: ["T7", "M4"],
    desc: "开启储能与电网；长按曲柄补充电量。",
  },
  M6: { cost: 320, desc: "持续发电 6 E/s；专属改造提高供能与储能。" },
  L2: {
    deps: ["V3", "L1", "M6"],
    desc: "直播间自动接电，基础直播 2 E/s；室内设备分别耗电。",
  },
  M10: {
    place: false,
    scope: "system",
    desc: "联网机械工作速度与工作耗电 ×1.3。",
  },
  M11: {
    place: false,
    scope: "system",
    desc: "全网每级延长 8 格，降低线路损耗；上限 56 格。",
  },
  M12: {
    place: false,
    scope: "system",
    desc: "按库存和电量协调上下游，默认优先维持有效出货。",
  },
  M13: {
    place: false,
    scope: "system",
    desc: "为成熟任务调配闲置执行器；人工或村民已开始的任务不接管。",
  },
  Z3: { cost: 0, desc: "工程交付完成后进入创造模式，保存首次通关纪念。" },
};
const rows = baseline.rows.map((row) => ({
  ...row,
  ...changes[row.id],
  priceStatus: "candidate-awaiting-integrated-simulation",
}));
const byId = Object.fromEntries(
  [...rows.map((r) => ({ ...r, dependencies: r.deps })), ...mods].map((r) => [
    r.id,
    r,
  ]),
);
const visited = new Set(),
  visiting = new Set();
function visit(id) {
  if (!byId[id]) throw new Error(`Missing dependency ${id}`);
  if (visiting.has(id)) throw new Error(`Cycle ${id}`);
  if (visited.has(id)) return;
  visiting.add(id);
  for (const dep of byId[id].dependencies || []) visit(dep);
  visiting.delete(id);
  visited.add(id);
}
for (const id of Object.keys(byId)) visit(id);
save("base-purchases.json", {
  status: "candidate-not-release-approved",
  baseline: "dba1625",
  count: rows.length,
  rows,
});
writeFileSync(
  `${dir}/PURCHASES.md`,
  "# 主购买表\n\n候选值：97 个现有节点。实际售价字段已展开旧目录隐含的 ×2；新目录应直接读取本表，不再重复乘二。价格公式 ceil(cost × growth^当前等级)，不读取当前收入。最终五路线校准前不发布。\n\n| ID | 项目 | 实际基础价 | 成长 | 上限 | 前置 | 首次效果 |\n|---|---|---:|---:|---:|---|---|\n" +
    rows
      .map(
        (r) =>
          `| ${r.id} | ${r.name} | ${r.cost} | ${r.growth} | ${r.max} | ${r.deps.join("＋")}${r.gate ? "；" + JSON.stringify(r.gate) : ""} | ${r.desc} |`,
      )
      .join("\n") +
    "\n",
);
if (
  existsSync(`${dir}/requirements.json`) &&
  !process.argv.includes("--reset-run")
) {
  console.log(
    `Validated ${rows.length} base + ${mods.length} upgrade rows. Existing execution ledger preserved.`,
  );
  process.exit(0);
}
const groups = {
  WP0: [
    "保留源目标全文",
    "97 项现版购买价格和依赖导出",
    "五条现版路线记录实际收入与阶段",
    "明确脚本不是人类试玩",
  ],
  WP1: [
    "正式主购买表和专属改造表",
    "所有价格为固定数据或固定成长公式",
    "前置完整无环，包括钻头在钻石镐之后",
    "升级字段包含能耗和模型变化",
    "完整数值压力原型先于运行时实施",
  ],
  WP2: [
    "正交路线绕建筑并连接入口",
    "小径和轨道不阻挡生物",
    "采集到加工到仓储到交易各阶段连接",
    "轨道连续、矿车容量和车次可见",
    "动画使用真实货流，阻塞时停运",
    "无关装饰不纳入运输距离平均值",
    "拓扑按布局与连接变化缓存",
    "实际线长决定供电范围",
    "中继器全局继承且保留上限",
    "红石钟速度与工作电耗同比改变",
    "比较器默认智能上下游协调",
    "侦测器不增加执行器、不抢人工任务",
    "线路损耗与控制器统一计费",
    "区分工作、待机、缺电、超距、关闭",
    "满仓保护、按需耗电保留",
    "直播基础及五种附加设备分别计费",
    "直播装饰不耗电、免布线",
    "断电先减少附加设备，保留观众",
    "基础供电先于直播可购买",
  ],
  WP3: [
    "基础等级、专属改造、系统科技分层",
    "52 项改造在所属设施内部购买",
    "钻机7项改造实际影响能力和部件",
    "熔炉4项改造实际影响能力和部件",
    "风车3项和火把3项改造实际生效",
    "仓储3项与铁路3项改造实际生效",
    "升级不直接把原料变成收入",
    "模型部件不扩大非法占地",
    "各改造无永久互斥选择",
    "全网科技在工业系统面板",
    "3–5近期项目与完整树展开",
    "四种购买状态与受阻原因默认可见",
    "预览名义能力和耗电，不保证等比收入",
  ],
  WP4: [
    "基础收入B不因岗位减少",
    "最多12活跃居民、已有同伴培养",
    "村民职业工具有岗位用途",
    "作物周期、交互和订单用途不同",
    "自动化后村民仍有照料和转岗价值",
    "铜傀儡真实收集、搬运与跑腿",
    "工作集中在村庄与设施管理",
    "烈焰人热能、加工、锻造互相协作",
    "猪灵订单消耗真实交付",
    "同一货物不能用于多个订单或工程",
    "岩浆怪周期批量加工",
    "恶魂实际容量受限空运",
    "下界货运站连接两维度",
    "末影人有间隔和容量",
    "潜影装卸与潜影盒影响实运容量",
    "末影箱实货跨维度转运",
    "紫颂连锁收获、龙息与盆栽组合",
    "龙巡游运输真实库存与直播高光",
    "空间设施保留铁路和仓储用途",
    "生物工作有可见状态和动画",
  ],
  WP5: [
    "五条最终路线记录实际收入与供需",
    "普通前台路线45–90分钟校准",
    "前期快速首购、扩地和自动收入",
    "升级对瓶颈有可观察收益",
    "电力不造成长期手摇卡点",
    "新维度明显增长且有后续经营",
    "不购买直播可以通关",
    "工程需要三个维度分别实物交付",
    "工程完成时间与最长等待记录",
    "后台收益继续暂停",
    "实际试玩与模拟证据分开记录",
    "所有候选价格完成校准再发布",
  ],
  WP6: [
    "免费当前场景分享保持",
    "首胜与之后分享可开通关卡",
    "1440×1920三维度独立布局",
    "主世界和工程大画面",
    "下界末地独立居中且可辨识",
    "真实统计及无直播替代成绩",
    "徽记、正式QR、kwaigc、版本与模型署名",
    "首次建设统计快照不可被后续覆盖",
    "旧赢家明确使用当前建设",
    "生成不改变存档、镜头、面板或推进模拟",
    "移动端顺序渲染、释放、重试",
    "保存PNG、系统分享、复制链接",
    "至少两张真实路线胜利卡样例",
  ],
  WP7: [
    "旧币、设施、居民、装饰和资格保留",
    "schema6、改造version1、展示版本分离",
    "工程按比例迁移、阶段不倒退",
    "旧线自动适配、无隐形大面积停机",
    "旧直播无电源兼容且不挤建筑",
    "目录图鉴教程版本文案一致",
    "手机购买、全屏展开、菜单切换可用",
    "手机设施管理与分享可用",
    "桌面选择镜头、室内画布压扁回归",
    "画面品质和路线性能实测",
    "全部通关流程和旧档回归",
    "代码、表、迁移、模拟、手机、图片交付",
  ],
};
save(
  "requirements.json",
  Object.entries(groups).flatMap(([wp, list]) =>
    list.map((text, index) => ({
      id: `${wp}-${String(index + 1).padStart(2, "0")}`,
      package: wp,
      requirement: text,
      status: wp === "WP0" && index < 2 ? "verified" : "pending",
      evidence:
        wp === "WP0" && index < 2
          ? [index ? "baseline-purchases.json" : "OBJECTIVE.md"]
          : [],
    })),
  ),
);
const paths = {
  WP0: ["docs/v1.1l/simulation/baseline", "scripts/balance-v1.1l.mjs"],
  WP1: ["docs/v1.1l", "scripts/prototype-v1.1l.mjs", "scripts/plan-v1.1l.mjs"],
  WP2: [
    "src/routing.js",
    "src/power.js",
    "src/game.js",
    "src/world.js",
    "src/catalog.js",
    "src/operations.js",
    "src/management-ui.js",
    "tests",
  ],
  WP3: [
    "src/upgrades.js",
    "src/models.js",
    "src/facility-shops.js",
    "src/management-ui.js",
    "src/main.js",
    "src/style.css",
    "tests",
  ],
  WP4: [
    "src/dimensional.js",
    "src/game.js",
    "src/operations.js",
    "src/world.js",
    "src/collection.js",
    "tests",
  ],
  WP5: [
    "src/economy.js",
    "src/catalog.js",
    "src/project.js",
    "scripts/balance-v1.1l.mjs",
    "docs/v1.1l/simulation",
  ],
  WP6: [
    "src/victory.js",
    "src/share-ui.js",
    "src/world.js",
    "src/main.js",
    "tests",
    "docs/v1.1l/samples",
  ],
  WP7: [
    "src",
    "tests",
    "scripts",
    "docs/v1.1l",
    "../../public/projects/mc-clicker-2",
  ],
};
const manifests = Object.entries(groups).map(([id, criteria], index) => ({
  id,
  goal: criteria[0],
  context: "docs/v1.1l/PLAN.md",
  success_criteria: criteria,
  constraints: ["保留前台收益和用户存档", "发布前全部候选数值校准"],
  owned_paths: paths[id],
  dependencies: index ? [`WP${index - 1}`] : [],
  expected_outputs: [`docs/v1.1l/${id}-verification.md`],
  risk_level: "MEDIUM",
  max_retries: 1,
  non_goals: ["替换游戏美术引擎", "部署半成品数值"],
}));
save("run/v1.1l/task-manifests.json", manifests);
const ledger = json("run/v1.1l/ledger.json");
Object.assign(ledger, {
  current_stage: "plan",
  task_status: Object.fromEntries(
    manifests.map((m) => [
      m.id,
      m.id === "WP0"
        ? "slice_1_completed"
        : m.id === "WP1"
          ? "slice_2_in_progress"
          : "slice_0_not_opened",
    ]),
  ),
  dependencies_satisfied: { WP0: true, WP1: true },
  active_write_locks: { planner: paths.WP1 },
  integration_status: "isolated_branch",
});
save("run/v1.1l/ledger.json", ledger);
const output = json("run/v1.1l/run-output.json");
output.orchestration_log = [
  {
    stage: "intake",
    task: "WP0",
    owner: "Intake Lead",
    status: "complete",
    notes:
      "Read full objective, preserve all requirements, clean baseline dba1625 on isolated branch.",
  },
  {
    stage: "plan",
    task: "WP1",
    owner: "Planner",
    status: "in_progress",
    notes:
      "97 base rows + 52 dedicated upgrades, DAG validated; prices explicitly candidate until integrated five-route recalibration.",
  },
];
output.vetter_report = {
  risk_level: "MEDIUM",
  checked_items: [
    "Local repository and AGENTS.md",
    "Read-only official Factorio sources",
    "Isolated numeric scripts",
    "Local reversible source and docs changes",
    "Scoped publication authority from prior user requests",
  ],
  decisions: [
    {
      action: "planning_and_local_implementation",
      decision: "allow",
      guardrails: [
        "Never touch active user save",
        "Isolated branch until verified",
        "No destructive reset or unrelated site changes",
      ],
    },
    {
      action: "production_publication",
      decision: "defer_until_verification",
      reason:
        "Already authorized; waiting for concrete tested release, not new user permission.",
    },
  ],
};
save("run/v1.1l/run-output.json", output);
console.log(
  `Validated ${rows.length} base + ${mods.length} upgrade nodes; ${visited.size} DAG nodes.`,
);
