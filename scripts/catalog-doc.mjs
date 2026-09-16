import fs from "node:fs";
import { FAMILIES, ancestors, topological } from "../src/catalog.js";
import { PURCHASE_SPEC } from "../src/purchase-spec.js";
let out =
  "# MC Clicker 正式购买表\n\n由 `src/catalog.js` 与 `src/purchase-spec.js` 生成。" +
  PURCHASE_SPEC.length +
  " 个节点，通往创造模式的依赖闭包为 " +
  ancestors("Z3").size +
  " 个。价格为固定绿宝石金额；重复公式使用购买前数量，不读取当前收入。扩地按各世界独立起价与当地次数计算，JSON 中 max 为 null 表示不限次数。+ 代表同时满足。首次购买决定解锁，供电决定运行，两者互不撤销。\n\n";
for (const [family, info] of Object.entries(FAMILIES)) {
  out += `## ${info.name}\n\n| ID / 项目 | 首购价格 | 前置与门槛 | 重复规则 | 效果与生产联动 | 世界对象 | 交互 | 自动化接管 |\n|---|---:|---|---|---|---|---|---|\n`;
  for (const i of PURCHASE_SPEC.filter((i) => i.family === family))
    out += `| ${i.id} ${i.name} | ${i.cost.toLocaleString("en-US")} | ${i.deps.join(" + ") || "开局"}${i.availability ? "；" + i.availability : ""}${i.gate ? "；" + (i.gate.id ? `${i.gate.id} ≥ ${i.gate.level}` : i.gate.metric === "viewers" ? `历史观众 ≥ ${i.gate.level}` : "三维度工程交付完成") : ""} | ${i.repetition} | ${i.effect} | ${i.sceneObject}${i.footprint ? ` · ${i.footprint.w}×${i.footprint.d} 格` : ""} | ${i.interaction} | ${i.automatedBy.join(" / ") || "—"} |\n`;
  out += "\n";
}
out +=
  "## 拓扑顺序\n\n" +
  topological()
    .map((i) => i.id)
    .join(" → ") +
  "\n\n## 运行条件\n\n供电需求、完整场景变化和重复反馈见 `docs/purchase-catalog.json`。所有材料队列有上限，满仓会抑制上游生产，不清空已生产货物；农田额外收获与基础人口支持独立。\n";
fs.writeFileSync("docs/CATALOG.md", out);
fs.writeFileSync(
  "docs/purchase-catalog.json",
  JSON.stringify(PURCHASE_SPEC, null, 2),
);
console.log(`${PURCHASE_SPEC.length}-node formal catalog generated`);
