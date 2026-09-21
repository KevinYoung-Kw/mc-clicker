# MC Clicker 2.0

从第一块土地建成三维度大陆的点击与放置建造游戏。包含 98 项基础购买、52 项设施改造、村民岗位、真实供电与运输、世界直播、唱片、邮箱和分享纪念卡。由 **GPT-6 Astra** 根据 KevinYoung 的构想和玩家反馈持续制作，原有 NC Clicker 站点保留。

本仓库是网页版源码，从 [`my-profile`](https://github.com/KevinYoung-Kw/my-profile) 的 `projects/mc-clicker-2` 拆出，方便独立迭代。线上入口不变：[打开游戏](https://www.kw-aigc.cn/projects/mc-clicker-2/)，由主站 `public/projects/mc-clicker-2/` 托管构建产物。

| 发行 | 仓库 |
| --- | --- |
| 网页版 | 本仓 |
| 小红书版 | [`mc-clicker-xhs`](https://github.com/KevinYoung-Kw/mc-clicker-xhs) |
| 微信小程序 | [`mc-clicker-wechat`](https://github.com/KevinYoung-Kw/mc-clicker-wechat) |

把本仓与 `mc-clicker-xhs` 放在同一父目录后，`npm run check:editions` 会自动找到另一版本。历史 QA 截图仍在 `my-profile` 的 `projects/mc-clicker-2/docs/`，未全部迁入。

版本由 package.json 维护；线上发布记录见 [DEPLOYMENT.md](DEPLOYMENT.md)。当前规则、计划和历史归档从 [文档首页](docs/README.md) 进入。

构建产物可通过 my-profile 的 GitHub Actions 手动同步，具体见 [GitHub 同步说明](docs/maintenance/GITHUB-SYNC.md)。同步只更新主站仓库，腾讯云仍需独立验收和手动发布。

## 本地运行

需要 Node.js 22+。

```sh
npm ci
npm run dev -- --port 8890
```

进度保存在浏览器，可在设置中导入／导出。仅前台活跃时计算收益，返回页面不补发后台收入。

## 本轮交互

- 新玩家逐步购买通知、目标追踪、计数器与铭牌；必要操作说明与分享始终免费。
- 旁白根据采集、购物、派工和探索接话，跳过过期引导；手机菜单为字幕留出固定位置。中后期可以遇到私房钱和外出对话彩蛋。

- 设施改造随本体等级开放，列表先显示图标、用途和价格，点选一项查看具体数值。村庄／工业栏目保留开合、阅读位置和焦点。
- 扩地不限次数；主世界、下界、末地分别计价并逐次递增，旧档远处土地和建筑完整保留。

- 主菜单支持再次点击收起；收入栏可点击查看明细。设施状态与购买卡片统一布局，定位使用像素地图标记。

- 红石控制台集中管理公共电网。新设备首次点按接入，原位升级保留状态；接入免费，可暂停、恢复或断开，也可开启免费自动接入。
- 储物箱兼任物流调度入口。安排搬运工优先照看货源，或加入铜傀儡巡收范围；现有货批、交货点、岗位和结款规则共用同一套数据。
- 执行器通过增减按钮固定分配，侦测器只借用空闲名额。村民保留完整基础 B，工作成果额外计入。
- 工业面板和世界设施打开同一管理功能；线路图按真实位置展示。手机管理页默认展开，底部菜单始终保留。

商城保持统一选址、购买确认与连续购买流程。直播设备在独立室内管理，主持人与乐师来自真实村民岗位。40 件网页装扮、世界环境和场景布置分别管理；已取消商品试用和试听，购买前查看商品图，已购可切换或卸下。

## 验证

```sh
npm test
node scripts/check-doc-links.mjs
node scripts/balance-v143.mjs
npm run build
```

浏览器验证要求本地 8890 服务运行，使用 uv 管理 Python：

```sh
uv run --python 3.11 --with playwright scripts/verify-v143.py
uv run --python 3.11 --with playwright scripts/verify-land-v143.py
```

如尚未安装浏览器，先运行 `uv run --python 3.11 --with playwright playwright install chromium webkit`。调试入口 mcDebug 仅存在于开发环境；验证脚本使用隔离存档，不修改玩家进度。

## 文档与版本

- [开发文档索引](docs/README.md)：现行方案、后续版本和历史归档。
- [更新记录](CHANGELOG.md)：软件变更；策划修订号不代表已发布版本。
- [现行版本路线](docs/roadmap/ROADMAP.md)：当前已发布 V1.5.5（`4f8dd03`）；下一版按[V1.6 开发清单](docs/v1.6/PLAN.md)推进，依据[四项调研](docs/research/CURRENT-RESEARCH.md)，保留方向见[后续研究](docs/research/FUTURE-DIRECTIONS.md)。
- [历史策划归档](docs/archive/README.md)：过期根目录文档集中归档，内部链接已迁移；版本证据与截图保留原路径。
