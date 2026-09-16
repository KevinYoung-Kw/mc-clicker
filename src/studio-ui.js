import { facilityStatusMarkup } from "./facility-status.js";
import { connectionControls } from "./network-ui.js";
import { ITEMS } from "./catalog.js";
import {
  COLLECTION,
  COLLECTION_BY_ID,
  collectionNeeds,
  hasExtra,
} from "./collection.js";
import { studioSpec, studioEntities } from "./studio-placement.js";
import { collectionArt } from "./collection-art.js";
import { formatWallet } from "./game.js";
import { icon, iconButton } from "./icons.js";
import { activeHost } from "./residents.js";
import { studioStaffMarkup } from "./studio-staff-ui.js";
import { broadcastStageMarkup } from './broadcasting-ui.js';

const slots = [
  ["studioDesk", "导播桌"],
  ["studioWall", "声学墙"],
  ["studioSign", "灯牌"],
  ["studioShelf", "收藏架"],
  ["flag", "台标"],
];
const heading = (title, note) =>
  `<header class="room-panel-heading"><span class="eyebrow">YOUR LITTLE STUDIO</span><h2>${title}</h2>${note ? `<p>${note}</p>` : ""}</header>`;
export function createStudioUI(api) {
  let decorSlot = "studioDesk";
  const qAll = (selector) => [
    ...document.querySelectorAll(`#panel-content ${selector}`),
  ];
  function artwork(s, spec) {
    if (ITEMS[spec.id]) return api.art(ITEMS[spec.id]);
    const extra =
      COLLECTION_BY_ID[spec.id] ||
      COLLECTION_BY_ID[s.scenery.equipped[spec.key]];
    return extra ? collectionArt(extra) : icon("cube", 40);
  }
  function render() {
    const s = api.state(),
      tab = api.tab();
    if (tab === "gifts")
      return (
        heading(
          "收礼台",
          "点按或滑动领取礼物。",
        ) +
        '<p class="panel-note">礼物站升到 3 级可以自动收礼物，也可以安排铜傀儡来收。</p>' +
        (s.counts.L6 < ITEMS.L6.max
          ? api.card(ITEMS.L6)
          : '<p class="room-complete">自动收礼已就位</p>')
      );
    if (tab === "equipment")
      return (
        heading("添置设备", "") + broadcastStageMarkup(s) +
        api.facilityShop("L2") +
        `<section class="room-entrance-upgrade"><h4>电台扩建 · ${s.counts.L2} / 3 级</h4><p class="panel-note">扩建改善节目效果，增加频道收入；占地仍是 2×2 格。</p>${s.counts.L2 < ITEMS.L2.max ? api.card(ITEMS.L2) : '<p class="room-complete">电台已完成扩建</p>'}</section>`
      );
    if (tab === "arrange") {
      const entities = studioEntities(s).filter(
        (e) => !e.key.startsWith("collectible:"),
      );
      return (
        heading(
          "整理我的房间",
          "选择物品，免费移动或旋转。",
        ) +
        `<div class="room-inventory">${entities.map((e) => `<button data-room-select="${e.key}"><span>${artwork(s, e)}</span><span><strong>${e.name}</strong><small>${!e.placed ? "待摆放 · 选择空位" : e.movable ? `${e.layer.startsWith("wall") ? "墙面" : e.layer === "ceiling" ? "顶部" : "地面"} · 可移动` : "固定工作区"}</small></span><b>→</b></button>`).join("")}</div>`
      );
    }
    if (tab === "decor") {
      const choices = COLLECTION.filter((i) => i.slot === decorSlot),
        equipped = s.scenery.equipped[decorSlot];
      return (
        heading("室内装饰", "同类款式替换使用，买过的款式都保留在收藏架。") +
        `<nav class="room-decor-tabs" aria-label="室内装饰分类">${slots.map(([id, name]) => `<button data-room-decor-slot="${id}" aria-selected="${decorSlot === id}">${name}</button>`).join("")}</nav><div class="room-decor-choices">${choices
          .map((i) => {
            const owned = hasExtra(s, i.id),
              needs = collectionNeeds(s, i),
              using = equipped === i.id;
            return `<article><div class="room-decor-art">${collectionArt(i)}</div><strong>${i.name}</strong><small>${using ? "正在使用" : owned ? "已收藏 · 换装免费" : formatWallet(i.cost) + " ◆"}</small><button data-room-extra="${i.id}" ${using || needs.length || (!owned && s.money < i.cost) ? "disabled" : ""}>${using ? "使用中" : owned ? "选择安放位置" : "购买并选址"}</button>${needs.length ? `<small>需要 ${needs.join("、")}</small>` : ""}</article>`;
          })
          .join(
            "",
          )}</div>${equipped ? `<button class="quiet-button" data-room-unequip="${decorSlot}">卸下当前款式 · 收藏保留</button>` : '<p class="panel-note">当前使用默认布置。</p>'}<button class="quiet-button" data-room-reset>恢复室内默认装扮</button>`
      );
    }
    if (tab === "inspect") {
      const spec = studioSpec(api.selected()),
        item = spec && ITEMS[spec.id],
        extra = spec && COLLECTION_BY_ID[spec.id];
      if (!spec)
        return (
          heading("点击一件物品", "") +
          '<button data-room-open="arrange" class="primary">查看房间物品</button>'
        );
      const sample = spec.key.startsWith("collectible:");
      return (
        heading(
          spec.name,
          item?.desc ||
            (sample ? "你的收藏已经摆在展示架上。" : ""),
        ) +
        `<div class="room-item-tools">${iconButton("locate", `定位${spec.name}`, `data-room-focus="${spec.key}"`)}${spec.movable ? iconButton("wrench", `调整${spec.name}位置与方向`, `data-room-move="${spec.key}"`) : ""}</div><div class="room-inspect-art">${artwork(s, spec)}</div>` +
        (item && spec.id !== "L1" ? facilityStatusMarkup(s, spec.id) : "") +

        (item && (s.counts[item.id] || 0) < item.max
          ? `<div class="room-upgrade">${api.card(item)}</div>`
          : "") +
        (sample && extra
          ? `<button class="quiet-button" data-room-extra="${extra.id}">把这件装饰放进房间 →</button>`
          : "") +
        (s.scenery.equipped[spec.key]
          ? `<button class="quiet-button" data-room-unequip="${spec.key}">卸下装饰 · 保留收藏</button>`
          : "") +
        (spec.id === "L4"
          ? studioStaffMarkup(s, "host") +
            `<button data-hold="host" class="primary" ${activeHost(s) ? "" : "disabled"}>${activeHost(s) ? "按住 · 开麦主持" : "等待主持人到岗"}</button>`
          : "") +
        (spec.id === "L1"
          ? api.records() + `<h4>村庄演出</h4>${facilityStatusMarkup(s, "L1")}${connectionControls(s,"L1")}` + studioStaffMarkup(s, "musician") +
            '<button data-action="music" class="primary">开始演出</button>'
          : "") +
        (["L3", "L5", "L8", "L9", "L10", "L11", "L13", "L14"].includes(spec.id)
          ? '<button class="quiet-button" data-room-open="program">节目与频道经营 →</button>'
          : "")
      );
    }
    return api.program();
  }
  function bind() {
    qAll("[data-room-select]").forEach(
      (b) => (b.onclick = () => api.select(b.dataset.roomSelect)),
    );
    qAll("[data-room-focus]").forEach(b => b.onclick = () => api.focus(b.dataset.roomFocus));
    qAll("[data-room-move]").forEach(
      (b) =>
        (b.onclick = () =>
          api.place(studioSpec(b.dataset.roomMove).id, {
            move: true,
            key: b.dataset.roomMove,
          })),
    );
    qAll("[data-room-open]").forEach(
      (b) => (b.onclick = () => api.open(b.dataset.roomOpen)),
    );
    qAll("[data-room-decor-slot]").forEach(
      (b) =>
        (b.onclick = () => {
          decorSlot = b.dataset.roomDecorSlot;
          api.refresh();
        }),
    );
    qAll("[data-room-extra]").forEach(
      (b) =>
        (b.onclick = () =>
          api.place(b.dataset.roomExtra, {
            extra: true,
            equip: hasExtra(api.state(), b.dataset.roomExtra),
          })),
    );
    qAll("[data-room-reset]").forEach(b=>b.onclick=()=>api.reset());
    qAll("[data-room-unequip]").forEach(
      (b) => (b.onclick = () => api.unequip(b.dataset.roomUnequip)),
    );
  }
  function refresh() {
    const s = api.state();
    qAll("[data-room-extra]").forEach((b) => {
      const i = COLLECTION_BY_ID[b.dataset.roomExtra];
      const using = s.scenery.equipped[i.slot] === i.id;
      b.disabled =
        using ||
        collectionNeeds(s, i).length > 0 ||
        (!hasExtra(s, i.id) && s.money < i.cost);
    });
  }
  return { render, bind, refresh };
}
