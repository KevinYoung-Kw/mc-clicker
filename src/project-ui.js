import { REALMS, ITEMS } from "./catalog.js";
import { formatWallet } from "./game.js";
import { projectProgress, REALM_PROJECT_TARGET } from "./project.js";

const upgrades = {
  overworld: { 采集: "M9", 运输: "M16", 加工: "M2", 交易: "V3" },
  nether: { 采集: "N3", 运输: "N2", 加工: "N4", 交易: "N2" },
  end: { 采集: "E4", 运输: "E5", 加工: "E8", 交易: "E5" },
};
export function projectMarkup() {
  return `<section class="engineering-panel" data-engineering><span class="eyebrow">ONE SITE · THREE LAYERS</span><h3 data-engineering-title></h3><p>不用再买第二层、第三层。主世界、下界和末地持续送来成品后，三层工程会自动建好。</p><ol class="engineering-layers">${["基座", "塔身", "冠顶"].map((name, i) => `<li data-layer="${i + 1}"><b>0${i + 1}</b><span>${name}</span><small></small><i><em></em></i></li>`).join("")}</ol><div class="engineering-total"><span>总施工进度</span><strong data-engineering-total></strong></div><div class="engineering-realms">${Object.entries(
    REALMS,
  )
    .map(
      ([realm, def]) =>
        `<section data-engineering-realm="${realm}"><header><strong>${def.name}</strong><span data-delivery-count></span></header><div class="engineering-meter"><i></i></div><p data-delivery-status></p><button data-project-improve>查看产能 →</button></section>`,
    )
    .join(
      "",
    )}</div><p class="engineering-note">每个世界各需完成 60,000 施工点。送到的成品会变成施工进度；交货慢时，查看下方各世界的提示，补足生产或运输。</p><button class="primary" data-engineering-ending hidden>三层已落成 · 查看创造模式 →</button><button class="quiet-button" data-engineering-logistics>查看物流与调度 →</button></section>`;
}
export function refreshProject(root, state, rates, active = true) {
  const progress = projectProgress(state);
  root.querySelectorAll("[data-engineering-card]").forEach((el) => {
    el.textContent = progress.complete
      ? "三层已落成 · 可进入创造模式"
      : `第 ${progress.layer} 层施工中 · 已落成 ${progress.finished} / 3 层`;
  });
  root.querySelectorAll("[data-engineering]").forEach((panel) => {
    panel.querySelector("[data-engineering-title]").textContent =
      progress.complete ? "三层全部落成" : `第 ${progress.layer} 层施工中`;
    panel.querySelector("[data-engineering-total]").textContent =
      `${formatWallet(progress.total)} / 180,000`;
    panel.querySelectorAll("[data-layer]").forEach((el) => {
      const layer = Number(el.dataset.layer),
        amount = Math.max(
          0,
          Math.min(
            1,
            (progress.total - (layer - 1) * REALM_PROJECT_TARGET) /
              REALM_PROJECT_TARGET,
          ),
        );
      el.classList.toggle("finished", amount === 1);
      el.classList.toggle(
        "current",
        !progress.complete && layer === progress.layer,
      );
      el.querySelector("small").textContent =
        amount === 1
          ? "已落成"
          : layer === progress.layer
            ? "施工中"
            : "待施工";
      el.querySelector("em").style.width = amount * 100 + "%";
    });
    panel.querySelectorAll("[data-engineering-realm]").forEach((el) => {
      const realm = el.dataset.engineeringRealm,
        value = progress.realms[realm],
        done = value >= REALM_PROJECT_TARGET;
      const region = rates.regions[realm],
        flow = active && !done ? state.projectFlow?.[realm] || 0 : 0;
      el.querySelector("[data-delivery-count]").textContent =
        `${formatWallet(value)} / 60,000`;
      el.querySelector(".engineering-meter i").style.width =
        (value / REALM_PROJECT_TARGET) * 100 + "%";
      el.querySelector("[data-delivery-status]").textContent = done
        ? "材料已交齐"
        : !active
          ? "已暂停 · 回到游戏继续交付"
          : flow > 0
            ? `正在交付 · +${flow.toFixed(1)} 施工点 / 秒`
            : `等待交货 · 检查${region.power < 0.99 ? "供电与线路" : region.bottleneck + "能力"}`;
      const button = el.querySelector("[data-project-improve]");
      button.hidden = done;
      const power = region.power < 0.99;
      button.dataset.projectImprove = power
        ? "power"
        : upgrades[realm][region.bottleneck];
      button.textContent = power
        ? "检查电力与接线 →"
        : `提升${region.bottleneck} · ${ITEMS[button.dataset.projectImprove].name} →`;
    });
    panel.querySelector("[data-engineering-ending]").hidden =
      !progress.complete;
  });
}
