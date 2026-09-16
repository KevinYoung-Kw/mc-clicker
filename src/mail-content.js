/**
 * Authored mail content is separate from delivery and reward state.
 * Future notices/manuals can use the same typed blocks without accepting HTML.
 * Dates stay null until an actual activity window has been announced.
 */
export const MAIL_TYPES = Object.freeze({
  activity: { label: "活动奖励", short: "活动" },
  system: { label: "系统通知", short: "通知" },
  story: { label: "世界来信", short: "来信" },
  tutorial: { label: "玩法手册", short: "手册" },
});

export const MAIL_CATALOG = [
  {
    id: "welcome-wechat",
    type: "activity",
    title: "游戏更新发在这里",
    preview: "公众号「水的实践说」",
    sender: "游戏作者",
    stamp: "WECHAT",
    platform: "wechat",
    deliveryAt: null,
    expiresAt: null,
    reward: { kind: "claim-rate", multiplier: 5 },
    blocks: [
      {
        type: "paragraph",
        text: "谢谢你来玩 MC Clicker。",
      },
      {
        type: "paragraph",
        text: "游戏更新、开发过程，还有我折腾 AI 时的发现，都发在公众号「水的实践说」。想接着看，扫码就能找到我。",
      },
      {
        type: "image",
        src: "./mail/wechat-channel-qr.webp",
        alt: "公众号「水的实践说」关注二维码",
        caption: "微信扫一扫，或搜索「水的实践说」",
        // Square OA QR (860²). Full-frame crop keeps the 180px mail-qr-focus
        // frame without slicing the old 1816×624 search banner.
        crop: { sourceWidth: 860, sourceHeight: 860, x: 0, y: 0, size: 860 },
        filename: "MC-Clicker-公众号.webp",
      },
      { type: "signature", text: "—— 游戏作者" },
    ],
  },
  {
    id: "welcome-xiaohongshu",
    type: "activity",
    title: "来看看大家都造了什么",
    preview: "小红书「水的离子积」",
    sender: "游戏作者",
    stamp: "XIAOHONGSHU",
    platform: "xiaohongshu",
    deliveryAt: null,
    expiresAt: null,
    reward: { kind: "claim-rate", multiplier: 5 },
    blocks: [
      {
        type: "paragraph",
        text: "嗨，谢谢你来玩！",
      },
      {
        type: "paragraph",
        text: "我会在小红书「水的离子积」发游戏视频和新作品。你造了什么有意思的东西，也欢迎发给我看看。遇到 bug 也可以来找我。",
      },
      {
        type: "image",
        src: "./mail/xiaohongshu-qr.webp",
        alt: "小红书「水的离子积」关注二维码",
        caption: "小红书扫一扫，或搜索「水的离子积」\n小红书号：9657643708",
        crop: {
          sourceWidth: 1038,
          sourceHeight: 1689,
          x: 714,
          y: 1366,
          size: 256,
        },
        filename: "MC-Clicker-小红书.webp",
      },
      {
        type: "signature",
        text: "—— 游戏作者",
      },
    ],
  },
  {
    id: "community-wechat-group",
    introducedVersion: 2,
    type: "activity",
    title: "MC Clicker 交流群",
    preview: "聊玩法、晒建设，也可以报 bug。",
    sender: "游戏作者",
    stamp: "COMMUNITY",
    platform: "wechat-group",
    deliveryAt: null,
    expiresAt: null,
    reward: { kind: "claim-rate", multiplier: 5 },
    blocks: [
      { type: "paragraph", text: "我们有 MC Clicker 交流群了。" },
      {
        type: "paragraph",
        text: "来看看大家都把世界建成了什么样。哪里不好玩、哪里看不懂，或者又出了什么 bug，也可以直接在群里告诉我。",
      },
      {
        type: "image",
        src: "./mail/mc-clicker-group-20260907.png",
        alt: "MC Clicker 微信交流群二维码",
        caption: "微信扫码加入 MC Clicker 交流群\n本次群二维码于 2026 年 9 月 14 日前有效",
        // Display the QR with its quiet zone; keep the supplied image intact for saving.
        crop: { sourceWidth: 1070, sourceHeight: 1499, x: 155, y: 490, size: 760 },
        filename: "MC-Clicker-交流群.png",
      },
      { type: "signature", text: "群里见！\n—— 游戏作者" },
    ],
  },
];
