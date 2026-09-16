# 全仓边界与主站接入

基于 Git 提交 `11b35bbdfbcf50da546bf52107c5f165d3dd8de3` 的工作区清单：7340 个已跟踪路径。记录文件位置与大小，并解析 59 个主站 src 文件（Vue 的 script/style 分别检查）；MC2 全量源码关系另见 FILE-MAP。未跟踪工作只记分类数量，不把其他任务的草稿/私人样本写入清单。

这不是逐行证明所有历史截图、文档和旧 demo 都无 bug。正式游戏按领域人工追踪，主站按入口/组件/配置/构建边界核查，静态文件按资产分类。完整逐文件清单见 [repository-inventory.json](repository-inventory.json)。

## 所有已跟踪目录分类

| 分类 | 文件数 |
|---|---:|
| game-assets | 157 |
| game-config | 11 |
| game-docs | 270 |
| game-evidence | 5092 |
| game-experiments | 31 |
| game-history-research | 90 |
| game-source | 239 |
| game-tests | 112 |
| game-tools | 201 |
| repository-config-other | 112 |
| website-source | 59 |
| website-static | 959 |
| website-tools | 7 |

## 主站与游戏不是同一个前端

主站路径 `src/` 均相对 my-profile 根目录。游戏路径相对 projects/mc-clicker-2；小红书不包含下面的 Vue 源码。

| 功能 | 主站文件与流向 |
|---|---|
| 入口 | index.html → src/main.js → src/App.vue → router/index.js → sites/resume/App.vue |
| 中英文内容 | sites/resume/config.js / config_en.js；共用结构与文字在 config.factory.js |
| 首页与页面切换 | sites/resume/App.vue 的 flow/tiles、overlay、历史路径、语言与 inert/focus 处理 |
| 项目列表与封面 | components/views/DemoView.vue、resume/SeriesHeroSection.vue，加 config 的 demos 数据；MC2 游戏逻辑不在这里 |
| 文章/简历/合作 | components/views 各 View，数据由 props/config 提供 |
| 卡片编辑器 | components/tools、composables/useCardExport.js；不是游戏纪念卡 |
| 公共交互 | common/ControlButtons、Toast、BackButton、CustomCursor、IntroCard、Footer、StatusBanner |
| 样式 | variables → global → header-flow → tiles → main；Arco CSS 在这些之前，Vue 局部样式另有作用域 |
| 外链、日期、SEO、favicon | utils/linkHandler/dateFormat/seo/favicon；不是游戏 sharing / presentation |
| 构建 | 根 vite.config.js 使用 Vue、CDN base、gzip、可选 prerender；游戏是独立 Vite 7 构建 |
| 游戏复制接入 | 根 scripts/build-mc-clicker-2.mjs 先构建游戏，再替换 public/projects/mc-clicker-2；本轮线上用专用受控发布工具，避免全站重建 |

主站内容验证：根目录 npm run check:content 与 npm run smoke；如果真实修改 Vue/主站样式，再按主站 AGENTS 运行完整验收。游戏的 npm test 不能替代它们。

## 主站所有 src 文件

