# 按问题找代码

所有路径相对**游戏根目录**。先 `rg -n '玩家看到的文字|DOM标识' src`，再追真正规则；下表给的是入口，不是允许只改一个文件的承诺。

| 工单 | 先读/改哪里 | 必须跟踪到哪里 | 最小检查 |
|---|---|---|---|
| 某商品基础价格、解锁前置 | `catalog.js` 对应 ID；`game.price/requirements/buy` | `purchase-spec.js`、`shopping-options.js`、相关推荐台词是否写死数字 | 对应购买/门槛测试；若改早期数值跑 `early-balance-v16.test.js` 与 `scripts/balance.mjs`，记录而非凭感觉改平衡 |
| 本体等级与改造收益看不懂 | `upgrade-catalog.js`、`upgrades.js` | `upgrades-ui.js`、实际 raw/process/work/power 读取者 | `upgrades.test.js` 及对应设施测试；前后同档同 tick 比较 |
| 邮政升级价格/收益 | `mail.js` 的 `POSTAL_RATES/POSTAL_UPGRADE_COSTS` | `upgradePostal`、`game.tick`、`mail-ui`、推荐/回本计算 | `node --test tests/mail.test.js tests/production-boundaries-v17.test.js`；首级、逐级、满级与存档 |
| 奖励信内容 | `mail-content.js` | 历史邮件 ID、`mail.js` 领取状态；两版文案/外链是平台差异 | `tests/mail.test.js`；读信不领、按领取时实际速率、已领不再领 |
| 购买受阻原因 | `purchase-feedback.js` | `game.requirements` 与 `layout` 真实阻断 | `purchase-feedback.test.js purchase-routing.test.js`；缺钱/缺前置/选址/满级 |
| 数字挤动或格式不统一 | `hud-numbers.js`、对应 UI refresh | `hud-style.css`、组件 CSS 的等宽数字和固定列 | 格式测试与 320/390/1440px 实际不断更新；不要改 `s.rate` 计算 |
| 按钮、等级换行 | 生成 markup 的领域 UI + 领域 CSS | 基座、mobile、theme 同 selector；见 UI 专章 | 小屏+桌面+至少默认/深色主题；触点、tab、滚动、焦点 |
| 村庄/工业首屏、瓶颈颜色、关联改善商品 | `management-overview.js`、`production-summary.js`、`production-guide.js` → `production-guide-ui.js`、`network-ui.js`、`management-ui.js` | `game.rates` 的真实能力和 `purchaseStatus/upgradeStatus`；货批分段、实际成交；不把村民取货混入区域运输增益 | `management-overview.test.js production-guide.test.js`；`verify-operations-overview.py` 与 `verify-production-guide.py`，后者支持 `--production` |
| 村民分配/搬运不动 | `residents.js`、`operations.js`、`workplace-board-ui.js` | 岗位槽、运货中不可换岗、真实到场、线路、货批 | `community.test.js work-rounds.test.js resident-jobs-ui.test.js`；给定存档重现 |
| 钱没涨/收入不一致 | `game.tick/earn`、`income.js` | 库存→订单/工程→成交、邮政/居民 B/直播分项 | `production-boundaries-v17.test.js settlement-v17.test.js`；不能把每条流量再发一次钱 |
| 电量充足但设备不运行 | `power.js`、`task-controls.js`、`facility-status.js` | 接入、启停、供电比例、自动化名额、缺货/满仓 | `unified-power.test.js task-controls.test.js` 等实际存在的相关测试；保留真实原因 |
| 物流线或矿车太密 | `rail-traffic-view.js`、`rail-model.js`、`world.js` | `transport.js` 流量与实际运输数据 | 视觉+旧档；仅少画车不能减少运力/收入 |
| 物件闪烁/模型外形 | `objects.js` 分派→对应模型→`models.js` | 重叠面、透明/深度、实例合批、碰撞和可点击对象 | `surface-stability.test.js block-style.test.js` + 同镜头多角度截图 |
| 建造位置/朝向/连续模式 | `main.js` placement、`editing.js`、`layout.js` | 建造提交、取消返回、`World.setMode`、对应住房/园艺规则 | `world-editing.test.js construction-preview.test.js` + 手机选择/取消/连建 |
| 广播过早赚钱／电视和流媒体解锁／旧档频道 | `broadcasting.js` → `game.rates/tick/restore`；`research.js`、`catalog.js` | `broadcasting-ui.js`、`studio-ui.js`、`main.js`、旁白；阶段上限同时约束主持／活动／礼物，已有旧档保留完整资格 | `broadcasting.test.js research.test.js`、`verify-broadcast-ui.py`；经济证据见 `docs/v2.0.0/ALPHA6-BROADCAST.md`，勿把 UI 样本注资算作回本 |
| 直播间物品重叠/重新换装占位 | `studio-placement.js`、`studio-ui.js` | 实际模型高度 `village-models/studio-decoration`、合批前移除待摆放节点、旧位置校验 | `studio-placement.test.js studio-purchases.test.js` + 满配房间移动/取消/刷新；装饰是同类替换，收藏样本单列 |
| 分享卡数据/版式/缺少内容 | `share-stories.js` → `share-story-painter.js` / `share-card-painter.js` → `share-card-ui.js`；平台 `share-ui.js` | 内容免费、皮肤按已购；真实入账、未解锁不剧透、取消不改档；XHS `xhs-note.js` 只交给编辑页 | `share-stories.test.js`、`verify-alpha5-sharing.py`、`verify-alpha5-content.py`；不要用拍照次数代替经营统计 |
| 成就条件、进度、永久记录 | `achievements.js` → `achievements-ui.js`、`atlas-ui.js`；`game.checkAchievements/restore` | 条件与进度同源；已有 ID 不重排；已达成记录随 JSON/图片保留；不靠假进度改收入 | `achievements.test.js`、`verify-alpha8-achievements.py`；真实交货/供餐/分田、返回、旧档、手机主题 |
| 图鉴分类／生活设施设置入口 | `atlas-ui.js`、`village-life-ui.js`；`main.js` 接入 | 图鉴完成统计仍用 `atlas-progress.js`；生活选择仍用 `life-menu.js`，旧福利不能自动转付费 | `verify-alpha7-ui.py`；分栏、设施点击、升级解锁、费用、取消、返回、刷新；按 `UI-REVIEW.md` 复查 |
| 图鉴合集买齐仍未勾选 | `atlas-progress.js` | `webAppearance.owned/scenery.owned/environment.modules`、`main` 图鉴、`share-ui/victory-card` | `atlas-progress.test.js`；部分/全部/旧合集/卸下/收纳/刷新；不要伪造 `counts` 来补进度 |
| 小红书菜单/图鉴入口 | **XHS** `main.js`、`mobile-tools.js`、`xhs-layout.css` | `narrator-companions.js` 飞入目标、`catalog/narrator-copy` 说明、全屏/直播间/摆放状态 | `scripts/verify-v187.py`；按钮复用快捷栏样式；Web 保留顶部菜单 |
| 旁白说晚了/买过还推荐 | `narrative.js`、`narrator-context/behavior*.js` | 入队及播放时资格、购买拓扑、`narrator-ui.js` 抑制条件 | `narrative*.test.js`；乱序购买、快买、挂机、静音；改台词不等于修触发 |
| 旁白口吻/一条文案 | `narrator-copy.js` 或 `narrator-midgame*.js` | 该 ID 的触发、前后话、已解锁/未解锁条件 | 独立读得通，不假定先前购买顺序；不要改稳定 ID |
| 未购唱片机听不到音效 | `records-ui.js`、`game-audio.js` | L1 解锁、真实用户手势、sound/volume、前台 | `audio-settings.test.js` + 浏览器实际点击；不把设置切换接到收益 |
| 小红书加载/开始按钮 | **XHS** `index.html`、`xhs-start.js`、`xhs-session.js`、`xhs-start.css` | 未开始不推进、重复点击、fallback、safe area | `xhs-session.test.js` 及 `scripts/xhs/check-loading.py`；Web 不新增强制开始 |
| 存档乱码、导入丢东西 | `save-ui.js`→`save-*.js`→`game.restore` | 固定字典、Worker/主线程、备份、未来版本拒绝 | 存档专章；历史固定样本与跨浏览器流程；高风险升级审查 |
| 主站项目封面/排序 | **主站根目录** `src/sites/resume/config*.js`、`DemoView.vue` | 中英文配置、图片 public路径、首页 flow | 根目录 `npm run check:content` / `npm run smoke`；不改游戏 UI |

上表中的测试名先用 `rg --files tests` 确认，文件可能随维护演进；权威的当前直接依赖映射见 `FILE-MAP.md`。不要把缺失测试路径“修”成空测试。

## 小模型执行上限

- **可直接做**：范围已确定的一处展示/文案/数值字段；知道消费该字段的规则与平台归属，能验证具体前后行为。
- **做完需要复核**：影响购买拓扑/数值体验、多处 UI、两个混合入口，或修改结果无法通过一个具体场景解释。
- **先停下报告发现**：需要改存档格式、结算时序、跨世界链路、生命周期、模型批处理；目标和验收不明；为了通过检查想直接接受全部平台差异。

“先停下”是提交当前定位和证据给维护者，不是删除失败测试或另起一套规则。
