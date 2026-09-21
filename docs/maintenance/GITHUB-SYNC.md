# GitHub 构建同步（不部署云端）

MC Clicker 的源码在 `KevinYoung-Kw/mc-clicker`，主站入口仍为
`https://www.kw-aigc.cn/projects/mc-clicker-2/`。

本流程只将指定源码提交测试、构建后写入 `KevinYoung-Kw/my-profile` 的
`public/projects/mc-clicker-2/`。不会连接腾讯云、执行 `deploy.sh`、重建主站、
改动旧游戏或把源码写回 `projects/mc-clicker-2/`。
**同步成功不代表已上线，也不代表完成发布存档验收。**

## 安装

在 my-profile 的 main 分支放入以下两个文件：

| 本仓模板 | my-profile 目标路径 |
| --- | --- |
| `scripts/ops/github/sync-mc-clicker.yml` | `.github/workflows/sync-mc-clicker.yml` |
| `scripts/ops/github/sync-mc-clicker.py` | `.github/scripts/sync-mc-clicker.py` |

当前游戏源码仓库公开可读；工作流使用 my-profile 自带的 `GITHUB_TOKEN`
写入主站仓库，不需要长期跨仓令牌或服务器 SSH 密钥。如果游戏仓库改为私有，
读取步骤会失败，需要另行配置只读访问。分支保护若禁止直接写 main，同步会失败，
应改为 PR 流程，不绕过保护或强推。

## 每次同步

先将游戏改动推送并合入 mc-clicker 的 main，再在 my-profile → Actions →
**Sync MC Clicker build (no deployment)** → Run workflow，输入游戏完整提交 SHA。
也可在已登录 GitHub CLI 的终端执行：

```sh
gh workflow run sync-mc-clicker.yml --repo KevinYoung-Kw/my-profile --ref main \
  -f source_commit=<游戏完整40位提交号>
```

工作流只接受已合入游戏 main 的提交；安装锁定依赖，运行完整 `npm test`
（包含版本日志与历史存档单测）及正式构建。通过后另一个任务校验构建文件 SHA256，
同步主站，更新预压缩 HTML，保留历史资源；每个源码提交的构建清单独立保存在
`docs/mc-clicker-sync/<SHA>.json`。重复同步同一构建不会重复提交。
同一提交若产生不同构建则停止；main 并发变化导致推送失败时重新运行，禁止强推。

工作流为手动触发，没有定时任务或 push 自动部署。GitHub Actions 日志和构建产物
可用于核查。主站的链接、标题、介绍、封面配置不随游戏版本变化自动修改。

## 同步后发布

仍按 [发布要求](../RELEASE-CONTRACT.md) 和 [运维手册](RUNBOOK.md) 执行。
发布前补齐独立仓库拆分时缺失的已跟踪历史样本，完成双版核对、前中后期旧档
继续运行/再次保存/刷新，以及跨浏览器图片导入、取消、坏图和备份恢复。
这些检查未通过时，即使 GitHub 同步成功也不能发布。

云端仍由维护者手动部署，并在 DEPLOYMENT.md 追加真实上线提交和验证证据。
GitHub 上的构建同步记录统一标为 `synchronized-not-deployed`；不修改现有线上版本记录。
