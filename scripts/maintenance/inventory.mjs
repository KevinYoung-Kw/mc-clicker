// Whole Git repository inventory. The game dependency graph lives in scan.mjs.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { parseAst } from "rollup/parseAst";
const game = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const repo = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  cwd: game,
  encoding: "utf8",
}).trim();
const prefix = "projects/mc-clicker-2/";
if (!fs.existsSync(path.join(repo, prefix, "src")))
  throw Error("This inventory belongs to the website monorepo, not XHS");
const git = (args) =>
  execFileSync("git", args, { cwd: repo, maxBuffer: 20e6 }).toString();
const files = git(["ls-files", "-z"]).split("\0").filter(Boolean);
const untracked = git(["ls-files", "--others", "--exclude-standard", "-z"])
  .split("\0")
  .filter(Boolean);
const classify = (file) => {
  if (file.startsWith(prefix)) {
    const rel = file.slice(prefix.length);
    if (rel.startsWith("src/")) return "game-source";
    if (rel.startsWith("public/")) return "game-assets";
    if (rel.startsWith("tests/")) return "game-tests";
    if (rel.startsWith("scripts/"))
      return /research|spike|study|reconstruction/.test(rel)
        ? "game-experiments"
        : "game-tools";
    if (rel.includes("/qa/")) return "game-evidence";
    if (rel.startsWith("docs/"))
      return /research|archive/.test(rel)
        ? "game-history-research"
        : "game-docs";
    return "game-config";
  }
  if (file.startsWith("src/")) return "website-source";
  if (file.startsWith("public/")) return "website-static";
  if (file.startsWith("scripts/")) return "website-tools";
  if (file.startsWith("projects/")) return "other-projects";
  if (file.startsWith("docs/")) return "website-docs";
  return "repository-config-other";
};
const rows = files.map((file) => {
  const p = path.join(repo, file),
    exists = fs.existsSync(p);
  return {
    path: file,
    area: classify(file),
    bytes: exists ? fs.statSync(p).size : null,
  };
});
const areaCounts = (list) =>
  Object.entries(
    list.reduce((a, file) => {
      const zone = classify(file);
      a[zone] = (a[zone] || 0) + 1;
      return a;
    }, {}),
  )
    .sort()
    .map(([area, files]) => ({ area, files }));
const errors = [],
  siteModules = [];
