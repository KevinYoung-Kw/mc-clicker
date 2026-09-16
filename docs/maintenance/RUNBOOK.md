# 网页版发布与日常运维

这份手册适用于网页版独立仓库 `mc-clicker`。小红书仓库不复制这些服务器脚本；使用自己的 `scripts/xhs/` 和平台打包流程。个人网站 `my-profile` 只同步 `public/projects/mc-clicker-2/` 的构建产物。

## 当前发行状态

2026-09-14：网页 `2.0.0-alpha.8`，发行提交 `6caddc6824efe1ef319d0ff1f5e32bf1de9ad950`，已部署到普通网址。当前线上manifest与验收在 `docs/v2.0.0/qa/alpha8-release/live/`；下一批应使用这里的manifest作为基线。

小红书源码 `2.0.0-alpha.8-xhs.1`（`3a44aed`）及ZIP同步，未提交平台审核。正式状态见DEPLOYMENT.md，以下命令示例中的历史版本号需要替换为本批实际参数。

## 先确认工作目录

- 网页游戏：本仓库根目录；`npm test` 是游戏测试，`npm run build` 用 Vite 7 构建游戏。
- 主站仓库 `my-profile`：Vue / Vite 5，有独立 npm 脚本和 CDN base。不要把两套 `src/main.js` 或 `dist` 混在一起。线上入口读取 `public/projects/mc-clicker-2/`。
- 小红书：独立 `mc-clicker-xhs`；其 `build:xhs/package:xhs` 生成离线小工具，不能替代网页构建。
- 先看 `git status --short`、当前分支、远端、最新提交。不要 `git add .` 把研究稿或主站文件带进本仓。

## 本地检查

在游戏目录，依次运行：

```sh
npm test
npm run build
node scripts/maintenance/scan.mjs --check
npm run check:editions -- --peer /实际的小红书游戏目录
```

新增行为需先跑最小针对性测试，发版再完整验证。Python 工具在 Mac 用 `uv run --with playwright python ...`；没有浏览器运行时才执行 `uv run --with playwright python -m playwright install chromium webkit`。端口冲突就改用空闲端口，不杀用户的服务。

```sh
npm run preview -- --port 8925 --strictPort
# 以下在另一个终端执行
uv run --with playwright python scripts/verify-release-stability.py \
  --url http://127.0.0.1:8925/ --out /tmp/mcc-release-candidate/production
MC_SAVE_QA_URL=http://127.0.0.1:8925/ \
  MC_SAVE_QA_OUT=/tmp/mcc-release-candidate/save \
  MC_SAVE_QA_PRODUCTION=1 MC_SAVE_QA_LARGE=1 \
  uv run --with playwright python scripts/verify-community-save.py
```

前者验证前/中/后期旧档、真实打开的菜单、前台推进与暂停、刷新；后者覆盖真实存档图导出、WebKit 导入、坏图/取消和备份。只使用合成存档和隔离浏览器，不注入玩家 profile。

## 从已提交版本制作发布包

使用**完整提交号**，不要用带其他任务未提交修改的工作树构建。所有路径选新的输出目录。示例中的参数需要先替换成该批真实值：

```sh
# 主站仓库根目录。REV 是本批已核对的完整 Git 提交号。
REV=<完整提交号>
RELEASE_ROOT=/tmp/mcc-本批版本-clean
mkdir -p "$RELEASE_ROOT"
git archive "$REV" | tar -x -C "$RELEASE_ROOT"
cd "$RELEASE_ROOT"
npm ci
npm test
npm run build
```

构建完成后把 `dist/` 同步到 `my-profile` 的 `public/projects/mc-clicker-2/`。在正式工作区的游戏根目录调用已审查工具：

```sh
uv run python scripts/ops/prepare-release.py \
  --source /tmp/mcc-本批版本-clean \
  --repository /实际/mc-clicker \
  --revision <完整提交号> \
  --baseline docs/v1.8/qa/live-1.8.7/manifest.json \
  --out /tmp/mcc-本批版本-release
```

