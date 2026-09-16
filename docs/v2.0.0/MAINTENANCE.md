# Alpha.3 维护路由

先读 AGENTS.md 和双版本同步规则。schema 10；研究、生活、食物与生产共用真实前台 tick，不建 UI 计时器。

| 文件 | 权威职责 | 验证 |
|---|---|---|
| catalog / research | 价格、本体与时代许可、专项门槛、研究付款/暂停/切换/完成；RESEARCH_ITEM_GATES 与 RESEARCH_UNLOCKS | research / development / v2-lifecycle |
| villager-life | 错峰短休、幸福、全球娱乐资格、旧福利开支；serviceRange/serviceCapacity 只给步行动画使用 | villager-life / civic-sites / alpha3-services |
| food-config / food-service | 全村食物账本、210 秒需求周期、8/16/24 供餐容量、420 秒宽限、两次未吃饱后的温和负面效果 | alpha3-services |
| service-config / service-economy | 村民基础收入×份额，按时代上下限；每 60 秒前台时间报价，不能按钱包/手动暴富定价 | alpha3-services |
| life-menu | 三组九项互斥选择、实付活动增益、菜品 FIFO；已有饭不能切菜单变成高级饭；余额不足退回免费选项 | alpha3-services / verify-alpha3-ui / verify-save-image-ui --v2 |
| training-balance / work-quality | 旧书本效果冻结；新书本线性小幅成长与工种改造；货批生成时定价，交付不重复加价 | alpha3-services / work-rounds |
| power / power-compatibility | 实际需求/耗电/损耗/发电；已购旧供能补偿，不能脱离所属电源发电 | power / alpha3-services |
| operations / residents | 保留岗位和货物再休息，实际取货/成交；研究员为可选加速 | 原生产/物流回归 |
| civic-data / civic-sites | 食堂/小园分点编号、付费选址、免费搬动、收纳/回摆；食堂分点扩供餐，小园分点不叠幸福 | civic-sites / verify-v2-civic-ui |
| save-persistent / save-validation / game restore | JSON、紧凑码、图片、浏览器迁移；所有新字段走同一持久化，冻结旧字典不改 | 历史 save 系列与两版图片 UI |
| village-life-ui / village-life.css / main | 研发/生活展示与明确动作；只刷新必要状态；已购买单行添加村民，不重复工具栏按钮 | verify-alpha3-ui / verify-owned-coverage |
| world | 手机 .18 最小镜头比例，桌面 .45；显示与经营分开 | touch-camera / world-studio / mobile-camera |

当前数值及取舍见 ALPHA3-DELIVERY.md。旧候选文档仅用于追溯，不覆盖当前运行源码。旧档 serviceMode=legacy 保持原收费与幸福权益；用户主动启用后为 current。后台不推进研究、食物或支出。

快检：npm test；npm run build；npm run check:editions -- --peer <另一游戏目录>；node scripts/maintenance/scan.mjs 与 --check。XHS 额外 package:xhs 和离线审计。浏览器测试必须隔离存档。
