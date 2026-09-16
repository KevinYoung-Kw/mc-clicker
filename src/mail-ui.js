import { MAIL_CATALOG, MAIL_TYPES } from "./mail-content.js";
import {
  mailboxOwned,
  mailSummary,
  mailRewardPreview,
  postalLevel,
  postalRate,
  postalUpgradeCost,
  POSTAL_RATES,
} from "./mail.js";
import "./mail-style.css";
import { formatWallet } from "./game.js";

const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const amount = (n) => (Number.isFinite(n) && n >= 0 ? n : 0);
const numberFormat = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 4,
});
const displayFormat = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 2,
});
const mediaPath = (src) =>
  typeof src === "string" && /^\.\/mail\/[a-zA-Z0-9_.-]+$/.test(src) ? src : "";
const platformLabel = (platform) =>
  ({ wechat: "公众号", xiaohongshu: "小红书", "wechat-group": "微信交流群" })[platform] || "";
const setText = (el, text) => {
  if (el && el.textContent !== text) el.textContent = text;
};
const setHTML = (el, html) => {
  if (el && el.innerHTML !== html) el.innerHTML = html;
};
const tinyEnvelope = `<svg viewBox="0 0 24 20" aria-hidden="true" shape-rendering="crispEdges"><path fill="currentColor" d="M2 2h20v16H2z"/><path fill="var(--mail-icon-paper,#fff9e8)" d="M4 4h16v2h-2v2h-2v2H8V8H6V6H4zm0 4h2v2h2v2h8v-2h2V8h2v8H4z"/></svg>`;
const postalMark = `<svg viewBox="0 0 24 24" aria-hidden="true" shape-rendering="crispEdges"><path fill="currentColor" d="M2 2h20v3H2zm0 6h20v3h-8v11h-4V11H2z"/></svg>`;
const mailArt = (platform) =>
  `<svg viewBox="0 0 32 28" aria-hidden="true" shape-rendering="crispEdges"><path fill="currentColor" d="M2 4h28v20H2z"/><path fill="var(--paper)" d="M4 6h24v16H4z"/><path fill="currentColor" d="M4 6h4v4h4v4h8v-4h4V6h4v4h-4v4h-4v4h-8v-4H8v-4H4z"/><path fill="${platform === "xiaohongshu" ? "#b88065" : "#819969"}" d="M24 0h8v8h-8z"/></svg>`;

