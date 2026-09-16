// Read all runtime modules; generate exact imports/exports and direct-test edges.
// Rollup is already part of Vite. This script adds no production dependency.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { parseAst } from "rollup/parseAst";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const out = path.join(root, "docs/maintenance");
fs.mkdirSync(out, { recursive: true });
const groups = [
  [
    "startup",
    "启动与输入",
    "main startup-storage release foreground keyboard-mining mining-combo input-guidance manual-cue first-steps opening-guide opening-shop shop-onboarding navigation panel-memory mobile-tools xhs-",
  ],
  [
    "economy",
    "经营与结算",
    "game$ economy income catalog production-guide orders market-ledger market-work market-status-ui production-summary",
  ],
  [
    "people",
    "居民与岗位",
    "farm-sites food- life-menu service- training-balance work-quality civic-data civic-sites villager-life village-life life-models operations residents population resident-jobs resident-motion workplace-board community-models companion-models mob-motion mob-models",
  ],
  [
    "power",
    "供电与自动化",
    "power network command-dispatch task-control task-controls",
  ],
  ["transport", "物流与铁路", "transport routing rail- dimensional"],
  [
    "progress",
    "购买与成长",
    "research development guidance purchase shopping-options progression upgrades upgrade- facility-capacity facility-growth facility-status facility-shops",
  ],
  [
    "world",
    "世界与建造",
    "world world-projection layout land construction-preview editing building-storage facility-storage objects models block-materials voxel-geometry pickaxe gain-layer end-portal facility-models industrial-models network-models village-models mine-model mailbox-model mob-models",
  ],
  ["housing", "住房与园艺", "housing garden natural-scenery terrain"],
  ["studio", "直播间", "studio- broadcasting"],
  [
    "environment",
    "观象台与天气",
    "atmosphere environment observatory weather-window beacon-light",
  ],
  [
    "narrator",
    "旁白与事件",
    "narrative narrator notice-face notifications panel-notice-lane easter-egg easter-eggs community-narration community-stories community-souvenirs",
  ],
  [
    "audio",
    "音乐与音效",
    "game-audio records record-art record-scores score-player narrator-prosody narrator-voice",
  ],
  [
    "appearance",
    "装扮与收藏",
    "appearance achievements atlas-progress atlas-ui collection decoration- web- specialty-stalls presentation presentation-migration-map site-brand icons",
  ],
  ["project", "世界工程与胜利", "project victory"],
  ["save", "存档与分享", "save- share- sharing xhs-album vendor"],
  [
    "ui",
    "通用界面样式",
    "style hud- mobile- management- interface-polish first-steps early-game guidance-style purchase-style upgrades-style game-select tutorial-figures version-history facility-controls realm-picker touch-camera",
  ],
  ["mail", "邮箱与奖励", "mail"],
];
function groupFor(p) {
  const base = path.basename(p).replace(/\.[^.]+$/, "");
  if (p.includes("/easter-eggs/")) return ["narrator", "旁白与事件"];
  if (p.includes("/assets/")) return ["assets", "内置资源"];
  if (p.includes("/save-format/")) return ["save", "存档与分享"];
  if (p.includes("/vendor/")) return ["save", "存档与分享"];
  for (const [id, label, patterns] of groups)
    if (
      patterns
        .split(" ")
        .some((s) =>
          s.endsWith("$")
            ? base === s.slice(0, -1)
            : s.endsWith("-")
              ? base.startsWith(s)
              : base === s || base.startsWith(s + "-"),
        )
    )
      return [id, label];
  return ["review", "待人工核对"];
}
const walk = (d) =>
  fs.existsSync(d)
    ? fs
        .readdirSync(d, { withFileTypes: true })
        .flatMap((e) =>
          e.isDirectory()
            ? walk(path.join(d, e.name))
            : e.isFile()
              ? [path.join(d, e.name)]
              : [],
        )
    : [];
const src = walk(path.join(root, "src")).sort();
const tests = walk(path.join(root, "tests"))
  .filter((f) => /\.[cm]?js$/.test(f))
  .sort();
