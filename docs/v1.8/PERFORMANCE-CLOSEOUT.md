# V1.8.2 · 封板前性能与代码收尾

2026-09-10。V1.8.2（`7172d4a`）已同步 GitHub 和腾讯云。公网界面、资源与图片存档回归见 `qa/live-1.8.2/`。本批在已有商城推荐和纪念景物改动上收尾，不调整生产数值、解锁或旁白文案，不新增持久字段。

## 已处理

| 热点 | 改动 | 保留的行为 |
| --- | --- | --- |
| 接线和物流比较候选路径时，反复检查相同地图 | 抽出内部 `routeOnGrid`，一次同步查询复用已经校验的网格 | 对外仍逐次校验；搬动、转向、收纳、土地变化仍重算。没有可用起点时仍不创建网格 |
| 旁白 UI 和推进函数在同一帧各检查一次候选 | UI 预检查后，推进函数复用本次结果；独立模拟入口保留默认检查 | 触发、过期清理、忙碌、暂停、语音与句间停顿不变 |
| 村民避让寻路重复检查已通行的地形和建筑 | 网格邻接边只重查动态人物占位；出入口与路径平滑仍做完整扫探检查 | 不穿墙、不跨空地、不改变与人物的间距和路线 |
| 每帧读取头像的屏幕位置 | 只在吸入商城、朋友登场时读取 | 动画仍从当前头像位置出发 |
| 每次创建纪念景物时分配文字牌几何体 | 共享单位平面，通过缩放保持每块牌子尺寸；继续复用文字材质 | 外观、占地、转向和预览不变；不处置被其他模型复用的材质 |
| 未变化的计数文字和指南隐藏状态仍重复写入 DOM | 值未变化时跳过写入 | 金额变化仍跟随原刷新节奏 |

只重构确认的热点，没有全仓格式化或更换渲染引擎。也没有用降低模拟频率、删动画、减少村民或延迟教程的办法换取性能。

## 优化前后数据

同一台 Mac、Chromium / Metal、1440×960，固定存档，每场景采样约 7 秒。下面是开发构建 CPU 分析器的累计采样时间，不是单帧耗时，也不是手机帧率保证。

| 密集场景（7,442 个模型实例） | 优化前 | 优化后首次 | 优化后复测 |
| --- | ---: | ---: | ---: |
| 游戏主循环累计 CPU 采样 | 974ms | 663ms | 604ms |
| 旁白处理累计 CPU 采样 | 447ms | 208ms | 173ms |
| 路线签名累计 CPU 采样 | 246ms | 96ms | 78ms |
| 帧间隔 P95 | 17.5ms | 17.6ms | 17.4ms |

主循环计算负担减少约 32%–38%；帧率原本已接近 60fps，所以不把这写成帧率提升。GPU 渲染工作仍存在，复杂场景不会因此变成零开销。

独立线路查询对照：两份存档各运行五轮，每轮 22,800 次查询；交替执行前后实现。最终中位数：密集存档 **79.4 → 45.7ms**，全内容存档 **81.5 → 50.9ms**。路径、长度、连接结果，以及搬动转向、移除仓库、门户条件和土地变化后的结果逐项一致。

连续切换三个世界五轮：首次下界 / 末地切换处理约 43.7 / 21.6ms，之后约 3.2–5.7ms。此数值是点击处理时间，不包括所有 GPU 完成时间。

- [优化前采样](qa/performance/before/baseline.json)
- [优化后采样](qa/performance/after/baseline.json)
- [优化后复测](qa/performance/after-repeat/baseline.json)
- [独立线路对照](qa/performance/routing-report.json)
- [正式构建 30 秒帧采样](qa/performance/dense-production-30s.json)

进一步排查长任务：不挂 CPU 分析器的正式构建仍出现了 66 / 126ms 的长任务，确认需要继续处理。时间线和延长采样定位到村民避让搜索反复调用完整静态碰撞检查；复用已校验的导航边后，24 条避让路径的五轮耗时中位数由 **156.3ms 降到 13.5ms**（约减少 91%），逐条路径保持一致。两种人物半径下，含建筑和缺口的所有邻接边也逐项对照完整扫探检查。