const require = createRequire(path.join(repo, "package.json"));
const { parse: parseVue } = require("@vue/compiler-sfc");
const postcss = require("postcss");
for (const row of rows.filter((x) => x.area === "website-source")) {
  const file = row.path,
    text = fs.readFileSync(path.join(repo, file), "utf8"),
    imports = [];
  const js = (source) => {
    const tree = parseAst(source);
    for (const n of tree.body)
      if (n.source?.value) imports.push(n.source.value);
  };
  try {
    if (file.endsWith(".vue")) {
      const result = parseVue(text, { filename: file });
      if (result.errors.length) throw Error(result.errors.join("; "));
      for (const block of [
        result.descriptor.script,
        result.descriptor.scriptSetup,
      ])
        if (block) js(block.content);
      for (const block of result.descriptor.styles)
        postcss.parse(block.content, { from: file });
    } else if (file.endsWith(".js")) js(text);
    else if (file.endsWith(".css")) postcss.parse(text, { from: file });
  } catch (error) {
    errors.push({ file, error: String(error) });
  }
  siteModules.push({
    path: file,
    lines: text.split("\n").length,
    imports: [...new Set(imports)],
  });
}
const report = {
  revision: git(["rev-parse", "HEAD"]).trim(),
  scope:
    "All tracked repository paths; untracked counts only. AST/Vue/CSS parse of website src. Game src has a separate graph. Syntax is not behavioral verification.",
  tracked: rows.length,
  areas: areaCounts(files),
  untrackedAreas: areaCounts(untracked),
  siteModules,
  errors,
  files: rows,
};
const out = path.join(game, "docs/maintenance");
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(
  path.join(out, "repository-inventory.json"),
  JSON.stringify(report, null, 2) + "\n",
);
const md = [
  "# 全仓边界与主站接入",
  "",
  `基于 Git 提交 \`${report.revision}\` 的工作区清单：${rows.length} 个已跟踪路径。记录文件位置与大小，并解析 ${siteModules.length} 个主站 src 文件（Vue 的 script/style 分别检查）；MC2 全量源码关系另见 FILE-MAP。未跟踪工作只记分类数量，不把其他任务的草稿/私人样本写入清单。`,
  "",
  "这不是逐行证明所有历史截图、文档和旧 demo 都无 bug。正式游戏按领域人工追踪，主站按入口/组件/配置/构建边界核查，静态文件按资产分类。完整逐文件清单见 [repository-inventory.json](repository-inventory.json)。",
  "",
  "## 所有已跟踪目录分类",
  "",
  "| 分类 | 文件数 |",
  "|---|---:|",
  ...report.areas.map((x) => `| ${x.area} | ${x.files} |`),
  "",
  "## 主站与游戏不是同一个前端",
  "",
  "主站路径 `src/` 均相对 my-profile 根目录。游戏路径相对 projects/mc-clicker-2；小红书不包含下面的 Vue 源码。",
  "",
  "| 功能 | 主站文件与流向 |",
  "|---|---|",
  "| 入口 | index.html → src/main.js → src/App.vue → router/index.js → sites/resume/App.vue |",
  "| 中英文内容 | sites/resume/config.js / config_en.js；共用结构与文字在 config.factory.js |",
  "| 首页与页面切换 | sites/resume/App.vue 的 flow/tiles、overlay、历史路径、语言与 inert/focus 处理 |",
  "| 项目列表与封面 | components/views/DemoView.vue、resume/SeriesHeroSection.vue，加 config 的 demos 数据；MC2 游戏逻辑不在这里 |",
  "| 文章/简历/合作 | components/views 各 View，数据由 props/config 提供 |",
  "| 卡片编辑器 | components/tools、composables/useCardExport.js；不是游戏纪念卡 |",
  "| 公共交互 | common/ControlButtons、Toast、BackButton、CustomCursor、IntroCard、Footer、StatusBanner |",
  "| 样式 | variables → global → header-flow → tiles → main；Arco CSS 在这些之前，Vue 局部样式另有作用域 |",
  "| 外链、日期、SEO、favicon | utils/linkHandler/dateFormat/seo/favicon；不是游戏 sharing / presentation |",
  "| 构建 | 根 vite.config.js 使用 Vue、CDN base、gzip、可选 prerender；游戏是独立 Vite 7 构建 |",
  "| 游戏复制接入 | 根 scripts/build-mc-clicker-2.mjs 先构建游戏，再替换 public/projects/mc-clicker-2；本轮线上用专用受控发布工具，避免全站重建 |",
  "",
  "主站内容验证：根目录 npm run check:content 与 npm run smoke；如果真实修改 Vue/主站样式，再按主站 AGENTS 运行完整验收。游戏的 npm test 不能替代它们。",
  "",
  "## 主站所有 src 文件",
  "",
  "| 文件 | 行数 | 导入 |",
  "|---|---:|---|",
  ...siteModules.map(
    (x) => `| ${x.path} | ${x.lines} | ${x.imports.join(", ") || "—"} |`,
  ),
  "",
  "## 配套工具怎么选",
  "",
  "- 游戏脚本以 package.json 的 test/build/balance/check:editions 为起点。scripts/verify-release-stability.py 和 verify-community-save.py 是发布链验证，scripts/ops 是本轮整理的网页版发布工具。",
  "- scripts 中的 build/render/fixture/measure/verify 分别是生成、渲染、合成样本、测量与验证；仅靠名称不能确认它适用于当前版本，必须读 URL、输入与输出参数。",
  "- docs/v*/qa 是验收证据；docs/research、archive 和工作区 spikes/services 不能当正式功能的权威。不要运行目录里每一个脚本来“扫库”，部分脚本会生成/覆盖大量文件。",
  "- dist、node_modules、artifacts、.venv 等 Git 忽略产物不属于本清单；不要把它们当待修源码。",
  "",
  "## 语法检查",
  "",
  errors.length
    ? JSON.stringify(errors, null, 2)
    : "主站 src 的 JS/Vue/CSS 解析无错误。这个结果不代表主站所有路由、视觉与外链已经浏览器验收。",
];
fs.writeFileSync(path.join(out, "REPOSITORY-MAP.md"), md.join("\n") + "\n");
console.log(
  JSON.stringify(
    {
      tracked: rows.length,
      siteSources: siteModules.length,
      areas: report.areas,
      errors,
    },
    null,
    2,
  ),
);
