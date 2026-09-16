import { facilityStatusMarkup } from "./facility-status.js";
import { ITEMS } from "./catalog.js";
import { heatCapacity, freightSpec } from "./dimensional.js";
import { DIMENSION_RULES } from "./economy.js";
import { formatHudNumber } from './hud-numbers.js';
const fmt = (v) => Math.floor(v || 0).toLocaleString("zh-CN");
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const DIMENSION_FACILITIES = [
  "N3",
  "N4",
  "N5",
  "N6",
  "N12",
  "E3",
  "E5",
  "E7",
  "E9",
  "E10",
  "E11",
];
export function facilityWorkStatus(s, id) {
  const d = s.dimensions;
  if (!d) return "";
  if (id === "N3") return `蓄热 ${fmt(d.heat)} / ${fmt(heatCapacity(s))}`;
  if (id === "N4")
    return `当前余热发电 ${fmt(s.grid?.last?.sources?.find((source) => source.id === "N4")?.rate)} E/s · 累计回收 ${fmt(d.recovered)} E`;
  if (id === "N5")
    return `批次准备 ${Math.floor((d.magmaProgress / DIMENSION_RULES.magmaPeriod) * 100)}% · 已压制 ${fmt(d.magmaProcessed)} 份`;
  const spec = freightSpec(s, id),
    trip = d.trips[id];
  if (spec) {
    const load = s.grid?.last?.loads?.find((l) => l.id === id);
    const stop = {
      off: "已关闭",
      "out-of-range": "线路超距",
      "no-power": "航标缺电",
    }[load?.state];
    if (stop) return `${stop} · 已运 ${fmt(d.moved[id])} 份`;
    if (trip)
      return `载货 ${fmt(trip.cargo)} 份 · ${trip.remaining > 0 ? Math.ceil(trip.remaining) + " 秒抵达" : "等待卸货空间"}`;
    const ready = s.buffers[spec.from][spec.source];
    const wait = Math.max(0, Math.ceil(spec.period - (d.clocks[id] || 0)));
    return `${id === "E9" ? "集货 " + fmt(Math.min(ready, spec.capacity)) + " / " + fmt(spec.capacity) : "每班最多 " + fmt(spec.capacity) + " 份"} · ${ready <= 0 ? "等待货物" : wait ? wait + " 秒后发车" : "准备装货"} · 已运 ${fmt(d.moved[id])} 份`;
  }
  if (id === "N12" || id === "E7")
    return `当前 ${d.last[id]?.amount > 0 ? "正在转运" : "等待货物 / 空位"} · 累计 ${fmt(d.moved[id])} 份`;
  if (id === "E5")
    return `待装卸 ${fmt(d.awaiting.endRaw + d.awaiting.endGoods)} 份`;
  if (id === "E10")
    return `酿造进度 ${Math.floor((s.harvest.brew || 0) * 100)}%${s.burst > 0 ? " · 强化剩余 " + Math.ceil(s.burst) + " 秒" : ""}`;
  if (id === "E11") return s.burst > 0 ? "龙息联动中" : "环境稳定";
  return "";
}
export function facilityWorkMarkup(s, id) {
  return DIMENSION_FACILITIES.includes(id) && s.counts[id]
    ? facilityStatusMarkup(s, id)
    : "";
}
export function dimensionNetworkMarkup(s) {
  const ids = DIMENSION_FACILITIES.filter((id) => s.counts[id]);
  return ids.length
    ? `<section class="dimension-logistics"><h4>维度协作</h4>${ids.map((id) => `<article><button data-detail="${id}">${ITEMS[id].name} →</button>${facilityWorkMarkup(s, id)}</article>`).join("")}</section>`
    : "";
}
const orderTime = value => { const seconds = Math.max(0, Math.ceil(value)); return String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0'); };
export function ordersMarkup(s) {
  return s.orders.length
    ? s.orders
        .map(
          (o) =>
            `<article class="trade-contract" data-order-id="${esc(o.id)}"><header><strong>${esc(o.label || "交货订单")}</strong><span><b data-order-progress>${formatHudNumber(o.progress)}</b> / <b data-order-target>${formatHudNumber(o.target)}</b></span></header><div class="task-meter"><i style="width:${Math.min(100, (o.progress / o.target) * 100)}%"></i></div><div class="trade-receipt"><span data-order-time>${orderTime(o.life)}</span><span>完成 <b data-order-reward>+${formatHudNumber(o.reward)} ◆</b></span></div></article>`,
        )
        .join("")
    : '<p class="panel-note">暂无待交付订单</p>';
}
export function orderPanel(s) {
  return `<section class="trade-orders"><h4>贸易订单</h4><div data-trade-orders>${ordersMarkup(s)}</div></section>`;
}
export function refreshDimensionUI(root, s) {
  root
    .querySelectorAll("[data-facility-work]")
    .forEach(
      (el) => (el.textContent = facilityWorkStatus(s, el.dataset.facilityWork)),
    );
  root.querySelectorAll("[data-trade-orders]").forEach((el) => {
    const key = JSON.stringify(s.orders.map(o => o.id));
    if (el.dataset.ordersKey !== key) {
      el.innerHTML = ordersMarkup(s);
      el.dataset.ordersKey = key;
    }
    const update = (node, value) => { if (node.textContent !== value) node.textContent = value; };
    for (const [index, row] of [...el.querySelectorAll('[data-order-id]')].entries()) {
      const o = s.orders[index];
      update(row.querySelector('strong'), o.label || '交货订单');
      update(row.querySelector('[data-order-progress]'), formatHudNumber(o.progress));
      update(row.querySelector('[data-order-target]'), formatHudNumber(o.target));
      update(row.querySelector('[data-order-reward]'), '+' + formatHudNumber(o.reward) + ' ◆');
      update(row.querySelector('[data-order-time]'), orderTime(o.life));
      row.querySelector('.task-meter i').style.width = `${Math.min(100, o.progress/o.target*100)}%`;
    }
  });
}