正式构建最后一轮 30 秒无分析器采样：P95 **16.8ms**，最大帧间隔 **33.4ms**，**0 次超过 50ms 的长任务**。之前同场景最大帧间隔为 117.5ms。这是固定样本的短时观测，不承诺任意地图、所有硬件均不掉帧。

[避让路径对照](qa/performance/traffic-report.json) · [进一步优化前帧记录](qa/performance/dense-production-before-traffic.json) · [最终帧记录](qa/performance/dense-production-30s.json)

## 回归结果

- **710 项全量测试通过**。包括历史存档格式、图片与存档码、生产收益、设备收纳、搬动、线路和旁白；随后更新日志的发行元数据检查也通过。
- 新增旁白对照：第一次玩 / 之前玩过，各推进 1,200 步，穿插购买和忙碌阶段，逐步比较优化前后对话状态。
- 新增资源检查：30 次重建纪念景物时复用相同文字几何体和材质；模型尺寸保留。
- 正式构建，桌面 Chromium / 移动 WebKit，各读取前、中、后期隔离存档：保留所有权与布局，继续运行，菜单开关后画面正常，后台暂停，保存刷新可继续，共六组通过。
- 正式构建图片存档：Chromium 导出 → WebKit 导入；验证纪念景物位置、库存与领取记录，取消和坏图不覆盖当前世界，刷新后保留；实际点击备份恢复，回到导入前的世界。
- 桌面与移动端真实开场操作：吸入商城和三位朋友登场位置有效，飞行结束后无残留禁用状态。
- 桌面与移动端各连续重建含三件纪念景物的场景 16 次：GPU 几何体始终 5 个、纹理 21 张，没有随重建次数增长。
- 1440 / 390 / 320px 完成纪念品领取、取消、转向、摆放、收回、刷新，无横向溢出与页面异常。

一次 320px 开发页检查在模块热更新时中断（目标按钮被替换），未作为通过结果；固定源码后，三组交互完整重跑通过。

[正式构建回归](qa/performance/production/report.json) · [图片存档与备份](qa/performance/production/save/save-report.json) · [开场与资源检查](qa/performance/interactions/report.json) · [纪念景物交互](qa/community-keepsakes/report.json)

## 封板边界

本轮未发现需要继续修改收益、存档格式或交互流程的回归。可作为 V1.8.2 封板候选，后续不再增加功能；发布前后继续按 [发布要求](../RELEASE-CONTRACT.md) 执行。

验证使用桌面浏览器及移动端模拟，不等于微信内置浏览器实机，也没有完成 80 分钟真机发热测试。正式构建仍有包体告警：主包约 835KB（gzip 314KB），Three 约 520KB（gzip 131KB）；本轮未进行缺少收益证据的大规模拆包。慢网首次加载和实体手机长时间发热保留为验证边界，不宣称已经消除。

## 复现

```sh
npm test
npm run build
npm run preview -- --port 8933
node scripts/verify-routing-performance.mjs
node scripts/verify-traffic-performance.mjs
uv run --python 3.11 --with playwright python scripts/verify-release-stability.py
MC_SAVE_QA_URL=http://127.0.0.1:8933/ MC_SAVE_QA_PRODUCTION=1 MC_SAVE_QA_OUT=docs/v1.8/qa/performance/production/save uv run --python 3.11 --with playwright python scripts/verify-community-save.py
uv run --python 3.11 --with playwright python scripts/verify-dense-frame.py
```

开发页工具另需 `npm run dev -- --port 8932`：`scripts/profile-performance.py --help`、`scripts/verify-freeze-interactions.py`、`scripts/verify-community-keepsakes.py`。浏览器性能测试串行运行，期间不要改源代码或并行跑其他 GPU 任务。
