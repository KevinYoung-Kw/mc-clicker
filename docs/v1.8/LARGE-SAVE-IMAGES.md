# V1.8.3 · 大存档图片自动扩容

2026-09-10，已随 V1.8.3 发布，提交 `0324bfc`。GitHub 与腾讯云同步；[线上验收](qa/live-1.8.3/README.md)。

## 原因与修复

原图固定为 1728 × 2048，数据区只容纳 13,712 字节，另有 8,000 字符的提前拒绝。大世界存档有效，但装不进固定图。仅拉伸旧图不会增加容量；本次增加实际数据像素和 RS 纠错块，按载荷选最小可用尺寸。

| 完整图片尺寸 | 最大载荷（字节） | 约合存档码字符 |
| --- | --- | --- |
| 1728 × 2048 | 13,712 | 7,849 |
| 2496 × 2816 | 30,902 | 17,672 |
| 3264 × 3584 | 55,159 | 31,533 |
| 3776 × 4096 | 75,023 | 42,884 |

字符数仅用于说明，容量按压缩后的实际字节判断。最大图约 15.47 MP；导入文件 32 MB／16 MP 上限在解码前检查，避免无界画布分配。超出单张容量仍提示 JSON 备份，不删存档字段。

## 冻结格式与兼容

- MCI1 的尺寸、槽位顺序、填充、魔数、ECC 与强度保持原样，旧图继续读。
- 大图为 MCI2；数据区左上角仍为 (96,384)，边长依次 2304／3072／3584。外框宽＝边长＋192，高＝边长＋512；按宽高比识别档位，再尝试完整图四个直角方向。
- 每个 8×8 像素块承载四个低频系数；槽位仍用种子 `0x4d434931` 洗牌。块数为 `floor((边长/8)^2*4/(255*8))`，每块 RS(255,191)，64 个校验字节，最多纠正 32 字节错误。没有提高单位像素数据密度或减少纠错。
- 40 字节帧头为魔数、长度和整份载荷 SHA-256；所有检查通过才交给历史存档解码器。游戏存档 schema 仍为 7。
- Worker 中生成与解码；生成像素后读回一次，完整 PNG 再读回一次才开放保存。取消仍终止 Worker；大图任务允许最长 90 秒，避免慢设备沿用原 25 秒过早失败。
- 旧程序无法读取新 MCI2 大图，跨设备读取前需刷新到新版。备用码和 JSON 不改变格式。

## 验证

- 712 项规则测试通过，包括四档最大容量、每纠错块 32 字节破坏恢复、所有七主题的大数据区、旧强度与历史存档。
- [浏览器矩阵](qa/large-save-images/chromium.json)与 [WebKit 矩阵](qa/large-save-images/webkit.json)：18,000／50,000／70,000 字节三种载荷，PNG、JPEG85、JPEG70、缩小到 75% 后 JPEG85、旋转90°均完整恢复；裁切安全拒绝。两引擎共 36 项，30 项恢复、6 项拒绝。
- [用户历史样本摘要](qa/large-save-images/chromium-private-summary.json)：9,978 字符 → 2496 × 2816，PNG约2.9 MB；同样五种有效图完整恢复、裁切拒绝。原始存档与包含其内容的图片仅在本机处理，未收录或上传。
- 正式构建的 [大存档实际界面](qa/large-save-images/production-save/save-report.json)：使用可恢复的合成世界，断言实际存档码超过8,000字符、PNG宽度扩大；Chrome下载 → WebKit移动视口读入，确认、取消、坏图、刷新、纪念景物及备份恢复通过。
- 正式构建 [六组旧档检查](qa/large-save-images/production/report.json)：桌面／移动浏览器 × 前／中／后期，继续生产、后台暂停、菜单退出和刷新。

缩小到75%的结论不能推广为任意压缩；聊天软件若统一缩到极小图，仍可能丢失数据。优先保存／发送原图。浏览器模拟不替代实体手机、微信压缩与长期内存表现。

## 复现

```sh
node --test tests/save-image.test.js
uv run --python 3.11 --with playwright --with pillow python scripts/verify-large-save-images.py
uv run --python 3.11 --with playwright --with pillow python scripts/verify-large-save-images.py --engine webkit
MC_SAVE_QA_LARGE=1 MC_SAVE_QA_PRODUCTION=1 MC_SAVE_QA_URL=http://127.0.0.1:8933/ MC_SAVE_QA_OUT=docs/v1.8/qa/large-save-images/production-save uv run --python 3.11 --with playwright python scripts/verify-community-save.py
```

矩阵测试页使用本机 Vite 8932，正式构建使用 preview 8933。测试载荷与世界均为合成样本。
