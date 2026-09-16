import {researchForItem,researchRequirements} from './research.js';
import {facilityStored} from './facility-storage.js';
import {housingBlock} from './housing-data.js';
import { ITEMS } from "./catalog.js";
import { populationBlock } from "./population.js";
import { n, price, requirements, populationCap, formatWallet } from "./game.js";
import { icon } from "./icons.js";
import { facilityUpgrades } from './upgrades.js';
import { isCreatureOwner } from './facility-growth.js';

// The same state drives catalog cards, facility shops and live affordability updates.
export function purchaseStatus(s, item, placement = null) {
  if(facilityStored(s,item?.id))return {kind:'stored',reason:'已收纳 · 免费摆回',label:'免费摆回',cost:0};
  const owned = n(s, item.id), cost = price(s, item, placement?.site?.realm || s.realm);
  const base = { cost, owned, links: [], reason: "", action: item.id === "V1" ? "扩地" : item.id === "V2" ? "添加村民" : owned ? "升级" : "购买" };
  if (owned >= item.max)
    return { ...base, kind: "complete", reason: item.id === 'V2' ? '村民名额已满' : facilityUpgrades(item.id).length && !isCreatureOwner(item.id)
      ? item.max === 1 ? '本体已建成' : '本体已满级'
      : item.max === 1 ? "已完成" : "已满级" };
  const missing = requirements(s, item);
  const links = item.deps.filter((id) => !n(s, id));
  if(researchRequirements(s,item).length)links.push("V11");
  if (item.gate?.id && !owned && n(s, item.gate.id) < item.gate.level) links.push(item.gate.id);
  if (item.realm === "end" && s.endEyes !== 12) links.push("E2");
  if (item.gate?.metric === "project" && missing.length) links.push("Z2");
  if (item.gate?.metric === "viewers" && missing.length) links.push("L2");
  if (missing.length)
    return { ...base, kind: "locked", reason: `需要先${missing.join("、")}`, links: [...new Set(links)] };
  if (item.id === "V2" && owned >= populationCap(s))
    return { ...base, kind: "locked", ...populationBlock(s) };
  if(item.id === "V2" && housingBlock(s))return {...base,kind:"locked",...housingBlock(s)};
  if (placement?.id === item.id)
    return { ...base, kind: "placing", reason: placement.site ? "位置已选 · 请确认" : placement.kind === "confirm" ? "等待购买确认" : "请点地图选择位置" };
  if (s.money < cost)
    return { ...base, kind: "short", reason: `还差 ${formatWallet(Math.ceil(cost - s.money))} 绿宝石` };
  return { ...base, kind: "ready" };
}

export function buttonContent(status) {
  if(status.kind==="stored")return `${icon("box",14)} 免费摆回`;
  if (status.kind === "complete") return `${icon("check", 14)} ${status.reason}`;
  if (status.kind === "locked") return `${icon("lock", 14)} ${status.action === '添加村民' ? '添加村民' : '查看条件'}`;
  if (status.kind === "placing") return `${icon("hand", 14)} 等待确认`;
  return `<span class="purchase-price">${formatWallet(status.cost)} <span class="mini-emerald"></span></span><span class="buy-action">${status.owned && status.action === '升级' ? icon('arrow',14) : status.action || (status.owned ? "升级" : "购买")}</span>`;
}

export function refreshPurchaseButton(button, status, name) {
  const signature = JSON.stringify(status);
  if (button.dataset.purchaseSignature === signature) return;
  button.dataset.purchaseSignature = signature;
  button.dataset.purchaseState = status.kind;
  button.disabled = ["complete", "placing"].includes(status.kind);
  button.setAttribute("aria-label", `${name}，${status.reason || `${formatWallet(status.cost)} 绿宝石，${status.action || (status.owned ? "升级" : "购买")}`}`);
  button.title = `${status.action || (status.owned ? '升级' : '购买')}${name}`;
  button.innerHTML = buttonContent(status);
  const container = button.closest("[data-card], [data-equipment-card], [data-guidance-card]");
  if (container) {
    container.dataset.purchaseState = status.kind;
    const reason = container.querySelector("[data-purchase-reason]");
    if (reason) {
      reason.textContent = status.reason;
      reason.hidden = !status.reason;
    }
  }
}

export function requirementLinks(status) {
  return status.links.map((id) => id==='housing'?`<button data-housing-open>村庄 · 住房 ${icon("arrow",14)}</button>`:`<button data-prerequisite="${id}">${ITEMS[id].name} ${icon("arrow", 14)}</button>`).join("");
}