| 文件 | 行数 | 导入 |
|---|---:|---|
| src/App.vue | 12 | vue, ./router |
| src/components/common/BackButton.vue | 119 | @arco-design/web-vue/es/icon |
| src/components/common/ControlButtons.vue | 627 | vue, @arco-design/web-vue/es/icon |
| src/components/common/CountUp.vue | 137 | vue |
| src/components/common/CustomCursor.vue | 321 | vue |
| src/components/common/Footer.vue | 252 | vue |
| src/components/common/IntroCard.vue | 238 | vue, @arco-design/web-vue/es/icon |
| src/components/common/SectionButton.vue | 221 | @arco-design/web-vue/es/icon |
| src/components/common/StatusBanner.vue | 256 | vue, @arco-design/web-vue/es/icon |
| src/components/common/TatalabEasterEgg.vue | 122 | vue |
| src/components/common/Toast.vue | 102 | — |
| src/components/resume/DetailOverlay.vue | 453 | vue, @arco-design/web-vue/es/icon |
| src/components/resume/ImageViewer.vue | 422 | vue, @arco-design/web-vue/es/icon |
| src/components/resume/QuickActions.vue | 200 | @arco-design/web-vue/es/icon |
| src/components/resume/ResumeHighlights.vue | 363 | @arco-design/web-vue/es/icon |
| src/components/resume/SeriesHeroSection.vue | 527 | vue, @arco-design/web-vue/es/icon |
| src/components/resume/SeriesOverlay.vue | 661 | vue, @arco-design/web-vue/es/icon, @/utils/dateFormat.js |
| src/components/resume/TileCard.vue | 378 | lucide-vue-next, vue, @arco-design/web-vue/es/icon |
| src/components/resume/TileGrid.vue | 28 | ./TileCard.vue |
| src/components/tools/CanvasEditor.vue | 522 | vue, @arco-design/web-vue/es/icon, ./EditableCard.vue |
| src/components/tools/CardEditor.vue | 1229 | vue, @arco-design/web-vue/es/icon, ./TemplatePanel.vue, ./CanvasEditor.vue, ./PropertiesPanel.vue, ./IconPicker.vue, @/composables/useCardExport |
| src/components/tools/EditableCard.vue | 1116 | vue, @arco-design/web-vue/es/icon |
| src/components/tools/IconPicker.vue | 547 | vue, @arco-design/web-vue/es/icon |
| src/components/tools/PropertiesPanel.vue | 818 | vue, @arco-design/web-vue/es/icon, ./IconPicker.vue |
| src/components/tools/TemplatePanel.vue | 272 | vue, @arco-design/web-vue/es/icon |
| src/components/views/ArchiveView.vue | 65 | vue |
| src/components/views/ArticlesView.vue | 481 | vue, @arco-design/web-vue/es/icon, @/utils/linkHandler, @/utils/dateFormat |
| src/components/views/DemoView.vue | 1181 | vue, @arco-design/web-vue/es/icon, @/utils/linkHandler, @/utils/dateFormat, @/components/resume/SeriesHeroSection.vue |
| src/components/views/EducationView.vue | 56 | vue, @arco-design/web-vue/es/icon |
| src/components/views/ExperienceView.vue | 408 | vue |
| src/components/views/MediaView.vue | 573 | vue, @arco-design/web-vue/es/icon, @/composables/useContactActions, @/composables/useToast, @/components/common/Toast.vue |
| src/components/views/ProfileView.vue | 642 | vue, @arco-design/web-vue/es/icon, katex, katex/dist/katex.min.css, @/composables/useContactActions, @/composables/useToast, @/components/common/Toast.vue |
| src/components/views/ProjectsView.vue | 48 | vue, @arco-design/web-vue/es/icon |
| src/components/views/ResumeView.vue | 229 | @arco-design/web-vue/es/icon, @/composables/useContactActions, @/composables/useToast, @/components/common/Toast.vue |
| src/components/views/SkillsView.vue | 47 | vue |
| src/composables/useCardExport.js | 211 | vue, modern-screenshot |
| src/composables/useContactActions.js | 108 | ./useToast |
| src/composables/useFestivalTheme.js | 201 | vue, @/config/festival.config |
| src/composables/useToast.js | 103 | vue |
| src/config/festival.config.js | 114 | — |
| src/main.js | 28 | vue, @arco-design/web-vue, @arco-design/web-vue/es/icon, ./App.vue, @arco-design/web-vue/dist/arco.css, ./styles/variables.css, ./styles/global.css, ./styles/header-flow.css, ./styles/tiles.css, ./styles/main.css, ./utils/favicon.js |
| src/router/index.js | 59 | @/sites/resume/App.vue |
| src/sites/resume/App.vue | 2222 | vue, gsap, gsap/ScrollTrigger, ./config.js, ./config_en.js, @/utils/colorGenerator, @/utils/lazyLoad, @/utils/seo, @/utils/linkHandler, @/composables/useFestivalTheme, @/components/common/ControlButtons.vue, @/components/common/BackButton.vue, @/components/common/Footer.vue, @/components/common/SectionButton.vue, @/components/resume/TileGrid.vue, @/components/resume/DetailOverlay.vue, @/components/resume/SeriesOverlay.vue, @/components/resume/ImageViewer.vue, @/components/resume/QuickActions.vue, @/components/common/CustomCursor.vue, @/components/common/IntroCard.vue, @/components/common/StatusBanner.vue, @arco-design/web-vue/es/icon |
| src/sites/resume/config.factory.js | 242 | — |
| src/sites/resume/config.js | 1642 | ./config.factory.js |
| src/sites/resume/config_en.js | 1646 | ./config.factory.js |
| src/styles/festivals/spring-2026.css | 191 | — |
| src/styles/global.css | 302 | — |
| src/styles/header-flow.css | 3191 | — |
| src/styles/main.css | 930 | — |
| src/styles/tiles.css | 585 | — |
| src/styles/variables.css | 100 | — |
| src/utils/colorGenerator.js | 63 | — |
| src/utils/dateFormat.js | 32 | — |
| src/utils/favicon.js | 189 | — |
| src/utils/faviconTest.js | 89 | ./favicon.js |
| src/utils/lazyLoad.js | 239 | — |
| src/utils/linkHandler.js | 235 | — |
| src/utils/seo.js | 70 | — |

## 配套工具怎么选

- 游戏脚本以 package.json 的 test/build/balance/check:editions 为起点。scripts/verify-release-stability.py 和 verify-community-save.py 是发布链验证，scripts/ops 是本轮整理的网页版发布工具。
- scripts 中的 build/render/fixture/measure/verify 分别是生成、渲染、合成样本、测量与验证；仅靠名称不能确认它适用于当前版本，必须读 URL、输入与输出参数。
- docs/v*/qa 是验收证据；docs/research、archive 和工作区 spikes/services 不能当正式功能的权威。不要运行目录里每一个脚本来“扫库”，部分脚本会生成/覆盖大量文件。
- dist、node_modules、artifacts、.venv 等 Git 忽略产物不属于本清单；不要把它们当待修源码。

## 语法检查

主站 src 的 JS/Vue/CSS 解析无错误。这个结果不代表主站所有路由、视觉与外链已经浏览器验收。