工具核对源文件与指定 Git 提交，生成逐文件 SHA-256。只包含入口、包配置、`src/public` 和正式 `dist`，不带研究稿、截图、skill、个人网站源码。baseline 必须是**目前服务器实际运行**的 manifest，不是仅推送的候选。

## 服务器先检查，再写入

现有 SSH alias 为 `tencent-cloud`；访问授权由执行环境负责，不把私钥或登录口令写入仓库。上传 tar 时排除 Mac 扩展属性：

```sh
COPYFILE_DISABLE=1 tar --no-xattrs -czf /tmp/mcc-本批版本-release.tgz \
  -C /tmp mcc-本批版本-release
scp /tmp/mcc-本批版本-release.tgz tencent-cloud:/tmp/
scp scripts/ops/server-release.py tencent-cloud:/tmp/mcc-server-release.py
ssh tencent-cloud 'tar -xzf /tmp/mcc-本批版本-release.tgz -C /tmp'
# 默认只检查；没有 --apply 时不会改站点文件
ssh tencent-cloud 'python3 /tmp/mcc-server-release.py --stage /tmp/mcc-本批版本-release --backup /www/backups/mcc-本批版本-提交短号'
```

检查失败就读差异，不能用新 manifest 冒充旧基线来覆盖未知文件。通过后，在已有发布授权的范围内执行相同命令加 `--apply`。

脚本只写主站的构建目录：`public/projects/mc-clicker-2` 与 `dist/projects/mc-clicker-2`。不再把源码写进 `projects/mc-clicker-2`。资产先部署，HTML 与 `index.html.gz` 最后替换；保留旧 hash 资源。主站首页、旧 MC1 页面及 Nginx 配置前后校验不变。

每次使用新的备份路径，保存旧文件、manifest、受保护文件哈希和最终结果。此工具不是整个主站的一键重建，不重启 Nginx、不清 CDN、不处理数据库。

## 普通公网验证

```sh
uv run python scripts/ops/verify-public.py \
  --manifest <本批manifest.json> --out <本批公开验证目录>
uv run --with playwright python scripts/ops/verify-live-ui.py \
  --url https://www.kw-aigc.cn/projects/mc-clicker-2/ \
  --version V1.8.7 --out <本批UI证据目录>
```

还应在普通公网 URL 跑上面的存读流程。第一条比较 www/非 www、目录/index.html、identity/gzip 共 8 个入口和全部构建资源；不要只用 `?v=新值` 绕缓存后宣称旧链接已更新。

若服务器哈希正确而公网不一致：保留两端结果，检查普通入口、压缩副本、EdgeOne/CDN 缓存。按用户授权清对应缓存；不要清站点存档，也不要修改保存键“解决”旧版本问题。验证通过后把提交、备份、结果和限制追加到 `DEPLOYMENT.md`，保留历史记录。

## 回退

回退走同一条受控发布流程：选择已验收旧提交，在独立目录构建，**以当前服务器版本 manifest 为 baseline**，生成新的回退发布包，先计划检查，再写入新的备份目录。不可直接切 Git 后把脏目录覆盖到服务器。

如果新程序已经写入旧程序不支持的存档 schema，不能直接退程序；优先发布兼容修复。Alpha.6 的 schema 为 10；回退必须用受影响的合成样本验证目标旧构建能否读取。服务器备份的 `before/` 可用于事故对照；它不是浏览器存档备份。不要在生产机上试验没有核对过的递归覆盖/删除命令。

## 维护工具自身

`prepare-release.py` 只打包；`server-release.py` 默认计划模式、`--apply` 才写；`verify-public.py` 与 `verify-live-ui.py` 只读取服务器，浏览器写入仅发生在隔离测试 profile。修改运维脚本不虚增游戏版本，但需要静态检查、预演和差异审查，不能以本次部署成功推断修改后的脚本也通过。
