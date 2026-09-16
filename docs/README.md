# MC Clicker 开发文档

> **2026-09-14 · V2.0.0-alpha.8：网页版已部署，小红书源码与离线包已同步，未提交平台审核。** [发布核验](v2.0.0/qa/alpha8-release/README.md) · [成就册](v2.0.0/ALPHA8-ACHIEVEMENTS.md)。

**线上：V1.8.9 · `b1aa03a`**，GitHub 与云端已同步。[打开游戏](https://www.kw-aigc.cn/projects/mc-clicker-2/)后刷新即可更新，无需版本参数。[发布与验证](../DEPLOYMENT.md)。

**V1.7.0-alpha.5 已发布。** 九项教学图统一并补齐版本日志，包含 alpha.4 的摆放范围、升级重复寻路和岗位教学重复修复；581 项测试与公网桌面、390px、320px 检查通过。所有 V1.6／V1.7 alpha 批次已补入 **[版本更新记录](CHANGELOG.md)**；升号时必须增加对应条目，不能将本地验证写成线上发布。

[V1.8 正式版范围与后续边界](v1.8/README.md)：设施／空房收纳、连续整理、三种基础住房、命令方块与信标已上线，见[V1.8.1 关闭表](archive/v1.8.1-delivered.md)。上面的 alpha.5 段落为历史记录；最新逐批变化见版本更新记录。

## 排期与需求

| 入口 | 看什么 |
| --- | --- |
| **[下一批工作顺序](v1.7/NEXT-ITERATION.md)** | 旧验证专项暂缓；当前候选以需求池为准 |
| **[版本更新记录](CHANGELOG.md)** | V1.6 alpha.1–5、V1.7 alpha.1–5 的变化（alpha.4 随 alpha.5 发布）和发布状态；以后每个修复批次新增一条 |
| **[本轮群聊核查与评估](v1.7/ALPHA3-FEEDBACK-AUDIT.md)** | 24 项反馈逐条核查；已修关闭，五项新候选拆解，真机待复现另列 |
| [V1.7 版本进度](v1.7/PLAN.md) | alpha.5 已发布；已交付与剩余验证边界 |
| **[当前剩余需求池](v1.6/DEMAND-POOL.md)** | 已排任务、真机观察、未定候选、后续版本；已交付项目不再混在待办里 |
| **[V1.7 已交付关闭](archive/v1.7-alpha1-delivered.md)** · [V1.6 关闭归档](archive/closed-2026-09-09/README.md) | 本次生产／经营／旁白／电力交付，及此前 21 组范围与旧编号去向；不是再次开发清单 |
| [版本路线](roadmap/ROADMAP.md) | 已发布与未开发版本状态；V1.8 教程邮箱仍取消 |
| [V1.6 收尾](v1.6/NEXT-ITERATION.md) | 仅真机、长期性能与新人理解度回访 |
| [V1.6 稳定性复核](v1.6/STABILITY-REVIEW.md) | 547 项规则测试、线上操作、模型修复、密集场景结果及实际边界 |
| [当前研究入口](research/CURRENT-RESEARCH.md) | alpha.5 基线与 V1.7 修复对照；历史证据保留 |
| [后续方向](research/FUTURE-DIRECTIONS.md) | 三世界差异玩法、农牧扩张与通关后收藏 |

当前保留 **6 组未排开发候选**，4 个验证／回访工作包继续暂缓。设施／空房收纳、全建筑连续整理、线路显示已随 V1.8.1 关闭；多地预选等五项已取消。后续农牧、收藏与三世界研究另列，详见需求池。

## 现行规则与交付记录

| 文档 | 用途 |
| --- | --- |
| [alpha.5 操作图解](v1.7/ILLUSTRATED-GUIDE.md) · [alpha.4 修复](v1.7/ALPHA4-STABILITY.md) | 同批已发布；统一图片、摆放范围、升级寻路、岗位教学与版本日志 |
| [alpha.3 群聊核查](v1.7/ALPHA3-FEEDBACK-AUDIT.md) · [货运修复](v1.7/FREIGHT-BUGFIX.md) | 已发布；金额遗漏、恢复入口、旧档标记和真实等待原因 |
| [装扮专项与验收册](v1.7/APPEARANCE-POLISH.md) | 46 件装扮、六主题、10 款指针，牌匾与通知修复；已发布 |
| [现行规则](CURRENT-RULES.md) | 购买、收入、岗位、存档、分享及取消教程邮箱的决定 |
| [V1.6 交付范围](v1.6/PLAN.md) | 各 alpha 批次与保留规则 |
| [八种住房](v1.6/HOUSING-FIRST-PLAYABLE.md) | 免费领取、手动建造、房型解锁、旧档迁移 |
| [园艺首批](v1.6/GARDEN-FIRST-PLAYABLE.md) | 27 件地表／花草／林木／景观，清理、收纳与复用 |
| [alpha.3 搬运与节奏](v1.6/ALPHA3-PACING-AND-EDITING.md) | 铜傀儡、前期运力、策略模拟与实际限制 |
| [alpha.4 连续编辑](v1.6/ALPHA4-WORLD-EDITING.md) · [自审](v1.6/ALPHA4-UX-REVIEW.md) | 连续扩地、空地整理、园艺模式、朝向与手机面板 |
| [最新旁白审稿清单](v1.5.6/NARRATOR-COPY-REVIEW.md) | 保留 N01–N88 编号，87 组、125 条；逐句修改从这里开始 |
| [旁白独立句与顺序](v1.5.6/COPY-AND-CONTEXT.md) | 已随 alpha.1 发布；整局验证另归 V1.7 |
| [基础购买目录](CATALOG.md) · [JSON](purchase-catalog.json) | 固定价格与解锁；改造另见[52 项审计](v1.4.3/UPGRADE-AUDIT.md) |

## 历史与维护

- [历史总索引](archive/README.md)：旧方案、实施和验收；[原始群聊拆解](v1.6/CHAT-FEEDBACK-SCHEDULE.md)保留原文，当前状态只在需求池维护。
- [2026-09-08 策划归档](archive/planning-2026-09-08/README.md)：17 份旧方案与讨论；[2026-09-09 需求关闭归档](archive/closed-2026-09-09/README.md)保存本次清理前全文。
- 发布 QA、截图、模拟结果保留原路径；历史证据不自动代表当前版本通过。
- 软件版本由 package.json 维护，主存档格式仍为 7；每批可发布修复升一个 alpha 号，并在[更新记录](CHANGELOG.md)新增条目。测试检查最新条目与版本号一致；只整理文档不升游戏版本。
- 目录生成：`node scripts/catalog-doc.mjs`；链接检查：`node scripts/check-doc-links.mjs`。
