import {isResting} from "./villager-life.js";
import { TASKS, taskReady, taskState, taskStatus } from "./operations.js";
import { ensureCommunity, jobAvailable } from "./residents.js";
import { ensureGrid, gridConnected, powerSnapshot } from "./power.js";

const jobs = {
  farm: "farmer",
  wool: "rancher",
  treasure: "rancher",
  music: "musician",
  note: "engineer",
};
export function taskControl(s, key, power = powerSnapshot(s)) {
  if (key === "piston") {
    const automated = !!s.counts.M8,
      grid = ensureGrid(s),
      collecting = s.harvest.piston > 0,
      controller = collecting ? "M8" : "M3";
    const load = power.loads.find((l) => l.id === controller);
    let mode = automated ? "redstone" : "manual";
    let label = automated
      ? "红石自动运行"
      : s.harvest.piston > 0
        ? "点击采集"
        : "手动触发";
    if (automated && grid.disabled.includes(controller)) {
      mode = "blocked";
      label = "红石已暂停";
    } else if (automated && !gridConnected(s, controller)) {
      mode = "blocked";
      label = "红石未接通";
    } else if (automated && load && load.fraction <= 0) {
      mode = "blocked";
      label = "红石等待供电";
    } else if (
      automated &&
      (!load ||
        (collecting &&
          s.buffers.overworld.raw >=
            120 *
              (1 + (s.counts.M4 || 0)) ** 1.5 *
              (1 + (s.counts.E6 || 0) * 0.5)))
    )
      label = "红石自动待机";
    else if (automated && load.fraction < 0.99) label = "红石低电运行";
    return {
      mode,
      label,
      disabled: !s.counts.M3,
      detail:
        s.harvest.piston > 0
          ? `${Math.ceil(s.harvest.piston)} 份待收取${automated ? " · 漏斗按实际供电搬运，也可点击协助" : " · 点击送入生产线"}`
          : automated
            ? "按供电与仓储余量自动生产 · 可手动协助"
            : "点击启动，再次点击收取产物",
    };
  }
  const task = TASKS[key];
  if (!task) return null;
  const t = taskState(s, key),
    grid = ensureGrid(s);
  const workers = ensureCommunity(s).residents.filter(
    (r) => !r.reserve && r.job === jobs[key] && jobAvailable(s, r.job),
  );
  const ready = taskReady(s, key),
    configured = !!grid.automation[key];
  let mode = "manual",
    label = ["music", "note"].includes(key) ? "手动触发" : "点击采集";
  let detail = taskStatus(s, key);
  if (configured) {
    mode = "redstone";
    label = "红石自动运行";
    const load = power.loads.find((l) => l.id === `auto-${key}`);
    const controller = ["music", "note"].includes(key) ? "M10" : "M14";
    if (!s.counts[controller] || !s.counts.M10) {
      label = "红石等待设备";
      mode = "blocked";
    } else if (
      grid.disabled.includes(controller) ||
      grid.disabled.includes(task.id)
    ) {
      label = "红石已暂停";
      mode = "blocked";
    } else if (!gridConnected(s, task.id)) {
      label = "红石未接通";
      mode = "blocked";
    } else if (load && load.fraction <= 0 && !t.manual) {
      label = "红石等待供电";
      mode = "blocked";
    } else if (!ready && !t.manual) label = "红石自动待机";
    else if (load && load.fraction < 0.99 && !t.manual) label = "红石低电运行";
    detail = `${detail} · ${load?.actual > 0 ? `${Number(load.actual.toFixed(2))} E/秒` : "按需用电"}`;
  } else if (workers.length) {
    mode = "villager";
    label = workers.every(r=>isResting(s,r)) ? "村民休息中" : "村民托管中";
    detail = `${workers.map((r) => r.name).join("、")} · ${workers.some((r) => r.activity === "travel") ? "正在前往工作点" : taskStatus(s, key)}`;
  }
  if (t.pendingHarvest > 0) {
    mode = "blocked";
    label = "等待入库";
    detail = "这批收获尚未入库，空出仓储后继续。";
  } else if (t.manual) detail = "正在完成本次手动协助";
  else if (mode !== "manual" && ready) detail += " · 可点击协助";
  return {
    mode,
    label,
    detail,
    disabled: !s.counts[task.id] || !ready || t.manual || t.pendingHarvest > 0,
  };
}