export function createMailUI(api) {
  let selected = null,
    tab = "letters",
    filter = "all",
    category = "all";
  const state = () =>
    typeof api.state === "function" ? api.state() : api.state;
  const number = (n) => numberFormat.format(amount(n));
  const displayAmount = (n) =>
    n >= 1e6 ? formatWallet(n) : displayFormat.format(amount(n));
  const rewardFormula = (rate, multiplier, claimed) =>
    claimed
      ? `<span>领取时每秒收入 ${displayAmount(rate)}</span><span>× ${multiplier} · 已到账</span>`
      : `<span>奖励为领取时每秒收入 ×${multiplier}</span><span>当前 ${displayAmount(rate)} / 秒</span>`;
  const money = (n) => esc(api.format ? api.format(amount(n)) : number(n));
  const receipt = (s, id) => s.mail?.letters?.[id];
  const delivered = (s) => MAIL_CATALOG.filter((item) => receipt(s, item.id));
  function status(item, letter) {
    if (letter.blocked) return { label: "已收信", state: "blocked" };
    if (letter.claimedAt !== null) return { label: "已领取", state: "claimed" };
    if (letter.readAt === null) return { label: "未读", state: "unread" };
    return item.reward
      ? { label: "待领取", state: "pending" }
      : { label: "已读", state: "read" };
  }
  function tabs(s) {
    const summary = mailSummary(s);
    return `<nav class="mail-tabs" aria-label="邮箱功能"><button type="button" data-mail-tab="letters" aria-pressed="${tab === "letters"}">${tinyEnvelope}<span>来信</span><b data-mail-nav-count>${summary.total}</b></button><button type="button" data-mail-tab="postal" aria-pressed="${tab === "postal"}">${postalMark}<span>邮政</span><small data-mail-nav-level>Lv.${postalLevel(s)}</small></button>${api.locate?`<button type="button" class="mail-building-tool" data-mail-locate aria-label="定位邮箱" title="定位邮箱">${api.icon("locate",18)}</button>`:""}${api.move?`<button type="button" class="mail-building-tool" data-mail-move aria-label="调整邮箱位置" title="调整邮箱位置">${api.icon("wrench",18)}</button>`:""}${api.store?`<button type="button" class="mail-building-tool" data-mail-store aria-label="收纳邮箱" title="收纳邮箱">${api.icon("box",18)}</button>`:""}</nav>`;
  }
  function filters(s, letters) {
    const summary = mailSummary(s),
      types = [...new Set(letters.map((item) => item.type))];
    return `<div class="mail-filter-row"><div class="mail-filters" aria-label="按阅读状态筛选">${[
      ["all", "全部", summary.total],
      ["unread", "未读", summary.unread],
      ["pending", "待领", summary.unclaimed],
    ]
      .map(
        ([key, label, count]) =>
          `<button type="button" data-mail-filter="${key}" aria-pressed="${filter === key}">${label}<span>${count}</span></button>`,
      )
      .join(
        "",
      )}</div>${types.length > 1 ? `<label class="mail-type-filter"><span class="mail-sr-only">邮件类型</span><select data-mail-category><option value="all" ${category === "all" ? "selected" : ""}>所有类型</option>${types.map((type) => `<option value="${esc(type)}" ${category === type ? "selected" : ""}>${esc(MAIL_TYPES[type]?.label || "来信")}</option>`).join("")}</select></label>` : ""}</div>`;
  }
  function inbox(s) {
    const letters = delivered(s),
      shown = letters.filter(
        (item) =>
          (category === "all" || item.type === category) &&
          (filter === "all" ||
            status(item, receipt(s, item.id)).state === filter),
      );
    return `<section class="mail-inbox-view" aria-label="来信">${filters(s, letters)}<div class="mail-inbox-scroll"><div class="mail-list">${
      shown.length
        ? shown
            .map((item) => {
              const v = status(item, receipt(s, item.id));
              return `<button type="button" class="mail-envelope ${v.state}" data-mail-open="${esc(item.id)}"><span class="mail-envelope-art">${mailArt(item.platform)}</span><span class="mail-envelope-copy"><span class="mail-row-meta"><span>${esc(MAIL_TYPES[item.type]?.label || "来信")}</span><b class="mail-letter-status">${v.label}</b></span><strong class="mail-envelope-title">${esc(item.title)}</strong><span class="mail-envelope-sender">${esc(item.sender)}${platformLabel(item.platform) ? ` · ${esc(platformLabel(item.platform))}` : ""}</span></span><span class="mail-row-arrow" aria-hidden="true">›</span></button>`;
            })
            .join("")
        : `<div class="mail-empty">${tinyEnvelope}<h3>${filter === "pending" ? "暂无待领奖励" : filter === "unread" ? "没有未读来信" : "暂时没有来信"}</h3></div>`
    }</div></div></section>`;
  }
  function postalPayback(s) {
    const cost = postalUpgradeCost(s), gain = POSTAL_RATES[postalLevel(s) + 1] - postalRate(s);
    return cost === null ? "" : `按新增邮政收入，前台约 ${Math.ceil(cost / gain)} 秒回本`;
  }
  function postal(s) {
    const level = postalLevel(s),
      cost = postalUpgradeCost(s),
      next = POSTAL_RATES[Math.min(5, level + 1)];
    return `<section class="mail-postal-view" aria-label="邮政能力"><div class="mail-postal-scroll"><div class="mail-postal-hero"><div class="mail-postal-art"><img src="./icons/V18.png?v=mailbox-v1" alt="方块邮箱" width="128" height="128"></div><div><h3 tabindex="-1" data-mail-heading>邮政 <small data-postal-level>Lv.${level}</small></h3><p>邮箱会自动赚取绿宝石，升级后每秒赚得更多。</p></div></div><div class="mail-postal-output"><span>邮政每秒收入</span><strong data-postal-rate>+${number(postalRate(s))}<small> / 秒</small></strong></div><h4 class="mail-postal-track-label">邮政等级 <span>共 5 级</span></h4><ol class="mail-postal-progress">${[1, 2, 3, 4, 5].map((n) => `<li class="${n <= level ? "filled" : ""} ${n === level ? "current" : ""}"><span>Lv.${n}</span><strong>+${POSTAL_RATES[n]}</strong><small>/ 秒</small></li>`).join("")}</ol></div><footer class="mail-postal-dock"><div class="mail-postal-next-row"><span>下一等级</span><strong data-postal-next>${cost === null ? "已经满级" : `+${number(next)} / 秒 <small>增加 ${number(next - postalRate(s))}</small>`}</strong></div><p class="mail-postal-payback" data-postal-payback>${postalPayback(s)}</p><button type="button" class="primary mail-primary" data-mail-upgrade ${cost === null || s.money < cost ? "disabled" : ""}><span>${cost === null ? "邮政已满级" : "升级邮政"}</span><b>${cost === null ? "Lv.5" : `${money(cost)} <span class="mini-emerald" aria-hidden="true"></span>`}</b></button><p data-postal-afford>${cost === null ? "" : s.money < cost ? `还差 ${money(cost - s.money)} 绿宝石` : ""}</p></footer></section>`;
  }
  function imageBlock(block, index) {
    const src = mediaPath(block.src);
    if (!src) return "";
    const animated = block.type === "animation" || /\.gif$/i.test(src),
      poster = mediaPath(block.poster),
      imageSrc = animated ? poster : src,
      crop = block.crop;
    const validCrop =
      !animated &&
      crop &&
      [crop.x, crop.y, crop.size, crop.sourceWidth, crop.sourceHeight].every(
        Number.isFinite,
      ) &&
      crop.size > 0 &&
      crop.x >= 0 &&
      crop.y >= 0 &&
      crop.x + crop.size <= crop.sourceWidth &&
      crop.y + crop.size <= crop.sourceHeight;
    const style = validCrop
      ? ` style="width:${(crop.sourceWidth / crop.size) * 100}%;height:${(crop.sourceHeight / crop.size) * 100}%;left:${(-crop.x / crop.size) * 100}%;top:${(-crop.y / crop.size) * 100}%"`
      : "";
    return `<figure class="mail-figure"><a class="mail-image-view ${validCrop ? "mail-qr-focus" : ""}" href="${src}" target="_blank" rel="noopener noreferrer" aria-label="查看原图：${esc(block.alt)}">${imageSrc ? `<img src="${imageSrc}" alt="${esc(block.alt)}" loading="lazy" decoding="async"${style} ${animated ? `data-mail-animation-image="${index}"` : ""}>` : '<span class="mail-animation-poster">动态图演示</span>'}</a><figcaption>${esc(block.caption)}</figcaption>${animated ? `<button type="button" class="mail-media-button" data-mail-animation="${index}" data-animation-src="${src}" data-animation-poster="${poster}" aria-pressed="false">播放演示</button>` : `<div class="mail-image-actions"><a href="${src}" target="_blank" rel="noopener noreferrer">查看原图 ↗</a><a href="${src}" download="${esc(block.filename || "MC-Clicker-来信图片.webp")}">保存图片 ↓</a></div>`}</figure>`;
  }
  function blocks(item) {
    return item.blocks
      .map((block, index) => {
        if (block.type === "image" || block.type === "animation")
          return imageBlock(block, index);
        if (["paragraph", "salutation", "signature"].includes(block.type))
          return `<p class="mail-text-${block.type}">${esc(block.text)}</p>`;
        if (block.type === "heading") return `<h3>${esc(block.text)}</h3>`;
        return "";
      })
      .join("");
  }
  function reward(item, letter, s) {
    if (!item.reward)
      return '<div class="mail-reward-actions"><button type="button" class="mail-secondary" data-mail-back>返回来信</button></div>';
    if (letter.blocked)
      return '<section class="mail-reward mail-reward-blocked"><p>领奖记录不完整，暂时无法领取。信件仍可阅读。</p><div class="mail-reward-actions"><button type="button" class="mail-secondary" data-mail-back>返回来信</button><button type="button" class="primary mail-primary" disabled>暂不可领取</button></div></section>';
    const claimed = letter.claimedAt !== null,
      preview = mailRewardPreview(s),
      rate = claimed ? letter.claimedRate : preview.rate,
      value = claimed ? letter.reward : preview.value;
    return `<section class="mail-reward ${claimed ? "is-claimed" : ""}" aria-label="来信礼物"><div class="mail-reward-top"><div class="mail-reward-heading"><b data-mail-reward-amount data-large="${value >= 1e5}" title="${value}" aria-label="${number(value)} 绿宝石">+${displayAmount(value)} <span class="mini-emerald" aria-hidden="true"></span></b></div><p data-mail-reward-formula>${rewardFormula(rate, item.reward.multiplier, claimed)}</p></div><div class="mail-reward-actions mail-reading-footer"><button type="button" class="mail-secondary" data-mail-back>${claimed ? "返回来信" : "稍后再领"}</button><button type="button" class="primary mail-primary mail-claim" data-mail-claim="${esc(item.id)}" ${claimed ? "disabled" : ""}>${claimed ? "已领取 ✓" : "领取礼物"}</button></div></section>`;
  }
  function letterView(s, item) {
    const letter = receipt(s, item.id),
      v = status(item, letter);
    return `<section class="mail-reader"><header class="mail-reading-nav"><button type="button" data-mail-back aria-label="返回来信">←</button><div><h3 tabindex="-1" data-mail-heading>${esc(item.title)}</h3><p>${esc(item.sender)} · ${esc(MAIL_TYPES[item.type]?.label || "来信")}<span>${v.label}</span></p></div></header><div class="mail-letter-scroll" data-mail-scroll tabindex="0" aria-label="信件正文，可滚动"><article class="mail-letter" data-mail-letter="${esc(item.id)}"><div class="mail-letter-body">${blocks(item)}</div></article></div><div class="mail-reward-slot" data-mail-dock>${reward(item, letter, s)}</div></section>`;
  }
  function render() {
    const s = state();
    if (!mailboxOwned(s))
      return '<section id="mail-panel" class="mail-empty"><h3>需要先建造邮箱</h3></section>';
    const item =
      selected &&
      MAIL_CATALOG.find(
        (entry) => entry.id === selected && receipt(s, entry.id),
      );
    if (!item) selected = null;
    return `<section id="mail-panel" class="${item ? "is-reading" : tab === "postal" ? "is-postal" : "is-inbox"}">${tabs(s)}${item ? letterView(s, item) : tab === "postal" ? postal(s) : inbox(s)}<p class="mail-feedback mail-sr-only" data-mail-feedback role="status" aria-live="polite"></p></section>`;
  }
  const panelOf = (root) =>
    root.matches?.("#mail-panel") ? root : root.querySelector("#mail-panel");
  function redraw(root, focus = "[data-mail-heading]") {
    const panel = panelOf(root);
    if (!panel?.parentNode) return;
    const parent = panel.parentNode;
    panel.outerHTML = render();
    bind(parent);
    parent.closest("#panel-content")?.scrollTo({ top: 0, behavior: "instant" });
    parent.querySelector(focus)?.focus({ preventScroll: true });
  }
  function notify(root, text, error = false) {
    setText(panelOf(root)?.querySelector("[data-mail-feedback]"), text);
    if (error) api.toast?.(text);
  }
  function bind(root) {
    const panel = panelOf(root);
    if (!panel) return;
    panel.querySelectorAll("[data-mail-tab]").forEach(
      (button) =>
        (button.onclick = () => {
          tab = button.dataset.mailTab;
          selected = null;
          redraw(root, `[data-mail-tab="${tab}"]`);
        }),
    );
    panel.querySelectorAll("[data-mail-open]").forEach(
      (button) =>
        (button.onclick = () => {
          const result = api.read(button.dataset.mailOpen);
          if (!result?.ok)
            return notify(root, result?.reason || "暂时不能打开这封信", true);
          selected = button.dataset.mailOpen;
          tab = "letters";
          api.changed?.();
          redraw(root);
        }),
    );
    panel.querySelectorAll("[data-mail-back]").forEach(
      (button) =>
        (button.onclick = () => {
          const previous = selected;
          selected = null;
          tab = "letters";
          filter = "all";
          redraw(
            root,
            previous
              ? `[data-mail-open="${previous}"]`
              : '[data-mail-tab="letters"]',
          );
        }),
    );
    panel.querySelectorAll("[data-mail-filter]").forEach(
      (button) =>
        (button.onclick = () => {
          filter = button.dataset.mailFilter;
          redraw(root, `[data-mail-filter="${filter}"]`);
        }),
    );
    const categorySelect = panel.querySelector("[data-mail-category]");
    if (categorySelect)
      categorySelect.onchange = () => {
        category = categorySelect.value;
        redraw(root, "[data-mail-category]");
      };
    const claimButton = panel.querySelector("[data-mail-claim]");
    if (claimButton)
      claimButton.onclick = () => {
        const focused = document.activeElement === claimButton,
          result = api.claim(claimButton.dataset.mailClaim);
        if (!result?.ok)
          return notify(root, result?.reason || "暂时不能领取", true);
        api.changed?.();
        refresh(root);
        if (focused)
          panelOf(root)
            ?.querySelector(".mail-reward-slot [data-mail-back]")
            ?.focus({ preventScroll: true });
        notify(root, `已收下 ${number(result.value)} 绿宝石。`);
      };
    const upgradeButton = panel.querySelector("[data-mail-upgrade]");
    if (upgradeButton)
      upgradeButton.onclick = () => {
        const result = api.upgrade();
        if (!result?.ok)
          return notify(root, result?.reason || "暂时不能升级", true);
        api.changed?.();
        refresh(root);
        notify(
          root,
          `邮政已升至 Lv.${result.level}，每秒 +${number(result.rate)} 绿宝石。`,
        );
      };
    const locateButton = panel.querySelector("[data-mail-locate]");
    if (locateButton) locateButton.onclick = () => api.locate?.();
    const storeButton=panel.querySelector("[data-mail-store]");if(storeButton)storeButton.onclick=()=>api.store?.();
    const moveButton = panel.querySelector("[data-mail-move]");
    if (moveButton) moveButton.onclick = () => api.move?.();
    panel.querySelectorAll("[data-mail-animation]").forEach(
      (button) =>
        (button.onclick = () => {
          const holder = button
              .closest("figure")
              .querySelector(".mail-image-view"),
            playing = button.getAttribute("aria-pressed") === "true",
            src = playing
              ? button.dataset.animationPoster
              : button.dataset.animationSrc;
          let img = holder.querySelector("img");
          if (!img) {
            img = document.createElement("img");
            img.alt = holder
              .getAttribute("aria-label")
              .replace("查看原图：", "");
            holder.replaceChildren(img);
          }
          if (src) img.src = src;
          else
            holder.innerHTML =
              '<span class="mail-animation-poster">动态图演示</span>';
          button.setAttribute("aria-pressed", String(!playing));
          button.textContent = playing ? "播放演示" : "暂停演示";
        }),
    );
  }
  function refresh(root) {
    const panel = panelOf(root);
    if (!panel) return;
    const s = state(),
      summary = mailSummary(s);
    setText(
      panel.querySelector("[data-mail-nav-count]"),
      String(summary.total),
    );
    setText(
      panel.querySelector("[data-mail-nav-level]"),
      `Lv.${postalLevel(s)}`,
    );
    const letterElement = panel.querySelector("[data-mail-letter]");
    if (letterElement) {
      const item = MAIL_CATALOG.find(
          (entry) => entry.id === letterElement.dataset.mailLetter,
        ),
        letter = receipt(s, item?.id);
      if (!letter || !item?.reward) return;
      const claimed = letter.claimedAt !== null,
        rewardRoot = panel.querySelector(".mail-reward");
      if (
        claimed !== rewardRoot?.classList.contains("is-claimed") ||
        letter.blocked !== rewardRoot?.classList.contains("mail-reward-blocked")
      ) {
        panel.querySelector(".mail-reward-slot").innerHTML = reward(
          item,
          letter,
          s,
        );
        setText(
          panel.querySelector(".mail-reading-nav p span"),
          status(item, letter).label,
        );
        bind(root);
      } else if (!claimed && !letter.blocked) {
        const { rate, value } = mailRewardPreview(s),
          valueElement = panel.querySelector("[data-mail-reward-amount]");
        setHTML(
          valueElement,
          `+${displayAmount(value)} <span class="mini-emerald" aria-hidden="true"></span>`,
        );
        if (valueElement.dataset.large !== String(value >= 1e5))
          valueElement.dataset.large = String(value >= 1e5);
        const label = `${number(value)} 绿宝石`;
        if (valueElement.getAttribute("aria-label") !== label)
          valueElement.setAttribute("aria-label", label);
        if (valueElement.title !== String(value))
          valueElement.title = String(value);
        setHTML(
          panel.querySelector("[data-mail-reward-formula]"),
          rewardFormula(rate, item.reward.multiplier, false),
        );
      }
    } else if (tab === "postal") {
      const level = postalLevel(s),
        cost = postalUpgradeCost(s),
        button = panel.querySelector("[data-mail-upgrade]");
      if (!button) return;
      setText(panel.querySelector("[data-postal-level]"), `Lv.${level}`);
      setHTML(
        panel.querySelector("[data-postal-rate]"),
        `+${number(postalRate(s))}<small> / 秒</small>`,
      );
      panel
        .querySelectorAll(".mail-postal-progress li")
        .forEach((segment, index) => {
          segment.classList.toggle("filled", index < level);
          segment.classList.toggle("current", index === level - 1);
        });
      setHTML(
        panel.querySelector("[data-postal-next]"),
        cost === null
          ? "已经满级"
          : `+${number(POSTAL_RATES[level + 1])} / 秒 <small>增加 ${number(POSTAL_RATES[level + 1] - postalRate(s))}</small>`,
      );
      setHTML(
        button,
        `<span>${cost === null ? "邮政已满级" : "升级邮政"}</span><b>${cost === null ? "Lv.5" : `${money(cost)} <span class="mini-emerald" aria-hidden="true"></span>`}</b>`,
      );
      setText(panel.querySelector("[data-postal-payback]"), postalPayback(s));
      button.disabled = cost === null || s.money < cost;
      setHTML(
        panel.querySelector("[data-postal-afford]"),
        cost === null
          ? ""
          : s.money < cost
            ? `还差 ${money(cost - s.money)} 绿宝石`
            : "",
      );
    }
  }
  return {
    render,
    bind,
    refresh,
    reset(initialTab='letters') {
      selected = null;
      tab = initialTab==='postal'?'postal':'letters';
      filter = "all";
      category = "all";
    },
  };
}