const nodes = [];
const errors = [];
const rel = (f) => path.relative(root, f).split(path.sep).join("/");
function parse(f) {
  const text = fs.readFileSync(f, "utf8"),
    imports = [],
    exports = [];
  let ast;
  try {
    ast = parseAst(text);
  } catch (e) {
    errors.push({ file: rel(f), error: e.message });
    return { imports, exports };
  }
  function source(value) {
    if (typeof value !== "string") return;
    let target = value;
    if (value.startsWith(".")) {
      target = rel(path.resolve(path.dirname(f), value));
      if (!fs.existsSync(path.join(root, target)))
        errors.push({ file: rel(f), missing: target });
    }
    imports.push(target);
  }
  function ids(n) {
    if (!n) return;
    if (n.type === "Identifier") exports.push(n.name);
    else if (n.type === "ObjectPattern")
      n.properties.forEach((p) => ids(p.value || p.argument));
    else if (n.type === "ArrayPattern") n.elements.forEach(ids);
    else if (n.type === "AssignmentPattern") ids(n.left);
    else if (n.type === "RestElement") ids(n.argument);
  }
  function visit(n) {
    if (!n || typeof n !== "object") return;
    if (n.type === "ImportDeclaration" || n.type === "ExportAllDeclaration")
      source(n.source?.value);
    if (n.type === "ImportExpression") source(n.source?.value);
    if (n.type === "NewExpression" && n.callee?.name === "URL")
      source(n.arguments?.[0]?.value);
    if (n.type === "ExportNamedDeclaration") {
      source(n.source?.value);
      for (const s of n.specifiers || [])
        exports.push(s.exported.name || s.exported.value);
      if (n.declaration?.type === "VariableDeclaration")
        n.declaration.declarations.forEach((d) => ids(d.id));
      else ids(n.declaration?.id);
    }
    if (n.type === "ExportDefaultDeclaration") exports.push("default");
    for (const v of Object.values(n))
      if (Array.isArray(v)) v.forEach(visit);
      else if (v && typeof v === "object") visit(v);
  }
  visit(ast);
  return {
    imports: [...new Set(imports)].sort(),
    exports: [...new Set(exports)].sort(),
  };
}
for (const f of [...src, ...tests]) {
  const p = rel(f),
    buf = fs.readFileSync(f),
    [group, label] = p.startsWith("tests/") ? ["tests", "测试"] : groupFor(p),
    js = /\.[cm]?js$/.test(f);
  nodes.push({
    path: p,
    group,
    label,
    bytes: buf.length,
    lines: /\.(js|css|json|md)$/.test(f)
      ? buf.toString().split("\n").length
      : null,
    sha256: crypto.createHash("sha256").update(buf).digest("hex"),
    ...(js ? parse(f) : { imports: [], exports: [] }),
  });
}
for (const n of nodes) {
  n.importedBy = nodes
    .filter((other) => other.imports.includes(n.path))
    .map((o) => o.path);
  n.directTests = n.importedBy.filter((p) => p.startsWith("tests/"));
}
const totals = {
  sourceFiles: src.length,
  testFiles: tests.length,
  sourceLines: nodes
    .filter((n) => n.path.startsWith("src/"))
    .reduce((s, n) => s + (n.lines || 0), 0),
};
const report = {
  version: JSON.parse(fs.readFileSync(path.join(root, "package.json"))).version,
  scope:
    "All src files and JS tests; AST import/export edges, NOT a proof of test coverage or dynamic call graph.",
  totals,
  errors,
  nodes,
};
const json = JSON.stringify(report, null, 2) + "\n";
const target = path.join(out, "file-map.json");
if (process.argv.includes("--check")) {
  const existing = JSON.parse(fs.readFileSync(target));
  delete existing.repoInventory;
  const comparable = { ...report };
  delete comparable.repoInventory;
  const ok =
    JSON.stringify(existing) === JSON.stringify(comparable) &&
    errors.length === 0;
  console.log(JSON.stringify({ ok, ...totals, errors }, null, 2));
  process.exit(ok ? 0 : 1);
}
fs.writeFileSync(target, json);
const rows = [
  "# 全量文件索引",
  "",
  `自动扫描 ${totals.sourceFiles} 个 src 文件、${totals.testFiles} 个 JS 测试文件。模块关系来自 AST 的静态导入、动态 import 字面量和 new URL 字面量；测试列只表示直接引用，不能据此断言完整覆盖。CSS 的实际层叠顺序见 UI 手册。`,
  "",
  "刷新：`node scripts/maintenance/scan.mjs`；只读核对：`node scripts/maintenance/scan.mjs --check`。本表不代替人工职责说明；完整导出、反向引用与哈希见 [file-map.json](file-map.json)。",
];
for (const id of [
  ...new Set(nodes.filter((n) => n.group !== "tests").map((n) => n.group)),
].sort()) {
  const list = nodes.filter((n) => n.group === id);
  rows.push(
    "",
    `## ${list[0].label}`,
    "",
    "| 文件 | 行数 | 主要导出（最多 6 项） | 直接测试 |",
    "|---|---:|---|---|",
  );
  for (const n of list)
    rows.push(
      `| [${n.path}](../../${n.path}) | ${n.lines || "—"} | ${n.exports.slice(0, 6).join(", ")}${n.exports.length > 6 ? "…" : ""} | ${n.directTests.map((t) => t.replace("tests/", "")).join(", ") || "参照上层流程测试"} |`,
    );
}
rows.push(
  "",
  "## 扫描异常",
  "",
  errors.length ? JSON.stringify(errors) : "无无法解析的 JS 或缺失的相对导入。",
);
fs.writeFileSync(path.join(out, "FILE-MAP.md"), rows.join("\n") + "\n");
console.log(
  JSON.stringify(
    {
      ...totals,
      errors,
      unclassified: nodes
        .filter((n) => n.group === "review")
        .map((n) => n.path),
    },
    null,
    2,
  ),
);

// A sparse or broken checkout must not be reported as a successful scan.
if (errors.length) process.exitCode = 1;
