import {facilityStored} from './facility-storage.js';
import { marketService } from './market-work.js';
import { ITEMS } from "./catalog.js";
import { POWER_BENEFITS, preparationSpeed } from "./power-benefits.js";
import {
  TASKS,
  taskState,
  taskReady,
  taskSize,
  harvestPeriod,
  localStock,
} from "./operations.js";
import { taskControl } from "./task-control-state.js";
import { ensureCommunity, activeHost, jobAvailable } from "./residents.js";
import {
  powerSnapshot,
  POWER_FACILITIES,
  NETWORK_FACILITIES,
  gridConnection,
} from "./power.js";
import { storageCapacity, upgradeExtraPower, upgradeMultiplier } from "./upgrades.js";
import { freightSpec, heatCapacity } from "./dimensional.js";
import { DIMENSION_RULES } from "./economy.js";

const jobs = {
  farm: "farmer",
  wool: "rancher",
  treasure: "rancher",
  music: "musician",
  note: "engineer",
};
const taskIds = Object.fromEntries(
  Object.entries(TASKS).map(([key, t]) => [t.id, key]),
);
const clamp = (n) => Math.max(0, Math.min(1, n || 0));
const fmt = (n) => Math.floor(n || 0).toLocaleString("zh-CN");
export const escapeStatus = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function formatCountdown(seconds) {
  const value = Math.max(0, Math.ceil(seconds || 0));
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}
function loadReason(load) {
  return (
    {
      off: "设备已暂停",
      "out-of-range": "线路未接通",
      "no-power": "等待供电",
      "not-connected": "未接入电网",
    }[load?.state] || ""
  );
}
export function facilityStatus(s, id, power = powerSnapshot(s)) {
  if (!s.counts[id] && !id.startsWith("auto-")) return null;
  if(facilityStored(s,id))return {id,tone:'idle',fields:[{key:'state',label:'运行状态',value:'已收纳 · 暂停工作',title:'已购等级与改造保留，摆回后恢复'}]};
  const key = taskIds[id],
    d = s.dimensions,
    load = power.loads.find((l) => l.id === id);
  let state =
      loadReason(load) || (load?.state === "working" ? "运行中" : "已就位"),
    tone = loadReason(load) ? "blocked" : "idle";
  const fields = [],
    field = (key, label, value, title = value) =>
      fields.push({ key, label, value: String(value), title: String(title) });
  let time, progress;
  if (key) {
    const task = taskState(s, key),
      control = taskControl(s, key, power),
      ready = taskReady(s, key),
      target = TASKS[key].work * taskSize(s, key);
    state = control.label;
    tone = control.mode;
    if (control.mode === "manual")
      state = ready ? "等待手动操作" : key === "farm" ? "生长中" : "准备中";
    if (task.manual) state = "手动协助中";
    const fullWork = task.work >= target - 1e-6;
    if (fullWork && ["farm", "wool", "chorus"].includes(key)) {
      state = key === "chorus" ? "仓储已满" : "等待转运";
      tone = "blocked";
    }
    if (task.pendingHarvest > 0) {
      state = "等待入库";
      tone = "blocked";
      field("pending-harvest", "尚未入库", `${fmt(task.pendingHarvest)} 份`);
    }
    time =
      task.cooldown > 0
        ? formatCountdown(task.cooldown / preparationSpeed(id, power))
        : task.work > 0 || task.manual
          ? fullWork
            ? "等待空位"
            : "作业中"
          : ready
            ? ["music", "note"].includes(key)
              ? "可触发"
              : "可采集"
            : formatCountdown(
                (1 - (s.harvest[key] || 0)) * harvestPeriod(s, key, power),
              );
    progress =
      task.work > 0 || task.manual
        ? task.work / target
        : task.cooldown > 0
          ? 1 - task.cooldown / 8
          : ready
            ? 1
            : s.harvest[key] || 0;
    if (task.pendingHarvest > 0) { time = "等待空位"; progress = 1; }
    if (jobs[key]) {
      const workers = ensureCommunity(s).residents.filter(
        (r) => !r.reserve && r.job === jobs[key] && jobAvailable(s, r.job),
      );
      field(
        "owner",
        "负责人",
        workers.length ? workers.map((r) => r.name).join("、") : "未分配",
      );
    }
    if (["farm", "wool"].includes(key))
      field(
        "stock",
        "待转运",
        `${fmt(localStock(s, key === "wool" ? "V7" : id))} 份`,
      );
  } else if (id === "V3") {
    const service=marketService(s),staff=(s.community?.residents||[]).filter(r=>r.job==="merchant"&&!r.reserve);
    const organizing=staff.some(r=>r.workplaceId==="V3"&&r.status==="整理货架");
    state=service.workers.length?service.workers.some(r=>r.activity==="working")?"村民售货中":"等待货物送到":organizing?"整理货架":staff.length?"售货员正在赶来":"基础卖货中";
    tone=service.workers.length?"villager":"idle";
    field("owner","售货员",staff.map(r=>r.name).join("、")||"未安排");
    field("service","卖货速度","×"+service.factor.toFixed(2));
  } else if (id === "M3") {
    const control = taskControl(s, "piston", power);
    state = control.label;
    tone = control.mode;
    const full =
      s.buffers.overworld.raw >= storageCapacity(s, "overworld", "raw");
    if (full && s.harvest.piston > 0) {
      state = "仓储已满";
      tone = "blocked";
    }
    field("stock", "待收取", `${fmt(s.harvest.piston)} 份`);
  } else if (["L4", "L5", "L14"].includes(id)) {
    const host = activeHost(s),
      seconds =
        id === "L4"
          ? s.live.host
          : id === "L5"
            ? s.live.respondCooldown
            : s.harvest.festival || 0;
    const on =
      power.perDevice.L2 > 0 && (id !== "L5" || power.perDevice.L5 > 0);
    state = !on
      ? "等待供电"
      : id === "L4" && !host
        ? "等待主持人"
        : seconds > 0
          ? id === "L4"
            ? "主持中"
            : "准备中"
          : "可触发";
    tone = !on || (id === "L4" && !host) ? "blocked" : "manual";
    time = seconds > 0 ? formatCountdown(seconds) : "可触发";
    if (id === "L4")
      field(
        "owner",
        "负责人",
        host?.name ||
          ensureCommunity(s).residents.find(
            (r) => !r.reserve && r.job === "host",
          )?.name ||
          "未分配",
      );
  }
  const spec = freightSpec(s, id),
    trip = d?.trips[id];
  if (spec && d) {
    const wait = Math.max(0, spec.period - (d.clocks[id] || 0)),
      source = s.buffers[spec.from][spec.source];
    const target = spec.target.startsWith("end")
      ? d.awaiting[spec.target]
      : s.buffers[spec.to][spec.target];
    const cap = storageCapacity(
      s,
      spec.to,
      ["raw", "endRaw"].includes(spec.target) ? "raw" : "goods",
    );
    // Mirror freight's actual pause/power rules, including free base carriers.
    // A departed trip can still arrive after its portal is closed.
    const fraction = upgradeExtraPower(s, id) > 0 ? power.perDevice[id] || 0 : 1;
    const stopped =
      s.grid.disabled.includes(id) || s.grid.links[id] === false
        ? "设备已暂停"
        : fraction <= 0 ? loadReason(load) || "等待供电" : "";
    const portalReady = s.counts.N1 && (id === "N6" || (s.counts.E2 && s.endEyes === 12));
    state =
      stopped ||
      (trip
        ? trip.remaining > 0
          ? "运输中"
          : "等待卸货"
        : !portalReady
          ? "等待传送门"
        : source <= 0
          ? "等待货物"
          : target >= cap
            ? "目的仓已满"
            : wait > 0
              ? "等待班次"
              : "准备装货");
    tone =
      stopped || state.includes("满") || state === "等待卸货" || state === "等待传送门"
        ? "blocked"
        : "redstone";
    time = stopped ? (stopped === "设备已暂停" ? "已暂停" : stopped) : trip
      ? trip.remaining > 0
        ? formatCountdown(trip.remaining / fraction)
        : "等待卸货"
      : state === "等待班次"
        ? formatCountdown(wait)
        : state === "准备装货" ? "可发车" : state;
    progress = trip
      ? 1 - trip.remaining / (trip.duration || trip.flight)
      : 1 - wait / spec.period;
    field(
      "cargo",
      "本班载货",
      `${fmt(trip?.cargo || 0)} / ${fmt(spec.capacity)} 份`,
    );
    field("delivered", "累计运输", `${fmt(d.moved[id])} 份`);
  }
  if (id === "N3" && d) {
    state = d.heat >= heatCapacity(s) ? "储热已满" : "蓄热中";
    field("heat", "储存热能", `${fmt(d.heat)} / ${fmt(heatCapacity(s))}`);
  }
  if (["V16", "N9"].includes(id)) {
    const period = id === "V16" ? 24 : 30,
      remaining = s.harvest[id === "V16" ? "golem" : "wither"] ?? period;
    state = "周期破岩";
    time = formatCountdown(remaining);
    progress = 1 - remaining / period;
  }
  if (id === "N5" && d) {
    progress = d.magmaProgress / DIMENSION_RULES.magmaPeriod;
    time =
      load?.state === "working"
        ? formatCountdown(
            (DIMENSION_RULES.magmaPeriod - d.magmaProgress) /
              Math.max(0.001, power.perDevice.N5 || 0),
          )
        : "等待生产";
    field("processed", "累计压制", `${fmt(d.magmaProcessed)} 份`);
  }
  if (["N12", "E7"].includes(id) && d) {
    const target = id === "N12" ? "nether" : s.transfer;
    const stock =
      id === "N12"
        ? s.buffers.overworld.goods
        : ["overworld", "nether", "end"]
            .filter((r) => r !== target)
            .reduce((n, r) => n + s.buffers[r].raw, 0);
    const stopped =
      loadReason(load) ||
      (s.grid.disabled.includes(id)
        ? "设备已暂停"
        : s.grid.links[id] === false
          ? "线路未接通"
          : "");
    const open = id === "N12" ? s.counts.N1 : s.counts.E2 && s.endEyes === 12;
    state =
      stopped ||
      (!open
        ? "等待传送门"
        : s.buffers[target].raw >= storageCapacity(s, target, "raw") - 0.001
          ? "目的仓已满"
          : stock <= 0
            ? "等待货物"
            : "正在转运");
    tone = state === "正在转运" ? "redstone" : "blocked";
    field("delivered", "累计转运", `${fmt(d.moved[id])} 份`);
    if (id === "E7") field("throughput", "总转运能力", `${fmt(DIMENSION_RULES.chestTransfer * upgradeMultiplier(s, id, "transfer"))} 份/秒`);
  }
  if (id === "E5" && d)
    field(
      "cargo",
      "待装卸",
      `${fmt(d.awaiting.endRaw + d.awaiting.endGoods)} 份`,
    );
  if (["M9", "M2", "N4", "N5", "E8", "E11"].includes(id)) {
    const realm = ITEMS[id].realm,
      raw = ["M9", "E11"].includes(id),
      bucket = raw ? "raw" : "goods";
    if (
      !loadReason(load) &&
      s.buffers[realm][bucket] >= storageCapacity(s, realm, bucket) - 0.001
    ) {
      state = "仓储已满";
      tone = "blocked";
    } else if (!raw && !loadReason(load) && s.buffers[realm].raw <= 0)
      state = "等待原料";
    field(
      "storage",
      raw ? "原料仓" : "成品仓",
      `${fmt(s.buffers[realm][bucket])} / ${fmt(storageCapacity(s, realm, bucket))}`,
    );
  }
  if (time !== undefined)
    fields.unshift({
      key: "time",
      label: "下次完成",
      value: time,
      title: time,
    });
  if (progress !== undefined)
    fields.splice(time !== undefined ? 1 : 0, 0, {
      key: "progress",
      label: "工作进度",
      value: String(Math.round(clamp(progress) * 100)),
      progress: true,
    });
  if (
    POWER_FACILITIES.has(id) ||
    load ||
    ["V4", "V9", "L4", "L14"].includes(id)
  ) {
    const related = power.loads.filter(
      (l) =>
        l.id === id ||
        l.id === `auto-${key}` ||
        (id === "M14" &&
          ["auto-farm", "auto-wool", "auto-mine"].includes(l.id)),
    );
    const actual = related.reduce((v, l) => v + l.actual, 0);
    field("power", "实际耗电", `${actual.toFixed(1)} E/秒`);
    if (id === "M14") {
      const fixed = ["farm", "wool", "mine"].reduce(
        (sum, k) => sum + s.grid.automation[k],
        0,
      );
      const total = ["farm", "wool", "mine"].reduce(
        (sum, k) => sum + (power.automation?.[k] || 0),
        0,
      );
      state =
        actual > 0
          ? "自动运行"
          : related.some((l) => l.state === "no-power")
            ? "等待供电"
            : total
              ? "等待工作就绪"
              : "等待分配";
      tone = actual > 0 ? "redstone" : "idle";
      field(
        "allocation",
        "固定 / 临时",
        `${fixed} / ${Math.max(0, total - fixed)} 台`,
      );
    }
  }
  const source = power.sources?.find((x) => x.id === id);
  if (POWER_BENEFITS[id]) {
    const speed = preparationSpeed(id, power), c = gridConnection(s, id);
    field("benefit", "电力增益", speed > 1
      ? `准备加快 ${Math.round((speed - 1) * 100)}%`
      : c.connected && !s.grid.disabled.includes(id)
        ? load?.state === "no-power" ? "缺电 · 按原速准备" : "就绪 · 准备时用电"
        : "未启用 · 按原速准备");
  }
  if (["M6", "M7", "M15", "N4", "E8"].includes(id)) {
    field("generation", "本机供电", `${(source?.rate || 0).toFixed(1)} E/秒`);
    if (["M6", "M7", "M15"].includes(id)) {
      state = source?.rate > 0 ? "持续供电" : "等待接入";
      tone = source?.rate > 0 ? "redstone" : "idle";
    }
  }
  if (NETWORK_FACILITIES.has(id) && id !== "M5" && (id !== "M4" || upgradeExtraPower(s, id) > 0)) {
    const c = gridConnection(s, id);
    field(
      "connection",
      id === "M17" ? "运输接入" : "电网",
      c.connected
        ? "已接入"
        : !c.gridReady
          ? "尚未建立"
          : !c.dimensionReady
            ? "等待传送门"
            : !c.requested
              ? "未接入"
              : !c.pathReady
                ? "路径受阻"
                : !c.inRange
                  ? "超出范围"
                  : "未接入",
    );
    if (s.grid.disabled.includes(id) && !POWER_BENEFITS[id]) {
      state = "已暂停";
      tone = "blocked";
    }
    // Keep the production system's specific blocking reason. Connection is its
    // own field, including for facilities which still offer manual operation.
    else if (
      !c.connected &&
      [
        "已就位",
        "运行中",
        "持续供电",
        "等待接入",
        "等待分配",
        "等待工作就绪",
      ].includes(state)
    ) {
      state =
        id === "M4"
          ? "储物可用"
          : id === "M2"
            ? "人工加工可用"
            : !c.gridReady
              ? "等待电网"
              : !c.requested
                ? "等待接入"
                : !c.pathReady
                  ? "路径受阻"
                  : !c.inRange
                    ? "超出供电范围"
                    : "等待接入";
      tone = ["M4", "M2"].includes(id) ? "idle" : "blocked";
    } else if (id === "M17") {
      state = "自动装卸已启用";
      tone = "redstone";
    }
  }
  fields.unshift({
    key: "state",
    label: "运行状态",
    value: state,
    title: state,
  });
  return { id, tone, fields };
}
function fieldMarkup(f) {
  return `<div class="facility-status-row" data-status-row="${f.key}"><dt>${f.label}</dt><dd>${f.progress ? `<span class="facility-meter" role="progressbar" aria-label="工作进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${f.value}"><i style="transform:scaleX(${Number(f.value) / 100})"></i></span><span data-status-value="${f.key}" class="facility-progress-number">${f.value}%</span>` : `<span data-status-value="${f.key}" title="${escapeStatus(f.title)}">${escapeStatus(f.value)}</span>`}</dd></div>`;
}
export function facilityStatusMarkup(s, id, power) {
  const model = facilityStatus(s, id, power);
  return model
    ? `<dl class="facility-status" data-facility-status="${id}" data-tone="${model.tone}" aria-label="${escapeStatus(ITEMS[id]?.name || id)}运行信息">${model.fields.map(fieldMarkup).join("")}</dl>`
    : "";
}
export function facilityStatusSummaryMarkup(s, id, power, blockedOnly = false) {
  const model = facilityStatus(s, id, power);
  return model ? `<p class="device-state-summary" data-facility-summary="${id}" data-tone="${model.tone}" ${blockedOnly ? `data-blocked-only ${model.tone === 'blocked' ? '' : 'hidden'}` : ''}>${escapeStatus((blockedOnly ? ITEMS[id].name + ' · ' : '') + model.fields[0].value)}</p>` : '';
}
export function refreshFacilityStatuses(root, s, power = powerSnapshot(s)) {
  const models = new Map();
  root.querySelectorAll('[data-facility-summary]').forEach(el => {
    const id = el.dataset.facilitySummary, model = models.get(id) || facilityStatus(s, id, power);
    models.set(id, model);
    if (!model) return;
    const onlyBlocked = el.hasAttribute('data-blocked-only'), text = (onlyBlocked ? ITEMS[id].name + ' · ' : '') + model.fields[0].value;
    if (el.textContent !== text) el.textContent = text;
    if (onlyBlocked) el.hidden = model.tone !== 'blocked';
    el.dataset.tone = model.tone;
  });
  root.querySelectorAll("[data-facility-status]").forEach((el) => {
    const id = el.dataset.facilityStatus;
    if (!models.has(id)) models.set(id, facilityStatus(s, id, power));
    const model = models.get(id);
    if (!model) return;
    if (el.dataset.tone !== model.tone) el.dataset.tone = model.tone;
    for (const f of model.fields) {
      let row = el.querySelector(`[data-status-row="${f.key}"]`);
      // Rows change only when a new capability is installed, never on timer ticks.
      if (!row) {
        el.insertAdjacentHTML("beforeend", fieldMarkup(f));
        continue;
      }
      const value = row.querySelector("[data-status-value]"),
        text = f.progress ? f.value + "%" : f.value;
      if (value.textContent !== text) value.textContent = text;
      if (value.title !== (f.title || "")) value.title = f.title || "";
      if (f.progress) {
        const meter = row.querySelector("[role=progressbar]");
        if (meter.getAttribute("aria-valuenow") !== f.value) {
          meter.setAttribute("aria-valuenow", f.value);
          meter.firstElementChild.style.transform = `scaleX(${Number(f.value) / 100})`;
        }
      }
    }
  });
}
